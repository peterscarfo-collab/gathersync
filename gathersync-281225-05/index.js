var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core";
var users, events, participants, eventSnapshots, groupTemplates, pushTokens;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      /**
       * Surrogate primary key. Auto-incremented numeric value managed by the database.
       * Use this for relations between tables.
       */
      id: int("id").autoincrement().primaryKey(),
      /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      subscriptionTier: mysqlEnum("subscriptionTier", ["free", "lite", "pro", "enterprise"]).default("free").notNull(),
      subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "cancelled", "expired", "trialing"]).default("active").notNull(),
      stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
      stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
      subscriptionStartDate: timestamp("subscriptionStartDate"),
      subscriptionEndDate: timestamp("subscriptionEndDate"),
      eventsCreatedThisMonth: int("eventsCreatedThisMonth").default(0).notNull(),
      lastMonthReset: timestamp("lastMonthReset").defaultNow().notNull(),
      // Promotional and trial fields
      trialStartDate: timestamp("trialStartDate"),
      trialEndDate: timestamp("trialEndDate"),
      trialUsed: boolean("trialUsed").default(false).notNull(),
      appliedPromoCode: varchar("appliedPromoCode", { length: 100 }),
      promoExpiry: timestamp("promoExpiry"),
      isLifetimePro: boolean("isLifetimePro").default(false).notNull(),
      grantedBy: varchar("grantedBy", { length: 320 }),
      // Admin email who granted access
      grantedAt: timestamp("grantedAt"),
      subscriptionSource: mysqlEnum("subscriptionSource", ["trial", "promo", "stripe", "admin", "free"]).default("free").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    events = mysqlTable("events", {
      id: varchar("id", { length: 64 }).primaryKey(),
      userId: int("userId").notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      eventType: mysqlEnum("eventType", ["flexible", "fixed"]).notNull(),
      month: int("month").notNull(),
      // 1-12
      year: int("year").notNull(),
      fixedDate: varchar("fixedDate", { length: 10 }),
      // YYYY-MM-DD
      fixedTime: varchar("fixedTime", { length: 5 }),
      // HH:MM
      reminderDaysBefore: int("reminderDaysBefore"),
      reminderScheduled: boolean("reminderScheduled").default(false),
      archived: boolean("archived").default(false).notNull(),
      finalized: boolean("finalized").default(false).notNull(),
      finalizedDate: varchar("finalizedDate", { length: 10 }),
      // YYYY-MM-DD
      teamLeader: varchar("teamLeader", { length: 255 }),
      teamLeaderPhone: varchar("teamLeaderPhone", { length: 50 }),
      meetingType: mysqlEnum("meetingType", ["in-person", "virtual"]),
      venueName: varchar("venueName", { length: 255 }),
      venueContact: varchar("venueContact", { length: 255 }),
      venuePhone: varchar("venuePhone", { length: 50 }),
      meetingLink: text("meetingLink"),
      rsvpDeadline: varchar("rsvpDeadline", { length: 100 }),
      meetingNotes: text("meetingNotes"),
      deletedAt: timestamp("deletedAt"),
      // Soft delete timestamp
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    participants = mysqlTable("participants", {
      id: varchar("id", { length: 64 }).primaryKey(),
      eventId: varchar("eventId", { length: 64 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      availability: json("availability").$type().notNull(),
      unavailableAllMonth: boolean("unavailableAllMonth").default(false).notNull(),
      notes: text("notes"),
      source: mysqlEnum("source", ["manual", "contacts", "ai"]),
      phone: varchar("phone", { length: 50 }),
      email: varchar("email", { length: 320 }),
      rsvpStatus: mysqlEnum("rsvpStatus", ["attending", "not-attending", "no-response"]),
      deletedAt: timestamp("deletedAt"),
      // Soft delete timestamp
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    eventSnapshots = mysqlTable("eventSnapshots", {
      id: varchar("id", { length: 64 }).primaryKey(),
      userId: int("userId").notNull(),
      eventId: varchar("eventId", { length: 64 }).notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      eventData: json("eventData").$type().notNull(),
      savedAt: timestamp("savedAt").defaultNow().notNull()
    });
    groupTemplates = mysqlTable("groupTemplates", {
      id: varchar("id", { length: 64 }).primaryKey(),
      userId: int("userId").notNull(),
      name: varchar("name", { length: 255 }).notNull(),
      participantNames: json("participantNames").$type().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    pushTokens = mysqlTable("pushTokens", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      token: varchar("token", { length: 255 }).notNull().unique(),
      deviceId: varchar("deviceId", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserEvents(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(events).where(eq(events.userId, userId));
}
async function getEventById(eventId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  return result[0] || null;
}
async function createEvent(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(events).values(data);
  return data.id;
}
async function updateEvent(eventId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(events).set(data).where(eq(events.id, eventId));
}
async function deleteEvent(eventId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(participants).where(eq(participants.eventId, eventId));
  await db.delete(events).where(eq(events.id, eventId));
}
async function getEventParticipants(eventId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(participants).where(eq(participants.eventId, eventId));
}
async function createParticipant(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(participants).values(data);
  return data.id;
}
async function updateParticipant(participantId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(participants).set(data).where(eq(participants.id, participantId));
}
async function deleteParticipant(participantId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(participants).where(eq(participants.id, participantId));
}
async function getUserSnapshots(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventSnapshots).where(eq(eventSnapshots.userId, userId));
}
async function createSnapshot(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(eventSnapshots).values(data);
  return data.id;
}
async function deleteSnapshot(snapshotId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(eventSnapshots).where(eq(eventSnapshots.id, snapshotId));
}
async function getUserTemplates(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groupTemplates).where(eq(groupTemplates.userId, userId));
}
async function createTemplate(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(groupTemplates).values(data);
  return data.id;
}
async function deleteTemplate(templateId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(groupTemplates).where(eq(groupTemplates.id, templateId));
}
async function registerPushToken(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pushTokens).values(data).onDuplicateKeyUpdate({
    set: {
      deviceId: data.deviceId,
      updatedAt: /* @__PURE__ */ new Date()
    }
  });
}
async function unregisterPushToken(token) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}
async function getEventParticipantTokens(eventId, excludeUserId) {
  const db = await getDb();
  if (!db) return [];
  const event = await getEventById(eventId);
  if (!event) return [];
  const tokens = await db.select().from(pushTokens).where(eq(pushTokens.userId, event.userId));
  if (excludeUserId) {
    return tokens.filter((t2) => t2.userId !== excludeUserId);
  }
  return tokens;
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
  }
});

// server/stripe.ts
import Stripe from "stripe";
async function createStripeCustomer(email, name) {
  try {
    const customer = await stripe.customers.create({
      email,
      name: name || void 0,
      metadata: {
        app: "gathersync"
      }
    });
    console.log("[Stripe] Created customer:", customer.id);
    return customer.id;
  } catch (error) {
    console.error("[Stripe] Failed to create customer:", error);
    throw new Error("Failed to create Stripe customer");
  }
}
async function createCheckoutSession(customerId, priceId, successUrl, cancelUrl, userId) {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      // Pass user ID to webhook
      subscription_data: {
        metadata: {
          app: "gathersync"
        }
      }
    });
    console.log("[Stripe] Created checkout session:", session.id);
    return session.url || "";
  } catch (error) {
    console.error("[Stripe] Failed to create checkout session:", error);
    throw new Error("Failed to create checkout session");
  }
}
async function createPortalSession(customerId, returnUrl) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
    console.log("[Stripe] Created portal session for customer:", customerId);
    return session.url;
  } catch (error) {
    console.error("[Stripe] Failed to create portal session:", error);
    throw new Error("Failed to create portal session");
  }
}
async function getSubscription(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    console.error("[Stripe] Failed to retrieve subscription:", error);
    return null;
  }
}
async function handleWebhookEvent(payload, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    console.log("[Stripe] Webhook event received:", event.type);
    return event;
  } catch (error) {
    console.error("[Stripe] Webhook signature verification failed:", error);
    throw new Error("Invalid webhook signature");
  }
}
var STRIPE_SECRET_KEY, stripe, GATHERSYNC_PRO_PRICE_ID;
var init_stripe = __esm({
  "server/stripe.ts"() {
    "use strict";
    STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_51Jyi16QdyRdop1CxHE03bXgJlSmyI4au35zek3nc1NLEqTu94ACq5RGATVbLMoJFwDLXsK65rkZZ0hsYtWZTH1Nb00me0hkJux";
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover"
    });
    GATHERSYNC_PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || "price_1Si0Q0QdyRdop1CxVOLbprOl";
  }
});

