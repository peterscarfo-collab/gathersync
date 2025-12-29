# GatherSync Complete Deployment Guide

This guide walks you through deploying both the backend API and frontend web app for GatherSync.

## Overview

- **Backend API**: Deployed to Render.com (Node.js server)
- **Frontend Web App**: Deployed to Netlify (static files)
- **Database**: MySQL on PlanetScale or Railway

## Part 1: Deploy Backend API to Render

### Step 1: Set Up Database

Choose one option:

#### Option A: PlanetScale (Recommended)

1. Go to [planetscale.com](https://planetscale.com) and sign up
2. Create a new database: `gathersync`
3. Click "Connect" → Get connection string
4. Format: `mysql://username:password@host/database?ssl={"rejectUnauthorized":true}`
5. Save this connection string

#### Option B: Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Create new project → Add MySQL
3. Copy the `DATABASE_URL` from Variables tab
4. Save this connection string

### Step 2: Push Code to GitHub

```bash
# In your local GatherSync directory
git init
git add .
git commit -m "Initial GatherSync deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/gathersync.git
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the `gathersync` repository
4. Configure:
   - **Name**: `gathersync-api`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Runtime**: Node
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Instance Type**: Free

### Step 4: Add Environment Variables in Render

Click "Environment" tab and add these variables:

| Variable Name | Value | Notes |
|---------------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `DATABASE_URL` | (your database connection string) | From Step 1 |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | (from Manus dashboard) | Contact Manus support if needed |
| `EXPO_PUBLIC_OAUTH_SERVER_URL` | (from Manus dashboard) | Contact Manus support if needed |
| `EXPO_PUBLIC_APP_ID` | (from Manus dashboard) | Your GatherSync app ID |
| `EXPO_PUBLIC_OWNER_OPEN_ID` | (your Manus user ID) | From Manus profile |
| `EXPO_PUBLIC_OWNER_NAME` | `Peter Scarfo` | Your name |

**Optional** (for Stripe payments):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO_MONTHLY`
- `STRIPE_PRICE_ID_PRO_YEARLY`

### Step 5: Deploy and Initialize Database

1. Click "Create Web Service"
2. Wait for deployment (2-5 minutes)
3. Once deployed, note your API URL: `https://gathersync-api.onrender.com`
4. Go to "Shell" tab in Render dashboard
5. Run: `pnpm run db:push` to create database tables

### Step 6: Verify Backend is Working

Visit: `https://gathersync-api.onrender.com/api/health`

You should see: `{"ok":true,"timestamp":1234567890}`

---

## Part 2: Deploy Frontend to Netlify

### Step 1: Build Frontend with Production API URL

In the GatherSync project, create a `.env.production` file:

```bash
# .env.production
EXPO_PUBLIC_API_BASE_URL=https://gathersync-api.onrender.com
```

**Important**: Replace `gathersync-api.onrender.com` with your actual Render URL from Part 1, Step 5.

### Step 2: Export Web Build

```bash
# In your GatherSync directory
EXPO_PUBLIC_API_BASE_URL=https://gathersync-api.onrender.com npx expo export --platform web
```

This creates a `dist/` folder with your web app.

### Step 3: Create Deployment Package

```bash
cd dist
zip -r ../gathersync-web-production.zip .
cd ..
```

### Step 4: Deploy to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag and drop `gathersync-web-production.zip` onto the Netlify dashboard
3. Wait for deployment (1-2 minutes)
4. Netlify will give you a URL like: `https://random-name-123.netlify.app`

### Step 5: Configure Custom Domain

1. In Netlify dashboard, go to **Site settings** → **Domain management**
2. Click **Add custom domain**
3. Enter: `app.gathersync.app`
4. Follow Netlify's instructions to:
   - Add DNS records to your domain registrar
   - Wait for DNS propagation (can take up to 48 hours)
5. Enable HTTPS (Netlify does this automatically)

---

## Part 3: Test the Complete System

### Test 1: Frontend Loads

1. Visit `https://app.gathersync.app`
2. You should see the GatherSync Events page
3. Check browser console for errors

### Test 2: OAuth Login

1. Click on Profile tab or any feature requiring login
2. You should be redirected to Manus OAuth login
3. After logging in, you should return to app.gathersync.app
4. Check that you're logged in (see your name/email)

### Test 3: Cloud Sync

1. Create a test event
2. Check that it saves to the database
3. Log out and log back in
4. Verify the event is still there (loaded from cloud)

---

## Troubleshooting

### Backend Issues

**Problem**: Render build fails
- Check Render logs for specific error
- Verify `package.json` has correct scripts
- Ensure `pnpm` is being used (should be automatic)

**Problem**: Database connection fails
- Verify `DATABASE_URL` is correct
- Check database allows external connections
- For PlanetScale, ensure SSL is enabled

**Problem**: OAuth not working
- Verify all `EXPO_PUBLIC_OAUTH_*` variables are set
- Check that Render API URL is whitelisted in Manus OAuth settings
- Check Render logs for OAuth errors

### Frontend Issues

**Problem**: "API server not found" error
- Verify `EXPO_PUBLIC_API_BASE_URL` was set during build
- Rebuild frontend with correct API URL
- Check browser Network tab to see what URL is being called

**Problem**: OAuth redirect fails
- Ensure backend is deployed and running
- Verify OAuth callback URL matches backend URL
- Check browser console for redirect errors

**Problem**: Login works but data doesn't sync
- Check backend logs in Render dashboard
- Verify database connection is working
- Test `/api/health` endpoint

### DNS Issues

**Problem**: app.gathersync.app doesn't resolve
- Wait up to 48 hours for DNS propagation
- Use `nslookup app.gathersync.app` to check DNS
- Verify DNS records are correct in domain registrar

---

## Maintenance

### Updating Backend

1. Push changes to GitHub
2. Render automatically redeploys
3. Monitor deployment in Render dashboard

### Updating Frontend

1. Set `EXPO_PUBLIC_API_BASE_URL` environment variable
2. Run: `npx expo export --platform web`
3. Zip the `dist/` folder
4. Upload to Netlify (drag & drop or use Netlify CLI)

### Monitoring

- **Backend logs**: Render dashboard → Logs tab
- **Backend health**: `https://gathersync-api.onrender.com/api/health`
- **Frontend**: Netlify dashboard → Deploys tab

### Costs

- **Render Free Tier**: 750 hours/month, spins down after 15 min inactivity
- **Netlify Free Tier**: 100 GB bandwidth/month
- **PlanetScale Free Tier**: 5 GB storage, 1 billion row reads/month
- **Total**: $0/month for personal use

---

## Support

If you encounter issues:

1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Test each component individually (database, backend, frontend)
5. Contact Manus support for OAuth-related issues

---

## Next Steps

After successful deployment:

1. **Set up monitoring**: Add uptime monitoring (e.g., UptimeRobot)
2. **Enable backups**: Configure database backups
3. **Add analytics**: Integrate Google Analytics or similar
4. **Performance**: Consider upgrading to paid plans for better performance
5. **Security**: Review and update environment variables regularly
