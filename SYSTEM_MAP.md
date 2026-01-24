# GatherSync System Map & Migration Fixes

## Overview

This document summarizes the fixes applied during the migration from Manus 1.6/ChatGPT to Cursor, addressing circular logic and hardcoded localhost references that were breaking web login.

---

## ✅ Fixes Applied

### 1. OAuth Login URL Function (`constants/oauth.ts`)

**Problem:** `getLoginUrl()` was being imported and used in multiple files but was not defined in `constants/oauth.ts`, causing runtime errors.

**Solution:** Added `getLoginUrl()` function that:
- Constructs the Manus OAuth login URL dynamically
- Handles both web and native platforms
- Uses environment variables for OAuth portal URL and App ID
- Encodes redirect URI in the state parameter (base64) as required by Manus OAuth
- For web: redirects to `/api/oauth/callback` on the same origin
- For native: redirects to API base + `/api/oauth/callback`

**Files Modified:**
- `constants/oauth.ts` - Added `getLoginUrl()`, `getOAuthPortalUrl()`, and `getAppId()` helper functions

**Usage:**
```typescript
import { getLoginUrl } from '@/constants/oauth';
const loginUrl = getLoginUrl();
```

**Environment Variables Required:**
- `EXPO_PUBLIC_OAUTH_PORTAL_URL` or `VITE_OAUTH_PORTAL_URL` - Manus OAuth portal URL
- `EXPO_PUBLIC_APP_ID` or `VITE_APP_ID` - Manus OAuth App ID

---

### 2. Cookie Configuration for Local HTTP Dev (`server/_core/cookies.ts`)

**Problem:** Cookie settings were not properly configured for local HTTP development (127.0.0.1:8081), causing authentication issues in development.

**Solution:** Updated `getSessionCookieOptions()` to:
- Detect local HTTP dev environment (127.0.0.1:8081 or localhost:8081)
- Use `SameSite=Lax` and `Secure=false` for local HTTP dev
- Maintain secure settings (`SameSite=None`, `Secure=true`) for production HTTPS
- Properly handle cookie domain settings for production

**Files Modified:**
- `server/_core/cookies.ts` - Added `isLocalHttpDev()` helper and updated cookie options logic

**Behavior:**
- **Local HTTP Dev (127.0.0.1:8081):** `SameSite=Lax`, `Secure=false`, no domain
- **Production HTTPS:** `SameSite=None`, `Secure=true`, domain `.gathersync.app`

---

## 🔍 Analysis Results

### Hardcoded localhost:3000 References

**Found:** 1 reference in documentation only
- `DEPLOYMENT_HANDOFF.md:20` - Documentation example, not code

**Status:** ✅ No code changes needed (documentation only)

### Circular Logic Issues

**Analysis:** The main circular logic issue was the missing `getLoginUrl()` export, which created a dependency chain that couldn't resolve. This has been fixed.

---

## ⚠️ Remaining Blockers for Netlify Build

### 1. Environment Variables Configuration

**Required for OAuth to work:**
```bash
EXPO_PUBLIC_OAUTH_PORTAL_URL=<manus-oauth-portal-url>
EXPO_PUBLIC_APP_ID=<manus-app-id>
```

**Action Required:**
- Set these in Netlify dashboard → Site settings → Environment variables
- Or configure in `netlify.toml` if using build-time variables

### 2. Backend API Configuration

**Current Status:** Railway backend is returning nginx 404 errors (see `DEPLOYMENT_HANDOFF.md`)

**Impact:** Web login will fail if backend is not accessible

**Action Required:**
- Fix Railway deployment (see `RAILWAY_FIX_CHECKLIST.md`)
- Or configure alternative backend URL in Netlify environment variables:
  ```bash
  EXPO_PUBLIC_API_BASE_URL=https://api.gathersync.app
  ```

### 3. Netlify Build Configuration

**Check Required:**
- Verify `netlify.toml` is properly configured
- Ensure build command outputs to correct directory
- Verify redirect rules for SPA routing (all routes → `index.html`)

**Current `netlify.toml` Status:** Needs verification

### 4. CORS and Cookie Settings

**For Production:**
- Ensure backend allows cookies from Netlify domain
- Verify `Access-Control-Allow-Credentials: true` header
- Check that cookie domain settings work across subdomains if needed

---

## 📋 Pre-Deployment Checklist

Before deploying to Netlify:

- [ ] Set `EXPO_PUBLIC_OAUTH_PORTAL_URL` environment variable
- [ ] Set `EXPO_PUBLIC_APP_ID` environment variable
- [ ] Verify backend API is accessible (fix Railway if needed)
- [ ] Test `getLoginUrl()` returns valid URL in build
- [ ] Verify cookie settings work in production
- [ ] Check Netlify redirect rules for SPA routing
- [ ] Test OAuth flow end-to-end in staging environment

---

## 🔗 Related Documentation

- `DEPLOYMENT_HANDOFF.md` - Backend deployment issues
- `RAILWAY_FIX_CHECKLIST.md` - Step-by-step Railway fix
- `COMPLETE_DEPLOYMENT_GUIDE.md` - Full deployment overview
- `server/README.md` - Server configuration details

---

## 🧪 Testing Recommendations

### Local Development
1. Start local server on `127.0.0.1:8081`
2. Test login flow - should use `SameSite=Lax`, `Secure=false`
3. Verify `getLoginUrl()` returns valid URL
4. Check cookies are set correctly in browser DevTools

### Production Testing
1. Deploy to Netlify staging
2. Test login flow - should use `SameSite=None`, `Secure=true`
3. Verify cookies work across domains (if applicable)
4. Test OAuth callback redirects correctly

---

## 📝 Notes

- The `getLoginUrl()` function uses `btoa()` for base64 encoding, which is available in browser environments. For Node.js environments, consider using `Buffer.from().toString('base64')` if needed.
- Cookie settings are now environment-aware and should work correctly in both development and production.
- All fixes maintain backward compatibility with existing code.

---

**Last Updated:** 2025-01-30  
**Migration:** Manus 1.6/ChatGPT → Cursor
