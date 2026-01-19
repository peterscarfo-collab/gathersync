import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleOAuthRoutes } from "./google-oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { publicApiRouter } from "../public-api";
import cookieParser from "cookie-parser";
import { COOKIE_NAME } from "../../shared/const.js";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
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

async function startServer() {
  const app = express();

  // IMPORTANT: trust proxy so req.protocol + secure cookies behave correctly behind Fly
  app.set("trust proxy", 1);

  // Cookie parsing MUST come before anything that needs req.cookies
  app.use(cookieParser());

  /**
   * ✅ KEY FIX:
   * If the browser sends the session cookie, force it into Authorization:
   * so tRPC context/auth code can reliably read it as Bearer.
   */
  app.use((req, _res, next) => {
    const cookieToken = (req as any).cookies?.[COOKIE_NAME];
    if (!req.headers.authorization && cookieToken) {
      req.headers.authorization = `Bearer ${cookieToken}`;
    }
    next();
  });

  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Register OAuth routes BEFORE express.json() to prevent JSON serialization of redirects
  registerOAuthRoutes(app);
  registerGoogleOAuthRoutes(app);

  // JSON parsing middleware (after OAuth routes)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Bump this string so you can confirm the deploy is live
  app.get("/api/version", (_req, res) => {
    res.json({
      version: "oauth-fix-v7-cookie-to-auth",
      timestamp: Date.now(),
    });
  });

  /**
   * ✅ DEBUG ENDPOINT:
   * Visit https://api.gathersync.app/api/debug/auth in the SAME logged-in browser session.
   * It should show hasCookieToken:true and hasAuthHeader:true
   */
  app.get("/api/debug/auth", (req, res) => {
    const cookieToken = (req as any).cookies?.[COOKIE_NAME] as string | undefined;
    const auth = req.headers.authorization as string | undefined;

    res.json({
      cookieName: COOKIE_NAME,
      hasCookieToken: !!cookieToken,
      cookieTokenPrefix: cookieToken ? cookieToken.slice(0, 20) : null,
      hasAuthHeader: !!auth,
      authPrefix: auth ? auth.slice(0, 30) : null,
      host: req.headers.host || null,
      origin: req.headers.origin || null,
    });
  });

  // Stripe webhook (raw body needed for signature verification)
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const { handleStripeWebhook } = await import("../webhooks/stripe");
      return handleStripeWebhook(req, res);
    },
  );

  // Public REST API (no authentication)
  app.use("/api/public", publicApiRouter);

app.get("/api/debug/cookies", (req, res) => {
  res.json({
    host: req.headers.host || null,
    origin: req.headers.origin || null,
    protocol: (req as any).protocol || null,
    forwardedProto: req.headers["x-forwarded-proto"] || null,
    cookieHeaderPresent: !!req.headers.cookie,
    cookieHeaderPrefix: req.headers.cookie ? String(req.headers.cookie).slice(0, 80) : null,
    cookieName: COOKIE_NAME,
    hasCookieToken: !!(req as any).cookies?.[COOKIE_NAME],
    cookieTokenPrefix: (req as any).cookies?.[COOKIE_NAME]
      ? String((req as any).cookies?.[COOKIE_NAME]).slice(0, 20)
      : null,
    authHeaderPresent: !!req.headers.authorization,
  });
});

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
