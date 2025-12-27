export const MEMBERSHIP_TIERS = ["BASIC", "STANDARD", "PRO", "PLATINUM"] as const;

export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const MEMBERSHIP_MODULES: Record<MembershipTier, string[]> = {
  BASIC: ["frontdesk", "management"],
  STANDARD: ["frontdesk", "restaurant", "management"],
  PRO: ["frontdesk", "restaurant", "accounting", "management"],
  PLATINUM: ["frontdesk", "restaurant", "accounting", "einvoicing", "management"],
};

export function normalizeMembershipTier(value?: string | null): MembershipTier {
  const raw = String(value || "").trim().toUpperCase();
  if ((MEMBERSHIP_TIERS as readonly string[]).includes(raw)) return raw as MembershipTier;
  return "PLATINUM";
}

export function allowedModulesForMembership(value?: string | null): string[] {
  return MEMBERSHIP_MODULES[normalizeMembershipTier(value)];
}

