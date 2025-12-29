/**
 * Setup new pricing structure in Stripe
 * Creates Lite and Pro products with monthly and annual pricing
 */

import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51Jyi16QdyRdop1CxHE03bXgJlSmyI4au35zek3nc1NLEqTu94ACq5RGATVbLMoJFwDLXsK65rkZZ0hsYtWZTH1Nb00me0hkJux', {
  apiVersion: '2025-12-15.clover' as any,
});

async function setupPricing() {
  try {
    console.log('Creating Lite tier product...');
    
    // Create Lite product
    const liteProduct = await stripe.products.create({
      name: 'GatherSync Lite',
      description: 'Perfect for casual event planners - up to 50 events per month',
    });
    
    // Create Lite monthly price
    const liteMonthly = await stripe.prices.create({
      product: liteProduct.id,
      unit_amount: 499, // $4.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });
    
    // Create Lite annual price (2 months free: $49 instead of $59.88)
    const liteAnnual = await stripe.prices.create({
      product: liteProduct.id,
      unit_amount: 4900, // $49
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
    });
    
    console.log('✅ Lite tier created:');
    console.log('  Product ID:', liteProduct.id);
    console.log('  Monthly Price ID:', liteMonthly.id);
    console.log('  Annual Price ID:', liteAnnual.id);
    
    console.log('\nCreating Pro tier product...');
    
    // Create Pro product
    const proProduct = await stripe.products.create({
      name: 'GatherSync Pro',
      description: 'For power users - unlimited events and all premium features',
    });
    
    // Create Pro monthly price
    const proMonthly = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 799, // $7.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });
    
    // Create Pro annual price (2 months free: $79 instead of $95.88)
    const proAnnual = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 7900, // $79
      currency: 'usd',
      recurring: {
        interval: 'year',
      },
    });
    
    console.log('✅ Pro tier created:');
    console.log('  Product ID:', proProduct.id);
    console.log('  Monthly Price ID:', proMonthly.id);
    console.log('  Annual Price ID:', proAnnual.id);
    
    console.log('\n📋 Summary - Add these to your code:');
    console.log('\nLite Tier:');
    console.log(`  STRIPE_LITE_MONTHLY_PRICE_ID: ${liteMonthly.id}`);
    console.log(`  STRIPE_LITE_ANNUAL_PRICE_ID: ${liteAnnual.id}`);
    console.log('\nPro Tier:');
    console.log(`  STRIPE_PRO_MONTHLY_PRICE_ID: ${proMonthly.id}`);
    console.log(`  STRIPE_PRO_ANNUAL_PRICE_ID: ${proAnnual.id}`);
    
  } catch (error) {
    console.error('❌ Error setting up pricing:', error);
    process.exit(1);
  }
}

setupPricing();
