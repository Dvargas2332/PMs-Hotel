import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut, RefreshCcw, Moon, Sun, ChevronDown, ChevronUp } from "lucide-react";

import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { SimpleTable } from "../components/ui/table";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const MEMBERSHIPS = ["HBASIC", "RBASIC", "STANDARD", "PRO", "PLATINUM"];
const MEMBERSHIP_LABELS = {
  HBASIC: "Hotel Basico",
  RBASIC: "Restaurante Basico",
  STANDARD: "EstÃ¡ndar",
  PRO: "Pro",
  PLATINUM: "Platino",
};

const CURRENCIES = [
  { code: "USD", label: "USD â€” DÃ³lar estadounidense" },
  { code: "EUR", label: "EUR â€” Euro" },
  { code: "CRC", label: "CRC â€” ColÃ³n costarricense" },
  { code: "JPY", label: "JPY â€” Yen japonÃ©s" },
  { code: "CAD", label: "CAD â€” DÃ³lar canadiense" },
  { code: "GBP", label: "GBP â€” Libra esterlina" },
  { code: "MXN", label: "MXN â€” Peso mexicano" },
  { code: "BRL", label: "BRL â€” Real brasileÃ±o" },
];

const PRINT_FORM_MODULES = [
  { id: "restaurant", label: "Restaurante" },
  { id: "frontdesk", label: "Front Desk" },
  { id: "accounting", label: "Contabilidad" },
  { id: "einvoicing", label: "Facturaci??n electr??nica" },
];

const CLIENT_FILTER_NONE = "__none__";

const INITIAL_CLIENT_FORM = {
  name: "",
  companyId: "",
  email: "",
  phone1: "",
  phone2: "",
  ownerName: "",
  managerName: "",
  managerId: "",
};

const INITIAL_CREATE_FORM = {
  clientId: "",
  name: "",
  membership: "HBASIC",
  membershipMonthlyFee: "",
  currency: "CRC",
  phone1: "",
  phone2: "",
  ownerName: "",
  managerName: "",
  companyId: "",
  managerId: "",
  hotelUserName: "",
  hotelUserEmail: "",
  hotelUserPassword: "",
  adminName: "Administrador",
  adminUsername: "",
  adminPassword: "",
};

const INITIAL_EDIT_FORM = {
  clientId: "",
  name: "",
  membership: "HBASIC",
  membershipMonthlyFee: "",
  currency: "CRC",
  phone1: "",
  phone2: "",
  ownerName: "",
  managerName: "",
  companyId: "",
  managerId: "",
};

const INITIAL_ADMIN_FORM = {
  id: "",
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const INITIAL_SMTP_FORM = {
  host: "",
  port: "587",
  user: "",
  pass: "",
  secure: false,
  from: "",
  to: "",
  replyTo: "",
  passSet: false,
};

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d || "");
  }
}

function monthKey(d) {
  try {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  } catch {
    return "";
  }
}

