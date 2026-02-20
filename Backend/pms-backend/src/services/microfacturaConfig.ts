type MicrofacturaEnv = "sandbox" | "production";

export type MicrofacturaApiConfig = {
  env: MicrofacturaEnv;
  atv: {
    username: string;
    password: string;
    clientId?: string; // api-stag | api-prod
    clientSecret: string;
  };
};

export function validateHaciendaConfig(cfg: MicrofacturaApiConfig) {
  const issues: string[] = [];
  if (!cfg.atv.username?.trim()) issues.push("ATV_USERNAME_MISSING");
  if (!cfg.atv.password?.trim()) issues.push("ATV_PASSWORD_MISSING");
  if (!cfg.atv.clientSecret?.trim()) issues.push("ATV_CLIENT_SECRET_MISSING");
  if (!cfg.atv.clientId?.trim()) issues.push("ATV_CLIENT_ID_MISSING");
  if (cfg.atv.clientId && !["api-stag", "api-prod"].includes(cfg.atv.clientId)) {
    issues.push("ATV_CLIENT_ID_INVALID");
  }
  return issues;
}
