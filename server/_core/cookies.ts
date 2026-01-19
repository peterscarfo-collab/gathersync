import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
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
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    domain: getCookieDomain(req),
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}
