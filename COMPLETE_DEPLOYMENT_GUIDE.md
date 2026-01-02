# GatherSync Complete Deployment Guide

## Overview

GatherSync has 4 components that need deployment:

1. **Backend API** (Railway) - BROKEN, needs fix
2. **Marketing Website** (gathersync.app) - WORKING
3. **Web App** (Netlify) - READY to deploy
4. **Mobile Apps** (iOS/Android) - WORKING, waiting for app store approval

---

## 1. Backend API (Railway)

**Status:** 🔴 BROKEN  
**URL:** https://gathersync-production.up.railway.app  
**Problem:** Returns nginx 404 instead of Node.js API responses

### What Needs to Be Done:
- Fix Railway configuration to serve Node.js backend
- See `DEPLOYMENT_HANDOFF.md` and `RAILWAY_FIX_CHECKLIST.md` for details
- Expected fix time: 30 minutes by competent developer

### Environment Variables Required:
```
DATABASE_URL=mysql://root:password@host:port/railway
GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://gathersync-production.up.railway.app/api/auth/google/callback
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=production
```

---

## 2. Marketing Website

**Status:** ✅ WORKING  
**URL:** https://gathersync.app  
**Platform:** Static hosting (Netlify or similar)

### Files Location:
- Source: `/marketing-site/` directory (if it exists)
- Or check current hosting provider dashboard

### What's Included:
- Landing page with product features
- Pricing section (Free/Lite/Pro tiers)
- Contact form
- Download links (currently show "Coming Soon")

### Updates Needed:
Once mobile apps are approved:
- Update iOS download link to App Store URL
- Update Android download link to Google Play URL

---

## 3. Web App (Browser Version)

**Status:** ✅ READY TO DEPLOY  
**Recommended Platform:** Netlify  
**Build Output:** `/dist/` folder

### Deployment Steps:

#### Option A: Netlify Drag & Drop (Easiest)
1. Go to https://app.netlify.com/drop
2. Drag the `/dist/` folder onto the page
3. Get instant URL (e.g., `https://gathersync-abc123.netlify.app`)
4. Configure custom domain: `app.gathersync.app`

#### Option B: Netlify CLI
```bash
cd /path/to/gathersync/dist
netlify deploy --prod
```

#### Option C: GitHub Integration
1. Push code to GitHub
2. Connect Netlify to repository
3. Build command: `npx expo export --platform web`
4. Publish directory: `dist`

### Environment Variables:
The web app needs to know the backend URL. Once Railway is fixed, update:
- File: `constants/oauth.ts`
- Function: `getApiBaseUrl()`
- Change to: `https://gathersync-production.up.railway.app`

### Custom Domain Setup:
1. In Netlify dashboard → Domain settings
2. Add custom domain: `app.gathersync.app`
3. Update DNS records at your domain registrar:
   ```
   Type: CNAME
   Name: app
   Value: [your-netlify-site].netlify.app
   ```

---

## 4. Mobile Apps

**Status:** ✅ WORKING  
**Platform:** React Native with Expo  
**Testing:** Available via Expo Go app

### iOS App

**Status:** Waiting for Apple Developer approval  
**Bundle ID:** `space.manus.gathersync.t20251216190030`  
**Current Testing:** Users can test via Expo Go app

**Deployment Steps (Once Approved):**
1. Build production IPA:
   ```bash
   eas build --platform ios --profile production
   ```
2. Submit to App Store:
   ```bash
   eas submit --platform ios
   ```
3. Wait for Apple review (typically 1-2 weeks)

### Android App

**Status:** Waiting for Google Play approval  
**Package:** `space.manus.gathersync.t20251216190030`  
**Current Testing:** Users can install APK directly

**Deployment Steps (Once Approved):**
1. Build production APK/AAB:
   ```bash
   eas build --platform android --profile production
   ```
2. Submit to Google Play:
   ```bash
   eas submit --platform android
   ```
3. Wait for Google review (typically 1-3 days)

### Testing Links:
- **Expo Go (iOS):** Users scan QR code from Expo dashboard
- **APK (Android):** Direct download link for testing

---

## Deployment Priority

### Immediate (Today):
1. ✅ Web app to Netlify - **READY NOW** (just drag & drop the dist folder)
2. 🔴 Fix Railway backend - **NEEDS DEVELOPER** (30 min fix)

### This Week:
3. 📱 Submit mobile apps to stores - **WAITING FOR BACKEND FIX**
4. 🌐 Update marketing site download links - **AFTER APP STORE APPROVAL**

---

## Post-Deployment Checklist

Once everything is deployed:

### Test Backend API:
```bash
curl https://gathersync-production.up.railway.app/api/health
# Should return: {"status":"ok"}
```

### Test Web App:
1. Visit https://app.gathersync.app
2. Click "Login" button
3. Should redirect to Google OAuth
4. After login, should see Events screen

### Test Mobile Apps:
1. Open app on iOS/Android
2. Tap "Login" button
3. Should open Google OAuth in browser
4. After login, should return to app with user logged in

### Test Full Flow:
1. Create an event on web app
2. Open mobile app
3. Event should sync and appear
4. Make changes on mobile
5. Refresh web app
6. Changes should sync

---

## Support Contacts

- **Backend Issues:** See DEPLOYMENT_HANDOFF.md
- **Railway Platform:** support@railway.app
- **Netlify Platform:** support@netlify.com
- **Expo/EAS:** https://expo.dev/support

---

## Files Included in Handoff Package

1. `DEPLOYMENT_HANDOFF.md` - Backend deployment problem details
2. `RAILWAY_FIX_CHECKLIST.md` - Step-by-step Railway fix instructions
3. `COMPLETE_DEPLOYMENT_GUIDE.md` - This file (overview of all deployments)
4. `gathersync-backend-handoff.tar.gz` - Backend source code
5. `gathersync-web-251230-0055.zip` - Web app build (ready to deploy)

---

## Quick Start for New Developer

1. **Read this file first** to understand the full picture
2. **Fix Railway backend** using DEPLOYMENT_HANDOFF.md (30 min)
3. **Deploy web app** to Netlify (5 min)
4. **Test everything** works end-to-end (10 min)
5. **Submit mobile apps** to stores (15 min)

**Total time: ~1 hour**
