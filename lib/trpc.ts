import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { Platform } from "react-native";

export const trpc = createTRPCReact<AppRouter>();

// Global store for current user ID (updated by useAuth hook)
let currentUserId: string | null = null;
let currentUserEmail: string | null = null;

export function setCurrentUser(userId: string | null, email: string | null) {
  currentUserId = userId;
  currentUserEmail = email;
  console.log('[tRPC] User updated:', { userId, email });
}

export function createTRPCClient() {
  let url: string;
  
  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    
    if (currentHost === 'gathersync.app' && !apiBaseUrl) {
      url = "https://gathersync.fly.dev/api/trpc";
      console.log("[tRPC] Cross-origin detected (gathersync.app), using:", url);
    } else if (apiBaseUrl) {
      url = `${apiBaseUrl}/api/trpc`;
      console.log("[tRPC] Using EXPO_PUBLIC_API_BASE_URL:", url);
    } else {
      url = "/api/trpc";
      console.log("[tRPC] Same-origin API:", url);
    }
  } else {
    url = process.env.EXPO_PUBLIC_API_BASE_URL 
      ? `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/trpc`
      : "http://127.0.0.1:8081/api/trpc";
  }
  
  console.log("[tRPC] Final Client URL:", url);

  return trpc.createClient({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        fetch: async (url, options = {}) => {
          const fetchOptions = {
            ...options,
            credentials: "include" as RequestCredentials,
          };
          
          return fetch(url, fetchOptions);
        },
        async headers() {
          const headers: Record<string, string> = {};
          
          // Use the global user ID that's updated by the auth hook
          if (currentUserId) {
            headers['X-Instant-User-ID'] = currentUserId;
            console.log('[tRPC] Sending user ID:', currentUserId);
            
            if (currentUserEmail) {
              headers['X-Instant-User-Email'] = currentUserEmail;
            }
          } else {
            console.log('[tRPC] No user ID available');
          }
          
          return headers;
        },
      }),
    ],
  });
}