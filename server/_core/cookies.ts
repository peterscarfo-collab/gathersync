import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isLocalhost(req: Request): boolean {
  const hostHeader = req.headers.host;
  if (!hostHeader) return false;
  
  const hostname = hostHeader.split(":")[0];
  
  // Check if it's localhost/127.0.0.1 (any port)
  return LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
}

function isLocalHttpDev(req: Request): boolean {
  const hostHeader = req.headers.host;
  if (!hostHeader) return false;
  
  const hostname = hostHeader.split(":")[0];
  const port = hostHeader.split(":")[1];
  
  // Check if it's localhost/127.0.0.1 on port 8081 (local HTTP dev)
  const isLocalHost = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  const isPort8081 = port === "8081";
  
  return isLocalHost && isPort8081;
}

function isSecureRequest(req: Request) {
  // Local HTTP dev (127.0.0.1:8081) should never be secure
  if (isLocalHttpDev(req)) return false;
  
  // express "req.protocol" depends on trust proxy; you already set trust proxy = 1
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((p) => p.trim().toLowerCase() === "https");
}

function getCookieDomain(req: Request): string | undefined {
  const hostHeader = req.headers.host;
  const hostname = (hostHeader || "").split(":")[0];

  if (!hostname) return undefined;
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) return undefined;

  // Don't try to set a parent domain on fly.dev hosts
  if (hostname.endsWith(".fly.dev") || hostname === "fly.dev") return undefined;

  // ✅ Production: share across app.gathersync.app + api.gathersync.app
  if (hostname === "gathersync.app" || hostname.endsWith(".gathersync.app")) {
    return ".gathersync.app";
  }

  return undefined;
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  const isProduction = process.env.NODE_ENV === "production" || process.env.FLY_APP_NAME;
  const isLocal = isLocalhost(req);

  // Development mode: Always use secure=false and sameSite='lax'
  if (!isProduction) {
    return {
      domain: getCookieDomain(req),
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    };
  }

  // Production mode: HARDCODED settings for Fly.io environment
  // secure: true, sameSite: 'lax', httpOnly: true, maxAge: 24 * 60 * 60 * 1000, domain: 'gathersync.fly.dev'
  // Trust proxy must be active (app.set('trust proxy', 1)) for this to work correctly
  return {
    domain: "gathersync.fly.dev", // Hardcoded for Fly.io production
    httpOnly: true,
    path: "/",
    sameSite: "lax", // Compatible with modern browsers for same-domain cookies
    secure: true, // Required for HTTPS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  };
}
