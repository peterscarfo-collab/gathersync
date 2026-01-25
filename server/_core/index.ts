import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cookieParser from "cookie-parser";
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

  // REQUIRED for Fly.io reverse proxy - MUST be the FIRST line after Express initialization
  // This ensures req.protocol correctly reports 'https' and req.secure is true
  // Without this, cookies with secure: true will be rejected
  // Using '1' (trust first proxy) is correct for Fly.io's single proxy setup
  app.set("trust proxy", 1);
  console.log("[Server] Trust proxy enabled: app.set('trust proxy', 1)");
  
  // Log critical environment variables at startup
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

  /* ---------------- CORS ---------------------------- */
  app.use((req, res, next) => {
    const isProduction = process.env.NODE_ENV === "production" || process.env.FLY_APP_NAME;
    
    // Production: Explicitly set origin to https://gathersync.fly.dev
    // Development: Use dynamic origin from request
    if (isProduction) {
      res.header("Access-Control-Allow-Origin", "https://gathersync.fly.dev");
    } else {
      const origin = req.headers.origin;
      if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
      }
    }
    
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

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
      // This ensures secure: true, sameSite: 'none' for production with trust proxy active
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

startServer().catch(console.error);


