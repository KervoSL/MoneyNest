// ════════════════════════════════════════════════════════════════
// validate-promo-code
// Valida un código promocional REAL de Stripe (promotion codes) y
// devuelve el descuento resultante, sin crear ni modificar ningún
// PaymentIntent/Subscription. Pensado para que el frontend pueda
// mostrar "código aplicado / descuento / precio final" en cuanto el
// usuario pulsa "Aplicar", antes de proceder al pago.
// ════════════════════════════════════════════════════════════════

import Stripe from 'npm:stripe@14';
import { validatePromoCode, computeDiscount } from '../_shared/stripe-promo.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-04-10',
});

const PRICE_LOCAL = 'price_1TTJCBFWll222Kpazyvo4A4W';
const PRICE_PRO   = 'price_1TTJD3FWll222KpaJ1T6OG6C';
const ALLOWED_PRICES = new Set([PRICE_LOCAL, PRICE_PRO]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  let code: string, priceId: string;
  try {
    const body = await req.json();
    code    = body.code    ?? '';
    priceId = body.priceId ?? '';
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!ALLOWED_PRICES.has(priceId)) return json({ error: 'invalid_price' }, 400);
  if (!code || !code.trim())        return json({ valid: false, reason: 'invalid' });

  try {
    const result = await validatePromoCode(stripe, code);
    if (!result.valid) {
      return json({ valid: false, reason: result.reason });
    }

    const price = await stripe.prices.retrieve(priceId);
    const originalAmount = price.unit_amount ?? 0;
    const { discountAmount, finalAmount } = computeDiscount(originalAmount, result);

    return json({
      valid: true,
      code: code.trim(),
      promotionCodeId: result.promotionCodeId,
      percentOff: result.percentOff,
      amountOff: result.amountOff,
      originalAmount,
      discountAmount,
      finalAmount,
      currency: price.currency,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'stripe_error' }, 500);
  }
});
