// ════════════════════════════════════════════════════════════════
// validate-promo-code
// Valida un código promocional REAL de Stripe (promotion codes) y
// devuelve el descuento resultante, sin crear ni modificar ningún
// PaymentIntent/Subscription. Pensado para que el frontend pueda
// mostrar "código aplicado / descuento / precio final" en cuanto el
// usuario pulsa "Aplicar", antes de proceder al pago.
//
// Se llama SIN autenticación (antes de que exista sesion de pago) --
// por eso el rate limit aqui es por IP, no por user_id.
// ════════════════════════════════════════════════════════════════

import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const usingTestKey = !!Deno.env.get('STRIPE_SECRET_KEY_TEST');
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY_TEST') || Deno.env.get('STRIPE_SECRET_KEY') || '', {});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// CRITICAL: fallback price IDs must match whichever Stripe mode the
// active secret key belongs to (same fix as the other Stripe functions).
const PRICE_LOCAL = Deno.env.get('STRIPE_PRICE_LOCAL') || (usingTestKey ? 'price_1U5uN8FWll222KpaX0qENvX3' : 'price_1U68YVFWll222KpaCJ6WrKWg');
const PRICE_PRO   = Deno.env.get('STRIPE_PRICE_PRO')   || (usingTestKey ? 'price_1U5uNNFWll222Kpawefje59j' : 'price_1U68YaFWll222Kpa4mynzdAp');
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

// Inlined from _shared/stripe-promo.ts (deploy tool can't resolve
// relative imports) -- always validated server-side against Stripe,
// never trusting a client-claimed discount.
type PromoInvalidReason = 'invalid' | 'expired' | 'not_applicable' | 'exhausted';
interface PromoValidationResult {
  valid: boolean;
  reason?: PromoInvalidReason;
  promotionCodeId?: string;
  couponId?: string;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string | null;
}
async function validatePromoCode(stripe: Stripe, code: string): Promise<PromoValidationResult> {
  const trimmed = (code || '').trim();
  if (!trimmed) return { valid: false, reason: 'invalid' };
  const list = await stripe.promotionCodes.list({ code: trimmed, active: true, limit: 1, expand: ['data.coupon'] });
  const promo = list.data[0];
  if (!promo) return { valid: false, reason: 'invalid' };
  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) return { valid: false, reason: 'expired' };
  if (typeof promo.max_redemptions === 'number' && promo.times_redeemed >= promo.max_redemptions) return { valid: false, reason: 'exhausted' };
  const coupon = promo.coupon as Stripe.Coupon | null;
  if (!coupon || coupon.valid === false) return { valid: false, reason: 'not_applicable' };
  return { valid: true, promotionCodeId: promo.id, couponId: coupon.id, percentOff: coupon.percent_off ?? null, amountOff: coupon.amount_off ?? null, currency: coupon.currency ?? null };
}
function computeDiscount(originalAmount: number, result: PromoValidationResult) {
  let discountAmount = 0;
  if (result.percentOff) discountAmount = Math.round(originalAmount * (result.percentOff / 100));
  else if (typeof result.amountOff === 'number') discountAmount = Math.min(result.amountOff, originalAmount);
  return { discountAmount, finalAmount: Math.max(0, originalAmount - discountAmount) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'method_not_allowed' }, 405);

  // Rate limit by IP (no auth exists yet at this point in the flow) --
  // this endpoint queries Stripe on every call and has no per-user
  // identity to key on, so it's an easy target for brute-forcing codes.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
  const { data: allowed, error: rlError } = await supabase.rpc('check_rate_limit', {
    p_key: `promo-code:${ip}`,
    p_max_attempts: 15,
    p_window_seconds: 300,
  });
  if (!rlError && allowed === false) {
    return json({ valid: false, reason: 'invalid', error: 'rate_limited' }, 429);
  }

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
