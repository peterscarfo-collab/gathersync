# Google Play Store Submission Guide for GatherSync

## ✅ Prerequisites Checklist

Before you begin, make sure you have:

- [x] Google Play Developer account ($25 one-time fee)
- [ ] Android device verification completed (borrow Mike's phone)
- [x] All store listing materials prepared (in `google-play-assets/` folder)
- [ ] Production APK/AAB file built (we'll do this next)
- [x] Privacy Policy URL: https://gathersync.app/privacy
- [x] Terms of Service URL: https://gathersync.app/terms

---

## 📁 Store Listing Materials

All materials are ready in the `google-play-assets/` folder:

### Screenshots (4 images)
1. `screenshot-1-events-list.png` - Events list view
2. `screenshot-2-calendar-heatmap.png` - Calendar with availability heatmap
3. `screenshot-3-participants.png` - Participants management
4. `screenshot-4-pricing.png` - Subscription pricing tiers

### Graphics
- `feature-graphic.png` (1024x500px) - Banner for store listing
- `app-icon-512.png` (512x512px) - High-res app icon

### Text Content
- `google-play-listing.md` - All descriptions, categories, and metadata

---

## 🚀 Step-by-Step Submission Process

### Step 1: Complete Developer Account Verification

1. Borrow Mike's Android phone
2. Download "Google Play Console" app from Play Store
3. Sign in with your Google account
4. Complete the device verification
5. Return the phone (you won't need it again)

### Step 2: Create Your App in Play Console

1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Fill in the form:
   - **App name:** GatherSync - Event Scheduler
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
   - **Declarations:** Check all required boxes
4. Click **"Create app"**

### Step 3: Set Up Store Listing

Navigate to **"Store presence" → "Main store listing"** and fill in:

#### App Details
- **App name:** GatherSync - Event Scheduler
- **Short description:** (Copy from `google-play-listing.md`)
  ```
  Find the perfect time for group events with smart calendar coordination.
  ```
- **Full description:** (Copy from `google-play-listing.md` - the full 4000 character description)

#### Graphics
- **App icon:** Upload `app-icon-512.png`
- **Feature graphic:** Upload `feature-graphic.png`
- **Phone screenshots:** Upload all 4 screenshot files (in order)
  - screenshot-1-events-list.png
  - screenshot-2-calendar-heatmap.png
  - screenshot-3-participants.png
  - screenshot-4-pricing.png

#### Categorization
- **App category:** Productivity
- **Tags:** event scheduling, calendar, group coordination, RSVP, meeting planner

#### Contact Details
- **Email:** hello@gathersync.app
- **Website:** https://gathersync.app
- **Privacy policy URL:** https://gathersync.app/privacy

#### Save the store listing

### Step 4: Set Up App Content

Navigate to **"Policy" → "App content"** and complete:

#### Privacy Policy
- URL: https://gathersync.app/privacy

#### App Access
- Select: "All functionality is available without special access"

#### Ads
- Select: "No, my app does not contain ads"

#### Content Rating
1. Click **"Start questionnaire"**
2. Select **"Productivity"** category
3. Answer all questions (all should be "No" for violence, mature content, etc.)
4. Submit for rating (should get "Everyone" rating)

#### Target Audience
- **Age groups:** 13+ (or "All ages" if appropriate)
- **Appeal to children:** No

#### News App
- Select: "No, this is not a news app"

#### COVID-19 Contact Tracing
- Select: "No"

#### Data Safety
1. Click **"Start"**
2. **Data collection and security:**
   - "Yes, we collect or share user data"
3. **Data types collected:**
   - Personal info: Name, Email address, Phone number
   - App activity: App interactions
4. **Data usage:**
   - App functionality
   - Account management
5. **Data sharing:**
   - No data shared with third parties
6. **Data security:**
   - Data is encrypted in transit
   - Data is encrypted at rest
   - Users can request data deletion
7. Submit the form

#### Government Apps
- Select: "No"

### Step 5: Set Up Pricing and Distribution

Navigate to **"Policy" → "Pricing and distribution"**:

#### Countries/Regions
- Select: "Add countries/regions"
- Choose: **All countries** (or select specific ones)

#### Pricing
- Select: **Free**
- Note: "Contains in-app purchases" (will be configured later)

#### Content Guidelines
- Check: "My app complies with Google Play's content guidelines"

#### US Export Laws
- Check: "My app complies with US export laws"

#### Save

### Step 6: Configure In-App Products (Subscriptions)

Navigate to **"Monetize" → "Subscriptions"**:

#### Create Lite Subscription
1. Click **"Create subscription"**
2. **Product ID:** `lite_monthly`
3. **Name:** Lite Plan
4. **Description:** Up to 50 events and 100 participants per event
5. **Billing period:** 1 month
6. **Price:** $4.99 USD
7. **Free trial:** 14 days
8. **Save and activate**

#### Create Lite Annual Subscription
1. Click **"Create subscription"**
2. **Product ID:** `lite_annual`
3. **Name:** Lite Plan (Annual)
4. **Description:** Up to 50 events and 100 participants per event - Save $10/year
5. **Billing period:** 12 months
6. **Price:** $49.00 USD
7. **Free trial:** 14 days
8. **Save and activate**

#### Create Pro Subscription
1. Click **"Create subscription"**
2. **Product ID:** `pro_monthly`
3. **Name:** Pro Plan
4. **Description:** Unlimited events and participants with priority support
5. **Billing period:** 1 month
6. **Price:** $7.99 USD
7. **Free trial:** 14 days
8. **Save and activate**

#### Create Pro Annual Subscription
1. Click **"Create subscription"**
2. **Product ID:** `pro_annual`
3. **Name:** Pro Plan (Annual)
4. **Description:** Unlimited events and participants with priority support - Save $16/year
5. **Billing period:** 12 months
6. **Price:** $79.00 USD
7. **Free trial:** 14 days
8. **Save and activate**

### Step 7: Upload Production APK/AAB

**Note:** We'll build this together in the next step.

1. Navigate to **"Release" → "Production"**
2. Click **"Create new release"**
3. Upload the AAB file (Android App Bundle)
4. **Release name:** 1.0.0
5. **Release notes:** (Copy from `google-play-listing.md` - "What's New" section)
   ```
   🎉 Welcome to GatherSync!

   • Smart calendar with availability heatmap
   • Flexible and fixed event types
   • Import participants from contacts
   • Cloud sync across devices
   • Venue search with Google Maps
   • Attendance tracking
   • 3-tier subscription system with 14-day free trials
   • Share events via any messaging app
   • Works on mobile and web
   ```
6. Click **"Save"**

### Step 8: Review and Publish

1. Go to **"Publishing overview"**
2. Check that all sections have green checkmarks
3. Common issues to fix:
   - Missing content rating
   - Incomplete data safety form
   - Missing privacy policy
   - Missing app icon or screenshots
4. Once everything is complete, click **"Send for review"**
5. Review takes 3-7 days typically

---

## 📱 Building the Production APK/AAB

**We'll do this together in the next step.** The process involves:

1. Configure app signing in Google Play Console
2. Build the Android App Bundle (AAB) using Expo EAS
3. Download the AAB file
4. Upload to Google Play Console

---

## ⏱️ Timeline

- **Account verification:** 1-3 days (waiting for Android device access)
- **Store listing setup:** 1-2 hours (can do now)
- **Build APK/AAB:** 30-60 minutes (need to do together)
- **Google review:** 3-7 days after submission
- **Total:** ~1-2 weeks from start to live

---

## 🎯 Current Status

✅ **Completed:**
- Store listing text written
- Screenshots generated (4 images)
- Feature graphic created
- App icon created
- Privacy policy URL ready
- Subscription pricing defined

⏳ **Next Steps:**
1. Complete Android device verification with Mike's phone
2. Build production APK/AAB file
3. Complete store listing in Play Console
4. Configure subscriptions
5. Upload APK/AAB
6. Submit for review

---

## 📞 Support

If you run into issues during submission:
- Google Play Console Help: https://support.google.com/googleplay/android-developer
- Email me at: hello@gathersync.app (once email forwarding is set up)
- Or continue our conversation here!

---

## 🔗 Important Links

- Google Play Console: https://play.google.com/console
- GatherSync Website: https://gathersync.app
- Privacy Policy: https://gathersync.app/privacy
- Terms of Service: https://gathersync.app/terms

---

**Ready to proceed?** Let me know when you have access to Mike's Android phone, and we'll complete the account verification and build the production APK!
