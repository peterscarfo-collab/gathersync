# Post-Migration Checklist

## ✅ Migration Complete

All code changes have been completed! Here's what was done:

### Database Migration
- [x] Created InstantDB schema (`instant.schema.ts`)
- [x] Created InstantDB permissions (`instant.perms.ts`)
- [x] Created client DB instance (`lib/db.ts`)
- [x] Created admin DB instance (`lib/admin-db.ts`)
- [x] Rewrote all database operations in `server/db.ts`
- [x] Removed Drizzle schema files
- [x] Removed MySQL dependencies

### Code Updates
- [x] Updated `server/routers.ts` to use string user IDs
- [x] Updated `server/_core/context.ts` with new User type
- [x] Updated `server/_core/env.ts` with InstantDB config
- [x] Updated `package.json` dependencies
- [x] Created `.env.example` with new variables
- [x] Created `README.md` with new setup instructions
- [x] Created `MIGRATION_GUIDE.md` with detailed steps

## 🔄 Next: Setup Steps

You need to complete these setup steps before the app will work:

### 1. Create InstantDB Account ⏱️ 3 minutes

1. Go to https://instantdb.com
2. Sign up or log in
3. Click "Create new app"
4. Copy your App ID and Admin Token

### 2. Update Environment Variables ⏱️ 1 minute

Edit your `.env` file (or create it from `.env.example`):

```bash
# Required for InstantDB
INSTANT_APP_ID=your_app_id_from_instantdb
INSTANT_APP_ADMIN_TOKEN=your_admin_token_from_instantdb
EXPO_PUBLIC_INSTANT_APP_ID=your_app_id_from_instantdb

# Keep these from your existing setup
APP_ID=your_existing_app_id
SESSION_SECRET=your_existing_session_secret
GOOGLE_CLIENT_ID=your_existing_google_client_id
GOOGLE_CLIENT_SECRET=your_existing_google_client_secret
```

### 3. Push Schema to InstantDB ⏱️ 2 minutes

```bash
# Install InstantDB CLI globally
npm install -g @instantdb/cli

# Login to InstantDB
npx instant-cli login

# Push your schema (this reads instant.schema.ts and instant.perms.ts)
npx instant-cli push-schema --app YOUR_APP_ID
```

### 4. Install Dependencies ⏱️ 3-5 minutes

```bash
# If you have permission errors with node_modules, run:
sudo rm -rf node_modules .pnpm-store

# Install all dependencies
pnpm install
```

**Note**: You may see warnings about `@instantdb/react` and `@instantdb/admin` until you run `pnpm install`.

### 5. Test Locally ⏱️ 5 minutes

```bash
# Start the dev server
pnpm dev
```

This should start:
- Backend server on http://localhost:3000
- Expo Metro bundler on http://localhost:8082

Open http://localhost:8082 in your browser and test:

- [ ] Sign in works
- [ ] Can create an event
- [ ] Can add participants
- [ ] Can view events list
- [ ] Data persists after page refresh

### 6. Deploy to Fly.io ⏱️ 5 minutes

```bash
# Set new secrets
fly secrets set \
  INSTANT_APP_ID=your_app_id \
  INSTANT_APP_ADMIN_TOKEN=your_admin_token \
  EXPO_PUBLIC_INSTANT_APP_ID=your_app_id

# Remove old MySQL secret
fly secrets unset DATABASE_URL

# Deploy
fly deploy
```

## 🐛 Common Issues

### Issue: "Cannot find module '@instantdb/react'"
**Solution**: Run `pnpm install` to install the new dependencies.

### Issue: "Invalid App ID"
**Solution**: 
1. Check your `.env` file
2. Make sure `INSTANT_APP_ID` is set correctly
3. Restart the dev server

### Issue: "Schema not found"
**Solution**: Run `npx instant-cli push-schema --app YOUR_APP_ID` to push your schema.

### Issue: TypeScript errors about User type
**Solution**: 
1. The User type is now defined in `server/_core/context.ts`
2. User IDs are now strings instead of numbers
3. Run `pnpm check` to verify TypeScript is happy

### Issue: Permission denied when accessing node_modules
**Solution**:
```bash
# Option 1: Remove with sudo
sudo rm -rf node_modules .pnpm-store

# Option 2: Change ownership
sudo chown -R $(whoami) node_modules .pnpm-store

# Then reinstall
pnpm install
```

## 📊 Verification

After completing setup, verify everything works:

### Local Development
- [ ] `pnpm dev` runs without errors
- [ ] Backend server starts on port 3000
- [ ] Expo Metro starts on port 8082
- [ ] No TypeScript errors (`pnpm check`)
- [ ] Can access http://localhost:8082

### Authentication
- [ ] Sign in works
- [ ] Sign out works
- [ ] User data persists

### Database Operations
- [ ] Can create events
- [ ] Can view events
- [ ] Can update events
- [ ] Can delete events
- [ ] Can add participants
- [ ] Can update participant availability
- [ ] Can create snapshots
- [ ] Can create templates

### Real-time Features (NEW!)
- [ ] Open same event in two browser tabs
- [ ] Update availability in one tab
- [ ] See update instantly in other tab

### Production Deployment
- [ ] Fly.io deployment succeeds
- [ ] App runs in production
- [ ] Authentication works in production
- [ ] Database operations work in production

## 📚 Documentation

Refer to these documents for more information:

- `README.md` - General setup and usage
- `MIGRATION_GUIDE.md` - Detailed migration steps
- `MIGRATION_COMPLETE.md` - What changed and why
- `.env.example` - Environment variable template

## 🎉 Success!

Once you've completed all the setup steps and verified everything works, your app is successfully migrated to InstantDB!

Key improvements:
- ✅ No more MySQL connection issues
- ✅ No more session management problems
- ✅ Real-time updates work automatically
- ✅ Simpler deployment (no separate database)
- ✅ Better developer experience
- ✅ Matches the working poetrypays architecture

Enjoy your newly upgraded app! 🚀
