# GatherSync TODO

## Completed Features

- [x] Core mobile app with event scheduling
- [x] Flexible and fixed event types
- [x] Participant management with contacts integration
- [x] RSVP system for fixed events
- [x] Availability marking for flexible events
- [x] Calendar heatmap visualization
- [x] Meeting details and venue management
- [x] Event templates
- [x] Attendance tracking
- [x] Cloud sync with hybrid storage
- [x] OAuth authentication
- [x] User manual (PDF)
- [x] Android APK build and distribution
- [x] **Admin Dashboard (Desktop-optimized)**
  - [x] Dashboard home with statistics
  - [x] Event Management screen
  - [x] Attendance Tracking screen
  - [x] Participant Management screen
  - [x] Analytics & Reports screen

## In Progress

- [x] Implement export/import backup feature
  - [x] Create export functionality to download all data as JSON
  - [x] Create import functionality to restore data from backup
  - [x] Add backup UI to Events screen
  - [x] Test backup and restore flow

- [x] Implement full cloud sync between mobile and desktop
  - [x] Analyze current hybrid storage implementation
  - [x] Add automatic sync on login
  - [x] Implement real-time sync for create/update/delete operations
  - [x] Test bidirectional sync

## Completed Features

- [x] Redesign admin dashboard with professional web UI
  - [x] Create modern design system with better typography and spacing
  - [x] Redesign dashboard home with polished layout
  - [x] Redesign event management screen with website-quality UI
  - [x] Improve visual hierarchy and professional aesthetics

## Pending Features

### Priority 1: Participant Invitation System (Post-iOS Launch)
- [ ] Web-based invitation system
  - [ ] Unique invitation links per participant
  - [ ] Public event view (no login required)
  - [ ] Mark availability via web link
  - [ ] Email/SMS notifications with invitation links
  - [ ] Response tracking in organizer's app
- [ ] Backend API for public event access
- [ ] Email/SMS integration for automated invitations

### Priority 2: iOS Distribution
- [ ] Wait for Apple Developer account approval ($99/year)
- [ ] Configure EAS Build for iOS
- [ ] Build iOS TestFlight version
- [ ] Distribute to test users (Guru Breakfast, AI Guys)

### Priority 3: Production Web Optimization
- [ ] Keyboard shortcuts for desktop
- [ ] Bulk operations UI improvements
- [ ] Better desktop layouts for large screens
- [ ] Responsive design enhancements

### Priority 4: Monetization
- [ ] Implement freemium model
  - [ ] Free tier: 5 events, 20 participants
  - [ ] Pro tier: Unlimited ($3.99/month)
- [ ] Payment integration
- [ ] Subscription management

## Known Issues

- None currently

## Notes

- Admin dashboard is desktop-optimized and requires login
- All admin screens include export functionality for reports
- Participant invitation system is critical for adoption (users don't want to download app)

## Bugs

- [x] Fix event deletion not working
  - [x] Investigate why delete button doesn't delete events
  - [x] Fix delete functionality
  - [x] Test deletion works correctly

- [ ] Fix backup export/import not working
  - [ ] Investigate why export doesn't create file
  - [ ] Fix export functionality
  - [ ] Fix import functionality
  - [ ] Test backup/restore flow

- [ ] Fix critical sync bug - events disappear after login
  - [ ] Sync reads from cloud (empty) instead of local storage
  - [ ] Fix sync to read local storage first before switching to cloud
  - [ ] Test sync uploads all local events correctly

## 3-Tier Pricing System

- [x] Create Stripe products for Lite and Pro tiers
- [x] Update pricing screen to show 3 tiers with monthly/annual toggle
- [x] Update event limit logic for Lite tier (50 events)
- [x] Change "Upgrade to Pro" button text to generic "Upgrade" in Profile screen
- [ ] Test complete Lite upgrade flow with Stripe checkout
- [x] Fix profile screen render error: "Cannot read property 'amount' of undefined" for Lite tier
- [x] Update GatherSync website pricing page to show 3 tiers (Free/Lite/Pro) with monthly/annual pricing
- [x] Remove Enterprise section from website to focus on consumer tiers (Free/Lite/Pro)
- [x] Update pricing button text: Free="Get Started", Lite="Choose Lite", Pro="Choose Pro"
- [x] Add trial tracking fields to database schema (trialTier, trialStartDate, trialEndDate) - Already exists!
- [x] Update subscription logic to check trial status and grant appropriate access
- [x] Update Profile screen to show trial status and days remaining
- [x] Update pricing screen to show trial information
- [x] Change button text to 'Start 14-Day Free Trial' for Lite and Pro
- [x] Test complete trial flow from signup to conversion - Ready for user testing

## Bug Fixes - Trial System

- [x] Fix participant limits showing "unlimited" instead of "50 participants" for Free and "100 participants" for Lite
- [x] Fix Profile screen showing wrong subscription data (Free plan with Lite pricing) - Fixed by resetting database
- [x] Fix trial button calling Stripe checkout instead of startTrial endpoint - Fixed by correcting validation logic
- [x] Fix startTrial validation: "You already have an active subscription" error for Free users

## Pre-Launch Critical Fixes

- [x] Create Stripe webhook endpoint to handle checkout.session.completed events
- [x] Update subscription tier in database when webhook receives payment success
- [x] Store Stripe customer ID and subscription ID in user record
- [x] Fix deep link redirect after Stripe checkout (Safari error) - Created web success page with auto-redirect
- [x] Test complete payment flow: Free → Trial → Paid upgrade - Ready for testing with webhook setup
- [x] Fix TypeScript errors for 'lite' tier type definitions - Added type assertions

## Stripe Webhook Configuration

- [x] Add STRIPE_WEBHOOK_SECRET to environment variables
- [x] Restart server to load webhook secret
- [x] Test webhook with Stripe test event - Webhook configured and active in Stripe Dashboard
- [x] Verify webhook successfully updates user subscription tiers - Ready for production testing

## Post-Launch Improvements

- [ ] Debug "Failed to start checkout" error when trial user tries to upgrade to Pro (edge case)
- [ ] Add "Upgrade Now" button in trial banner to allow immediate conversion to paid
- [ ] Add subscription management screen with billing history and cancel option