// constants/stripe.ts
var STRIPE_PRICE_IDS, SUBSCRIPTION_PLANS;
var init_stripe2 = __esm({
  "constants/stripe.ts"() {
    "use strict";
    STRIPE_PRICE_IDS = {
      lite: {
        monthly: "price_1Si2LWQdyRdop1CxqsM4HvCL",
        // $4.99/month
        annual: "price_1Si2LXQdyRdop1CxoMKcEpKA"
        // $49/year
      },
      pro: {
        monthly: "price_1Si2LXQdyRdop1CxPpvp9YpY",
        // $7.99/month
        annual: "price_1Si2LYQdyRdop1CxgXRNHP9L"
        // $79/year
      }
    };
    SUBSCRIPTION_PLANS = {
      free: {
        name: "Free",
        tier: "free",
        monthlyPrice: 0,
        annualPrice: 0,
        monthlyPriceDisplay: "Free forever",
        annualPriceDisplay: "Free forever",
        eventLimit: 5,
        features: [
          "Up to 5 events per month",
          "Up to 50 participants per event",
          "Cloud sync across devices",
          "Mobile app access"
        ]
      },
      lite: {
        name: "Lite",
        tier: "lite",
        monthlyPrice: 4.99,
        annualPrice: 49,
        monthlyPriceDisplay: "$4.99/month",
        annualPriceDisplay: "$49/year",
        annualSavings: "Save $10.88",
        eventLimit: 50,
        stripePriceIds: STRIPE_PRICE_IDS.lite,
        features: [
          "Up to 50 events per month",
          "Up to 100 participants per event",
          "Cloud sync across devices",
          "Mobile app access",
          "Priority email support"
        ]
      },
      pro: {
        name: "Pro",
        tier: "pro",
        monthlyPrice: 7.99,
        annualPrice: 79,
        monthlyPriceDisplay: "$7.99/month",
        annualPriceDisplay: "$79/year",
        annualSavings: "Save $16.88",
        eventLimit: null,
        // unlimited
        stripePriceIds: STRIPE_PRICE_IDS.pro,
        features: [
          "Unlimited events",
          "Unlimited participants",
          "Cloud sync across devices",
          "Mobile app access",
          "Priority support",
          "Advanced analytics",
          "Export data"
        ]
      }
    };
  }
});

