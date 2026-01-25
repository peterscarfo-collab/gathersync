import { createOAuthState, verifyOAuthState } from "./oauthState";
import { sdk, recentAuth, AUTH_GRACE_MS } from "./sdk";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Construct callback URL - use exact Fly.io URL for production
function getCallbackUrl(): string {
  // Production: Always use Fly.io URL when FLY_APP_NAME is set or NODE_ENV is production
  if (process.env.FLY_APP_NAME || process.env.NODE_ENV === "production") {
    return "https://gathersync.fly.dev/api/auth/google/callback";
  }
  // Development fallback
  return "http://localhost:3000/api/auth/google/callback";
}

const CALLBACK_URL = getCallbackUrl();

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
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
      redirect_uri: CALLBACK_URL,
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
    
    // Determine frontend URL - use production URL for Fly.io, localhost for dev
    // Check if running on Fly.io (FLY_APP_NAME is set by Fly.io) or production
    const isProduction = process.env.FLY_APP_NAME || process.env.NODE_ENV === "production";
    const getFrontendUrl = () => {
      if (isProduction) {
        // Production: ALWAYS redirect to live Fly.io URL (never localhost/127.0.0.1)
        return "https://gathersync.fly.dev";
      }
      // Development: use environment variable or fallback to localhost
      return process.env.FRONTEND_URL || 
             process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL || 
             "http://127.0.0.1:8081";
    };
    
    // Get frontend URL - ensure production always uses Fly.io
    const frontendUrl = isProduction ? "https://gathersync.fly.dev" : getFrontendUrl();

const redirectWithParams = (params: Record<string, string>) => {
  const base = getFrontendUrl();
  const u = new URL("/", base); // ALWAYS frontend root

  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }

  return res.redirect(u.toString());
};

    // Log callback details for debugging (remove in production if needed)
    console.log("[OAuth Callback] Received:", {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      queryKeys: Object.keys(req.query),
      callbackUrl: CALLBACK_URL,
    });

    if (error) {
      console.error("[OAuth Callback] Error from Google:", error);
      return redirectWithParams({ error });
    }

    // Verify state parameter - this prevents CSRF attacks
    if (!state) {
      console.error("[OAuth Callback] Missing state parameter");
      return redirectWithParams({ error: "missing_state" });
    }

const stateCheck = verifyOAuthState(state);

if (!stateCheck.ok) {
  console.error("[OAuth Callback] State verification failed:", stateCheck.reason);
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
            redirect_uri: CALLBACK_URL,
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

// Use getSessionCookieOptions for proper production cookie settings
// cookieOptions already includes maxAge (24h for production, or can be overridden)
const cookieOptions = getSessionCookieOptions(req);
console.log("[OAuth Callback] Setting cookie with options:", JSON.stringify(cookieOptions, null, 2));
console.log("[OAuth Callback] Session token length:", sessionToken?.length || 0);
res.cookie(COOKIE_NAME, sessionToken, cookieOptions);



	recentAuth.set(sessionToken, {
  	token: sessionToken,
  	expires: Date.now() + AUTH_GRACE_MS,
	});

// Ensure production always redirects to Fly.io (never localhost/127.0.0.1)
const finalRedirectUrl = isProduction ? "https://gathersync.fly.dev" : frontendUrl;
console.log("[OAuth Callback] Redirecting to:", finalRedirectUrl, { isProduction, frontendUrl });
return res.redirect(finalRedirectUrl);
    } catch (err: any) {
      return redirectWithParams({
        error: err?.message || "oauth_failed",
      });
    }
  });
}
