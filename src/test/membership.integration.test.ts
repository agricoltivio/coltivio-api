// jest.mock is hoisted before imports by Jest
jest.mock('../stripe/stripe');

import { describe, it, expect, beforeEach, beforeAll, afterEach, jest } from '@jest/globals';
import i18next from 'i18next';
import de from '../../resources/locales/de.json';
import en from '../../resources/locales/en.json';
import itLocale from '../../resources/locales/it.json';
import fr from '../../resources/locales/fr.json';
import Stripe from 'stripe';
import { adminOnlyDb } from '../db/db';
import { getAdminDb, cleanDb, createTestUser } from './helpers';
import { createUserWithFarm } from './test-utils';
import { membershipApi } from '../membership/membership';
import { runExpiryNotifications } from '../membership/membership-expiry-cron';
import { membershipPayments, userSubscriptions, membershipExpiryNotifications, userTrials } from '../db/schema';
import * as brevo from '../brevo/brevo';
import { getStripe } from '../stripe/stripe';

// ---------------------------------------------------------------------------
// i18next initialization — email functions call getFixedT(locale)
// ---------------------------------------------------------------------------
beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.init({
      resources: {
        de: { translation: de },
        en: { translation: en },
        it: { translation: itLocale },
        fr: { translation: fr },
      },
      fallbackLng: 'de',
      preload: ['de', 'en', 'it', 'fr'],
    });
  }
});

// ---------------------------------------------------------------------------
// Stripe mock
// ---------------------------------------------------------------------------
const mockGetStripe = jest.mocked(getStripe);

// ---------------------------------------------------------------------------
// Email spy
// ---------------------------------------------------------------------------
let emailSpy: jest.SpiedFunction<typeof brevo.txEmailApi.sendTransacEmail>;