// server/webhooks/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  handleStripeWebhook: () => handleStripeWebhook
});
import { eq as eq5 } from "drizzle-orm";
function getTierFromPriceId(priceId) {
  if (priceId === STRIPE_PRICE_IDS.lite.monthly || priceId === STRIPE_PRICE_IDS.lite.annual) {
    return "lite";
  }
  if (priceId === STRIPE_PRICE_IDS.pro.monthly || priceId === STRIPE_PRICE_IDS.pro.annual) {
    return "pro";
  }
  return null;
}
async function handleStripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    console.error("[Webhook] Missing stripe-signature header");
    return res.status(400).send("Missing signature");
  }
  try {
    const event = await handleWebhookEvent(req.body, signature);
    console.log("[Webhook] Processing event:", event.type);
    const db = await getDb();
    if (!db) {
      console.error("[Webhook] Database not available");
      return res.status(500).send("Database error");
    }
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        const clientReferenceId = session.client_reference_id;
        console.log("[Webhook] Checkout completed:", { customerId, subscriptionId, clientReferenceId });
        const stripe2 = __require("stripe")(process.env.STRIPE_SECRET_KEY);
        const subscription = await stripe2.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const tier = getTierFromPriceId(priceId);
        if (!tier) {
          console.error("[Webhook] Could not determine tier from price ID:", priceId);
          break;
        }
        console.log("[Webhook] Determined tier:", tier);
        let user;
        if (clientReferenceId) {
          [user] = await db.select().from(users).where(eq5(users.id, clientReferenceId)).limit(1);
        } else {
          [user] = await db.select().from(users).where(eq5(users.stripeCustomerId, customerId)).limit(1);
        }
        if (user) {
          await db.update(users).set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionTier: tier,
            subscriptionStatus: "active",
            subscriptionSource: "stripe",
            subscriptionStartDate: /* @__PURE__ */ new Date(),
            // Clear trial fields if upgrading from trial
            trialStartDate: null,
            trialEndDate: null
          }).where(eq5(users.id, user.id));
          console.log(`[Webhook] User upgraded to ${tier}:`, user.email);
        } else {
          console.error("[Webhook] User not found:", { clientReferenceId, customerId });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        console.log("[Webhook] Subscription updated:", { customerId, status });
        const [user] = await db.select().from(users).where(eq5(users.stripeCustomerId, customerId)).limit(1);
        if (user) {
          await db.update(users).set({
            subscriptionStatus: status,
            subscriptionEndDate: subscription.cancel_at ? new Date(subscription.cancel_at * 1e3) : null
          }).where(eq5(users.id, user.id));
          console.log("[Webhook] Subscription status updated:", status);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        console.log("[Webhook] Subscription cancelled:", customerId);
        const [user] = await db.select().from(users).where(eq5(users.stripeCustomerId, customerId)).limit(1);
        if (user) {
          await db.update(users).set({
            subscriptionTier: "free",
            subscriptionStatus: "cancelled",
            subscriptionEndDate: /* @__PURE__ */ new Date()
          }).where(eq5(users.id, user.id));
          console.log("[Webhook] User downgraded to Free:", user.email);
        }
        break;
      }
      default:
        console.log("[Webhook] Unhandled event type:", event.type);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(400).send("Webhook error");
  }
}
var init_stripe3 = __esm({
  "server/webhooks/stripe.ts"() {
    "use strict";
    init_stripe();
    init_db();
    init_schema();
    init_stripe2();
  }
});

