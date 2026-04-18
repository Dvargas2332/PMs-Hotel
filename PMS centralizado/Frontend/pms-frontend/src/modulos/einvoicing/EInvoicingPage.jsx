import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { FileCheck2, Search, RefreshCw, Download, Upload, BookOpen, Tag, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import EInvoicingUserMenu from "./EInvoicingUserMenu";
import * as XLSX from "xlsx";
import { useLanguage } from "../../context/LanguageContext";
import { sanitizeImageUrl } from "../../lib/security";

export default function EInvoicingPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const cabysCacheRef = React.useRef(new Map());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [docsLoading, setDocsLoading] = React.useState(false);
  const [docs, setDocs] = React.useState([]);
  const [docsFilters, setDocsFilters] = React.useState({
    q: "",
    docType: "",
    status: "",
    source: "",
    dateFrom: "",
    dateTo: "",
  });
  const [acksLoading, setAcksLoading] = React.useState(false);
  const [acks, setAcks] = React.useState([]);
  const [acksFilters, setAcksFilters] = React.useState({
    q: "",
    docId: "",
    docType: "",
    type: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [ackDetailOpen, setAckDetailOpen] = React.useState(false);
  const [ackDetailLoading, setAckDetailLoading] = React.useState(false);
  const [ackDetail, setAckDetail] = React.useState(null);
  const [ackCreateOpen, setAckCreateOpen] = React.useState(false);
  const [ackCreateForm, setAckCreateForm] = React.useState({
    documentId: "",
    type: "HACIENDA_RECEIPT",
    status: "RECEIVED",
    message: "",
    payloadText: "",
  });
  const [docDetailOpen, setDocDetailOpen] = React.useState(false);
  const [docDetailLoading, setDocDetailLoading] = React.useState(false);
  const [docDetail, setDocDetail] = React.useState(null);
  const [cfg, setCfg] = React.useState({
    enabled: false,
    version: "CR-4.4",
    provider: "hacienda-cr",
    environment: "sandbox",
    settings: {},
    credentials: {},
  });
  const [panel, setPanel] = React.useState("documents");
  const [generalTab, setGeneralTab] = React.useState("core"); // core | connections | forms | smtp | atv | certificate
  const [secretMeta, setSecretMeta] = React.useState({ smtp: {}, atv: {}, crypto: {} });
  const [secrets, setSecrets] = React.useState({ smtp: {}, atv: {}, crypto: {} });
  const haciendaEndpoints =
    String(cfg.environment || "sandbox").toLowerCase() === "production"
      ? {
          tokenUrl: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
          sendUrl: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/",
          statusUrl: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/{clave}",
        }
      : {
          tokenUrl: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
          sendUrl: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/",
          statusUrl: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion/{clave}",
        };

  // Catalogs (CABYS + official catalogs loaded per-hotel)
  const [catalogTab, setCatalogTab] = React.useState("cabys"); // cabys | catalogs
  const [cabysQuery, setCabysQuery] = React.useState("");
  const [cabysLoading, setCabysLoading] = React.useState(false);
  const [cabysRows, setCabysRows] = React.useState([]);
  const [cabysSelected, setCabysSelected] = React.useState({});
  const [cabysImportText, setCabysImportText] = React.useState("");

  const [catalogName, setCatalogName] = React.useState("paymentMethods");
  const [catalogQuery, setCatalogQuery] = React.useState("");
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogRows, setCatalogRows] = React.useState([]);
  const [catalogImportText, setCatalogImportText] = React.useState("");
  const [cabysImportItems, setCabysImportItems] = React.useState([]);
  const [xmlImporting, setXmlImporting] = React.useState(false);
  const [catalogImportItems, setCatalogImportItems] = React.useState([]);
  const [cabysSyncLoading, setCabysSyncLoading] = React.useState(false);
  const [cabysSyncQuery, setCabysSyncQuery] = React.useState("");
  const [cabysSavedCount, setCabysSavedCount] = React.useState(null);
  const [cabysHaciendaRows, setCabysHaciendaRows] = React.useState([]);
  const [cabysHaciendaLoading, setCabysHaciendaLoading] = React.useState(false);
  const [cabysHaciendaQuery, setCabysHaciendaQuery] = React.useState("");
  const [cabysHaciendaSelected, setCabysHaciendaSelected] = React.useState({});

  const formatOnlyDate = React.useCallback((value) => {
    if (!value) return "";
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString();
  }, []);

  const getInvoiceDisplayNumber = React.useCallback((doc) => {
    return doc?.invoice?.number || doc?.restaurantOrder?.saleNumber || "-";
  }, []);

  const parseCsv = React.useCallback((input) => {
    const text = String(input || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const linesForDetect = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10);

    const detectDelimiter = (line) => {
      const counts = {
        ",": (line.match(/,/g) || []).length,
        ";": (line.match(/;/g) || []).length,
        "\t": (line.match(/\t/g) || []).length,
      };
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return best && best[1] > 0 ? best[0] : ","; // default comma
    };

    const delimiter = detectDelimiter(linesForDetect[0] || "");

    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const pushField = () => {
      row.push(field);
      field = "";
    };
    const pushRow = () => {
      if (row.length || field.length) {
        pushField();
        rows.push(row);
      }
      row = [];
      field = "";
    };

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          field += '"';
          i++;
          continue;
        }
        if (ch === '"') {
          inQuotes = false;
          continue;
        }
        field += ch;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === delimiter) {
        pushField();
        continue;
      }
      if (ch === "\n") {
        pushRow();
        continue;
      }
      field += ch;
    }
    pushRow();

    return rows.map((r) => r.map((c) => String(c ?? "").trim()));
  }, []);

  const rowsToItems = React.useCallback((rows) => {
    const out = [];
    for (const r of rows || []) {
      if (!r || r.length < 2) continue;
      const code = String(r[0] || "").trim();
      const label = String(r[1] || "").trim();
      if (!code || !label) continue;
      const lc = code.toLowerCase();
      if (["code", "codigo", "cabys", "id"].includes(lc)) continue; // header
      out.push({ code, label });
    }
    return out;
  }, []);

  const parseXlsx = React.useCallback(async (file) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
    });
    return Array.isArray(rows) ? rows.map((r) => r.map((c) => String(c ?? "").trim())) : [];
  }, []);

  const onPickCsv = React.useCallback(
    (file, setItems, setText) => {
      if (!file) return;
      const name = String(file.name || "").toLowerCase();
      const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
      if (isXlsx) {
        parseXlsx(file)
          .then((rows) => {
            const items = rowsToItems(rows);
            setItems(items);
            setText("");
            window.dispatchEvent(
              new CustomEvent("pms:push-alert", {
                detail: {
                  title: "XLSX",
                  desc: t("einv.alert.rowsLoaded", { count: items.length, file: file.name }),
                },
              })
            );
          })
          .catch(() => {
            window.dispatchEvent(
              new CustomEvent("pms:push-alert", {
                detail: { title: "XLSX", desc: t("einv.alert.xlsxReadFailed") },
              })
            );
          });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        const rows = parseCsv(text);
        const items = rowsToItems(rows);
        setItems(items);
        setText("");
        window.dispatchEvent(
          new CustomEvent("pms:push-alert", {
            detail: {
              title: "CSV",
              desc: t("einv.alert.rowsLoaded", { count: items.length, file: file.name }),
            },
          })
        );
      };
      reader.readAsText(file, "utf-8");
    },
    [parseCsv, parseXlsx, rowsToItems, t]
  );

  const fetchCabysRemote = React.useCallback(async (query) => {
    const q = String(query || "").trim();
    const isCode = /^\d{13}$/.test(q);
    if (!q || (!isCode && q.length < 3)) return [];
    const cacheKey = isCode ? `code:${q}` : `q:${q.toLowerCase()}`;
    const now = Date.now();
    const cached = cabysCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.items;
    const params = new URLSearchParams();
    if (isCode) {
      params.set("codigo", q);
    } else {
      params.set("q", q);
      params.set("top", "80");
    }
    const res = await fetch(`https://api.hacienda.go.cr/fe/cabys?${params.toString()}`);
    if (!res.ok) throw new Error("remote");
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const items = data.map((r) => ({
      id: String(r.codigo || r.id || ""),
      description: String(r.descripcion || r.description || ""),
    }));
    cabysCacheRef.current.set(cacheKey, { items, expiresAt: now + 1000 * 60 * 30 });
    return items;
  }, []);

  const loadCabys = async (opts = {}) => {
    setCabysLoading(true);
    try {
      const preferRemote = Boolean(opts.remote ?? true);
      if (preferRemote) {
        try {
          const remoteRows = await fetchCabysRemote(cabysQuery);
          if (remoteRows.length) {
            setCabysRows(remoteRows);
            return;
          }
        } catch {
          // fallback to backend
        }
      }
      const qs = new URLSearchParams();
      if (cabysQuery) qs.set("q", cabysQuery);
      qs.set("take", "80");
      const { data } = await api.get(`/einvoicing/cabys?${qs.toString()}`);
      setCabysRows(Array.isArray(data) ? data : []);
    } catch {
      setCabysRows([]);
    } finally {
      setCabysLoading(false);
    }
  };

  const importXmlFile = async (file) => {
    if (!file) return;
    setXmlImporting(true);
    try {
      const xml = await file.text();
      const { data } = await api.post("/einvoicing/documents/import-xml", { xml });
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: {
            title: "XML",
            desc: data?.reused ? t("einv.alert.xmlExists") : t("einv.alert.imported"),
          },
        })
      );
      await loadDocuments();
      if (data?.id) openDocDetail(String(data.id));
    } catch (err) {
      const msg = err?.response?.data?.message || t("einv.alert.xmlImportFailed");
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "XML", desc: msg } }));
    } finally {
      setXmlImporting(false);
    }
  };

  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const qs = new URLSearchParams();
      if (catalogQuery) qs.set("q", catalogQuery);
      qs.set("take", "120");
      const { data } = await api.get(`/einvoicing/catalogs/${encodeURIComponent(catalogName)}?${qs.toString()}`);
      setCatalogRows(Array.isArray(data) ? data : []);
    } catch {
      setCatalogRows([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const doImportCabys = async (mode = "replace") => {
    const hasItems = Array.isArray(cabysImportItems) && cabysImportItems.length > 0;
    const hasText = cabysImportText.trim().length > 0;
    if (!hasItems && !hasText) return;
    await api.post("/einvoicing/cabys/import", hasItems ? { mode, items: cabysImportItems } : { mode, text: cabysImportText });
    setCabysImportText("");
    setCabysImportItems([]);
    await loadCabys();
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "CABYS", desc: t("einv.alert.imported") } }));
  };

  const importCabysResults = async () => {
    if (!cabysRows.length) return;
    if (!window.confirm(t("einv.catalogs.importConfirm"))) return;
    const items = cabysRows
      .map((r) => ({
        code: String(r.id || r.code || "").trim(),
        label: String(r.description || r.label || "").trim(),
      }))
      .filter((r) => r.code && r.label);
    if (!items.length) return;
    await api.post("/einvoicing/cabys/import", { mode: "merge", items });
    await loadCabys();
    window.dispatchEvent(
      new CustomEvent("pms:push-alert", {
        detail: { title: "CABYS", desc: t("einv.catalogs.importedCount", { count: items.length }) },
      })
    );
  };

  const importCabysSelected = async () => {
    const selectedIds = Object.keys(cabysSelected).filter((k) => cabysSelected[k]);
    if (!selectedIds.length) return;
    if (!window.confirm(t("einv.catalogs.importConfirmSelected"))) return;
    const items = cabysRows
      .filter((r) => selectedIds.includes(String(r.id || r.code || "")))
      .map((r) => ({
        code: String(r.id || r.code || "").trim(),
        label: String(r.description || r.label || "").trim(),
      }))
      .filter((r) => r.code && r.label);
    if (!items.length) return;
    await api.post("/einvoicing/cabys/import", { mode: "merge", items });
    await loadCabys();
    setCabysSelected({});
    window.dispatchEvent(
      new CustomEvent("pms:push-alert", {
        detail: { title: "CABYS", desc: t("einv.catalogs.importedCount", { count: items.length }) },
      })
    );
  };
  const searchCabysHacienda = async () => {
    const q = cabysHaciendaQuery.trim();
    if (q.length < 3) return;
    setCabysHaciendaLoading(true);
    setCabysHaciendaRows([]);
    setCabysHaciendaSelected({});
    try {
      const { data } = await api.get(`/einvoicing/cabys/hacienda?q=${encodeURIComponent(q)}&top=80`);
      setCabysHaciendaRows(Array.isArray(data) ? data : []);
    } catch {
      setCabysHaciendaRows([]);
    } finally {
      setCabysHaciendaLoading(false);
    }
  };

  const importSelectedFromHacienda = async () => {
    const selectedIds = Object.keys(cabysHaciendaSelected).filter((k) => cabysHaciendaSelected[k]);
    if (!selectedIds.length) return;
    const items = cabysHaciendaRows
      .filter((r) => selectedIds.includes(String(r.id)))
      .map((r) => ({ code: String(r.id), label: String(r.description) }));
    await api.post("/einvoicing/cabys/import", { mode: "merge", items });
    setCabysHaciendaSelected({});
    await loadCabys();
    window.dispatchEvent(new CustomEvent("pms:push-alert", {
      detail: { title: "CABYS", desc: `${items.length} código(s) guardados en catálogo del hotel` },
    }));
  };

  const importAllFromHacienda = async () => {
    if (!cabysHaciendaRows.length) return;
    const items = cabysHaciendaRows.map((r) => ({ code: String(r.id), label: String(r.description) }));
    await api.post("/einvoicing/cabys/import", { mode: "merge", items });
    await loadCabys();
    window.dispatchEvent(new CustomEvent("pms:push-alert", {
      detail: { title: "CABYS", desc: `${items.length} código(s) guardados en catálogo del hotel` },
    }));
  };

  const syncCabysFromHacienda = async () => {
    const q = cabysSyncQuery.trim();
    if (!q) return;
    setCabysSyncLoading(true);
    setCabysSavedCount(null);
    try {
      const { data } = await api.post("/einvoicing/cabys/sync", { q, top: 200, mode: "merge" });
      setCabysSavedCount(data?.synced ?? 0);
      await loadCabys();
      window.dispatchEvent(new CustomEvent("pms:push-alert", {
        detail: { title: "CABYS Sync", desc: `${data?.synced ?? 0} código(s) sincronizados desde Hacienda` },
      }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("pms:push-alert", {
        detail: { title: "CABYS Sync", desc: err?.response?.data?.message || "Error al sincronizar" },
      }));
    } finally {
      setCabysSyncLoading(false);
    }
  };

  const doImportCatalog = async (mode = "replace") => {
    const hasItems = Array.isArray(catalogImportItems) && catalogImportItems.length > 0;
    const hasText = catalogImportText.trim().length > 0;
    if (!hasItems && !hasText) return;
    await api.post(`/einvoicing/catalogs/${encodeURIComponent(catalogName)}/import`, {
      mode,
      version: cfg?.version || "CR-4.4",
      ...(hasItems ? { items: catalogImportItems } : { text: catalogImportText }),
    });
    setCatalogImportText("");
    setCatalogImportItems([]);
    await loadCatalog();
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Catalog", desc: t("einv.alert.imported") } }));
  };

  const defaultModuleConnections = React.useMemo(
    () => ({ frontdesk: true, restaurant: true, accounting: false }),
    []
  );

  const defaultSmtpSettings = React.useCallback((provider) => {
    if (provider === "gmail") return { host: "smtp.gmail.com", port: 587, secure: false };
    if (provider === "hotmail") return { host: "smtp.office365.com", port: 587, secure: false };
    return { host: "", port: 587, secure: false };
  }, []);

  const ensureSettings = React.useCallback(
    (input) => {
      const settings = (input && typeof input === "object" ? input : {}) || {};
      const moduleConnections = { ...defaultModuleConnections, ...(settings.moduleConnections || {}) };
      const moduleEmail = { ...(settings.moduleEmail || {}) };
      const normalizeEmail = (key) => {
        const cur = moduleEmail[key] || {};
        const provider = cur.provider || "gmail";
        const defaults = defaultSmtpSettings(provider);
        moduleEmail[key] = {
          fromEmail: cur.fromEmail || "",
          provider,
          smtpHost: cur.smtpHost || defaults.host,
          smtpPort: Number(cur.smtpPort || defaults.port),
          smtpSecure: Boolean(cur.smtpSecure ?? defaults.secure),
          smtpUsername: cur.smtpUsername || "",
        };
      };
      normalizeEmail("frontdesk");
      normalizeEmail("restaurant");
      normalizeEmail("accounting");

      const atv = { ...(settings.atv || {}) };
      const crypto = { ...(settings.crypto || {}) };
      const issuer = { ...(settings.issuer || {}) };
      const frontdesk = { ...(settings.frontdesk || {}) };
      const restaurant = { ...(settings.restaurant || {}) };
      const moduleBranding = { ...(settings.moduleBranding || {}) };
      moduleBranding.frontdesk = { ...(moduleBranding.frontdesk || {}) };
      moduleBranding.restaurant = { ...(moduleBranding.restaurant || {}) };
      moduleBranding.accounting = { ...(moduleBranding.accounting || {}) };
      const printForms = Array.isArray(settings.printForms) ? settings.printForms : [];

      return {
        ...settings,
        moduleConnections,
        moduleEmail,
        moduleBranding,
        printForms,
        issuer: {
          countryCode: issuer.countryCode || "506",
          idNumber: issuer.idNumber || "",
          name: issuer.name || "",
        },
        frontdesk: {
          branch: frontdesk.branch || "001",
          terminal: frontdesk.terminal || "00001",
          situation: frontdesk.situation || "1",
        },
        restaurant: {
          branch: restaurant.branch || "001",
          terminal: restaurant.terminal || "00001",
          situation: restaurant.situation || "1",
        },
        atv: {
          mode: atv.mode || "manual",
          username: atv.username || "",
          notes: atv.notes || "",
        },
        crypto: {
          certificateName: crypto.certificateName || "",
        },
      };
    },
    [defaultModuleConnections, defaultSmtpSettings]
  );

  const PRINT_FORM_FIELDS = React.useMemo(
    () => [
      { key: "logo", label: t("einv.forms.fields.logo") },
      { key: "issuerName", label: t("einv.forms.fields.issuerName") },
      { key: "issuerId", label: t("einv.forms.fields.issuerId") },
      { key: "issuerContact", label: t("einv.forms.fields.issuerContact") },
      { key: "issuerAddress", label: t("einv.forms.fields.issuerAddress") },
      { key: "customer", label: t("einv.forms.fields.customer") },
      { key: "tableRoom", label: t("einv.forms.fields.tableRoom") },
      { key: "items", label: t("einv.forms.fields.items") },
      { key: "taxes", label: t("einv.forms.fields.taxes") },
      { key: "totals", label: t("einv.forms.fields.totals") },
      { key: "payments", label: t("einv.forms.fields.payments") },
      { key: "notes", label: t("einv.forms.fields.notes") },
      { key: "qr", label: t("einv.forms.fields.qr") },
    ],
    [t]
  );

  const [formEditor, setFormEditor] = React.useState({
    id: "",
    name: "",
    module: "restaurant",
    docType: "TE",
    paperType: "80mm",
    fields: {
      logo: true,
      issuerName: true,
      issuerId: true,
      issuerContact: true,
      issuerAddress: true,
      customer: true,
      tableRoom: true,
      items: true,
      taxes: true,
      totals: true,
      payments: true,
      notes: true,
      qr: true,
    },
  });

  const upsertPrintForm = () => {
    const id = String(formEditor.id || "").trim() || `form_${Date.now()}`;
    const name = String(formEditor.name || "").trim();
    if (!name)
      return window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: t("einv.title"), desc: t("einv.forms.nameRequired") },
        })
      );

    setCfg((prev) => {
      const list = Array.isArray(prev.settings?.printForms) ? prev.settings.printForms : [];
      const next = {
        id,
        name,
        module: String(formEditor.module || "restaurant"),
        docType: String(formEditor.docType || "TE").toUpperCase(),
        paperType: String(formEditor.paperType || "80mm"),
        fields: { ...(formEditor.fields || {}) },
      };
      const idx = list.findIndex((f) => String(f?.id) === id);
      const nextList = idx >= 0 ? list.map((f, i) => (i === idx ? next : f)) : [next, ...list];
      return { ...prev, settings: { ...prev.settings, printForms: nextList } };
    });

    setFormEditor((p) => ({ ...p, id: id }));
  };

  const deletePrintForm = (id) => {
    if (!id) return;
    setCfg((prev) => {
      const list = Array.isArray(prev.settings?.printForms) ? prev.settings.printForms : [];
      return { ...prev, settings: { ...prev.settings, printForms: list.filter((f) => String(f?.id) !== String(id)) } };
    });
  };

  const editPrintForm = (f) => {
    if (!f) return;
    setFormEditor({
      id: String(f.id || ""),
      name: String(f.name || ""),
      module: String(f.module || "restaurant"),
      docType: String(f.docType || "TE").toUpperCase(),
      paperType: String(f.paperType || "80mm"),
      fields: { ...(f.fields || {}) },
    });
  };

  const onLogoFile = async (moduleKey, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setCfg((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          moduleBranding: {
            ...(prev.settings?.moduleBranding || {}),
            [moduleKey]: {
              ...((prev.settings?.moduleBranding || {})[moduleKey] || {}),
              logoDataUrl: dataUrl,
            },
          },
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const setSecret = React.useCallback((path, value) => {
    setSecrets((prev) => {
      const next = { ...prev };
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        cur[key] = { ...(cur[key] || {}) };
        cur = cur[key];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }, []);

  const toBase64 = (bytes) => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const onCertificateFile = async (file) => {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const base64 = toBase64(new Uint8Array(buffer));
    setCfg((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        crypto: { ...(prev.settings?.crypto || {}), certificateName: file.name },
      },
    }));
    setSecrets((prev) => ({
      ...prev,
      crypto: { ...(prev.crypto || {}), certificateBase64: base64 },
    }));
  };

  const loadConfig = React.useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent);
      if (!silent) setLoading(true);
      try {
        const cfgRes = await api.get("/einvoicing/config");
        const nextCfg = cfgRes.data || cfg;
        setCfg((prev) => ({
          ...prev,
          ...nextCfg,
          settings: ensureSettings(nextCfg?.settings),
        }));
        setSecretMeta(nextCfg?.credentials || { smtp: {}, atv: {}, crypto: {} });
      } catch {
        // ignore; UI will show defaults
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [cfg, ensureSettings]
  );

  React.useEffect(() => {
    if (panel !== "catalogs" || catalogTab !== "cabys") return;
    const q = String(cabysQuery || "").trim();
    const isCode = /^\d{13}$/.test(q);
    if (!q || (!isCode && q.length < 3)) {
      setCabysRows([]);
      return;
    }
    const handle = setTimeout(() => {
      loadCabys({ remote: true });
    }, 500);
    return () => clearTimeout(handle);
  }, [panel, catalogTab, cabysQuery, loadCabys]);

  const reload = async () => {
    await loadConfig();
    if (panel === "documents") await loadDocuments();
    if (panel === "acks") await loadAcks();
    if (panel === "catalogs") {
      await loadCabys();
      await loadCatalog();
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        ...cfg,
        settings: ensureSettings(cfg.settings),
        secrets,
      };
      try {
        await api.put("/einvoicing/config", payload);
      } catch {
        await api.post("/einvoicing/config", payload);
      }
      setSecrets({ smtp: {}, atv: {}, crypto: {} });
      await loadConfig({ silent: true });
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Electronic invoicing", desc: "Saved." } })
      );
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Electronic invoicing", desc: "Save failed." } })
      );
    } finally {
      setSaving(false);
    }
  };

  const loadDocuments = async () => {
    setDocsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (docsFilters.q) qs.set("q", docsFilters.q);
      if (docsFilters.docType) qs.set("docType", docsFilters.docType);
      if (docsFilters.status) qs.set("status", docsFilters.status);
      if (docsFilters.source) qs.set("source", docsFilters.source);
      if (docsFilters.dateFrom) qs.set("dateFrom", docsFilters.dateFrom);
      if (docsFilters.dateTo) qs.set("dateTo", docsFilters.dateTo);
      qs.set("take", "200");
      const { data } = await api.get(`/einvoicing/documents?${qs.toString()}`);
      setDocs(Array.isArray(data) ? data : []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const loadAcks = async () => {
    setAcksLoading(true);
    try {
      const qs = new URLSearchParams();
      if (acksFilters.q) qs.set("q", acksFilters.q);
      if (acksFilters.docId) qs.set("docId", acksFilters.docId);
      if (acksFilters.docType) qs.set("docType", acksFilters.docType);
      if (acksFilters.type) qs.set("type", acksFilters.type);
      if (acksFilters.status) qs.set("status", acksFilters.status);
      if (acksFilters.dateFrom) qs.set("dateFrom", acksFilters.dateFrom);
      if (acksFilters.dateTo) qs.set("dateTo", acksFilters.dateTo);
      qs.set("take", "200");
      const { data } = await api.get(`/einvoicing/acks?${qs.toString()}`);
      setAcks(Array.isArray(data) ? data : []);
    } catch {
      setAcks([]);
    } finally {
      setAcksLoading(false);
    }
  };

  const openDocDetail = async (id) => {
    if (!id) return;
    setDocDetailOpen(true);
    setDocDetailLoading(true);
    try {
      const { data } = await api.get(`/einvoicing/documents/${encodeURIComponent(String(id))}`);
      setDocDetail(data || null);
    } catch {
      setDocDetail(null);
    } finally {
      setDocDetailLoading(false);
    }
  };

  const closeDocDetail = () => {
    setDocDetailOpen(false);
    setDocDetail(null);
  };

  const refreshDoc = async (id) => {
    if (!id) return;
    try {
      await api.post(`/einvoicing/documents/${encodeURIComponent(String(id))}/refresh`);
    } catch {
      // ignore
    } finally {
      await openDocDetail(id);
      await loadDocuments();
    }
  };

  const submitDoc = async (id) => {
    if (!id) return;
    try {
      await api.post(`/einvoicing/documents/${encodeURIComponent(String(id))}/submit`);
    } catch {
      // ignore
    } finally {
      await openDocDetail(id);
      await loadDocuments();
    }
  };

  const cancelDoc = async (id) => {
    if (!id) return;
    try {
      await api.post(`/einvoicing/documents/${encodeURIComponent(String(id))}/cancel`);
    } catch {
      // ignore
    } finally {
      await openDocDetail(id);
      await loadDocuments();
    }
  };

  const openAckCreate = () => setAckCreateOpen(true);
  const closeAckCreate = () => setAckCreateOpen(false);

  const closeAckDetail = () => {
    setAckDetailOpen(false);
    setAckDetail(null);
  };

  const saveAckCreate = async () => {
    if (!ackCreateForm.documentId.trim()) {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: t("einv.ack.title"), desc: t("einv.ack.docIdRequired") },
        })
      );
      return;
    }

    let payload = null;
    const raw = String(ackCreateForm.payloadText || "").trim();
    if (raw) {
      const looksJson = raw.startsWith("{") || raw.startsWith("[");
      if (looksJson) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      } else {
        payload = raw;
      }
    }

    try {
      await api.post("/einvoicing/acks", {
        documentId: ackCreateForm.documentId.trim(),
        type: ackCreateForm.type,
        status: ackCreateForm.status,
        message: ackCreateForm.message,
        payload,
      });
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: t("einv.ack.title"), desc: t("einv.ack.saved") },
        })
      );
      setAckCreateOpen(false);
      await loadAcks();
      await loadDocuments();
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: t("einv.ack.title"), desc: t("einv.ack.saveFailed") },
        })
      );
    }
  };

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const cfgRes = await api.get("/einvoicing/config");
        if (mounted) {
          const nextCfg = cfgRes.data || cfg;
          setCfg((prev) => ({
            ...prev,
            ...nextCfg,
            settings: ensureSettings(nextCfg?.settings),
          }));
          setSecretMeta(nextCfg?.credentials || { smtp: {}, atv: {}, crypto: {} });
        }
      } catch {
        // ignore; UI will show defaults
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const panelTitle = React.useMemo(
    () => ({
      documents: t("einv.panel.documents"),
      acks: t("einv.panel.acks"),
      general: t("einv.panel.general"),
      issuer: t("einv.panel.issuer"),
      catalogs: t("einv.panel.catalogs"),
    }),
    [t]
  );

  const GENERAL_TABS = React.useMemo(
    () => [
      { id: "core", label: t("einv.generalTabs.core") },
      { id: "connections", label: t("einv.generalTabs.connections") },
      { id: "forms", label: t("einv.generalTabs.forms") },
      { id: "smtp", label: t("einv.generalTabs.smtp") },
      { id: "atv", label: t("einv.generalTabs.atv") },
      { id: "certificate", label: t("einv.generalTabs.certificate") },
    ],
    [t]
  );

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: "var(--shell-bg)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 backdrop-blur-sm" style={{ background: "var(--header-bg)", borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/90 to-fuchsia-600/80 shadow-lg shadow-violet-900/40">
            <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-6 w-6 object-contain" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wide font-medium bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{t("einv.title")}</div>
            <div className="text-sm font-semibold" style={{ color: "var(--color-text-base)" }}>{t("einv.subtitle")}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
          <div>
            {t("einv.status.label")}{" "}
            <span className={`font-semibold ${cfg.enabled ? "text-emerald-400" : "text-slate-500"}`}>
              {cfg.enabled ? t("einv.status.enabled") : t("einv.status.disabled")}
            </span>{" "}
            · <span style={{ color: "var(--color-text-base)" }}>{cfg.environment || "sandbox"}</span>
          </div>
          <EInvoicingUserMenu />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col overflow-hidden" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}>
          <div className="flex flex-col items-center justify-center py-6 gap-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/90 to-fuchsia-600/80 shadow-lg shadow-violet-900/40">
              <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-12 w-12 object-contain" />
            </div>
            <div className="text-xs font-semibold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent uppercase tracking-wide">{t("einv.title")}</div>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <div className="text-[11px] uppercase tracking-wide px-1 mb-2" style={{ color: "var(--color-text-muted)" }}>{t("einv.nav.title")}</div>
            {[
              { id: "documents", label: t("einv.nav.documents") },
              { id: "acks", label: t("einv.nav.acks") },
              { id: "issuer", label: t("einv.nav.issuer") },
              { id: "general", label: t("einv.nav.general") },
              { id: "catalogs", label: t("einv.nav.catalogs") },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPanel(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  panel === item.id
                    ? "bg-violet-500/20 text-violet-300 shadow shadow-violet-900/40"
                    : "hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={panel !== item.id ? { color: "var(--color-text-muted)" } : {}}
              >
                {item.label}
              </button>
            ))}
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--color-text-muted)" }}
              onClick={() => navigate("/launcher")}
            >
              {t("einv.nav.back")}
            </button>
          </nav>
          <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
            <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-10 w-10 object-contain opacity-70" />
            <div>
              <div className="text-sm font-semibold leading-tight" style={{ color: "var(--color-text-base)" }}>Kazehana PMS</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{t("einv.title")}</div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-violet-400">{t("einv.title")}</div>
              <div className="text-lg font-semibold text-white">
                {panelTitle[panel] || t("einv.panel.settings")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={reload} disabled={loading || saving}>
                {t("common.refresh")}
              </Button>
              <Button onClick={save} disabled={loading || saving}>
                {t("common.save")}
              </Button>
            </div>
          </div>
              {panel === "documents" && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-6 gap-2">
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm md:col-span-2"
                      placeholder={t("einv.documents.searchPlaceholder")}
                      value={docsFilters.q}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, q: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.documents.dateFrom")}
                      value={docsFilters.dateFrom}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.documents.dateTo")}
                      value={docsFilters.dateTo}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      value={docsFilters.docType}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, docType: e.target.value }))}
                    >
                      <option value="">{t("einv.documents.allTypes")}</option>
                      <option value="FE">FE</option>
                      <option value="TE">TE</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      value={docsFilters.status}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="">{t("einv.documents.allStatuses")}</option>
                      <option value="DRAFT">DRAFT</option>
                      <option value="SIGNED">SIGNED</option>
                      <option value="SENT">SENT</option>
                      <option value="ACCEPTED">ACCEPTED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="CANCELED">CANCELED</option>
                      <option value="CONTINGENCY">CONTINGENCY</option>
                    </select>
                  </div>

                  <div className="grid md:grid-cols-6 gap-2">
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm md:col-span-2"
                      value={docsFilters.source}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, source: e.target.value }))}
                    >
                      <option value="">{t("einv.documents.allModules")}</option>
                      <option value="frontdesk">{t("einv.modules.frontdesk")}</option>
                      <option value="restaurant">{t("einv.modules.restaurant")}</option>
                      <option value="accounting">{t("einv.modules.accounting")}</option>
                    </select>
                    <Button variant="outline" onClick={loadDocuments} disabled={docsLoading}>
                      {docsLoading ? t("common.loading") : t("common.applyFilters")}
                    </Button>
                    <label className="h-10 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 px-3 text-sm font-semibold cursor-pointer hover:bg-white/10">
                      {xmlImporting ? t("einv.documents.importing") : t("einv.documents.importXml")}
                      <input
                        type="file"
                        accept=".xml,text/xml,application/xml"
                        className="hidden"
                        disabled={xmlImporting}
                        onChange={(e) => importXmlFile(e.target.files?.[0])}
                      />
                    </label>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDocsFilters({ q: "", docType: "", status: "", source: "", dateFrom: "", dateTo: "" })
                      }
                      disabled={docsLoading}
                    >
                      {t("common.clear")}
                    </Button>
                    <div className="md:col-span-2 text-xs text-slate-500 flex items-center justify-end">
                      {t("einv.documents.itemsCount", { count: docs.length })}
                    </div>
                  </div>

                  <div className="overflow-auto border border-white/10 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">{t("common.date")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.type")}</th>
                          <th className="px-3 py-2 text-left">{t("common.status")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.module")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.invoiceNumber")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.consecutive")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.acks")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsLoading ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                              {t("common.loading")}
                            </td>
                          </tr>
                        ) : docs.length ? (
                          docs.map((d) => (
                            <tr key={d.id} className="border-t hover:bg-white/5">
                              <td className="px-3 py-2">
                                {formatOnlyDate(d.createdAt)}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="hover:underline"
                                  onClick={() => openDocDetail(d.id)}
                                  title={t("einv.documents.viewDetails")}
                                >
                                  {d.docType}
                                </button>
                              </td>
                              <td className="px-3 py-2">{d.status}</td>
                              <td className="px-3 py-2">{d.source || "-"}</td>
                              <td className="px-3 py-2">
                                {getInvoiceDisplayNumber(d)}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{d.consecutive || "-"}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border border-white/10 bg-white/5 text-slate-300 text-xs hover:bg-white/10"
                                  onClick={() => {
                                    setAcksFilters((p) => ({ ...p, docId: d.id }));
                                    setPanel("acks");
                                  }}
                                  title={t("einv.documents.viewAcks")}
                                >
                                  {Number(d.ackCount || 0)}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                              {t("einv.documents.empty")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {panel === "acks" && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-6 gap-2">
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm md:col-span-2"
                      placeholder={t("einv.acks.searchPlaceholder")}
                      value={acksFilters.q}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, q: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.acks.dateFrom")}
                      value={acksFilters.dateFrom}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.acks.dateTo")}
                      value={acksFilters.dateTo}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      value={acksFilters.docType}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, docType: e.target.value }))}
                    >
                      <option value="">{t("einv.acks.allDocs")}</option>
                      <option value="FE">FE</option>
                      <option value="TE">TE</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      value={acksFilters.type}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, type: e.target.value }))}
                    >
                      <option value="">{t("einv.acks.allTypes")}</option>
                      <option value="HACIENDA_RECEIPT">{t("einv.acks.types.haciendaReceipt")}</option>
                      <option value="HACIENDA_STATUS">{t("einv.acks.types.haciendaStatus")}</option>
                      <option value="RECEIVER_MESSAGE">{t("einv.acks.types.receiverMessage")}</option>
                      <option value="OTHER">{t("einv.acks.types.other")}</option>
                    </select>
                  </div>

                  <div className="grid md:grid-cols-6 gap-2">
                    <select
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm md:col-span-2"
                      value={acksFilters.status}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="">{t("einv.acks.allStatuses")}</option>
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="ACCEPTED">ACCEPTED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="ERROR">ERROR</option>
                    </select>
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm md:col-span-2"
                      placeholder={t("einv.acks.docIdPlaceholder")}
                      value={acksFilters.docId}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, docId: e.target.value }))}
                    />
                    <Button variant="outline" onClick={loadAcks} disabled={acksLoading}>
                      {acksLoading ? t("common.loading") : t("common.applyFilters")}
                    </Button>
                    <Button onClick={openAckCreate} disabled={acksLoading}>
                      {t("einv.acks.add")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setAcksFilters({ q: "", docId: "", docType: "", type: "", status: "", dateFrom: "", dateTo: "" })
                      }
                      disabled={acksLoading}
                    >
                      {t("common.clear")}
                    </Button>
                  </div>

                  <div className="overflow-auto border border-white/10 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">{t("common.date")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.acks.type")}</th>
                          <th className="px-3 py-2 text-left">{t("common.status")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.module")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.documents.invoiceNumber")}</th>
                          <th className="px-3 py-2 text-left">{t("einv.acks.message")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acksLoading ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                              {t("common.loading")}
                            </td>
                          </tr>
                        ) : acks.length ? (
                          acks.map((a) => (
                            <tr key={a.id} className="border-t hover:bg-white/5">
                              <td className="px-3 py-2">
                                {formatOnlyDate(a.createdAt)}
                              </td>
                              <td className="px-3 py-2">{a.type}</td>
                              <td className="px-3 py-2">{a.status}</td>
                              <td className="px-3 py-2">{a.doc?.source || "-"}</td>
                              <td className="px-3 py-2">
                                {getInvoiceDisplayNumber(a.doc)}
                              </td>
                              <td className="px-3 py-2 max-w-[420px]">
                                <button
                                  type="button"
                                  className="text-left w-full truncate hover:underline"
                                  title={a.message || t("einv.acks.viewDetails")}
                                  onClick={() => openAckDetail(a.id)}
                                >
                                  {a.message || t("einv.acks.viewDetailsShort")}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                              {t("einv.acks.empty")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {panel === "general" && (
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
                      {GENERAL_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`px-3 py-1.5 rounded-md text-sm ${
                            generalTab === t.id ? "bg-slate-900 text-white" : "text-slate-300 hover:bg-white/5"
                          }`}
                          onClick={() => setGeneralTab(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <select
                      className="sm:hidden h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm w-full"
                      value={generalTab}
                      onChange={(e) => setGeneralTab(e.target.value)}
                    >
                      {GENERAL_TABS.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(generalTab === "core" || generalTab === "connections") && (
                    <div className="grid lg:grid-cols-2 gap-3">
                      {generalTab === "core" && (
                        <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                      <div className="font-semibold">{t("einv.general.title")}</div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(cfg.enabled)}
                          onChange={(e) => setCfg((s) => ({ ...s, enabled: e.target.checked }))}
                        />
                        {t("einv.general.enable")}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                          value={cfg.version || "CR-4.4"}
                          onChange={(e) => setCfg((s) => ({ ...s, version: e.target.value }))}
                          placeholder={t("einv.general.version")}
                        />
                        <input
                          className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                          value={cfg.environment || "sandbox"}
                          onChange={(e) => setCfg((s) => ({ ...s, environment: e.target.value }))}
                          placeholder={t("einv.general.environment")}
                        />
                        <input
                          className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm col-span-2"
                          value="microfacturacr"
                          disabled
                        />
                      </div>
                        </Card>
                      )}

                      {generalTab === "connections" && (
                        <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                          <div className="font-semibold">{t("einv.connections.title")}</div>
                          <div className="text-sm text-slate-400">{t("einv.connections.desc")}</div>
                          <div className="grid gap-2 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.settings?.moduleConnections?.frontdesk)}
                                onChange={(e) => setModuleConnection("frontdesk", e.target.checked)}
                              />
                              {t("einv.modules.frontdesk")}
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.settings?.moduleConnections?.restaurant)}
                                onChange={(e) => setModuleConnection("restaurant", e.target.checked)}
                              />
                              {t("einv.modules.restaurant")}
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(cfg.settings?.moduleConnections?.accounting)}
                                onChange={(e) => setModuleConnection("accounting", e.target.checked)}
                              />
                              {t("einv.modules.accounting")}
                            </label>
                          </div>
                        </Card>
                      )}
                    </div>
                  )}

                  {generalTab === "forms" && (
                    <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                    <div className="font-semibold">{t("einv.forms.title")}</div>
                    <div className="text-sm text-slate-400">{t("einv.forms.subtitle")}</div>

                    <div className="grid md:grid-cols-3 gap-3">
                      {["frontdesk", "restaurant"].map((m) => {
                        const branding = cfg.settings?.moduleBranding?.[m] || {};
                        const hasLogo = Boolean(branding.logoDataUrl || branding.logoUrl);
                        return (
                          <Card key={m} className="p-3 bg-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">
                                {m === "frontdesk" ? t("einv.modules.frontdesk") : t("einv.modules.restaurant")}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {hasLogo ? t("einv.forms.logoSet") : t("einv.forms.logoEmpty")}
                              </div>
                            </div>
                            <input
                              className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                              placeholder={t("einv.forms.logoUrl")}
                              value={branding.logoUrl || ""}
                              onChange={(e) =>
                                setCfg((prev) => ({
                                  ...prev,
                                  settings: {
                                    ...prev.settings,
                                    moduleBranding: {
                                      ...(prev.settings?.moduleBranding || {}),
                                      [m]: { ...((prev.settings?.moduleBranding || {})[m] || {}), logoUrl: e.target.value },
                                    },
                                  },
                                }))
                              }
                            />
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => onLogoFile(m, e.target.files && e.target.files[0])}
                              />
                              {hasLogo && (
                                <img
                                  alt=""
                                  src={sanitizeImageUrl(branding.logoDataUrl || branding.logoUrl)}
                                  className="h-10 w-20 object-contain bg-white/5 rounded border border-white/10"
                                />
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="grid lg:grid-cols-[320px_1fr] gap-3 pt-2 border-t">
                      <div className="space-y-2">
                        <div className="text-xs uppercase text-slate-500">{t("einv.forms.listTitle")}</div>
                        <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1">
                          {(cfg.settings?.printForms || []).map((f) => (
                            <div
                              key={f.id}
                              className="border border-white/10 rounded-lg px-3 py-2 bg-white/5 text-white flex items-start justify-between gap-2"
                            >
                              <button className="text-left min-w-0" onClick={() => editPrintForm(f)}>
                                <div className="text-sm font-semibold truncate">{f.name}</div>
                                <div className="text-[11px] text-slate-500">
                                  {String(f.module || "")} • {String(f.docType || "")} • {String(f.paperType || "")}
                                </div>
                              </button>
                              <button
                                className="text-xs text-red-600"
                                onClick={() => deletePrintForm(f.id)}
                                title={t("einv.forms.delete")}
                              >
                                {t("einv.forms.delete")}
                              </button>
                            </div>
                          ))}
                          {(cfg.settings?.printForms || []).length === 0 && (
                            <div className="text-sm text-slate-500">{t("einv.forms.empty")}</div>
                          )}
                        </div>
                      </div>

                      <Card className="p-3 space-y-3 bg-white/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs uppercase text-slate-500">{t("einv.forms.editorTitle")}</div>
                            <div className="font-semibold text-white">{t("einv.forms.editorSubtitle")}</div>
                          </div>
                          <Button onClick={upsertPrintForm} variant="outline">
                            {t("einv.forms.saveForm")}
                          </Button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-2">
                          <input
                            className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                            placeholder={t("einv.forms.formId")}
                            value={formEditor.id}
                            onChange={(e) => setFormEditor((p) => ({ ...p, id: e.target.value }))}
                          />
                          <input
                            className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                            placeholder={t("einv.forms.formName")}
                            value={formEditor.name}
                            onChange={(e) => setFormEditor((p) => ({ ...p, name: e.target.value }))}
                          />
                          <select
                            className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                            value={formEditor.module}
                            onChange={(e) => setFormEditor((p) => ({ ...p, module: e.target.value }))}
                          >
                            <option value="restaurant">{t("einv.modules.restaurant")}</option>
                            <option value="frontdesk">{t("einv.modules.frontdesk")}</option>
                          </select>
                          <select
                            className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                            value={formEditor.docType}
                            onChange={(e) => setFormEditor((p) => ({ ...p, docType: e.target.value }))}
                          >
                            <option value="COMANDA">{t("einv.forms.docTypes.comanda")}</option>
                            <option value="TE">{t("einv.forms.docTypes.te")}</option>
                            <option value="FE">{t("einv.forms.docTypes.fe")}</option>
                            <option value="CLOSES">{t("einv.forms.docTypes.closes")}</option>
                            <option value="DOCUMENT">{t("einv.forms.docTypes.document")}</option>
                          </select>
                          <select
                            className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                            value={formEditor.paperType}
                            onChange={(e) => setFormEditor((p) => ({ ...p, paperType: e.target.value }))}
                          >
                            <option value="80mm">80mm</option>
                            <option value="58mm">58mm</option>
                            <option value="A4">A4</option>
                          </select>
                        </div>

                        <div className="grid md:grid-cols-2 gap-2">
                          {PRINT_FORM_FIELDS.map((ff) => (
                            <label key={ff.key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={Boolean(formEditor.fields?.[ff.key])}
                                onChange={(e) =>
                                  setFormEditor((p) => ({
                                    ...p,
                                    fields: { ...(p.fields || {}), [ff.key]: e.target.checked },
                                  }))
                                }
                              />
                              {ff.label}
                            </label>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t("einv.forms.editorNote")}
                        </div>
                      </Card>
                    </div>
                    </Card>
                  )}
 
                  {generalTab === "smtp" && (
                    <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                    <div className="font-semibold">{t("einv.smtp.title")}</div>
                    <div className="grid md:grid-cols-3 gap-3">
                      {["frontdesk", "restaurant", "accounting"].map((m) => {
                        const emailCfg = cfg.settings?.moduleEmail?.[m] || {};
                        const connected = Boolean(cfg.settings?.moduleConnections?.[m]);
                        const hasPass = Boolean(secretMeta?.smtp?.[m]?.hasPassword);
                        return (
                          <Card key={m} className={`p-3 space-y-2 ${connected ? "" : "opacity-50"}`}>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-sm">{t(`einv.modules.${m}`)}</div>
                              <div className="text-xs text-slate-500">
                                {hasPass ? t("einv.smtp.passwordSet") : t("einv.smtp.passwordMissing")}
                              </div>
                            </div>
                            <input
                              className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                              placeholder={t("einv.smtp.fromEmail")}
                              value={emailCfg.fromEmail || ""}
                              onChange={(e) => updateEmailSetting(m, { fromEmail: e.target.value })}
                              disabled={!connected}
                            />
                            <select
                              className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                              value={emailCfg.provider || "gmail"}
                              onChange={(e) => setEmailProvider(m, e.target.value)}
                              disabled={!connected}
                            >
                              <option value="gmail">Gmail</option>
                              <option value="hotmail">Hotmail / Office365</option>
                              <option value="custom">{t("einv.smtp.providerCustom")}</option>
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm col-span-2"
                                placeholder={t("einv.smtp.host")}
                                value={emailCfg.smtpHost || ""}
                                onChange={(e) => updateEmailSetting(m, { smtpHost: e.target.value })}
                                disabled={!connected}
                              />
                              <input
                                className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                                placeholder={t("einv.smtp.port")}
                                type="number"
                                value={emailCfg.smtpPort ?? 587}
                                onChange={(e) => updateEmailSetting(m, { smtpPort: Number(e.target.value) })}
                                disabled={!connected}
                              />
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Boolean(emailCfg.smtpSecure)}
                                  onChange={(e) => updateEmailSetting(m, { smtpSecure: e.target.checked })}
                                  disabled={!connected}
                                />
                                {t("einv.smtp.secure")}
                              </label>
                              <input
                                className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm col-span-2"
                                placeholder={t("einv.smtp.username")}
                                value={emailCfg.smtpUsername || ""}
                                onChange={(e) => updateEmailSetting(m, { smtpUsername: e.target.value })}
                                disabled={!connected}
                              />
                              <input
                                className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm col-span-2"
                                placeholder={
                                  hasPass ? t("einv.smtp.passwordKeep") : t("einv.smtp.password")
                                }
                                type="password"
                                onChange={(e) => setSecret(["smtp", m, "password"], e.target.value)}
                                disabled={!connected}
                              />
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                    </Card>
                  )}

                  {(generalTab === "atv" || generalTab === "certificate") && (
                    <div className="grid lg:grid-cols-2 gap-3">
                      {generalTab === "atv" && (
                        <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                      <div className="font-semibold">{t("einv.atv.title")}</div>
                      <div className="text-sm text-slate-400">{t("einv.atv.subtitle")}</div>
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        value={cfg.settings?.atv?.mode || "manual"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, atv: { ...(prev.settings?.atv || {}), mode: e.target.value } },
                          }))
                        }
                      >
                        <option value="manual">{t("einv.atv.modeManual")}</option>
                        <option value="api">API</option>
                      </select>
                      <div className="grid md:grid-cols-2 gap-2">
                        <input
                          className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                          placeholder={t("einv.atv.username")}
                          value={cfg.settings?.atv?.username || ""}
                          onChange={(e) =>
                            setCfg((prev) => ({
                              ...prev,
                              settings: { ...prev.settings, atv: { ...(prev.settings?.atv || {}), username: e.target.value } },
                            }))
                          }
                        />
                        <input
                          className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                          placeholder={
                            secretMeta?.atv?.hasPassword ? t("einv.atv.passwordKeep") : t("einv.atv.password")
                          }
                          type="password"
                          onChange={(e) =>
                            setSecrets((prev) => ({ ...prev, atv: { ...(prev.atv || {}), password: e.target.value } }))
                          }
                        />
                        {String(cfg.settings?.atv?.mode || "manual") === "api" && (
                          <>
                            <input
                              className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                              placeholder={t("einv.atv.clientId")}
                              value={cfg.settings?.atv?.clientId || ""}
                              onChange={(e) =>
                                setCfg((prev) => ({
                                  ...prev,
                                  settings: {
                                    ...prev.settings,
                                    atv: { ...(prev.settings?.atv || {}), clientId: e.target.value },
                                  },
                                }))
                              }
                            />
                            <input
                              className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                              placeholder={
                                secretMeta?.atv?.hasClientSecret
                                  ? t("einv.atv.clientSecretKeep")
                                  : t("einv.atv.clientSecret")
                              }
                              type="password"
                              onChange={(e) =>
                                setSecrets((prev) => ({
                                  ...prev,
                                  atv: { ...(prev.atv || {}), clientSecret: e.target.value },
                                }))
                              }
                            />
                          </>
                        )}
                      </div>
                      {String(cfg.settings?.atv?.mode || "manual") === "api" && (
                        <>
                          <div className="text-xs text-slate-400">{t("einv.atv.endpointsNote")}</div>
                          <input className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm" value={haciendaEndpoints.tokenUrl} disabled />
                          <input className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm" value={haciendaEndpoints.sendUrl} disabled />
                          <input className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm" value={haciendaEndpoints.statusUrl} disabled />
                        </>
                      )}
                      <textarea
                        className="min-h-[80px] rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm"
                        placeholder={t("einv.atv.notes")}
                        value={cfg.settings?.atv?.notes || ""}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, atv: { ...(prev.settings?.atv || {}), notes: e.target.value } },
                          }))
                        }
                      />
                        </Card>
                      )}

                      {generalTab === "certificate" && (
                        <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                      <div className="font-semibold">{t("einv.certificate.title")}</div>
                      <div className="text-sm text-slate-400">{t("einv.certificate.subtitle")}</div>
                      <div className="text-xs text-slate-500">
                        {t("einv.certificate.current")}{" "}
                        {cfg.settings?.crypto?.certificateName ||
                          (secretMeta?.crypto?.hasCertificate ? t("einv.certificate.stored") : t("einv.certificate.none"))}
                      </div>
                      <input type="file" accept=".p12,.pfx" onChange={(e) => onCertificateFile(e.target.files?.[0])} />
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={
                          secretMeta?.crypto?.hasCertificatePassword
                            ? t("einv.certificate.passwordKeep")
                            : t("einv.certificate.password")
                        }
                        type="password"
                        onChange={(e) =>
                          setSecrets((prev) => ({
                            ...prev,
                            crypto: { ...(prev.crypto || {}), certificatePassword: e.target.value },
                          }))
                        }
                      />
                      <div className="text-xs text-slate-500">
                        {t("einv.certificate.recommendation")}
                      </div>
                        </Card>
                      )}
                    </div>
                  )}
                </div>
              )}

              {panel === "issuer" && (
                <Card className="p-4 space-y-3 bg-white/5 border border-white/10 text-white">
                  <div className="font-semibold">{t("einv.issuer.title")}</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.issuer.countryCode")}
                      value={cfg.settings?.issuer?.countryCode || "506"}
                      onChange={(e) =>
                        setCfg((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            issuer: { ...(prev.settings?.issuer || {}), countryCode: e.target.value },
                          },
                        }))
                      }
                    />
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.issuer.idNumber")}
                      value={cfg.settings?.issuer?.idNumber || ""}
                      onChange={(e) =>
                        setCfg((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            issuer: { ...(prev.settings?.issuer || {}), idNumber: e.target.value },
                          },
                        }))
                      }
                    />
                    <input
                      className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                      placeholder={t("einv.issuer.name")}
                      value={cfg.settings?.issuer?.name || ""}
                      onChange={(e) =>
                        setCfg((prev) => ({
                          ...prev,
                          settings: {
                            ...prev.settings,
                            issuer: { ...(prev.settings?.issuer || {}), name: e.target.value },
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="pt-2 border-t">
                    <div className="font-semibold text-sm mb-2">{t("einv.issuer.frontdeskNumbering")}</div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={t("einv.issuer.branch")}
                        value={cfg.settings?.frontdesk?.branch || "001"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              frontdesk: { ...(prev.settings?.frontdesk || {}), branch: e.target.value },
                            },
                          }))
                        }
                      />
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={t("einv.issuer.terminal")}
                        value={cfg.settings?.frontdesk?.terminal || "00001"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              frontdesk: { ...(prev.settings?.frontdesk || {}), terminal: e.target.value },
                            },
                          }))
                        }
                      />
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={t("einv.issuer.situation")}
                        value={cfg.settings?.frontdesk?.situation || "1"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              frontdesk: { ...(prev.settings?.frontdesk || {}), situation: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      {t("einv.issuer.frontdeskNote")}
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="font-semibold text-sm mb-2">{t("einv.issuer.restaurantNumbering")}</div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={t("einv.issuer.branch")}
                        value={cfg.settings?.restaurant?.branch || "001"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              restaurant: { ...(prev.settings?.restaurant || {}), branch: e.target.value },
                            },
                          }))
                        }
                      />
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={t("einv.issuer.terminal")}
                        value={cfg.settings?.restaurant?.terminal || "00001"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              restaurant: { ...(prev.settings?.restaurant || {}), terminal: e.target.value },
                            },
                          }))
                        }
                      />
                      <input
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm"
                        placeholder={t("einv.issuer.situation")}
                        value={cfg.settings?.restaurant?.situation || "1"}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              restaurant: { ...(prev.settings?.restaurant || {}), situation: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      {t("einv.issuer.restaurantNote")}
                    </div>
                  </div>
                </Card>
              )}

              {panel === "catalogs" && (
                <div className="space-y-5">
                  {/* Header del panel */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-white">Catálogos de Facturación Electrónica</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Administre los códigos CABYS y los catálogos oficiales requeridos por Hacienda CR
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className={`flex items-center gap-2 h-9 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                          catalogTab === "cabys"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        onClick={() => setCatalogTab("cabys")}
                      >
                        <Tag className="w-4 h-4" />
                        CABYS
                      </button>
                      <button
                        className={`flex items-center gap-2 h-9 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                          catalogTab === "catalogs"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : "bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        onClick={() => setCatalogTab("catalogs")}
                      >
                        <BookOpen className="w-4 h-4" />
                        Catálogos FE
                      </button>
                    </div>
                  </div>

                  {/* ── TAB CABYS ── */}
                  {catalogTab === "cabys" && (
                    <div className="space-y-5">

                      {/* Sección 1: Buscar en Hacienda en tiempo real */}
                      <Card className="p-5 bg-white/5 border border-white/10 text-white">
                        <div className="flex items-center gap-2 mb-1">
                          <Search className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-bold text-white">Buscar en Hacienda CR (tiempo real)</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                          Consulta directamente la API oficial de Hacienda. Los resultados se pueden guardar en el catálogo del hotel.
                        </p>
                        <div className="flex gap-2 mb-4">
                          <input
                            className="flex-1 h-10 rounded-lg border border-white/20 bg-white/5 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            placeholder="Ej: alojamiento, servicio de restaurante, bebidas..."
                            value={cabysHaciendaQuery}
                            onChange={(e) => setCabysHaciendaQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && searchCabysHacienda()}
                          />
                          <button
                            onClick={searchCabysHacienda}
                            disabled={cabysHaciendaLoading || cabysHaciendaQuery.trim().length < 3}
                            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {cabysHaciendaLoading ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            Buscar
                          </button>
                        </div>

                        {cabysHaciendaRows.length > 0 && (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-500">
                                {cabysHaciendaRows.length} resultado(s) — seleccione los que desea guardar
                              </span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const sel = {};
                                    cabysHaciendaRows.forEach((r) => { sel[r.id] = true; });
                                    setCabysHaciendaSelected(sel);
                                  }}
                                  className="text-xs text-emerald-400 hover:underline"
                                >
                                  Seleccionar todo
                                </button>
                                <span className="text-xs text-slate-300">|</span>
                                <button
                                  onClick={() => setCabysHaciendaSelected({})}
                                  className="text-xs text-slate-500 hover:underline"
                                >
                                  Limpiar selección
                                </button>
                              </div>
                            </div>
                            <div className="rounded-lg border bg-white/5 max-h-64 overflow-y-auto mb-3">
                              {cabysHaciendaRows.map((r) => (
                                <label
                                  key={r.id}
                                  className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-white/10 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={Boolean(cabysHaciendaSelected[r.id])}
                                    onChange={(e) =>
                                      setCabysHaciendaSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                                    }
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                      {r.id}
                                    </span>
                                    <p className="text-xs text-slate-300 mt-1 leading-tight">{r.description}</p>
                                  </div>
                                  {r.taxRate !== undefined && (
                                    <span className="shrink-0 text-xs font-semibold text-slate-500 bg-white/10 px-2 py-0.5 rounded-full">
                                      IVA {r.taxRate}%
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={importSelectedFromHacienda}
                                disabled={Object.values(cabysHaciendaSelected).filter(Boolean).length === 0}
                                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Guardar seleccionados ({Object.values(cabysHaciendaSelected).filter(Boolean).length})
                              </button>
                              <button
                                onClick={importAllFromHacienda}
                                className="flex items-center gap-2 h-9 px-4 rounded-lg border border-emerald-300 text-emerald-400 text-sm font-semibold hover:bg-emerald-900/30 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Guardar todos ({cabysHaciendaRows.length})
                              </button>
                            </div>
                          </>
                        )}

                        {cabysHaciendaRows.length === 0 && !cabysHaciendaLoading && cabysHaciendaQuery.trim().length >= 3 && (
                          <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                            <AlertCircle className="w-4 h-4" />
                            Sin resultados. Intente con otro término.
                          </div>
                        )}
                      </Card>

                      {/* Sección 2: Sincronización masiva */}
                      <Card className="p-5 bg-white/5 border border-white/10 text-white">
                        <div className="flex items-center gap-2 mb-1">
                          <RefreshCw className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-bold text-white">Sincronización masiva desde Hacienda</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                          Descarga hasta 200 códigos CABYS y los guarda automáticamente en el catálogo del hotel. Útil para poblar
                          el catálogo con los códigos relevantes para su actividad.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-400 mb-1 block">Término de búsqueda</label>
                            <input
                              className="h-10 w-full rounded-lg border border-white/20 bg-white/5 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="Ej: hotel, restaurante, alojamiento..."
                              value={cabysSyncQuery}
                              onChange={(e) => { setCabysSyncQuery(e.target.value); setCabysSavedCount(null); }}
                              onKeyDown={(e) => e.key === "Enter" && syncCabysFromHacienda()}
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={syncCabysFromHacienda}
                              disabled={cabysSyncLoading || !cabysSyncQuery.trim()}
                              className="flex items-center gap-2 h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
                            >
                              {cabysSyncLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              {cabysSyncLoading ? "Sincronizando..." : "Sincronizar ahora"}
                            </button>
                          </div>
                        </div>
                        {cabysSavedCount !== null && (
                          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {cabysSavedCount} código(s) sincronizados y guardados en el catálogo del hotel.
                          </div>
                        )}
                        <div className="mt-3 p-3 bg-blue-900/30 rounded-lg text-xs text-blue-300 space-y-1">
                          <p className="font-semibold">Sugerencias de búsqueda para hoteles:</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {["alojamiento", "restaurante", "bebidas", "lavandería", "estacionamiento", "spa", "tours"].map((s) => (
                              <button
                                key={s}
                                onClick={() => { setCabysSyncQuery(s); setCabysSavedCount(null); }}
                                className="px-2 py-1 bg-white/5 border border-white/10 rounded-md hover:bg-white/10 text-slate-300 capitalize transition-colors"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Card>

                      {/* Sección 3: Catálogo local del hotel */}
                      <Card className="p-5 bg-white/5 border border-white/10 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <BookOpen className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-bold text-white">Catálogo CABYS del hotel</span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Códigos guardados localmente. Estos aparecen en el autocompletar al crear facturas.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              className="h-9 rounded-lg border border-white/20 bg-white/5 text-white px-3 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              placeholder="Buscar en catálogo..."
                              value={cabysQuery}
                              onChange={(e) => setCabysQuery(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && loadCabys()}
                            />
                            <button
                              onClick={() => loadCabys()}
                              disabled={cabysLoading}
                              className="h-9 px-3 rounded-lg border border-white/10 text-sm font-semibold bg-white/5 text-slate-300 hover:bg-white/10 disabled:opacity-50 flex items-center gap-1"
                            >
                              {cabysLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {cabysRows.length === 0 ? (
                          <div className="text-center py-10 text-slate-400">
                            <Tag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No hay códigos CABYS en el catálogo del hotel.</p>
                            <p className="text-xs mt-1">Use la búsqueda o sincronización arriba para agregar códigos.</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border bg-white/5 max-h-72 overflow-y-auto">
                            {cabysRows.map((r) => (
                              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 bg-transparent hover:bg-white/5">
                                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded shrink-0">
                                  {r.id}
                                </span>
                                <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">{r.description}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Importar desde CSV/texto */}
                        <details className="mt-4">
                          <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-400 hover:text-white select-none">
                            <Upload className="w-4 h-4" />
                            Importar desde archivo CSV / texto manual
                          </summary>
                          <div className="mt-3 space-y-3 pt-3 border-t">
                            <p className="text-xs text-slate-500">
                              Pegue los códigos en formato <span className="font-mono bg-white/10 px-1 rounded">CODIGO;DESCRIPCION</span>,
                              uno por línea. También puede subir un archivo <span className="font-mono">.csv</span> o <span className="font-mono">.xlsx</span>.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="text-xs"
                                onChange={(e) => onPickCsv(e.target.files?.[0], setCabysImportItems, setCabysImportText)}
                              />
                              {cabysImportItems.length > 0 && (
                                <span className="text-xs text-emerald-400 font-semibold">{cabysImportItems.length} filas cargadas</span>
                              )}
                            </div>
                            <textarea
                              className="w-full min-h-[100px] rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              value={cabysImportText}
                              onChange={(e) => setCabysImportText(e.target.value)}
                              placeholder={"1011100100100;Cultivo de café\n1011100200000;Cultivo de cacao"}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setCabysImportText(""); setCabysImportItems([]); }}
                                className="h-9 px-4 rounded-lg border text-sm text-slate-400 hover:bg-white/5"
                              >
                                Limpiar
                              </button>
                              <button
                                onClick={() => doImportCabys("merge")}
                                disabled={!cabysImportText.trim() && cabysImportItems.length === 0}
                                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Upload className="w-4 h-4" />
                                Importar
                              </button>
                            </div>
                          </div>
                        </details>
                      </Card>
                    </div>
                  )}

                  {/* ── TAB CATÁLOGOS FE ── */}
                  {catalogTab === "catalogs" && (
                    <div className="space-y-5">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { value: "paymentMethods", label: "Métodos de pago", icon: "💳" },
                          { value: "saleConditions", label: "Condiciones de venta", icon: "📋" },
                          { value: "idTypes", label: "Tipos de identificación", icon: "🪪" },
                          { value: "unitMeasures", label: "Unidades de medida", icon: "📐" },
                          { value: "taxTypes", label: "Tipos de impuestos", icon: "🏛️" },
                          { value: "exemptionTypes", label: "Tipos de exención", icon: "✅" },
                          { value: "currencies", label: "Monedas", icon: "💰" },
                          { value: "activities", label: "Actividades económicas", icon: "🏢" },
                        ].map((cat) => (
                          <button
                            key={cat.value}
                            onClick={() => { setCatalogName(cat.value); setCatalogRows([]); setCatalogQuery(""); }}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              catalogName === cat.value
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:border-emerald-300"
                            }`}
                          >
                            <span className="text-xl">{cat.icon}</span>
                            <span className="text-xs font-semibold leading-tight">{cat.label}</span>
                          </button>
                        ))}
                      </div>

                      <Card className="p-5 bg-white/5 border border-white/10 text-white">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-sm font-bold text-white">
                              {[
                                { value: "paymentMethods", label: "Métodos de pago" },
                                { value: "saleConditions", label: "Condiciones de venta" },
                                { value: "idTypes", label: "Tipos de identificación" },
                                { value: "unitMeasures", label: "Unidades de medida" },
                                { value: "taxTypes", label: "Tipos de impuestos" },
                                { value: "exemptionTypes", label: "Tipos de exención" },
                                { value: "currencies", label: "Monedas" },
                                { value: "activities", label: "Actividades económicas" },
                              ].find((c) => c.value === catalogName)?.label || catalogName}
                            </span>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {catalogRows.length > 0 ? `${catalogRows.length} entrada(s) cargadas` : "Busque para ver las entradas del catálogo"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <input
                              className="h-9 rounded-lg border border-white/20 bg-white/5 text-white px-3 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              placeholder="Filtrar..."
                              value={catalogQuery}
                              onChange={(e) => setCatalogQuery(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && loadCatalog()}
                            />
                            <button
                              onClick={loadCatalog}
                              disabled={catalogLoading}
                              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {catalogLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                              Buscar
                            </button>
                          </div>
                        </div>

                        {catalogRows.length === 0 ? (
                          <div className="text-center py-10 text-slate-400">
                            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">Catálogo vacío. Pulse "Buscar" para cargar o importe entradas abajo.</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border bg-white/5 max-h-72 overflow-y-auto">
                            {catalogRows.map((r) => (
                              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 bg-transparent hover:bg-white/5">
                                <span className="font-mono text-xs font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded shrink-0 min-w-[3rem] text-center">
                                  {r.code}
                                </span>
                                <span className="text-xs text-slate-300 flex-1">{r.label}</span>
                                {r.version && (
                                  <span className="text-xs text-slate-400 shrink-0">{r.version}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Importar */}
                        <details className="mt-4">
                          <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-400 hover:text-white select-none">
                            <Upload className="w-4 h-4" />
                            Importar entradas al catálogo
                          </summary>
                          <div className="mt-3 space-y-3 pt-3 border-t">
                            <p className="text-xs text-slate-500">
                              Formato: <span className="font-mono bg-white/10 px-1 rounded">CODIGO;ETIQUETA</span>, uno por línea.
                              Puede subir un archivo <span className="font-mono">.csv</span> o <span className="font-mono">.xlsx</span>.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                className="text-xs"
                                onChange={(e) => onPickCsv(e.target.files?.[0], setCatalogImportItems, setCatalogImportText)}
                              />
                              {catalogImportItems.length > 0 && (
                                <span className="text-xs text-emerald-400 font-semibold">{catalogImportItems.length} filas cargadas</span>
                              )}
                            </div>
                            <textarea
                              className="w-full min-h-[100px] rounded-lg border border-white/20 bg-white/5 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                              value={catalogImportText}
                              onChange={(e) => setCatalogImportText(e.target.value)}
                              placeholder={"01;Efectivo\n02;Tarjeta de crédito\n03;Tarjeta de débito"}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setCatalogImportText(""); setCatalogImportItems([]); }}
                                className="h-9 px-4 rounded-lg border text-sm text-slate-400 hover:bg-white/5"
                              >
                                Limpiar
                              </button>
                              <button
                                onClick={() => doImportCatalog("merge")}
                                disabled={!catalogImportText.trim() && catalogImportItems.length === 0}
                                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Upload className="w-4 h-4" />
                                Importar
                              </button>
                            </div>
                          </div>
                        </details>
                      </Card>
                    </div>
                  )}
                </div>
              )}
        </main>
      </div>
      {ackDetailOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeAckDetail} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl p-5 space-y-4 bg-slate-800 border border-white/10 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("einv.ack.title")}</div>
                  <div className="text-lg font-semibold text-white">{t("einv.modal.details")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAckDetail}>
                    {t("common.close")}
                  </Button>
                </div>
              </div>

              {ackDetailLoading ? (
                <div className="text-sm text-slate-400">{t("common.loading")}</div>
              ) : !ackDetail ? (
                <div className="text-sm text-slate-400">{t("common.notFound")}</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 bg-white/5 border border-white/10 text-white">
                      <div className="text-xs text-slate-500">{t("common.type")}</div>
                      <div className="font-medium">{ackDetail.type}</div>
                      <div className="text-xs text-slate-500 mt-2">{t("common.status")}</div>
                      <div className="font-medium">{ackDetail.status}</div>
                      <div className="text-xs text-slate-500 mt-2">{t("common.created")}</div>
                      <div className="text-sm">{ackDetail.createdAt ? new Date(ackDetail.createdAt).toLocaleString() : ""}</div>
                    </Card>
                    <Card className="p-3 bg-white/5 border border-white/10 text-white">
                      <div className="text-xs text-slate-500">{t("einv.ack.document")}</div>
                      <div className="text-sm">
                        {ackDetail.doc?.docType}  -  {ackDetail.doc?.status}  -  {ackDetail.doc?.source || "-"}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">{t("einv.documents.invoiceNumber")}</div>
                      <div className="text-sm">
                        {getInvoiceDisplayNumber(ackDetail.doc)}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">{t("einv.documents.consecutive")}</div>
                      <div className="text-xs font-mono break-all">{ackDetail.doc?.consecutive || "-"}</div>
                      <div className="text-xs text-slate-500 mt-2">{t("einv.documents.key")}</div>
                      <div className="text-xs font-mono break-all">{ackDetail.doc?.key || "-"}</div>
                    </Card>
                  </div>

                  <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                    <div className="text-xs text-slate-500">{t("einv.acks.message")}</div>
                    <div className="text-sm whitespace-pre-wrap">{ackDetail.message || "-"}</div>
                  </Card>

                  <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                    <div className="text-xs text-slate-500">{t("einv.payload")}</div>
                    <pre className="text-xs bg-white/5 border rounded-lg p-3 overflow-auto max-h-[45vh] whitespace-pre-wrap">
                      {typeof ackDetail.payload === "string"
                        ? ackDetail.payload
                        : JSON.stringify(ackDetail.payload, null, 2)}
                    </pre>
                  </Card>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {ackCreateOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeAckCreate} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl p-5 space-y-4 bg-slate-800 border border-white/10 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("einv.ack.title")}</div>
                  <div className="text-lg font-semibold text-white">{t("einv.modal.addImport")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAckCreate}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={saveAckCreate}>{t("common.save")}</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-500">{t("einv.ack.documentId")}</div>
                  <input
                    className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm w-full"
                    value={ackCreateForm.documentId}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, documentId: e.target.value }))}
                    placeholder={t("einv.ack.documentIdPlaceholder")}
                  />
                  <div className="text-xs text-slate-500">{t("einv.ack.quickPick")}</div>
                  <select
                    className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm w-full"
                    value={ackCreateForm.documentId}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, documentId: e.target.value }))}
                  >
                    <option value="">{t("common.select")}</option>
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.docType} - {getInvoiceDisplayNumber(d)} - {d.consecutive || d.key || d.id}
                      </option>
                    ))}
                  </select>
                </Card>

                <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-slate-500">{t("einv.acks.type")}</div>
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm w-full"
                        value={ackCreateForm.type}
                        onChange={(e) => setAckCreateForm((p) => ({ ...p, type: e.target.value }))}
                      >
                        <option value="HACIENDA_RECEIPT">{t("einv.acks.types.haciendaReceipt")}</option>
                        <option value="HACIENDA_STATUS">{t("einv.acks.types.haciendaStatus")}</option>
                        <option value="RECEIVER_MESSAGE">{t("einv.acks.types.receiverMessage")}</option>
                        <option value="OTHER">{t("einv.acks.types.other")}</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">{t("einv.acks.status")}</div>
                      <select
                        className="h-10 rounded-lg border border-white/10 bg-white/5 text-white px-3 text-sm w-full"
                        value={ackCreateForm.status}
                        onChange={(e) => setAckCreateForm((p) => ({ ...p, status: e.target.value }))}
                      >
                        <option value="RECEIVED">RECEIVED</option>
                        <option value="ACCEPTED">ACCEPTED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="ERROR">ERROR</option>
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">{t("einv.acks.message")}</div>
                  <textarea
                    className="min-h-[80px] rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm w-full"
                    value={ackCreateForm.message}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder={t("einv.ack.messagePlaceholder")}
                  />
                </Card>
              </div>

              <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                <div className="text-xs text-slate-500">{t("einv.payloadPaste")}</div>
                <textarea
                  className="min-h-[220px] rounded-lg border border-white/10 bg-white/5 text-white px-3 py-2 text-sm w-full font-mono"
                  value={ackCreateForm.payloadText}
                  onChange={(e) => setAckCreateForm((p) => ({ ...p, payloadText: e.target.value }))}
                  placeholder={t("einv.payloadPlaceholder")}
                />
                <div className="text-xs text-slate-500">
                  {t("einv.payloadNote")}
                </div>
              </Card>
            </Card>
          </div>
        </div>
      )}

      {docDetailOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeDocDetail} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-5xl p-5 space-y-4 bg-slate-800 border border-white/10 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("einv.doc.title")}</div>
                  <div className="text-lg font-semibold text-white">{t("einv.modal.details")}</div>
                </div>
                <div className="flex items-center gap-2">
                  {docDetail?.id && (
                    <>
                      <Button
                        onClick={() => submitDoc(docDetail.id)}
                        disabled={docDetail.status === "ACCEPTED" || docDetail.status === "CANCELED"}
                        title={t("einv.doc.submitTitle")}
                      >
                        {t("einv.doc.submitSandbox")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => refreshDoc(docDetail.id)}
                        disabled={docDetail.status === "ACCEPTED" || docDetail.status === "CANCELED"}
                        title={t("einv.doc.refreshTitle")}
                      >
                        {t("einv.doc.refresh")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => cancelDoc(docDetail.id)}
                        disabled={docDetail.status === "CANCELED"}
                        title={t("einv.doc.cancelTitle")}
                      >
                        {t("common.cancel")}
                      </Button>
                    </>
                  )}
                  {docDetail?.id && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAcksFilters((p) => ({ ...p, docId: docDetail.id }));
                        setPanel("acks");
                        setDocDetailOpen(false);
                      }}
                    >
                      {t("einv.documents.viewAcks")} ({Number(docDetail?.ackCount || 0)})
                    </Button>
                  )}
                  <Button variant="outline" onClick={closeDocDetail}>
                    {t("common.close")}
                  </Button>
                </div>
              </div>

              {docDetailLoading ? (
                <div className="text-sm text-slate-400">{t("common.loading")}</div>
              ) : !docDetail ? (
                <div className="text-sm text-slate-400">{t("common.notFound")}</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-500">{t("einv.doc.typeStatus")}</div>
                      <div className="text-sm">
                        {docDetail.docType} {" - "} {docDetail.status} {" - "} {docDetail.source || "-"}
                      </div>
                      <div className="text-xs text-slate-500">{t("common.created")}</div>
                      <div className="text-sm">
                        {docDetail.createdAt ? new Date(docDetail.createdAt).toLocaleString() : ""}
                      </div>
                      <div className="text-xs text-slate-500">{t("einv.documents.invoiceNumber")}</div>
                      <div className="text-sm">
                        {getInvoiceDisplayNumber(docDetail)}
                      </div>
                      <div className="text-xs text-slate-500">{t("common.total")}</div>
                      <div className="text-sm">
                        {docDetail.invoice
                          ? `${docDetail.invoice.total} ${docDetail.invoice.currency || ""}`
                          : docDetail.restaurantOrder
                            ? `${docDetail.restaurantOrder.total || 0}`
                            : "-"}
                      </div>
                    </Card>
                    <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-500">{t("einv.doc.branchTerminal")}</div>
                      <div className="text-sm">
                        {docDetail.branch || "-"} / {docDetail.terminal || "-"}
                      </div>
                      <div className="text-xs text-slate-500">{t("einv.documents.consecutive")}</div>
                      <div className="text-xs font-mono break-all">{docDetail.consecutive || "-"}</div>
                      <div className="text-xs text-slate-500">{t("einv.documents.key")}</div>
                      <div className="text-xs font-mono break-all">{docDetail.key || "-"}</div>
                    </Card>
                  </div>

                  <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                    <div className="text-xs text-slate-500">{t("einv.doc.receiver")}</div>
                    <pre className="text-xs bg-white/5 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[22vh]">
                      {JSON.stringify(docDetail.receiver || {}, null, 2)}
                    </pre>
                  </Card>

                  <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                    <div className="text-xs text-slate-500">{t("einv.payload")}</div>
                    <pre className="text-xs bg-white/5 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                      {typeof docDetail.payload === "string"
                        ? docDetail.payload
                        : JSON.stringify(docDetail.payload || {}, null, 2)}
                    </pre>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-500">{t("einv.doc.signedXml")}</div>
                      <pre className="text-xs bg-white/5 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                        {docDetail.xmlSigned || t("einv.doc.notGenerated")}
                      </pre>
                    </Card>
                    <Card className="p-3 space-y-2 bg-white/5 border border-white/10">
                      <div className="text-xs text-slate-500">{t("einv.doc.response")}</div>
                      <pre className="text-xs bg-white/5 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                        {typeof docDetail.response === "string"
                          ? docDetail.response
                          : JSON.stringify(docDetail.response || {}, null, 2)}
                      </pre>
                    </Card>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

