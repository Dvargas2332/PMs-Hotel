export const DEFAULT_PRINT_FORMS = [
  // Restaurant
  { id: "restaurant_comanda_80mm_standard", module: "restaurant", docType: "COMANDA", paperType: "80mm", name: "Restaurant Comanda (80mm) - Standard" },
  { id: "restaurant_comanda_58mm_standard", module: "restaurant", docType: "COMANDA", paperType: "58mm", name: "Restaurant Comanda (58mm) - Standard" },
  { id: "restaurant_comanda_a4_standard", module: "restaurant", docType: "COMANDA", paperType: "A4", name: "Restaurant Comanda (A4) - Standard" },
  { id: "restaurant_te_80mm_standard", module: "restaurant", docType: "TE", paperType: "80mm", name: "Restaurant Ticket (TE) - 80mm" },
  { id: "restaurant_te_58mm_standard", module: "restaurant", docType: "TE", paperType: "58mm", name: "Restaurant Ticket (TE) - 58mm" },
  { id: "restaurant_te_a4_standard", module: "restaurant", docType: "TE", paperType: "A4", name: "Restaurant Ticket (TE) - A4" },
  { id: "restaurant_fe_80mm_standard", module: "restaurant", docType: "FE", paperType: "80mm", name: "Restaurant Invoice (FE) - 80mm" },
  { id: "restaurant_fe_58mm_standard", module: "restaurant", docType: "FE", paperType: "58mm", name: "Restaurant Invoice (FE) - 58mm" },
  { id: "restaurant_fe_a4_standard", module: "restaurant", docType: "FE", paperType: "A4", name: "Restaurant Invoice (FE) - A4" },
  { id: "restaurant_closes_80mm_standard", module: "restaurant", docType: "CLOSES", paperType: "80mm", name: "Restaurant Close - 80mm" },
  { id: "restaurant_closes_58mm_standard", module: "restaurant", docType: "CLOSES", paperType: "58mm", name: "Restaurant Close - 58mm" },
  { id: "restaurant_closes_a4_standard", module: "restaurant", docType: "CLOSES", paperType: "A4", name: "Restaurant Close - A4" },
  { id: "restaurant_document_80mm_standard", module: "restaurant", docType: "DOCUMENT", paperType: "80mm", name: "Restaurant Subfactura - 80mm" },
  { id: "restaurant_document_58mm_standard", module: "restaurant", docType: "DOCUMENT", paperType: "58mm", name: "Restaurant Subfactura - 58mm" },
  { id: "restaurant_document_a4_standard", module: "restaurant", docType: "DOCUMENT", paperType: "A4", name: "Restaurant Subfactura - A4" },

  // Frontdesk
  { id: "frontdesk_te_80mm_standard", module: "frontdesk", docType: "TE", paperType: "80mm", name: "Front Desk Ticket (TE) - 80mm" },
  { id: "frontdesk_te_58mm_standard", module: "frontdesk", docType: "TE", paperType: "58mm", name: "Front Desk Ticket (TE) - 58mm" },
  { id: "frontdesk_te_a4_standard", module: "frontdesk", docType: "TE", paperType: "A4", name: "Front Desk Ticket (TE) - A4" },
  { id: "frontdesk_fe_80mm_standard", module: "frontdesk", docType: "FE", paperType: "80mm", name: "Front Desk Invoice (FE) - 80mm" },
  { id: "frontdesk_fe_58mm_standard", module: "frontdesk", docType: "FE", paperType: "58mm", name: "Front Desk Invoice (FE) - 58mm" },
  { id: "frontdesk_fe_a4_standard", module: "frontdesk", docType: "FE", paperType: "A4", name: "Front Desk Invoice (FE) - A4" },
  { id: "frontdesk_document_80mm_standard", module: "frontdesk", docType: "DOCUMENT", paperType: "80mm", name: "Front Desk Document - 80mm" },
  { id: "frontdesk_document_58mm_standard", module: "frontdesk", docType: "DOCUMENT", paperType: "58mm", name: "Front Desk Document - 58mm" },
  { id: "frontdesk_document_a4_standard", module: "frontdesk", docType: "DOCUMENT", paperType: "A4", name: "Front Desk Document - A4" },
];

export const DEFAULT_PRINT_MODULES: Record<string, boolean> = {
  frontdesk: true,
  restaurant: true,
  accounting: false,
  einvoicing: false,
};

const normalizeFormId = (value: any) => String(value || "").trim();

export function normalizeGlobalPrintForms(input: any) {
  const baseModules: Record<string, boolean> = { ...DEFAULT_PRINT_MODULES };
  if (!input) return { formIds: [], modules: baseModules };
  if (Array.isArray(input)) {
    const formIds = input
      .map((f: any) => normalizeFormId(f?.id || f))
      .filter(Boolean);
    return { formIds, modules: baseModules };
  }
  if (typeof input === "object") {
    const formIds = Array.isArray((input as any).formIds)
      ? (input as any).formIds.map((id: any) => normalizeFormId(id)).filter(Boolean)
      : [];
    const modules = { ...baseModules } as Record<string, boolean>;
    const incoming = (input as any).modules as Record<string, boolean> | undefined;
    if (incoming && typeof incoming === "object") {
      for (const key of Object.keys(modules)) {
        if (typeof incoming[key] === "boolean") modules[key] = incoming[key];
      }
    }
    return { formIds, modules };
  }
  return { formIds: [], modules: baseModules };
}

export function resolvePrintForms(localForms: any, globalConfig: any) {
  const localList = Array.isArray(localForms) ? localForms : [];
  const global = normalizeGlobalPrintForms(globalConfig);
  const globalFormIds = new Set(global.formIds);
  const globalForms = DEFAULT_PRINT_FORMS.filter((f) => globalFormIds.has(f.id));

  const groupByModule = (forms: any[]) =>
    forms.reduce((acc: Record<string, any[]>, f) => {
      const key = String(f?.module || "").toLowerCase();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(f);
      return acc;
    }, {});

  const localBy = groupByModule(localList);
  const defaultBy = groupByModule(DEFAULT_PRINT_FORMS);
  const globalBy = groupByModule(globalForms);

  const modules = new Set<string>([
    ...Object.keys(defaultBy),
    ...Object.keys(localBy),
    ...Object.keys(global.modules || {}),
  ]);

  const result: any[] = [];
  for (const moduleKey of modules) {
    if (!moduleKey) continue;
    const useGlobal = Boolean((global.modules as Record<string, boolean> | undefined)?.[moduleKey]);
    if (useGlobal && globalBy[moduleKey]?.length) {
      result.push(...globalBy[moduleKey]);
      continue;
    }
    if (localBy[moduleKey]?.length) {
      result.push(...localBy[moduleKey]);
      continue;
    }
    if (defaultBy[moduleKey]?.length) {
      result.push(...defaultBy[moduleKey]);
    }
  }
  return result;
}
