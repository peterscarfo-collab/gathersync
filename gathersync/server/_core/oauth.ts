import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
}) {
  if (!userInfo.openId) throw new Error("openId missing");
  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return saved ?? { openId: userInfo.openId, name: userInfo.name, email: userInfo.email, lastSignedIn };
}

export function registerOAuthRoutes(app: Express) {
  // Use a unique name to break the redirect loop
  app.get("/auth/google/start", (req: Request, res: Response) => {
    try {
      const frontendUrl = "https://app.gathersync.app";
      const state = btoa(`${frontendUrl}/profile`);
      const authUrl = `${ENV.oAuthServerUrl}/auth/google?clientId=${ENV.appId}&state=${state}`;
      console.log("[OAuth] Redirecting to external server:", authUrl);
      res.redirect(authUrl);
    } catch (error) {
      console.error("[OAuth] Start failed", error);
      res.status(500).json({ error: "Failed to start Google login" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    
    // Check if this is a web callback (which comes with sessionToken directly)
    const sessionTokenParam = getQueryParam(req, "sessionToken");
    if (sessionTokenParam) {
      const frontendUrl = "https://app.gathersync.app";
      return res.redirect(`${frontendUrl}/oauth/callback?sessionToken=${sessionTokenParam}`);
    }

    if (!code || !state) return res.status(400).json({ error: "Missing params" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId!, { expiresInMs: ONE_YEAR_MS });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      
      // Decode the state to get the redirect URI
      let redirectUri = "https://app.gathersync.app/oauth/callback";
      try {
        const decodedState = atob(state);
        // If it's a valid URL, use it as the base
        if (decodedState.startsWith("http")) {
          // Parse the URL to safely add query params
          const url = new URL(decodedState);
          // If the state was just the frontend URL, append the callback path
          if (!url.pathname || url.pathname === "/") {
            url.pathname = "/oauth/callback";
          }
          redirectUri = url.toString();
        }
      } catch (e) {
        console.warn("[OAuth] Failed to decode state parameter, using default redirect URI");
      }
      
      // Append the session token
      const finalUrl = redirectUri.includes("?") 
        ? `${redirectUri}&sessionToken=${sessionToken}`
        : `${redirectUri}?sessionToken=${sessionToken}`;
        
      res.redirect(finalUrl);
    } catch (error: any) {
      console.error("[OAuth] Callback failed:", error?.response?.data || error);
      // Pass the error back to the frontend
      const frontendUrl = "https://app.gathersync.app";
      res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent(error?.response?.data?.error || "Callback failed")}`);
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user });
    } catch (error) {
      res.status(401).json({ error: "Not authenticated" });
    }
  });
}