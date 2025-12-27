import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import {
  BookOpen,
  ChevronRight,
  FileCheck2,
  FileText,
  Settings,
  Shield,
} from "lucide-react";
import EInvoicingUserMenu from "./EInvoicingUserMenu";

// Manually adjust tile size:
const LOBBY_TILE_SIZE = "md"; // "sm" | "md" | "lg"

const Tile = ({ title, desc, icon: Icon, onClick, tone = "violet", size = LOBBY_TILE_SIZE }) => {
  const cardDecor = {
    violet: { border: "border-violet-200", overlay: "from-violet-600/90 to-fuchsia-600/80" },
    slate: { border: "border-slate-200", overlay: "from-slate-700/90 to-slate-900/80" },
    indigo: { border: "border-indigo-200", overlay: "from-indigo-600/90 to-blue-500/80" },
    emerald: { border: "border-emerald-200", overlay: "from-emerald-600/90 to-emerald-500/80" },
  };
  const toneDecor = {
    violet: {
      iconBg: "bg-gradient-to-br from-violet-600 to-fuchsia-600",
      iconText: "text-white",
      watermark: "text-violet-600/20",
      glow: "shadow-violet-900/25",
    },
    slate: {
      iconBg: "bg-gradient-to-br from-slate-700 to-slate-950",
      iconText: "text-white",
      watermark: "text-slate-600/20",
      glow: "shadow-slate-950/30",
    },
    indigo: {
      iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600",
      iconText: "text-white",
      watermark: "text-indigo-600/20",
      glow: "shadow-indigo-900/25",
    },
    emerald: {
      iconBg: "bg-gradient-to-br from-emerald-500 to-emerald-700",
      iconText: "text-white",
      watermark: "text-emerald-600/20",
      glow: "shadow-emerald-900/25",
    },
  };

  const sizes = {
    sm: {
      root: "px-3 py-5 min-h-[128px]",
      iconWrap: "h-9 w-9 rounded-lg",
      icon: "w-4 h-4",
      title: "text-base",
      desc: "text-xs mt-1.5",
      chevron: "w-4 h-4",
    },
    md: {
      root: "px-4 py-7 min-h-[156px]",
      iconWrap: "h-10 w-10 rounded-xl",
      icon: "w-5 h-5",
      title: "text-lg",
      desc: "text-sm mt-2",
      chevron: "w-5 h-5",
    },
    lg: {
      root: "px-4 py-8 min-h-[176px]",
      iconWrap: "h-12 w-12 rounded-2xl",
      icon: "w-6 h-6",
      title: "text-xl",
      desc: "text-sm mt-2.5",
      chevron: "w-6 h-6",
    },
  };
  const s = sizes[size] || sizes.md;
  const c = cardDecor[tone] || cardDecor.violet;
  const d = toneDecor[tone] || toneDecor.violet;

  return (
    <button
      className={`group relative overflow-hidden rounded-2xl border ${c.border} bg-white shadow-sm text-left ${s.root} hover:shadow-md transition`}
      onClick={onClick}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${c.overlay} opacity-10`} />
      <div className="absolute -top-6 -right-6 pointer-events-none">
        <Icon className={`w-28 h-28 ${d.watermark}`} />
      </div>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className={`${s.iconWrap} ${d.iconBg} shadow-lg ${d.glow} flex items-center justify-center`}>
              <Icon className={`${s.icon} ${d.iconText}`} />
            </div>
            <div className={`${s.title} font-semibold text-slate-900`}>{title}</div>
          </div>
          <div className={`${s.desc} text-slate-700`}>{desc}</div>
        </div>
        <ChevronRight className={`${s.chevron} text-slate-500 group-hover:translate-x-0.5 transition`} />
      </div>
    </button>
  );
};

export default function EInvoicingPage() {
  const navigate = useNavigate();
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
  const [panel, setPanel] = React.useState(null);
  const [secretMeta, setSecretMeta] = React.useState({ smtp: {}, atv: {}, crypto: {} });
  const [secrets, setSecrets] = React.useState({ smtp: {}, atv: {}, crypto: {} });

  // Catalogs (CABYS + official catalogs loaded per-hotel)
  const [catalogTab, setCatalogTab] = React.useState("cabys"); // cabys | catalogs
  const [cabysQuery, setCabysQuery] = React.useState("");
  const [cabysLoading, setCabysLoading] = React.useState(false);
  const [cabysRows, setCabysRows] = React.useState([]);
  const [cabysImportText, setCabysImportText] = React.useState("");

  const [catalogName, setCatalogName] = React.useState("paymentMethods");
  const [catalogQuery, setCatalogQuery] = React.useState("");
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [catalogRows, setCatalogRows] = React.useState([]);
  const [catalogImportText, setCatalogImportText] = React.useState("");
  const [cabysImportItems, setCabysImportItems] = React.useState([]);
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

  const onPickCsv = React.useCallback(
    (file, setItems, setText) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || "");
        const rows = parseCsv(text);
        const items = rowsToItems(rows);
        setItems(items);
        setText("");
        window.dispatchEvent(
          new CustomEvent("pms:push-alert", {
            detail: { title: "CSV", desc: `Loaded ${items.length} rows from ${file.name}` },
          })
        );
      };
      reader.readAsText(file, "utf-8");
    },
    [parseCsv, rowsToItems]
  );

  const loadCabys = async () => {
    setCabysLoading(true);
    try {
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
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "CABYS", desc: "Imported." } }));
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
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Catalog", desc: "Imported." } }));
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

      return {
        ...settings,
        moduleConnections,
        moduleEmail,
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

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      const cfgRes = await api.get("/einvoicing/config");
      const nextCfg = cfgRes.data || cfg;
      setCfg((prev) => ({
        ...prev,
        ...nextCfg,
        settings: ensureSettings(nextCfg?.settings),
      }));
      setSecretMeta(nextCfg?.credentials || { smtp: {}, atv: {}, crypto: {} });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.put("/einvoicing/config", {
        enabled: cfg.enabled,
        version: cfg.version,
        provider: cfg.provider,
        environment: cfg.environment,
        settings: cfg.settings,
        credentials: secrets,
      });
      setSecrets({ smtp: {}, atv: {}, crypto: {} });
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: "Configuration saved." },
        })
      );
      await reload();
    } catch (err) {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: {
            title: "Electronic invoicing",
            desc: "Could not save configuration (missing permissions?).",
          },
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const setModuleConnection = (moduleKey, checked) => {
    setCfg((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        moduleConnections: {
          ...(prev.settings?.moduleConnections || defaultModuleConnections),
          [moduleKey]: Boolean(checked),
        },
      },
    }));
  };

  const updateEmailSetting = (moduleKey, patch) => {
    setCfg((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        moduleEmail: {
          ...(prev.settings?.moduleEmail || {}),
          [moduleKey]: {
            ...(prev.settings?.moduleEmail?.[moduleKey] || {}),
            ...patch,
          },
        },
      },
    }));
  };

  const setEmailProvider = (moduleKey, provider) => {
    const defaults = defaultSmtpSettings(provider);
    updateEmailSetting(moduleKey, {
      provider,
      smtpHost: defaults.host,
      smtpPort: defaults.port,
      smtpSecure: defaults.secure,
    });
  };

  const setSecret = (path, value) => {
    setSecrets((prev) => {
      const next = { ...prev };
      const [group, key, field] = path;
      next[group] = { ...(next[group] || {}) };
      if (key) next[group][key] = { ...(next[group][key] || {}) };
      if (field) next[group][key][field] = value;
      else next[group][key] = value;
      return next;
    });
  };

  const onCertificateFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      const base64 = typeof res === "string" ? res.split(",")[1] || "" : "";
      setCfg((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          crypto: { ...(prev.settings?.crypto || {}), certificateName: file.name },
        },
      }));
      setSecrets((prev) => ({
        ...prev,
        crypto: {
          ...(prev.crypto || {}),
          certificateBase64: base64,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const loadDocuments = async () => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(docsFilters).forEach(([k, v]) => {
        if (v) params.append(k, String(v));
      });
      const { data } = await api.get(`/einvoicing/documents?${params.toString()}`);
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
      const params = new URLSearchParams();
      Object.entries(acksFilters).forEach(([k, v]) => {
        if (v) params.append(k, String(v));
      });
      const { data } = await api.get(`/einvoicing/acks?${params.toString()}`);
      setAcks(Array.isArray(data) ? data : []);
    } catch {
      setAcks([]);
    } finally {
      setAcksLoading(false);
    }
  };

  const openAckDetail = async (id) => {
    if (!id) return;
    setAckDetailOpen(true);
    setAckDetail(null);
    setAckDetailLoading(true);
    try {
      const { data } = await api.get(`/einvoicing/acks/${encodeURIComponent(id)}`);
      setAckDetail(data || null);
    } catch {
      setAckDetail(null);
    } finally {
      setAckDetailLoading(false);
    }
  };

  const closeAckDetail = () => {
    setAckDetailOpen(false);
    setAckDetail(null);
  };

  const openDocDetail = async (id) => {
    if (!id) return;
    setDocDetailOpen(true);
    setDocDetail(null);
    setDocDetailLoading(true);
    try {
      const { data } = await api.get(`/einvoicing/documents/${encodeURIComponent(id)}`);
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

  const submitDoc = async (id) => {
    if (!id) return;
    try {
      await api.post(`/einvoicing/documents/${encodeURIComponent(id)}/submit`);
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: "Submitted (sandbox)." },
        })
      );
      await openDocDetail(id);
      await loadDocuments();
      await loadAcks();
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not submit document.";
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: msg },
        })
      );
    }
  };

  const refreshDoc = async (id) => {
    if (!id) return;
    try {
      await api.post(`/einvoicing/documents/${encodeURIComponent(id)}/refresh`);
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: "Status refreshed (sandbox)." },
        })
      );
      await openDocDetail(id);
      await loadDocuments();
      await loadAcks();
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not refresh status.";
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: msg },
        })
      );
    }
  };

  const cancelDoc = async (id) => {
    if (!id) return;
    if (!window.confirm("Cancel this electronic document?")) return;
    try {
      await api.post(`/einvoicing/documents/${encodeURIComponent(id)}/cancel`);
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: "Canceled." },
        })
      );
      await openDocDetail(id);
      await loadDocuments();
      await loadAcks();
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not cancel document.";
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Electronic invoicing", desc: msg },
        })
      );
    }
  };

  const openAckCreate = () => {
    setAckCreateForm((prev) => ({
      documentId: acksFilters.docId || prev.documentId || "",
      type: prev.type || "HACIENDA_RECEIPT",
      status: prev.status || "RECEIVED",
      message: "",
      payloadText: "",
    }));
    setAckCreateOpen(true);
  };

  const closeAckCreate = () => setAckCreateOpen(false);

  const saveAckCreate = async () => {
    if (!ackCreateForm.documentId.trim()) {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Acknowledgement", desc: "Document ID is required." },
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
          detail: { title: "Acknowledgement", desc: "Saved." },
        })
      );
      setAckCreateOpen(false);
      await loadAcks();
      await loadDocuments();
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: { title: "Acknowledgement", desc: "Could not save (missing permissions?)." },
        })
      );
    }
  };

  React.useEffect(() => {
    if (panel === "documents") loadDocuments();
    if (panel === "acks") loadAcks();
    if (panel === "catalogs") {
      loadCabys();
      loadCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const gridCols =
    LOBBY_TILE_SIZE === "lg"
      ? "md:grid-cols-2 lg:grid-cols-3"
      : LOBBY_TILE_SIZE === "sm"
        ? "md:grid-cols-3 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  const closePanel = () => setPanel(null);

  const panelTitle = React.useMemo(
    () => ({
      documents: "Issued documents (FE/TE)",
      acks: "Acknowledgements (acuses)",
      general: "General settings",
      issuer: "Issuer (emitter)",
      catalogs: "Catalogs (CABYS + official codes)",
    }),
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900">
      <header className="h-14 flex items-center justify-between px-6 bg-gradient-to-r from-violet-700 to-slate-800 text-white shadow">
        <div>
          <div className="text-xs uppercase text-violet-200/80">Electronic invoicing</div>
          <div className="text-sm font-semibold">Lobby</div>
        </div>
        <div className="flex items-center gap-2">
          <EInvoicingUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="text-white space-y-1">
          <div className="text-2xl font-semibold">Costa Rica (CR-4.4)</div>
          <div className="text-sm text-violet-100/70">
            Status: {cfg.enabled ? "Enabled" : "Disabled"} - {cfg.environment || "sandbox"}
          </div>
        </div>

        <div className={`grid gap-4 ${gridCols}`}>
          <Tile
            title="Documents"
            desc="All issued FE/TE documents and their status."
            icon={FileText}
            onClick={() => setPanel("documents")}
            tone="violet"
          />
          <Tile
            title="Acknowledgements"
            desc="Acuses/receipts linked to issued documents."
            icon={Shield}
            onClick={() => setPanel("acks")}
            tone="indigo"
          />
          <Tile
            title="Issuer"
            desc="Country code, ID number, branch and terminal."
            icon={FileCheck2}
            onClick={() => setPanel("issuer")}
            tone="indigo"
          />
          <Tile
            title="General"
            desc="Core config + connections, SMTP, Hacienda (ATV), signing certificate."
            icon={Settings}
            onClick={() => setPanel("general")}
            tone="slate"
          />
          <Tile
            title="Catalogs"
            desc="CABYS and official catalog codes used by CR-4.4."
            icon={BookOpen}
            onClick={() => setPanel("catalogs")}
            tone="emerald"
          />
          <Tile
            title="Back to launcher"
            desc="Return to module selection."
            icon={FileCheck2}
            onClick={() => navigate("/launcher")}
            tone="slate"
          />
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-5xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">Electronic invoicing</div>
                  <div className="text-lg font-semibold text-slate-900">{panelTitle[panel] || "Settings"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={reload} disabled={loading || saving}>
                    Reload
                  </Button>
                  <Button onClick={save} disabled={loading || saving}>
                    Save
                  </Button>
                  <Button variant="outline" onClick={closePanel}>
                    Close
                  </Button>
                </div>
              </div>

              {panel === "documents" && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-6 gap-2">
                    <input
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
                      placeholder="Search: invoice #, consecutive, key..."
                      value={docsFilters.q}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, q: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder="From (YYYY-MM-DD)"
                      value={docsFilters.dateFrom}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder="To (YYYY-MM-DD)"
                      value={docsFilters.dateTo}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
                      value={docsFilters.docType}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, docType: e.target.value }))}
                    >
                      <option value="">All types</option>
                      <option value="FE">FE</option>
                      <option value="TE">TE</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
                      value={docsFilters.status}
                      onChange={(e) => setDocsFilters((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="">All statuses</option>
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
                      <option value="">All modules</option>
                      <option value="frontdesk">Frontdesk</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="accounting">Accounting</option>
                    </select>
                    <Button variant="outline" onClick={loadDocuments} disabled={docsLoading}>
                      {docsLoading ? "Loading..." : "Apply filters"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDocsFilters({ q: "", docType: "", status: "", source: "", dateFrom: "", dateTo: "" })
                      }
                      disabled={docsLoading}
                    >
                      Clear
                    </Button>
                    <div className="md:col-span-2 text-xs text-slate-500 flex items-center justify-end">
                      {docs.length} items
                    </div>
                  </div>

                  <div className="overflow-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Module</th>
                          <th className="px-3 py-2 text-left">Invoice #</th>
                          <th className="px-3 py-2 text-left">Consecutive</th>
                          <th className="px-3 py-2 text-left">Acks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsLoading ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                              Loading...
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
                                  title="View details"
                                >
                                  {d.docType}
                                </button>
                              </td>
                              <td className="px-3 py-2">{d.status}</td>
                              <td className="px-3 py-2">{d.source || "-"}</td>
                              <td className="px-3 py-2">
                                {d.invoice?.number ||
                                  (d.restaurantOrder?.id ? `Order ${String(d.restaurantOrder.id).slice(0, 8)}` : "-")}
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
                                  title="View acknowledgements for this document"
                                >
                                  {Number(d.ackCount || 0)}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                              No documents match the filters.
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
                      placeholder="Search: invoice #, key, message..."
                      value={acksFilters.q}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, q: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder="From (YYYY-MM-DD)"
                      value={acksFilters.dateFrom}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    />
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder="To (YYYY-MM-DD)"
                      value={acksFilters.dateTo}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    />
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
                      value={acksFilters.docType}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, docType: e.target.value }))}
                    >
                      <option value="">All docs</option>
                      <option value="FE">FE</option>
                      <option value="TE">TE</option>
                    </select>
                    <select
                      className="h-10 rounded-lg border px-3 text-sm"
                      value={acksFilters.type}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, type: e.target.value }))}
                    >
                      <option value="">All types</option>
                      <option value="HACIENDA_RECEIPT">Hacienda receipt</option>
                      <option value="HACIENDA_STATUS">Hacienda status</option>
                      <option value="RECEIVER_MESSAGE">Receiver message</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="grid md:grid-cols-6 gap-2">
                    <select
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
                      value={acksFilters.status}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="">All statuses</option>
                      <option value="RECEIVED">RECEIVED</option>
                      <option value="ACCEPTED">ACCEPTED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="ERROR">ERROR</option>
                    </select>
                    <input
                      className="h-10 rounded-lg border px-3 text-sm md:col-span-2"
                      placeholder="Document ID (optional)"
                      value={acksFilters.docId}
                      onChange={(e) => setAcksFilters((p) => ({ ...p, docId: e.target.value }))}
                    />
                    <Button variant="outline" onClick={loadAcks} disabled={acksLoading}>
                      {acksLoading ? "Loading..." : "Apply filters"}
                    </Button>
                    <Button onClick={openAckCreate} disabled={acksLoading}>
                      Add / import
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setAcksFilters({ q: "", docId: "", docType: "", type: "", status: "", dateFrom: "", dateTo: "" })
                      }
                      disabled={acksLoading}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="overflow-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Module</th>
                          <th className="px-3 py-2 text-left">Invoice #</th>
                          <th className="px-3 py-2 text-left">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acksLoading ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                              Loading...
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
                                  (a.doc?.restaurantOrder?.id ? `Order ${String(a.doc.restaurantOrder.id).slice(0, 8)}` : "-")}
                              </td>
                              <td className="px-3 py-2 max-w-[420px]">
                                <button
                                  type="button"
                                  className="text-left w-full truncate hover:underline"
                                  title={a.message || "View details"}
                                  onClick={() => openAckDetail(a.id)}
                                >
                                  {a.message || "(view details)"}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                              No acknowledgements match the filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {panel === "general" && (
                <div className="space-y-3">
                  <div className="grid lg:grid-cols-2 gap-3">
                    <Card className="p-4 space-y-3">
                      <div className="font-semibold">General</div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(cfg.enabled)}
                          onChange={(e) => setCfg((s) => ({ ...s, enabled: e.target.checked }))}
                        />
                        Enable electronic invoicing
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="h-10 rounded-lg border px-3 text-sm"
                          value={cfg.version || "CR-4.4"}
                          onChange={(e) => setCfg((s) => ({ ...s, version: e.target.value }))}
                          placeholder="Version"
                        />
                        <input
                          className="h-10 rounded-lg border px-3 text-sm"
                          value={cfg.environment || "sandbox"}
                          onChange={(e) => setCfg((s) => ({ ...s, environment: e.target.value }))}
                          placeholder="Environment (sandbox/production)"
                        />
                        <input
                          className="h-10 rounded-lg border px-3 text-sm col-span-2"
                          value={cfg.provider || "hacienda-cr"}
                          onChange={(e) => setCfg((s) => ({ ...s, provider: e.target.value }))}
                          placeholder="Provider"
                        />
                      </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                      <div className="font-semibold">Module connections</div>
                      <div className="text-sm text-slate-600">
                        Enable which modules can issue electronic documents. Each module can have its own SMTP settings.
                      </div>
                      <div className="grid gap-2 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(cfg.settings?.moduleConnections?.frontdesk)}
                            onChange={(e) => setModuleConnection("frontdesk", e.target.checked)}
                          />
                          Front Desk
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(cfg.settings?.moduleConnections?.restaurant)}
                            onChange={(e) => setModuleConnection("restaurant", e.target.checked)}
                          />
                          Restaurant
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(cfg.settings?.moduleConnections?.accounting)}
                            onChange={(e) => setModuleConnection("accounting", e.target.checked)}
                          />
                          Accounting
                        </label>
                      </div>
                    </Card>
                  </div>

                  <Card className="p-4 space-y-3">
                    <div className="font-semibold">Billing Email (SMTP) per module</div>
                    <div className="grid md:grid-cols-3 gap-3">
                      {["frontdesk", "restaurant", "accounting"].map((m) => {
                        const emailCfg = cfg.settings?.moduleEmail?.[m] || {};
                        const connected = Boolean(cfg.settings?.moduleConnections?.[m]);
                        const hasPass = Boolean(secretMeta?.smtp?.[m]?.hasPassword);
                        return (
                          <Card key={m} className={`p-3 space-y-2 ${connected ? "" : "opacity-50"}`}>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-sm">{m}</div>
                              <div className="text-xs text-slate-500">{hasPass ? "Password set" : "No password"}</div>
                            </div>
                            <input
                              className="h-10 rounded-lg border px-3 text-sm"
                              placeholder="Billing email (from)"
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
                              <option value="custom">Custom SMTP</option>
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="h-10 rounded-lg border px-3 text-sm col-span-2"
                                placeholder="SMTP host"
                                value={emailCfg.smtpHost || ""}
                                onChange={(e) => updateEmailSetting(m, { smtpHost: e.target.value })}
                                disabled={!connected}
                              />
                              <input
                                className="h-10 rounded-lg border px-3 text-sm"
                                placeholder="Port"
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
                                Secure (TLS)
                              </label>
                              <input
                                className="h-10 rounded-lg border px-3 text-sm col-span-2"
                                placeholder="SMTP username"
                                value={emailCfg.smtpUsername || ""}
                                onChange={(e) => updateEmailSetting(m, { smtpUsername: e.target.value })}
                                disabled={!connected}
                              />
                              <input
                                className="h-10 rounded-lg border px-3 text-sm col-span-2"
                                placeholder={hasPass ? "SMTP password (leave blank to keep)" : "SMTP password"}
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

                  <div className="grid lg:grid-cols-2 gap-3">
                    <Card className="p-4 space-y-3">
                      <div className="font-semibold">Hacienda (ATV)</div>
                      <div className="text-sm text-slate-600">
                        Manual mode or API credentials storage (for future automation).
                      </div>
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
                        <option value="manual">Manual (ATV website)</option>
                        <option value="api">API</option>
                      </select>
                      <input
                        className="h-10 rounded-lg border px-3 text-sm"
                        placeholder="ATV username"
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
                        placeholder={secretMeta?.atv?.hasPassword ? "ATV password (leave blank to keep)" : "ATV password"}
                        type="password"
                        onChange={(e) =>
                          setSecrets((prev) => ({ ...prev, atv: { ...(prev.atv || {}), password: e.target.value } }))
                        }
                      />
                      <input
                        className="h-10 rounded-lg border px-3 text-sm"
                        placeholder={
                          secretMeta?.atv?.hasClientSecret ? "Client secret (leave blank to keep)" : "Client secret"
                        }
                        type="password"
                        onChange={(e) =>
                          setSecrets((prev) => ({
                            ...prev,
                            atv: { ...(prev.atv || {}), clientSecret: e.target.value },
                          }))
                        }
                      />
                      <textarea
                        className="min-h-[80px] rounded-lg border px-3 py-2 text-sm"
                        placeholder="Notes / manual steps"
                        value={cfg.settings?.atv?.notes || ""}
                        onChange={(e) =>
                          setCfg((prev) => ({
                            ...prev,
                            settings: { ...prev.settings, atv: { ...(prev.settings?.atv || {}), notes: e.target.value } },
                          }))
                        }
                      />
                    </Card>

                    <Card className="p-4 space-y-3">
                      <div className="font-semibold">Signing Certificate</div>
                      <div className="text-sm text-slate-600">
                        Upload the certificate (P12/PFX) used to sign documents. The file is stored as base64.
                      </div>
                      <div className="text-xs text-slate-500">
                        Current:{" "}
                        {cfg.settings?.crypto?.certificateName ||
                          (secretMeta?.crypto?.hasCertificate ? "Stored" : "None")}
                      </div>
                      <input type="file" accept=".p12,.pfx" onChange={(e) => onCertificateFile(e.target.files?.[0])} />
                      <input
                        className="h-10 rounded-lg border px-3 text-sm"
                        placeholder={
                          secretMeta?.crypto?.hasCertificatePassword
                            ? "Certificate password (leave blank to keep)"
                            : "Certificate password"
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
                        Recommended: use an app password for Gmail SMTP and keep certificate passwords secure.
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {panel === "issuer" && (
                <Card className="p-4 space-y-3">
                  <div className="font-semibold">Issuer (Costa Rica)</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <input
                      className="h-10 rounded-lg border px-3 text-sm"
                      placeholder="Country code (e.g. 506)"
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
                      placeholder="Issuer ID number (numbers only)"
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
                      placeholder="Issuer name (optional)"
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
                    <div className="font-semibold text-sm mb-2">Front Desk numbering</div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        className="h-10 rounded-lg border px-3 text-sm"
                        placeholder="Branch (001)"
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
                        placeholder="Terminal (00001)"
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
                        placeholder="Situation (1)"
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
                      FE/TE issuance from Front Desk requires Issuer ID number to generate the official key.
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="font-semibold text-sm mb-2">Restaurant numbering</div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <input
                        className="h-10 rounded-lg border px-3 text-sm"
                        placeholder="Branch (001)"
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
                        placeholder="Terminal (00001)"
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
                        placeholder="Situation (1)"
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
                      Restaurant issuance requires Issuer ID number and the module connection enabled.
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
                      FE catalogs (CR-4.4)
                    </button>
                  </div>

                  {catalogTab === "cabys" && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="h-10 rounded-lg border px-3 text-sm w-full md:w-[360px]"
                          placeholder="Search CABYS by code or description..."
                          value={cabysQuery}
                          onChange={(e) => setCabysQuery(e.target.value)}
                        />
                        <Button variant="outline" onClick={loadCabys} disabled={cabysLoading}>
                          {cabysLoading ? "Loading..." : "Search"}
                        </Button>
                      </div>

                      <div className="rounded-xl border bg-slate-50 p-3 max-h-[45vh] overflow-y-auto">
                        {cabysRows.length === 0 && (
                          <div className="text-sm text-slate-600">
                            No CABYS codes loaded for this hotel yet. Use import below (from the official CABYS file).
                          </div>
                        )}
                        {cabysRows.map((r) => (
                          <div key={r.id} className="py-2 border-b last:border-b-0">
                            <div className="text-sm font-semibold text-slate-900">{r.id}</div>
                            <div className="text-xs text-slate-600">{r.description}</div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border p-3 space-y-2">
                        <div className="text-sm font-semibold text-slate-900">Import CABYS (per hotel)</div>
                        <div className="text-xs text-slate-600">
                          Paste lines as <span className="font-mono">CODE;DESCRIPTION</span> (or tab-separated). Then click Import.
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => onPickCsv(e.target.files?.[0], setCabysImportItems, setCabysImportText)}
                          />
                          <div className="text-xs text-slate-500">
                            {cabysImportItems.length ? `${cabysImportItems.length} rows loaded from CSV` : ""}
                          </div>
                        </div>
                        <textarea
                          className="w-full min-h-[120px] rounded-lg border px-3 py-2 text-sm font-mono"
                          value={cabysImportText}
                          onChange={(e) => setCabysImportText(e.target.value)}
                          placeholder="00000000;Service or product description"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setCabysImportText("")}>
                            Clear
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCabysImportItems([]);
                              setCabysImportText("");
                            }}
                          >
                            Clear all
                          </Button>
                          <Button
                            onClick={() => doImportCabys("replace")}
                            disabled={!cabysImportText.trim() && cabysImportItems.length === 0}
                          >
                            Import
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {catalogTab === "catalogs" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-slate-600">Catalog</div>
                          <select
                            className="h-10 rounded-lg border px-3 text-sm"
                            value={catalogName}
                            onChange={(e) => setCatalogName(e.target.value)}
                          >
                            <option value="paymentMethods">Payment methods</option>
                            <option value="saleConditions">Sale conditions</option>
                            <option value="idTypes">Identification types</option>
                            <option value="unitMeasures">Unit measures</option>
                            <option value="taxTypes">Tax types</option>
                            <option value="exemptionTypes">Exemption types</option>
                            <option value="currencies">Currencies</option>
                            <option value="activities">Economic activities</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                          <div className="text-xs text-slate-600">Search</div>
                          <div className="flex gap-2">
                            <input
                              className="h-10 rounded-lg border px-3 text-sm w-full"
                              placeholder="Search by code or label..."
                              value={catalogQuery}
                              onChange={(e) => setCatalogQuery(e.target.value)}
                            />
                            <Button variant="outline" onClick={loadCatalog} disabled={catalogLoading}>
                              {catalogLoading ? "Loading..." : "Search"}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-slate-50 p-3 max-h-[45vh] overflow-y-auto">
                        {catalogRows.length === 0 && (
                          <div className="text-sm text-slate-600">
                            No entries loaded for this catalog yet. Import below using the official list for CR-4.4.
                          </div>
                        )}
                        {catalogRows.map((r) => (
                          <div key={r.id} className="py-2 border-b last:border-b-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900">{r.code}</div>
                              <div className="text-xs text-slate-500">{r.version || ""}</div>
                            </div>
                            <div className="text-xs text-slate-600">{r.label}</div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border p-3 space-y-2">
                        <div className="text-sm font-semibold text-slate-900">Import selected catalog (per hotel)</div>
                        <div className="text-xs text-slate-600">
                          Paste lines as <span className="font-mono">CODE;LABEL</span> (or tab-separated). Then click Import.
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => onPickCsv(e.target.files?.[0], setCatalogImportItems, setCatalogImportText)}
                          />
                          <div className="text-xs text-slate-500">
                            {catalogImportItems.length ? `${catalogImportItems.length} rows loaded from CSV` : ""}
                          </div>
                        </div>
                        <textarea
                          className="w-full min-h-[120px] rounded-lg border px-3 py-2 text-sm font-mono"
                          value={catalogImportText}
                          onChange={(e) => setCatalogImportText(e.target.value)}
                          placeholder="01;Cash"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setCatalogImportText("")}>
                            Clear
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setCatalogImportItems([]);
                              setCatalogImportText("");
                            }}
                          >
                            Clear all
                          </Button>
                          <Button
                            onClick={() => doImportCatalog("replace")}
                            disabled={!catalogImportText.trim() && catalogImportItems.length === 0}
                          >
                            Import
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {ackDetailOpen && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={closeAckDetail} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-slate-500">Acknowledgement</div>
                  <div className="text-lg font-semibold text-slate-900">Details</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAckDetail}>
                    Close
                  </Button>
                </div>
              </div>

              {ackDetailLoading ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : !ackDetail ? (
                <div className="text-sm text-slate-600">Not found.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3">
                      <div className="text-xs text-slate-500">Type</div>
                      <div className="font-medium">{ackDetail.type}</div>
                      <div className="text-xs text-slate-500 mt-2">Status</div>
                      <div className="font-medium">{ackDetail.status}</div>
                      <div className="text-xs text-slate-500 mt-2">Created</div>
                      <div className="text-sm">{ackDetail.createdAt ? new Date(ackDetail.createdAt).toLocaleString() : ""}</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xs text-slate-500">Document</div>
                      <div className="text-sm">
                        {ackDetail.doc?.docType}  -  {ackDetail.doc?.status}  -  {ackDetail.doc?.source || "-"}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">Invoice</div>
                      <div className="text-sm">
                        {ackDetail.doc?.invoice?.number ||
                          (ackDetail.doc?.restaurantOrder?.id ? `Order ${String(ackDetail.doc.restaurantOrder.id).slice(0, 8)}` : "-")}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">Consecutive</div>
                      <div className="text-xs font-mono break-all">{ackDetail.doc?.consecutive || "-"}</div>
                      <div className="text-xs text-slate-500 mt-2">Key</div>
                      <div className="text-xs font-mono break-all">{ackDetail.doc?.key || "-"}</div>
                    </Card>
                  </div>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">Message</div>
                    <div className="text-sm whitespace-pre-wrap">{ackDetail.message || "-"}</div>
                  </Card>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">Payload</div>
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
                  <div className="text-xs uppercase text-slate-500">Acknowledgement</div>
                  <div className="text-lg font-semibold text-slate-900">Add / import</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={closeAckCreate}>
                    Cancel
                  </Button>
                  <Button onClick={saveAckCreate}>Save</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Card className="p-3 space-y-2">
                  <div className="text-xs text-slate-500">Document ID</div>
                  <input
                    className="h-10 rounded-lg border px-3 text-sm w-full"
                    value={ackCreateForm.documentId}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, documentId: e.target.value }))}
                    placeholder="Paste documentId or pick one below"
                  />
                  <div className="text-xs text-slate-500">Quick pick (from loaded documents)</div>
                  <select
                    className="h-10 rounded-lg border px-3 text-sm w-full"
                    value={ackCreateForm.documentId}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, documentId: e.target.value }))}
                  >
                    <option value="">Select document...</option>
                    {docs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.docType} - {(d.invoice?.number || (d.restaurantOrder?.id ? `Order ${String(d.restaurantOrder.id).slice(0, 8)}` : "-"))} - {d.consecutive || d.key || d.id}
                      </option>
                    ))}
                  </select>
                </Card>

                <Card className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-slate-500">Ack type</div>
                      <select
                        className="h-10 rounded-lg border px-3 text-sm w-full"
                        value={ackCreateForm.type}
                        onChange={(e) => setAckCreateForm((p) => ({ ...p, type: e.target.value }))}
                      >
                        <option value="HACIENDA_RECEIPT">Hacienda receipt</option>
                        <option value="HACIENDA_STATUS">Hacienda status</option>
                        <option value="RECEIVER_MESSAGE">Receiver message</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Ack status</div>
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
                  <div className="text-xs text-slate-500">Message</div>
                  <textarea
                    className="min-h-[80px] rounded-lg border px-3 py-2 text-sm w-full"
                    value={ackCreateForm.message}
                    onChange={(e) => setAckCreateForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Optional message/summary"
                  />
                </Card>
              </div>

              <Card className="p-3 space-y-2">
                <div className="text-xs text-slate-500">Payload (paste JSON or XML/text)</div>
                <textarea
                  className="min-h-[220px] rounded-lg border px-3 py-2 text-sm w-full font-mono"
                  value={ackCreateForm.payloadText}
                  onChange={(e) => setAckCreateForm((p) => ({ ...p, payloadText: e.target.value }))}
                  placeholder="{...} or <xml>...</xml>"
                />
                <div className="text-xs text-slate-500">
                  If it starts with {"{"} or {"["} it will be parsed as JSON; otherwise it will be stored as text.
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
                  <div className="text-xs uppercase text-slate-500">Electronic document</div>
                  <div className="text-lg font-semibold text-slate-900">Details</div>
                </div>
                <div className="flex items-center gap-2">
                  {docDetail?.id && (
                    <>
                      <Button
                        onClick={() => submitDoc(docDetail.id)}
                        disabled={docDetail.status === "ACCEPTED" || docDetail.status === "CANCELED"}
                        title="Sandbox: sign + send + accept (simulated)"
                      >
                        Submit (sandbox)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => refreshDoc(docDetail.id)}
                        disabled={docDetail.status === "ACCEPTED" || docDetail.status === "CANCELED"}
                        title="Sandbox: refresh status (simulated)"
                      >
                        Refresh status
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => cancelDoc(docDetail.id)}
                        disabled={docDetail.status === "CANCELED"}
                        title="Cancel document"
                      >
                        Cancel
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
                      View acks ({Number(docDetail?.ackCount || 0)})
                    </Button>
                  )}
                  <Button variant="outline" onClick={closeDocDetail}>
                    Close
                  </Button>
                </div>
              </div>

              {docDetailLoading ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : !docDetail ? (
                <div className="text-sm text-slate-600">Not found.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 space-y-2">
                      <div className="text-xs text-slate-500">Type / status</div>
                      <div className="text-sm">
                        {docDetail.docType} {" - "} {docDetail.status} {" - "} {docDetail.source || "-"}
                      </div>
                      <div className="text-xs text-slate-500">Created</div>
                      <div className="text-sm">
                        {docDetail.createdAt ? new Date(docDetail.createdAt).toLocaleString() : ""}
                      </div>
                      <div className="text-xs text-slate-500">Invoice</div>
                      <div className="text-sm">
                        {docDetail.invoice?.number ||
                          (docDetail.restaurantOrder?.id ? `Order ${String(docDetail.restaurantOrder.id).slice(0, 8)}` : "-")}
                      </div>
                      <div className="text-xs text-slate-500">Total</div>
                      <div className="text-sm">
                        {docDetail.invoice
                          ? `${docDetail.invoice.total} ${docDetail.invoice.currency || ""}`
                          : docDetail.restaurantOrder
                            ? `${docDetail.restaurantOrder.total || 0}`
                            : "-"}
                      </div>
                    </Card>
                    <Card className="p-3 space-y-2">
                      <div className="text-xs text-slate-500">Branch / terminal</div>
                      <div className="text-sm">
                        {docDetail.branch || "-"} / {docDetail.terminal || "-"}
                      </div>
                      <div className="text-xs text-slate-500">Consecutive</div>
                      <div className="text-xs font-mono break-all">{docDetail.consecutive || "-"}</div>
                      <div className="text-xs text-slate-500">Key</div>
                      <div className="text-xs font-mono break-all">{docDetail.key || "-"}</div>
                    </Card>
                  </div>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">Receiver</div>
                    <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[22vh]">
                      {JSON.stringify(docDetail.receiver || {}, null, 2)}
                    </pre>
                  </Card>

                  <Card className="p-3 space-y-2">
                    <div className="text-xs text-slate-500">Payload</div>
                    <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                      {typeof docDetail.payload === "string"
                        ? docDetail.payload
                        : JSON.stringify(docDetail.payload || {}, null, 2)}
                    </pre>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-3">
                    <Card className="p-3 space-y-2">
                      <div className="text-xs text-slate-500">Signed XML</div>
                      <pre className="text-xs bg-slate-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap max-h-[30vh]">
                        {docDetail.xmlSigned || "(not generated yet)"}
                      </pre>
                    </Card>
                    <Card className="p-3 space-y-2">
                      <div className="text-xs text-slate-500">Response</div>
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
