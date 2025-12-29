# GatherSync Admin SQL Commands

Use these SQL commands in the Manus Database UI to manage user subscriptions.

## How to Access Database UI

1. In Manus chat, click the **Management UI** panel on the right
2. Click **Database** tab
3. You'll see a SQL query interface

---

## View All Users

```sql
SELECT 
  id,
  email,
  name,
  subscriptionTier,
  subscriptionStatus,
  subscriptionSource,
  isLifetimePro,
  grantedBy,
  createdAt
FROM users
ORDER BY createdAt DESC;
```

---

## Find a Specific User by Email

```sql
SELECT * FROM users WHERE email = 'friend@example.com';
```

Replace `friend@example.com` with the actual email.

---

## Grant Lifetime Pro Access

```sql
UPDATE users
SET 
  subscriptionTier = 'pro',
  subscriptionStatus = 'active',
  subscriptionSource = 'admin',
  isLifetimePro = true,
  grantedBy = 'your-email@example.com',
  grantedAt = NOW(),
  updatedAt = NOW()
WHERE email = 'friend@example.com';
```

**Replace:**
- `your-email@example.com` with your admin email
- `friend@example.com` with the user's email

**Result:** User gets unlimited Pro features forever.

---

## Grant Temporary Pro Access (30 days)

```sql
UPDATE users
SET 
  subscriptionTier = 'pro',
  subscriptionStatus = 'active',
  subscriptionSource = 'admin',
  subscriptionStartDate = NOW(),
  subscriptionEndDate = DATE_ADD(NOW(), INTERVAL 30 DAY),
  grantedBy = 'your-email@example.com',
  grantedAt = NOW(),
  updatedAt = NOW()
WHERE email = 'friend@example.com';
```

**Change `30 DAY` to:**
- `7 DAY` for 1 week
- `90 DAY` for 3 months
- `365 DAY` for 1 year

---

## Revoke Pro Access (Downgrade to Free)

```sql
UPDATE users
SET 
  subscriptionTier = 'free',
  subscriptionStatus = 'active',
  subscriptionSource = 'free',
  isLifetimePro = false,
  subscriptionStartDate = NULL,
  subscriptionEndDate = NULL,
  grantedBy = NULL,
  grantedAt = NULL,
  updatedAt = NOW()
WHERE email = 'friend@example.com';
```

---

## View All Pro Subscribers

```sql
SELECT 
  email,
  name,
  subscriptionTier,
  subscriptionSource,
  isLifetimePro,
  grantedBy,
  grantedAt,
  subscriptionEndDate
FROM users
WHERE subscriptionTier = 'pro'
ORDER BY grantedAt DESC;
```

---

## View Subscription Analytics

```sql
SELECT 
  subscriptionTier,
  COUNT(*) as user_count
FROM users
GROUP BY subscriptionTier;
```

**Result shows:**
- How many Free users
- How many Pro users
- How many Enterprise users

---

## Find Users Who Need Trial

```sql
SELECT 
  email,
  name,
  subscriptionTier,
  trialUsed,
  createdAt
FROM users
WHERE 
  subscriptionTier = 'free' 
  AND trialUsed = false
  AND isLifetimePro = false
ORDER BY createdAt DESC;
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| **Grant Lifetime Pro** | `UPDATE users SET subscriptionTier='pro', isLifetimePro=true WHERE email='...'` |
| **Revoke Pro** | `UPDATE users SET subscriptionTier='free', isLifetimePro=false WHERE email='...'` |
| **Find User** | `SELECT * FROM users WHERE email='...'` |
| **View All Pro** | `SELECT * FROM users WHERE subscriptionTier='pro'` |

---

## Tips

1. **Always use email to identify users** - it's unique and easy to remember
2. **Check first, then update** - Run a SELECT query before UPDATE to verify the user exists
3. **Keep track of who you upgrade** - The `grantedBy` field records who granted access
4. **Test with your own account first** - Grant yourself Pro to test it works

---

## Example Workflow: Upgrade a Friend

1. **Find their user ID:**
   ```sql
   SELECT id, email, name, subscriptionTier FROM users WHERE email = 'friend@example.com';
   ```

2. **Grant lifetime Pro:**
   ```sql
   UPDATE users
   SET subscriptionTier = 'pro', isLifetimePro = true, 
       subscriptionSource = 'admin', grantedBy = 'peter@example.com',
       grantedAt = NOW(), updatedAt = NOW()
   WHERE email = 'friend@example.com';
   ```

3. **Verify it worked:**
   ```sql
   SELECT email, subscriptionTier, isLifetimePro FROM users WHERE email = 'friend@example.com';
   ```

4. **Tell your friend to restart the app** - They'll see "Pro (Lifetime)" in their Profile screen

---

## Troubleshooting

**Q: User still sees "Free" after I upgraded them**
- A: Tell them to close and reopen the app completely

**Q: Can I upgrade multiple users at once?**
- A: Yes! Use `IN` clause:
  ```sql
  UPDATE users SET subscriptionTier = 'pro', isLifetimePro = true
  WHERE email IN ('friend1@example.com', 'friend2@example.com', 'friend3@example.com');
  ```

**Q: How do I make myself admin?**
- A: Run:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
  ```
