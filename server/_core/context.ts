import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "../../shared/const.js";
import { upsertUser, getUserByOpenId } from "../db";
import * as db from "../db";




function getCookieToken(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const req = opts.req;

  // Prefer cookie token on web
const cookieToken = getCookieToken(req.headers.cookie, COOKIE_NAME);

  // If we have a cookie token but no Authorization header,
  // set Authorization so sdk.authenticateRequest() can work consistently.
  if (cookieToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${cookieToken}`;
  }

  let user: User | null = null;

  try {
    const authed = await sdk.authenticateRequest(req) as any;

    // Make sure the user exists in DB and we have a numeric id
    if (authed?.openId) {
      await upsertUser({
        openId: authed.openId,
        name: authed.name ?? null,
        email: authed.email ?? null,
        loginMethod: authed.loginMethod ?? null,
        lastSignedIn: new Date(),
      });

      const dbUser = await getUserByOpenId(authed.openId);
      user = (dbUser ?? null) as User | null;
    } else {
      user = null;
    }
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
