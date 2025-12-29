import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import crypto from "crypto";

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
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

// Generate a simple session token (in production, use JWT or similar)
function generateSessionToken(userId: number, openId: string): string {
  const payload = JSON.stringify({ userId, openId, created: Date.now() });
  return Buffer.from(payload).toString('base64');
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

    if (error) {
      console.error("[Google OAuth] Error:", error);
      const frontendUrl = GOOGLE_REDIRECT_URI!.replace('/api/auth/google/callback', '');
      res.redirect(`${frontendUrl}?error=${error}`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    // Verify state
    if (!stateStore.has(state)) {
      res.status(400).json({ error: "Invalid state parameter" });
      return;
    }
    stateStore.delete(state);

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

      // Generate session token
      const userId = (user as any).id ?? 0;
      const sessionToken = generateSessionToken(userId, user.openId);

      // Set cookie
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to frontend with token in URL
      const frontendUrl = GOOGLE_REDIRECT_URI!.replace('/api/auth/google/callback', '');
      res.redirect(`${frontendUrl}/oauth/callback?token=${sessionToken}`);
    } catch (error) {
      console.error("[Google OAuth] Callback failed:", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
