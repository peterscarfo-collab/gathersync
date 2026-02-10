# Migration to InstantDB - Step by Step Guide

This document guides you through completing the migration from MySQL/Drizzle to InstantDB.

## ✅ Completed Steps

1. ✅ Created InstantDB schema (`instant.schema.ts`)
2. ✅ Created InstantDB permissions (`instant.perms.ts`)
3. ✅ Added InstantDB dependencies to package.json
4. ✅ Created client and admin DB instances (`lib/db.ts`, `lib/admin-db.ts`)
5. ✅ Rewrote `server/db.ts` to use InstantDB admin client
6. ✅ Updated tRPC routers to use string IDs instead of numeric IDs
7. ✅ Removed MySQL, Drizzle, and related dependencies
8. ✅ Updated environment variable configuration
9. ✅ Created README with new setup instructions

## 🔄 Next Steps

### 1. Set up InstantDB Account

1. Go to [instantdb.com](https://instantdb.com)
2. Create a new app (or use existing if you have one)
3. Copy your **App ID** and **Admin Token**

### 2. Push Schema to InstantDB

```bash
# Install InstantDB CLI if needed
npm install -g @instantdb/cli

# Login to InstantDB
instant-cli login

# Push your schema
instant-cli push-schema --app YOUR_APP_ID
```

When prompted, the CLI will read `instant.schema.ts` and `instant.perms.ts` from your project root.

### 3. Update Environment Variables

Update your `.env` file with the InstantDB credentials:

```bash
INSTANT_APP_ID=your_app_id_here
INSTANT_APP_ADMIN_TOKEN=your_admin_token_here
EXPO_PUBLIC_INSTANT_APP_ID=your_app_id_here
```

### 4. Install Dependencies

Since we modified package.json, reinstall dependencies:

```bash
# Remove node_modules if you have permission issues
rm -rf node_modules .pnpm-store

# Install fresh
pnpm install
```

### 5. Test the Migration

Start the development server:

```bash
pnpm dev
```

This should start:
- Backend server on http://localhost:3000
- Expo Metro bundler on http://localhost:8082

Test the following:
- [ ] User authentication works
- [ ] Can create events
- [ ] Can add participants
- [ ] Can view events list
- [ ] Real-time updates work (open same event in two tabs)

### 6. Data Migration (if you have existing data)

If you have existing data in MySQL that you need to migrate:

#### Option A: Manual Migration Script

Create a migration script that:
1. Reads data from MySQL
2. Transforms it to InstantDB format
3. Uses `adminDb.transact()` to insert data

#### Option B: Export/Import

1. Export data from MySQL as JSON
2. Create a seed script using InstantDB admin client
3. Run the seed script to populate InstantDB

Example seed script:

```typescript
import { adminDb, tx, id } from './lib/admin-db';

async function seedData() {
  // Example: Create a user
  const userId = id();
  await adminDb.transact([
    tx.$users[userId].update({
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
      subscriptionTier: 'free',
      subscriptionStatus: 'active',
      createdAt: new Date(),
    }),
  ]);

  // Example: Create an event for that user
  const eventId = id();
  await adminDb.transact([
    tx.events[eventId].update({
      name: 'Team Meeting',
      eventType: 'flexible',
      month: 2,
      year: 2026,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).link({ creator: userId }),
  ]);
}

seedData().catch(console.error);
```

### 7. Update Fly.io Deployment

Update your Fly.io secrets with InstantDB credentials:

```bash
fly secrets set INSTANT_APP_ID=your_app_id_here
fly secrets set INSTANT_APP_ADMIN_TOKEN=your_admin_token_here
fly secrets set EXPO_PUBLIC_INSTANT_APP_ID=your_app_id_here
```

Remove old MySQL secrets:

```bash
fly secrets unset DATABASE_URL
```

### 8. Deploy

Deploy to Fly.io:

```bash
fly deploy
```

## 🎯 Key Differences from MySQL/Drizzle

### User IDs
- **Before**: Numeric auto-increment IDs (`id: number`)
- **After**: String UUIDs from InstantDB auth (`id: string`)

All references to `ctx.user.id` now return strings.

### Queries
- **Before**: Drizzle ORM queries with `select()`, `where()`, etc.
- **After**: InstantDB queries with nested objects

Example:
```typescript
// Before (Drizzle)
await db.select().from(events).where(eq(events.userId, userId))

// After (InstantDB)
await adminDb.query({
  events: {
    $: {
      where: {
        'creator.id': userId,
      },
    },
  },
})
```

### Transactions
- **Before**: Drizzle transactions with `db.transaction()`
- **After**: InstantDB transactions with `adminDb.transact([...])`

Example:
```typescript
// Before (Drizzle)
await db.insert(events).values(data)

// After (InstantDB)
await adminDb.transact([
  tx.events[eventId].update(data).link({ creator: userId }),
])
```

### Real-time Updates
InstantDB provides real-time subscriptions out of the box:

```typescript
// Client-side (React component)
import { db } from '@/lib/db';

function EventsList() {
  const { data } = db.useQuery({
    events: {
      $: {
        where: {
          'creator.id': userId,
        },
      },
    },
  });

  // data.events will automatically update in real-time!
  return <div>{/* render events */}</div>;
}
```

## 🐛 Troubleshooting

### "Cannot find module '@instantdb/react'"

Make sure you've installed dependencies:
```bash
pnpm install
```

### "Invalid App ID"

Double-check your `.env` file has the correct `INSTANT_APP_ID`.

### "Permission denied" errors

Check `instant.perms.ts` - make sure the permissions match your use case.

### Schema mismatch errors

Run `instant-cli push-schema` again to sync your schema with InstantDB.

## 📚 Resources

- [InstantDB Docs](https://instantdb.com/docs)
- [InstantDB Schema Guide](https://instantdb.com/docs/schema)
- [InstantDB Permissions Guide](https://instantdb.com/docs/permissions)
- [InstantDB React Hooks](https://instantdb.com/docs/react)

## ✅ Verification Checklist

Before deploying to production, verify:

- [ ] InstantDB schema pushed successfully
- [ ] Environment variables set correctly
- [ ] Authentication works (sign in/out)
- [ ] CRUD operations work for all entities
- [ ] Real-time updates work correctly
- [ ] Permissions enforce access control
- [ ] Stripe integration still works
- [ ] Push notifications still work
- [ ] Fly.io deployment successful
- [ ] Web app builds and deploys correctly

## 🎉 Benefits of InstantDB

- ✅ **No more session management** - InstantDB handles auth
- ✅ **Real-time sync** - No more polling or manual refresh
- ✅ **Serverless-friendly** - No connection pooling needed
- ✅ **Type-safe** - Full TypeScript support
- ✅ **No migrations** - Schema changes are automatic
- ✅ **Built-in permissions** - Row-level security
- ✅ **Simpler deployment** - No separate database server needed
