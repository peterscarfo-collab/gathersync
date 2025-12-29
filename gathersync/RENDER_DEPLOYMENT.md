# GatherSync Backend Deployment to Render.com

This guide explains how to deploy the GatherSync backend API to Render.com.

## Prerequisites

1. **GitHub Account** - Render deploys from GitHub repositories
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **Database** - MySQL database (Render provides free PostgreSQL, or use PlanetScale/Railway for MySQL)

## Step 1: Push Code to GitHub

1. Create a new GitHub repository (e.g., `gathersync-backend`)
2. Push the GatherSync project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/gathersync-backend.git
   git push -u origin main
   ```

## Step 2: Set Up Database

### Option A: PlanetScale (Recommended for MySQL)

1. Go to [planetscale.com](https://planetscale.com)
2. Create a new database named `gathersync`
3. Get the connection string (format: `mysql://user:pass@host/database`)
4. Save this for Step 4

### Option B: Railway

1. Go to [railway.app](https://railway.app)
2. Create a new MySQL database
3. Get the `DATABASE_URL` from the database settings
4. Save this for Step 4

## Step 3: Create Render Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `gathersync-api`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm run start`
   - **Plan**: Free (or paid for better performance)

## Step 4: Configure Environment Variables

In the Render dashboard, add these environment variables:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host/db` |
| `EXPO_PUBLIC_OAUTH_PORTAL_URL` | Manus OAuth portal URL | (from Manus dashboard) |
| `EXPO_PUBLIC_OAUTH_SERVER_URL` | Manus OAuth server URL | (from Manus dashboard) |
| `EXPO_PUBLIC_APP_ID` | Manus app ID | (from Manus dashboard) |
| `EXPO_PUBLIC_OWNER_OPEN_ID` | Your Manus user ID | (from Manus dashboard) |
| `EXPO_PUBLIC_OWNER_NAME` | Your name | `Peter Scarfo` |

### Optional Variables (for Stripe payments)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Monthly subscription price ID |
| `STRIPE_PRICE_ID_PRO_YEARLY` | Yearly subscription price ID |

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will automatically build and deploy your backend
3. Wait for deployment to complete (usually 2-5 minutes)
4. Your API will be available at: `https://gathersync-api.onrender.com`

## Step 6: Run Database Migrations

After first deployment:

1. Go to your Render service dashboard
2. Click **"Shell"** tab
3. Run: `pnpm run db:push`
4. This creates the database tables

## Step 7: Update Frontend Configuration

Update the frontend to use your production API:

1. Set `EXPO_PUBLIC_API_BASE_URL` to your Render URL
2. Rebuild and redeploy the frontend to Netlify

## Step 8: Configure OAuth Redirect

The OAuth callback URL should be:
```
https://gathersync-api.onrender.com/api/oauth/callback
```

This is already configured in the code and will work automatically.

## Troubleshooting

### Database Connection Issues

- Check that `DATABASE_URL` is correct
- Ensure database allows connections from Render IPs
- For PlanetScale, make sure SSL is enabled

### OAuth Not Working

- Verify all `EXPO_PUBLIC_OAUTH_*` variables are set correctly
- Check Render logs for error messages
- Ensure OAuth redirect URL is whitelisted in Manus dashboard

### Build Failures

- Check Render build logs
- Ensure `pnpm` is available (Render supports it by default)
- Verify `package.json` has correct build scripts

## Monitoring

- **Logs**: View in Render dashboard → Logs tab
- **Health Check**: `https://gathersync-api.onrender.com/api/health`
- **Metrics**: Available in Render dashboard

## Cost

- **Free Tier**: 750 hours/month, spins down after 15 min inactivity
- **Paid Plans**: Starting at $7/month for always-on service

## Next Steps

After backend is deployed:

1. Update frontend `EXPO_PUBLIC_API_BASE_URL` environment variable
2. Rebuild frontend with new API URL
3. Deploy updated frontend to Netlify
4. Test OAuth login flow end-to-end