beforeEach(async () => {
  await cleanDb();
  emailSpy = jest
    .spyOn(brevo.txEmailApi, 'sendTransacEmail')
    .mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  emailSpy.mockRestore();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

let paymentCounter = 0;

async function insertPayment(
  userId: string,
  periodEnd: Date,
  opts?: {
    status?: 'succeeded' | 'failed' | 'pending';
    stripePaymentId?: string;
    stripeSubscriptionId?: string;
    amount?: number;
  },
) {
  paymentCounter += 1;
  const db = getAdminDb();
  await db.insert(membershipPayments).values({
    userId,
    stripePaymentId: opts?.stripePaymentId ?? `pi_test_${paymentCounter}_${Date.now()}`,
    stripeSubscriptionId: opts?.stripeSubscriptionId ?? null,
    amount: opts?.amount ?? 29000,
    currency: 'chf',
    status: opts?.status ?? 'succeeded',
    periodEnd,
  });
}

async function insertSubscription(userId: string, stripeSubscriptionId?: string) {
  const subId = stripeSubscriptionId ?? `sub_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const db = getAdminDb();
  await db.insert(userSubscriptions).values({
    userId,
    stripeSubscriptionId: subId,
    cancelAtPeriodEnd: false,
  });
  return subId;
}

async function insertNotification(
  userId: string,
  periodEndDate: Date,
  type: 'payment_failed' | 'expiry_reminder' | 'access_lost' | 'membership_ended',
) {
  const db = getAdminDb();
  await db.insert(membershipExpiryNotifications).values({ userId, periodEndDate, type });
}

// ---------------------------------------------------------------------------
// Stripe fixture builders
// ---------------------------------------------------------------------------

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function makeStripeSubscription(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  const periodEnd = daysFromNow(365);
  return {
    id: 'sub_default',
    cancel_at_period_end: false,
    items: {
      data: [{ current_period_end: Math.floor(periodEnd.getTime() / 1000) }],
    },
    latest_invoice: 'in_default',
    default_payment_method: null,
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function makeStripeInvoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: 'in_default',
    amount_paid: 29000,
    currency: 'chf',
    billing_reason: 'subscription_create',
    parent: {
      subscription_details: { subscription: 'sub_default' },
    },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

function makePaymentMethod(overrides: Record<string, unknown> = {}): Stripe.PaymentMethod {
  return {
    id: 'pm_default',
    card: {
      last4: '4242',
      brand: 'visa',
      exp_month: 12,
      exp_year: 2027,
    },
    ...overrides,
  } as unknown as Stripe.PaymentMethod;
}

function makePaymentIntent(overrides: Record<string, unknown> = {}): Stripe.PaymentIntent {
  return {
    id: 'pi_default',
    payment_method: 'pm_default',
    ...overrides,
  } as unknown as Stripe.PaymentIntent;
}

function makeSetupIntent(overrides: Record<string, unknown> = {}): Stripe.SetupIntent {
  return {
    id: 'si_default',
    payment_method: 'pm_default',
    ...overrides,
  } as unknown as Stripe.SetupIntent;
}

/** Build a partial Stripe-like mock. The cast is unavoidable for test fixtures. */
function buildStripeMock(opts: {
  subscription?: Stripe.Subscription;
  invoice?: Stripe.Invoice;
  paymentMethod?: Stripe.PaymentMethod | null;
  paymentIntent?: Stripe.PaymentIntent;
  setupIntent?: Stripe.SetupIntent;
}): Stripe {
  const subscription = opts.subscription ?? makeStripeSubscription();
  const invoice = opts.invoice ?? makeStripeInvoice();
  const paymentMethod = opts.paymentMethod ?? makePaymentMethod();
  const paymentIntent = opts.paymentIntent ?? makePaymentIntent();
  const setupIntent = opts.setupIntent ?? makeSetupIntent();
  return {
    subscriptions: {
      retrieve: jest.fn().mockImplementation(async () => subscription),
      update: jest.fn().mockImplementation(async () => ({})),
    },
    invoices: {
      retrieve: jest.fn().mockImplementation(async () => invoice),
    },
    paymentMethods: {
      retrieve: jest.fn().mockImplementation(async () => paymentMethod),
    },
    paymentIntents: {
      retrieve: jest.fn().mockImplementation(async () => paymentIntent),
    },
    setupIntents: {
      retrieve: jest.fn().mockImplementation(async () => setupIntent),
    },
    customers: {
      create: jest.fn().mockImplementation(async () => ({ id: 'cus_test' })),
    },
  } as unknown as Stripe;
}

// ---------------------------------------------------------------------------
// Stripe event builders
// ---------------------------------------------------------------------------

function makeCheckoutSubscriptionEvent(
  userId: string,
  subId: string,
  invoiceId = 'in_123',
): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'subscription',
        subscription: subId,
        metadata: { userId, type: 'membership' },
        setup_intent: null,
      },
    },
  } as unknown as Stripe.Event;
}

function makeCheckoutPaymentEvent(userId: string, paymentIntentId: string): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'payment',
        payment_intent: paymentIntentId,
        amount_total: 29000,
        currency: 'chf',
        metadata: { userId, type: 'membership' },
        setup_intent: null,
      },
    },
  } as unknown as Stripe.Event;
}

function makeCheckoutSetupEvent(userId: string, setupIntentId: string): Stripe.Event {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'setup',
        setup_intent: setupIntentId,
        payment_intent: null,
        subscription: null,
        metadata: { userId, type: 'payment_method_setup' },
      },
    },
  } as unknown as Stripe.Event;
}

function makeInvoiceSucceededEvent(subId: string, invoiceId: string, overrides: Record<string, unknown> = {}): Stripe.Event {
  return {
    type: 'invoice.payment_succeeded',
    data: {
      object: {
        id: invoiceId,
        amount_paid: 29000,
        currency: 'chf',
        billing_reason: 'subscription_create',
        parent: { subscription_details: { subscription: subId } },
        ...overrides,
      },
    },
  } as unknown as Stripe.Event;
}

function makeInvoiceFailedEvent(subId: string, invoiceId: string): Stripe.Event {
  return {
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: invoiceId,
        amount_due: 29000,
        currency: 'chf',
        parent: { subscription_details: { subscription: subId } },
      },
    },
  } as unknown as Stripe.Event;
}

function makeSubscriptionUpdatedEvent(subId: string, cancelAtPeriodEnd: boolean): Stripe.Event {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: { id: subId, cancel_at_period_end: cancelAtPeriodEnd },
    },
  } as unknown as Stripe.Event;
}

function makeSubscriptionDeletedEvent(subId: string): Stripe.Event {
  return {
    type: 'customer.subscription.deleted',
    data: {
      object: { id: subId },
    },
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// A. checkout.session.completed — subscription
// ---------------------------------------------------------------------------
describe('checkout.session.completed — subscription', () => {
  it('first-time subscription inserts payment + subscription + sends welcome email', async () => {
    const { userId } = await createTestUser('a1@test.com', 'password123');
    const api = membershipApi(adminOnlyDb);

    const periodEnd = daysFromNow(365);
    const sub = makeStripeSubscription({
      id: 'sub_a1',
      latest_invoice: 'in_a1',
      items: { data: [{ current_period_end: Math.floor(periodEnd.getTime() / 1000) }] },
    });
    const invoice = makeStripeInvoice({ id: 'in_a1', amount_paid: 29000 });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub, invoice }));

    await api.handleWebhookEvent(makeCheckoutSubscriptionEvent(userId, 'sub_a1', 'in_a1'));

    const db = getAdminDb();
    const payment = await db.query.membershipPayments.findFirst({ where: { userId, status: 'succeeded' } });
    expect(payment).toBeDefined();
    expect(payment!.stripeSubscriptionId).toBe('sub_a1');

    const subRow = await db.query.userSubscriptions.findFirst({ where: { userId } });
    expect(subRow).toBeDefined();
    expect(subRow!.stripeSubscriptionId).toBe('sub_a1');

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('Willkommen');
    expect(emailSpy.mock.calls[0]?.[0]?.to?.[0]?.email).toBe('a1@test.com');
  });

  it('trial checkout ($0 invoice) sends welcome email with trialEnd set', async () => {
    const { userId } = await createTestUser('a2@test.com', 'password123');
    const api = membershipApi(adminOnlyDb);

    const periodEnd = daysFromNow(30);
    const sub = makeStripeSubscription({
      id: 'sub_a2',
      latest_invoice: 'in_a2',
      items: { data: [{ current_period_end: Math.floor(periodEnd.getTime() / 1000) }] },
    });
    const invoice = makeStripeInvoice({ id: 'in_a2', amount_paid: 0, amount_due: 0 });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub, invoice }));

    await api.handleWebhookEvent(makeCheckoutSubscriptionEvent(userId, 'sub_a2', 'in_a2'));

    expect(emailSpy).toHaveBeenCalledTimes(1);
    // Trial email shows trial block (German "Testphase"), not a receipt
    expect(emailSpy.mock.calls[0]?.[0]?.htmlContent).toContain('Testphase');
  });

  it('reactivation (prior succeeded payment) sends reactivation email', async () => {
    const { userId } = await createTestUser('a3@test.com', 'password123');
    await insertPayment(userId, daysFromNow(30), { stripePaymentId: 'pi_prior_a3' });
    const api = membershipApi(adminOnlyDb);

    const periodEnd = daysFromNow(365);
    const sub = makeStripeSubscription({
      id: 'sub_a3',
      latest_invoice: 'in_a3',
      items: { data: [{ current_period_end: Math.floor(periodEnd.getTime() / 1000) }] },
    });
    const invoice = makeStripeInvoice({ id: 'in_a3', amount_paid: 29000 });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub, invoice }));

    await api.handleWebhookEvent(makeCheckoutSubscriptionEvent(userId, 'sub_a3', 'in_a3'));

    expect(emailSpy).toHaveBeenCalledTimes(1);
    // Reactivation subject contains "zurück"
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('zurück');
  });

  it('upserts userSubscriptions row if user already has one', async () => {
    const { userId } = await createTestUser('a4@test.com', 'password123');
    await insertSubscription(userId, 'sub_a4_old');
    const api = membershipApi(adminOnlyDb);

    const periodEnd = daysFromNow(365);
    const sub = makeStripeSubscription({
      id: 'sub_a4_new',
      latest_invoice: null,
      items: { data: [{ current_period_end: Math.floor(periodEnd.getTime() / 1000) }] },
    });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub }));

    await expect(
      api.handleWebhookEvent(makeCheckoutSubscriptionEvent(userId, 'sub_a4_new')),
    ).resolves.not.toThrow();

    const db = getAdminDb();
    const subRow = await db.query.userSubscriptions.findFirst({ where: { userId } });
    expect(subRow!.stripeSubscriptionId).toBe('sub_a4_new');
  });

  it('missing userId in metadata returns early — no DB writes', async () => {
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    const event = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', subscription: 'sub_x', metadata: {} } },
    } as unknown as Stripe.Event;

    await api.handleWebhookEvent(event);

    const db = getAdminDb();
    const payments = await db.query.membershipPayments.findMany({});
    expect(payments).toHaveLength(0);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('setup mode — updates subscription payment method, no email, no payment row', async () => {
    const { userId } = await createTestUser('a6@test.com', 'password123');
    const subId = await insertSubscription(userId, 'sub_a6');
    const api = membershipApi(adminOnlyDb);

    mockGetStripe.mockReturnValue(
      buildStripeMock({ setupIntent: makeSetupIntent({ id: 'si_a6', payment_method: 'pm_a6' }) }),
    );

    await api.handleWebhookEvent(makeCheckoutSetupEvent(userId, 'si_a6'));

    const db = getAdminDb();
    const payments = await db.query.membershipPayments.findMany({});
    expect(payments).toHaveLength(0);
    expect(emailSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B. checkout.session.completed — manual payment
// ---------------------------------------------------------------------------
describe('checkout.session.completed — manual payment', () => {
  it('first manual payment inserts row and sends welcome email', async () => {
    const { userId } = await createTestUser('b1@test.com', 'password123');
    const api = membershipApi(adminOnlyDb);

    const pm = makePaymentMethod({ id: 'pm_b1', card: { last4: '0001', brand: 'visa', exp_month: 1, exp_year: 2030 } });
    const pi = makePaymentIntent({ id: 'pi_b1', payment_method: 'pm_b1' });
    mockGetStripe.mockReturnValue(buildStripeMock({ paymentMethod: pm, paymentIntent: pi }));

    await api.handleWebhookEvent(makeCheckoutPaymentEvent(userId, 'pi_b1'));

    const db = getAdminDb();
    const payment = await db.query.membershipPayments.findFirst({ where: { userId, status: 'succeeded' } });
    expect(payment).toBeDefined();
    expect(payment!.amount).toBe(29000);

    // periodEnd should be ~1 year from now (within a 5-minute window)
    const expectedEnd = new Date();
    expectedEnd.setFullYear(expectedEnd.getFullYear() + 1);
    const diffMs = Math.abs(payment!.periodEnd.getTime() - expectedEnd.getTime());
    expect(diffMs).toBeLessThan(5 * 60 * 1000);

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('Willkommen');
  });

  it('manual renewal sends reactivation email', async () => {
    const { userId } = await createTestUser('b2@test.com', 'password123');
    await insertPayment(userId, daysFromNow(10), { stripePaymentId: 'pi_b2_prior' });
    const api = membershipApi(adminOnlyDb);

    const pi = makePaymentIntent({ id: 'pi_b2_new', payment_method: null });
    mockGetStripe.mockReturnValue(buildStripeMock({ paymentIntent: pi, paymentMethod: null }));

    await api.handleWebhookEvent(makeCheckoutPaymentEvent(userId, 'pi_b2_new'));

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('zurück');
  });

  it('Twint payment (no card) sends email without card info', async () => {
    const { userId } = await createTestUser('b3@test.com', 'password123');
    const api = membershipApi(adminOnlyDb);

    const pm = { id: 'pm_b3', card: null } as unknown as Stripe.PaymentMethod;
    const pi = makePaymentIntent({ id: 'pi_b3', payment_method: 'pm_b3' });
    mockGetStripe.mockReturnValue(buildStripeMock({ paymentMethod: pm, paymentIntent: pi }));

    await api.handleWebhookEvent(makeCheckoutPaymentEvent(userId, 'pi_b3'));

    expect(emailSpy).toHaveBeenCalledTimes(1);

    const db = getAdminDb();
    const payment = await db.query.membershipPayments.findFirst({ where: { userId } });
    expect(payment!.cardLast4).toBeNull();
    expect(payment!.cardBrand).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C. invoice.payment_succeeded
// ---------------------------------------------------------------------------
describe('invoice.payment_succeeded', () => {
  it('subscription_create — inserts payment but sends no email', async () => {
    const { userId } = await createTestUser('c1@test.com', 'password123');
    await insertSubscription(userId, 'sub_c1');
    const api = membershipApi(adminOnlyDb);

    const sub = makeStripeSubscription({ id: 'sub_c1' });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub }));

    await api.handleWebhookEvent(
      makeInvoiceSucceededEvent('sub_c1', 'in_c1', { billing_reason: 'subscription_create' }),
    );

    const db = getAdminDb();
    const payment = await db.query.membershipPayments.findFirst({ where: { userId } });
    expect(payment).toBeDefined();
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('subscription_cycle after $0 sends first payment email', async () => {
    const { userId } = await createTestUser('c2@test.com', 'password123');
    await insertSubscription(userId, 'sub_c2');
    // Prior $0 payment (trial checkout)
    await insertPayment(userId, daysFromNow(30), { stripePaymentId: 'in_c2_trial', stripeSubscriptionId: 'sub_c2', amount: 0 });
    const api = membershipApi(adminOnlyDb);

    const sub = makeStripeSubscription({ id: 'sub_c2' });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub }));

    await api.handleWebhookEvent(
      makeInvoiceSucceededEvent('sub_c2', 'in_c2_cycle', { billing_reason: 'subscription_cycle', amount_paid: 29000 }),
    );

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('abgerechnet');
  });

  it('subscription_cycle with prior non-zero payment sends renewal email', async () => {
    const { userId } = await createTestUser('c3@test.com', 'password123');
    await insertSubscription(userId, 'sub_c3');
    await insertPayment(userId, daysFromNow(30), { stripePaymentId: 'in_c3_prior', stripeSubscriptionId: 'sub_c3', amount: 29000 });
    const api = membershipApi(adminOnlyDb);

    const sub = makeStripeSubscription({ id: 'sub_c3' });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub }));

    await api.handleWebhookEvent(
      makeInvoiceSucceededEvent('sub_c3', 'in_c3_cycle', { billing_reason: 'subscription_cycle', amount_paid: 29000 }),
    );

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('erneuert');
  });

  it('no matching userSubscription — early return, no DB writes', async () => {
    const api = membershipApi(adminOnlyDb);
    const sub = makeStripeSubscription({ id: 'sub_nobody' });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub }));

    await api.handleWebhookEvent(makeInvoiceSucceededEvent('sub_nobody', 'in_nobody'));

    const db = getAdminDb();
    const payments = await db.query.membershipPayments.findMany({});
    expect(payments).toHaveLength(0);
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('idempotency — same invoice twice inserts only one row, one email', async () => {
    const { userId } = await createTestUser('c5@test.com', 'password123');
    await insertSubscription(userId, 'sub_c5');
    const api = membershipApi(adminOnlyDb);

    const sub = makeStripeSubscription({ id: 'sub_c5' });
    mockGetStripe.mockReturnValue(buildStripeMock({ subscription: sub }));

    const event = makeInvoiceSucceededEvent('sub_c5', 'in_c5_idem', { billing_reason: 'subscription_cycle', amount_paid: 29000 });
    await api.handleWebhookEvent(event);
    await api.handleWebhookEvent(event);

    const db = getAdminDb();
    const payments = await db.query.membershipPayments.findMany({ where: { userId } });
    expect(payments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// D. invoice.payment_failed
// ---------------------------------------------------------------------------
describe('invoice.payment_failed', () => {
  it('happy path — inserts failed payment, notification, sends payment_failed email', async () => {
    const { userId } = await createTestUser('d1@test.com', 'password123');
    const periodEnd = daysFromNow(5);
    await insertSubscription(userId, 'sub_d1');
    await insertPayment(userId, periodEnd, { stripePaymentId: 'in_d1_succeeded', stripeSubscriptionId: 'sub_d1' });
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeInvoiceFailedEvent('sub_d1', 'in_d1_failed'));

    const db = getAdminDb();
    const failedPayment = await db.query.membershipPayments.findFirst({ where: { userId, status: 'failed' } });
    expect(failedPayment).toBeDefined();
    expect(failedPayment!.periodEnd.getTime()).toBe(0);

    const notification = await db.query.membershipExpiryNotifications.findFirst({ where: { userId } });
    expect(notification).toBeDefined();
    expect(notification!.type).toBe('payment_failed');

    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.to?.[0]?.email).toBe('d1@test.com');
    expect(emailSpy.mock.calls[0]?.[0]?.subject).toContain('Zahlung fehlgeschlagen');
  });

  it('idempotency — firing twice sends email only once', async () => {
    const { userId } = await createTestUser('d2@test.com', 'password123');
    await insertSubscription(userId, 'sub_d2');
    await insertPayment(userId, daysFromNow(5), { stripePaymentId: 'in_d2_ok', stripeSubscriptionId: 'sub_d2' });
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeInvoiceFailedEvent('sub_d2', 'in_d2_failed_1'));
    await api.handleWebhookEvent(makeInvoiceFailedEvent('sub_d2', 'in_d2_failed_2'));

    // Second firing: notification already exists → no new email
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('no prior succeeded payment — inserts failed row but no notification, no email', async () => {
    const { userId } = await createTestUser('d3@test.com', 'password123');
    await insertSubscription(userId, 'sub_d3');
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeInvoiceFailedEvent('sub_d3', 'in_d3_fail'));

    const db = getAdminDb();
    const failedPayment = await db.query.membershipPayments.findFirst({ where: { userId, status: 'failed' } });
    expect(failedPayment).toBeDefined();

    const notification = await db.query.membershipExpiryNotifications.findFirst({ where: { userId } });
    expect(notification).toBeUndefined();
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('no matching subscription — early return, no DB writes', async () => {
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeInvoiceFailedEvent('sub_nobody', 'in_nobody'));

    const db = getAdminDb();
    const payments = await db.query.membershipPayments.findMany({});
    expect(payments).toHaveLength(0);
    expect(emailSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// E. customer.subscription.updated
// ---------------------------------------------------------------------------
describe('customer.subscription.updated', () => {
  it('sets cancelAtPeriodEnd to true', async () => {
    const { userId } = await createTestUser('e1@test.com', 'password123');
    await insertSubscription(userId, 'sub_e1');
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeSubscriptionUpdatedEvent('sub_e1', true));

    const db = getAdminDb();
    const subRow = await db.query.userSubscriptions.findFirst({ where: { userId } });
    expect(subRow!.cancelAtPeriodEnd).toBe(true);
  });

  it('sets cancelAtPeriodEnd to false (reactivation)', async () => {
    const { userId } = await createTestUser('e2@test.com', 'password123');
    const db = getAdminDb();
    await db.insert(userSubscriptions).values({
      userId,
      stripeSubscriptionId: 'sub_e2',
      cancelAtPeriodEnd: true,
    });
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeSubscriptionUpdatedEvent('sub_e2', false));

    const subRow = await db.query.userSubscriptions.findFirst({ where: { userId } });
    expect(subRow!.cancelAtPeriodEnd).toBe(false);
  });

  it('missing subscription row — no error', async () => {
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await expect(
      api.handleWebhookEvent(makeSubscriptionUpdatedEvent('sub_nobody', true)),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// F. customer.subscription.deleted
// ---------------------------------------------------------------------------
describe('customer.subscription.deleted', () => {
  it('deletes the userSubscriptions row', async () => {
    const { userId } = await createTestUser('f1@test.com', 'password123');
    await insertSubscription(userId, 'sub_f1');
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await api.handleWebhookEvent(makeSubscriptionDeletedEvent('sub_f1'));

    const db = getAdminDb();
    const subRow = await db.query.userSubscriptions.findFirst({ where: { userId } });
    expect(subRow).toBeUndefined();
  });

  it('no row present — no error', async () => {
    const api = membershipApi(adminOnlyDb);
    mockGetStripe.mockReturnValue(buildStripeMock({}));

    await expect(
      api.handleWebhookEvent(makeSubscriptionDeletedEvent('sub_nobody')),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// G. Grace period access control
// ---------------------------------------------------------------------------
describe('grace period access control', () => {
  it('isActive — payment 5 days ago (in grace) = true', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_a@test.com');
    await insertPayment(userId, daysAgo(5));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isActive(farmId)).toBe(true);
  });

  it('isActive — payment 9 days ago (near boundary) = true', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_b@test.com');
    await insertPayment(userId, daysAgo(9));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isActive(farmId)).toBe(true);
  });

  it('isActive — payment 11 days ago (beyond grace) = false', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_c@test.com');
    await insertPayment(userId, daysAgo(11));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isActive(farmId)).toBe(false);
  });

  it('isActive — payment in future = true', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_d@test.com');
    await insertPayment(userId, daysFromNow(30));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isActive(farmId)).toBe(true);
  });

  it('isActive — active trial (no payments) = true', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_e@test.com');
    const db = getAdminDb();
    await db.insert(userTrials).values({ userId, endsAt: daysFromNow(15) });
    const api = membershipApi(adminOnlyDb);
    expect(await api.isActive(farmId)).toBe(true);
  });

  it('isPaidMember — payment 5 days ago = true', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_f@test.com');
    await insertPayment(userId, daysAgo(5));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isPaidMember(farmId)).toBe(true);
  });

  it('isPaidMember — payment 11 days ago = false', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_g@test.com');
    await insertPayment(userId, daysAgo(11));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isPaidMember(farmId)).toBe(false);
  });

  it('isPaidMember — trial only = false (trial excluded)', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_h@test.com');
    const db = getAdminDb();
    await db.insert(userTrials).values({ userId, endsAt: daysFromNow(15) });
    const api = membershipApi(adminOnlyDb);
    expect(await api.isPaidMember(farmId)).toBe(false);
  });

  it('isActiveUser — payment 5 days ago = true', async () => {
    const { userId } = await createTestUser('g_i@test.com', 'password123');
    await insertPayment(userId, daysAgo(5));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isActiveUser(userId)).toBe(true);
  });

  it('isPaidUser — payment 11 days ago = false', async () => {
    const { userId } = await createTestUser('g_j@test.com', 'password123');
    await insertPayment(userId, daysAgo(11));
    const api = membershipApi(adminOnlyDb);
    expect(await api.isPaidUser(userId)).toBe(false);
  });

  it('getFarmMembershipStatus — active payment = "active"', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_k@test.com');
    await insertPayment(userId, daysFromNow(30));
    const api = membershipApi(adminOnlyDb);
    expect(await api.getFarmMembershipStatus(farmId)).toBe('active');
  });

  it('getFarmMembershipStatus — trial only = "trial"', async () => {
    const { farmId, userId } = await createUserWithFarm({}, 'g_l@test.com');
    const db = getAdminDb();
    await db.insert(userTrials).values({ userId, endsAt: daysFromNow(15) });
    const api = membershipApi(adminOnlyDb);
    expect(await api.getFarmMembershipStatus(farmId)).toBe('trial');
  });

  it('getFarmMembershipStatus — nothing = "none"', async () => {
    const { farmId } = await createUserWithFarm({}, 'g_m@test.com');
    const api = membershipApi(adminOnlyDb);
    expect(await api.getFarmMembershipStatus(farmId)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// H. startTrial
// ---------------------------------------------------------------------------
describe('startTrial', () => {
  it('creates trial ending 30 days out', async () => {
    const { userId } = await createUserWithFarm({}, 'h1@test.com');
    const api = membershipApi(adminOnlyDb);

    const { trialEnd } = await api.startTrial(userId);

    const expected = new Date();
    expected.setDate(expected.getDate() + 30);
    const diffMs = Math.abs(trialEnd.getTime() - expected.getTime());
    expect(diffMs).toBeLessThan(5 * 60 * 1000);

    const db = getAdminDb();
    const trial = await db.query.userTrials.findFirst({ where: { userId } });
    expect(trial).toBeDefined();
  });

  it('second call for same farm throws 409', async () => {
    const { userId } = await createUserWithFarm({}, 'h2@test.com');
    const api = membershipApi(adminOnlyDb);
    await api.startTrial(userId);

    await expect(api.startTrial(userId)).rejects.toThrow('Trial already used');
  });

  it('user without farm — second call throws 409', async () => {
    const { userId } = await createTestUser('h4@test.com', 'password123');
    const api = membershipApi(adminOnlyDb);
    await api.startTrial(userId);

    await expect(api.startTrial(userId)).rejects.toThrow('Trial already used');
  });
});

// ---------------------------------------------------------------------------
// I. getStatus / getPayments
// ---------------------------------------------------------------------------
describe('getStatus / getPayments', () => {
  it('no membership — all nulls/false', async () => {
    const { userId } = await createTestUser('i1@test.com', 'password123');
    const api = membershipApi(adminOnlyDb);

    const status = await api.getStatus(userId);
    expect(status.lastPeriodEnd).toBeNull();
    expect(status.cancelAtPeriodEnd).toBe(false);
    expect(status.autoRenewing).toBe(false);
    expect(status.trialEnd).toBeNull();
  });

  it('subscription + payment reflects correct fields', async () => {
    const { userId } = await createTestUser('i2@test.com', 'password123');
    const periodEnd = daysFromNow(365);
    await insertPayment(userId, periodEnd, { stripePaymentId: 'pi_i2' });
    await insertSubscription(userId, 'sub_i2');
    const api = membershipApi(adminOnlyDb);

    const status = await api.getStatus(userId);
    expect(status.lastPeriodEnd?.getTime()).toBeCloseTo(periodEnd.getTime(), -3);
    expect(status.autoRenewing).toBe(true);
    expect(status.cancelAtPeriodEnd).toBe(false);
  });

  it('getPayments returns payments ordered by createdAt desc', async () => {
    const { userId } = await createTestUser('i3@test.com', 'password123');
    await insertPayment(userId, daysAgo(10), { stripePaymentId: 'pi_i3_old', amount: 29000 });
    // Small sleep to ensure different createdAt timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
    await insertPayment(userId, daysFromNow(355), { stripePaymentId: 'pi_i3_new', amount: 29000 });
    const api = membershipApi(adminOnlyDb);

    const payments = await api.getPayments(userId);
    expect(payments).toHaveLength(2);
    // Most recent first
    expect(payments[0].stripePaymentId).toBe('pi_i3_new');
    expect(payments[1].stripePaymentId).toBe('pi_i3_old');
  });
});

// ---------------------------------------------------------------------------
// J. Cron: expiry_reminder (day 0 — expired but within 10 days)
// ---------------------------------------------------------------------------
describe('cron: expiry_reminder', () => {
  it('manual payment 1 day ago → expiry_reminder notification + email', async () => {
    const { userId } = await createTestUser('j1@test.com', 'password123');
    await insertPayment(userId, daysAgo(1));

    await runExpiryNotifications();

    const db = getAdminDb();
    const notification = await db.query.membershipExpiryNotifications.findFirst({ where: { userId } });
    expect(notification?.type).toBe('expiry_reminder');
    expect(emailSpy).toHaveBeenCalledTimes(1);
    expect(emailSpy.mock.calls[0]?.[0]?.to?.[0]?.email).toBe('j1@test.com');
  });

  it('manual payment 9 days ago → expiry_reminder email (within window)', async () => {
    const { userId } = await createTestUser('j2@test.com', 'password123');
    await insertPayment(userId, daysAgo(9));

    await runExpiryNotifications();

    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('manual payment 11 days ago → no expiry_reminder (outside window, belongs to access_lost pass)', async () => {
    const { userId } = await createTestUser('j3@test.com', 'password123');
    await insertPayment(userId, daysAgo(11));

    await runExpiryNotifications();

    const db = getAdminDb();
    const notification = await db.query.membershipExpiryNotifications.findFirst({
      where: { userId, type: 'expiry_reminder' },
    });
    expect(notification).toBeUndefined();
  });

  it('subscription present + expired → no expiry_reminder (auto-renewing excluded)', async () => {
    const { userId } = await createTestUser('j4@test.com', 'password123');
    await insertPayment(userId, daysAgo(1));
    await insertSubscription(userId, 'sub_j4');

    await runExpiryNotifications();

    // Expiry reminder pass skips users with active subscription
    const db = getAdminDb();
    const notification = await db.query.membershipExpiryNotifications.findFirst({
      where: { userId, type: 'expiry_reminder' },
    });
    expect(notification).toBeUndefined();
  });

  it('prior payment_failed notification → no expiry_reminder email', async () => {
    const { userId } = await createTestUser('j5@test.com', 'password123');
    const periodEnd = daysAgo(1);
    await insertPayment(userId, periodEnd);
    await insertNotification(userId, periodEnd, 'payment_failed');

    await runExpiryNotifications();

    expect(emailSpy).not.toHaveBeenCalled();
  });

  it('prior expiry_reminder → idempotent, no duplicate email', async () => {
    const { userId } = await createTestUser('j6@test.com', 'password123');
    const periodEnd = daysAgo(1);
    await insertPayment(userId, periodEnd);

    await runExpiryNotifications();
    expect(emailSpy).toHaveBeenCalledTimes(1);

    // Second run — notification already exists
    await runExpiryNotifications();
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// K. Cron: access_lost (day +10)
// ---------------------------------------------------------------------------
describe('cron: access_lost', () => {
  it('periodEnd 11 days ago → access_lost notification + email', async () => {
    const { userId } = await createTestUser('k1@test.com', 'password123');
    await insertPayment(userId, daysAgo(11));

    await runExpiryNotifications();

    const db = getAdminDb();
    const notification = await db.query.membershipExpiryNotifications.findFirst({ where: { userId } });
    expect(notification?.type).toBe('access_lost');
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('periodEnd 29 days ago → access_lost email (within window)', async () => {
    const { userId } = await createTestUser('k2@test.com', 'password123');
    await insertPayment(userId, daysAgo(29));

    await runExpiryNotifications();

    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('periodEnd 31 days ago → no access_lost (outside window, belongs to membership_ended)', async () => {
    const { userId } = await createTestUser('k3@test.com', 'password123');
    await insertPayment(userId, daysAgo(31));

    await runExpiryNotifications();

    const db = getAdminDb();
    const notification = await db.query.membershipExpiryNotifications.findFirst({
      where: { userId, type: 'access_lost' },
    });
    expect(notification).toBeUndefined();
  });

  it('prior access_lost notification → idempotent, no duplicate email', async () => {
    const { userId } = await createTestUser('k4@test.com', 'password123');
    const periodEnd = daysAgo(11);
    await insertPayment(userId, periodEnd);

    await runExpiryNotifications();
    expect(emailSpy).toHaveBeenCalledTimes(1);

    await runExpiryNotifications();
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// L. Cron: membership_ended (day +30)
// ---------------------------------------------------------------------------
describe('cron: membership_ended', () => {
  it('periodEnd 31 days ago → membership_ended notification + email', async () => {
    const { userId } = await createTestUser('l1@test.com', 'password123');
    await insertPayment(userId, daysAgo(31));

    await runExpiryNotifications();

    const db = getAdminDb();
    const notification = await db.query.membershipExpiryNotifications.findFirst({ where: { userId } });
    expect(notification?.type).toBe('membership_ended');
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it('prior membership_ended → idempotent, no duplicate email', async () => {
    const { userId } = await createTestUser('l2@test.com', 'password123');
    await insertPayment(userId, daysAgo(31));

    await runExpiryNotifications();
    expect(emailSpy).toHaveBeenCalledTimes(1);

    await runExpiryNotifications();
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// M. Full timeline — three users at three stages, one cron run
// ---------------------------------------------------------------------------
describe('full timeline — three cron stages in one pass', () => {
  it('each stage user receives exactly one email in a single runExpiryNotifications call', async () => {
    const { userId: u1 } = await createTestUser('m1@test.com', 'password123');
    const { userId: u2 } = await createTestUser('m2@test.com', 'password123');
    const { userId: u3 } = await createTestUser('m3@test.com', 'password123');

    // u1: expiry_reminder range (1 day ago)
    await insertPayment(u1, daysAgo(1));
    // u2: access_lost range (15 days ago)
    await insertPayment(u2, daysAgo(15));
    // u3: membership_ended range (35 days ago)
    await insertPayment(u3, daysAgo(35));

    await runExpiryNotifications();

    expect(emailSpy).toHaveBeenCalledTimes(3);

    const recipients = emailSpy.mock.calls.map((call) => call[0].to?.[0]?.email ?? '');
    expect(recipients).toContain('m1@test.com');
    expect(recipients).toContain('m2@test.com');
    expect(recipients).toContain('m3@test.com');
  });
});