function fmtMoney(amount, currency) {
  const n = Number(amount || 0);
  const c = String(currency || "").toUpperCase();
  try {
    if (!c) return n.toFixed(2);
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c}`.trim();
  }
}

function buildPrintPreview(form) {
  const module = String(form?.module || "restaurant").toLowerCase();
  const docType = String(form?.docType || "TE").toUpperCase();
  const paper = String(form?.paperType || "80mm");
  const lines = [];
  lines.push("KAZEHANA CLOUD");
  lines.push(`Module: ${module}`);
  lines.push(`Doc: ${docType} (${paper})`);
  lines.push(`Date: ${new Date().toLocaleString()}`);
  lines.push("-".repeat(26));
  if (docType === "COMANDA") {
    lines.push("Mesa 12 - Comanda");
    lines.push("1x Cafe Latte      3.50");
    lines.push("1x Croissant       2.00");
    lines.push("Nota: Sin azucar");
  } else if (docType === "CLOSES") {
    lines.push("Cierre de caja");
    lines.push("Efectivo: 120.00");
    lines.push("Tarjeta:  80.00");
    lines.push("SINPE:    40.00");
    lines.push("Total:   240.00");
  } else {
    lines.push("1x Cafe Latte      3.50");
    lines.push("1x Croissant       2.00");
    lines.push("Sub-total:         5.50");
    lines.push("IVA:               0.72");
    lines.push("Total:             6.22");
  }
  lines.push("-".repeat(26));
  lines.push("Gracias por su visita");
  return lines.join("\n");
}

function fmtHotelNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "-";
  return `H-${String(Math.trunc(num)).padStart(6, "0")}`;
}

function normalizeCurrency(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

function buildHotelEditForm(hotel) {
  if (!hotel) return { ...INITIAL_EDIT_FORM };
  return {
    clientId: hotel.saasClientId || "",
    name: hotel.name || "",
    membership: hotel.membership || "HBASIC",
    membershipMonthlyFee: hotel.membershipMonthlyFee ? String(hotel.membershipMonthlyFee) : "",
    currency: hotel.currency || "CRC",
    phone1: hotel.phone1 || "",
    phone2: hotel.phone2 || "",
    ownerName: hotel.ownerName || "",
    managerName: hotel.managerName || "",
    companyId: hotel.companyId || "",
    managerId: hotel.managerId || "",
  };
}

export default function Launchergestor() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [panel, setPanel] = useState("billing"); // billing | database
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const saved = window.localStorage.getItem("launchergestor_theme");
    return saved === "dark" ? "dark" : "light";
  });

  const [loadingClients, setLoadingClients] = useState(false);
  const [listTab, setListTab] = useState("clients");
  const [clients, setClients] = useState([]);
  const [clientQ, setClientQ] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientForm, setClientForm] = useState(() => ({ ...INITIAL_CLIENT_FORM }));
  const [creatingClient, setCreatingClient] = useState(false);
  const [deletingClientId, setDeletingClientId] = useState("");

  const [loadingHotels, setLoadingHotels] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [q, setQ] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [editingHotel, setEditingHotel] = useState(false);
  const [hotelEditForm, setHotelEditForm] = useState(() => ({ ...INITIAL_EDIT_FORM }));
  const [savingHotel, setSavingHotel] = useState(false);
  const [deletingHotelId, setDeletingHotelId] = useState("");
  const [adminForm, setAdminForm] = useState(() => ({ ...INITIAL_ADMIN_FORM }));
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [launcherAdminForm, setLauncherAdminForm] = useState(() => ({ ...INITIAL_ADMIN_FORM }));
  const [launcherAdminLoading, setLauncherAdminLoading] = useState(false);
  const [launcherAdminSaving, setLauncherAdminSaving] = useState(false);
  const [smtpForm, setSmtpForm] = useState(() => ({ ...INITIAL_SMTP_FORM }));
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState("");
  const [showSmtp, setShowSmtp] = useState(false);
  const [printForms, setPrintForms] = useState([]);
  const [printFormsLoading, setPrintFormsLoading] = useState(false);
  const [printFormsSaving, setPrintFormsSaving] = useState(false);
  const [printFormsOpen, setPrintFormsOpen] = useState(true);
  const [globalFormIds, setGlobalFormIds] = useState([]);
  const [globalModules, setGlobalModules] = useState({
    restaurant: true,
    frontdesk: true,
    accounting: false,
    einvoicing: false,
  });
  const [selectedPrintFormId, setSelectedPrintFormId] = useState("");

  const [createForm, setCreateForm] = useState(() => ({ ...INITIAL_CREATE_FORM }));
  const [createTab, setCreateTab] = useState("hotel");
  const [creating, setCreating] = useState(false);
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState(null);

  const [billing, setBilling] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingForm, setBillingForm] = useState({
    month: "",
    amount: "",
    currency: "USD",
    note: "",
  });

  const [importFiles, setImportFiles] = useState({
    fdRooms: null,
    fdGuests: null,
    fdReservations: null,
    rPosItems: null,
    rInventoryItems: null,
    rSuppliers: null,
  });
  const [importing, setImporting] = useState({});
  const [lastImport, setLastImport] = useState(null);

  const loadSaasConfig = useCallback(async () => {
    setSmtpLoading(true);
    setSmtpStatus("");
    try {
      const { data } = await api.get("/gestor/saas-config");
      const smtp = data?.smtp || {};
      setSmtpForm((prev) => ({
        ...prev,
        ...INITIAL_SMTP_FORM,
        ...smtp,
        pass: "",
      }));
    } catch (err) {
      setSmtpStatus("No se pudo cargar la configuraciÃ³n SMTP.");
    } finally {
      setSmtpLoading(false);
    }
  }, []);

  const loadPrintForms = useCallback(async () => {
    setPrintFormsLoading(true);
    try {
      const { data } = await api.get("/gestor/print-forms");
      const list = Array.isArray(data?.forms) ? data.forms : [];
      const rawGlobal = data?.global || data?.globalForms || null;
      const globalConfig = (() => {
        if (rawGlobal && typeof rawGlobal === "object" && !Array.isArray(rawGlobal)) {
          return {
            formIds: Array.isArray(rawGlobal.formIds) ? rawGlobal.formIds.map((id) => String(id)) : [],
            modules: typeof rawGlobal.modules === "object" && rawGlobal.modules ? rawGlobal.modules : {},
          };
        }
        const formIds = Array.isArray(rawGlobal)
          ? rawGlobal.map((f) => String(f?.id || f))
          : [];
        return { formIds, modules: {} };
      })();
      const fallbackModules = PRINT_FORM_MODULES.reduce((acc, mod) => {
        acc[mod.id] = true;
        return acc;
      }, {});
      const nextModules = { ...fallbackModules, ...(globalConfig.modules || {}) };
      setPrintForms(list);
      setGlobalFormIds(globalConfig.formIds);
      setGlobalModules(nextModules);
      setSelectedPrintFormId((cur) => cur || list[0]?.id || "");
    } catch {
      setPrintForms([]);
      setGlobalFormIds([]);
    } finally {
      setPrintFormsLoading(false);
    }
  }, []);

  const saveGlobalForms = useCallback(async (nextIds, nextModules) => {
    setPrintFormsSaving(true);
    try {
      const payload = { formIds: nextIds, modules: nextModules || globalModules };
      const { data } = await api.put("/gestor/print-forms/global", payload);
      const rawGlobal = data?.global || data?.globalForms || null;
      const globalConfig = (() => {
        if (rawGlobal && typeof rawGlobal === "object" && !Array.isArray(rawGlobal)) {
          return {
            formIds: Array.isArray(rawGlobal.formIds) ? rawGlobal.formIds.map((id) => String(id)) : [],
            modules: typeof rawGlobal.modules === "object" && rawGlobal.modules ? rawGlobal.modules : {},
          };
        }
        const formIds = Array.isArray(rawGlobal)
          ? rawGlobal.map((f) => String(f?.id || f))
          : [];
        return { formIds, modules: {} };
      })();
      if (globalConfig.formIds.length) setGlobalFormIds(globalConfig.formIds);
      if (globalConfig.modules && Object.keys(globalConfig.modules).length > 0) {
        setGlobalModules((prev) => ({ ...prev, ...globalConfig.modules }));
      }
    } catch {
      // keep local selection on error
    } finally {
      setPrintFormsSaving(false);
    }
  }, [globalModules]);

  const onSaveSmtp = useCallback(async () => {
    setSmtpSaving(true);
    setSmtpStatus("");
    try {
      const payload = {
        smtp: {
          host: smtpForm.host,
          port: Number(smtpForm.port || 0),
          user: smtpForm.user,
          secure: Boolean(smtpForm.secure),
          from: smtpForm.from,
          to: smtpForm.to,
          replyTo: smtpForm.replyTo,
        },
      };
      if (smtpForm.pass) payload.smtp.pass = smtpForm.pass;
      const { data } = await api.put("/gestor/saas-config", payload);
      const smtp = data?.smtp || {};
      setSmtpForm((prev) => ({
        ...prev,
        ...INITIAL_SMTP_FORM,
        ...smtp,
        pass: "",
      }));
      setSmtpStatus("ConfiguraciÃ³n guardada.");
    } catch (err) {
      setSmtpStatus("No se pudo guardar la configuraciÃ³n SMTP.");
    } finally {
      setSmtpSaving(false);
    }
  }, [smtpForm]);

  useEffect(() => {
    if (showSmtp) {
      loadSaasConfig();
    }
  }, [showSmtp, loadSaasConfig]);

  const filteredClients = useMemo(() => {
    const term = String(clientQ || "").trim().toLowerCase();
    if (!term) return clients;
    return (clients || []).filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const id = String(c.id || "").toLowerCase();
      const companyId = String(c.companyId || "").toLowerCase();
      return name.includes(term) || id.includes(term) || companyId.includes(term);
    });
  }, [clients, clientQ]);

  const selectedClient = useMemo(
    () => (clients || []).find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const filteredHotels = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    let list = hotels || [];
    if (selectedClientId === CLIENT_FILTER_NONE) {
      list = list.filter((h) => !h?.saasClientId);
    } else if (selectedClientId) {
      list = list.filter((h) => h?.saasClientId === selectedClientId);
    }
    if (!term) return list;
    return (list || []).filter((h) => {
      const name = String(h.name || "").toLowerCase();
      const id = String(h.id || "").toLowerCase();
      const clientName = String(h.saasClientName || "").toLowerCase();
      return name.includes(term) || id.includes(term) || clientName.includes(term);
    });
  }, [hotels, q, selectedClientId]);

  const selectedHotel = useMemo(
    () => (hotels || []).find((h) => h.id === selectedHotelId) || null,
    [hotels, selectedHotelId]
  );
  const selectedPrintForm = useMemo(() => {
    if (!Array.isArray(printForms) || printForms.length === 0) return null;
    return printForms.find((f) => f.id === selectedPrintFormId) || printForms[0] || null;
  }, [printForms, selectedPrintFormId]);

  const renderPrintFormItems = () => {
    if (!Array.isArray(printForms) || printForms.length === 0) {
      return <div className="text-xs text-slate-500">No hay plantillas disponibles.</div>;
    }
    return (printForms || []).map((f) => {
      const id = String(f.id || "");
      const isSelected = id === selectedPrintFormId;
      const isGlobal = globalFormIds.includes(id);
      return (
        <div
          key={id}
          className={`rounded-lg border p-2 flex items-center justify-between gap-2 ${
            isSelected ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            className="text-left flex-1"
            onClick={() => setSelectedPrintFormId(id)}
          >
            <div className="text-sm font-semibold text-slate-900">{f.name || id}</div>
            <div className="text-[11px] text-slate-500">
              {String(f.module || "").toUpperCase()} - {String(f.docType || "").toUpperCase()} - {f.paperType}
            </div>
          </button>
          <label className="text-[11px] text-slate-600 flex items-center gap-1">
            <input
              type="checkbox"
              checked={isGlobal}
              disabled={printFormsSaving}
              onChange={() => {
                const nextIds = isGlobal
                  ? globalFormIds.filter((x) => x !== id)
                  : [...globalFormIds, id];
                setGlobalFormIds(nextIds);
                saveGlobalForms(nextIds, globalModules);
              }}
            />
            Global
          </label>
        </div>
      );
    });
  };

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const { data } = await api.get("/gestor/clients");
      const list = Array.isArray(data) ? data : [];
      setClients(list);
      setSelectedClientId((cur) => {
        if (!cur || cur === CLIENT_FILTER_NONE) return cur;
        return list.some((c) => c.id === cur) ? cur : "";
      });
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const loadHotels = useCallback(async () => {
    setLoadingHotels(true);
    try {
      const { data } = await api.get("/gestor/hotels");
      const list = Array.isArray(data) ? data : [];
      setHotels(list);
    } finally {
      setLoadingHotels(false);
    }
  }, []);

  const loadBilling = useCallback(async (hotelId) => {
    if (!hotelId) return;
    setBillingLoading(true);
    try {
      const { data } = await api.get(`/gestor/hotels/${encodeURIComponent(hotelId)}/billing`);
      setBilling(Array.isArray(data) ? data : []);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  const loadHotelAdmin = useCallback(async (hotelId) => {
    if (!hotelId) return;
    setAdminLoading(true);
    try {
      const { data } = await api.get(`/gestor/hotels/${encodeURIComponent(hotelId)}/admin`);
      setAdminForm((prev) => ({
        ...prev,
        id: data?.id || "",
        name: data?.name || "",
        email: data?.email || "",
        password: "",
        confirmPassword: "",
      }));
    } catch {
      setAdminForm({ ...INITIAL_ADMIN_FORM });
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const loadLauncherAdmin = useCallback(async (hotelId) => {
    if (!hotelId) return;
    setLauncherAdminLoading(true);
    try {
      const { data } = await api.get(`/gestor/hotels/${encodeURIComponent(hotelId)}/launcher-admin`);
      setLauncherAdminForm((prev) => ({
        ...prev,
        id: data?.id || "",
        name: data?.name || "",
        email: data?.username || "",
        password: "",
        confirmPassword: "",
      }));
    } catch {
      setLauncherAdminForm({ ...INITIAL_ADMIN_FORM });
    } finally {
      setLauncherAdminLoading(false);
    }
  }, []);
  useEffect(() => {
    loadClients().catch(() => {});
    loadHotels().catch(() => {});
    loadPrintForms().catch(() => {});
  }, [loadClients, loadHotels, loadPrintForms]);

  useEffect(() => {
    if (!Array.isArray(filteredHotels) || filteredHotels.length === 0) {
      setSelectedHotelId("");
      return;
    }
    setSelectedHotelId((cur) => (cur && filteredHotels.some((h) => h.id === cur) ? cur : filteredHotels[0].id));
  }, [filteredHotels]);

  useEffect(() => {
    if (!selectedHotelId) return;
    loadBilling(selectedHotelId).catch(() => {});
    loadHotelAdmin(selectedHotelId).catch(() => {});
    loadLauncherAdmin(selectedHotelId).catch(() => {});
  }, [selectedHotelId, loadBilling, loadHotelAdmin, loadLauncherAdmin]);

  useEffect(() => {
    if (!selectedHotel?.currency) return;
    setBillingForm((p) => ({ ...p, currency: p.currency || selectedHotel.currency }));
  }, [selectedHotel?.id, selectedHotel?.currency]);

  useEffect(() => {
    if (editingHotel) return;
    setHotelEditForm(buildHotelEditForm(selectedHotel));
  }, [selectedHotel, editingHotel]);

  useEffect(() => {
    // Evita que el navegador auto-rellene los inputs del "crear hotel" con credenciales guardadas.
    setCreateForm({ ...INITIAL_CREATE_FORM });
    setLastCreatedCredentials(null);
    const t = setTimeout(() => setCreateForm({ ...INITIAL_CREATE_FORM }), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!selectedClientId || selectedClientId === CLIENT_FILTER_NONE) return;
    setCreateForm((p) => (p.clientId ? p : { ...p, clientId: selectedClientId }));
  }, [selectedClientId]);

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleTheme = () => {
    setTheme((cur) => {
      const next = cur === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem("launchergestor_theme", next);
      } catch {}
      return next;
    });
  };

  const onCreateClient = async () => {
    if (creatingClient) return;

    const payload = {
      name: String(clientForm.name || "").trim(),
      companyId: String(clientForm.companyId || "").trim() || undefined,
      email: String(clientForm.email || "").trim() || undefined,
      phone1: String(clientForm.phone1 || "").trim() || undefined,
      phone2: String(clientForm.phone2 || "").trim() || undefined,
      ownerName: String(clientForm.ownerName || "").trim() || undefined,
      managerName: String(clientForm.managerName || "").trim() || undefined,
      managerId: String(clientForm.managerId || "").trim() || undefined,
    };

    if (!payload.name) return alert("Nombre del cliente requerido");

    setCreatingClient(true);
    try {
      const { data } = await api.post("/gestor/clients", payload);
      await loadClients();
      if (data?.id) setSelectedClientId(data.id);
      setClientForm({ ...INITIAL_CLIENT_FORM });
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo crear el cliente");
    } finally {
      setCreatingClient(false);
    }
  };

  const onCreateHotel = async () => {
    if (creating) return;

    const clientId = String(createForm.clientId || "").trim();
    if (!clientId) return alert("Selecciona el cliente (empresa).");

    const membershipMonthlyFee = Number(createForm.membershipMonthlyFee || 0);
    if (!Number.isFinite(membershipMonthlyFee) || membershipMonthlyFee < 0) {
      return alert("Costo mensual invÃ¡lido.");
    }

    const payload = {
      clientId,
      name: String(createForm.name || "").trim(),
      membership: createForm.membership,
      membershipMonthlyFee,
      currency: normalizeCurrency(createForm.currency || "CRC") || "CRC",
      phone1: String(createForm.phone1 || "").trim() || undefined,
      phone2: String(createForm.phone2 || "").trim() || undefined,
      ownerName: String(createForm.ownerName || "").trim() || undefined,
      managerName: String(createForm.managerName || "").trim() || undefined,
      companyId: String(createForm.companyId || "").trim() || undefined,
      managerId: String(createForm.managerId || "").trim() || undefined,
      hotelUserName: String(createForm.hotelUserName || "").trim() || undefined,
      hotelUserEmail: String(createForm.hotelUserEmail || "").trim() || undefined,
      hotelUserPassword: String(createForm.hotelUserPassword || "") || undefined,
      adminName: String(createForm.adminName || "").trim() || "Administrador",
      adminUsername: String(createForm.adminUsername || "").trim(),
      adminPassword: String(createForm.adminPassword || ""),
    };

    if (!payload.name) return alert("Nombre del hotel requerido");
    if (!payload.adminUsername) return alert("Usuario del administrador requerido");
    if (!payload.adminPassword || payload.adminPassword.length < 4) {
      return alert("Contrasena del administrador (min 4)");
    }
    if (payload.hotelUserPassword && payload.hotelUserPassword.length < 4) {
      return alert("Contrasena del usuario del hotel (min 4)");
    }

    setCreating(true);
    try {
      const { data } = await api.post("/gestor/hotels", payload);
      const createdHotel = data?.hotel;
      setLastCreatedCredentials(data?.credentials || null);
      await loadHotels();
      if (createdHotel?.id) setSelectedHotelId(createdHotel.id);
      setCreateForm({ ...INITIAL_CREATE_FORM });
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo crear el hotel");
    } finally {
      setCreating(false);
    }
  };

  const onSaveAdmin = async () => {
    if (!selectedHotelId || adminSaving) return;
    const name = String(adminForm.name || "").trim();
    const email = String(adminForm.email || "").trim().toLowerCase();
    const password = String(adminForm.password || "");
    const confirm = String(adminForm.confirmPassword || "");

    if (!name) return alert("Nombre del administrador requerido");
    if (!email) return alert("Email del administrador requerido");
    if (password && password.length < 4) return alert("ContraseÃ±a invÃ¡lida (min 4)");
    if (password && password !== confirm) return alert("Las contraseÃ±as no coinciden");

    const payload = { name, email };
    if (password) payload.password = password;

    setAdminSaving(true);
    try {
      await api.put(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}/admin`, payload);
      await loadHotelAdmin(selectedHotelId);
      alert("Administrador actualizado");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo actualizar el administrador");
    } finally {
      setAdminSaving(false);
    }
  };

  const onDeleteClient = async (clientId) => {
    if (!clientId || deletingClientId) return;
    if (!window.confirm("Â¿Eliminar este cliente? Esta acciÃ³n no se puede deshacer.")) return;
    setDeletingClientId(clientId);
    try {
      await api.delete(`/gestor/clients/${encodeURIComponent(clientId)}`);
      if (selectedClientId === clientId) setSelectedClientId("");
      await loadClients();
      await loadHotels();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo eliminar el cliente");
    } finally {
      setDeletingClientId("");
    }
  };

  const onDeleteHotel = async (hotelId) => {
    if (!hotelId || deletingHotelId) return;
    if (!window.confirm("Â¿Eliminar este hotel? Esta acciÃ³n no se puede deshacer.")) return;
    setDeletingHotelId(hotelId);
    try {
      await api.delete(`/gestor/hotels/${encodeURIComponent(hotelId)}`);
      if (selectedHotelId === hotelId) setSelectedHotelId("");
      await loadHotels();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo eliminar el hotel");
    } finally {
      setDeletingHotelId("");
    }
  };
  const onAddBilling = async () => {
    if (!selectedHotelId || billingSaving) return;

    const month = String(billingForm.month || "").trim();
    if (!month) return alert("Selecciona el mes (YYYY-MM).");

    const amount = Number(billingForm.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) return alert("Monto invÃ¡lido.");

    setBillingSaving(true);
    try {
      const paidAt = `${month}-01T00:00:00`;
      const payload = {
        amount,
        currency: normalizeCurrency(billingForm.currency || selectedHotel?.currency || "USD") || "USD",
        paidAt,
        note: String(billingForm.note || "").trim() || undefined,
      };
      const { data } = await api.post(
        `/gestor/hotels/${encodeURIComponent(selectedHotelId)}/billing`,
        payload
      );
      setBilling((prev) => [data, ...(prev || [])]);
      setBillingForm((p) => ({ ...p, month: "", amount: "", note: "" }));
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo guardar el cobro");
    } finally {
      setBillingSaving(false);
    }
  };

  const onSaveLauncherAdmin = async () => {
    if (!selectedHotelId || launcherAdminSaving) return;
    const name = String(launcherAdminForm.name || "").trim();
    const username = String(launcherAdminForm.email || "").trim().toLowerCase();
    const password = String(launcherAdminForm.password || "");
    const confirm = String(launcherAdminForm.confirmPassword || "");

    if (!name) return alert("Nombre del administrador requerido");
    if (!username) return alert("Usuario del administrador requerido");
    if (password && password.length < 4) return alert("Contrasena invalida (min 4)");
    if (password && password !== confirm) return alert("Las contrasenas no coinciden");

    const payload = { name, username };
    if (password) payload.password = password;

    setLauncherAdminSaving(true);
    try {
      await api.put(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}/launcher-admin`, payload);
      await loadLauncherAdmin(selectedHotelId);
      alert("Administrador de launcher actualizado");
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo actualizar el administrador");
    } finally {
      setLauncherAdminSaving(false);
    }
  };
  const onDeleteBilling = async (paymentId) => {
    if (!selectedHotelId || !paymentId) return;
    if (!window.confirm("Â¿Eliminar este cobro?")) return;
    try {
      await api.delete(
        `/gestor/hotels/${encodeURIComponent(selectedHotelId)}/billing/${encodeURIComponent(paymentId)}`
      );
      setBilling((prev) => (prev || []).filter((p) => p.id !== paymentId));
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo eliminar el cobro");
    }
  };

    const onStartEditHotel = () => {
    if (!selectedHotel) return;
    setHotelEditForm(buildHotelEditForm(selectedHotel));
    setEditingHotel(true);
  };

  const onCancelEditHotel = () => {
    setEditingHotel(false);
    setHotelEditForm(buildHotelEditForm(selectedHotel));
  };

  const onSaveEditHotel = async () => {
    if (!selectedHotelId || savingHotel) return;
    const membershipMonthlyFee = Number(hotelEditForm.membershipMonthlyFee || 0);
    if (!hotelEditForm.name.trim()) return alert("Nombre del hotel requerido");
    if (!Number.isFinite(membershipMonthlyFee) || membershipMonthlyFee < 0) {
      return alert("Costo mensual invÃ¡lido.");
    }

    const payload = {
      clientId: String(hotelEditForm.clientId || "").trim() || null,
      name: String(hotelEditForm.name || "").trim(),
      membership: hotelEditForm.membership,
      membershipMonthlyFee,
      currency: normalizeCurrency(hotelEditForm.currency || "CRC") || "CRC",
      phone1: String(hotelEditForm.phone1 || "").trim() || null,
      phone2: String(hotelEditForm.phone2 || "").trim() || null,
      ownerName: String(hotelEditForm.ownerName || "").trim() || null,
      managerName: String(hotelEditForm.managerName || "").trim() || null,
      companyId: String(hotelEditForm.companyId || "").trim() || null,
      managerId: String(hotelEditForm.managerId || "").trim() || null,
    };

    setSavingHotel(true);
    try {
      await api.put(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}`, payload);
      await loadHotels();
      setEditingHotel(false);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo actualizar el hotel");
    } finally {
      setSavingHotel(false);
    }
  };
const importEndpoints = useMemo(
    () => ({
      fdRooms: (hotelId) => `/gestor/hotels/${encodeURIComponent(hotelId)}/import/frontdesk/rooms`,
      fdGuests: (hotelId) => `/gestor/hotels/${encodeURIComponent(hotelId)}/import/frontdesk/guests`,
      fdReservations: (hotelId) => `/gestor/hotels/${encodeURIComponent(hotelId)}/import/frontdesk/reservations`,
      rPosItems: (hotelId) => `/gestor/hotels/${encodeURIComponent(hotelId)}/import/restaurant/pos-items`,
      rInventoryItems: (hotelId) => `/gestor/hotels/${encodeURIComponent(hotelId)}/import/restaurant/inventory-items`,
      rSuppliers: (hotelId) => `/gestor/hotels/${encodeURIComponent(hotelId)}/import/restaurant/suppliers`,
    }),
    []
  );

  const onUpload = async (key) => {
    if (!selectedHotelId) return alert("Selecciona un hotel.");
    const file = importFiles[key];
    if (!file) return alert("Selecciona un archivo (.csv o .xlsx).");

    const endpointFn = importEndpoints[key];
    if (!endpointFn) return alert("ImportaciÃ³n no soportada.");

    if (importing[key]) return;
    setImporting((p) => ({ ...p, [key]: true }));
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(endpointFn(selectedHotelId), form, {
        timeout: 120000,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLastImport({ key, ...data });
      const skipped = Number(data?.skipped || 0);
      const skippedText = skipped > 0 ? `, ${skipped} omitidos` : "";
      const errors = Array.isArray(data?.errors) ? data.errors : [];
      const preview = errors
        .slice(0, 5)
        .map((e) => `L${e?.row ?? "?"}: ${e?.message || "Error"}`)
        .join("\n");
      const details = preview ? `\n\nDetalles:\n${preview}${errors.length > 5 ? `\n... y ${errors.length - 5} más` : ""}` : "";
      alert(`ImportaciÃ³n completada: ${data?.created ?? 0} creados, ${data?.updated ?? 0} actualizados${skippedText}.${details}`);
    } catch (err) {
      const msg = String(err?.message || "");
      const code = String(err?.code || "");
      if (code === "ECONNABORTED" || msg.toLowerCase().includes("timeout")) {
        alert("La importación tardó demasiado en responder. Inténtalo de nuevo o usa un archivo más pequeño.");
        return;
      }
      alert(err?.response?.data?.message || err?.message || "No se pudo importar");
    } finally {
      setImporting((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 ${theme === "dark" ? "lg-theme-dark" : "lg-theme-light"}`}>
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold text-slate-900">Gestor Principal</div>
            <div className="text-xs text-slate-500">Crear hoteles y registrar cobros mensuales.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {theme === "dark" ? "Claro" : "Oscuro"}
            </Button>
            <Button variant="outline" onClick={() => setShowSmtp((v) => !v)}>
              Configurar SMTP
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                loadClients().catch(() => {});
                loadHotels().catch(() => {});
              }}
              disabled={loadingHotels || loadingClients}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button variant="outline" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesiÃ³n
            </Button>
          </div>
        </div>

        {showSmtp ? (

        <Card className="p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Plantillas de impresi?n</div>
              <div className="text-xs text-slate-500">
                Vista previa y activaci?n global de formatos para todos los m?dulos.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => loadPrintForms()} disabled={printFormsLoading}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button type="button" variant="outline" onClick={() => setPrintFormsOpen((v) => !v)}>
                {printFormsOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Mostrar
                  </>
                )}
              </Button>
            </div>
          </div>

          {printFormsOpen && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">M??dulos</span>
              {PRINT_FORM_MODULES.map((mod) => (
                <label key={mod.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={Boolean(globalModules?.[mod.id])}
                    disabled={printFormsSaving}
                    onChange={(e) => {
                      const next = { ...globalModules, [mod.id]: e.target.checked };
                      setGlobalModules(next);
                      saveGlobalForms(globalFormIds, next);
                    }}
                  />
                  {mod.label}
                </label>
              ))}
            </div>
          )}

          {!printFormsOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <div>
                {printForms.length} plantillas ? {globalFormIds.length} globales
              </div>
              <div>{selectedPrintForm ? selectedPrintForm.name : "Sin selecci?n"}</div>
            </div>
          ) : printFormsLoading ? (
            <div className="text-sm text-slate-500">Cargando plantillas...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3">
              <div className="space-y-2">
                {renderPrintFormItems()}
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-2">Vista previa</div>
                {selectedPrintForm ? (
                  <pre className="text-[12px] leading-5 font-mono whitespace-pre-wrap text-slate-800">
                    {buildPrintPreview(selectedPrintForm)}
                  </pre>
                ) : (
                  <div className="text-xs text-slate-500">Selecciona una plantilla.</div>
                )}
              </div>
            </div>
          )}
        </Card>
        ) : null}

        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Plantillas de impresion</div>
              <div className="text-xs text-slate-500">
                Vista previa y activacion global de formatos para todos los modulos.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => loadPrintForms()} disabled={printFormsLoading}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Actualizar
              </Button>
              <Button type="button" variant="outline" onClick={() => setPrintFormsOpen((v) => !v)}>
                {printFormsOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Mostrar
                  </>
                )}
              </Button>
            </div>
          </div>

          {!printFormsOpen ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <div>
                {printForms.length} plantillas - {globalFormIds.length} globales
              </div>
              <div>{selectedPrintForm ? selectedPrintForm.name : "Sin seleccion"}</div>
            </div>
          ) : printFormsLoading ? (
            <div className="text-sm text-slate-500">Cargando plantillas...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
              <div className="space-y-2">
                {renderPrintFormItems()}
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-slate-500 mb-2">Vista previa</div>
                {selectedPrintForm ? (
                  <pre className="text-[12px] leading-5 font-mono whitespace-pre-wrap text-slate-800">
                    {buildPrintPreview(selectedPrintForm)}
                  </pre>
                ) : (
                  <div className="text-xs text-slate-500">Selecciona una plantilla.</div>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setListTab("clients")}
                  className={`rounded-t-lg border px-3 py-1.5 text-xs -mb-px ${
                    listTab === "clients"
                      ? "border-slate-200 bg-white text-slate-900"
                      : "border-transparent bg-slate-50 text-slate-500"
                  }`}
                >
                  Clientes
                </button>
                <button
                  type="button"
                  onClick={() => setListTab("hotels")}
                  className={`rounded-t-lg border px-3 py-1.5 text-xs -mb-px ${
                    listTab === "hotels"
                      ? "border-slate-200 bg-white text-slate-900"
                      : "border-transparent bg-slate-50 text-slate-500"
                  }`}
                >
                  Hoteles
                </button>
                <div className="ml-auto text-xs text-slate-500">
                  {listTab === "clients" ? filteredClients.length : filteredHotels.length}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                {listTab === "clients" ? (
                  <>
                    <Input
                      placeholder="Buscar cliente..."
                      value={clientQ}
                      onChange={(e) => setClientQ(e.target.value)}
                      disabled={loadingClients}
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedClientId("")}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          !selectedClientId ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(CLIENT_FILTER_NONE)}
                        className={`rounded-lg border px-3 py-1.5 text-xs ${
                          selectedClientId === CLIENT_FILTER_NONE
                            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        Sin empresa
                      </button>
                    </div>

                    <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                      {filteredClients.map((c) => (
                        <div
                          key={c.id}
                          className={`w-full rounded-xl border px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-3 ${
                            selectedClientId === c.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedClientId(c.id)}
                            className="flex-1 text-left"
                          >
                            <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                              <span className="truncate">{c.companyId || "Sin identificacion"}</span>
                              <span>{Number(c.hotelsCount || 0)} hoteles</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-rose-600 hover:underline disabled:opacity-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteClient(c.id);
                            }}
                            disabled={Boolean(deletingClientId)}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                      {!loadingClients && filteredClients.length === 0 && (
                        <div className="text-sm text-slate-500">No hay clientes.</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-slate-500">
                      Filtro:{" "}
                      {selectedClientId
                        ? selectedClientId === CLIENT_FILTER_NONE
                          ? "Sin empresa"
                          : selectedClient?.name || "Empresa"
                        : "Todos"}
                    </div>
                    <Input placeholder="Buscar hotel..." value={q} onChange={(e) => setQ(e.target.value)} />
                    <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                      {filteredHotels.map((h) => (
                        <div
                          key={h.id}
                          className={`w-full rounded-xl border px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-3 ${
                            selectedHotelId === h.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedHotelId(h.id)}
                            className="flex-1 text-left"
                          >
                            <div className="font-semibold text-slate-900 truncate">{h.name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                              <span>{MEMBERSHIP_LABELS[h.membership] || h.membership}</span>
                              <span>{fmtHotelNumber(h.number)}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">Empresa: {h.saasClientName || "-"}</div>
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-rose-600 hover:underline disabled:opacity-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteHotel(h.id);
                            }}
                            disabled={Boolean(deletingHotelId)}
                          >
                            Eliminar
                          </button>
                        </div>
                      ))}
                      {!loadingHotels && filteredHotels.length === 0 && (
                        <div className="text-sm text-slate-500">No hay hoteles.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
<Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateTab("hotel")}
                  className={`rounded-t-lg border px-3 py-1.5 text-xs -mb-px ${
                    createTab === "hotel"
                      ? "border-slate-200 bg-white text-slate-900"
                      : "border-transparent bg-slate-50 text-slate-500"
                  }`}
                >
                  Hotel crear
                </button>
                <button
                  type="button"
                  onClick={() => setCreateTab("client")}
                  className={`rounded-t-lg border px-3 py-1.5 text-xs -mb-px ${
                    createTab === "client"
                      ? "border-slate-200 bg-white text-slate-900"
                      : "border-transparent bg-slate-50 text-slate-500"
                  }`}
                >
                  Cliente crear
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                {createTab === "client" ? (
                  <form
                    autoComplete="off"
                    className="grid grid-cols-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onCreateClient();
                    }}
                  >
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Nombre de la empresa</div>
                      <Input
                        autoComplete="off"
                        placeholder="Ej: Grupo Kazehana"
                        value={clientForm.name}
                        onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Identificacion</div>
                        <Input
                          autoComplete="off"
                          placeholder="Cedula juridica"
                          value={clientForm.companyId}
                          onChange={(e) => setClientForm((p) => ({ ...p, companyId: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="px-1 text-slate-600 text-xs">Email</div>
                        <Input
                          type="email"
                          autoComplete="off"
                          placeholder="Opcional"
                          value={clientForm.email}
                          onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Telefono 1</div>
                        <Input
                          autoComplete="off"
                          placeholder="Opcional"
                          value={clientForm.phone1}
                          onChange={(e) => setClientForm((p) => ({ ...p, phone1: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Telefono 2</div>
                        <Input
                          autoComplete="off"
                          placeholder="Opcional"
                          value={clientForm.phone2}
                          onChange={(e) => setClientForm((p) => ({ ...p, phone2: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Dueno</div>
                        <Input
                          autoComplete="off"
                          placeholder="Opcional"
                          value={clientForm.ownerName}
                          onChange={(e) => setClientForm((p) => ({ ...p, ownerName: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Encargado</div>
                        <Input
                          autoComplete="off"
                          placeholder="Opcional"
                          value={clientForm.managerName}
                          onChange={(e) => setClientForm((p) => ({ ...p, managerName: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Identificacion encargado</div>
                      <Input
                        autoComplete="off"
                        placeholder="Opcional"
                        value={clientForm.managerId}
                        onChange={(e) => setClientForm((p) => ({ ...p, managerId: e.target.value }))}
                      />
                    </div>

                    <Button type="submit" disabled={creatingClient}>
                      {creatingClient ? "Creando..." : "Crear cliente"}
                    </Button>
                  </form>
                ) : (
                  <form
                    autoComplete="off"
                    className="grid grid-cols-1 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onCreateHotel();
                    }}
                  >
                    <input
                      aria-hidden="true"
                      tabIndex={-1}
                      className="hidden"
                      type="text"
                      name="username"
                      autoComplete="username"
                    />
                    <input
                      aria-hidden="true"
                      tabIndex={-1}
                      className="hidden"
                      type="email"
                      name="email"
                      autoComplete="email"
                    />
                    <input
                      aria-hidden="true"
                      tabIndex={-1}
                      className="hidden"
                      type="password"
                      name="password"
                      autoComplete="current-password"
                    />

                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Nombre del hotel</div>
                      <Input
                        name="hotelName"
                        autoComplete="off"
                        placeholder="Ej: Kazehana"
                        value={createForm.name}
                        onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Cliente (empresa)</div>
                      <select
                        name="hotelClientId"
                        className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                        value={createForm.clientId}
                        onChange={(e) => setCreateForm((p) => ({ ...p, clientId: e.target.value }))}
                      >
                        <option value="">Selecciona una empresa...</option>
                        {(clients || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Membresada</div>
                        <select
                          name="hotelMembership"
                          className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                          value={createForm.membership}
                          onChange={(e) => setCreateForm((p) => ({ ...p, membership: e.target.value }))}
                        >
                          {MEMBERSHIPS.map((m) => (
                            <option key={m} value={m}>
                              {MEMBERSHIP_LABELS[m] || m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Moneda</div>
                        <select
                          name="hotelCurrency"
                          className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                          value={createForm.currency}
                          onChange={(e) => setCreateForm((p) => ({ ...p, currency: e.target.value }))}
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Costo mensual ({createForm.currency})</div>
                        <Input
                          name="hotelMembershipMonthlyFee"
                          money
                          type="number"
                          min="0"
                          step="0.01"
                          autoComplete="off"
                          placeholder="0.00"
                          value={createForm.membershipMonthlyFee}
                          onChange={(e) =>
                            setCreateForm((p) => ({
                              ...p,
                              membershipMonthlyFee: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Telefono principal</div>
                        <Input
                          name="hotelPhone1"
                          autoComplete="off"
                          placeholder="Ej: +506 8888-8888"
                          value={createForm.phone1}
                          onChange={(e) => setCreateForm((p) => ({ ...p, phone1: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Telefono secundario</div>
                        <Input
                          name="hotelPhone2"
                          autoComplete="off"
                          placeholder="Opcional"
                          value={createForm.phone2}
                          onChange={(e) => setCreateForm((p) => ({ ...p, phone2: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Identificacion empresa</div>
                        <Input
                          name="hotelCompanyId"
                          autoComplete="off"
                          placeholder="Cedula juridica"
                          value={createForm.companyId}
                          onChange={(e) => setCreateForm((p) => ({ ...p, companyId: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Nombre del dueno</div>
                        <Input
                          name="hotelOwnerName"
                          autoComplete="off"
                          placeholder="Opcional"
                          value={createForm.ownerName}
                          onChange={(e) => setCreateForm((p) => ({ ...p, ownerName: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Gerente / encargado</div>
                        <Input
                          name="hotelManagerName"
                          autoComplete="off"
                          placeholder="Opcional"
                          value={createForm.managerName}
                          onChange={(e) => setCreateForm((p) => ({ ...p, managerName: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Identificacion encargado</div>
                      <Input
                        name="hotelManagerId"
                        autoComplete="off"
                        placeholder="Cedula"
                        value={createForm.managerId}
                        onChange={(e) => setCreateForm((p) => ({ ...p, managerId: e.target.value }))}
                      />
                    </div>

                    <div className="mt-1 border-t border-slate-200 pt-3 grid grid-cols-1 gap-2">
                      <div className="text-sm font-semibold text-slate-900">Usuario del hotel (login principal)</div>
                      <div className="text-xs text-slate-500">
                        Si dejas el email o la contraseÃ±a vacÃ­os, se generarÃ¡n automÃ¡ticamente.
                      </div>

                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Nombre visible</div>
                        <Input
                          name="hotelUserName"
                          autoComplete="off"
                          placeholder="Usuario principal"
                          value={createForm.hotelUserName}
                          onChange={(e) => setCreateForm((p) => ({ ...p, hotelUserName: e.target.value }))}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Email</div>
                          <Input
                            name="hotelUserEmail"
                            type="email"
                            autoComplete="off"
                            placeholder="Opcional"
                            value={createForm.hotelUserEmail}
                            onChange={(e) => setCreateForm((p) => ({ ...p, hotelUserEmail: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">ContraseÃ±a</div>
                          <Input
                            name="hotelUserPassword"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Opcional"
                            value={createForm.hotelUserPassword}
                            onChange={(e) => setCreateForm((p) => ({ ...p, hotelUserPassword: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 border-t border-slate-200 pt-3 grid grid-cols-1 gap-2">
                      <div className="text-sm font-semibold text-slate-900">Administrador del launcher</div>

                      <div className="space-y-1">
                        <div className="px-1 text-xs text-slate-600">Nombre visible</div>
                        <Input
                          name="hotelAdminName"
                          autoComplete="off"
                          placeholder="Nombre del administrador"
                          value={createForm.adminName}
                          onChange={(e) => setCreateForm((p) => ({ ...p, adminName: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Usuario</div>
                      <Input
                        name="hotelAdminUsername"
                        autoComplete="off"
                        placeholder="Usuario del administrador"
                        value={createForm.adminUsername}
                        onChange={(e) => setCreateForm((p) => ({ ...p, adminUsername: e.target.value }))}
                      />
                      </div>

                      <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">ContraseÃ±a</div>
                        <Input
                          name="hotelAdminPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Contrasena del administrador (min 4)"
                          value={createForm.adminPassword}
                          onChange={(e) => setCreateForm((p) => ({ ...p, adminPassword: e.target.value }))}
                        />
                      </div>
                    </div>

                    {lastCreatedCredentials ? (
                      <Card className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900">
                        <div className="text-sm font-semibold">Credenciales generadas</div>
                        <div className="text-xs mt-2">
                          Usuario del hotel:{" "}
                          <span className="font-mono">
                            {lastCreatedCredentials?.hotelUser?.email || "-"}
                          </span>
                        </div>
                        <div className="text-xs">
                          ContraseÃ±a:{" "}
                          <span className="font-mono">
                            {lastCreatedCredentials?.hotelUser?.password || "-"}
                          </span>
                        </div>
                        <div className="text-xs mt-2">
                          Launcher admin:{" "}
                          <span className="font-mono">
                            {lastCreatedCredentials?.launcherAdmin?.username || "-"}
                          </span>
                        </div>
                        <div className="text-xs">
                          ContraseÃ±a:{" "}
                          <span className="font-mono">
                            {lastCreatedCredentials?.launcherAdmin?.password || "-"}
                          </span>
                        </div>
                      </Card>
                    ) : null}

                    <Button type="submit" disabled={creating || !createForm.clientId}>
                      {creating ? "Creando..." : "Crear"}
                    </Button>
                  </form>
                )}
              </div>
            </Card>
</div><div className="lg:col-span-2 space-y-4">
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-slate-900">{selectedHotel?.name || "-"}</div>
                  <div className="text-sm text-slate-500">Codigo: {fmtHotelNumber(selectedHotel?.number)}</div>
                  <div className="text-sm text-slate-500">
                    Empresa: <span className="font-medium text-slate-800">{selectedHotel?.saasClientName || "-"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setPanel("billing")}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        panel === "billing" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"
                      }`}
                      disabled={!selectedHotelId}
                    >
                      Cobros
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel("database")}
                      className={`rounded-lg px-3 py-1.5 text-sm ${
                        panel === "database" ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"
                      }`}
                      disabled={!selectedHotelId}
                    >
                      Base de datos
                    </button>
                  </div>

                  <Button variant="outline" onClick={onStartEditHotel} disabled={!selectedHotelId}>
                    Editar
                  </Button>

                  {panel === "billing" ? (
                    <Button
                      variant="outline"
                      onClick={() => selectedHotelId && loadBilling(selectedHotelId)}
                      disabled={!selectedHotelId || billingLoading}
                    >
                      {billingLoading ? "Cargando..." : "Refrescar"}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Membresia</div>
                  <div className="font-semibold text-slate-900">
                    {selectedHotel?.membership
                      ? MEMBERSHIP_LABELS[selectedHotel.membership] || selectedHotel.membership
                      : "-"}
                  </div>
                </Card>
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Costo mensual</div>
                  <div className="font-semibold text-slate-900">
                    {selectedHotel ? fmtMoney(selectedHotel.membershipMonthlyFee || 0, selectedHotel.currency) : "-"}
                  </div>
                </Card>
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Creado</div>
                  <div className="font-semibold text-slate-900">
                    {selectedHotel?.createdAt ? fmtDate(selectedHotel.createdAt) : "-"}
                  </div>
                </Card>
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Moneda base</div>
                  <div className="font-semibold text-slate-900">{selectedHotel?.currency || "-"}</div>
                </Card>
              </div>

              {editingHotel ? (
                <Card className="p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Editar hotel</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Nombre</div>
                      <Input
                        value={hotelEditForm.name}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Cliente (empresa)</div>
                      <select
                        className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                        value={hotelEditForm.clientId || ""}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, clientId: e.target.value }))}
                      >
                        <option value="">Sin empresa</option>
                        {(clients || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Membresia</div>
                      <select
                        className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                        value={hotelEditForm.membership}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, membership: e.target.value }))}
                      >
                        {MEMBERSHIPS.map((m) => (
                          <option key={m} value={m}>
                            {MEMBERSHIP_LABELS[m] || m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Moneda</div>
                      <select
                        className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                        value={hotelEditForm.currency}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, currency: e.target.value }))}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Costo mensual</div>
                      <Input
                        money
                        type="number"
                        min="0"
                        step="0.01"
                        value={hotelEditForm.membershipMonthlyFee}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, membershipMonthlyFee: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Telefono principal</div>
                      <Input
                        value={hotelEditForm.phone1}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, phone1: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Telefono secundario</div>
                      <Input
                        value={hotelEditForm.phone2}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, phone2: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Nombre del dueno</div>
                      <Input
                        value={hotelEditForm.ownerName}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, ownerName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Gerente / encargado</div>
                      <Input
                        value={hotelEditForm.managerName}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, managerName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">IdentificaciÃ³n empresa</div>
                      <Input
                        value={hotelEditForm.companyId}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, companyId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">IdentificaciÃ³n encargado</div>
                      <Input
                        value={hotelEditForm.managerId}
                        onChange={(e) => setHotelEditForm((p) => ({ ...p, managerId: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={onCancelEditHotel}>
                      Cancelar
                    </Button>
                    <Button onClick={onSaveEditHotel} disabled={savingHotel}>
                      {savingHotel ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {editingHotel ? (
                <Card className="p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Administrador principal</div>
                  {adminLoading ? (
                    <div className="text-sm text-slate-500">Cargando...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Nombre</div>
                          <Input
                            value={adminForm.name}
                            onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Email</div>
                          <Input
                            type="email"
                            value={adminForm.email}
                            onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Nueva contraseÃ±a</div>
                          <Input
                            type="password"
                            value={adminForm.password}
                            onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Confirmar contraseÃ±a</div>
                          <Input
                            type="password"
                            value={adminForm.confirmPassword}
                            onChange={(e) => setAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button onClick={onSaveAdmin} disabled={adminSaving}>
                          {adminSaving ? "Guardando..." : "Guardar administrador"}
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              ) : null}

              {editingHotel ? (
                <Card className="p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Administrador del launcher</div>
                  {launcherAdminLoading ? (
                    <div className="text-sm text-slate-500">Cargando...</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Nombre</div>
                          <Input
                            value={launcherAdminForm.name}
                            onChange={(e) => setLauncherAdminForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Usuario</div>
                          <Input
                            value={launcherAdminForm.email}
                            onChange={(e) => setLauncherAdminForm((p) => ({ ...p, email: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Nueva contrasena</div>
                          <Input
                            type="password"
                            value={launcherAdminForm.password}
                            onChange={(e) => setLauncherAdminForm((p) => ({ ...p, password: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="px-1 text-xs text-slate-600">Confirmar contrasena</div>
                          <Input
                            type="password"
                            value={launcherAdminForm.confirmPassword}
                            onChange={(e) => setLauncherAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button onClick={onSaveLauncherAdmin} disabled={launcherAdminSaving}>
                          {launcherAdminSaving ? "Guardando..." : "Guardar launcher admin"}
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              ) : null}

              <div className="grid md:grid-cols-3 gap-3">
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Contacto</div>
                  <div className="text-sm text-slate-900">
                    {selectedHotel?.phone1 ? <div>Tel 1: {selectedHotel.phone1}</div> : <div>-</div>}
                    {selectedHotel?.phone2 ? <div>Tel 2: {selectedHotel.phone2}</div> : null}
                  </div>
                </Card>
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Responsables</div>
                  <div className="text-sm text-slate-900">
                    {selectedHotel?.ownerName ? <div>Dueno: {selectedHotel.ownerName}</div> : <div>-</div>}
                    {selectedHotel?.managerName ? <div>Encargado: {selectedHotel.managerName}</div> : null}
                  </div>
                </Card>
                <Card className="p-3 bg-white border border-slate-200">
                  <div className="text-xs text-slate-500">Identificaciones</div>
                  <div className="text-sm text-slate-900">
                    {selectedHotel?.companyId ? <div>Empresa: {selectedHotel.companyId}</div> : <div>-</div>}
                    {selectedHotel?.managerId ? <div>Encargado: {selectedHotel.managerId}</div> : null}
                  </div>
                </Card>
              </div>

              {panel === "billing" ? (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Cobros mensuales</div>
                  <div className="text-xs text-slate-500">
                    Cobros mensuales realizados al hotel por el uso del website.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Mes</div>
                      <Input
                        type="month"
                        value={billingForm.month}
                        onChange={(e) => setBillingForm((p) => ({ ...p, month: e.target.value }))}
                        disabled={!selectedHotelId}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Monto</div>
                      <Input
                        money
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingForm.amount}
                        onChange={(e) => setBillingForm((p) => ({ ...p, amount: e.target.value }))}
                        disabled={!selectedHotelId}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">Moneda</div>
                      <select
                        className="h-10 w-full rounded-xl border px-3 text-sm bg-white"
                        value={billingForm.currency}
                        onChange={(e) => setBillingForm((p) => ({ ...p, currency: e.target.value }))}
                        disabled={!selectedHotelId}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end justify-end">
                      <Button onClick={onAddBilling} disabled={!selectedHotelId || billingSaving}>
                        {billingSaving ? "Guardando..." : "Agregar cobro"}
                      </Button>
                    </div>
                  </div>

                  <Input
                    placeholder="Nota (opcional)"
                    value={billingForm.note}
                    onChange={(e) => setBillingForm((p) => ({ ...p, note: e.target.value }))}
                    disabled={!selectedHotelId}
                  />

                  <SimpleTable
                    cols={[
                      { key: "period", label: "Mes" },
                      { key: "amountFmt", label: "Monto" },
                      { key: "note", label: "Nota" },
                      { key: "created", label: "Registrado" },
                    ]}
                    rows={(billing || []).map((p) => ({
                      ...p,
                      period: monthKey(p.paidAt),
                      amountFmt: fmtMoney(p.amount, p.currency),
                      created: fmtDate(p.paidAt),
                      note: p.note || "",
                    }))}
                    actions={(row) => (
                      <Button
                        variant="outline"
                        className="text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => onDeleteBilling(row.id)}
                      >
                        Eliminar
                      </Button>
                    )}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Base de datos</div>
                    <div className="text-xs text-slate-500">
                      Sube archivos Excel o CSV para cargar datos al hotel seleccionado.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4 space-y-3">
                      <div className="font-semibold text-slate-900">Front Desk</div>

                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">Habitaciones (CSV/XLSX)</div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) =>
                            setImportFiles((p) => ({ ...p, fdRooms: e.target.files?.[0] || null }))
                          }
                        />
                        <Button variant="outline" onClick={() => onUpload("fdRooms")} disabled={importing.fdRooms}>
                          {importing.fdRooms ? "Subiendo..." : "Subir"}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">Clientes (CSV/XLSX)</div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) =>
                            setImportFiles((p) => ({ ...p, fdGuests: e.target.files?.[0] || null }))
                          }
                        />
                        <Button variant="outline" onClick={() => onUpload("fdGuests")} disabled={importing.fdGuests}>
                          {importing.fdGuests ? "Subiendo..." : "Subir"}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">Reservaciones (CSV/XLSX)</div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) =>
                            setImportFiles((p) => ({
                              ...p,
                              fdReservations: e.target.files?.[0] || null,
                            }))
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => onUpload("fdReservations")}
                          disabled={importing.fdReservations}
                        >
                          {importing.fdReservations ? "Subiendo..." : "Subir"}
                        </Button>
                      </div>
                    </Card>

                    <Card className="p-4 space-y-3">
                      <div className="font-semibold text-slate-900">Restaurant</div>

                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">ArtÃ­culos de TPV (CSV/XLSX)</div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) =>
                            setImportFiles((p) => ({ ...p, rPosItems: e.target.files?.[0] || null }))
                          }
                        />
                        <Button variant="outline" onClick={() => onUpload("rPosItems")} disabled={importing.rPosItems}>
                          {importing.rPosItems ? "Subiendo..." : "Subir"}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">ArtÃ­culos de inventario (CSV/XLSX)</div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) =>
                            setImportFiles((p) => ({ ...p, rInventoryItems: e.target.files?.[0] || null }))
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => onUpload("rInventoryItems")}
                          disabled={importing.rInventoryItems}
                        >
                          {importing.rInventoryItems ? "Subiendo..." : "Subir"}
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-slate-600">Proveedores (CSV/XLSX)</div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 hover:file:bg-slate-200"
                          onChange={(e) =>
                            setImportFiles((p) => ({ ...p, rSuppliers: e.target.files?.[0] || null }))
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={() => onUpload("rSuppliers")}
                          disabled={importing.rSuppliers}
                        >
                          {importing.rSuppliers ? "Subiendo..." : "Subir"}
                        </Button>
                      </div>
                    </Card>
                  </div>

                  {lastImport ? (
                    <div className="text-xs text-slate-500">
                      Ãšltima importaciÃ³n ({lastImport.key}): {lastImport.created ?? 0} creados,{" "}
                      {lastImport.updated ?? 0} actualizados, {lastImport.errors ?? 0} errores.
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}



















