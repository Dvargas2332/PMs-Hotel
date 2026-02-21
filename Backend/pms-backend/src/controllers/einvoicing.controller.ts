import type { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import { DEFAULT_PRINT_FORMS, normalizeGlobalPrintForms, resolvePrintForms } from "../lib/printForms.js";

const SAAS_CONFIG_KEY = "GLOBAL";

function resolveHotelId(req: Request): string | undefined {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  return user?.hotelId;
}

const DEFAULT_REQUIREMENTS: Array<{
  code: string;
  category: string;
  title: string;
  description: string;
  required?: boolean;
  sortOrder: number;
}> = [
  {
    code: "CR44-SCOPE",
    category: "Scope",
    title: "CR e-invoicing scope identified",
    description:
      "Hotel identifies which transactions must be electronically invoiced and how they map to internal invoices/receipts.",
    sortOrder: 5,
  },
  {
    code: "CR44-MULTI-HOTEL-ISOLATION",
    category: "Scope",
    title: "Multi-hotel isolation enforced",
    description:
      "All electronic invoicing data (config, documents, sequences, logs) is strictly scoped to the current hotel to avoid cross-hotel mixing.",
    sortOrder: 7,
  },
  {
    code: "CR44-LEGAL-BASIS",
    category: "Compliance",
    title: "Legal and operational responsibilities defined",
    description:
      "Internal policies define who issues/cancels documents, how disputes are handled, and who has access to credentials and certificates.",
    sortOrder: 9,
  },
  {
    code: "CR44-ISSUER-IDENTITY",
    category: "Issuer",
    title: "Issuer identification configured",
    description:
      "Issuer legal name, ID type/number, commercial name, and location are configured and kept consistent with tax authority records.",
    sortOrder: 10,
  },
  {
    code: "CR44-ISSUER-CONTACT",
    category: "Issuer",
    title: "Issuer contact channels",
    description:
      "Issuer email/phone/contact channels are configured for documents and customer communications (when applicable).",
    sortOrder: 11,
  },
  {
    code: "CR44-ISSUER-ACTIVITY",
    category: "Issuer",
    title: "Issuer economic activity and tax regime",
    description:
      "Issuer economic activity and any required tax regime metadata are maintained for the electronic document header.",
    sortOrder: 12,
  },
  {
    code: "CR44-BRANCH-TERMINAL",
    category: "Issuer",
    title: "Branch and terminal identification",
    description:
      "Branch/terminal identifiers are configured (per POS/frontdesk) and used consistently in consecutive numbering and audit logs.",
    sortOrder: 14,
  },
  {
    code: "CR44-TIME-SYNC",
    category: "Compliance",
    title: "Server time synchronized",
    description:
      "Server time is synchronized (NTP) to prevent issues with key/date generation and signed document timestamps.",
    sortOrder: 16,
  },
  {
    code: "CR44-ATV-ACCOUNT",
    category: "ATV",
    title: "ATV account and authorization",
    description:
      "Issuer has an active ATV account and the system/operator is authorized to issue electronic documents for the issuer.",
    sortOrder: 18,
  },
  {
    code: "CR44-CERTIFICATE-SIGNING",
    category: "Security",
    title: "Valid signing certificate and signing process",
    description:
      "A valid digital certificate is configured and the XML is signed before submission.",
    sortOrder: 20,
  },
  {
    code: "CR44-CERTIFICATE-RENEWAL",
    category: "Security",
    title: "Certificate renewal process",
    description:
      "Certificate expiration is monitored and renewal/replacement procedures are documented to avoid service interruptions.",
    sortOrder: 21,
  },
  {
    code: "CR44-TOKEN-AUTH",
    category: "Security",
    title: "Authentication/token flow implemented",
    description:
      "System obtains and renews access tokens for the tax authority services and handles expiration/retries safely.",
    sortOrder: 22,
  },
  {
    code: "CR44-CREDENTIALS-PROTECTION",
    category: "Security",
    title: "Credentials protection and access controls",
    description:
      "ATV credentials, client secrets and certificate passwords are protected (restricted access, no plaintext exposure in UI/logs).",
    sortOrder: 23,
  },
  {
    code: "CR44-XML-SCHEMA",
    category: "XML",
    title: "XML schema generation and validation",
    description:
      "System generates XML according to the current CR schema version and validates it before signing/submission.",
    sortOrder: 24,
  },
  {
    code: "CR44-XML-SIGNATURE-STANDARD",
    category: "XML",
    title: "XML signature standard and validation",
    description:
      "XML signatures are generated using the required standard and validated locally to prevent sending invalid signatures to the tax authority.",
    sortOrder: 25,
  },
  {
    code: "CR44-CATALOGS",
    category: "Catalogs",
    title: "Official catalogs configured and up to date",
    description:
      "System maintains CR official catalogs/codes used by the XML (document types, payment methods, currencies, units, taxes, exemptions, activities).",
    sortOrder: 26,
  },
  {
    code: "CR44-CATALOGS-ACTIVITY-CODES",
    category: "Catalogs",
    title: "Economic activity codes catalog",
    description:
      "Issuer activity code(s) are maintained using the official catalog and can be selected per document when required.",
    sortOrder: 27,
  },
  {
    code: "CR44-CATALOGS-PAYMENT",
    category: "Catalogs",
    title: "Payment methods and sale conditions catalogs",
    description:
      "Sale conditions and payment methods are represented using official catalogs and are mapped correctly from POS/frontdesk payments.",
    sortOrder: 28,
  },
  {
    code: "CR44-CATALOGS-LOCATION",
    category: "Catalogs",
    title: "Location/address catalog mapping",
    description:
      "Address/location fields (province/canton/district or equivalent) are mapped using official code catalogs where required by the schema.",
    sortOrder: 29,
  },
  {
    code: "CR44-DOC-TYPES",
    category: "Documents",
    title: "Supported document types",
    description:
      "System supports required electronic document types (invoice, credit note, debit note, tickets/receipts) per CR e-invoicing rules.",
    sortOrder: 30,
  },
  {
    code: "CR44-DOC-TYPES-EXTENDED",
    category: "Documents",
    title: "Extended document types considered",
    description:
      "When applicable, the hotel supports additional CR document types (e.g., purchase invoice, export invoice) or explicitly documents why they are not applicable.",
    sortOrder: 31,
  },
  {
    code: "CR44-REFERENCE-DOCS",
    category: "Documents",
    title: "References to original documents",
    description:
      "Credit/debit notes properly reference the original document(s) and store the linkage for audit and reporting.",
    sortOrder: 32,
  },
  {
    code: "CR44-CONTENT-FIELDS",
    category: "Documents",
    title: "Required header/detail fields included",
    description:
      "Generated documents include required header and line detail fields (issuer/receiver, activity code, conditions, payment methods, totals and breakdowns) per the active CR schema.",
    sortOrder: 34,
  },
  {
    code: "CR44-LINE-DETAIL",
    category: "Documents",
    title: "Line detail completeness",
    description:
      "Line items include units, quantities, pricing, discounts, taxes and item descriptions consistent with internal POS/frontdesk concepts.",
    sortOrder: 35,
  },
  {
    code: "CR44-ROOM-CHARGES",
    category: "Integration",
    title: "Front Desk room-charge integration",
    description:
      "Restaurant/frontdesk can generate electronic invoices linked to room charges, keeping traceability between folio/movements and the electronic document.",
    sortOrder: 36,
  },
  {
    code: "CR44-PAYMENT-MAPPING",
    category: "Documents",
    title: "Payment breakdown mapping",
    description:
      "Multiple payment methods (cash/card/transfer/room charge) are mapped to the electronic document fields using official catalogs and do not break totals.",
    sortOrder: 37,
  },
  {
    code: "CR44-CREDIT-TERMS",
    category: "Documents",
    title: "Credit terms (when applicable)",
    description:
      "Credit sales include required credit terms information and are consistent with internal accounts receivable workflows.",
    sortOrder: 38,
  },
  {
    code: "CR44-SEQUENCE-CONTROL",
    category: "Sequences",
    title: "Consecutive numbering and unique keys",
    description:
      "System generates and validates unique document keys and consecutive numbers without collisions (per issuer/branch/terminal rules).",
    sortOrder: 40,
  },
  {
    code: "CR44-SEQUENCE-PERSISTENCE",
    category: "Sequences",
    title: "Sequence persistence and recovery",
    description:
      "Consecutive/sequence counters are persisted per hotel/issuer/branch/terminal and can recover safely after outages without duplication.",
    sortOrder: 40,
  },
  {
    code: "CR44-KEY-GENERATION",
    category: "Sequences",
    title: "Key generation rules implemented",
    description:
      "Electronic document keys are generated deterministically and validated (country, date, issuer ID, consecutive number, situation code/check digits where applicable).",
    sortOrder: 41,
  },
  {
    code: "CR44-IDEMPOTENCY",
    category: "Sequences",
    title: "Idempotent submission",
    description:
      "Retries do not create duplicates. Submissions are idempotent per unique key/consecutive number.",
    sortOrder: 42,
  },
  {
    code: "CR44-REPRINTS",
    category: "Operations",
    title: "Reprint and copy rules",
    description:
      "Reprints/copies keep the same key and consecutive number, and are logged as reprints without creating new electronic documents.",
    sortOrder: 44,
  },
  {
    code: "CR44-CANCELLATION",
    category: "Operations",
    title: "Cancellation/voiding process",
    description:
      "Cancellations are performed using the appropriate CR mechanism (e.g., credit notes) and are tracked in reports and audit logs.",
    sortOrder: 46,
  },
  {
    code: "CR44-RECEIVER-DATA",
    category: "Receiver",
    title: "Receiver data and validation",
    description:
      "Receiver identification, name and contact data are captured/validated when required.",
    sortOrder: 50,
  },
  {
    code: "CR44-RECEIVER-OPTIONALITY",
    category: "Receiver",
    title: "Receiver optionality per document type",
    description:
      "System applies receiver-data rules depending on the document type and scenario, preventing invalid combinations.",
    sortOrder: 51,
  },
  {
    code: "CR44-RECEIVER-EMAIL",
    category: "Receiver",
    title: "Receiver delivery (email/print)",
    description:
      "System can deliver representation (PDF/print) to receiver and record delivery attempts.",
    sortOrder: 52,
  },
  {
    code: "CR44-RECEIVER-ACCEPTANCE",
    category: "Acceptance",
    title: "Receiver acceptance/rejection messages",
    description:
      "When applicable, the system supports receiver acceptance/rejection/partial acceptance messages and stores them linked to the original document.",
    sortOrder: 54,
  },
  {
    code: "CR44-TAXES-SUMMARY",
    category: "Taxes",
    title: "Tax calculation and summary totals",
    description:
      "Line taxes, exemptions, discounts and totals are calculated and summarized consistently across XML/PDF and internal records.",
    sortOrder: 60,
  },
  {
    code: "CR44-EXONERATIONS",
    category: "Taxes",
    title: "Exemptions/exonerations handling",
    description:
      "Exemptions/exonerations (when applicable) are supported with correct references and documentation fields per CR rules.",
    sortOrder: 61,
  },
  {
    code: "CR44-TAX-CODES",
    category: "Taxes",
    title: "Tax codes and rates mapping",
    description:
      "Tax types/codes and rates are mapped from internal tax rules to the official catalog and validated for every line and summary.",
    sortOrder: 63,
  },
  {
    code: "CR44-CURRENCY",
    category: "Taxes",
    title: "Currency and exchange rate handling",
    description:
      "Multi-currency invoices include required exchange rate information and totals remain consistent.",
    sortOrder: 62,
  },
  {
    code: "CR44-DISCOUNTS-CHARGES",
    category: "Taxes",
    title: "Discounts and other charges",
    description:
      "Discounts and other charges are represented at the correct level (line/header) and totals remain consistent across XML and internal POS/frontdesk totals.",
    sortOrder: 64,
  },
  {
    code: "CR44-SUBMISSION",
    category: "Submission",
    title: "Submission and response handling",
    description:
      "System submits signed XML to the tax authority endpoint and stores the response status and messages for each document.",
    sortOrder: 70,
  },
  {
    code: "CR44-ENDPOINT-CONFIG",
    category: "Submission",
    title: "Sandbox/production endpoint configuration",
    description:
      "System can switch between sandbox and production endpoints safely, with safeguards to prevent sending real invoices to the wrong environment.",
    sortOrder: 69,
  },
  {
    code: "CR44-RESPONSE-POLLING",
    category: "Submission",
    title: "Response retrieval and polling strategy",
    description:
      "System retrieves the final validation response, handles transient failures, and avoids infinite retries.",
    sortOrder: 71,
  },
  {
    code: "CR44-STATUS-STATES",
    category: "Submission",
    title: "Clear document status states",
    description:
      "System tracks states (draft, signed, sent, accepted, rejected, contingency, canceled) and prevents invalid transitions.",
    sortOrder: 72,
  },
  {
    code: "CR44-ERROR-CLASSIFICATION",
    category: "Submission",
    title: "Error classification and operator actions",
    description:
      "Rejections and errors are classified (data error, schema, auth, connectivity) and the UI provides clear recovery actions.",
    sortOrder: 74,
  },
  {
    code: "CR44-ACCEPTANCE",
    category: "Acceptance",
    title: "Acceptance workflow (receiver)",
    description:
      "System supports receiver acceptance/rejection messages (where applicable) and stores them with timestamps and references.",
    sortOrder: 80,
  },
  {
    code: "CR44-PRINT-REPRESENTATION",
    category: "Representation",
    title: "Printable/PDF representation generated",
    description:
      "System generates a human-readable representation consistent with the XML, including key identifiers and status.",
    sortOrder: 82,
  },
  {
    code: "CR44-EMAIL-CONTENT",
    category: "Representation",
    title: "Email attachments and format",
    description:
      "Customer delivery emails include the correct attachments (XML and representation) and use a consistent, professional template with sender identity.",
    sortOrder: 83,
  },
  {
    code: "CR44-QR",
    category: "Representation",
    title: "QR/code representation",
    description:
      "Representation includes the required QR/code elements for verification when applicable.",
    sortOrder: 84,
  },
  {
    code: "CR44-CONTINGENCY",
    category: "Contingency",
    title: "Contingency mode",
    description:
      "System supports contingency issuance when tax authority services are unavailable, with later submission and proper audit trail.",
    sortOrder: 90,
  },
  {
    code: "CR44-CONTINGENCY-AUDIT",
    category: "Contingency",
    title: "Contingency audit trail",
    description:
      "Each contingency document stores the reason, start/end timestamps and later submission result for auditing and reporting.",
    sortOrder: 92,
  },
  {
    code: "CR44-STORAGE-AUDIT",
    category: "Storage",
    title: "Document storage and audit trail",
    description:
      "System stores signed XML, acknowledgements, PDFs/representations, logs and events for traceability and retention requirements.",
    sortOrder: 100,
  },
  {
    code: "CR44-RETENTION",
    category: "Storage",
    title: "Retention and backups",
    description:
      "Retention periods are respected and backups exist for XML, responses and audit logs, with restore procedures tested.",
    sortOrder: 102,
  },
  {
    code: "CR44-REPORTING",
    category: "Reporting",
    title: "Reporting and exports",
    description:
      "System provides reports for issued documents, cancellations, errors, and contingency operations per hotel and date range.",
    sortOrder: 110,
  },
  {
    code: "CR44-ROLES-PERMISSIONS",
    category: "Security",
    title: "Role-based access control",
    description:
      "Roles and permissions restrict access to issuing, canceling, reprinting and settings, with ADMIN always retaining full access.",
    sortOrder: 112,
  },
  {
    code: "CR44-TESTING",
    category: "Operations",
    title: "Testing and validation routine",
    description:
      "A routine exists to validate XML generation, signing, submission and email delivery in sandbox/staging before production changes.",
    sortOrder: 114,
  },
  {
    code: "CR44-VERSION-UPGRADES",
    category: "Versioning",
    title: "Version upgrade readiness",
    description:
      "Implementation is designed to support schema/rule upgrades (e.g., CR-4.4 changes) without breaking historical documents.",
    sortOrder: 120,
  },
  {
    code: "CR44-CHANGE-LOG",
    category: "Versioning",
    title: "Change log and migration notes",
    description:
      "Changes that affect electronic invoicing (catalog updates, schema upgrades, certificate rotations) are logged and communicated to operators.",
    sortOrder: 122,
  },
];


function withSettingsDefaults(input: any, globalConfig?: any) {
  const settings = input && typeof input === "object" ? { ...(input as any) } : {};
  const moduleBranding = settings.moduleBranding && typeof settings.moduleBranding === "object" ? { ...(settings.moduleBranding as any) } : {};
  for (const key of ["frontdesk", "restaurant", "accounting"]) {
    moduleBranding[key] = { ...(moduleBranding[key] || {}) };
  }
  const moduleConnections =
    settings.moduleConnections && typeof settings.moduleConnections === "object"
      ? { ...(settings.moduleConnections as any) }
      : {};
  const defaultConnections = { frontdesk: true, restaurant: true, accounting: false };
  for (const key of ["frontdesk", "restaurant", "accounting"]) {
    const incoming = moduleConnections[key];
    moduleConnections[key] = typeof incoming === "boolean" ? incoming : defaultConnections[key as keyof typeof defaultConnections];
  }
  const localForms = Array.isArray(settings.printForms) ? settings.printForms : [];
  const normalizedGlobal = normalizeGlobalPrintForms(globalConfig);
  const printForms = resolvePrintForms(localForms, normalizedGlobal);
  const hasPrintForms = printForms.length > 0;

  return {
    ...settings,
    moduleConnections,
    moduleBranding,
    printForms: hasPrintForms ? printForms : DEFAULT_PRINT_FORMS,
  };
}

async function ensureDefaults(hotelId: string) {
  await prisma.eInvoicingRequirement.createMany({
    data: DEFAULT_REQUIREMENTS.map((r) => ({
      hotelId,
      code: r.code,
      category: r.category,
      title: r.title,
      description: r.description,
      required: r.required ?? true,
      sortOrder: r.sortOrder,
      version: "CR-4.4",
      status: "PENDING",
    })),
    skipDuplicates: true,
  });
  await prisma.eInvoicingConfig.upsert({
    where: { hotelId },
    update: {},
    create: {
      hotelId,
      version: "CR-4.4",
      enabled: false,
      provider: "hacienda-cr",
      environment: "sandbox",
      credentials: {},
      settings: {},
    },
  });
}

export async function getEInvoicingConfig(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  await ensureDefaults(hotelId);
  const saasConfig = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const globalConfig = (saasConfig as any)?.printFormsGlobal;
  const config = await prisma.eInvoicingConfig.findUnique({ where: { hotelId } });
  if (!config) return res.json(null);

  const credentials = (config.credentials || {}) as any;
  const smtp = credentials.smtp || {};
  const crypto = credentials.crypto || {};
  const atv = credentials.atv || {};
  const settings = withSettingsDefaults((config.settings || {}) as any, globalConfig);

  const readinessIssues: string[] = [];
  const issuer = (settings.issuer || {}) as any;
  const atvMode = String(settings?.atv?.mode || "manual");
  const atvSettings = (settings?.atv || {}) as any;
  const atvEndpoints = (atvSettings.endpoints || {}) as any;

  if (!config.enabled) readinessIssues.push("EINVOICING_DISABLED");
  if (!issuer?.idNumber) readinessIssues.push("ISSUER_ID_NUMBER_MISSING");
  if (!issuer?.countryCode) readinessIssues.push("ISSUER_COUNTRY_CODE_MISSING");

  // These are needed for a full microfactura submission flow (sign + send),
  // but the current implementation stores documents as DRAFT and does not submit yet.
  if (!crypto?.certificateBase64) readinessIssues.push("CERTIFICATE_MISSING");
  if (!crypto?.certificatePassword) readinessIssues.push("CERTIFICATE_PASSWORD_MISSING");

  if (atvMode === "api") {
    if (!settings?.atv?.username) readinessIssues.push("ATV_USERNAME_MISSING");
    if (!atv?.password) readinessIssues.push("ATV_PASSWORD_MISSING");
    if (!atv?.clientSecret) readinessIssues.push("ATV_CLIENT_SECRET_MISSING");
    if (!settings?.atv?.clientId) readinessIssues.push("ATV_CLIENT_ID_MISSING");
  }

  const redacted = {
    ...config,
    credentials: {
      smtp: Object.fromEntries(
        Object.entries(smtp).map(([k, v]: any) => [
          k,
          { hasPassword: Boolean(v?.password) },
        ])
      ),
      crypto: {
        hasCertificate: Boolean(crypto?.certificateBase64),
        hasCertificatePassword: Boolean(crypto?.certificatePassword),
      },
      atv: {
        hasClientSecret: Boolean(atv?.clientSecret),
        hasPassword: Boolean(atv?.password),
      },
    },
    settings,
    readiness: {
      ok: readinessIssues.length === 0,
      issues: readinessIssues,
      atvMode,
      provider: config.provider,
      environment: config.environment,
    },
  };

  // Persist defaults once to keep config consistent per tenant.
  try {
    const currentSettings = (config.settings || {}) as any;
    if (
      !Array.isArray(currentSettings?.printForms) ||
      (currentSettings?.printForms || []).length === 0 ||
      !currentSettings?.moduleBranding ||
      !currentSettings?.moduleConnections
    ) {
      await prisma.eInvoicingConfig.update({
        where: { hotelId },
        data: { settings: settings as any },
      });
    }
  } catch {
    // ignore persistence of defaults
  }

  return res.json(redacted);
}

export async function updateEInvoicingConfig(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const payload = req.body as Partial<{
    enabled: boolean;
    version: string;
    provider: string;
    environment: string;
    credentials: any;
    settings: any;
  }>;
  const current = await prisma.eInvoicingConfig.findUnique({ where: { hotelId } });
  const currentCreds = ((current?.credentials as any) || {}) as any;
  const nextCredsInput = (payload.credentials || {}) as any;

  const mergeSecrets = (cur: any, incoming: any) => {
    const next = { ...(cur || {}) };

    // SMTP passwords per module
    if (incoming.smtp && typeof incoming.smtp === "object") {
      next.smtp = { ...(next.smtp || {}) };
      for (const [moduleKey, v] of Object.entries(incoming.smtp)) {
        const incomingPass = (v as any)?.password;
        const hasPass = typeof incomingPass === "string" && incomingPass.trim().length > 0;
        next.smtp[moduleKey] = {
          ...(next.smtp[moduleKey] || {}),
          ...(hasPass ? { password: incomingPass } : {}),
        };
      }
    }

    // ATV secrets
    if (incoming.atv && typeof incoming.atv === "object") {
      const nextAtv = { ...(next.atv || {}) };
      if (typeof incoming.atv.clientSecret === "string" && incoming.atv.clientSecret.trim()) {
        nextAtv.clientSecret = incoming.atv.clientSecret;
      }
      if (typeof incoming.atv.password === "string" && incoming.atv.password.trim()) {
        nextAtv.password = incoming.atv.password;
      }
      next.atv = nextAtv;
    }

    // Crypto secrets (certificate and password)
    if (incoming.crypto && typeof incoming.crypto === "object") {
      const nextCrypto = { ...(next.crypto || {}) };
      if (typeof incoming.crypto.certificateBase64 === "string" && incoming.crypto.certificateBase64.trim()) {
        nextCrypto.certificateBase64 = incoming.crypto.certificateBase64;
      }
      if (typeof incoming.crypto.certificatePassword === "string" && incoming.crypto.certificatePassword.trim()) {
        nextCrypto.certificatePassword = incoming.crypto.certificatePassword;
      }
      next.crypto = nextCrypto;
    }

    return next;
  };

  const mergedCredentials = mergeSecrets(currentCreds, nextCredsInput);
  const saasConfig = await prisma.saasConfig.findUnique({ where: { key: SAAS_CONFIG_KEY } });
  const globalConfig = (saasConfig as any)?.printFormsGlobal;
  const normalizedSettings =
    payload.settings && typeof payload.settings === "object"
      ? withSettingsDefaults(payload.settings, globalConfig)
      : undefined;

  await prisma.eInvoicingConfig.upsert({
    where: { hotelId },
    update: {
      enabled: payload.enabled ?? undefined,
      version: payload.version ?? undefined,
      provider: payload.provider ?? undefined,
      environment: payload.environment ?? undefined,
      credentials: mergedCredentials,
      settings: normalizedSettings ?? undefined,
    },
    create: {
      hotelId,
      enabled: Boolean(payload.enabled),
      version: payload.version || "CR-4.4",
      provider: payload.provider || "hacienda-cr",
      environment: payload.environment || "sandbox",
      credentials: mergedCredentials ?? {},
      settings: normalizedSettings ?? {},
    },
  });
  // Return redacted config
  return getEInvoicingConfig(req, res);
}

export async function listEInvoicingRequirements(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  await ensureDefaults(hotelId);
  const list = await prisma.eInvoicingRequirement.findMany({
    where: { hotelId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return res.json(list);
}

export async function replaceEInvoicingRequirements(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const items = Array.isArray(req.body) ? req.body : (req.body?.items ?? []);
  if (!Array.isArray(items)) return res.status(400).json({ message: "items debe ser un array" });

  const normalized = items
    .map((x: any, idx: number) => ({
      hotelId,
      code: String(x.code || `REQ-${idx + 1}`).trim(),
      category: String(x.category || "General").trim(),
      title: String(x.title || "").trim(),
      description: String(x.description || "").trim(),
      required: Boolean(x.required ?? true),
      status: String(x.status || "PENDING").trim(),
      notes: typeof x.notes === "string" ? x.notes : null,
      sortOrder: Number.isFinite(Number(x.sortOrder)) ? Number(x.sortOrder) : idx * 10,
      version: String(x.version || "CR-4.4").trim(),
    }))
    .filter((x: any) => x.code && x.title);

  await prisma.eInvoicingRequirement.deleteMany({ where: { hotelId } });
  if (normalized.length) {
    await prisma.eInvoicingRequirement.createMany({ data: normalized, skipDuplicates: true });
  }
  const list = await prisma.eInvoicingRequirement.findMany({
    where: { hotelId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return res.json(list);
}

export async function listEInvoicingDocuments(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });

  const q = String((req.query as any)?.q || "").trim();
  const restaurantOrderId = String((req.query as any)?.restaurantOrderId || "").trim();
  const docType = String((req.query as any)?.docType || "").trim().toUpperCase();
  const status = String((req.query as any)?.status || "").trim().toUpperCase();
  const source = String((req.query as any)?.source || "").trim().toLowerCase();
  const dateFrom = String((req.query as any)?.dateFrom || "").trim();
  const dateTo = String((req.query as any)?.dateTo || "").trim();

  const where: any = { hotelId };
  if (docType) where.docType = docType;
  if (status) where.status = status;
  if (source) where.payload = { path: ["source"], equals: source };
  if (restaurantOrderId) where.restaurantOrderId = restaurantOrderId;

  const and: any[] = [];

  if (dateFrom) {
    const d = new Date(dateFrom);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "dateFrom invalida" });
    and.push({ createdAt: { gte: d } });
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ message: "dateTo invalida" });
    d.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: d } });
  }

  if (q) {
    and.push({
      OR: [
        { consecutive: { contains: q, mode: "insensitive" } },
        { key: { contains: q, mode: "insensitive" } },
        { invoice: { number: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (and.length) where.AND = and;

  const list = await prisma.eInvoicingDocument.findMany({
    where,
    include: {
      invoice: { select: { id: true, number: true, total: true, currency: true } },
      restaurantOrder: { select: { id: true, tableId: true, sectionId: true, total: true, serviceType: true, roomId: true } },
      _count: { select: { acknowledgements: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return res.json(
    list.map((d) => ({
      id: d.id,
      docType: d.docType,
      status: d.status,
      branch: d.branch,
      terminal: d.terminal,
      consecutive: d.consecutive,
      key: d.key,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      source: (d.payload as any)?.source || null,
      invoice: d.invoice,
      restaurantOrder: d.restaurantOrder,
      ackCount: (d as any)?._count?.acknowledgements ?? 0,
    }))
  );
}

export async function getEInvoicingDocument(req: Request, res: Response) {
  const hotelId = resolveHotelId(req);
  if (!hotelId) return res.status(400).json({ message: "Hotel no definido en token" });
  const id = String((req.params as any)?.id || "").trim();
  if (!id) return res.status(400).json({ message: "id requerido" });

  const doc = await prisma.eInvoicingDocument.findFirst({
    where: { id, hotelId },
    include: {
      invoice: { select: { id: true, number: true, total: true, currency: true, status: true, createdAt: true } },
      restaurantOrder: { select: { id: true, tableId: true, sectionId: true, total: true, serviceType: true, roomId: true, createdAt: true, updatedAt: true } },
      acknowledgements: {
        select: { id: true, type: true, status: true, message: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { acknowledgements: true } },
    },
  });
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });

  return res.json({
    id: doc.id,
    hotelId: doc.hotelId,
    invoiceId: doc.invoiceId,
    docType: doc.docType,
    status: doc.status,
    branch: doc.branch,
    terminal: doc.terminal,
    consecutive: doc.consecutive,
    key: doc.key,
    receiver: doc.receiver,
    payload: doc.payload,
    xmlSigned: doc.xmlSigned,
    response: doc.response,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    source: (doc.payload as any)?.source || null,
    invoice: doc.invoice,
    restaurantOrder: doc.restaurantOrder,
    ackCount: (doc as any)?._count?.acknowledgements ?? 0,
    acknowledgements: doc.acknowledgements,
  });
}
