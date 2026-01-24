import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import * as Auth from "@/lib/auth";

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
  const url = "http://127.0.0.1:8081/api/trpc";

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