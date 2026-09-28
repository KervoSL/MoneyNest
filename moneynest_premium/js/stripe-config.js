'use strict';

const MNStripeConfig = Object.freeze({
  // LIVE mode — cobros reales. Coincide con el backend (create-checkout,
  // create-payment-intent), que usa la clave secreta LIVE al no haber
  // ninguna clave de test configurada en Supabase.
  publishableKey: 'pk_live_51T57NbFWll222Kpac9uR0087YoUUATVJCxRg3TzYSC7y0EacJnpooDne5ty7vZOEGrkqA35mj6Rf5unOsDiMzBlp00h0Q8bEJt',
  prices: {
    local: 'price_1U68YVFWll222KpaCJ6WrKWg',  // [NEEDS_STRIPE_UPDATE] MoneyNest Local — was 6,99€/año, now 0,99€/mes or 10€/año
    pro:   'price_1U68YaFWll222Kpa4mynzdAp',  // [NEEDS_STRIPE_UPDATE] MoneyNest Pro — was 14,99€/año, now 1,99€/mes or 20€/año
  },
  products: {
    local: 'prod_USDdaHgyW9lPe6',
    pro:   'prod_USDeOkWj3MryiO',
  },
  endpoints: {
    createCheckout: 'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/create-checkout',
    webhook:        'https://jwddciqqhmfkbqhdrfre.supabase.co/functions/v1/stripe-webhook',
  },
});

window.MNStripeConfig = MNStripeConfig;

const MNStripe = {
  openPayment(priceId, email) {
    if (window.MNPayment) {
      MNPayment.open(priceId, email);
    } else {
      console.error('[MNStripe] MNPayment no está disponible. Verifica que stripe-payment.js está cargado.');
    }
  },
};
window.MNStripe = MNStripe;
