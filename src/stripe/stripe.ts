import Stripe from "stripe";

let _stripe: Stripe | null = null;

// Lazy singleton — only instantiated on first use so importing this module
// during build/doc generation doesn't require STRIPE_SECRET_KEY to be set.
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY env var not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}