// server/_core/index.ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isIpAddress(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getParentDomain(hostname) {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return void 0;
  }
  const parts = hostname.split(".");
  if (parts.length < 3) {
    return void 0;
  }
  return "." + parts.slice(-2).join(".");
}
function getSessionCookieOptions(req) {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(EXCHANGE_TOKEN_PATH, payload);
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(GET_USER_INFO_PATH, {
      accessToken: token.accessToken
    });
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(platforms.filter((p) => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
async function syncUser(userInfo) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }
  const lastSignedIn = /* @__PURE__ */ new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return saved ?? {
    openId: userInfo.openId,
    name: userInfo.name,
    email: userInfo.email,
    loginMethod: userInfo.loginMethod ?? null,
    lastSignedIn
  };
}
function buildUserResponse(user) {
  console.log("[buildUserResponse] Raw user object:", JSON.stringify(user, null, 2));
  const response = {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    lastSignedIn: (user?.lastSignedIn ?? /* @__PURE__ */ new Date()).toISOString(),
    // Subscription fields
    subscriptionTier: user?.subscriptionTier ?? "free",
    subscriptionStatus: user?.subscriptionStatus ?? "active",
    subscriptionSource: user?.subscriptionSource ?? "free",
    isLifetimePro: user?.isLifetimePro ?? false,
    trialStartDate: user?.trialStartDate ?? null,
    trialEndDate: user?.trialEndDate ?? null,
    trialUsed: user?.trialUsed ?? false,
    eventsCreatedThisMonth: user?.eventsCreatedThisMonth ?? 0
  };
  console.log("[buildUserResponse] Response object:", JSON.stringify(response, null, 2));
  return response;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      const frontendUrl = process.env.EXPO_WEB_PREVIEW_URL || process.env.EXPO_PACKAGER_PROXY_URL || "http://localhost:8081";
      res.redirect(302, `${frontendUrl}?loginSuccess=true`);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app.get("/api/oauth/mobile", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      const user = await syncUser(userInfo);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user)
      });
    } catch (error) {
      console.error("[OAuth] Mobile exchange failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/me failed:", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });
  app.post("/api/auth/session", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      console.error("[Auth] /api/auth/session failed:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

// server/routers.ts
import { z as z4 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("webdevtoken.v1.WebDevService/SendNotification", normalizedBase).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();

// server/notifications.ts
init_db();
import { Expo } from "expo-server-sdk";
var expo = new Expo();
async function notifyEventUpdate(eventId, excludeUserId, payload) {
  try {
    const tokens = await getEventParticipantTokens(eventId, excludeUserId);
    if (tokens.length === 0) {
      console.log("[Notifications] No push tokens found for event:", eventId);
      return;
    }
    await sendPushNotifications(
      tokens.map((t2) => t2.token),
      payload
    );
  } catch (error) {
    console.error("[Notifications] Failed to notify event update:", error);
  }
}
async function sendPushNotifications(pushTokens2, payload) {
  const validTokens = pushTokens2.filter((token) => Expo.isExpoPushToken(token));
  if (validTokens.length === 0) {
    console.log("[Notifications] No valid Expo push tokens");
    return;
  }
  const messages = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data || {}
  }));
  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("[Notifications] Error sending chunk:", error);
    }
  }
  console.log(`[Notifications] Sent ${tickets.length} notifications`);
}

