import { useEffect, useState } from "react";

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://gathersync-api-deploy.fly.dev";

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
        // Ask the backend to convert the token into a proper cookie (Set-Cookie)
        const r = await fetch(`${API_BASE}/api/auth/session`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`session setup failed (${r.status}) ${text}`);
        }

        // Go to the app home (or change this to wherever you want)
        window.location.replace("/");
      } catch (e: any) {
        setMsg(`Login failed: ${e?.message || "unknown error"}`);
      }
    };

    run();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h2>GatherSync</h2>
      <p>{msg}</p>
    </div>
  );
}
