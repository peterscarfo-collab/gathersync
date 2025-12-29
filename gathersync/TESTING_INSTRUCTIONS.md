# GatherSync - Testing Instructions for Mike

## Overview
GatherSync is now ready for multi-user testing. Cloud sync is working - events, participants, and RSVPs sync between devices.

## Setup Instructions for Mike (Android)

### Step 1: Install Expo Go
1. Open **Google Play Store** on your Android phone
2. Search for **"Expo Go"**
3. Install the app

### Step 2: Open GatherSync
**Option A: Scan QR Code**
- Open Expo Go
- Tap "Scan QR code"
- Scan the QR code Peter shows you

**Option B: Enter URL Manually**
- Open Expo Go
- Tap "Enter URL manually"
- Enter: `https://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer`
- Tap "Connect"

### Step 3: Log In
1. You'll see "Cloud Sync Available" banner
2. Tap **"Log In"**
3. Create an account or use OAuth (Google/GitHub)
4. After login, you'll be redirected back to the app

### Step 4: Sync Events
1. You should see "Cloud sync enabled" banner
2. Tap **"Sync Now"**
3. Wait 10-20 seconds (it will say "Syncing...")
4. You should see **2 events appear:**
   - AI Guys
   - Guru Breakfast
5. Both events should show participants with phone numbers

### Step 5: Test RSVP
1. Tap on **AI Guys** event
2. Find your name in the participants list
3. Tap on your name
4. Tap **"Attending"** or **"Not Attending"**
5. Go back to events list
6. Tap **"Sync Now"** to sync your RSVP to the cloud

### Step 6: Verify with Peter
1. Peter should tap "Sync Now" on his iPhone
2. Peter should see your RSVP update in the AI Guys event
3. This confirms bidirectional sync is working!

## Known Issues
- Sync says "Uploaded 2" every time even when nothing changed (inefficient but harmless)
- First sync after login takes 15-20 seconds (subsequent syncs are faster)

## What to Test
✅ Events appear after sync
✅ Participants show correctly with phone numbers
✅ RSVP changes sync between devices
✅ Data persists after closing and reopening the app
✅ Multiple users can see the same events

## Success Criteria
- Mike can see Peter's events (AI Guys, Guru Breakfast)
- Mike can RSVP to events
- Peter can see Mike's RSVP updates after syncing
- No errors or crashes during sync

---

**If you encounter any issues, take a screenshot and share with Peter.**
