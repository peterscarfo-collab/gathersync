import { createOAuthState, verifyOAuthState } from "./oauthState";
import { sdk, recentAuth, AUTH_GRACE_MS } from "./sdk";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserById, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";

// Get base URL - use BASE_URL, fallback to Fly.io app name, then EXPO_PUBLIC_API_BASE_URL
function getBaseUrl(): string {
  // Priority: BASE_URL > Fly.io app name > EXPO_PUBLIC_API_BASE_URL
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  
  // Fallback to Fly.io app name if available
  if (process.env.FLY_APP_NAME) {
    return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  }
  
  // Use EXPO_PUBLIC_API_BASE_URL if set
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // Development fallback (localhost only)
  return "http://localhost:3000";
}

// Construct callback URL - use dynamic baseURL
function getCallbackUrl(): string {
  const baseUrl = getBaseUrl();
  // Ensure no trailing slash
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}/api/auth/google/callback`;
}

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// GOOGLE_REDIRECT_URI: Use env var if set, otherwise construct dynamically from BASE_URL
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || getCallbackUrl();
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
    (await getUserById(userInfo.openId)) ?? {
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
    
    // Determine frontend URL for post-login redirect.
    // This should point to the web app domain, not the API base URL.
    const getFrontendUrl = () => {
      // Explicit frontend URL is the source of truth
      if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
      if (process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL) return process.env.EXPO_PUBLIC_OAUTH_REDIRECT_URL;

      // Fallbacks
      if (process.env.BASE_URL) return process.env.BASE_URL;
      if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
      return "http://127.0.0.1:8081";
    };
    
    // Get frontend URL - use BASE_URL with Fly.io fallback
    const frontendUrl = getFrontendUrl();

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

      console.log(`[Auth] Successful login for user: ${googleUser.email}`);

      // TEMPORARILY SKIP DATABASE - just set session
      // const user = await syncUser({
      //   openId: googleUser.id,
      //   name: googleUser.name,
      //   email: googleUser.email,
      // });

      // Regenerate session to ensure it's properly saved
      req.session.regenerate((err) => {
        if (err) {
          console.error('[Auth] Session regeneration error:', err);
          return redirectWithParams({ error: 'session_failed' });
        }

        // Store user info in express-session (primary auth method)
        (req.session as any).user = {
          email: googleUser.email,
          name: googleUser.name,
          openId: googleUser.id,
          loginMethod: "google",
        };

        // Also create JWT token for fallback/cookie-based auth
        sdk.createSessionToken(googleUser.id, {
          name: googleUser.name || "",
          expiresInMs: ONE_YEAR_MS,
        }).then((sessionToken) => {
          // Set JWT cookie with same options as session cookie
          const cookieOptions = getSessionCookieOptions(req);
          res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

          // Store in recentAuth for grace period
          recentAuth.set(sessionToken, {
            token: sessionToken,
            expires: Date.now() + AUTH_GRACE_MS,
          });

          // CRITICAL: Save express-session before redirect
          // This ensures connect.sid cookie is set with user data
          // Also verify session was saved correctly
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('[OAuth Callback] ❌ Session save error:', saveErr);
              return redirectWithParams({ error: 'session_failed' });
            }

            // Verify session was saved
            const savedSessionUser = (req.session as any)?.user;
            if (!savedSessionUser) {
              console.error('[OAuth Callback] ❌ Session saved but user data missing!');
              return redirectWithParams({ error: 'session_data_missing' });
            }

            console.log('[OAuth Callback] ✅ Session saved successfully');
            console.log('[OAuth Callback] ✅ Session ID:', req.sessionID?.substring(0, 15));
            console.log('[OAuth Callback] ✅ User:', savedSessionUser.email);
            console.log('[OAuth Callback] ✅ User OpenID:', savedSessionUser.openId?.substring(0, 10));
            console.log('[OAuth Callback] ✅ Both cookies set: connect.sid +', COOKIE_NAME);
            
            // Log cookie options for debugging
            console.log('[OAuth Callback] Cookie options:', JSON.stringify(cookieOptions, null, 2));
            
            // Always redirect users back to the configured frontend app URL.
            const finalRedirectUrl = frontendUrl;
            console.log("[OAuth Callback] Redirecting to:", finalRedirectUrl);
            return res.redirect(finalRedirectUrl);
          });
        }).catch((tokenErr) => {
          console.error('[OAuth Callback] Session token creation error:', tokenErr);
          return redirectWithParams({ error: 'token_failed' });
        });
      });
    } catch (err: any) {
      return redirectWithParams({
        error: err?.message || "oauth_failed",
      });
    }
  });
}
