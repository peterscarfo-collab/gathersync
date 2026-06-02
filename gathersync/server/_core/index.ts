import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGoogleOAuthRoutes } from "./google-oauth";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { publicApiRouter } from "../public-api";
import { handleStripeWebhook } from "../webhooks/stripe";
import { startReminderCron } from "../reminders";
import { handleBizomediaInviteWebhook } from "../webhooks/bizomedia-invite";
import { ensureInfluencerProspectsTable } from "../db";

async function startServer() {
  await ensureInfluencerProspectsTable();
  // Start the reminder cron job
  startReminderCron();

  const app = express();
  const server = createServer(app);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, stripe-signature",
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Stripe webhook MUST be before express.json() because it needs the raw body
  app.post('/api/public/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Keep the rest of your original setup
  // Register local direct Google OAuth flow FIRST so it takes precedence
  registerGoogleOAuthRoutes(app);
  // Keep original Manus proxy flow available as fallback
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use("/api/public", publicApiRouter);

  app.post("/api/crm/bizomedia-invite", (req, res) => {
    void handleBizomediaInviteWebhook(req, res);
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    console.log(`[api] GOOGLE OAUTH READY AT: http://localhost:${port}/api/auth/google`);
  });
}

startServer().catch((err) => {
  console.error("SERVER CRASHED ON STARTUP:", err);
  process.exit(1);
});