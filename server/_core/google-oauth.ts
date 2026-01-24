import { createOAuthState, verifyOAuthState } from "./oauthState";
import { sdk, recentAuth, AUTH_GRACE_MS } from "./sdk";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error("Google OAuth not configured");
}

// In-memory state storage (in production, use Redis or database)


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

  return (
    (await getUserByOpenId(userInfo.openId)) ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: "google",
      lastSignedIn,
    }
  );
}

function generateSessionToken(userId: number, openId: string): string {
  const payload = JSON.stringify({ userId, openId, created: Date.now() });
  return Buffer.from(payload).toString("base64");
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/auth/google", (_req: Request, res: Response) => {
    const state = createOAuthState();
const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: GOOGLE_REDIRECT_URI!,
      response_type: "code",
scope:
  "https://www.googleapis.com/auth/userinfo.email " +
  "https://www.googleapis.com/auth/userinfo.profile " +
  "https://www.googleapis.com/auth/calendar",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");
    
    // Use FRONTEND_URL or EXPO_PUBLIC_OAUTH_REDIRECT_URL, fallback to localhost for dev
    const isProduction = process.env.NODE_ENV === "production";
    const getFrontendUrl = () => 
      process.env.FRONTEND_URL || 
      process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 
      (isProduction ? "https://app.gathersync.app" : "http://127.0.0.1:8081");
    
    const frontendUrl = getFrontendUrl();

const redirectWithParams = (params: Record<string, string>) => {
  const base = getFrontendUrl();
  const u = new URL("/", base); // ALWAYS frontend root

  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }

  return res.redirect(u.toString());
};


    if (error) {
      return redirectWithParams({ error });
    }

const stateCheck = verifyOAuthState(state);

if (!stateCheck.ok) {
  return redirectWithParams({ error: stateCheck.reason });
}

if (!code) {
  return redirectWithParams({ error: "missing_code" });
}



    try {
      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            redirect_uri: GOOGLE_REDIRECT_URI!,
            grant_type: "authorization_code",
          }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error("Token exchange failed");
      }

      const tokens = await tokenResponse.json();

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );

      if (!userInfoResponse.ok) {
        throw new Error("Userinfo request failed");
      }

      const googleUser = await userInfoResponse.json();

      const user = await syncUser({
        openId: googleUser.id,
        name: googleUser.name,
        email: googleUser.email,
      });

     const sessionToken = await sdk.createSessionToken(user.openId!, {
  name: googleUser.name || "",
  expiresInMs: ONE_YEAR_MS,
});

const isProd = process.env.NODE_ENV === "production";

res.cookie(COOKIE_NAME, sessionToken, {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  domain: isProd ? ".gathersync.app" : undefined,
  path: "/",
  maxAge: ONE_YEAR_MS, // or whatever you use here
});



	recentAuth.set(sessionToken, {
  	token: sessionToken,
  	expires: Date.now() + AUTH_GRACE_MS,
	});

return res.redirect(frontendUrl);
    } catch (err: any) {
      return redirectWithParams({
        error: err?.message || "oauth_failed",
      });
    }
  });
}
