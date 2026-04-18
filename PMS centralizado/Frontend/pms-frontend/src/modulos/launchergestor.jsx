import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, LogOut, RefreshCcw, ChevronRight, CircleUser,
  Plus, Pencil, Trash2, Upload, FileText, Settings, CreditCard,
  Users, Database, Printer,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

// ─── constants ────────────────────────────────────────────────────────────────
const MEMBERSHIPS = ["HBASIC", "RBASIC", "STANDARD", "PRO", "PLATINUM"];
const MEMBERSHIP_LABELS = {
  HBASIC: "Hotel Básico",
  RBASIC: "Restaurante Básico",
  STANDARD: "Estándar",
  PRO: "Pro",
  PLATINUM: "Platino",
};
const CURRENCIES = [
  { code: "USD", label: "USD – Dólar estadounidense" },
  { code: "EUR", label: "EUR – Euro" },
  { code: "CRC", label: "CRC – Colón costarricense" },
  { code: "JPY", label: "JPY – Yen japonés" },
  { code: "CAD", label: "CAD – Dólar canadiense" },
  { code: "GBP", label: "GBP – Libra esterlina" },
  { code: "MXN", label: "MXN – Peso mexicano" },
  { code: "BRL", label: "BRL – Real brasileño" },
];
const PRINT_FORM_MODULES = [
  { id: "restaurant", label: "Restaurante" },
  { id: "frontdesk", label: "Front Desk" },
  { id: "accounting", label: "Contabilidad" },
  { id: "einvoicing", label: "Facturación electrónica" },
];
const CLIENT_FILTER_NONE = "__none__";
const INITIAL_CLIENT_FORM = { name: "", companyId: "", email: "", phone1: "", phone2: "", ownerName: "", managerName: "", managerId: "" };
const INITIAL_CREATE_FORM = { clientId: "", name: "", membership: "HBASIC", membershipMonthlyFee: "", currency: "CRC", phone1: "", phone2: "", ownerName: "", managerName: "", companyId: "", managerId: "", hotelUserName: "", hotelUserEmail: "", hotelUserPassword: "", adminName: "Administrador", adminUsername: "", adminPassword: "" };
const INITIAL_EDIT_FORM = { clientId: "", name: "", membership: "HBASIC", membershipMonthlyFee: "", currency: "CRC", phone1: "", phone2: "", ownerName: "", managerName: "", companyId: "", managerId: "" };
const INITIAL_ADMIN_FORM = { id: "", name: "", email: "", password: "", confirmPassword: "" };
const INITIAL_SMTP_FORM = { host: "", port: "587", user: "", pass: "", secure: false, from: "", to: "", replyTo: "", passSet: false };

const NAV = [
  { id: "hoteles",    label: "Hoteles",      icon: Building2 },
  { id: "clientes",   label: "Clientes",     icon: Users },
  { id: "crear",      label: "Crear hotel",  icon: Plus },
  { id: "cobros",     label: "Cobros",       icon: CreditCard },
  { id: "importar",   label: "Base de datos",icon: Database },
  { id: "plantillas", label: "Plantillas",   icon: Printer },
  { id: "config",     label: "Configuración",icon: Settings },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) { try { return new Date(d).toLocaleString(); } catch { return String(d || ""); } }
function monthKey(d) { try { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; } catch { return ""; } }
function fmtMoney(amount, currency) {
  const n = Number(amount || 0), c = String(currency || "").toUpperCase();
  try { return c ? new Intl.NumberFormat(undefined, { style: "currency", currency: c, minimumFractionDigits: 2 }).format(n) : n.toFixed(2); }
  catch { return `${n.toFixed(2)} ${c}`.trim(); }
}
function fmtHotelNumber(n) { const num = Number(n); return Number.isFinite(num) && num > 0 ? `H-${String(Math.trunc(num)).padStart(6,"0")}` : "-"; }
function normalizeCurrency(v) { return String(v||"").trim().toUpperCase().replace(/[^A-Z]/g,"").slice(0,3); }
function buildHotelEditForm(hotel) {
  if (!hotel) return { ...INITIAL_EDIT_FORM };
  return { clientId: hotel.saasClientId||"", name: hotel.name||"", membership: hotel.membership||"HBASIC", membershipMonthlyFee: hotel.membershipMonthlyFee ? String(hotel.membershipMonthlyFee) : "", currency: hotel.currency||"CRC", phone1: hotel.phone1||"", phone2: hotel.phone2||"", ownerName: hotel.ownerName||"", managerName: hotel.managerName||"", companyId: hotel.companyId||"", managerId: hotel.managerId||"" };
}
function buildPrintPreview(form) {
  const module = String(form?.module||"restaurant").toLowerCase(), docType = String(form?.docType||"TE").toUpperCase(), paper = String(form?.paperType||"80mm");
  const lines = ["KAZEHANA CLOUD", `Module: ${module}`, `Doc: ${docType} (${paper})`, `Date: ${new Date().toLocaleString()}`, "-".repeat(26)];
  if (docType==="COMANDA") { lines.push("Mesa 12 - Comanda","1x Cafe Latte      3.50","1x Croissant       2.00","Nota: Sin azucar"); }
  else if (docType==="CLOSES") { lines.push("Cierre de caja","Efectivo: 120.00","Tarjeta:  80.00","SINPE:    40.00","Total:   240.00"); }
  else { lines.push("1x Cafe Latte      3.50","1x Croissant       2.00","Sub-total:         5.50","IVA:               0.72","Total:             6.22"); }
  lines.push("-".repeat(26),"Gracias por su visita");
  return lines.join("\n");
}

