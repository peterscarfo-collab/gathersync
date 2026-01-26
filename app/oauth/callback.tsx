import { useEffect, useState } from "react";

function getWebApiBase() {
  // Web-only helper
  const isWeb = typeof window !== "undefined";

  // If you set EXPO_PUBLIC_API_BASE_URL, we’ll respect it.
  // Otherwise:
  // - on localhost (dev), hit your local API
  // - on prod, use same-origin so cookies work cleanly
  const envBase = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!isWeb) {
    // Use BASE_URL if available, fallback to Fly.io app name, then EXPO_PUBLIC_API_BASE_URL
    if (process.env.BASE_URL) {
      return process.env.BASE_URL;
    }
    if (process.env.FLY_APP_NAME) {
      return `https://${process.env.FLY_APP_NAME}.fly.dev`;
    }
    return envBase || "";
  }

  const host = window.location.hostname;

  // Dev on localhost / 127.0.0.1
if (host === "localhost" || host === "127.0.0.1") {
return envBase || "";

}

  // Prod web: same-origin is best (keeps cookie scope correct)
  return envBase || "";
}

export default function OAuthCallback() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const error = url.searchParams.get("error");
      const sessionToken = url.searchParams.get("sessionToken");

      if (error) {
        setMsg(`Login failed: ${error}`);
        return;
      }

      if (!sessionToken) {
        setMsg("Login failed: missing session token");
        return;
      }

      try {
        const API_BASE = getWebApiBase();
        const endpoint = `${API_BASE}/api/auth/session`;

        // Convert sessionToken -> httpOnly cookie (Set-Cookie)
        const r = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          // ✅ REQUIRED so the browser stores/sends cookies
          credentials: "include",
        });

        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`session setup failed (${r.status}) ${text}`);
        }

        // Optional: clean URL (remove sessionToken from address bar)
        // then redirect home.
        window.location.replace("/");
      } catch (e: any) {
        setMsg(`Login failed: ${e?.message || "unknown error"}`);
      }
    };

    run();
  }, []);

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h2>GatherSync</h2>
      <p>{msg}</p>
    </div>
  );
}

