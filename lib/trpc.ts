import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import * as Auth from "@/lib/auth";

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  // Use environment variable if set, otherwise detect from current origin
  // For production (gathersync.fly.dev), use same-origin API
  // For development, use localhost
  let url: string;
  
  if (typeof window !== "undefined") {
    // Browser: use same-origin for production, or environment variable
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (apiBaseUrl) {
      url = `${apiBaseUrl}/api/trpc`;
    } else {
      // Same-origin API (works for gathersync.fly.dev)
      url = "/api/trpc";
    }
  } else {
    // Server-side: use environment variable or fallback
    url = process.env.EXPO_PUBLIC_API_BASE_URL 
      ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/trpc`
      : "http://127.0.0.1:8081/api/trpc";
  }
  
  console.log("[tRPC] Client URL:", url);

  return trpc.createClient({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        async headers() {
          if (typeof window !== "undefined") return {};
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
      }),
    ],
  });
}