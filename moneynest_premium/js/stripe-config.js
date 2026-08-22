'use strict';

const MNStripeConfig = Object.freeze({
  // TODO(accion manual pendiente): esta es la publishable key de LIVE.
  // El backend (create-payment-intent, create-checkout) prioriza
  // STRIPE_SECRET_KEY_TEST — para que Stripe.js y el backend operen en
  // el MISMO modo, esta debe sustituirse por la publishable key de
  // TEST (pk_test_...), obtenible en Stripe Dashboard → Developers →
  // API keys con el toggle "Test mode" activo. No se puede recuperar
  // via el conector (a diferencia de los Price IDs, no es un dato de
  // solo lectura expuesto por la API).
  publishableKey: 'pk_live_51T57NbFWll222Kpac9uR0087YoUUATVJCxRg3TzYSC7y0EacJnpooDne5ty7vZOEGrkqA35mj6Rf5unOsDiMzBlp00h0Q8bEJt',
  prices: {
    local: 'price_1U6GvUFWll222KpaM0pOY3g8',  // MoneyNest Local — TEST, 6,99€ pago único
    pro:   'price_1U5uNNFWll222Kpawefje59j',  // MoneyNest Pro — TEST, 14,99€/año (recurring)
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
