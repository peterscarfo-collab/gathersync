# Railway Deployment Fix Checklist

## For the Developer Fixing This

### Step 1: Verify the Problem
```bash
curl https://gathersync-production.up.railway.app/api/health
```
If you see "404 Not Found" with "nginx/1.24.0", the problem exists.

### Step 2: Check Railway Dashboard

1. Go to https://railway.app
2. Open the "gathersync-production" project
3. Click on the service
4. Go to "Deployments" tab
5. Check the latest deployment logs

**Look for:**
- Is it building with Nixpacks or detecting as static site?
- Is `npm start` actually running?
- Are there any errors in the build logs?
- What port is the app binding to?

### Step 3: Check Build Logs

The logs should show:
```
Building with Nixpacks
Installing dependencies...
Running build command: npm run build
Starting: npm start
[api] server listening on port 3000
```

If you see anything about "nginx" or "static site", that's the problem.

### Step 4: Possible Fixes

#### Option A: Force Node.js Detection
Create a `.node-version` file:
```
22
```

#### Option B: Explicit Start Command in Railway Dashboard
In Railway dashboard → Settings → Deploy:
- Start Command: `node dist/index.js`
- Build Command: `npm install && npm run build`

#### Option C: Use Root Path Only
In Railway dashboard → Settings:
- Root Directory: `/`
- Watch Paths: `server/**`

#### Option D: Separate Service
Create a NEW Railway service:
1. New service → "Empty Service"
2. Connect to GitHub repo
3. Set Root Directory to `/server`
4. Set Build Command: `cd .. && npm install && npm run build`
5. Set Start Command: `cd .. && npm start`

### Step 5: Verify Fix

After redeploying, test all endpoints:
```bash
# Should return {"status":"ok"}
curl https://gathersync-production.up.railway.app/api/health

# Should redirect to Google OAuth
curl -I https://gathersync-production.up.railway.app/api/auth/google

# Should return version info
curl https://gathersync-production.up.railway.app/api/version
```

### Step 6: Update Frontend

Once backend is working, update the frontend's API URL in:
- `constants/oauth.ts` - Change `getApiBaseUrl()` to return Railway URL

## Environment Variables to Set

Make sure these are set in Railway dashboard → Variables:

```
DATABASE_URL=mysql://root:password@host:port/railway
GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://gathersync-production.up.railway.app/api/auth/google/callback
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
PORT=3000
```

## If All Else Fails

Deploy to a different platform:
- **Heroku:** Simpler, just needs a Procfile
- **Render:** Better for Node.js apps
- **DigitalOcean App Platform:** More control
- **Fly.io:** Modern alternative to Railway

## Expected Timeline

A competent developer should be able to:
- Diagnose the issue: 10 minutes
- Implement fix: 15 minutes
- Test and verify: 5 minutes
- **Total: 30 minutes**

If it takes longer than 1 hour, switch platforms.
