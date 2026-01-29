import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut, RefreshCcw } from "lucide-react";

import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { SimpleTable } from "../components/ui/table";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const MEMBERSHIPS = ["BASIC", "STANDARD", "PRO", "PLATINUM"];
const MEMBERSHIP_LABELS = {
  BASIC: "Básico",
  STANDARD: "Estándar",
  PRO: "Pro",
  PLATINUM: "Platino",
};

const CURRENCIES = [
  { code: "USD", label: "USD — Dólar estadounidense" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "CRC", label: "CRC — Colón costarricense" },
  { code: "JPY", label: "JPY — Yen japonés" },
  { code: "CAD", label: "CAD — Dólar canadiense" },
  { code: "GBP", label: "GBP — Libra esterlina" },
  { code: "MXN", label: "MXN — Peso mexicano" },
  { code: "BRL", label: "BRL — Real brasileño" },
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
  membership: "BASIC",
  membershipMonthlyFee: "",
  currency: "CRC",
  phone1: "",
  phone2: "",
  ownerName: "",
  managerName: "",
  companyId: "",
  managerId: "",
  adminName: "Administrador",
  adminEmail: "",
  adminPassword: "",
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

function normalizeCurrency(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

export default function Launchergestor() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [panel, setPanel] = useState("billing"); // billing | database

  const [loadingClients, setLoadingClients] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientQ, setClientQ] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientForm, setClientForm] = useState(() => ({ ...INITIAL_CLIENT_FORM }));
  const [creatingClient, setCreatingClient] = useState(false);

  const [loadingHotels, setLoadingHotels] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [q, setQ] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");

  const [createForm, setCreateForm] = useState(() => ({ ...INITIAL_CREATE_FORM }));
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    loadClients().catch(() => {});
    loadHotels().catch(() => {});
  }, [loadClients, loadHotels]);

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
  }, [selectedHotelId, loadBilling]);

  useEffect(() => {
    if (!selectedHotel?.currency) return;
    setBillingForm((p) => ({ ...p, currency: p.currency || selectedHotel.currency }));
  }, [selectedHotel?.id, selectedHotel?.currency]);

  useEffect(() => {
    // Evita que el navegador auto-rellene los inputs del "crear hotel" con credenciales guardadas.
    setCreateForm({ ...INITIAL_CREATE_FORM });
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
      return alert("Costo mensual inválido.");
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
      adminName: String(createForm.adminName || "").trim() || "Administrador",
      adminEmail: String(createForm.adminEmail || "").trim(),
      adminPassword: String(createForm.adminPassword || ""),
    };

    if (!payload.name) return alert("Nombre del hotel requerido");
    if (!payload.adminEmail) return alert("Email del administrador requerido");
    if (!payload.adminPassword || payload.adminPassword.length < 4) {
      return alert("Contraseña del administrador (min 4)");
    }

    setCreating(true);
    try {
      const { data } = await api.post("/gestor/hotels", payload);
      const createdHotel = data?.hotel;
      await loadHotels();
      if (createdHotel?.id) setSelectedHotelId(createdHotel.id);
      setCreateForm({ ...INITIAL_CREATE_FORM });
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo crear el hotel");
    } finally {
      setCreating(false);
    }
  };

  const onAddBilling = async () => {
    if (!selectedHotelId || billingSaving) return;

    const month = String(billingForm.month || "").trim();
    if (!month) return alert("Selecciona el mes (YYYY-MM).");

    const amount = Number(billingForm.amount || 0);
    if (!Number.isFinite(amount) || amount < 0) return alert("Monto inválido.");

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

  const onDeleteBilling = async (paymentId) => {
    if (!selectedHotelId || !paymentId) return;
    if (!window.confirm("¿Eliminar este cobro?")) return;
    try {
      await api.delete(
        `/gestor/hotels/${encodeURIComponent(selectedHotelId)}/billing/${encodeURIComponent(paymentId)}`
      );
      setBilling((prev) => (prev || []).filter((p) => p.id !== paymentId));
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo eliminar el cobro");
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
    if (!endpointFn) return alert("Importación no soportada.");

    if (importing[key]) return;
    setImporting((p) => ({ ...p, [key]: true }));
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(endpointFn(selectedHotelId), form);
      setLastImport({ key, ...data });
      alert(`Importación completada: ${data?.created ?? 0} creados, ${data?.updated ?? 0} actualizados.`);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || "No se pudo importar");
    } finally {
      setImporting((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold text-slate-900">Gestor Principal</div>
            <div className="text-xs text-slate-500">Crear hoteles y registrar cobros mensuales.</div>
          </div>
          <div className="flex items-center gap-2">
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
              Cerrar sesión
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  Clientes
                </div>
                <div className="text-xs text-slate-500">{filteredClients.length}</div>
              </div>

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

              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClientId(c.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left hover:bg-slate-50 ${
                      selectedClientId === c.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                      <span className="truncate">{c.companyId || "Sin identificaci\u00f3n"}</span>
                      <span>{Number(c.hotelsCount || 0)} hoteles</span>
                    </div>
                  </button>
                ))}
                {!loadingClients && filteredClients.length === 0 && (
                  <div className="text-sm text-slate-500">No hay clientes.</div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <div className="font-semibold text-slate-900">Cliente crear</div>
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
                      <div className="px-1 text-xs text-slate-600">Identificaci\u00f3n</div>
                      <Input
                        autoComplete="off"
                        placeholder="C\u00e9dula jur\u00eddica"
                        value={clientForm.companyId}
                        onChange={(e) => setClientForm((p) => ({ ...p, companyId: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Email</div>
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
                      <div className="px-1 text-xs text-slate-600">Tel\u00e9fono 1</div>
                      <Input
                        autoComplete="off"
                        placeholder="Opcional"
                        value={clientForm.phone1}
                        onChange={(e) => setClientForm((p) => ({ ...p, phone1: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="px-1 text-xs text-slate-600">Tel\u00e9fono 2</div>
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
                      <div className="px-1 text-xs text-slate-600">Due\u00f1o</div>
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
                    <div className="px-1 text-xs text-slate-600">Identificaci\u00f3n encargado</div>
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
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  Hoteles
                </div>
                <div className="text-xs text-slate-500">{filteredHotels.length}</div>
              </div>
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
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setSelectedHotelId(h.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left hover:bg-slate-50 ${
                      selectedHotelId === h.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 truncate">{h.name}</div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                      <span>{MEMBERSHIP_LABELS[h.membership] || h.membership}</span>
                      <span>{fmtDate(h.createdAt)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Empresa: {h.saasClientName || "-"}
                    </div>
                  </button>
                ))}
                {!loadingHotels && filteredHotels.length === 0 && (
                  <div className="text-sm text-slate-500">No hay hoteles.</div>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="font-semibold text-slate-900">Hotel crear</div>
              <form
                autoComplete="off"
                className="grid grid-cols-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onCreateHotel();
                }}
              >
                {/* Trampa de autofill: evita que el navegador pegue el usuario master aquí */}
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
                    <div className="px-1 text-xs text-slate-600">Membresía</div>
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
                    <div className="px-1 text-xs text-slate-600">Teléfono principal</div>
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
                    <div className="px-1 text-xs text-slate-600">Teléfono secundario</div>
                    <Input
                      name="hotelPhone2"
                      autoComplete="off"
                      placeholder="Opcional"
                      value={createForm.phone2}
                      onChange={(e) => setCreateForm((p) => ({ ...p, phone2: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="px-1 text-xs text-slate-600">Identificación empresa</div>
                    <Input
                      name="hotelCompanyId"
                      autoComplete="off"
                      placeholder="Cédula jurídica"
                      value={createForm.companyId}
                      onChange={(e) => setCreateForm((p) => ({ ...p, companyId: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="px-1 text-xs text-slate-600">Nombre del dueño</div>
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
                  <div className="px-1 text-xs text-slate-600">Identificación encargado</div>
                  <Input
                    name="hotelManagerId"
                    autoComplete="off"
                    placeholder="Cédula"
                    value={createForm.managerId}
                    onChange={(e) => setCreateForm((p) => ({ ...p, managerId: e.target.value }))}
                  />
                </div>

                <div className="mt-1 border-t border-slate-200 pt-3 grid grid-cols-1 gap-2">
                  <div className="text-sm font-semibold text-slate-900">Administrador del hotel</div>

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
                    <div className="px-1 text-xs text-slate-600">Email</div>
                    <Input
                      name="hotelAdminEmail"
                      type="email"
                      autoComplete="off"
                      placeholder="Email del administrador"
                      value={createForm.adminEmail}
                      onChange={(e) => setCreateForm((p) => ({ ...p, adminEmail: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="px-1 text-xs text-slate-600">Contraseña</div>
                    <Input
                      name="hotelAdminPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Contraseña del administrador (min 4)"
                      value={createForm.adminPassword}
                      onChange={(e) => setCreateForm((p) => ({ ...p, adminPassword: e.target.value }))}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={creating || !createForm.clientId}>
                  {creating ? "Creando..." : "Crear"}
                </Button>
              </form>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-slate-900">{selectedHotel?.name || "-"}</div>
                  <div className="text-sm text-slate-500">
                    ID: <span className="font-mono">{selectedHotel?.id || "-"}</span>
                  </div>
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
                  <div className="text-xs text-slate-500">Membresía</div>
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
                    {selectedHotel?.ownerName ? <div>Dueño: {selectedHotel.ownerName}</div> : <div>-</div>}
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
                        <div className="text-xs text-slate-600">Artículos de TPV (CSV/XLSX)</div>
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
                        <div className="text-xs text-slate-600">Artículos de inventario (CSV/XLSX)</div>
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
                      Última importación ({lastImport.key}): {lastImport.created ?? 0} creados,{" "}
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
