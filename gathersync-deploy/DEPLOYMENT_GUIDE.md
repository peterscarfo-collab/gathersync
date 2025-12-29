# GatherSync Marketing Website Deployment Guide

## Overview

This package contains the GatherSync marketing website ready for deployment to Netlify.

**What's included:**
- Landing page with features, pricing, and enterprise information
- Thank You page with donation feature
- Lifestyle event photos
- Netlify configuration files

---

## Step 1: Deploy to Netlify (5 minutes)

### 1.1 Create Netlify Account
1. Go to [netlify.com](https://netlify.com)
2. Click "Sign up" (free tier is perfect)
3. Sign up with GitHub, GitLab, or email

### 1.2 Deploy the Site
1. After logging in, you'll see the Netlify dashboard
2. Look for the **drag-and-drop area** that says "Want to deploy a new site without connecting to Git? Drag and drop your site folder here"
3. **Drag the entire `gathersync-deploy` folder** onto that area
4. Netlify will upload and deploy automatically (takes ~30 seconds)
5. You'll get a random URL like `https://random-name-12345.netlify.app`

### 1.3 Test the Deployment
1. Click the generated URL to view your site
2. Verify the landing page loads correctly
3. Check that images appear
4. Test the Thank You page: `https://your-site.netlify.app/thank-you.html`

---

## Step 2: Configure Custom Domain (10 minutes)

### 2.1 Add Domain to Netlify
1. In Netlify dashboard, click on your site
2. Go to **"Domain settings"**
3. Click **"Add custom domain"**
4. Enter: `gathersync.app`
5. Netlify will verify you own the domain

### 2.2 Configure DNS at Namecheap
1. Log in to [Namecheap](https://namecheap.com)
2. Go to **Domain List** → **gathersync.app** → **Manage**
3. Click **"Advanced DNS"** tab
4. Add these records:

**For Root Domain (gathersync.app):**

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | @ | 75.2.60.5 | Automatic |
| CNAME Record | www | [your-site].netlify.app | Automatic |

**Netlify will provide the exact IP address** - use that instead of 75.2.60.5 if different.

### 2.3 Enable HTTPS
1. Back in Netlify, go to **"Domain settings"** → **"HTTPS"**
2. Click **"Verify DNS configuration"**
3. Once verified, click **"Provision certificate"**
4. Wait 1-2 minutes for SSL certificate to activate
5. Enable **"Force HTTPS"** (redirects HTTP to HTTPS automatically)

### 2.4 Test Your Domain
1. Visit `https://gathersync.app` in your browser
2. Should show your marketing site with green padlock (HTTPS)
3. Test: `https://gathersync.app/thank-you.html`

---

## Step 3: Configure App Subdomain (Optional)

If you want the mobile app accessible at `app.gathersync.app`:

### 3.1 Add Subdomain DNS Record
In Namecheap Advanced DNS:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME Record | app | [your-manus-url] | Automatic |

Replace `[your-manus-url]` with your Manus deployment URL (without https://).

Example: If your Manus URL is `https://8081-abc123.manus-asia.computer`, use:
- **Host:** `app`
- **Value:** `8081-abc123.manus-asia.computer`

### 3.2 Update Share Messages
Once `app.gathersync.app` is working, update the share messages in the GatherSync mobile app to use:
```
https://app.gathersync.app/public-event?eventId=xxx
```

---

## Step 4: Update Marketing Content (Future)

### To Update the Website:
1. Edit the HTML/CSS files in the `gathersync-deploy` folder
2. Drag the updated folder to Netlify (it will replace the old version)
3. Changes go live immediately

### Common Updates:
- **Pricing changes:** Edit `index.html`, search for "$3.99"
- **Features:** Edit `index.html`, find the features section
- **Photos:** Replace files in `images/` folder
- **Thank You page:** Edit `thank-you.html`

---

## Troubleshooting

### Domain not working after 24 hours
- Check DNS propagation: [whatsmydns.net](https://whatsmydns.net)
- Verify DNS records in Namecheap match Netlify's instructions
- Try clearing browser cache or use incognito mode

### Images not loading
- Check that `images/` folder was included in deployment
- Verify image paths in HTML are correct (should be `images/filename.jpg`)

### HTTPS not working
- Wait 5-10 minutes after provisioning certificate
- Check that DNS is fully propagated
- Try force-refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## Cost Summary

**Netlify:**
- Free tier: Perfect for this site
- Includes: Unlimited bandwidth, HTTPS, CDN, 100GB/month

**Domain (gathersync.app):**
- A$10.50/year (already purchased)

**Total ongoing cost:** $0/month for hosting! 🎉

---

## Next Steps After Deployment

1. ✅ Test the full user flow: Landing page → Pricing → Download
2. ✅ Share the link with friends/family for feedback
3. ✅ Test the Thank You page donation flow
4. ⏳ Set up Stripe for payments (when ready)
5. ⏳ Configure email for contact form submissions
6. ⏳ Add Google Analytics (optional, for tracking visitors)

---

## Support

If you run into issues:
1. Check Netlify's deployment logs (in dashboard)
2. Verify DNS settings in Namecheap
3. Test in incognito mode to rule out caching issues

**Deployment should take 15-20 minutes total.** Most of that is waiting for DNS propagation!

Good luck! 🚀