// server/routers/admin.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq2, like, or } from "drizzle-orm";
var adminRouter = router({
  /**
   * Search users by email or name
   */
  searchUsers: publicProcedure.input(
    z2.object({
      query: z2.string().min(1)
    })
  ).query(async ({ ctx, input }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const results = await db.select().from(users).where(
      or(
        like(users.email, `%${input.query}%`),
        like(users.name, `%${input.query}%`)
      )
    ).limit(20);
    return results;
  }),
  /**
   * Get all subscribers (Pro and Enterprise users)
   */
  getAllSubscribers: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const subscribers = await db.select().from(users).where(or(eq2(users.subscriptionTier, "pro"), eq2(users.subscriptionTier, "enterprise")));
    return subscribers;
  }),
  /**
   * Grant lifetime Pro access to a user
   */
  grantLifetimePro: publicProcedure.input(
    z2.object({
      userId: z2.number(),
      reason: z2.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const now = /* @__PURE__ */ new Date();
    await db.update(users).set({
      subscriptionTier: "pro",
      subscriptionStatus: "active",
      subscriptionSource: "admin",
      isLifetimePro: true,
      grantedBy: ctx.user.email || ctx.user.openId,
      grantedAt: now,
      updatedAt: now
    }).where(eq2(users.id, input.userId));
    return { success: true };
  }),
  /**
   * Revoke lifetime Pro access
   */
  revokeLifetimePro: publicProcedure.input(
    z2.object({
      userId: z2.number()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const now = /* @__PURE__ */ new Date();
    await db.update(users).set({
      subscriptionTier: "free",
      subscriptionStatus: "active",
      subscriptionSource: "free",
      isLifetimePro: false,
      grantedBy: null,
      grantedAt: null,
      updatedAt: now
    }).where(eq2(users.id, input.userId));
    return { success: true };
  }),
  /**
   * Grant temporary Pro access with expiry
   */
  grantTemporaryPro: publicProcedure.input(
    z2.object({
      userId: z2.number(),
      durationDays: z2.number().min(1).max(365),
      reason: z2.string().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const now = /* @__PURE__ */ new Date();
    const expiryDate = /* @__PURE__ */ new Date();
    expiryDate.setDate(expiryDate.getDate() + input.durationDays);
    await db.update(users).set({
      subscriptionTier: "pro",
      subscriptionStatus: "active",
      subscriptionSource: "admin",
      subscriptionStartDate: now,
      subscriptionEndDate: expiryDate,
      grantedBy: ctx.user.email || ctx.user.openId,
      grantedAt: now,
      updatedAt: now
    }).where(eq2(users.id, input.userId));
    return { success: true, expiryDate };
  }),
  /**
   * Get subscription analytics
   */
  getAnalytics: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError3({
        code: "FORBIDDEN",
        message: "Admin access required"
      });
    }
    const db = await getDb();
    if (!db) {
      throw new TRPCError3({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const allUsers = await db.select().from(users);
    const totalUsers = allUsers.length;
    const freeUsers = allUsers.filter((u) => u.subscriptionTier === "free").length;
    const proUsers = allUsers.filter((u) => u.subscriptionTier === "pro").length;
    const enterpriseUsers = allUsers.filter((u) => u.subscriptionTier === "enterprise").length;
    const lifetimeProUsers = allUsers.filter((u) => u.isLifetimePro).length;
    const trialUsers = allUsers.filter((u) => u.subscriptionStatus === "trialing").length;
    return {
      totalUsers,
      freeUsers,
      proUsers,
      enterpriseUsers,
      lifetimeProUsers,
      trialUsers,
      conversionRate: totalUsers > 0 ? (proUsers + enterpriseUsers) / totalUsers * 100 : 0
    };
  })
});

// server/routers/trial.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
init_db();
init_schema();
import { eq as eq3 } from "drizzle-orm";
var TRIAL_DURATION_DAYS = 14;
var trialRouter = router({
  /**
   * Start a free trial for the current user
   */
  startTrial: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const user = ctx.user;
    if (user.trialUsed) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "You have already used your free trial"
      });
    }
    if (user.subscriptionTier !== "free") {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "You already have a Pro subscription"
      });
    }
    if (user.isLifetimePro) {
      throw new TRPCError4({
        code: "BAD_REQUEST",
        message: "You already have lifetime Pro access"
      });
    }
    const now = /* @__PURE__ */ new Date();
    const trialEndDate = /* @__PURE__ */ new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);
    await db.update(users).set({
      subscriptionTier: "pro",
      subscriptionStatus: "trialing",
      subscriptionSource: "trial",
      trialStartDate: now,
      trialEndDate,
      trialUsed: true,
      updatedAt: now
    }).where(eq3(users.id, user.id));
    return {
      success: true,
      trialEndDate: trialEndDate.toISOString(),
      daysRemaining: TRIAL_DURATION_DAYS
    };
  }),
  /**
   * Check trial status for current user
   */
  getTrialStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (user.trialEndDate) {
      const now = /* @__PURE__ */ new Date();
      const endDate = new Date(user.trialEndDate);
      const isActive = now <= endDate;
      const msRemaining = endDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1e3 * 60 * 60 * 24)));
      return {
        hasUsedTrial: user.trialUsed || false,
        isTrialing: user.subscriptionStatus === "trialing" && isActive,
        trialStartDate: user.trialStartDate ? user.trialStartDate.toISOString() : null,
        trialEndDate: user.trialEndDate ? user.trialEndDate.toISOString() : null,
        daysRemaining: isActive ? daysRemaining : 0,
        isExpired: !isActive && user.subscriptionStatus === "trialing"
      };
    }
    return {
      hasUsedTrial: user.trialUsed || false,
      isTrialing: false,
      trialStartDate: null,
      trialEndDate: null,
      daysRemaining: 0,
      isExpired: false
    };
  }),
  /**
   * Check and expire trials (called on app launch)
   */
  checkExpiredTrials: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError4({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const user = ctx.user;
    if (user.subscriptionStatus !== "trialing" || !user.trialEndDate) {
      return { expired: false };
    }
    const now = /* @__PURE__ */ new Date();
    const endDate = new Date(user.trialEndDate);
    if (now > endDate) {
      await db.update(users).set({
        subscriptionTier: "free",
        subscriptionStatus: "expired",
        subscriptionSource: "free",
        updatedAt: now
      }).where(eq3(users.id, user.id));
      return { expired: true };
    }
    return { expired: false };
  })
});

