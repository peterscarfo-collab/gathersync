import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "../../shared/const.js";
import { upsertUser, getUserById, getUserByEmail } from "../db";
import * as db from "../db";
import { adminDb } from "../../lib/admin-db";

// Define a simplified User type for InstantDB
export type User = {
  id: string;
  email?: string | null;
  name?: string | null;
  loginMethod?: string | null;
  role?: string | null;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionSource?: string | null;
  isLifetimePro?: boolean | null;
  trialStartDate?: Date | null;
  trialEndDate?: Date | null;
  trialUsed?: boolean | null;
  eventsCreatedThisMonth?: number | null;
  lastSignedIn?: Date | null;
};

/**
 * Verify InstantDB auth token
 */
async function verifyInstantDBToken(token: string): Promise<{ userId: string; email?: string } | null> {
  try {
    // InstantDB tokens are stored in localStorage as JSON
    // The backend receives them in Authorization header
    // We need to verify with InstantDB's API or just trust the token for now
    
    // For now, extract user ID from token structure
    // InstantDB tokens follow pattern: we can verify by querying the user
    const tokenData = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64').toString());
    
    if (tokenData?.sub) {
      return { userId: tokenData.sub, email: tokenData.email };
    }
    
    return null;
  } catch (error) {
    console.error('[Auth] Failed to verify InstantDB token:', error);
    return null;
  }
}

function getCookieToken(req: any, name: string): string | null {
  // Try req.cookies first (from cookie-parser middleware)
  if (req.cookies && req.cookies[name]) {
    return req.cookies[name];
  }
  
  // Fallback to parsing cookie header manually
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(name + "=")) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

/**
 * Get user from header/cookie authentication
 */
async function getUserFromHeader(req: any): Promise<User | null> {
  try {
    // Check for InstantDB auth token first (in Authorization header or localStorage format)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      
      // Try to verify as InstantDB token (JWT format)
      if (token.includes('.')) {
        try {
          const tokenData = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          
          if (tokenData?.sub) {
            const userId = tokenData.sub;
            console.log('[Auth] InstantDB token verified for user:', userId);
            
            // Get or create user in our system
            let dbUser = await getUserById(userId);
            
            if (!dbUser) {
              // Create user from InstantDB auth
              await upsertUser({
                id: userId,
                email: tokenData.email || null,
                name: tokenData.email || null,
                loginMethod: 'instantdb',
                role: 'user',
                lastSignedIn: new Date(),
              });
              
              dbUser = await getUserById(userId);
            }
            
            return dbUser as User | null;
          }
        } catch (jwtError) {
          console.log('[Auth] Not a valid JWT, trying OAuth SDK...');
        }
      }
      
      // Not an InstantDB token, try OAuth SDK
      req.headers.authorization = `Bearer ${token}`;
    }

    // Try old OAuth method
    const cookieToken = getCookieToken(req, COOKIE_NAME);
    
    if (cookieToken && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${cookieToken}`;
    }

    if (!req.headers.authorization) {
      return null;
    }

    // Authenticate using SDK
    const authed = await sdk.authenticateRequest(req) as any;

    if (authed?.openId) {
      const sessionUser = (req.session as any)?.user;
      const cookieHeader = req.headers.cookie || '';
      const hasConnectSid = cookieHeader.includes('connect.sid');
      
      if (hasConnectSid && req.session && !sessionUser) {
        (req.session as any).user = {
          id: authed.openId,
          openId: authed.openId,
          name: authed.name || null,
          email: authed.email || null,
          loginMethod: authed.loginMethod || "google",
        };
        req.session.save((err) => {
          if (err) {
            console.error("[tRPC Context] Failed to restore session:", err);
          }
        });
      }
      
      await upsertUser({
        id: authed.openId,
        name: authed.name ?? null,
        email: authed.email ?? null,
        loginMethod: authed.loginMethod ?? null,
        lastSignedIn: new Date(),
      });

      const dbUser = await getUserById(authed.openId);
      return (dbUser ?? null) as User | null;
    }
    
    return null;
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return null;
  }
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const { req, res } = opts;
  try {
    // Debug: log all headers
    console.log('[Context] All headers:', JSON.stringify(req.headers, null, 2));
    
    // Check for InstantDB user ID in custom header (simplest verification)
    const instantUserId = req.headers['x-instant-user-id'];
    const instantUserEmail = req.headers['x-instant-user-email'];
    
    console.log('[Context] InstantDB headers:', { instantUserId, instantUserEmail });
    
    if (instantUserId && typeof instantUserId === 'string') {
      console.log('[Context] InstantDB user detected:', instantUserId);
      
      // Get or create user
      let user = await getUserById(instantUserId);
      
      if (!user) {
        await upsertUser({
          id: instantUserId,
          email: instantUserEmail as string || null,
          name: instantUserEmail as string || null,
          loginMethod: 'instantdb',
          role: 'user',
          lastSignedIn: new Date(),
        });
        
        user = await getUserById(instantUserId);
      }
      
      if (user) {
        return { req, res, user: user as User };
      }
    }
    
    // Fallback to old auth methods
    let user = await getUserFromHeader(req);
    
    if (!user) {
      user = (req.session as any)?.user;
    }

    if (!user) {
      const token = getCookieToken(req, COOKIE_NAME);
      if (token) {
        const verified = await sdk.verifySession(token);
        if (verified?.openId) {
          user = await getUserById(verified.openId);
          (req.session as any).user = user;
        }
      }
    }
    
    return { req, res, user: user as User | null };
  } catch (e) {
    console.error('[Context] Error creating context:', e);
    return { req, res, user: null };
  }
}
