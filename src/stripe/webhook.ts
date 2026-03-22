import Stripe from "stripe";
import { RequestHandler } from "express";
import { getStripe } from "./stripe";
import { membershipApi } from "../membership/membership";
import { donationsApi } from "../donations/donations";
import { adminOnlyDb } from "../db/db";

const membership = membershipApi(adminOnlyDb);
const donations = donationsApi(adminOnlyDb);

export const stripeWebhookHandler: RequestHandler = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).send("Missing stripe-signature header");
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
    return;
  }

  try {
    if (
      event.type.startsWith("checkout.session") ||
      event.type.startsWith("customer.subscription") ||
      event.type.startsWith("invoice")
    ) {
      await membership.handleWebhookEvent(event);
    }

    // Donation checkout completed
    if (
      event.type === "checkout.session.completed" &&
      (event.data.object as Stripe.Checkout.Session).metadata?.type === "donation"
    ) {
      await donations.handleDonationWebhook(event.data.object as Stripe.Checkout.Session);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).send(`Webhook processing failed: ${(err as Error).message}`);
  }
};
