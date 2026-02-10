import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure" | "maxAge" | "domain"> {
  const isProd = process.env.NODE_ENV === "production" || process.env.FLY_APP_NAME;

  if (isProd) {
    return {
      httpOnly: true,
      secure: true, // Must be true for sameSite: 'none'
      sameSite: "none" as const, // Allows the cookie to be sent with cross-origin tRPC fetch requests
      domain: ".fly.dev", // Share cookie across all .fly.dev subdomains
      path: "/",
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    };
  }
  
  // Development: use lax with secure=false for local testing
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const, // Works with HTTP in development
    secure: false, // Local development doesn't use HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    // No domain in development - browser sets it based on Set-Cookie origin
  };
}
