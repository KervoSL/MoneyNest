'use strict';

const MNStripeConfig = Object.freeze({
  publishableKey: 'pk_live_51T57NbFWll222Kpac9uR0087YoUUATVJCxRg3TzYSC7y0EacJnpooDne5ty7vZOEGrkqA35mj6Rf5unOsDiMzBlp00h0Q8bEJt',
  prices: {
    local: 'price_1TTJCBFWll222Kpazyvo4A4W',  // MoneyNest 7,99€ pago único
    pro:   'price_1TTJD3FWll222KpaJ1T6OG6C',  // Sync en la nube 3€/año
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
