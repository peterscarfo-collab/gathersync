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

  // The specific session config that survives redirects
  app.use(session({
    name: 'connect.sid',  // Use the standard name
    secret: process.env.SESSION_SECRET || 'gathersync_dev_secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  // The bridge that lets the browser send the cookie
  app.use(cors({
    origin: 'https://gathersync.fly.dev',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']  // ← Add this
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

  /* ---------------- Cookies FIRST ------------------- */
  app.use(cookieParser());

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

  const server = createServer(app);

  /* ---------------- Status route -------------------- */
  app.get("/api/status", (_req, res) => {
    res.json({ status: "ok" });
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
  const PORT = process.env.PORT || 3000;
  const port = parseInt(String(PORT), 10);

  // Listen on 0.0.0.0 to accept connections from all interfaces (required for cloud deployment)
  server.listen(port, '0.0.0.0', () => {
    console.log('FORCE_START: Listening on 0.0.0.0:' + port);
    console.log(`[api] server listening on port ${port}`);
    console.log('Server is officially listening on port', port);
  });
}

// Export as default for server/index.js to import (production)
export default startServer;

// For dev mode: execute directly when run with tsx watch
// This allows 'tsx watch server/_core/index.ts' to work
if (process.env.NODE_ENV === 'development' && !process.env.SKIP_AUTO_START) {
  startServer().catch(console.error);
}


