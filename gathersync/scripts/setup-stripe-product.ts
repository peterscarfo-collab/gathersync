/**
 * One-time script to create GatherSync Pro product in Stripe
 * Run this once to set up the product and get the price ID
 */

import { setupGatherSyncProduct } from '../server/stripe';

async function main() {
  console.log('Setting up GatherSync Pro product in Stripe...');
  
  try {
    const { productId, priceId } = await setupGatherSyncProduct();
    
    console.log('\n✅ Success! Product created in Stripe.');
    console.log('\nAdd this to your environment variables:');
    console.log(`STRIPE_PRICE_ID=${priceId}`);
    console.log('\nProduct ID:', productId);
    console.log('Price ID:', priceId);
    console.log('\nPrice: $9.99/month');
  } catch (error) {
    console.error('❌ Failed to setup product:', error);
    process.exit(1);
  }
}

main();
