import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const isProduction = process.env.NODE_ENV === "production" || process.env.FLY_APP_NAME;

  // Session cookie configuration for Fly.io production
  // Must match express-session config: sameSite: 'lax'
  // CRITICAL: No domain property - defaults to current host
  if (isProduction) {
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };
  }
  
  // Development: use lax with secure=false for local testing
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: false, // Local development doesn't use HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}
