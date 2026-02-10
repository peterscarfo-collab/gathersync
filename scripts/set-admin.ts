/**
 * Set a user's role to admin by email.
 * Run with: npx tsx scripts/set-admin.ts your@email.com
 * Or set ADMIN_EMAIL in .env and run: npx tsx scripts/set-admin.ts
 */
import 'dotenv/config';
import { adminDb, tx } from '../lib/admin-db';

async function setAdmin() {
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/set-admin.ts <email>');
    console.error('   or: set ADMIN_EMAIL in .env and run npx tsx scripts/set-admin.ts');
    process.exit(1);
  }

  try {
    console.log('Looking up user by email:', email);
    const result = await adminDb.query({
      $users: {
        $: {
          where: { email },
        },
      },
    });

    const users = result?.$users ?? [];
    if (users.length === 0) {
      console.error('No user found with email:', email);
      console.error('Make sure the user has signed in at least once so they exist in the database.');
      process.exit(1);
    }

    const user = users[0];
    if ((user as any).role === 'admin') {
      console.log('User is already an admin:', email);
      process.exit(0);
    }

    await adminDb.transact([
      tx.$users[user.id].update({ role: 'admin' }),
    ]);

    console.log('✅ Set role to admin for:', email, '(id:', user.id, ')');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

setAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
