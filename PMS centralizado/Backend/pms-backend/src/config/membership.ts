export const MEMBERSHIP_TIERS = ["HBASIC", "RBASIC", "STANDARD", "PRO", "PLATINUM"] as const;

export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const MEMBERSHIP_MODULES: Record<MembershipTier, string[]> = {

  RBASIC: ["restaurant", "management", "einvoicing"],
  HBASIC: ["frontdesk", "management", "einvoicing"],
  STANDARD: ["frontdesk", "restaurant", "management", "einvoicing"],
  PRO: ["frontdesk", "restaurant", "accounting", "management", "einvoicing"],
  PLATINUM: ["frontdesk", "restaurant", "accounting", "einvoicing", "management"],
};

export function normalizeMembershipTier(value?: string | null): MembershipTier {
  const raw = String(value || "").trim().toUpperCase();
  if ((MEMBERSHIP_TIERS as readonly string[]).includes(raw)) return raw as MembershipTier;
  return "PLATINUM";
}

export function isMembershipTier(value?: string | null): value is MembershipTier {
  const raw = String(value || "").trim().toUpperCase();
  return (MEMBERSHIP_TIERS as readonly string[]).includes(raw);
}

export function allowedModulesForMembership(value?: string | null): string[] {
  return MEMBERSHIP_MODULES[normalizeMembershipTier(value)];
}