// ─── shared UI ────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-400 px-0.5">{label}</div>
      {children}
    </div>
  );
}
function GInput({ className = "", ...props }) {
  return (
    <input
      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors ${className}`}
      {...props}
    />
  );
}
function GSelect({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors ${className}`}
      style={{ colorScheme: "dark" }}
      {...props}
    >
      {children}
    </select>
  );
}
function GBtn({ variant = "primary", className = "", disabled, children, ...props }) {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";
  const v = variant === "ghost" ? "text-slate-400 hover:text-white hover:bg-white/5"
    : variant === "danger" ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20"
    : variant === "outline" ? "border border-white/10 text-slate-300 hover:bg-white/5"
    : "bg-violet-600 hover:bg-violet-500 text-white";
  return <button className={`${base} ${v} ${className}`} disabled={disabled} {...props}>{children}</button>;
}
function SectionTitle({ children }) {
  return <h4 className="text-xs uppercase tracking-wide text-slate-400 font-semibold">{children}</h4>;
}
function InfoCard({ label, value }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5">{value || "-"}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Launchergestor() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [panel, setPanel] = useState("hoteles");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // data
  const [loadingClients, setLoadingClients] = useState(false);
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
  const [createForm, setCreateForm] = useState(() => ({ ...INITIAL_CREATE_FORM }));
  const [creating, setCreating] = useState(false);
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState(null);

  const [billing, setBilling] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingForm, setBillingForm] = useState({ month: "", amount: "", currency: "USD", note: "" });

  const [importFiles, setImportFiles] = useState({ fdRooms: null, fdGuests: null, fdReservations: null, rPosItems: null, rInventoryItems: null, rSuppliers: null });
  const [importing, setImporting] = useState({});
  const [lastImport, setLastImport] = useState(null);

  const [printForms, setPrintForms] = useState([]);
  const [printFormsLoading, setPrintFormsLoading] = useState(false);
  const [printFormsSaving, setPrintFormsSaving] = useState(false);
  const [globalFormIds, setGlobalFormIds] = useState([]);
  const [globalModules, setGlobalModules] = useState({ restaurant: true, frontdesk: true, accounting: false, einvoicing: false });
  const [selectedPrintFormId, setSelectedPrintFormId] = useState("");

  const [smtpForm, setSmtpForm] = useState(() => ({ ...INITIAL_SMTP_FORM }));
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState("");

  // user menu close on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const h = (e) => { if (!e.target.closest("[data-usermenu]")) setUserMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [userMenuOpen]);

  // ── loaders ────────────────────────────────────────────────────────────────
  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const { data } = await api.get("/gestor/clients");
      const list = Array.isArray(data) ? data : [];
      setClients(list);
      setSelectedClientId((cur) => (!cur || cur === CLIENT_FILTER_NONE) ? cur : list.some((c) => c.id === cur) ? cur : "");
    } finally { setLoadingClients(false); }
  }, []);

  const loadHotels = useCallback(async () => {
    setLoadingHotels(true);
    try {
      const { data } = await api.get("/gestor/hotels");
      setHotels(Array.isArray(data) ? data : []);
    } finally { setLoadingHotels(false); }
  }, []);

  const loadBilling = useCallback(async (hotelId) => {
    if (!hotelId) return;
    setBillingLoading(true);
    try {
      const { data } = await api.get(`/gestor/hotels/${encodeURIComponent(hotelId)}/billing`);
      setBilling(Array.isArray(data) ? data : []);
    } finally { setBillingLoading(false); }
  }, []);

  const loadHotelAdmin = useCallback(async (hotelId) => {
    if (!hotelId) return;
    setAdminLoading(true);
    try {
      const { data } = await api.get(`/gestor/hotels/${encodeURIComponent(hotelId)}/admin`);
      setAdminForm((p) => ({ ...p, id: data?.id||"", name: data?.name||"", email: data?.email||"", password: "", confirmPassword: "" }));
    } catch { setAdminForm({ ...INITIAL_ADMIN_FORM }); }
    finally { setAdminLoading(false); }
  }, []);

  const loadLauncherAdmin = useCallback(async (hotelId) => {
    if (!hotelId) return;
    setLauncherAdminLoading(true);
    try {
      const { data } = await api.get(`/gestor/hotels/${encodeURIComponent(hotelId)}/launcher-admin`);
      setLauncherAdminForm((p) => ({ ...p, id: data?.id||"", name: data?.name||"", email: data?.username||"", password: "", confirmPassword: "" }));
    } catch { setLauncherAdminForm({ ...INITIAL_ADMIN_FORM }); }
    finally { setLauncherAdminLoading(false); }
  }, []);

  const loadSaasConfig = useCallback(async () => {
    setSmtpLoading(true);
    try {
      const { data } = await api.get("/gestor/saas-config");
      const smtp = data?.smtp || {};
      setSmtpForm((p) => ({ ...p, ...INITIAL_SMTP_FORM, ...smtp, pass: "" }));
    } catch { setSmtpStatus("No se pudo cargar la configuración SMTP."); }
    finally { setSmtpLoading(false); }
  }, []);

  const loadPrintForms = useCallback(async () => {
    setPrintFormsLoading(true);
    try {
      const { data } = await api.get("/gestor/print-forms");
      const list = Array.isArray(data?.forms) ? data.forms : [];
      const rawGlobal = data?.global || data?.globalForms || null;
      const gc = (() => {
        if (rawGlobal && typeof rawGlobal === "object" && !Array.isArray(rawGlobal)) return { formIds: Array.isArray(rawGlobal.formIds) ? rawGlobal.formIds.map(String) : [], modules: rawGlobal.modules || {} };
        return { formIds: Array.isArray(rawGlobal) ? rawGlobal.map((f) => String(f?.id||f)) : [], modules: {} };
      })();
      const fallbackMods = PRINT_FORM_MODULES.reduce((a,m) => { a[m.id]=true; return a; }, {});
      setPrintForms(list);
      setGlobalFormIds(gc.formIds);
      setGlobalModules({ ...fallbackMods, ...gc.modules });
      setSelectedPrintFormId((cur) => cur || list[0]?.id || "");
    } catch { setPrintForms([]); setGlobalFormIds([]); }
    finally { setPrintFormsLoading(false); }
  }, []);

  const saveGlobalForms = useCallback(async (nextIds, nextMods) => {
    setPrintFormsSaving(true);
    try {
      const { data } = await api.put("/gestor/print-forms/global", { formIds: nextIds, modules: nextMods || globalModules });
      const rawGlobal = data?.global || data?.globalForms || null;
      if (rawGlobal && typeof rawGlobal === "object" && !Array.isArray(rawGlobal)) {
        if (rawGlobal.formIds?.length) setGlobalFormIds(rawGlobal.formIds.map(String));
        if (rawGlobal.modules && Object.keys(rawGlobal.modules).length) setGlobalModules((p) => ({ ...p, ...rawGlobal.modules }));
      }
    } catch {} finally { setPrintFormsSaving(false); }
  }, [globalModules]);

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => { loadClients().catch(()=>{}); loadHotels().catch(()=>{}); loadPrintForms().catch(()=>{}); }, [loadClients, loadHotels, loadPrintForms]);
  useEffect(() => { if (panel === "config") loadSaasConfig().catch(()=>{}); }, [panel, loadSaasConfig]);

  const filteredClients = useMemo(() => {
    const t = clientQ.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter((c) => [c.name, c.id, c.companyId].some((v) => String(v||"").toLowerCase().includes(t)));
  }, [clients, clientQ]);

  const selectedClient = useMemo(() => clients.find((c) => c.id === selectedClientId) || null, [clients, selectedClientId]);

  const filteredHotels = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = hotels;
    if (selectedClientId === CLIENT_FILTER_NONE) list = list.filter((h) => !h?.saasClientId);
    else if (selectedClientId) list = list.filter((h) => h?.saasClientId === selectedClientId);
    if (!t) return list;
    return list.filter((h) => [h.name, h.id, h.saasClientName].some((v) => String(v||"").toLowerCase().includes(t)));
  }, [hotels, q, selectedClientId]);

  const selectedHotel = useMemo(() => hotels.find((h) => h.id === selectedHotelId) || null, [hotels, selectedHotelId]);
  const selectedPrintForm = useMemo(() => printForms.find((f) => f.id === selectedPrintFormId) || printForms[0] || null, [printForms, selectedPrintFormId]);

  useEffect(() => {
    if (!filteredHotels.length) { setSelectedHotelId(""); return; }
    setSelectedHotelId((cur) => (cur && filteredHotels.some((h) => h.id === cur)) ? cur : filteredHotels[0].id);
  }, [filteredHotels]);

  useEffect(() => {
    if (!selectedHotelId) return;
    loadBilling(selectedHotelId).catch(()=>{});
    loadHotelAdmin(selectedHotelId).catch(()=>{});
    loadLauncherAdmin(selectedHotelId).catch(()=>{});
  }, [selectedHotelId, loadBilling, loadHotelAdmin, loadLauncherAdmin]);

  useEffect(() => { if (!editingHotel) setHotelEditForm(buildHotelEditForm(selectedHotel)); }, [selectedHotel, editingHotel]);
  useEffect(() => { if (selectedHotel?.currency) setBillingForm((p) => ({ ...p, currency: p.currency || selectedHotel.currency })); }, [selectedHotel?.id, selectedHotel?.currency]);
  useEffect(() => { setCreateForm({ ...INITIAL_CREATE_FORM }); setLastCreatedCredentials(null); const t = setTimeout(() => setCreateForm({ ...INITIAL_CREATE_FORM }), 350); return () => clearTimeout(t); }, []);
  useEffect(() => { if (selectedClientId && selectedClientId !== CLIENT_FILTER_NONE) setCreateForm((p) => p.clientId ? p : { ...p, clientId: selectedClientId }); }, [selectedClientId]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const onLogout = () => { logout(); navigate("/login"); };

  const onCreateClient = async () => {
    if (creatingClient) return;
    const payload = { name: clientForm.name.trim(), companyId: clientForm.companyId.trim()||undefined, email: clientForm.email.trim()||undefined, phone1: clientForm.phone1.trim()||undefined, phone2: clientForm.phone2.trim()||undefined, ownerName: clientForm.ownerName.trim()||undefined, managerName: clientForm.managerName.trim()||undefined, managerId: clientForm.managerId.trim()||undefined };
    if (!payload.name) return alert("Nombre del cliente requerido");
    setCreatingClient(true);
    try { const { data } = await api.post("/gestor/clients", payload); await loadClients(); if (data?.id) setSelectedClientId(data.id); setClientForm({ ...INITIAL_CLIENT_FORM }); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "No se pudo crear el cliente"); }
    finally { setCreatingClient(false); }
  };

  const onCreateHotel = async () => {
    if (creating) return;
    const clientId = createForm.clientId.trim();
    if (!clientId) return alert("Selecciona el cliente (empresa).");
    const fee = Number(createForm.membershipMonthlyFee || 0);
    if (!Number.isFinite(fee) || fee < 0) return alert("Costo mensual inválido.");
    const payload = { clientId, name: createForm.name.trim(), membership: createForm.membership, membershipMonthlyFee: fee, currency: normalizeCurrency(createForm.currency||"CRC")||"CRC", phone1: createForm.phone1.trim()||undefined, phone2: createForm.phone2.trim()||undefined, ownerName: createForm.ownerName.trim()||undefined, managerName: createForm.managerName.trim()||undefined, companyId: createForm.companyId.trim()||undefined, managerId: createForm.managerId.trim()||undefined, hotelUserName: createForm.hotelUserName.trim()||undefined, hotelUserEmail: createForm.hotelUserEmail.trim()||undefined, hotelUserPassword: createForm.hotelUserPassword||undefined, adminName: createForm.adminName.trim()||"Administrador", adminUsername: createForm.adminUsername.trim(), adminPassword: createForm.adminPassword };
    if (!payload.name) return alert("Nombre del hotel requerido");
    if (!payload.adminUsername) return alert("Usuario del administrador requerido");
    if (!payload.adminPassword || payload.adminPassword.length < 4) return alert("Contraseña del administrador (min 4)");
    if (payload.hotelUserPassword && payload.hotelUserPassword.length < 4) return alert("Contraseña del usuario del hotel (min 4)");
    setCreating(true);
    try { const { data } = await api.post("/gestor/hotels", payload); setLastCreatedCredentials(data?.credentials||null); await loadHotels(); if (data?.hotel?.id) setSelectedHotelId(data.hotel.id); setCreateForm({ ...INITIAL_CREATE_FORM }); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "No se pudo crear el hotel"); }
    finally { setCreating(false); }
  };

  const onSaveAdmin = async () => {
    if (!selectedHotelId || adminSaving) return;
    const name = adminForm.name.trim(), email = adminForm.email.trim().toLowerCase(), password = adminForm.password, confirm = adminForm.confirmPassword;
    if (!name) return alert("Nombre requerido"); if (!email) return alert("Email requerido");
    if (password && password.length < 4) return alert("Contraseña inválida (min 4)");
    if (password && password !== confirm) return alert("Las contraseñas no coinciden");
    const payload = { name, email }; if (password) payload.password = password;
    setAdminSaving(true);
    try { await api.put(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}/admin`, payload); await loadHotelAdmin(selectedHotelId); alert("Administrador actualizado"); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
    finally { setAdminSaving(false); }
  };

  const onSaveLauncherAdmin = async () => {
    if (!selectedHotelId || launcherAdminSaving) return;
    const name = launcherAdminForm.name.trim(), username = launcherAdminForm.email.trim().toLowerCase(), password = launcherAdminForm.password, confirm = launcherAdminForm.confirmPassword;
    if (!name) return alert("Nombre requerido"); if (!username) return alert("Usuario requerido");
    if (password && password.length < 4) return alert("Contraseña inválida (min 4)");
    if (password && password !== confirm) return alert("Las contraseñas no coinciden");
    const payload = { name, username }; if (password) payload.password = password;
    setLauncherAdminSaving(true);
    try { await api.put(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}/launcher-admin`, payload); await loadLauncherAdmin(selectedHotelId); alert("Launcher admin actualizado"); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
    finally { setLauncherAdminSaving(false); }
  };

  const onDeleteClient = async (clientId) => {
    if (!clientId || deletingClientId) return;
    if (!window.confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    setDeletingClientId(clientId);
    try { await api.delete(`/gestor/clients/${encodeURIComponent(clientId)}`); if (selectedClientId === clientId) setSelectedClientId(""); await loadClients(); await loadHotels(); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
    finally { setDeletingClientId(""); }
  };

  const onDeleteHotel = async (hotelId) => {
    if (!hotelId || deletingHotelId) return;
    if (!window.confirm("¿Eliminar este hotel? Esta acción no se puede deshacer.")) return;
    setDeletingHotelId(hotelId);
    try { await api.delete(`/gestor/hotels/${encodeURIComponent(hotelId)}`); if (selectedHotelId === hotelId) setSelectedHotelId(""); await loadHotels(); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
    finally { setDeletingHotelId(""); }
  };

  const onAddBilling = async () => {
    if (!selectedHotelId || billingSaving) return;
    const month = billingForm.month.trim(); if (!month) return alert("Selecciona el mes.");
    const amount = Number(billingForm.amount || 0); if (!Number.isFinite(amount) || amount < 0) return alert("Monto inválido.");
    setBillingSaving(true);
    try {
      const payload = { amount, currency: normalizeCurrency(billingForm.currency || selectedHotel?.currency || "USD") || "USD", paidAt: `${month}-01T00:00:00`, note: billingForm.note.trim() || undefined };
      const { data } = await api.post(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}/billing`, payload);
      setBilling((p) => [data, ...p]); setBillingForm((p) => ({ ...p, month: "", amount: "", note: "" }));
    } catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
    finally { setBillingSaving(false); }
  };

  const onDeleteBilling = async (paymentId) => {
    if (!selectedHotelId || !paymentId) return;
    if (!window.confirm("¿Eliminar este cobro?")) return;
    try { await api.delete(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}/billing/${encodeURIComponent(paymentId)}`); setBilling((p) => p.filter((x) => x.id !== paymentId)); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
  };

  const onStartEditHotel = () => { if (!selectedHotel) return; setHotelEditForm(buildHotelEditForm(selectedHotel)); setEditingHotel(true); };
  const onCancelEditHotel = () => { setEditingHotel(false); setHotelEditForm(buildHotelEditForm(selectedHotel)); };

  const onSaveEditHotel = async () => {
    if (!selectedHotelId || savingHotel) return;
    if (!hotelEditForm.name.trim()) return alert("Nombre del hotel requerido");
    const fee = Number(hotelEditForm.membershipMonthlyFee || 0);
    if (!Number.isFinite(fee) || fee < 0) return alert("Costo mensual inválido.");
    const payload = { clientId: hotelEditForm.clientId.trim()||null, name: hotelEditForm.name.trim(), membership: hotelEditForm.membership, membershipMonthlyFee: fee, currency: normalizeCurrency(hotelEditForm.currency||"CRC")||"CRC", phone1: hotelEditForm.phone1.trim()||null, phone2: hotelEditForm.phone2.trim()||null, ownerName: hotelEditForm.ownerName.trim()||null, managerName: hotelEditForm.managerName.trim()||null, companyId: hotelEditForm.companyId.trim()||null, managerId: hotelEditForm.managerId.trim()||null };
    setSavingHotel(true);
    try { await api.put(`/gestor/hotels/${encodeURIComponent(selectedHotelId)}`, payload); await loadHotels(); setEditingHotel(false); }
    catch (err) { alert(err?.response?.data?.message || err?.message || "Error"); }
    finally { setSavingHotel(false); }
  };

  const onSaveSmtp = async () => {
    setSmtpSaving(true); setSmtpStatus("");
    try {
      const payload = { smtp: { host: smtpForm.host, port: Number(smtpForm.port||0), user: smtpForm.user, secure: Boolean(smtpForm.secure), from: smtpForm.from, to: smtpForm.to, replyTo: smtpForm.replyTo } };
      if (smtpForm.pass) payload.smtp.pass = smtpForm.pass;
      const { data } = await api.put("/gestor/saas-config", payload);
      const smtp = data?.smtp || {};
      setSmtpForm((p) => ({ ...p, ...INITIAL_SMTP_FORM, ...smtp, pass: "" }));
      setSmtpStatus("Configuración guardada.");
    } catch { setSmtpStatus("No se pudo guardar la configuración SMTP."); }
    finally { setSmtpSaving(false); }
  };

  const importEndpoints = useMemo(() => ({
    fdRooms: (id) => `/gestor/hotels/${encodeURIComponent(id)}/import/frontdesk/rooms`,
    fdGuests: (id) => `/gestor/hotels/${encodeURIComponent(id)}/import/frontdesk/guests`,
    fdReservations: (id) => `/gestor/hotels/${encodeURIComponent(id)}/import/frontdesk/reservations`,
    rPosItems: (id) => `/gestor/hotels/${encodeURIComponent(id)}/import/restaurant/pos-items`,
    rInventoryItems: (id) => `/gestor/hotels/${encodeURIComponent(id)}/import/restaurant/inventory-items`,
    rSuppliers: (id) => `/gestor/hotels/${encodeURIComponent(id)}/import/restaurant/suppliers`,
  }), []);

  const onUpload = async (key) => {
    if (!selectedHotelId) return alert("Selecciona un hotel.");
    const file = importFiles[key]; if (!file) return alert("Selecciona un archivo (.csv o .xlsx).");
    if (importing[key]) return;
    setImporting((p) => ({ ...p, [key]: true }));
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await api.post(importEndpoints[key](selectedHotelId), form, { timeout: 120000, headers: { "Content-Type": "multipart/form-data" } });
      setLastImport({ key, ...data });
      const skipped = Number(data?.skipped||0), errors = Array.isArray(data?.errors) ? data.errors : [];
      const preview = errors.slice(0,5).map((e) => `L${e?.row??"?"}: ${e?.message||"Error"}`).join("\n");
      alert(`Importación completada: ${data?.created??0} creados, ${data?.updated??0} actualizados${skipped > 0 ? `, ${skipped} omitidos` : ""}.${preview ? `\n\nDetalles:\n${preview}${errors.length>5 ? `\n... y ${errors.length-5} más` : ""}` : ""}`);
    } catch (err) {
      const msg = String(err?.message||""), code = String(err?.code||"");
      if (code==="ECONNABORTED"||msg.toLowerCase().includes("timeout")) { alert("Tiempo de espera agotado. Intenta con un archivo más pequeño."); return; }
      alert(err?.response?.data?.message || err?.message || "No se pudo importar");
    } finally { setImporting((p) => ({ ...p, [key]: false })); }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #111827 50%, #0f0f1a 100%)", backgroundAttachment: "fixed" }}
    >
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-8 w-8 object-contain" />
          <div className="space-y-0.5">
            <div className="text-xs uppercase tracking-wide text-violet-400">Kazehana Cloud</div>
            <div className="text-sm font-semibold text-white">Gestor Principal</div>
          </div>
        </div>
        <div className="relative" data-usermenu>
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
          >
            <CircleUser className="w-5 h-5 text-slate-300" />
            <div className="text-left text-sm leading-tight">
              <div className="font-medium text-white">Gestor</div>
              <div className="text-xs text-slate-400">Administrador</div>
            </div>
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 shadow-xl rounded-2xl overflow-hidden z-50">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white text-left transition-colors"
                onClick={() => { setUserMenuOpen(false); onLogout(); }}
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-white/10 bg-white/3 flex flex-col overflow-hidden">
          <div className="flex items-center justify-center border-b border-white/10 py-6">
            <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-24 w-24 object-contain" />
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPanel(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  panel === id ? "bg-violet-600/30 text-violet-300 shadow shadow-violet-900/40" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 px-4 py-4 border-t border-white/10 shrink-0">
            <img src="/kazehanalogo.png" alt="Kazehana Cloud" className="h-10 w-10 object-contain opacity-70" />
            <div>
              <div className="text-sm font-semibold text-white leading-tight">Kazehana PMS</div>
              <div className="text-xs text-slate-500 mt-0.5">Gestor Principal</div>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {panel === "hoteles"    && <HotelesPanel hotels={filteredHotels} clients={clients} selectedHotelId={selectedHotelId} setSelectedHotelId={setSelectedHotelId} q={q} setQ={setQ} selectedClientId={selectedClientId} setSelectedClientId={setSelectedClientId} selectedClient={selectedClient} loadingHotels={loadingHotels} selectedHotel={selectedHotel} editingHotel={editingHotel} hotelEditForm={hotelEditForm} setHotelEditForm={setHotelEditForm} savingHotel={savingHotel} deletingHotelId={deletingHotelId} onStartEditHotel={onStartEditHotel} onCancelEditHotel={onCancelEditHotel} onSaveEditHotel={onSaveEditHotel} onDeleteHotel={onDeleteHotel} adminForm={adminForm} setAdminForm={setAdminForm} adminLoading={adminLoading} adminSaving={adminSaving} onSaveAdmin={onSaveAdmin} launcherAdminForm={launcherAdminForm} setLauncherAdminForm={setLauncherAdminForm} launcherAdminLoading={launcherAdminLoading} launcherAdminSaving={launcherAdminSaving} onSaveLauncherAdmin={onSaveLauncherAdmin} onRefresh={() => { loadClients().catch(()=>{}); loadHotels().catch(()=>{}); }} />}
          {panel === "clientes"   && <ClientesPanel clients={filteredClients} clientQ={clientQ} setClientQ={setClientQ} selectedClientId={selectedClientId} setSelectedClientId={setSelectedClientId} loadingClients={loadingClients} deletingClientId={deletingClientId} onDeleteClient={onDeleteClient} clientForm={clientForm} setClientForm={setClientForm} creatingClient={creatingClient} onCreateClient={onCreateClient} onRefresh={() => loadClients().catch(()=>{})} />}
          {panel === "crear"      && <CrearPanel clients={clients} createForm={createForm} setCreateForm={setCreateForm} creating={creating} onCreateHotel={onCreateHotel} lastCreatedCredentials={lastCreatedCredentials} setLastCreatedCredentials={setLastCreatedCredentials} />}
          {panel === "cobros"     && <CobrosPanel selectedHotel={selectedHotel} selectedHotelId={selectedHotelId} billing={billing} billingLoading={billingLoading} billingSaving={billingSaving} billingForm={billingForm} setBillingForm={setBillingForm} onAddBilling={onAddBilling} onDeleteBilling={onDeleteBilling} onRefresh={() => loadBilling(selectedHotelId).catch(()=>{})} />}
          {panel === "importar"   && <ImportarPanel selectedHotel={selectedHotel} selectedHotelId={selectedHotelId} importFiles={importFiles} setImportFiles={setImportFiles} importing={importing} lastImport={lastImport} onUpload={onUpload} />}
          {panel === "plantillas" && <PlantillasPanel printForms={printForms} printFormsLoading={printFormsLoading} printFormsSaving={printFormsSaving} globalFormIds={globalFormIds} setGlobalFormIds={setGlobalFormIds} globalModules={globalModules} setGlobalModules={setGlobalModules} selectedPrintFormId={selectedPrintFormId} setSelectedPrintFormId={setSelectedPrintFormId} selectedPrintForm={selectedPrintForm} saveGlobalForms={saveGlobalForms} onRefresh={() => loadPrintForms().catch(()=>{})} />}
          {panel === "config"     && <ConfigPanel smtpForm={smtpForm} setSmtpForm={setSmtpForm} smtpLoading={smtpLoading} smtpSaving={smtpSaving} smtpStatus={smtpStatus} onSaveSmtp={onSaveSmtp} onRefresh={() => loadSaasConfig().catch(()=>{})} />}
        </main>
      </div>
    </div>
  );
}

// ─── Panel: Hoteles ────────────────────────────────────────────────────────────
function HotelesPanel({ hotels, clients, selectedHotelId, setSelectedHotelId, q, setQ, selectedClientId, setSelectedClientId, selectedClient, loadingHotels, selectedHotel, editingHotel, hotelEditForm, setHotelEditForm, savingHotel, deletingHotelId, onStartEditHotel, onCancelEditHotel, onSaveEditHotel, onDeleteHotel, adminForm, setAdminForm, adminLoading, adminSaving, onSaveAdmin, launcherAdminForm, setLauncherAdminForm, launcherAdminLoading, launcherAdminSaving, onSaveLauncherAdmin, onRefresh }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      {/* Lista */}
      <div className="space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Hoteles ({hotels.length})</SectionTitle>
            <button onClick={onRefresh} disabled={loadingHotels} className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"><RefreshCcw className="w-4 h-4" /></button>
          </div>
          {/* Filtro cliente */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setSelectedClientId("")} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${!selectedClientId ? "bg-violet-600/30 text-violet-300" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Todos</button>
            <button onClick={() => setSelectedClientId(CLIENT_FILTER_NONE)} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${selectedClientId === CLIENT_FILTER_NONE ? "bg-violet-600/30 text-violet-300" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Sin empresa</button>
          </div>
          <GInput placeholder="Buscar hotel..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {hotels.map((h) => (
              <div key={h.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${selectedHotelId === h.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/5 bg-white/3 hover:bg-white/5"}`}>
                <button className="flex-1 text-left" onClick={() => setSelectedHotelId(h.id)}>
                  <div className="text-sm font-medium text-white truncate">{h.name}</div>
                  <div className="text-xs text-slate-500 flex gap-2"><span>{MEMBERSHIP_LABELS[h.membership]||h.membership}</span><span>{fmtHotelNumber(h.number)}</span></div>
                  <div className="text-xs text-slate-600 truncate">{h.saasClientName||"-"}</div>
                </button>
                <button onClick={() => onDeleteHotel(h.id)} disabled={Boolean(deletingHotelId)} className="text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            {!loadingHotels && hotels.length === 0 && <div className="text-sm text-slate-500 py-2">No hay hoteles.</div>}
          </div>
        </div>
      </div>

      {/* Detalle */}
      <div className="space-y-4">
        {!selectedHotel ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-500 text-sm">Selecciona un hotel de la lista.</div>
        ) : (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-white">{selectedHotel.name}</div>
                  <div className="text-sm text-slate-400">{fmtHotelNumber(selectedHotel.number)} · {selectedHotel.saasClientName||"Sin empresa"}</div>
                </div>
                <div className="flex gap-2">
                  {!editingHotel && <GBtn variant="outline" onClick={onStartEditHotel}><Pencil className="w-3.5 h-3.5 mr-1.5 inline" />Editar</GBtn>}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoCard label="Membresía" value={MEMBERSHIP_LABELS[selectedHotel.membership]||selectedHotel.membership} />
                <InfoCard label="Costo mensual" value={fmtMoney(selectedHotel.membershipMonthlyFee||0, selectedHotel.currency)} />
                <InfoCard label="Moneda" value={selectedHotel.currency} />
                <InfoCard label="Creado" value={fmtDate(selectedHotel.createdAt)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <InfoCard label="Contacto" value={selectedHotel.phone1 ? `Tel: ${selectedHotel.phone1}` : undefined} />
                <InfoCard label="Responsables" value={selectedHotel.ownerName ? `Dueño: ${selectedHotel.ownerName}` : undefined} />
                <InfoCard label="Identificaciones" value={selectedHotel.companyId ? `Empresa: ${selectedHotel.companyId}` : undefined} />
              </div>
            </div>

            {/* Editar hotel */}
            {editingHotel && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <SectionTitle>Editar hotel</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Nombre"><GInput value={hotelEditForm.name} onChange={(e) => setHotelEditForm((p) => ({ ...p, name: e.target.value }))} /></Field>
                  <Field label="Cliente (empresa)">
                    <GSelect value={hotelEditForm.clientId||""} onChange={(e) => setHotelEditForm((p) => ({ ...p, clientId: e.target.value }))}>
                      <option value="">Sin empresa</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </GSelect>
                  </Field>
                  <Field label="Membresía">
                    <GSelect value={hotelEditForm.membership} onChange={(e) => setHotelEditForm((p) => ({ ...p, membership: e.target.value }))}>
                      {MEMBERSHIPS.map((m) => <option key={m} value={m}>{MEMBERSHIP_LABELS[m]||m}</option>)}
                    </GSelect>
                  </Field>
                  <Field label="Moneda">
                    <GSelect value={hotelEditForm.currency} onChange={(e) => setHotelEditForm((p) => ({ ...p, currency: e.target.value }))}>
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </GSelect>
                  </Field>
                  <Field label="Costo mensual"><GInput type="number" min="0" step="0.01" value={hotelEditForm.membershipMonthlyFee} onChange={(e) => setHotelEditForm((p) => ({ ...p, membershipMonthlyFee: e.target.value }))} /></Field>
                  <Field label="Teléfono principal"><GInput value={hotelEditForm.phone1} onChange={(e) => setHotelEditForm((p) => ({ ...p, phone1: e.target.value }))} /></Field>
                  <Field label="Teléfono secundario"><GInput value={hotelEditForm.phone2} onChange={(e) => setHotelEditForm((p) => ({ ...p, phone2: e.target.value }))} /></Field>
                  <Field label="Dueño"><GInput value={hotelEditForm.ownerName} onChange={(e) => setHotelEditForm((p) => ({ ...p, ownerName: e.target.value }))} /></Field>
                  <Field label="Gerente / encargado"><GInput value={hotelEditForm.managerName} onChange={(e) => setHotelEditForm((p) => ({ ...p, managerName: e.target.value }))} /></Field>
                  <Field label="Identificación empresa"><GInput value={hotelEditForm.companyId} onChange={(e) => setHotelEditForm((p) => ({ ...p, companyId: e.target.value }))} /></Field>
                  <Field label="Identificación encargado"><GInput value={hotelEditForm.managerId} onChange={(e) => setHotelEditForm((p) => ({ ...p, managerId: e.target.value }))} /></Field>
                </div>
                <div className="flex justify-end gap-2">
                  <GBtn variant="outline" onClick={onCancelEditHotel}>Cancelar</GBtn>
                  <GBtn onClick={onSaveEditHotel} disabled={savingHotel}>{savingHotel ? "Guardando..." : "Guardar cambios"}</GBtn>
                </div>
              </div>
            )}

            {/* Admin hotel */}
            {editingHotel && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <SectionTitle>Administrador principal</SectionTitle>
                {adminLoading ? <div className="text-sm text-slate-500">Cargando...</div> : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Nombre"><GInput value={adminForm.name} onChange={(e) => setAdminForm((p) => ({ ...p, name: e.target.value }))} /></Field>
                      <Field label="Email"><GInput type="email" value={adminForm.email} onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))} /></Field>
                      <Field label="Nueva contraseña"><GInput type="password" value={adminForm.password} onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))} /></Field>
                      <Field label="Confirmar contraseña"><GInput type="password" value={adminForm.confirmPassword} onChange={(e) => setAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))} /></Field>
                    </div>
                    <div className="flex justify-end"><GBtn onClick={onSaveAdmin} disabled={adminSaving}>{adminSaving ? "Guardando..." : "Guardar administrador"}</GBtn></div>
                  </div>
                )}
              </div>
            )}

            {/* Launcher admin */}
            {editingHotel && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <SectionTitle>Administrador del launcher</SectionTitle>
                {launcherAdminLoading ? <div className="text-sm text-slate-500">Cargando...</div> : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Nombre"><GInput value={launcherAdminForm.name} onChange={(e) => setLauncherAdminForm((p) => ({ ...p, name: e.target.value }))} /></Field>
                      <Field label="Usuario"><GInput value={launcherAdminForm.email} onChange={(e) => setLauncherAdminForm((p) => ({ ...p, email: e.target.value }))} /></Field>
                      <Field label="Nueva contraseña"><GInput type="password" value={launcherAdminForm.password} onChange={(e) => setLauncherAdminForm((p) => ({ ...p, password: e.target.value }))} /></Field>
                      <Field label="Confirmar contraseña"><GInput type="password" value={launcherAdminForm.confirmPassword} onChange={(e) => setLauncherAdminForm((p) => ({ ...p, confirmPassword: e.target.value }))} /></Field>
                    </div>
                    <div className="flex justify-end"><GBtn onClick={onSaveLauncherAdmin} disabled={launcherAdminSaving}>{launcherAdminSaving ? "Guardando..." : "Guardar launcher admin"}</GBtn></div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Clientes ───────────────────────────────────────────────────────────
function ClientesPanel({ clients, clientQ, setClientQ, selectedClientId, setSelectedClientId, loadingClients, deletingClientId, onDeleteClient, clientForm, setClientForm, creatingClient, onCreateClient, onRefresh }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Clientes ({clients.length})</SectionTitle>
          <button onClick={onRefresh} disabled={loadingClients} className="text-slate-400 hover:text-white transition-colors disabled:opacity-40"><RefreshCcw className="w-4 h-4" /></button>
        </div>
        <GInput placeholder="Buscar cliente..." value={clientQ} onChange={(e) => setClientQ(e.target.value)} />
        <div className="flex gap-1.5">
          <button onClick={() => setSelectedClientId("")} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${!selectedClientId ? "bg-violet-600/30 text-violet-300" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Todos</button>
          <button onClick={() => setSelectedClientId(CLIENT_FILTER_NONE)} className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${selectedClientId === CLIENT_FILTER_NONE ? "bg-violet-600/30 text-violet-300" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>Sin empresa</button>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {clients.map((c) => (
            <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${selectedClientId === c.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/5 bg-white/3 hover:bg-white/5"}`}>
              <button className="flex-1 text-left" onClick={() => setSelectedClientId(c.id)}>
                <div className="text-sm font-medium text-white truncate">{c.name}</div>
                <div className="text-xs text-slate-500 flex justify-between"><span>{c.companyId||"Sin identificación"}</span><span>{Number(c.hotelsCount||0)} hoteles</span></div>
              </button>
              <button onClick={() => onDeleteClient(c.id)} disabled={Boolean(deletingClientId)} className="text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {!loadingClients && clients.length === 0 && <div className="text-sm text-slate-500 py-2">No hay clientes.</div>}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <SectionTitle>Nuevo cliente</SectionTitle>
        <form autoComplete="off" className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onCreateClient(); }}>
          <Field label="Nombre de la empresa"><GInput autoComplete="off" placeholder="Ej: Grupo Kazehana" value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Identificación"><GInput autoComplete="off" placeholder="Cédula jurídica" value={clientForm.companyId} onChange={(e) => setClientForm((p) => ({ ...p, companyId: e.target.value }))} /></Field>
          <Field label="Email"><GInput type="email" autoComplete="off" placeholder="Opcional" value={clientForm.email} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))} /></Field>
          <Field label="Teléfono 1"><GInput autoComplete="off" placeholder="Opcional" value={clientForm.phone1} onChange={(e) => setClientForm((p) => ({ ...p, phone1: e.target.value }))} /></Field>
          <Field label="Teléfono 2"><GInput autoComplete="off" placeholder="Opcional" value={clientForm.phone2} onChange={(e) => setClientForm((p) => ({ ...p, phone2: e.target.value }))} /></Field>
          <Field label="Dueño"><GInput autoComplete="off" placeholder="Opcional" value={clientForm.ownerName} onChange={(e) => setClientForm((p) => ({ ...p, ownerName: e.target.value }))} /></Field>
          <Field label="Encargado"><GInput autoComplete="off" placeholder="Opcional" value={clientForm.managerName} onChange={(e) => setClientForm((p) => ({ ...p, managerName: e.target.value }))} /></Field>
          <Field label="Identificación encargado"><GInput autoComplete="off" placeholder="Opcional" value={clientForm.managerId} onChange={(e) => setClientForm((p) => ({ ...p, managerId: e.target.value }))} /></Field>
          <div className="md:col-span-2 flex justify-end pt-1">
            <GBtn type="submit" disabled={creatingClient}>{creatingClient ? "Creando..." : "Crear cliente"}</GBtn>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Panel: Crear hotel ────────────────────────────────────────────────────────
function CrearPanel({ clients, createForm, setCreateForm, creating, onCreateHotel, lastCreatedCredentials, setLastCreatedCredentials }) {
  const set = (k, v) => setCreateForm((p) => ({ ...p, [k]: v }));
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
      <SectionTitle>Nuevo hotel</SectionTitle>
      <form autoComplete="off" className="space-y-5" onSubmit={(e) => { e.preventDefault(); onCreateHotel(); }}>
        <input aria-hidden="true" tabIndex={-1} className="hidden" type="text" name="username" autoComplete="username" />
        <input aria-hidden="true" tabIndex={-1} className="hidden" type="email" name="email" autoComplete="email" />
        <input aria-hidden="true" tabIndex={-1} className="hidden" type="password" name="password" autoComplete="current-password" />

        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-3">Información del hotel</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nombre del hotel"><GInput name="hotelName" autoComplete="off" placeholder="Ej: Kazehana" value={createForm.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Cliente (empresa)">
              <GSelect name="hotelClientId" value={createForm.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">Selecciona una empresa...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </GSelect>
            </Field>
            <Field label="Membresía">
              <GSelect name="hotelMembership" value={createForm.membership} onChange={(e) => set("membership", e.target.value)}>
                {MEMBERSHIPS.map((m) => <option key={m} value={m}>{MEMBERSHIP_LABELS[m]||m}</option>)}
              </GSelect>
            </Field>
            <Field label="Moneda">
              <GSelect name="hotelCurrency" value={createForm.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </GSelect>
            </Field>
            <Field label={`Costo mensual (${createForm.currency})`}><GInput name="hotelMembershipMonthlyFee" type="number" min="0" step="0.01" autoComplete="off" placeholder="0.00" value={createForm.membershipMonthlyFee} onChange={(e) => set("membershipMonthlyFee", e.target.value)} /></Field>
            <Field label="Teléfono principal"><GInput name="hotelPhone1" autoComplete="off" placeholder="Ej: +506 8888-8888" value={createForm.phone1} onChange={(e) => set("phone1", e.target.value)} /></Field>
            <Field label="Teléfono secundario"><GInput name="hotelPhone2" autoComplete="off" placeholder="Opcional" value={createForm.phone2} onChange={(e) => set("phone2", e.target.value)} /></Field>
            <Field label="Identificación empresa"><GInput name="hotelCompanyId" autoComplete="off" placeholder="Cédula jurídica" value={createForm.companyId} onChange={(e) => set("companyId", e.target.value)} /></Field>
            <Field label="Nombre del dueño"><GInput name="hotelOwnerName" autoComplete="off" placeholder="Opcional" value={createForm.ownerName} onChange={(e) => set("ownerName", e.target.value)} /></Field>
            <Field label="Gerente / encargado"><GInput name="hotelManagerName" autoComplete="off" placeholder="Opcional" value={createForm.managerName} onChange={(e) => set("managerName", e.target.value)} /></Field>
            <Field label="Identificación encargado"><GInput name="hotelManagerId" autoComplete="off" placeholder="Cédula" value={createForm.managerId} onChange={(e) => set("managerId", e.target.value)} /></Field>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-3">Usuario del hotel (login principal)</div>
          <div className="text-xs text-slate-500 mb-3">Si dejas el email o la contraseña vacíos, se generarán automáticamente.</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Nombre visible"><GInput name="hotelUserName" autoComplete="off" placeholder="Usuario principal" value={createForm.hotelUserName} onChange={(e) => set("hotelUserName", e.target.value)} /></Field>
            <Field label="Email"><GInput name="hotelUserEmail" type="email" autoComplete="off" placeholder="Opcional" value={createForm.hotelUserEmail} onChange={(e) => set("hotelUserEmail", e.target.value)} /></Field>
            <Field label="Contraseña"><GInput name="hotelUserPassword" type="password" autoComplete="new-password" placeholder="Opcional" value={createForm.hotelUserPassword} onChange={(e) => set("hotelUserPassword", e.target.value)} /></Field>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-3">Administrador del launcher</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Nombre visible"><GInput name="hotelAdminName" autoComplete="off" placeholder="Nombre del administrador" value={createForm.adminName} onChange={(e) => set("adminName", e.target.value)} /></Field>
            <Field label="Usuario"><GInput name="hotelAdminUsername" autoComplete="off" placeholder="Usuario del administrador" value={createForm.adminUsername} onChange={(e) => set("adminUsername", e.target.value)} /></Field>
            <Field label="Contraseña"><GInput name="hotelAdminPassword" type="password" autoComplete="new-password" placeholder="min 4 caracteres" value={createForm.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} /></Field>
          </div>
        </div>

        {lastCreatedCredentials && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-1">
            <div className="text-sm font-semibold text-emerald-400">Credenciales generadas</div>
            <div className="text-xs text-slate-300">Usuario del hotel: <span className="font-mono text-white">{lastCreatedCredentials?.hotelUser?.email||"-"}</span></div>
            <div className="text-xs text-slate-300">Contraseña: <span className="font-mono text-white">{lastCreatedCredentials?.hotelUser?.password||"-"}</span></div>
            <div className="text-xs text-slate-300 mt-1">Launcher admin: <span className="font-mono text-white">{lastCreatedCredentials?.launcherAdmin?.username||"-"}</span></div>
            <div className="text-xs text-slate-300">Contraseña: <span className="font-mono text-white">{lastCreatedCredentials?.launcherAdmin?.password||"-"}</span></div>
            <button onClick={() => setLastCreatedCredentials(null)} className="text-xs text-slate-500 hover:text-slate-300 mt-1 transition-colors">Cerrar</button>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <GBtn type="submit" disabled={creating || !createForm.clientId}>{creating ? "Creando..." : "Crear hotel"}</GBtn>
        </div>
      </form>
    </div>
  );
}

// ─── Panel: Cobros ─────────────────────────────────────────────────────────────
function CobrosPanel({ selectedHotel, selectedHotelId, billing, billingLoading, billingSaving, billingForm, setBillingForm, onAddBilling, onDeleteBilling, onRefresh }) {
  if (!selectedHotelId) return <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-500 text-sm">Selecciona un hotel desde el panel Hoteles.</div>;
  return (
    <div className="space-y-5">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <SectionTitle>Cobros mensuales — {selectedHotel?.name}</SectionTitle>
            <div className="text-xs text-slate-500 mt-0.5">Cobros por uso del sistema al hotel seleccionado.</div>
          </div>
          <button onClick={onRefresh} disabled={billingLoading} className="text-slate-400 hover:text-white transition-colors disabled:opacity-40"><RefreshCcw className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Field label="Mes"><GInput type="month" value={billingForm.month} onChange={(e) => setBillingForm((p) => ({ ...p, month: e.target.value }))} /></Field>
          <Field label="Monto"><GInput type="number" min="0" step="0.01" placeholder="0.00" value={billingForm.amount} onChange={(e) => setBillingForm((p) => ({ ...p, amount: e.target.value }))} /></Field>
          <Field label="Moneda">
            <GSelect value={billingForm.currency} onChange={(e) => setBillingForm((p) => ({ ...p, currency: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </GSelect>
          </Field>
          <GBtn onClick={onAddBilling} disabled={billingSaving}>{billingSaving ? "Guardando..." : "Agregar cobro"}</GBtn>
        </div>
        <Field label="Nota (opcional)"><GInput placeholder="Nota..." value={billingForm.note} onChange={(e) => setBillingForm((p) => ({ ...p, note: e.target.value }))} /></Field>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {billingLoading ? (
          <div className="p-4 text-sm text-slate-500">Cargando...</div>
        ) : billing.length === 0 ? (
          <div className="p-4 text-sm text-slate-500">Sin cobros registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10 text-xs text-slate-400 uppercase tracking-wide">{["Mes","Monto","Nota","Registrado",""].map((h, i) => <th key={i} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {billing.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white">{monthKey(p.paidAt)}</td>
                  <td className="px-4 py-3 text-white">{fmtMoney(p.amount, p.currency)}</td>
                  <td className="px-4 py-3 text-slate-400">{p.note||"-"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(p.paidAt)}</td>
                  <td className="px-4 py-3"><button onClick={() => onDeleteBilling(p.id)} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Panel: Importar ───────────────────────────────────────────────────────────
function ImportarPanel({ selectedHotel, selectedHotelId, importFiles, setImportFiles, importing, lastImport, onUpload }) {
  const FileRow = ({ label, key: k }) => (
    <div className="space-y-2">
      <div className="text-xs text-slate-400">{label}</div>
      <input type="file" accept=".csv,.xlsx,.xls" className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600/20 file:px-3 file:py-1.5 file:text-violet-300 file:text-xs hover:file:bg-violet-600/30 transition-colors" onChange={(e) => setImportFiles((p) => ({ ...p, [k]: e.target.files?.[0]||null }))} />
      <GBtn variant="outline" onClick={() => onUpload(k)} disabled={importing[k]}><Upload className="w-3.5 h-3.5 mr-1.5 inline" />{importing[k] ? "Subiendo..." : "Subir"}</GBtn>
    </div>
  );
  if (!selectedHotelId) return <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-slate-500 text-sm">Selecciona un hotel desde el panel Hoteles.</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-white">Base de datos — {selectedHotel?.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">Carga archivos CSV/XLSX para importar datos al hotel.</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
          <SectionTitle>Front Desk</SectionTitle>
          <FileRow label="Habitaciones (CSV/XLSX)" key="fdRooms" />
          <FileRow label="Clientes (CSV/XLSX)" key="fdGuests" />
          <FileRow label="Reservaciones (CSV/XLSX)" key="fdReservations" />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
          <SectionTitle>Restaurante</SectionTitle>
          <FileRow label="Artículos de TPV (CSV/XLSX)" key="rPosItems" />
          <FileRow label="Artículos de inventario (CSV/XLSX)" key="rInventoryItems" />
          <FileRow label="Proveedores (CSV/XLSX)" key="rSuppliers" />
        </div>
      </div>
      {lastImport && (
        <div className="text-xs text-slate-500">
          Última importación ({lastImport.key}): {lastImport.created??0} creados, {lastImport.updated??0} actualizados, {lastImport.errors??0} errores.
        </div>
      )}
    </div>
  );
}

// ─── Panel: Plantillas ────────────────────────────────────────────────────────
function PlantillasPanel({ printForms, printFormsLoading, printFormsSaving, globalFormIds, setGlobalFormIds, globalModules, setGlobalModules, selectedPrintFormId, setSelectedPrintFormId, selectedPrintForm, saveGlobalForms, onRefresh }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-white">Plantillas de impresión</div>
          <div className="text-xs text-slate-500 mt-0.5">Vista previa y activación global de formatos para todos los módulos.</div>
        </div>
        <button onClick={onRefresh} disabled={printFormsLoading} className="text-slate-400 hover:text-white transition-colors disabled:opacity-40"><RefreshCcw className="w-4 h-4" /></button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <SectionTitle>Módulos activos</SectionTitle>
        <div className="flex flex-wrap gap-3 mt-2">
          {PRINT_FORM_MODULES.map((mod) => (
            <label key={mod.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" className="accent-violet-500" checked={Boolean(globalModules?.[mod.id])} disabled={printFormsSaving} onChange={(e) => { const next = { ...globalModules, [mod.id]: e.target.checked }; setGlobalModules(next); saveGlobalForms(globalFormIds, next); }} />
              {mod.label}
            </label>
          ))}
        </div>
      </div>

      {printFormsLoading ? (
        <div className="text-sm text-slate-500">Cargando plantillas...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
            {printForms.length === 0 ? (
              <div className="text-xs text-slate-500">No hay plantillas disponibles.</div>
            ) : printForms.map((f) => {
              const id = String(f.id||""), isSelected = id === selectedPrintFormId, isGlobal = globalFormIds.includes(id);
              return (
                <div key={id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${isSelected ? "border-violet-500/40 bg-violet-500/10" : "border-white/5 bg-white/3 hover:bg-white/5"}`}>
                  <button className="flex-1 text-left" onClick={() => setSelectedPrintFormId(id)}>
                    <div className="text-sm font-medium text-white">{f.name||id}</div>
                    <div className="text-xs text-slate-500">{String(f.module||"").toUpperCase()} · {String(f.docType||"").toUpperCase()} · {f.paperType}</div>
                  </button>
                  <label className="text-xs text-slate-400 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" className="accent-violet-500" checked={isGlobal} disabled={printFormsSaving} onChange={() => { const nextIds = isGlobal ? globalFormIds.filter((x) => x !== id) : [...globalFormIds, id]; setGlobalFormIds(nextIds); saveGlobalForms(nextIds, globalModules); }} />
                    Global
                  </label>
                </div>
              );
            })}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 mb-3">Vista previa</div>
            {selectedPrintForm ? (
              <pre className="text-xs leading-5 font-mono whitespace-pre-wrap text-slate-300">{buildPrintPreview(selectedPrintForm)}</pre>
            ) : (
              <div className="text-xs text-slate-500">Selecciona una plantilla.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel: Configuración ──────────────────────────────────────────────────────
function ConfigPanel({ smtpForm, setSmtpForm, smtpLoading, smtpSaving, smtpStatus, onSaveSmtp, onRefresh }) {
  const set = (k, v) => setSmtpForm((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-white">Configuración SMTP</div>
          <div className="text-xs text-slate-500 mt-0.5">Servidor de correo para notificaciones del sistema.</div>
        </div>
        <button onClick={onRefresh} disabled={smtpLoading} className="text-slate-400 hover:text-white transition-colors disabled:opacity-40"><RefreshCcw className="w-4 h-4" /></button>
      </div>

      {smtpLoading ? (
        <div className="text-sm text-slate-500">Cargando...</div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Host"><GInput placeholder="smtp.gmail.com" value={smtpForm.host} onChange={(e) => set("host", e.target.value)} /></Field>
            <Field label="Puerto"><GInput type="number" placeholder="587" value={smtpForm.port} onChange={(e) => set("port", e.target.value)} /></Field>
            <Field label="Usuario"><GInput placeholder="usuario@correo.com" value={smtpForm.user} onChange={(e) => set("user", e.target.value)} /></Field>
            <Field label="Contraseña"><GInput type="password" placeholder={smtpForm.passSet ? "••••••••" : "Contraseña"} value={smtpForm.pass} onChange={(e) => set("pass", e.target.value)} /></Field>
            <Field label="Remitente (from)"><GInput placeholder="noreply@mi-hotel.com" value={smtpForm.from} onChange={(e) => set("from", e.target.value)} /></Field>
            <Field label="Destinatario (to)"><GInput placeholder="admin@mi-hotel.com" value={smtpForm.to} onChange={(e) => set("to", e.target.value)} /></Field>
            <Field label="Reply-To"><GInput placeholder="Opcional" value={smtpForm.replyTo} onChange={(e) => set("replyTo", e.target.value)} /></Field>
            <Field label="SSL/TLS">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" className="accent-violet-500" checked={Boolean(smtpForm.secure)} onChange={(e) => set("secure", e.target.checked)} />
                <span className="text-sm text-slate-300">Conexión segura (port 465)</span>
              </label>
            </Field>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <GBtn onClick={onSaveSmtp} disabled={smtpSaving}>{smtpSaving ? "Guardando..." : "Guardar configuración"}</GBtn>
            {smtpStatus && <span className={`text-xs ${smtpStatus.includes("pudo") ? "text-red-400" : "text-emerald-400"}`}>{smtpStatus}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
