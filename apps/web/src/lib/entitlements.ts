/**
 * What each plan includes (issues #5 and #12). Simulations and PDF reports are for everyone:
 * without signing in the PDF has a watermark, signed in it is clean. Signed-in users can email
 * the report; saving scenarios and valuations (and so photos) is paid. Set ENFORCE_PLANS=true
 * to apply the free-plan limits; without it everyone gets the paid plan (development, beta).
 */
export type Plan = "free" | "premium";

export interface Entitlements {
  /** Saved scenarios, and saved valuations, each; none on the free plan. */
  maxSavedScenarios: number;
  /** Report emails allowed per window, to keep the feature from being used for spam. */
  reportEmails: { limit: number; windowSeconds: number };
  saleAnalysis: boolean;
  yieldAlerts: boolean;
}

const HOUR = 3600;

const PLANS: Record<Plan, Entitlements> = {
  free: {
    maxSavedScenarios: 0,
    reportEmails: { limit: 5, windowSeconds: HOUR },
    saleAnalysis: false,
    yieldAlerts: false,
  },
  premium: {
    maxSavedScenarios: Number.POSITIVE_INFINITY,
    // No hourly limit; a daily cap still guards against abuse.
    reportEmails: { limit: 50, windowSeconds: 24 * HOUR },
    saleAnalysis: true,
    yieldAlerts: true,
  },
};

export function entitlementsFor(plan: Plan): Entitlements {
  return process.env.ENFORCE_PLANS === "true" ? PLANS[plan] : PLANS.premium;
}

/** Whether the plan can save scenarios and valuations. */
export const canSave = (plan: Plan) => entitlementsFor(plan).maxSavedScenarios > 0;
