# GatherSync Backend Deployment Handoff

## Critical Problem

**Railway URL:** https://gathersync-production.up.railway.app  
**Issue:** All API endpoints return nginx 404 instead of Node.js responses  
**Expected:** `/api/health` should return JSON `{"status":"ok"}`  
**Actual:** nginx 404 page

## What Works Locally

The backend runs perfectly in development:
```bash
cd /home/ubuntu/gathersync
npm install
npm run build
npm start
```

Test: `curl http://localhost:3000/api/health` returns `{"status":"ok"}`

## Backend Stack

- **Runtime:** Node.js 22
- **Framework:** Express.js
- **Build:** TypeScript → JavaScript (esbuild)
- **Entry:** `dist/index.js` (compiled from `server/_core/index.ts`)
- **Database:** MySQL (Railway hosted)
- **Port:** 3000 (set by Railway via PORT env var)

## Environment Variables Needed

```
DATABASE_URL=mysql://root:password@host:port/railway
GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://gathersync-production.up.railway.app/api/auth/google/callback
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
```

## What's Been Tried (All Failed)

1. **railway.toml** - Railway ignored it, still used nginx
2. **nixpacks.toml** - Railway wrapped with nginx anyway
3. **Procfile** - No effect
4. **railway.json** - Current config, still failing
5. **Removing all config files** - Railway auto-detected as static site
6. **.railwayignore** - Tried blocking static file detection

## Current Configuration Files

### package.json scripts
```json
{
  "scripts": {
    "build": "esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js"
  }
}
```

### railway.json (current)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Root Cause Hypothesis

Railway is detecting this as a **static site** (because of the React Native web build in `/dist` folder) and automatically wrapping it with nginx. The nginx reverse proxy is intercepting all requests before they reach the Node.js backend.

## Possible Solutions

1. **Separate repositories** - Deploy backend and frontend separately
2. **Monorepo with explicit paths** - Tell Railway to only deploy `/server` directory
3. **Different platform** - Heroku, Render, or DigitalOcean don't have this nginx wrapping behavior
4. **Railway support ticket** - Ask Railway why it's serving nginx instead of Node.js

## Quick Verification Commands

Once deployed, test these endpoints:

```bash
# Health check (should return JSON)
curl https://gathersync-production.up.railway.app/api/health

# Google OAuth (should redirect to Google)
curl -I https://gathersync-production.up.railway.app/api/auth/google

# Version endpoint (should return JSON)
curl https://gathersync-production.up.railway.app/api/version
```

If you see nginx 404, the problem still exists.

## Repository

**GitHub:** https://github.com/peterscarfo-collab/gathersync  
**Branch:** main  
**Backend code:** `/server/_core/index.ts`  
**Compiled output:** `/dist/index.js`

## Contact

The backend code is correct and works locally. The issue is purely deployment configuration with Railway's platform.
