import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import {
  BarChart3,
  Receipt,
  FileText,
  Briefcase,
  ShieldCheck,
  MinusSquare,
  UtensilsCrossed,
  CreditCard,
  Ticket,
  History,
} from "lucide-react";
import RestaurantUserMenu from "./RestaurantUserMenu";
import { Tile } from "./RestaurantLobby";

const LOBBY_TILE_SIZE = "lg";

export default function RestaurantHistory() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [invoicesDialogOpen, setInvoicesDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState("SALES");
  const [groupBy, setGroupBy] = useState("");
  const [orderBy, setOrderBy] = useState("");
  const [detailedByFamily, setDetailedByFamily] = useState(false);
  const [includeHouseAccount, setIncludeHouseAccount] = useState(false);
  const [includeVoidedInvoices, setIncludeVoidedInvoices] = useState(false);
  const [useArticulo, setUseArticulo] = useState(false);
  const [useTipoCobro, setUseTipoCobro] = useState(false);
  const [useCajero, setUseCajero] = useState(false);
  const [useMesero, setUseMesero] = useState(false);
  const [useFamilia, setUseFamilia] = useState(false);
  const [useSubfamilia, setUseSubfamilia] = useState(false);
  const [useFecha, setUseFecha] = useState(false);
  const [useFechaHora, setUseFechaHora] = useState(false);
  const [useTurno, setUseTurno] = useState(false);
  const [useMoneda, setUseMoneda] = useState(false);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [staff, setStaff] = useState([]);
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [closedShifts, setClosedShifts] = useState([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [itemId, setItemId] = useState("");
  const [subFamilyId, setSubFamilyId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [waiterId, setWaiterId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [currency, setCurrency] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateTimeFrom, setDateTimeFrom] = useState("");
  const [dateTimeTo, setDateTimeTo] = useState("");
  const [topCount, setTopCount] = useState("");
  const [topMode, setTopMode] = useState("");
  const [includeItemsMode, setIncludeItemsMode] = useState("");
  const [focusKey, setFocusKey] = useState("");
  const [reportMissing, setReportMissing] = useState([]);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [salesPreviewOpen, setSalesPreviewOpen] = useState(false);
  const [salesPreviewRows, setSalesPreviewRows] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [invoiceCurrencies, setInvoiceCurrencies] = useState([]);
  const [invoicePaymentMethods, setInvoicePaymentMethods] = useState([]);
  const [invoiceReasons, setInvoiceReasons] = useState([]);
  const [invoiceProfiles, setInvoiceProfiles] = useState([]);
  const [invoiceMissing, setInvoiceMissing] = useState([]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoiceDocId, setSelectedInvoiceDocId] = useState("");
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewText, setInvoicePreviewText] = useState("");
  const [billingCfg, setBillingCfg] = useState({
    ticketHeader: "",
    ticketFooter: "",
    invoiceHeader: "",
    invoiceFooter: "",
  });
  const [invUseTurno, setInvUseTurno] = useState(false);
  const [invShiftId, setInvShiftId] = useState("");
  const [invUseFechaCierre, setInvUseFechaCierre] = useState(false);
  const [invDateFrom, setInvDateFrom] = useState("");
  const [invDateTo, setInvDateTo] = useState("");
  const [invUseInvoiceNumber, setInvUseInvoiceNumber] = useState(false);
  const [invInvoiceFrom, setInvInvoiceFrom] = useState("");
  const [invInvoiceTo, setInvInvoiceTo] = useState("");
  const [invIncludePaid, setInvIncludePaid] = useState(true);
  const [invIncludeVoided, setInvIncludeVoided] = useState(false);
  const [invUseMonedaPago, setInvUseMonedaPago] = useState(false);
  const [invPaymentCurrency, setInvPaymentCurrency] = useState("");
  const [invUseTipoCobro, setInvUseTipoCobro] = useState(false);
  const [invPaymentKey, setInvPaymentKey] = useState("");
  const [invUseMotivo, setInvUseMotivo] = useState(false);
  const [invMotivo, setInvMotivo] = useState("");
  const [invUsePerfil, setInvUsePerfil] = useState(false);
  const [invPerfil, setInvPerfil] = useState("");
  const resolveCurrencySymbol = (c) => {
    const code = String(c || "").toUpperCase().trim();
    if (code === "CRC" || code === "₡") return "₡";
    if (code === "USD" || code === "$") return "$";
    if (code === "EUR" || code === "€") return "€";
    if (code === "MXN") return "$";
    return code ? `${code} ` : "$";
  };

  const formatMoneyWithCurrency = (amount, currencyCode) => {
    const symbol = resolveCurrencySymbol(currencyCode);
    const num = Number(amount);
    const safe = Number.isFinite(num) ? num.toFixed(2) : "0.00";
    return `${symbol}${safe}`;
  };
  const shift = useMemo(() => {
    const h = now.getHours();
    if (h < 15) return "Morning shift";
    if (h < 22) return "Afternoon shift";
    return "Night shift";
  }, [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!salesDialogOpen && !invoicesDialogOpen) return;
    const loadOptions = async () => {
      setFamiliesLoading(true);
      setOptionsLoading(true);
      try {
        const [familiesRes, subFamiliesRes, itemsRes, staffRes, paymentsRes, shiftsRes, billingRes] = await Promise.all([
          api.get("/restaurant/families"),
          api.get("/restaurant/subfamilies"),
          api.get("/restaurant/items"),
          api.get("/restaurant/staff"),
          api.get("/restaurant/payments"),
          api.get("/restaurant/shifts/closed"),
          api.get("/restaurant/billing"),
        ]);
        setFamilies(Array.isArray(familiesRes.data) ? familiesRes.data : []);
        setSubFamilies(Array.isArray(subFamiliesRes.data) ? subFamiliesRes.data : []);
        setItemsList(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
        const paymentsCfg = paymentsRes.data || {};
        const methods = Array.isArray(paymentsCfg?.paymentMethods) ? paymentsCfg.paymentMethods : [];
        const cobros = Array.isArray(paymentsCfg?.cobros) ? paymentsCfg.cobros : [];
        const normalizedCobros = cobros.map((c) => String(c || "").trim()).filter(Boolean);
        const fallbackCobros = normalizedCobros.length > 0 ? normalizedCobros : ["Efectivo", "Tarjeta", "SINPE", "Transferencia"];
        const fromMethods = methods
          .filter((m) => m && m.enabled !== false)
          .map((m) => ({ key: String(m?.id || m?.name || ""), name: String(m?.name || m?.id || "") }))
          .filter((m) => m.key && m.name);
        const fromCobros = fallbackCobros.map((name) => ({ key: name, name }));
        setPaymentOptions(fromMethods.length ? fromMethods : fromCobros);
        const currencies = [paymentsCfg?.monedaBase, paymentsCfg?.monedaSec]
          .map((c) => String(c || "").trim())
          .filter(Boolean);
        const uniqueCurrencies = Array.from(new Set(currencies));
        setInvoiceCurrencies(uniqueCurrencies);
        setInvoicePaymentMethods(fromMethods.length ? fromMethods : fromCobros);
        setClosedShifts(Array.isArray(shiftsRes.data) ? shiftsRes.data : []);
        const billing = billingRes?.data || {};
        setBillingCfg({
          ticketHeader: billing.ticketHeader || "",
          ticketFooter: billing.ticketFooter || "",
          invoiceHeader: billing.invoiceHeader || "",
          invoiceFooter: billing.invoiceFooter || "",
        });
      } catch {
        setFamilies([]);
        setSubFamilies([]);
        setItemsList([]);
        setStaff([]);
        setPaymentOptions([]);
        setClosedShifts([]);
        setBillingCfg({ ticketHeader: "", ticketFooter: "", invoiceHeader: "", invoiceFooter: "" });
      } finally {
        setFamiliesLoading(false);
        setOptionsLoading(false);
      }
    };
    loadOptions();
  }, [salesDialogOpen, invoicesDialogOpen]);

  const staffById = useMemo(() => {
    const map = new Map();
    staff.forEach((s) => {
      const key = String(s?.id ?? s?._id ?? s?.userId ?? s?.username ?? "");
      if (key) map.set(key, s);
    });
    return map;
  }, [staff]);

  const getStaffName = (id) => {
    const key = String(id || "");
    const s = staffById.get(key);
    if (!s) return key || "-";
    return (
      s?.name ||
      s?.displayName ||
      s?.fullName ||
      s?.username ||
      s?.email ||
      key
    );
  };

  const openPreview = (rows) => {
    setSalesPreviewRows(Array.isArray(rows) ? rows : []);
    setSalesPreviewOpen(true);
  };

  const handlePrint = async () => {
    setReportBusy(true);
    setReportError("");
    setReportMissing([]);
    try {
      const { data } = await api.get("/restaurant/history/sales", {
        params: {
          type: movementType,
          groupBy,
          orderBy,
          detailedByFamily,
          includeHouseAccount,
          includeVoidedInvoices,
          useArticulo,
          itemId: useArticulo ? itemId : "",
          useTipoCobro,
          useCajero,
          useMesero,
          useFamilia,
          useSubfamilia,
          useFecha,
          useFechaHora: false,
          useTurno,
          useMoneda,
          familyId: useFamilia ? familyId : "",
          subFamilyId: useSubfamilia ? subFamilyId : "",
          cashierId: useCajero ? cashierId : "",
          waiterId: useMesero ? waiterId : "",
          serviceType: serviceType || "",
          paymentKey: useTipoCobro ? paymentKey : "",
          shiftId: useTurno ? shiftId : "",
          currency: useMoneda ? currency : "",
          dateFrom: useFecha ? dateFrom : "",
          dateTo: useFecha ? dateTo : "",
          dateTimeFrom: "",
          dateTimeTo: "",
          topCount,
          topMode,
          includeItemsMode,
          focus: focusKey,
        },
      });
      const missing = Array.isArray(data?.missing) ? data.missing : [];
      setReportMissing(missing);
      const rows = Array.isArray(data?.items) ? data.items : [];
      if (rows.length > 0) openPreview(rows);
    } catch (err) {
      setReportError("No se pudo generar el reporte.");
    } finally {
      setReportBusy(false);
    }
  };

  const openInvoicePreview = (rows) => {
    const html = `
      <html>
        <head>
          <title>Facturas</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; }
            th { background: #f5f5f5; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Facturas</h2>
          <table>
            <thead>
              <tr>
                <th>Fecha Cierre</th>
                <th>Turno</th>
                <th>N. Factura</th>
                <th>Doc</th>
                <th>Sección - Mesa</th>
                <th>Cajero / Mesero</th>
                <th>Moneda</th>
                <th>Amount</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
                <tr>
                  <td>${r.closedAt ? new Date(r.closedAt).toLocaleString() : ""}</td>
                  <td>${r.shiftNumber ? `#${r.shiftNumber}` : r.shiftId ? String(r.shiftId).slice(-6) : ""}</td>
                  <td>${r.consecutive || ""}</td>
                  <td>${r.docType || ""}</td>
                  <td>${r.order?.sectionId ? `${r.order.sectionId} - ` : ""}${r.order?.tableId || ""}</td>
                  <td>${getStaffName(r.order?.cashierId)} / ${getStaffName(r.order?.waiterId)}</td>
                  <td>${r.order?.currency || ""}</td>
                  <td>${formatMoneyWithCurrency(r.order?.total, r.order?.currency || r.currency || "")}</td>
                  <td>${r.status || ""}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          <script>window.print()</script>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  const buildInvoicePreviewText = ({ row, header, footer }) => {
    const order = row?.order || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const lines = [];
    const title = row?.docType === "FE" ? "FACTURA ELECTRONICA" : "TICKET";
    lines.push(title);
    lines.push(`Fecha: ${row?.closedAt ? new Date(row.closedAt).toLocaleString() : new Date().toLocaleString()}`);
    if (order?.sectionId) lines.push(`Sección: ${order.sectionId}`);
    if (order?.tableId) lines.push(`Mesa: ${order.tableId}`);
    if (order?.covers != null) lines.push(`Personas: ${order.covers}`);
    if (order?.serviceType) lines.push(`Servicio: ${order.serviceType}`);
    if (order?.roomId) lines.push(`Habitación: ${order.roomId}`);
    lines.push("");

    const h = String(header || "").trim();
    if (h) {
      lines.push(h);
      lines.push("");
    }

    if (items.length > 0) {
      lines.push("Items:");
      items.forEach((it) => {
        const qty = Number(it?.qty || 1);
        const name = String(it?.name || "Item");
        const price = Number(it?.price || 0);
        lines.push(`- ${qty} x ${name} @ ${formatMoneyWithCurrency(price, order.currency)} = ${formatMoneyWithCurrency(qty * price, order.currency)}`);
        if (it?.detailNote) lines.push(`  Nota: ${String(it.detailNote)}`);
      });
      lines.push("");
    }

    if (order?.note) {
      lines.push("Nota:");
      lines.push(String(order.note));
      lines.push("");
    }

    if (order?.discountAmount) {
      lines.push(`Descuento: ${formatMoneyWithCurrency(order.discountAmount, order.currency)}`);
    }
    if (order?.tip10) {
      lines.push(`Servicio: ${formatMoneyWithCurrency(order.tip10, order.currency)}`);
    }
    lines.push(`Total: ${formatMoneyWithCurrency(order.total, order.currency)}`);

    const f = String(footer || "").trim();
    if (f) {
      lines.push("");
      lines.push(f);
    }
    return lines.join("\n");
  };

  const openPreviewWindowWithText = ({ text }) => {
    setInvoicePreviewText(text);
    setInvoicePreviewOpen(true);
  };

  const openSelectedInvoicePdf = async () => {
    if (!selectedInvoiceDocId) {
      alert("Selecciona una factura primero.");
      return;
    }
    const row = invoiceRows.find((r) => r.id === selectedInvoiceDocId);
    if (!row?.order) {
      alert("No se encontró la información de la factura.");
      return;
    }
    const isFE = String(row.docType || "").toUpperCase() === "FE";
    const header = isFE ? billingCfg.invoiceHeader : billingCfg.ticketHeader;
    const footer = isFE ? billingCfg.invoiceFooter : billingCfg.ticketFooter;
    const text = buildInvoicePreviewText({ row, header, footer });
    openPreviewWindowWithText({ text });
  };

const handleInvoicesApply = async () => {
    setInvoiceBusy(true);
    setInvoiceError("");
    setInvoiceMissing([]);
    try {
      const { data } = await api.get("/restaurant/history/invoices", {
        params: {
          useTurno: invUseTurno,
          shiftId: invUseTurno ? invShiftId : "",
          useFechaCierre: invUseFechaCierre,
          dateFrom: invUseFechaCierre ? invDateFrom : "",
          dateTo: invUseFechaCierre ? invDateTo : "",
          useInvoiceNumber: invUseInvoiceNumber,
          invoiceNumberFrom: invUseInvoiceNumber ? invInvoiceFrom : "",
          invoiceNumberTo: invUseInvoiceNumber ? invInvoiceTo : "",
          includePaid: invIncludePaid,
          includeVoided: invIncludeVoided,
          useMonedaPago: invUseMonedaPago,
          paymentCurrency: invUseMonedaPago ? invPaymentCurrency : "",
          useTipoCobro: invUseTipoCobro,
          paymentKey: invUseTipoCobro ? invPaymentKey : "",
          useMotivo: invUseMotivo,
          motivo: invUseMotivo ? invMotivo : "",
          usePerfil: invUsePerfil,
          perfilId: invUsePerfil ? invPerfil : "",
        },
      });
      setInvoiceRows(Array.isArray(data?.items) ? data.items : []);
      setInvoiceMissing(Array.isArray(data?.missing) ? data.missing : []);
      if (data?.filters) {
        const reasons = Array.isArray(data.filters.reasons) ? data.filters.reasons : [];
        const profiles = Array.isArray(data.filters.profiles) ? data.filters.profiles : [];
        if (reasons.length) setInvoiceReasons(reasons);
        if (profiles.length) setInvoiceProfiles(profiles);
      }
    } catch {
      setInvoiceError("No se pudo cargar facturas.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const items = [
    { title: "Ventas / Devoluciones", icon: BarChart3, onClick: () => setSalesDialogOpen(true) },
    { title: "Facturas", icon: FileText, onClick: () => setInvoicesDialogOpen(true), tone: "amber" },
    { title: "Turnos de Trabajo", icon: Briefcase },
    { title: "Estad?sticas", icon: BarChart3 },
    { title: "Exenciones de Impuestos", icon: ShieldCheck },
    { title: "Rebajas de Inventario", icon: MinusSquare },
    { title: "Comandas", icon: UtensilsCrossed },
    { title: "Tarjetas", icon: CreditCard },
    { title: "Historico de Reservas", icon: History },
  ];

  const gridCols =
    LOBBY_TILE_SIZE === "lg"
      ? "md:grid-cols-2 lg:grid-cols-3"
      : LOBBY_TILE_SIZE === "sm"
        ? "md:grid-cols-3 lg:grid-cols-4"
        : "md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-200 text-black">
      <header className="relative h-14 bg-gradient-to-r from-lime-700 to-emerald-600 flex items-center justify-between px-10 shadow">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="h-10 px-4 rounded-xl bg-white/15 text-white text-xs font-semibold hover:bg-white/20"
            onClick={() => navigate("/restaurant")}
          >
            Back
          </button>
          <span className="text-lg font-semibold text-white">Restaurant</span>
          <span className="text-sm text-white/80">Históricos / Estadísticas</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold">
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">
              {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">{shift}</div>
          </div>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="text-black">
          <div className="text-2xl font-semibold">Reportes y control</div>
          <div className="text-sm text-black">Selecciona un módulo para continuar.</div>
        </div>

        <div className={`grid gap-4 ${gridCols}`}>
          {items.map((item) => (
            <Tile
              key={item.title}
              title={item.title}
              desc="Pendiente"
              icon={item.icon}
              size={LOBBY_TILE_SIZE}
              tone={item.tone || "lime"}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>

      <>
        {salesDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl h-[90vh] rounded-2xl border border-lime-200 bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-lime-100">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-lime-800">Ventas / Devoluciones</div>
                </div>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setSalesDialogOpen(false)}
                >
                  Cerrar
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto h-[calc(90vh-72px)]">
                <div className="space-y-4">
                <div className="inline-flex items-center gap-4 rounded-xl border border-lime-200 px-4 py-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="movType"
                      checked={movementType === "SALES"}
                      onChange={() => setMovementType("SALES")}
                      className="accent-lime-600"
                    />
                    Ventas
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="movType"
                      checked={movementType === "RETURNS"}
                      onChange={() => setMovementType("RETURNS")}
                      className="accent-lime-600"
                    />
                    Devoluciones
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="movType"
                      checked={movementType === "VOIDS"}
                      onChange={() => setMovementType("VOIDS")}
                      className="accent-lime-600"
                    />
                    Anulaciones
                  </label>
                </div>

                <div className="rounded-xl border border-lime-200 p-4 space-y-3 bg-white">
                  <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useArticulo}
                        onChange={(e) => setUseArticulo(e.target.checked)}
                      />
                      Artículo
                    </label>
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      value={itemId}
                      onChange={(e) => setItemId(e.target.value)}
                      disabled={!useArticulo}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {itemsList.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useTipoCobro}
                        onChange={(e) => setUseTipoCobro(e.target.checked)}
                      />
                      Tipo de Cobro
                    </label>
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      disabled={!useTipoCobro}
                      value={paymentKey}
                      onChange={(e) => setPaymentKey(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {paymentOptions.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-lime-600"
                      checked={useTurno}
                      onChange={(e) => setUseTurno(e.target.checked)}
                    />
                    Turno
                  </label>
                  <select
                    className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                    disabled={!useTurno}
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                  >
                    <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                    {closedShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shiftNumber ? `#${s.shiftNumber} • ` : ""}
                        {s.closedAt ? new Date(s.closedAt).toLocaleString() : s.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-lime-600"
                      checked={useMoneda}
                      onChange={(e) => setUseMoneda(e.target.checked)}
                    />
                    Moneda
                  </label>
                  <select
                    className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                    disabled={!useMoneda}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="">Selecciona...</option>
                    <option value="BASE">Base</option>
                    <option value="SEC">Secundaria</option>
                  </select>
                </div>
                  <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useCajero}
                        onChange={(e) => setUseCajero(e.target.checked)}
                      />
                      Cajero
                    </label>
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      disabled={!useCajero}
                      value={cashierId}
                      onChange={(e) => setCashierId(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useMesero}
                        onChange={(e) => setUseMesero(e.target.checked)}
                      />
                      Mesero
                    </label>
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      disabled={!useMesero}
                      value={waiterId}
                      onChange={(e) => setWaiterId(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useFamilia}
                        onChange={(e) => setUseFamilia(e.target.checked)}
                      />
                      Familia
                    </label>
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      value={familyId}
                      onChange={(e) => setFamilyId(e.target.value)}
                      disabled={!useFamilia}
                    >
                      <option value="">{familiesLoading ? "Cargando..." : "Selecciona..."}</option>
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid md:grid-cols-[140px_1fr] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useSubfamilia}
                        onChange={(e) => setUseSubfamilia(e.target.checked)}
                      />
                      Subfamilia
                    </label>
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      disabled={!useSubfamilia}
                      value={subFamilyId}
                      onChange={(e) => setSubFamilyId(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {subFamilies.map((sf) => (
                        <option key={sf.id} value={sf.id}>
                          {sf.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid md:grid-cols-[140px_1fr_220px] gap-3 items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={useFecha}
                        onChange={(e) => setUseFecha(e.target.checked)}
                      />
                      Fecha
                    </label>
                    <input
                      type="date"
                      className="h-8 rounded-lg border px-2 text-xs w-full"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setDateTo("");
                      }}
                      disabled={!useFecha}
                    />
                    <select
                      className="h-8 rounded-lg border px-2 text-xs w-full bg-white"
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                    >
                      <option value="">Servicio</option>
                      <option value="DINE_IN">DINE_IN</option>
                      <option value="TAKEOUT">TAKEOUT</option>
                      <option value="DELIVERY">DELIVERY</option>
                      <option value="ROOM">ROOM</option>
                    </select>
                  </div>


                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-lime-200 p-3 space-y-2 bg-lime-50/60">
                    <div className="text-xs uppercase text-lime-600">Agrupar por</div>
                    {["Familia", "Mesero"].map((label) => (
                      <label key={label} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="groupBy"
                          className="accent-lime-600"
                          checked={groupBy === label}
                          onChange={() => setGroupBy(label)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="rounded-xl border border-lime-200 p-3 space-y-2 bg-lime-50/60">
                    <div className="text-xs uppercase text-lime-600">Ordenar por</div>
                    {["Código", "Cobros", "Extra Tip"].map((label) => (
                      <label key={label} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="orderBy"
                          className="accent-lime-600"
                          checked={orderBy === label}
                          onChange={() => setOrderBy(label)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="rounded-xl border border-lime-200 p-3 space-y-2 bg-lime-50/60">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={detailedByFamily}
                        onChange={(e) => setDetailedByFamily(e.target.checked)}
                      />
                      Detallado por Familia
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={includeHouseAccount}
                        onChange={(e) => setIncludeHouseAccount(e.target.checked)}
                      />
                      Incluir Artículos Cuentas Casa
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={includeVoidedInvoices}
                        onChange={(e) => setIncludeVoidedInvoices(e.target.checked)}
                      />
                      Incluir Facturas Anuladas
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-lime-600" checked={!!topCount} readOnly />
                    Seleccionar los
                  </label>
                  <input
                    className="h-9 w-16 rounded-lg border px-2 text-sm text-center"
                    value={topCount}
                    onChange={(e) => setTopCount(e.target.value)}
                    placeholder="15"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="topSales"
                      className="accent-lime-600"
                      checked={topMode === "MOST"}
                      onChange={() => setTopMode("MOST")}
                    />
                    más vendidos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="topSales"
                      className="accent-lime-600"
                      checked={topMode === "LEAST"}
                      onChange={() => setTopMode("LEAST")}
                    />
                    menos vendidos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="includeItems"
                      className="accent-lime-600"
                      checked={includeItemsMode === "ALL"}
                      onChange={() => setIncludeItemsMode("ALL")}
                    />
                    incluir todos los artículos
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="includeItems"
                      className="accent-lime-600"
                      checked={includeItemsMode === "SOLD"}
                      onChange={() => setIncludeItemsMode("SOLD")}
                    />
                    incluir sólo los vendidos
                  </label>
                  <div className="ml-auto">
                    <button
                      className="h-10 px-5 rounded-xl bg-lime-100 text-lime-900 font-semibold border border-lime-200 disabled:opacity-60"
                      onClick={handlePrint}
                      disabled={reportBusy}
                    >
                      {reportBusy ? "Generando..." : "Imprimir"}
                    </button>
                  </div>
                </div>
                {(reportError || reportMissing.length > 0) && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    {reportError && <div>{reportError}</div>}
                    {reportMissing.length > 0 && (
                      <ul className="list-disc pl-4">
                        {reportMissing.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-lime-200 p-3">
                  <div className="text-xs uppercase text-lime-600 mb-2">Enfoque r?pido</div>
                  <div className="grid grid-cols-1 gap-2 max-w-[260px]">
                    {[
                      "Familia",
                      "Subfamilia",
                      "Art?culo",
                      "Art?culo / Observaci?n",
                      "Fecha",
                      "Fecha / Art?culo",
                      "Cuenta Casa",
                      "Mesero",
                      "Cajero",
                      "Servicio",
                      "Cuenta de Ingresos",
                      "Cliente",
                      "Agente de Ventas",
                    ].map((label) => (
                      <button
                        key={label}
                        className={`w-full h-10 rounded-lg text-[13px] font-semibold border border-lime-300 ${
                          focusKey === label
                            ? "bg-lime-200 text-lime-900"
                            : "bg-lime-100 text-lime-800 hover:bg-lime-150"
                        }`}
                        onClick={() => setFocusKey(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}
        {invoicesDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl h-[90vh] rounded-2xl border border-lime-200 bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-lime-100">
                <div className="text-lg font-semibold text-lime-800">Facturas</div>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setInvoicesDialogOpen(false)}
                >
                  Cerrar
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto h-[calc(90vh-72px)]">
              <div className="rounded-xl border border-lime-200 p-4">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUseTurno}
                        onChange={(e) => setInvUseTurno(e.target.checked)}
                      />
                      Turno
                    </label>
                    <select
                      className="h-9 rounded-lg border px-2 text-sm w-full bg-white"
                      disabled={!invUseTurno}
                      value={invShiftId}
                      onChange={(e) => setInvShiftId(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {closedShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shiftNumber ? `#${s.shiftNumber} • ` : ""}
                          {s.closedAt ? new Date(s.closedAt).toLocaleString() : s.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUseMotivo}
                        onChange={(e) => setInvUseMotivo(e.target.checked)}
                      />
                      Motivo anulación
                    </label>
                    <select
                      className="h-9 rounded-lg border px-2 text-sm w-full bg-white"
                      disabled={!invUseMotivo}
                      value={invMotivo}
                      onChange={(e) => setInvMotivo(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {invoiceReasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUseInvoiceNumber}
                        onChange={(e) => setInvUseInvoiceNumber(e.target.checked)}
                      />
                      N. Factura
                    </label>
                    <div className="flex gap-2 w-full">
                      <input
                        className="h-9 rounded-lg border px-2 text-sm w-full"
                        disabled={!invUseInvoiceNumber}
                        value={invInvoiceFrom}
                        onChange={(e) => setInvInvoiceFrom(e.target.value)}
                      />
                      <input
                        className="h-9 rounded-lg border px-2 text-sm w-full"
                        disabled={!invUseInvoiceNumber}
                        value={invInvoiceTo}
                        onChange={(e) => setInvInvoiceTo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUseMonedaPago}
                        onChange={(e) => setInvUseMonedaPago(e.target.checked)}
                      />
                      Moneda pago
                    </label>
                    <select
                      className="h-9 rounded-lg border px-2 text-sm w-full bg-white"
                      disabled={!invUseMonedaPago}
                      value={invPaymentCurrency}
                      onChange={(e) => setInvPaymentCurrency(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {invoiceCurrencies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUseTipoCobro}
                        onChange={(e) => setInvUseTipoCobro(e.target.checked)}
                      />
                      Tipo de cobro
                    </label>
                    <select
                      className="h-9 rounded-lg border px-2 text-sm w-full bg-white"
                      disabled={!invUseTipoCobro}
                      value={invPaymentKey}
                      onChange={(e) => setInvPaymentKey(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {invoicePaymentMethods.map((p) => (
                        <option key={p.key || p} value={p.key || p}>
                          {p.name || p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUseFechaCierre}
                        onChange={(e) => setInvUseFechaCierre(e.target.checked)}
                      />
                      Fecha cierre
                    </label>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <input
                        type="date"
                        className="h-9 rounded-lg border px-2 text-sm w-full"
                        disabled={!invUseFechaCierre}
                        value={invDateFrom}
                        onChange={(e) => setInvDateFrom(e.target.value)}
                      />
                      <input
                        type="date"
                        className="h-9 rounded-lg border px-2 text-sm w-full"
                        disabled={!invUseFechaCierre}
                        value={invDateTo}
                        onChange={(e) => setInvDateTo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input
                        type="checkbox"
                        className="accent-lime-600"
                        checked={invUsePerfil}
                        onChange={(e) => setInvUsePerfil(e.target.checked)}
                      />
                      Perfil empresa
                    </label>
                    <select
                      className="h-9 rounded-lg border px-2 text-sm w-full bg-white"
                      disabled={!invUsePerfil}
                      value={invPerfil}
                      onChange={(e) => setInvPerfil(e.target.value)}
                    >
                      <option value="">{optionsLoading ? "Cargando..." : "Selecciona..."}</option>
                      {invoiceProfiles.map((p) => (
                        <option key={p.id || p} value={p.id || p}>
                          {p.name || p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-700 min-w-[140px]">Estado</div>
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-lime-600"
                          checked={invIncludePaid}
                          onChange={(e) => setInvIncludePaid(e.target.checked)}
                        />
                        Cobradas
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-lime-600"
                          checked={invIncludeVoided}
                          onChange={(e) => setInvIncludeVoided(e.target.checked)}
                        />
                        Anuladas
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm min-w-[140px]">
                      <input type="checkbox" className="accent-lime-600" />
                      Facturas / Notas juntas
                    </label>
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  <div className="text-xs uppercase text-lime-600">Reporte</div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {[
                      "Detallado",
                      "Detallado por Familias",
                      "Resumido",
                      "Agrupado por Meseros",
                      "Agrupado por Monedas",
                    ].map((label) => (
                      <label key={label} className="flex items-center gap-2">
                        <input type="radio" name="invoiceReport" className="accent-lime-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-lime-200 overflow-hidden">
                <div className="grid grid-cols-[44px_150px_80px_150px_120px_110px_120px_90px_90px_90px] bg-lime-100 text-xs font-semibold text-lime-900 px-3 py-2">
                  <div className="text-center">Sel</div>
                  <div>Fecha de Cierre</div>
                  <div>Turno</div>
                  <div>N. Factura</div>
                  <div>Docum</div>
                  <div>Sección - Mesa</div>
                  <div>Cajero / Mesero</div>
                  <div>Mon.</div>
                  <div>Amount</div>
                  <div>Estado</div>
                </div>
                <div className="min-h-[240px] bg-lime-50">
                  {invoiceRows.map((row) => (
                    <div
                      key={row.id}
                      onClick={() => {
                        setSelectedInvoiceId(row.restaurantOrderId || "");
                        setSelectedInvoiceDocId(row.id || "");
                      }}
                      className={`grid grid-cols-[44px_150px_80px_150px_120px_110px_120px_90px_90px_90px] text-xs px-3 py-2 border-t border-lime-200 cursor-pointer ${selectedInvoiceId === (row.restaurantOrderId || "") ? "bg-lime-100" : ""}`}
                    >
                      <div className="flex justify-center">
                        <input
                          type="checkbox"
                          checked={selectedInvoiceDocId === (row.id || "")}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedInvoiceId(row.restaurantOrderId || "");
                              setSelectedInvoiceDocId(row.id || "");
                            } else {
                              setSelectedInvoiceId("");
                              setSelectedInvoiceDocId("");
                            }
                          }}
                        />
                      </div>
                      <div>{row.closedAt ? new Date(row.closedAt).toLocaleDateString() : "-"}</div>
                      <div>{row.shiftNumber ? `#${row.shiftNumber}` : row.shiftId ? String(row.shiftId).slice(-6) : "-"}</div>
                      <div className="truncate" title={row.consecutive || ""}>{row.consecutive || "-"}</div>
                      <div className="truncate" title={row.docType || ""}>{row.docType || "-"}</div>
                      <div>
                        {row.order?.sectionId ? `${row.order.sectionId} - ` : ""}
                        {row.order?.tableId || "-"}
                      </div>
                      <div>{getStaffName(row.order?.cashierId)} / {getStaffName(row.order?.waiterId)}</div>
                      <div>{row.order?.currency || "-"}</div>
                      <div>{formatMoneyWithCurrency(row.order?.total, row.order?.currency || row.currency || "")}</div>
                      <div>{row.status || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  className="h-10 px-3 rounded-lg bg-lime-100 border border-lime-200"
                  onClick={openSelectedInvoicePdf}
                >
                  Exportar PDF
                </button>
                <button
                  className="h-10 px-3 rounded-lg bg-red-100 border border-red-200 text-red-700"
                  onClick={async () => {
                    if (!selectedInvoiceId) return;
                    const reason = window.prompt("Motivo de anulación:") || "";
                    const adminCode = window.prompt("Admin PIN:") || "";
                    if (!adminCode) return;
                    await api.post("/restaurant/order/void-invoice", {
                      restaurantOrderId: selectedInvoiceId,
                      reason,
                      adminCode,
                    });
                    handleInvoicesApply();
                  }}
                >
                  Anular Factura
                </button>
                <button
                  className="h-10 px-3 rounded-lg bg-lime-700 text-white"
                  onClick={openSelectedInvoicePdf}
                >
                  Imprimir
                </button>
                <button
                  className="h-10 px-3 rounded-lg bg-lime-100 border border-lime-200 disabled:opacity-60"
                  onClick={handleInvoicesApply}
                  disabled={invoiceBusy}
                >
                  {invoiceBusy ? "Cargando..." : "Buscar"}
                </button>
              </div>
              {(invoiceError || invoiceMissing.length > 0) && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  {invoiceError && <div>{invoiceError}</div>}
                  {invoiceMissing.length > 0 && (
                    <ul className="list-disc pl-4">
                      {invoiceMissing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </>
      {salesPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl border border-lime-200 overflow-hidden">
            <style>{`
              @media print {
                .sales-preview-header { display: none !important; }
                .sales-preview-body { padding: 0 !important; }
              }
            `}</style>
            <div className="sales-preview-header flex items-center justify-between gap-3 px-4 py-3 bg-lime-100 border-b border-lime-200">
              <div className="text-sm font-semibold text-lime-900">Vista previa de ventas / devoluciones</div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-3 rounded-lg bg-lime-700 text-white text-sm font-semibold"
                  onClick={() => window.print()}
                >
                  Imprimir
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-lime-200 text-sm"
                  onClick={() => setSalesPreviewOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="sales-preview-body p-4 max-h-[70vh] overflow-auto">
              <div className="mb-3 text-xs text-slate-600 space-y-1">
                <div>Tipo: {movementType}</div>
                <div>Agrupar: {groupBy || "-"} | Ordenar: {orderBy || "-"}</div>
                <div>Filtro rápido: {focusKey || "-"}</div>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-lime-50 text-left">
                    {groupBy ? <th className="border border-lime-200 px-2 py-1">Grupo</th> : null}
                    <th className="border border-lime-200 px-2 py-1">ID</th>
                    <th className="border border-lime-200 px-2 py-1">Sección</th>
                    <th className="border border-lime-200 px-2 py-1">Mesa</th>
                    <th className="border border-lime-200 px-2 py-1">Total</th>
                    <th className="border border-lime-200 px-2 py-1">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {salesPreviewRows.map((row) => (
                    <tr key={row.id || `${row.sectionId}-${row.tableId}-${row.createdAt}`}>
                      {groupBy ? (
                        <td className="border border-lime-100 px-2 py-1">{row.groupKey || "-"}</td>
                      ) : null}
                      <td className="border border-lime-100 px-2 py-1">{row.id || "-"}</td>
                      <td className="border border-lime-100 px-2 py-1">{row.sectionId || "-"}</td>
                      <td className="border border-lime-100 px-2 py-1">{row.tableId || "-"}</td>
                      <td className="border border-lime-100 px-2 py-1">{row.total ?? "-"}</td>
                      <td className="border border-lime-100 px-2 py-1">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                  {salesPreviewRows.length === 0 && (
                    <tr>
                      <td className="border border-lime-100 px-2 py-2 text-center text-slate-500" colSpan={groupBy ? 6 : 5}>
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {invoicePreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-lime-200 overflow-hidden">
            <style>{`
              @media print {
                .invoice-preview-header { display: none !important; }
                .invoice-preview-body { padding: 0 !important; }
              }
            `}</style>
            <div className="invoice-preview-header flex items-center justify-between gap-3 px-4 py-3 bg-lime-100 border-b border-lime-200">
              <div className="text-sm font-semibold text-lime-900">Vista previa de factura</div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-3 rounded-lg bg-lime-700 text-white text-sm font-semibold"
                  onClick={() => window.print()}
                >
                  Imprimir
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-lime-200 text-sm"
                  onClick={() => setInvoicePreviewOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="invoice-preview-body p-4 max-h-[70vh] overflow-auto">
              <pre className="text-[12px] leading-5 font-mono whitespace-pre-wrap text-slate-800">
                {invoicePreviewText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
