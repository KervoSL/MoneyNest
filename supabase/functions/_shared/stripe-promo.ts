// ════════════════════════════════════════════════════════════════
// Validación REAL de códigos promocionales / cupones de Stripe.
// Compartido entre validate-promo-code y create-payment-intent para
// no duplicar lógica ni arriesgar que ambos endpoints diverjan.
//
// IMPORTANTE: esta validación se ejecuta SIEMPRE server-side, con la
// clave secreta de Stripe. Nunca se confía en un "código aplicado" que
// venga solo del frontend — el frontend puede pedir que se aplique un
// código, pero es este módulo el que decide si es realmente válido.
// ════════════════════════════════════════════════════════════════

import Stripe from 'npm:stripe@14';

export type PromoInvalidReason = 'invalid' | 'expired' | 'not_applicable' | 'exhausted';

export interface PromoValidationResult {
  valid: boolean;
  reason?: PromoInvalidReason;
  promotionCodeId?: string;
  couponId?: string;
  percentOff?: number | null;
  amountOff?: number | null;
  currency?: string | null;
}

/**
 * Busca el promotion code exacto en Stripe y comprueba que esté
 * realmente activo, sin expirar y con canjes disponibles.
 * `code` se compara tal cual lo tiene Stripe (los promotion codes de
 * Stripe son case-sensitive por diseño).
 */
export async function validatePromoCode(
  stripe: Stripe,
  code: string,
): Promise<PromoValidationResult> {
  const trimmed = (code || '').trim();
  if (!trimmed) return { valid: false, reason: 'invalid' };

  const list = await stripe.promotionCodes.list({
    code: trimmed,
    active: true,
    limit: 1,
    expand: ['data.coupon'],
  });
  const promo = list.data[0];
  if (!promo) return { valid: false, reason: 'invalid' };

  // Expiración explícita del promotion code (además de coupon.valid,
  // que Stripe ya calcula, comprobamos esto aparte para poder devolver
  // el motivo exacto — 'expired' en vez de un generico 'invalid').
  if (promo.expires_at && promo.expires_at * 1000 < Date.now()) {
    return { valid: false, reason: 'expired' };
  }
  if (
    typeof promo.max_redemptions === 'number' &&
    promo.times_redeemed >= promo.max_redemptions
  ) {
    return { valid: false, reason: 'exhausted' };
  }

  const coupon = promo.coupon as Stripe.Coupon | null;
  if (!coupon || coupon.valid === false) {
    return { valid: false, reason: 'not_applicable' };
  }

  return {
    valid: true,
    promotionCodeId: promo.id,
    couponId: coupon.id,
    percentOff: coupon.percent_off ?? null,
    amountOff: coupon.amount_off ?? null,
    currency: coupon.currency ?? null,
  };
}

/** Calcula el descuento en la misma unidad que originalAmount (centavos). */
export function computeDiscount(originalAmount: number, result: PromoValidationResult) {
  let discountAmount = 0;
  if (result.percentOff) {
    discountAmount = Math.round(originalAmount * (result.percentOff / 100));
  } else if (typeof result.amountOff === 'number') {
    discountAmount = Math.min(result.amountOff, originalAmount);
  }
  const finalAmount = Math.max(0, originalAmount - discountAmount);
  return { discountAmount, finalAmount };
}
