# Stripe Webhook Setup Guide

This guide explains how to configure Stripe webhooks so that subscription payments automatically update user tiers in the database.

## Why Webhooks Are Needed

When a user completes payment through Stripe Checkout, Stripe needs to notify your server so it can:
1. Update the user's subscription tier (Free → Lite or Pro)
2. Store the Stripe customer ID and subscription ID
3. Clear any trial data if upgrading from a trial

Without webhooks, payments succeed but users remain on their old tier.

## Webhook Endpoint

Your server has a webhook endpoint at:
```
https://3000-ixeurgdbu2achb4x3woqe-5903680b.sg1.manus.computer/api/webhooks/stripe
```

## Setup Steps

### 1. Go to Stripe Dashboard

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**

### 2. Configure the Endpoint

**Endpoint URL:**
```
https://3000-ixeurgdbu2achb4x3woqe-5903680b.sg1.manus.computer/api/webhooks/stripe
```

**Events to send:**
- `checkout.session.completed` (when payment succeeds)
- `customer.subscription.updated` (when subscription changes)
- `customer.subscription.deleted` (when subscription cancels)

**API version:** Use the latest version (2025-12-15 or newer)

### 3. Get the Webhook Secret

After creating the endpoint, Stripe will show you a **Signing secret** that looks like:
```
whsec_xxxxxxxxxxxxxxxxxxxxx
```

Copy this secret.

### 4. Add Secret to Environment

Add the webhook secret to your `.env` file:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

Then restart the server:
```bash
pnpm dev
```

## Testing the Webhook

### Test in Stripe Dashboard

1. Go to **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Click **Send test webhook**
4. Select `checkout.session.completed` event
5. Click **Send test webhook**

Check your server logs to see if the webhook was received.

### Test with Real Payment

1. In the GatherSync app, go to Profile → Upgrade
2. Select Lite or Pro tier
3. Click "Choose Lite" or "Choose Pro"
4. Complete payment with test card: `4242 4242 4242 4242`
5. After payment, you should be redirected back to the app
6. Check your Profile screen - your tier should be updated to Lite or Pro

### Check Server Logs

Watch the server logs for webhook events:
```bash
tail -f server/log
```

You should see:
```
[Webhook] Processing event: checkout.session.completed
[Webhook] Checkout completed: { customerId: 'cus_...', subscriptionId: 'sub_...', clientReferenceId: '1' }
[Webhook] Determined tier: lite
[Webhook] User upgraded to lite: user@example.com
```

## Troubleshooting

### Webhook Not Receiving Events

- Check that the endpoint URL is correct and accessible
- Verify the webhook secret is set in `.env`
- Check Stripe Dashboard → Webhooks → Recent deliveries for errors

### User Tier Not Updating

- Check server logs for webhook processing errors
- Verify the user has a record in the database
- Check that the price ID matches one of the configured tiers

### "Invalid webhook signature" Error

- The `STRIPE_WEBHOOK_SECRET` in `.env` doesn't match the one in Stripe Dashboard
- Copy the correct secret from Stripe Dashboard → Webhooks → Your endpoint → Signing secret

## Production Deployment

For production, you'll need to:

1. **Update the webhook URL** to your production domain:
   ```
   https://api.yourdomain.com/api/webhooks/stripe
   ```

2. **Create a new webhook endpoint** in Stripe Dashboard for production

3. **Update environment variables** with the production webhook secret

4. **Test the production webhook** before going live

## Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | User completes payment → Update to Lite or Pro tier |
| `customer.subscription.updated` | Subscription status changes → Update subscription status |
| `customer.subscription.deleted` | User cancels → Downgrade to Free tier |

## Security

- Webhook signatures are verified using the webhook secret
- Only events from Stripe with valid signatures are processed
- User IDs are passed via `client_reference_id` to prevent spoofing
