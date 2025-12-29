# GatherSync on iPad - Setup Guide

## Quick Setup (3 Steps)

### Step 1: Install Expo Go on iPad
1. Open **App Store** on your iPad
2. Search for **"Expo Go"**
3. Install the Expo Go app (free)

### Step 2: Open GatherSync
Choose ONE of these methods:

#### Method A: Scan QR Code (Easiest)
1. Open **Expo Go** app on iPad
2. Tap **"Scan QR Code"** button
3. Point camera at the QR code (attached)
4. GatherSync will load automatically

#### Method B: Enter URL Manually
1. Open **Expo Go** app on iPad
2. Tap **"Enter URL manually"** at the bottom
3. Type or paste this URL:
   ```
   exp://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer
   ```
4. Tap **"Connect"**

#### Method C: Email Link
1. Email yourself this link from your iPhone
2. Open the email on your iPad
3. Tap the link - it will open in Expo Go automatically
   ```
   exp://8081-ienb1rj930k0x92csc3x6-a41ba8ee.manus-asia.computer
   ```

### Step 3: Log In
1. Once GatherSync loads, tap **"Log In"** button
2. Sign in with the same account you use on iPhone
3. Your events will automatically sync from cloud

---

## Troubleshooting

### "Unable to connect to server"
- Make sure your iPad is on the **same WiFi network** as your iPhone
- Try reloading: shake iPad and tap "Reload"

### "No events showing"
- Make sure you logged in with the same account as iPhone
- Tap the sync status indicator at top of Events screen
- Wait a few seconds for cloud sync to complete

### QR code won't scan
- Make sure there's good lighting
- Try Method B (manual URL entry) instead

### App shows blank screen
- Shake iPad to open developer menu
- Tap "Reload"
- If still blank, close Expo Go completely and reopen

---

## Testing Cross-Device Sync

Once GatherSync is running on both devices:

1. **On iPhone**: Change an RSVP status or add a participant
2. **On iPad**: Pull down to refresh the Events list
3. **Verify**: Changes should appear on iPad within a few seconds

The sync status indicator at the top shows:
- 🔄 **Syncing...** - Upload/download in progress
- ✅ **Synced** - All data up to date
- 📡 **Offline** - No internet connection
- ⚠️ **Error** - Sync failed (tap to retry)

---

## Need Help?

If you're still having trouble:
1. Make sure dev server is running (check that your iPhone can still access the app)
2. Try closing Expo Go completely on iPad and reopening
3. Try the manual URL method if QR code doesn't work
4. Check that both devices are on same WiFi network
