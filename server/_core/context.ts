import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

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
  const cookieToken = getCookieToken(req.headers.cookie, "app_session_token");

  // If we have a cookie token but no Authorization header,
  // set Authorization so sdk.authenticateRequest() can work consistently.
  if (cookieToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${cookieToken}`;
  }

  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
