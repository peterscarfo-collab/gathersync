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

  // REQUIRED for Fly / reverse proxies
  app.set("trust proxy", 1);

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
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
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

      const secret =
        process.env.JWT_SECRET || process.env.COOKIE_SECRET;

      if (!secret) {
        return res.status(500).json({ ok: false, error: "missing_jwt_secret" });
      }

      jwt.verify(token, secret);

      const isProd = process.env.NODE_ENV === "production";

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });

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


