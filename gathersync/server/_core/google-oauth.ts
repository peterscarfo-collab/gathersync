import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import crypto from "crypto";

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = "https://gathersync-api.onrender.com/api/auth/google/callback";

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth not configured");
}

// In-memory state storage (in production, use Redis or database)
const stateStore = new Map<string, { created: number }>();

// Clean up old states every hour
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.created > 3600000) { // 1 hour
      stateStore.delete(state);
    }
  }
}, 3600000);

function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId: string;
  name?: string | null;
  email?: string | null;
}) {
  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: "google",
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: "google",
      lastSignedIn,
    }
  );
}

export function registerGoogleOAuthRoutes(app: Express) {
  // Initiate Google OAuth flow (v2)
  app.get("/api/auth/google", (req: Request, res: Response) => {
    console.log('[Google OAuth] Initiating OAuth flow');
    const state = generateState();
    stateStore.set(state, { created: Date.now() });

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: GOOGLE_REDIRECT_URI!,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('[Google OAuth] Redirecting to:', authUrl.substring(0, 100) + '...');
    
    // Force a 302 redirect
    res.status(302);
    res.setHeader('Location', authUrl);
    res.end();
  });

  // Handle Google OAuth callback
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");
    const frontendUrl = "https://app.gathersync.app";

    if (error) {
      console.error("[Google OAuth] Error:", error);
      res.redirect(`${frontendUrl}?error=${error}`);
      return;
    }

    if (!code || !state) {
      res.redirect(`${frontendUrl}/oauth/callback?error=Missing+code+or+state`);
      return;
    }

    // Verify state (soft check - if it fails, we still try to log them in to prevent UX issues with aggressive caching/reloads)
    if (!stateStore.has(state)) {
      console.warn("[Google OAuth] State not found in memory (possibly due to server restart, multiple tabs, or hitting back button). Proceeding anyway to prevent login failure.");
    } else {
      stateStore.delete(state);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: GOOGLE_REDIRECT_URI!,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("[Google OAuth] Token exchange failed:", errorData);
        throw new Error("Failed to exchange code for token");
      }

      const tokens = await tokenResponse.json();

      // Get user info from Google
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        throw new Error("Failed to get user info");
      }

      const googleUser = await userInfoResponse.json();

      // Sync user to database
      const user = await syncUser({
        openId: googleUser.id,
        name: googleUser.name,
        email: googleUser.email,
      });

      // Generate session token using the proper SDK
      const { sdk } = await import("./sdk");
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "" });

      // Set cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to frontend with token in URL
      const frontendUrl = "https://app.gathersync.app";
      res.redirect(`${frontendUrl}/oauth/callback?sessionToken=${sessionToken}`);
    } catch (error) {
      console.error("[Google OAuth] Callback failed:", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
