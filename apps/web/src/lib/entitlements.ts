/**
 * What each plan includes (product spec §7: freemium). During the beta every feature is
 * open to everyone; set ENFORCE_PLANS=true to apply the free-plan limits.
 */
export type Plan = "free" | "premium";

export interface Entitlements {
  maxSavedScenarios: number;
  pdfReports: boolean;
  saleAnalysis: boolean;
  yieldAlerts: boolean;
}

const PLANS: Record<Plan, Entitlements> = {
  free: { maxSavedScenarios: 3, pdfReports: false, saleAnalysis: false, yieldAlerts: false },
  premium: {
    maxSavedScenarios: Number.POSITIVE_INFINITY,
    pdfReports: true,
    saleAnalysis: true,
    yieldAlerts: true,
  },
};

export function entitlementsFor(plan: Plan): Entitlements {
  return process.env.ENFORCE_PLANS === "true" ? PLANS[plan] : PLANS.premium;
}