// server/routers/subscription.ts
import { z as z3 } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
init_stripe();
init_db();
init_schema();
import { eq as eq4 } from "drizzle-orm";
var subscriptionRouter = router({
  /**
   * Create a checkout session for subscription
   */
  createCheckout: protectedProcedure.input(
    z3.object({
      priceId: z3.string(),
      successUrl: z3.string(),
      cancelUrl: z3.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const user = ctx.user;
    if (!user) {
      throw new TRPCError5({
        code: "UNAUTHORIZED",
        message: "User not found"
      });
    }
    try {
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        stripeCustomerId = await createStripeCustomer(
          user.email || "",
          user.name || void 0
        );
        await db.update(users).set({ stripeCustomerId }).where(eq4(users.id, user.id));
      }
      const checkoutUrl = await createCheckoutSession(
        stripeCustomerId,
        input.priceId,
        input.successUrl,
        input.cancelUrl,
        user.id.toString()
        // Pass user ID for webhook identification
      );
      return { url: checkoutUrl };
    } catch (error) {
      console.error("[Subscription] Failed to create checkout:", error);
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create checkout session"
      });
    }
  }),
  /**
   * Create a billing portal session
   */
  createPortal: protectedProcedure.input(
    z3.object({
      returnUrl: z3.string()
    })
  ).mutation(async ({ ctx, input }) => {
    const user = ctx.user;
    if (!user || !user.stripeCustomerId) {
      throw new TRPCError5({
        code: "BAD_REQUEST",
        message: "No subscription found"
      });
    }
    try {
      const portalUrl = await createPortalSession(user.stripeCustomerId, input.returnUrl);
      return { url: portalUrl };
    } catch (error) {
      console.error("[Subscription] Failed to create portal:", error);
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create portal session"
      });
    }
  }),
  /**
   * Get current subscription status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user) {
      throw new TRPCError5({
        code: "UNAUTHORIZED",
        message: "User not found"
      });
    }
    return {
      tier: user.subscriptionTier,
      status: user.subscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      isLifetimePro: user.isLifetimePro,
      trialUsed: user.trialUsed,
      trialEndDate: user.trialEndDate
    };
  }),
  /**
   * Get subscription details from Stripe
   */
  getDetails: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;
    if (!user || !user.stripeSubscriptionId) {
      return null;
    }
    try {
      const subscription = await getSubscription(user.stripeSubscriptionId);
      if (!subscription) {
        return null;
      }
      const sub = subscription;
      return {
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1e3) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false
      };
    } catch (error) {
      console.error("[Subscription] Failed to get details:", error);
      return null;
    }
  }),
  /**
   * Start a 14-day free trial for Lite or Pro
   */
  startTrial: protectedProcedure.input(
    z3.object({
      tier: z3.enum(["lite", "pro"])
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available"
      });
    }
    const user = ctx.user;
    if (!user) {
      throw new TRPCError5({
        code: "UNAUTHORIZED",
        message: "User not found"
      });
    }
    if (user.trialUsed) {
      throw new TRPCError5({
        code: "BAD_REQUEST",
        message: "You have already used your free trial"
      });
    }
    if (user.subscriptionTier !== "free" || user.subscriptionStatus === "trialing") {
      throw new TRPCError5({
        code: "BAD_REQUEST",
        message: "You already have an active subscription or trial"
      });
    }
    try {
      const now = /* @__PURE__ */ new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      await db.update(users).set({
        subscriptionTier: input.tier,
        subscriptionStatus: "trialing",
        subscriptionSource: "trial",
        trialStartDate: now,
        trialEndDate: trialEnd,
        trialUsed: true
      }).where(eq4(users.id, user.id));
      return {
        success: true,
        tier: input.tier,
        trialEndDate: trialEnd
      };
    } catch (error) {
      console.error("[Subscription] Failed to start trial:", error);
      throw new TRPCError5({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to start trial"
      });
    }
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  // Public endpoints (no authentication required)
  public: router({
    // Get event by ID with participants (public access for sharing)
    getEvent: publicProcedure.input(z4.object({ id: z4.string() })).query(async ({ input }) => {
      const event = await getEventById(input.id);
      if (!event) return null;
      const participants2 = await getEventParticipants(input.id);
      return {
        id: event.id,
        userId: event.userId,
        name: event.name,
        eventType: event.eventType,
        month: event.month,
        year: event.year,
        fixedDate: event.fixedDate || void 0,
        fixedTime: event.fixedTime || void 0,
        reminderDaysBefore: event.reminderDaysBefore || void 0,
        reminderScheduled: event.reminderScheduled || void 0,
        archived: event.archived || void 0,
        finalized: event.finalized || void 0,
        finalizedDate: event.finalizedDate || void 0,
        teamLeader: event.teamLeader || void 0,
        teamLeaderPhone: event.teamLeaderPhone || void 0,
        meetingType: event.meetingType || void 0,
        venueName: event.venueName || void 0,
        venueContact: event.venueContact || void 0,
        venuePhone: event.venuePhone || void 0,
        meetingLink: event.meetingLink || void 0,
        rsvpDeadline: event.rsvpDeadline || void 0,
        meetingNotes: event.meetingNotes || void 0,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
        participants: participants2.map((p) => ({
          id: p.id,
          eventId: p.eventId,
          name: p.name,
          availability: p.availability,
          unavailableAllMonth: p.unavailableAllMonth,
          notes: p.notes || void 0,
          source: p.source || void 0,
          phone: p.phone || void 0,
          email: p.email || void 0,
          rsvpStatus: p.rsvpStatus || void 0,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        }))
      };
    }),
    // Update participant availability/RSVP (public access)
    updateParticipant: publicProcedure.input(
      z4.object({
        eventId: z4.string(),
        participantName: z4.string(),
        availability: z4.record(z4.string(), z4.boolean()).optional(),
        rsvpStatus: z4.enum(["attending", "not-attending", "no-response"]).optional()
      })
    ).mutation(async ({ input }) => {
      const event = await getEventById(input.eventId);
      if (!event) throw new Error("Event not found");
      const eventParticipants = await getEventParticipants(input.eventId);
      const existingParticipant = eventParticipants.find(
        (p) => p.name.toLowerCase() === input.participantName.toLowerCase()
      );
      if (existingParticipant) {
        await updateParticipant(existingParticipant.id, {
          availability: input.availability,
          rsvpStatus: input.rsvpStatus
        });
      } else {
        await createParticipant({
          id: `participant-${Date.now()}`,
          eventId: input.eventId,
          name: input.participantName,
          availability: input.availability || {},
          unavailableAllMonth: false,
          source: "manual",
          rsvpStatus: input.rsvpStatus || "no-response"
        });
      }
      return { success: true };
    })
  }),
  events: router({
    list: protectedProcedure.query(({ ctx }) => getUserEvents(ctx.user.id)),
    get: protectedProcedure.input(z4.object({ id: z4.string() })).query(({ input }) => getEventById(input.id)),
    create: protectedProcedure.input(
      z4.object({
        id: z4.string(),
        name: z4.string().min(1).max(255),
        eventType: z4.enum(["flexible", "fixed"]),
        month: z4.number().min(1).max(12),
        year: z4.number(),
        fixedDate: z4.string().optional(),
        fixedTime: z4.string().optional(),
        reminderDaysBefore: z4.number().optional(),
        reminderScheduled: z4.boolean().optional(),
        archived: z4.boolean().optional(),
        finalized: z4.boolean().optional(),
        finalizedDate: z4.string().optional(),
        teamLeader: z4.string().optional(),
        teamLeaderPhone: z4.string().optional(),
        meetingType: z4.enum(["in-person", "virtual"]).optional(),
        venueName: z4.string().optional(),
        venueContact: z4.string().optional(),
        venuePhone: z4.string().optional(),
        meetingLink: z4.string().optional(),
        rsvpDeadline: z4.string().optional(),
        meetingNotes: z4.string().optional()
      })
    ).mutation(
      ({ ctx, input }) => createEvent({
        ...input,
        userId: ctx.user.id
      })
    ),
    update: protectedProcedure.input(
      z4.object({
        id: z4.string(),
        name: z4.string().min(1).max(255).optional(),
        eventType: z4.enum(["flexible", "fixed"]).optional(),
        month: z4.number().min(1).max(12).optional(),
        year: z4.number().optional(),
        fixedDate: z4.string().optional(),
        fixedTime: z4.string().optional(),
        reminderDaysBefore: z4.number().optional(),
        reminderScheduled: z4.boolean().optional(),
        archived: z4.boolean().optional(),
        finalized: z4.boolean().optional(),
        finalizedDate: z4.string().optional(),
        teamLeader: z4.string().optional(),
        teamLeaderPhone: z4.string().optional(),
        meetingType: z4.enum(["in-person", "virtual"]).optional(),
        venueName: z4.string().optional(),
        venueContact: z4.string().optional(),
        venuePhone: z4.string().optional(),
        meetingLink: z4.string().optional(),
        rsvpDeadline: z4.string().optional(),
        meetingNotes: z4.string().optional()
      })
    ).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateEvent(id, data);
    }),
    delete: protectedProcedure.input(z4.object({ id: z4.string() })).mutation(({ input }) => deleteEvent(input.id))
  }),
  participants: router({
    list: protectedProcedure.input(z4.object({ eventId: z4.string() })).query(({ input }) => getEventParticipants(input.eventId)),
    create: protectedProcedure.input(
      z4.object({
        id: z4.string(),
        eventId: z4.string(),
        name: z4.string().min(1).max(255),
        availability: z4.record(z4.string(), z4.boolean()).optional(),
        unavailableAllMonth: z4.boolean().optional(),
        notes: z4.string().optional(),
        source: z4.enum(["manual", "contacts", "ai"]).optional(),
        phone: z4.string().optional(),
        email: z4.string().optional(),
        rsvpStatus: z4.enum(["attending", "not-attending", "no-response"]).optional()
      })
    ).mutation(({ input }) => {
      console.log("[tRPC] participants.create called with input:", JSON.stringify(input));
      const participantData = {
        id: input.id,
        eventId: input.eventId,
        name: input.name,
        availability: input.availability ?? {},
        unavailableAllMonth: input.unavailableAllMonth ?? false
      };
      if (input.notes !== void 0) participantData.notes = input.notes;
      if (input.source !== void 0) participantData.source = input.source;
      if (input.phone !== void 0) participantData.phone = input.phone;
      if (input.email !== void 0) participantData.email = input.email;
      if (input.rsvpStatus !== void 0) participantData.rsvpStatus = input.rsvpStatus;
      console.log("[tRPC] Final participantData to insert:", JSON.stringify(participantData));
      console.log("[tRPC] participantData keys:", Object.keys(participantData));
      return createParticipant(participantData);
    }),
    update: protectedProcedure.input(
      z4.object({
        id: z4.string(),
        eventId: z4.string(),
        name: z4.string().min(1).max(255).optional(),
        availability: z4.record(z4.string(), z4.boolean()).optional(),
        unavailableAllMonth: z4.boolean().optional(),
        notes: z4.string().optional(),
        source: z4.enum(["manual", "contacts", "ai"]).optional(),
        phone: z4.string().optional(),
        email: z4.string().optional(),
        rsvpStatus: z4.enum(["attending", "not-attending", "no-response"]).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const { id, eventId, ...data } = input;
      await updateParticipant(id, data);
      const event = await getEventById(eventId);
      if (event && data.availability) {
        await notifyEventUpdate(
          eventId,
          ctx.user.id,
          {
            title: `${event.name} - Availability Updated`,
            body: `${input.name || "Someone"} updated their availability`,
            data: { eventId, screen: "event-detail" }
          }
        );
      }
      return;
    }),
    delete: protectedProcedure.input(z4.object({ id: z4.string() })).mutation(({ input }) => deleteParticipant(input.id))
  }),
  snapshots: router({
    list: protectedProcedure.query(({ ctx }) => getUserSnapshots(ctx.user.id)),
    create: protectedProcedure.input(
      z4.object({
        id: z4.string(),
        eventId: z4.string(),
        name: z4.string().min(1).max(255),
        eventData: z4.any()
      })
    ).mutation(
      ({ ctx, input }) => createSnapshot({
        ...input,
        userId: ctx.user.id
      })
    ),
    delete: protectedProcedure.input(z4.object({ id: z4.string() })).mutation(({ input }) => deleteSnapshot(input.id))
  }),
  templates: router({
    list: protectedProcedure.query(({ ctx }) => getUserTemplates(ctx.user.id)),
    create: protectedProcedure.input(
      z4.object({
        id: z4.string(),
        name: z4.string().min(1).max(255),
        participantNames: z4.array(z4.string())
      })
    ).mutation(
      ({ ctx, input }) => createTemplate({
        ...input,
        userId: ctx.user.id
      })
    ),
    delete: protectedProcedure.input(z4.object({ id: z4.string() })).mutation(({ input }) => deleteTemplate(input.id))
  }),
  pushNotifications: router({
    register: protectedProcedure.input(
      z4.object({
        token: z4.string(),
        deviceId: z4.string().optional()
      })
    ).mutation(
      ({ ctx, input }) => registerPushToken({
        userId: ctx.user.id,
        token: input.token,
        deviceId: input.deviceId
      })
    ),
    unregister: protectedProcedure.input(z4.object({ token: z4.string() })).mutation(({ input }) => unregisterPushToken(input.token))
  }),
  // Admin routes for subscription management
  admin: adminRouter,
  // Trial management
  trial: trialRouter,
  // Subscription and payment management
  subscription: subscriptionRouter
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/public-api.ts
init_db();
import { Router } from "express";
var publicApiRouter = Router();
publicApiRouter.get("/debug/db-test", async (req, res) => {
  try {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const allEvents = await getUserEvents(1);
    res.json({
      hasDbUrl,
      eventCount: allEvents.length,
      firstEventId: allEvents[0]?.id || null
    });
  } catch (error) {
    res.json({ error: error.message, stack: error.stack });
  }
});
publicApiRouter.get("/events/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log("[PublicAPI] Fetching event:", eventId);
    console.log("[PublicAPI] DATABASE_URL exists:", !!process.env.DATABASE_URL);
    const event = await getEventById(eventId);
    console.log("[PublicAPI] Event found:", event ? "yes" : "no");
    if (event) {
      console.log("[PublicAPI] Event name:", event.name);
    }
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    const participants2 = await getEventParticipants(eventId);
    const response = {
      id: event.id,
      userId: event.userId,
      name: event.name,
      eventType: event.eventType,
      month: event.month,
      year: event.year,
      fixedDate: event.fixedDate || void 0,
      fixedTime: event.fixedTime || void 0,
      reminderDaysBefore: event.reminderDaysBefore || void 0,
      reminderScheduled: event.reminderScheduled || void 0,
      archived: event.archived || void 0,
      finalized: event.finalized || void 0,
      finalizedDate: event.finalizedDate || void 0,
      teamLeader: event.teamLeader || void 0,
      teamLeaderPhone: event.teamLeaderPhone || void 0,
      meetingType: event.meetingType || void 0,
      venueName: event.venueName || void 0,
      venueContact: event.venueContact || void 0,
      venuePhone: event.venuePhone || void 0,
      meetingLink: event.meetingLink || void 0,
      rsvpDeadline: event.rsvpDeadline || void 0,
      meetingNotes: event.meetingNotes || void 0,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      participants: participants2.map((p) => ({
        id: p.id,
        eventId: p.eventId,
        name: p.name,
        availability: p.availability,
        unavailableAllMonth: p.unavailableAllMonth,
        notes: p.notes || void 0,
        source: p.source || void 0,
        phone: p.phone || void 0,
        email: p.email || void 0,
        rsvpStatus: p.rsvpStatus || void 0,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      }))
    };
    res.json(response);
  } catch (error) {
    console.error("[PublicAPI] Error fetching event:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
publicApiRouter.post("/events/:eventId/participants", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { participantName, availability, rsvpStatus } = req.body;
    if (!participantName) {
      return res.status(400).json({ error: "participantName is required" });
    }
    const event = await getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    const eventParticipants = await getEventParticipants(eventId);
    const existingParticipant = eventParticipants.find(
      (p) => p.name.toLowerCase() === participantName.toLowerCase()
    );
    if (existingParticipant) {
      await updateParticipant(existingParticipant.id, {
        availability,
        rsvpStatus
      });
    } else {
      await createParticipant({
        id: `participant-${Date.now()}`,
        eventId,
        name: participantName,
        availability: availability || {},
        unavailableAllMonth: false,
        source: "manual",
        rsvpStatus: rsvpStatus || "no-response"
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[PublicAPI] Error updating participant:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
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
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const { handleStripeWebhook: handleStripeWebhook2 } = await Promise.resolve().then(() => (init_stripe3(), stripe_exports));
      return handleStripeWebhook2(req, res);
    }
  );
  app.use("/api/public", publicApiRouter);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}
startServer().catch(console.error);
