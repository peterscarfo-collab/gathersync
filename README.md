# GatherSync - Group Event Scheduling App

GatherSync helps groups find the best meeting dates by visualizing availability with a heatmap.

## Tech Stack

- **Frontend**: React Native (Expo) - Cross-platform mobile & web app
- **Backend**: Express.js + tRPC - Type-safe API
- **Database**: InstantDB - Real-time, serverless database
- **Auth**: InstantDB Magic Links (or OAuth via Manus/Google)
- **Payments**: Stripe
- **Deployment**: Fly.io (backend) + Vercel/Expo (web)

## Features

- Create flexible or fixed-date events
- Manage participants and their availability
- RSVP tracking
- Event snapshots and templates
- Push notifications
- Cross-platform sync (web, iOS, Android)

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set up InstantDB

1. Go to [instantdb.com](https://instantdb.com) and create a new app
2. Copy your App ID and Admin Token
3. Push your schema:
   ```bash
   npx instant-cli push-schema --app your_app_id_here
   ```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `INSTANT_APP_ID` - Your InstantDB App ID
- `INSTANT_APP_ADMIN_TOKEN` - Your InstantDB Admin Token
- `EXPO_PUBLIC_INSTANT_APP_ID` - Same as INSTANT_APP_ID (for Expo)
- `SESSION_SECRET` - Random string for session signing
- `STRIPE_SECRET_KEY` - For subscription payments

### 4. Development

Start the development server:

```bash
pnpm dev
```

This runs:
- Backend server on `http://localhost:3000`
- Expo Metro bundler on `http://localhost:8082`

### 5. Build & Deploy

#### Backend (Fly.io)

```bash
fly deploy
```

#### Web (Expo)

```bash
pnpm build:web
```

Then deploy the `dist-web/` directory to your hosting provider.

## Database Schema

The app uses InstantDB with the following entities:

- **$users** - User accounts with subscription info
- **events** - Event/meeting data
- **participants** - Event participants with availability
- **eventSnapshots** - Saved event states
- **groupTemplates** - Reusable participant groups
- **pushTokens** - Push notification device tokens

See `instant.schema.ts` for the complete schema definition.

## Authentication

The app supports multiple authentication methods:

1. **InstantDB Magic Links** (recommended) - Passwordless email authentication
2. **Google OAuth** - Sign in with Google
3. **Manus OAuth** - Third-party OAuth service

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build backend for production
- `pnpm start` - Start production server
- `pnpm check` - Run TypeScript type checking
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests
- `pnpm build:web` - Build web app for deployment

## Project Structure

```
gathersync/
├── app/                    # React Native app screens & components
├── server/                 # Express + tRPC backend
│   ├── _core/             # Core server setup
│   ├── routers/           # tRPC route handlers
│   └── db.ts              # Database operations
├── lib/                   # Shared utilities
│   ├── db.ts              # Client-side InstantDB
│   └── admin-db.ts        # Server-side InstantDB admin
├── instant.schema.ts      # InstantDB schema definition
├── instant.perms.ts       # InstantDB permissions
└── fly.toml               # Fly.io deployment config
```

## Migration from MySQL/Drizzle

This app was recently migrated from MySQL/Drizzle to InstantDB. Key changes:

- ✅ Real-time sync instead of polling
- ✅ Built-in auth instead of complex session management
- ✅ Serverless-friendly (no connection pooling needed)
- ✅ Type-safe schema with automatic migrations
- ✅ No need for separate migration files

## License

Private - All rights reserved
