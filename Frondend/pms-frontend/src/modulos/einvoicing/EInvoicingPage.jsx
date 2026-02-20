import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { FileCheck2 } from "lucide-react";
import EInvoicingUserMenu from "./EInvoicingUserMenu";
import * as XLSX from "xlsx";
import { useLanguage } from "../../context/LanguageContext";

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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#ff7ac8]/35 via-[#14060d] to-[#080407]">
      <header className="h-14 flex items-center justify-between px-6 bg-[#160812]/80 backdrop-blur border-b border-[#ff7ac8]/25 text-white">
        <div className="space-y-0.5">
          <div className="text-xs uppercase text-[#ffb3dd]">{t("einv.title")}</div>
          <div className="text-sm font-semibold">{t("einv.subtitle")}</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#ffd1ea]">
          <div>
            {t("einv.status.label")}{" "}
            <span className="font-semibold text-white">{cfg.enabled ? t("einv.status.enabled") : t("einv.status.disabled")}</span>{" "}
            · {cfg.environment || "sandbox"}
          </div>
          <EInvoicingUserMenu />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="bg-white/95 border border-[#ffb3dd]/30 rounded-2xl p-3 h-fit shadow-[0_15px_45px_rgba(255,122,200,0.15)]">
          <div className="text-[11px] uppercase tracking-wide text-[#b14a85]">{t("einv.nav.title")}</div>
          <div className="mt-2 space-y-1">
            {[
              { id: "documents", label: t("einv.nav.documents") },
              { id: "acks", label: t("einv.nav.acks") },
              { id: "issuer", label: t("einv.nav.issuer") },
              { id: "general", label: t("einv.nav.general") },
              { id: "catalogs", label: t("einv.nav.catalogs") },
            ].map((item) => (
              <button
                key={item.id}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition ${
                  panel === item.id
                    ? "bg-[#ff4fa5] text-white shadow-[0_10px_25px_rgba(255,79,165,0.35)]"
                    : "text-slate-700 hover:bg-[#ffe1f0]"
                }`}
                onClick={() => setPanel(item.id)}
              >
                {item.label}
              </button>
            ))}
            <button
              className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-[#ffe1f0]"
              onClick={() => navigate("/launcher")}
            >
              {t("einv.nav.back")}
            </button>
          </div>
        </aside>

        <main className="bg-white border border-[#ffb3dd]/30 rounded-2xl p-5 space-y-4 shadow-[0_15px_45px_rgba(255,122,200,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase text-[#b14a85]">{t("einv.title")}</div>
              <div className="text-lg font-semibold text-slate-900">
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
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
                      placeholder={t("einv.documents.searchPlaceholder")}
                      value={docsFilters.q}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, q: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder={t("einv.documents.dateFrom")}
                      value={docsFilters.dateFrom}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder={t("einv.documents.dateTo")}
                      value={docsFilters.dateTo}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
                      value={docsFilters.docType}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, docType: e.target.value }))}
                    >
                      <option value="">{t("einv.documents.allTypes")}</option>
                      <option value="FE">FE</option>
                      <option value="TE">TE</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
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
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
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
                    <label className="h-10 inline-flex items-center justify-center rounded-lg border px-3 text-sm font-semibold cursor-pointer hover:bg-slate-50">
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

                  <div className="overflow-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
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
                            <tr key={d.id} className="border-t hover:bg-slate-50">
                              <td className="px-3 py-2">
                                {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
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
                                {d.invoice?.number ||
                                  (d.restaurantOrder?.id
                                    ? `${t("einv.order")} ${String(d.restaurantOrder.id).slice(0, 8)}`
                                    : "-")}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{d.consecutive || "-"}</td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded border text-xs hover:bg-slate-50"
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
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
                      placeholder={t("einv.acks.searchPlaceholder")}
                      value={acksFilters.q}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, q: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder={t("einv.acks.dateFrom")}
                      value={acksFilters.dateFrom}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder={t("einv.acks.dateTo")}
                      value={acksFilters.dateTo}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
                      value={acksFilters.docType}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, docType: e.target.value }))}
                    >
                      <option value="">{t("einv.acks.allDocs")}</option>
                      <option value="FE">FE</option>
                      <option value="TE">TE</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
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
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
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
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
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

                  <div className="overflow-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
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
                            <tr key={a.id} className="border-t hover:bg-slate-50">
                              <td className="px-3 py-2">
                                {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                              </td>
                              <td className="px-3 py-2">{a.type}</td>
                              <td className="px-3 py-2">{a.status}</td>
                              <td className="px-3 py-2">{a.doc?.source || "-"}</td>
                              <td className="px-3 py-2">
                                {a.doc?.invoice?.number ||
                                  (a.doc?.restaurantOrder?.id
                                    ? `${t("einv.order")} ${String(a.doc.restaurantOrder.id).slice(0, 8)}`
                                    : "-")}
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
                    <div className="hidden sm:flex items-center gap-1 rounded-lg border bg-white p-1">
                      {GENERAL_TABS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className={`px-3 py-1.5 rounded-md text-sm ${
                            generalTab === t.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                          }`}
                          onClick={() => setGeneralTab(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <select
                      className="sm:hidden h-10 rounded-lg border px-3 text-sm bg-white w-full"
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
                        <Card className="p-4 space-y-3">
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
                          className="h-10 rounded-lg border px-3 text-sm"
                          value={cfg.version || "CR-4.4"}
                          onChange={(e) => setCfg((s) => ({ ...s, version: e.target.value }))}
                          placeholder={t("einv.general.version")}
                        />
                        <input
                          className="h-10 rounded-lg border px-3 text-sm"
                          value={cfg.environment || "sandbox"}
                          onChange={(e) => setCfg((s) => ({ ...s, environment: e.target.value }))}
                          placeholder={t("einv.general.environment")}
                        />
                        <input
                          className="h-10 rounded-lg border px-3 text-sm col-span-2"
                          value="microfacturacr"
                          disabled
                        />
                      </div>
                        </Card>
                      )}

                      {generalTab === "connections" && (
                        <Card className="p-4 space-y-3">
                          <div className="font-semibold">{t("einv.connections.title")}</div>
                          <div className="text-sm text-slate-600">{t("einv.connections.desc")}</div>
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
                    <Card className="p-4 space-y-3">
                    <div className="font-semibold">{t("einv.forms.title")}</div>
                    <div className="text-sm text-slate-600">{t("einv.forms.subtitle")}</div>

                    <div className="grid md:grid-cols-3 gap-3">
                      {["frontdesk", "restaurant"].map((m) => {
                        const branding = cfg.settings?.moduleBranding?.[m] || {};
                        const hasLogo = Boolean(branding.logoDataUrl || branding.logoUrl);
                        return (
                          <Card key={m} className="p-3 bg-slate-50 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold">
                                {m === "frontdesk" ? t("einv.modules.frontdesk") : t("einv.modules.restaurant")}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {hasLogo ? t("einv.forms.logoSet") : t("einv.forms.logoEmpty")}
                              </div>
                            </div>
                            <input
                              className="h-10 rounded-lg border px-3 text-sm bg-white"
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
                                  src={branding.logoDataUrl || branding.logoUrl}
                                  className="h-10 w-20 object-contain bg-white rounded border"
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
                              className="border rounded-lg px-3 py-2 bg-white flex items-start justify-between gap-2"
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

                      <Card className="p-3 space-y-3 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs uppercase text-slate-500">{t("einv.forms.editorTitle")}</div>
                            <div className="font-semibold text-slate-900">{t("einv.forms.editorSubtitle")}</div>
                          </div>
                          <Button onClick={upsertPrintForm} variant="outline">
                            {t("einv.forms.saveForm")}
                          </Button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-2">
                          <input
                            className="h-10 rounded-lg border px-3 text-sm bg-white"
                            placeholder={t("einv.forms.formId")}
                            value={formEditor.id}
                            onChange={(e) => setFormEditor((p) => ({ ...p, id: e.target.value }))}
                          />
                          <input
                            className="h-10 rounded-lg border px-3 text-sm bg-white"
                            placeholder={t("einv.forms.formName")}
                            value={formEditor.name}
                            onChange={(e) => setFormEditor((p) => ({ ...p, name: e.target.value }))}
                          />
                          <select
                            className="h-10 rounded-lg border px-3 text-sm bg-white"
                            value={formEditor.module}
                            onChange={(e) => setFormEditor((p) => ({ ...p, module: e.target.value }))}
                          >
                            <option value="restaurant">{t("einv.modules.restaurant")}</option>
                            <option value="frontdesk">{t("einv.modules.frontdesk")}</option>
                          </select>
                          <select
                            className="h-10 rounded-lg border px-3 text-sm bg-white"
                            value={formEditor.docType}
                            onChange={(e) => setFormEditor((p) => ({ ...p, docType: e.target.value }))}
                          >
                            <option value="COMANDA">{t("einv.forms.docTypes.comanda")}</option>
                            <option value="TE">{t("einv.forms.docTypes.te")}</option>
                            <option value="FE">{t("einv.forms.docTypes.fe")}</option>
                            <option value="CLOSES">{t("einv.forms.docTypes.closes")}</option>
                            <option value="SALES_REPORT">{t("einv.forms.docTypes.salesReport")}</option>
                            <option value="DOCUMENT">{t("einv.forms.docTypes.document")}</option>
                          </select>
                          <select
                            className="h-10 rounded-lg border px-3 text-sm bg-white"
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
                    <Card className="p-4 space-y-3">
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
                              className="h-10 rounded-lg border px-3 text-sm"
                              placeholder={t("einv.smtp.fromEmail")}
                              value={emailCfg.fromEmail || ""}
                              onChange={(e) => updateEmailSetting(m, { fromEmail: e.target.value })}
                              disabled={!connected}
                            />
                            <select
                              className="h-10 rounded-lg border px-3 text-sm"
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
                                className="h-10 rounded-lg border px-3 text-sm col-span-2"
                                placeholder={t("einv.smtp.host")}
                                value={emailCfg.smtpHost || ""}
                                onChange={(e) => updateEmailSetting(m, { smtpHost: e.target.value })}
                                disabled={!connected}
                              />
                              <input
                                className="h-10 rounded-lg border px-3 text-sm"
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
                                className="h-10 rounded-lg border px-3 text-sm col-span-2"
                                placeholder={t("einv.smtp.username")}
                                value={emailCfg.smtpUsername || ""}
                                onChange={(e) => updateEmailSetting(m, { smtpUsername: e.target.value })}
                                disabled={!connected}
                              />
                              <input
                                className="h-10 rounded-lg border px-3 text-sm col-span-2"
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
                        <Card className="p-4 space-y-3">
                      <div className="font-semibold">{t("einv.atv.title")}</div>
                      <div className="text-sm text-slate-600">{t("einv.atv.subtitle")}</div>
                      <select
                        className="h-10 rounded-lg border px-3 text-sm"
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
                          className="h-10 rounded-lg border px-3 text-sm"
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
                          className="h-10 rounded-lg border px-3 text-sm"
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
                              className="h-10 rounded-lg border px-3 text-sm"
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
                              className="h-10 rounded-lg border px-3 text-sm"
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
                          <div className="text-xs text-slate-600">{t("einv.atv.endpointsNote")}</div>
                          <input className="h-10 rounded-lg border px-3 text-sm" value={haciendaEndpoints.tokenUrl} disabled />
                          <input className="h-10 rounded-lg border px-3 text-sm" value={haciendaEndpoints.sendUrl} disabled />
                          <input className="h-10 rounded-lg border px-3 text-sm" value={haciendaEndpoints.statusUrl} disabled />
                        </>
                      )}
                      <textarea
                        className="min-h-[80px] rounded-lg border px-3 py-2 text-sm"
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
                        <Card className="p-4 space-y-3">
                      <div className="font-semibold">{t("einv.certificate.title")}</div>
                      <div className="text-sm text-slate-600">{t("einv.certificate.subtitle")}</div>
                      <div className="text-xs text-slate-500">
                        {t("einv.certificate.current")}{" "}
                        {cfg.settings?.crypto?.certificateName ||
                          (secretMeta?.crypto?.hasCertificate ? t("einv.certificate.stored") : t("einv.certificate.none"))}
                      </div>
                      <input type="file" accept=".p12,.pfx" onChange={(e) => onCertificateFile(e.target.files?.[0])} />
                      <input
                        className="h-10 rounded-lg border px-3 text-sm"
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
                <Card className="p-4 space-y-3">
                  <div className="font-semibold">{t("einv.issuer.title")}</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
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
                      className="h-10 rounded-lg border px-3 text-sm"
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
                      className="h-10 rounded-lg border px-3 text-sm"
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
                        className="h-10 rounded-lg border px-3 text-sm"
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
                        className="h-10 rounded-lg border px-3 text-sm"
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
                        className="h-10 rounded-lg border px-3 text-sm"
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
                        className="h-10 rounded-lg border px-3 text-sm"
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
                        className="h-10 rounded-lg border px-3 text-sm"
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
                        className="h-10 rounded-lg border px-3 text-sm"
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
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                        catalogTab === "cabys" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"
                      }`}
                      onClick={() => setCatalogTab("cabys")}
                    >
                      CABYS
                    </button>
                    <button
                      className={`h-9 px-3 rounded-lg border text-sm font-semibold ${
                        catalogTab === "catalogs" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"
                      }`}
                      onClick={() => setCatalogTab("catalogs")}
                    >
                      {t("einv.catalogs.feCatalogs")}
                    </button>
                  </div>

                  {catalogTab === "cabys" && (
                    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                      <Card className="p-4 space-y-3">
                        <div className="text-sm font-semibold text-slate-900">{t("common.search")}</div>
                        <input
                          className="h-10 rounded-lg border px-3 text-sm w-full"
                          placeholder={t("einv.catalogs.cabysSearchPlaceholder")}
                          value={cabysQuery}
                          onChange={(e) => setCabysQuery(e.target.value)}
                        />
                        <Button variant="outline" onClick={() => loadCabys({ remote: true })} disabled={cabysLoading}>
                          {cabysLoading ? t("common.loading") : t("common.search")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={importCabysResults}
                          disabled={cabysLoading || cabysRows.length === 0}
                        >
                          {t("einv.catalogs.importResults")}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={importCabysSelected}
                          disabled={cabysLoading || Object.keys(cabysSelected).filter((k) => cabysSelected[k]).length === 0}
                        >
                          {t("einv.catalogs.importSelected")}
                        </Button>
                        <div className="text-xs text-slate-500">
                          {t("einv.catalogs.searchNote")}
                        </div>
                      </Card>

                      <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">{t("einv.catalogs.cabysCodes")}</div>
                          <div className="text-xs text-slate-500">
                            {t("einv.catalogs.results", { count: cabysRows.length })}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3 max-h-[52vh] overflow-y-auto">
                          {cabysRows.length === 0 && (
                            <div className="text-sm text-slate-600">
                              {t("einv.catalogs.cabysEmpty")}
                            </div>
                          )}
                          {cabysRows.map((r) => {
                            const id = String(r.id || r.code || "");
                            return (
                              <label key={id} className="rounded-lg border bg-white p-3 mb-2 last:mb-0 flex gap-3">
                                <input
                                  type="checkbox"
                                  checked={Boolean(cabysSelected[id])}
                                  onChange={(e) =>
                                    setCabysSelected((prev) => ({ ...prev, [id]: e.target.checked }))
                                  }
                                />
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{r.id}</div>
                                  <div className="text-xs text-slate-600 mt-1">{r.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </Card>

                      <Card className="p-4 space-y-3 lg:col-span-2">
                        <div className="text-sm font-semibold text-slate-900">{t("einv.catalogs.cabysImportTitle")}</div>
                        <div className="text-xs text-slate-600">
                          {t("einv.catalogs.cabysImportHelp")}{" "}
                          <span className="font-mono">CODE;DESCRIPTION</span>
                          {" "}{t("einv.catalogs.importHelpTail")}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            onChange={(e) => onPickCsv(e.target.files?.[0], setCabysImportItems, setCabysImportText)}
                          />
                          <div className="text-xs text-slate-500">
                            {cabysImportItems.length
                              ? t("einv.catalogs.rowsLoaded", { count: cabysImportItems.length })
                              : ""}
                          </div>
                        </div>
                        <textarea
                          className="w-full min-h-[140px] rounded-lg border px-3 py-2 text-sm font-mono"
                          value={cabysImportText}
                          onChange={(e) => setCabysImportText(e.target.value)}
                          placeholder={t("einv.catalogs.cabysImportPlaceholder")}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setCabysImportText("")}>
                            {t("common.clear")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCabysImportItems([]);
                              setCabysImportText("");
                            }}
                          >
                            {t("einv.clearAll")}
                          </Button>
                          <Button
                            onClick={() => doImportCabys("replace")}
                            disabled={!cabysImportText.trim() && cabysImportItems.length === 0}
                          >
                            {t("einv.import")}
                          </Button>
                        </div>
                      </Card>
                    </div>
                  )}

                  {catalogTab === "catalogs" && (
                    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                      <Card className="p-4 space-y-3">
                        <div className="text-sm font-semibold text-slate-900">{t("einv.catalogs.catalog")}</div>
                        <select
                          className="h-10 rounded-lg border px-3 text-sm"
                          value={catalogName}
                          onChange={(e) => setCatalogName(e.target.value)}
                        >
                          <option value="paymentMethods">{t("einv.catalogs.paymentMethods")}</option>
                          <option value="saleConditions">{t("einv.catalogs.saleConditions")}</option>
                          <option value="idTypes">{t("einv.catalogs.idTypes")}</option>
                          <option value="unitMeasures">{t("einv.catalogs.unitMeasures")}</option>
                          <option value="taxTypes">{t("einv.catalogs.taxTypes")}</option>
                          <option value="exemptionTypes">{t("einv.catalogs.exemptionTypes")}</option>
                          <option value="currencies">{t("einv.catalogs.currencies")}</option>
                          <option value="activities">{t("einv.catalogs.activities")}</option>
                        </select>
                        <div className="text-sm font-semibold text-slate-900 pt-2">{t("common.search")}</div>
                        <input
                          className="h-10 rounded-lg border px-3 text-sm w-full"
                          placeholder={t("einv.catalogs.catalogSearchPlaceholder")}
                          value={catalogQuery}
                          onChange={(e) => setCatalogQuery(e.target.value)}
                        />
                        <Button variant="outline" onClick={loadCatalog} disabled={catalogLoading}>
                          {catalogLoading ? t("common.loading") : t("common.search")}
                        </Button>
                      </Card>

                      <Card className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900">{t("einv.catalogs.entries")}</div>
                          <div className="text-xs text-slate-500">
                            {t("einv.catalogs.results", { count: catalogRows.length })}
                          </div>
                        </div>
                        <div className="rounded-lg border bg-slate-50 p-3 max-h-[52vh] overflow-y-auto">
                          {catalogRows.length === 0 && (
                            <div className="text-sm text-slate-600">
                              {t("einv.catalogs.entriesEmpty")}
                            </div>
                          )}
                          {catalogRows.map((r) => (
                            <div key={r.id} className="rounded-lg border bg-white p-3 mb-2 last:mb-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900">{r.code}</div>
                                <div className="text-xs text-slate-500">{r.version || ""}</div>
                              </div>
                              <div className="text-xs text-slate-600 mt-1">{r.label}</div>
                            </div>
                          ))}
                        </div>
                      </Card>

                      <Card className="p-4 space-y-3 lg:col-span-2">
                        <div className="text-sm font-semibold text-slate-900">{t("einv.catalogs.importTitle")}</div>
                        <div className="text-xs text-slate-600">
                          {t("einv.catalogs.importHelp")}{" "}
                          <span className="font-mono">CODE;LABEL</span>
                          {" "}{t("einv.catalogs.importHelpTail")}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="file"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            onChange={(e) => onPickCsv(e.target.files?.[0], setCatalogImportItems, setCatalogImportText)}
                          />
                          <div className="text-xs text-slate-500">
                            {catalogImportItems.length
                              ? t("einv.catalogs.rowsLoaded", { count: catalogImportItems.length })
                              : ""}
                          </div>
                        </div>
                        <textarea
                          className="w-full min-h-[140px] rounded-lg border px-3 py-2 text-sm font-mono"
                          value={catalogImportText}
                          onChange={(e) => setCatalogImportText(e.target.value)}
                          placeholder={t("einv.catalogs.catalogImportPlaceholder")}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setCatalogImportText("")}>
                            {t("common.clear")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCatalogImportItems([]);
                              setCatalogImportText("");
                            }}
                          >
                            {t("einv.clearAll")}
                          </Button>
                          <Button
                            onClick={() => doImportCatalog("replace")}
                            disabled={!catalogImportText.trim() && catalogImportItems.length === 0}
                          >
                            {t("einv.import")}
                          </Button>
                        </div>
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
            <Card className="w-full max-w-4xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("einv.ack.title")}</div>
                  <div className="text-lg font-semibold text-slate-900">{t("einv.modal.details")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAckDetail}>
                    {t("common.close")}
                  </Button>
                </div>
              </div>

              {ackDetailLoading ? (
                <div className="text-sm text-slate-600">{t("common.loading")}</div>
              ) : !ackDetail ? (
                <div className="text-sm text-slate-600">{t("common.notFound")}</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3">
                      <div className="text-xs text-slate-500">{t("common.type")}</div>
                      <div className="font-medium">{ackDetail.type}</div>
                      <div className="text-xs text-slate-500 mt-2">{t("common.status")}</div>
                      <div className="font-medium">{ackDetail.status}</div>
                      <div className="text-xs text-slate-500 mt-2">{t("common.created")}</div>
                      <div className="text-sm">{ackDetail.createdAt ? new Date(ackDetail.createdAt).toLocaleString() : ""}</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xs text-slate-500">{t("einv.ack.document")}</div>
                      <div className="text-sm">
                        {ackDetail.doc?.docType}  -  {ackDetail.doc?.status}  -  {ackDetail.doc?.source || "-"}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">{t("einv.documents.invoiceNumber")}</div>
                      <div className="text-sm">
                        {ackDetail.doc?.invoice?.number ||
                          (ackDetail.doc?.restaurantOrder?.id
                            ? `${t("einv.order")} ${String(ackDetail.doc.restaurantOrder.id).slice(0, 8)}`
                            : "-")}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">{t("einv.documents.consecutive")}</div>
                      <div className="text-xs font-mono break-all">{ackDetail.doc?.consecutive || "-"}</div>
                      <div className="text-xs text-slate-500 mt-2">{t("einv.documents.key")}</div>
                      <div className="text-xs font-mono break-all">{ackDetail.doc?.key || "-"}</div>
                    </Card>
                  </div>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">{t("einv.acks.message")}</div>
                    <div className="text-sm whitespace-pre-wrap">{ackDetail.message || "-"}</div>
                  </Card>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">{t("einv.payload")}</div>
                    <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto max-h-[45vh] whitespace-pre-wrap">
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
            <Card className="w-full max-w-4xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("einv.ack.title")}</div>
                  <div className="text-lg font-semibold text-slate-900">{t("einv.modal.addImport")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAckCreate}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={saveAckCreate}>{t("common.save")}</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Card className="p-3 space-y-2">
                  <div className="text-xs text-slate-500">{t("einv.ack.documentId")}</div>
                  <input
                    className="h-10 rounded-lg border px-3 text-sm w-full"
                    value={ackCreateForm.documentId}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, documentId: e.target.value }))}
                    placeholder={t("einv.ack.documentIdPlaceholder")}
                  />
                  <div className="text-xs text-slate-500">{t("einv.ack.quickPick")}</div>
                  <select
                    className="h-10 rounded-lg border px-3 text-sm w-full"
                    value={ackCreateForm.documentId}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, documentId: e.target.value }))}
                  >
                    <option value="">{t("common.select")}</option>
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.docType} - {(d.invoice?.number ||
                          (d.restaurantOrder?.id ? `${t("einv.order")} ${String(d.restaurantOrder.id).slice(0, 8)}` : "-"))} - {d.consecutive || d.key || d.id}
                      </option>
                    ))}
                  </select>
                </Card>

                <Card className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-slate-500">{t("einv.acks.type")}</div>
                      <select
                        className="h-10 rounded-lg border px-3 text-sm w-full"
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
                        className="h-10 rounded-lg border px-3 text-sm w-full"
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
                    className="min-h-[80px] rounded-lg border px-3 py-2 text-sm w-full"
                    value={ackCreateForm.message}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder={t("einv.ack.messagePlaceholder")}
                  />
                </Card>
              </div>

              <Card className="p-3 space-y-2">
                <div className="text-xs text-slate-500">{t("einv.payloadPaste")}</div>
                <textarea
                  className="min-h-[220px] rounded-lg border px-3 py-2 text-sm w-full font-mono"
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
            <Card className="w-full max-w-5xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">{t("einv.doc.title")}</div>
                  <div className="text-lg font-semibold text-slate-900">{t("einv.modal.details")}</div>
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
                <div className="text-sm text-slate-600">{t("common.loading")}</div>
              ) : !docDetail ? (
                <div className="text-sm text-slate-600">{t("common.notFound")}</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 space-y-2">
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
                        {docDetail.invoice?.number ||
                          (docDetail.restaurantOrder?.id
                            ? `${t("einv.order")} ${String(docDetail.restaurantOrder.id).slice(0, 8)}`
                            : "-")}
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
                    <Card className="p-3 space-y-2">
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

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">{t("einv.doc.receiver")}</div>
                    <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[22vh]">
                      {JSON.stringify(docDetail.receiver || {}, null, 2)}
                    </pre>
                  </Card>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">{t("einv.payload")}</div>
                    <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                      {typeof docDetail.payload === "string"
                        ? docDetail.payload
                        : JSON.stringify(docDetail.payload || {}, null, 2)}
                    </pre>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 space-y-2">
                      <div className="text-xs text-slate-500">{t("einv.doc.signedXml")}</div>
                      <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                        {docDetail.xmlSigned || t("einv.doc.notGenerated")}
                      </pre>
                    </Card>
                    <Card className="p-3 space-y-2">
                      <div className="text-xs text-slate-500">{t("einv.doc.response")}</div>
                      <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
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

