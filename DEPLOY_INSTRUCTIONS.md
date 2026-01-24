# Simple Deployment Instructions for GatherSync

## Quick Deploy Guide

### Step 1: Find Your Built Files
The web app has been built and is ready in this folder:
```
/Users/peter_scarfo/dev/gathersync/dist-web
```

### Step 2: Deploy to Netlify

**Option A: Using Netlify Website (Easiest)**
1. Go to https://app.netlify.com in your web browser
2. Sign in to your Netlify account
3. Find your "GatherSync" site in the list
4. Click on it
5. Go to the "Deploys" tab
6. Look for "Deploy manually" or drag-and-drop area
7. In Finder (Mac file browser), go to: `/Users/peter_scarfo/dev/gathersync/dist-web`
8. Drag the entire `dist-web` folder into Netlify's deploy area
9. Wait for it to finish (you'll see "Published" when done)

**Option B: Using Terminal (If you prefer)**
```bash
cd /Users/peter_scarfo/dev/gathersync/dist-web
npx netlify deploy --prod --dir=.
```

### Step 3: Test
After deployment, test the edit screen:
https://app.gathersync.app/edit-meeting-details?eventId=1768871743128-8gk12or1n

---

## What Was Fixed

✅ Edit-meeting-details screen now loads events correctly
✅ Web entry point fixed (no more Metro errors)
✅ Cookie settings work for localhost
✅ URL parameters are extracted properly
✅ Events load from cloud storage if not in local storage

---

## Cursor Basics

### Finding Files in Cursor:

1. **File Explorer (Left Sidebar)**
   - Look for a folder icon on the left side of Cursor
   - If you don't see it, press `Cmd+B` (Mac) to toggle it
   - You'll see all your project files there

2. **Search for Files**
   - Press `Cmd+P` (Mac) to quickly find any file
   - Type the filename, like "edit-meeting-details"

3. **Open Terminal in Cursor**
   - Press `` Cmd+` `` (backtick key) to open/close terminal
   - This is at the bottom of the Cursor window

4. **Current Project Location**
   - Your project is at: `/Users/peter_scarfo/dev/gathersync`
   - The built files are in: `dist-web` folder inside that

---

## Need Help?

If you get stuck:
- The built files are ready in the `dist-web` folder
- You just need to upload that folder to Netlify
- The easiest way is through the Netlify website (Option A above)
