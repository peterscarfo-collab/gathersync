import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cookieParser from "cookie-parser";
import session from "express-session";
import cors from "cors";
import * as jwt from "jsonwebtoken";
import path from "path";

import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleOAuthRoutes } from "./google-oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { publicApiRouter } from "../public-api";
import { COOKIE_NAME } from "../../shared/const.js";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

/* ---------------------------------------------------- */
/* Port helpers                                         */
/* ---------------------------------------------------- */

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, '0.0.0.0', () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/* ---------------------------------------------------- */
/* Server                                               */
/* ---------------------------------------------------- */

async function startServer() {
  const app = express();

  // Add at the top: tells the app it's behind Fly.io's proxy
  app.set('trust proxy', 1);

  // Determine if we're in production
  const isProduction = process.env.NODE_ENV === "production" || process.env.FLY_APP_NAME;

  // Log environment detection
  console.log("[Server Config] Environment detection:", {
    NODE_ENV: process.env.NODE_ENV || "(not set)",
    FLY_APP_NAME: process.env.FLY_APP_NAME || "(not set)",
    isProduction,
  });

  // The specific session config that survives redirects
  // For cross-origin requests (app.gathersync.app -> gathersync.fly.dev), we need:
  // - sameSite: 'none' (allows cross-site cookies)
  // - secure: true (required for sameSite: 'none')
  // - No domain (let browser set it automatically based on the Set-Cookie header origin)
  const sessionCookieConfig = {
    secure: isProduction, // true in production, false in dev
    sameSite: (isProduction ? 'none' : 'lax') as const, 
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    // Don't set domain - let browser handle it based on the response origin
    // This ensures cookies work for both same-origin and cross-origin requests
  };

  console.log("[Server Config] Express-session cookie settings:", {
    name: 'connect.sid',
    secure: sessionCookieConfig.secure,
    sameSite: sessionCookieConfig.sameSite,
    httpOnly: sessionCookieConfig.httpOnly,
    maxAge: `${sessionCookieConfig.maxAge / 1000 / 60 / 60}h`,
  });

  // CORS configuration - must use specific origins (not "*") when credentials: true
  // The origin is the domain making the REQUEST, not the destination
  // Allow both production web domains:
  // - gathersync.app (actual app)
  // - app.gathersync.app (marketing/landing)
  const corsOrigin = isProduction 
    ? ["https://gathersync.fly.dev", "https://gathersync.app", "https://app.gathersync.app"]
    : true; // Allow all in development

  app.use(cors({
    origin: corsOrigin, // Do not use "*"
    credentials: true, // Required to receive cookies from the frontend
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Instant-User-ID',
      'X-Instant-User-Email',
    ],
  }));
  
  // Log critical environment variables at startup
  console.log("[Server] Trust proxy enabled: app.set('trust proxy', 1)");
  console.log("[Server] Environment check:", {
    hasAppId: !!process.env.APP_ID,
    appId: process.env.APP_ID || "(not set)",
    hasSessionSecret: !!process.env.SESSION_SECRET,
    nodeEnv: process.env.NODE_ENV,
    flyAppName: process.env.FLY_APP_NAME || "(not set)",
  });

  /* ---------------- Cookies FIRST (before session) ------------------- */
  app.use(cookieParser());

  // Configure express-session
  // NOTE: Using default MemoryStore - sessions are lost on server restart
  // This is OK because we have JWT cookie fallback (COOKIE_NAME)
  app.use(session({
    name: 'connect.sid',  // Use the standard name
    secret: process.env.SESSION_SECRET || 'gathersync_dev_secret',
    resave: false,
    saveUninitialized: false, // Don't create session until something is stored
    proxy: true, // Trust proxy headers (Fly.io)
    cookie: sessionCookieConfig,
    rolling: false, // Don't reset expiration on every request
    // No store specified = MemoryStore (sessions lost on restart, but JWT cookie works)
  }));
  
  // Middleware to log authentication issues (only for failed protected routes)
  app.use((req, res, next) => {
    // Only log for protected tRPC routes that might fail auth
    if (req.path.startsWith('/api/trpc') && 
        (req.path.includes('events.list') || req.path.includes('events.get'))) {
      const cookieHeader = req.headers.cookie || '';
      const hasConnectSid = cookieHeader.includes('connect.sid');
      const hasCookieToken = cookieHeader.includes(COOKIE_NAME);
      const sessionUser = (req.session as any)?.user;
      
      // Only log if we have cookies but no session user (potential issue)
      if ((hasConnectSid || hasCookieToken) && !sessionUser) {
        console.warn('[Session Middleware] Cookies present but no session user:', {
          path: req.path,
          hasConnectSid,
          hasCookieToken,
          sessionId: req.sessionID?.substring(0, 10),
        });
      }
    }
    next();
  });

  /**
   * 🔑 CRITICAL: cookie → Authorization bridge
   */
  app.use((req, _res, next) => {
    const cookieToken = (req as any).cookies?.[COOKIE_NAME];
    if (!req.headers.authorization && cookieToken) {
      req.headers.authorization = `Bearer ${cookieToken}`;
    }
    next();
  });

  /* ---------------- Status route -------------------- */
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok" });
  });

  /* ---------------- Debug route for authentication -------------------- */
  app.get("/api/auth/debug", (req, res) => {
    const cookieHeader = req.headers.cookie || '';
    const sessionUser = (req.session as any)?.user;
    const cookieToken = req.cookies?.[COOKIE_NAME];
    
    res.json({
      hasCookieHeader: !!cookieHeader,
      cookieHeaderLength: cookieHeader.length,
      cookieHeaderPreview: cookieHeader.substring(0, 200),
      hasConnectSid: cookieHeader.includes('connect.sid'),
      hasCookieToken: cookieHeader.includes(COOKIE_NAME),
      hasSession: !!req.session,
      sessionId: req.sessionID?.substring(0, 15),
      hasSessionUser: !!sessionUser,
      sessionUserEmail: sessionUser?.email,
      sessionUserOpenId: sessionUser?.openId?.substring(0, 10),
      parsedCookies: req.cookies ? Object.keys(req.cookies) : [],
      cookieTokenExists: !!cookieToken,
      cookieTokenLength: cookieToken?.length,
      origin: req.headers.origin,
      host: req.headers.host,
      referer: req.headers.referer,
    });
  });

  /* ---------------- OAuth routes -------------------- */
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);

  /**
   * Convert Bearer token → httpOnly session cookie
   */
  app.post("/api/auth/session", (req, res) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ")
        ? auth.slice("Bearer ".length)
        : null;

      if (!token) {
        return res.status(401).json({ ok: false, error: "missing_bearer_token" });
      }

      // SESSION_SECRET is the primary secret for session management
      const secret =
        process.env.SESSION_SECRET || process.env.JWT_SECRET || process.env.COOKIE_SECRET;

      console.log("[Auth Session] SESSION_SECRET exists:", !!process.env.SESSION_SECRET);
      console.log("[Auth Session] Secret found:", !!secret);

      if (!secret) {
        return res.status(500).json({ ok: false, error: "missing_jwt_secret" });
      }

      jwt.verify(token, secret);

      // Use getSessionCookieOptions for proper production cookie settings
      // This ensures secure: true, sameSite: 'lax' for production with trust proxy active
      // cookieOptions already includes maxAge (24h for production)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, cookieOptions);

      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(401).json({
        ok: false,
        error: e?.message || "invalid_token",
      });
    }
  });

  /* ---------------- Body parsing -------------------- */
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  /* ---------------- Health -------------------------- */
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.get("/api/version", (_req, res) => {
    res.json({ version: "cookie-to-auth-v1", timestamp: Date.now() });
  });

  /* ---------------- Debug --------------------------- */
  app.get("/api/debug/auth", (req, res) => {
    const cookieToken = (req as any).cookies?.[COOKIE_NAME];
    const auth = req.headers.authorization;

    res.json({
      cookieName: COOKIE_NAME,
      hasCookieToken: !!cookieToken,
      cookieTokenPrefix: cookieToken ? cookieToken.slice(0, 20) : null,
      hasAuthHeader: !!auth,
      authPrefix: auth ? auth.slice(0, 30) : null,
      host: req.headers.host ?? null,
      origin: req.headers.origin ?? null,
    });
  });

  app.get("/api/debug/whoami", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ ok: true, user });
    } catch (e: any) {
      res.status(401).json({
        ok: false,
        error: e?.message ?? "unauthorized",
      });
    }
  });

  // Debug: verify X-Instant-User-ID is received and which user the server loads (same path as auth.me)
  app.get("/api/debug/instant-user", async (req, res) => {
    const instantUserId = req.headers["x-instant-user-id"];
    const instantUserEmail = req.headers["x-instant-user-email"];
    try {
      const dbModule = await import("../db");
      const user = instantUserId ? await dbModule.getUserById(instantUserId) : null;
      res.json({
        hasHeader: Boolean(instantUserId),
        headerUserId: instantUserId ?? null,
        headerEmail: instantUserEmail ?? null,
        user: user
          ? {
              id: user.id,
              email: (user as any).email,
              subscriptionTier: (user as any).subscriptionTier,
              isLifetimePro: (user as any).isLifetimePro,
              role: (user as any).role,
            }
          : null,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message });
    }
  });

  /* ---------------- Debug: Database Events --------------------------- */
  app.get("/api/debug/events", async (_req, res) => {
    try {
      const dbModule = await import("../db");
      const allEvents = await dbModule.getAllEvents();
      
      const eventsWithUsers = allEvents.map((event) => {
        return {
          id: event.id,
          userId: event.userId,
          name: event.name,
          eventType: event.eventType,
          month: event.month,
          year: event.year,
          archived: event.archived,
          finalized: event.finalized,
          deletedAt: event.deletedAt ? event.deletedAt.toISOString() : null,
          createdAt: event.createdAt.toISOString(),
          updatedAt: event.updatedAt.toISOString(),
        };
      });

      res.json({
        ok: true,
        totalEvents: allEvents.length,
        activeEvents: allEvents.filter(e => !e.deletedAt).length,
        deletedEvents: allEvents.filter(e => e.deletedAt).length,
        events: eventsWithUsers,
      });
    } catch (e: any) {
      console.error("[Debug] Failed to get events:", e);
      res.status(500).json({
        ok: false,
        error: e?.message ?? "database_error",
        stack: process.env.NODE_ENV === "development" ? e?.stack : undefined,
      });
    }
  });

  /* ---------------- Debug: Database Stats --------------------------- */
  app.get("/api/debug/db-stats", async (_req, res) => {
    try {
      const dbModule = await import("../db");
      const allEvents = await dbModule.getAllEvents();
      const uniqueUserIds = new Set(allEvents.map(e => e.userId));
      
      // Get user counts
      const drizzleDb = await dbModule.getDb();
      let userCount = 0;
      if (drizzleDb) {
        const { users } = await import("../../drizzle/schema");
        const allUsers = await drizzleDb.select().from(users);
        userCount = allUsers.length;
      }

      res.json({
        ok: true,
        database: {
          connected: !!drizzleDb,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
        },
        events: {
          total: allEvents.length,
          active: allEvents.filter(e => !e.deletedAt).length,
          deleted: allEvents.filter(e => e.deletedAt).length,
          archived: allEvents.filter(e => e.archived).length,
          finalized: allEvents.filter(e => e.finalized).length,
          uniqueUsers: uniqueUserIds.size,
        },
        users: {
          total: userCount,
        },
      });
    } catch (e: any) {
      console.error("[Debug] Failed to get DB stats:", e);
      res.status(500).json({
        ok: false,
        error: e?.message ?? "database_error",
        stack: process.env.NODE_ENV === "development" ? e?.stack : undefined,
      });
    }
  });

  /* ---------------- Public API ---------------------- */
  app.use("/api/public", publicApiRouter);

  /* ---------------- tRPC ---------------------------- */
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  /* ---------------- Static Files (Frontend) --------- */
  // Serve static files from dist-web directory
  // Use process.cwd() to get the app root directory
  const distWebPath = path.join(process.cwd(), "dist-web");
  app.use(express.static(distWebPath));

  /* ---------------- Catch-all Route (SPA) ----------- */
  // Serve index.html for all non-API routes (SPA routing)
  app.get("*", (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(path.join(distWebPath, "index.html"));
  });

  /* ---------------- Listen -------------------------- */
  const port = Number(process.env.PORT) || 3000;
  const host = '0.0.0.0';

  app.listen(port, host, () => {
    console.log(`✅ Server reachable at http://${host}:${port}`);
  });
}

// Export as default for server/index.js to import (production)
export default startServer;

// For dev mode: execute directly when run with tsx watch
// This allows 'tsx watch server/_core/index.ts' to work
if (process.env.NODE_ENV === 'development' && !process.env.SKIP_AUTO_START) {
  startServer().catch(console.error);
}


