import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { buildCloseReportText, buildPrintPreviewText as buildTicketText } from "../../lib/restaurantDocs";
import {
  BarChart3,
  Receipt,
  FileText,
  Briefcase,
  Ticket,
} from "lucide-react";
import RestaurantUserMenu from "./RestaurantUserMenu";
import { Tile } from "./RestaurantLobby";

const LOBBY_TILE_SIZE = "lg";

export default function RestaurantHistory() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);
  const [invoicesDialogOpen, setInvoicesDialogOpen] = useState(false);
  const [shiftsDialogOpen, setShiftsDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [closePreviewOpen, setClosePreviewOpen] = useState(false);
  const [closePreviewText, setClosePreviewText] = useState("");
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
  const [topCount, setTopCount] = useState("");
  const [topMode, setTopMode] = useState("");
  const [includeItemsMode, setIncludeItemsMode] = useState("");
  const [focusKey, setFocusKey] = useState("");
  const [reportMissing, setReportMissing] = useState([]);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [salesPreviewOpen, setSalesPreviewOpen] = useState(false);
  const [salesPreviewRows, setSalesPreviewRows] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesSummary, setSalesSummary] = useState({ total: 0, subtotal: 0, tax: 0, tip10: 0 });
  const [previewLoadingMore, setPreviewLoadingMore] = useState(false);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceLoadingMore, setInvoiceLoadingMore] = useState(false);
  const salesParamsRef = useRef(null);
  const invoiceParamsRef = useRef(null);
  const [shiftRows, setShiftRows] = useState([]);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [shiftUseTurno, setShiftUseTurno] = useState(false);
  const [shiftIdFilter, setShiftIdFilter] = useState("");
  const [shiftUseFecha, setShiftUseFecha] = useState(false);
  const [shiftDateFrom, setShiftDateFrom] = useState("");
  const [shiftDateTo, setShiftDateTo] = useState("");
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
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidForm, setVoidForm] = useState({ adminUser: "", adminCode: "", reason: "" });
  // Anulación de una venta ya cobrada (devolución): revierte caja, stock y contabilidad.
  const [voidSaleTarget, setVoidSaleTarget] = useState(null);
  const [voidSaleForm, setVoidSaleForm] = useState({ adminUser: "", adminCode: "", reason: "" });
  const [voidSaleBusy, setVoidSaleBusy] = useState(false);
  const [voidSaleError, setVoidSaleError] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewText, setInvoicePreviewText] = useState("");
  const [billingCfg, setBillingCfg] = useState({
    ticketHeader: "",
    ticketFooter: "",
    invoiceHeader: "",
    invoiceFooter: "",
  });
  // Datos del restaurante para encabezar reimpresiones (nombre, cédula, teléfono, dirección).
  const [restaurantInfo, setRestaurantInfo] = useState({});
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
    if (h < 15) return "Turno mañana";
    if (h < 22) return "Turno tarde";
    return "Turno noche";
  }, [now]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!salesDialogOpen && !invoicesDialogOpen && !shiftsDialogOpen) return;
    const loadOptions = async () => {
      setFamiliesLoading(true);
      setOptionsLoading(true);
      const requests = await Promise.allSettled([
        api.get("/restaurant/families"),
        api.get("/restaurant/subfamilies"),
        api.get("/restaurant/items"),
        api.get("/restaurant/staff"),
        api.get("/restaurant/payments"),
        api.get("/restaurant/shifts/closed"),
        api.get("/restaurant/billing"),
        api.get("/restaurant/general"),
      ]);
      const [familiesRes, subFamiliesRes, itemsRes, staffRes, paymentsRes, shiftsRes, billingRes, generalRes] = requests;
      const blocked = [];
      const dataOf = (res) => (res.status === "fulfilled" ? res.value?.data : null);

      if (familiesRes.status === "fulfilled") {
        setFamilies(Array.isArray(dataOf(familiesRes)) ? dataOf(familiesRes) : []);
      } else blocked.push("familias");
      if (subFamiliesRes.status === "fulfilled") {
        setSubFamilies(Array.isArray(dataOf(subFamiliesRes)) ? dataOf(subFamiliesRes) : []);
      } else blocked.push("subfamilias");
      if (itemsRes.status === "fulfilled") {
        setItemsList(Array.isArray(dataOf(itemsRes)) ? dataOf(itemsRes) : []);
      } else blocked.push("artículos");
      if (staffRes.status === "fulfilled") {
        setStaff(Array.isArray(dataOf(staffRes)) ? dataOf(staffRes) : []);
      } else blocked.push("personal");

      if (paymentsRes.status === "fulfilled") {
        const paymentsCfg = dataOf(paymentsRes) || {};
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
        setInvoiceCurrencies(Array.from(new Set(currencies)));
        setInvoicePaymentMethods(fromMethods.length ? fromMethods : fromCobros);
      } else blocked.push("formas de pago");

      if (shiftsRes.status === "fulfilled") {
        setClosedShifts(Array.isArray(dataOf(shiftsRes)) ? dataOf(shiftsRes) : []);
      } else blocked.push("turnos cerrados");

      if (billingRes.status === "fulfilled") {
        const billing = dataOf(billingRes) || {};
        setBillingCfg({
          ticketHeader: billing.ticketHeader || "",
          ticketFooter: billing.ticketFooter || "",
          invoiceHeader: billing.invoiceHeader || "",
          invoiceFooter: billing.invoiceFooter || "",
        });
      } else blocked.push("datos de facturación");

      if (generalRes.status === "fulfilled") {
        setRestaurantInfo(dataOf(generalRes) || {});
      }

      if (blocked.length > 0) {
        window.dispatchEvent(
          new CustomEvent("pms:push-alert", {
            detail: {
              title: "Histórico",
              desc: `Sin permiso para cargar: ${blocked.join(", ")}. El resto del reporte sigue disponible.`,
            },
          })
        );
      }
      setFamiliesLoading(false);
      setOptionsLoading(false);
    };
    loadOptions();
  }, [salesDialogOpen, invoicesDialogOpen, shiftsDialogOpen]);

  const openStatsDialog = async () => {
    setStatsDialogOpen(true);
    setStatsLoading(true);
    setStatsError("");
    setStatsData(null);
    try {
      const { data } = await api.get("/restaurant/stats");
      setStatsData(data || null);
    } catch {
      setStatsError("No se pudo cargar estadísticas.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleShiftsApply = async () => {
    if (shiftBusy) return;
    setShiftBusy(true);
    setShiftError("");
    try {
      let rows = Array.isArray(closedShifts) ? [...closedShifts] : [];
      if (shiftUseTurno && shiftIdFilter) {
        rows = rows.filter((s) => String(s.id) === String(shiftIdFilter));
      }
      if (shiftUseFecha && (shiftDateFrom || shiftDateTo)) {
        const from = shiftDateFrom ? new Date(shiftDateFrom) : null;
        const to = shiftDateTo ? new Date(shiftDateTo) : null;
        if (to) to.setHours(23, 59, 59, 999);
        rows = rows.filter((s) => {
          const closedAt = s?.closedAt ? new Date(s.closedAt) : null;
          if (!closedAt) return false;
          if (from && closedAt < from) return false;
          if (to && closedAt > to) return false;
          return true;
        });
      }
      setShiftRows(rows);
    } catch {
      setShiftError("No se pudo filtrar turnos.");
    } finally {
      setShiftBusy(false);
    }
  };

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

  const openPreview = (rows, total, summary) => {
    setSalesPreviewRows(Array.isArray(rows) ? rows : []);
    setSalesTotal(Number(total ?? (Array.isArray(rows) ? rows.length : 0)));
    setSalesSummary(summary || { total: 0, subtotal: 0, tax: 0, tip10: 0 });
    setSalesPreviewOpen(true);
  };

  const visiblePreviewRows = salesPreviewRows;

  const loadMoreSales = async () => {
    if (previewLoadingMore || !salesParamsRef.current) return;
    setPreviewLoadingMore(true);
    try {
      const params = { ...salesParamsRef.current, offset: salesPreviewRows.length };
      const { data } = await api.get("/restaurant/history/sales", { params });
      const rows = Array.isArray(data?.items) ? data.items : [];
      setSalesPreviewRows((prev) => [...prev, ...rows]);
      setSalesTotal(Number(data?.total ?? 0));
      if (data?.summary) setSalesSummary(data.summary);
      if (rows.length === 0) setSalesTotal(salesPreviewRows.length);
    } catch {
      setReportError("No se pudieron cargar más registros.");
    } finally {
      setPreviewLoadingMore(false);
    }
  };

  const handlePrint = async () => {
    setReportBusy(true);
    setReportError("");
    setReportMissing([]);
    try {
      const params = {
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
        limit: 100,
        offset: 0,
      };
      salesParamsRef.current = params;
      const { data } = await api.get("/restaurant/history/sales", { params });
      const missing = Array.isArray(data?.missing) ? data.missing : [];
      setReportMissing(missing);
      const rows = Array.isArray(data?.items) ? data.items : [];
      const total = Number(data?.total ?? rows.length);
      if (rows.length > 0 || total > 0) openPreview(rows, total, data?.summary);
    } catch (err) {
      setReportError("No se pudo generar el reporte.");
    } finally {
      setReportBusy(false);
    }
  };

  const buildInvoicePreviewText = ({ row, header, footer }) => {
    const order = row?.order || {};
    const money = (v) => formatMoneyWithCurrency(v, order.currency || "");
    const cashierName = getStaffName(order?.cashierId);
    const waiterName = getStaffName(order?.waiterId);
    return buildTicketText({
      title: String(row?.docType || "").toUpperCase() === "FE" ? "FACTURA ELECTRONICA" : "TICKET",
      payload: {
        __printHeader: header,
        __printFooter: footer,
        documentNumber: row?.consecutive,
        shiftNumber: row?.shiftNumber,
        date: row?.closedAt,
        cashierName: cashierName !== "-" ? cashierName : "",
        waiterName: waiterName !== "-" ? waiterName : "",
        sectionId: order?.sectionId,
        tableId: order?.tableId,
        covers: order?.covers,
        serviceType: order?.serviceType,
        roomId: order?.roomId,
        items: (Array.isArray(order?.items) ? order.items : []).map((it) => ({
          ...it,
          note: it?.detailNote || it?.note,
        })),
        note: order?.note,
        paymentMethods:
          order?.paymentBreakdown && typeof order.paymentBreakdown === "object"
            ? Object.entries(order.paymentBreakdown)
                .filter(([, v]) => Number(v) > 0)
                .map(([name, amount]) => ({ name, amount }))
            : [],
        canceled: row?.status === "CANCELED",
        cancelReason: row?.cancelReason,
      },
      totals: {
        subtotal: order?.subtotal,
        tax: order?.tax ?? order?.iva,
        service: order?.tip10,
        discountTotal: order?.discountAmount,
        total: order?.total,
      },
      money,
      restaurant: restaurantInfo,
    });
  };

  const buildCloseReportTextHistory = (row) => {
    const totals = row?.closeTotals && typeof row.closeTotals === "object" ? row.closeTotals : {};
    const payments = row?.closePayments && typeof row.closePayments === "object" ? row.closePayments : {};
    const systemTotal = Number(totals.system ?? totals.systemTotal ?? totals.totalSales ?? totals.total ?? 0);
    return buildCloseReportText({
      stage: "Z",
      reprint: true,
      restaurant: restaurantInfo,
      shiftNumber: row?.shiftNumber,
      openedAt: row?.openedAt,
      closedAt: row?.closedAt,
      systemTotal,
      byMethod: payments,
      salesCount: 0,
      note: row?.closeNote,
    });
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

  const openVoidInvoiceModal = () => {
    const row = invoiceRows.find((r) => r.id === selectedInvoiceDocId);
    if (!row) {
      alert("Selecciona una factura primero.");
      return;
    }
    if (String(row.status || "").toUpperCase() === "CANCELED") {
      alert("La factura ya está anulada.");
      return;
    }
    setVoidTarget(row);
    setVoidForm({ adminUser: "", adminCode: "", reason: "" });
    setVoidError("");
  };

  const closeVoidInvoiceModal = () => {
    if (voidBusy) return;
    setVoidTarget(null);
    setVoidError("");
  };

  const openVoidSaleModal = (row) => {
    if (!row?.id) return;
    if (String(row.status || "").toUpperCase() !== "PAID") {
      window.alert("Solo se pueden anular ventas cobradas.");
      return;
    }
    setVoidSaleTarget(row);
    setVoidSaleForm({ adminUser: "", adminCode: "", reason: "" });
    setVoidSaleError("");
  };

  const closeVoidSaleModal = () => {
    if (voidSaleBusy) return;
    setVoidSaleTarget(null);
    setVoidSaleError("");
  };

  const confirmVoidSale = async () => {
    if (voidSaleBusy || !voidSaleTarget) return;
    const reason = String(voidSaleForm.reason || "").trim();
    const adminCode = String(voidSaleForm.adminCode || "").trim();
    const adminUser = String(voidSaleForm.adminUser || "").trim();
    if (!reason) {
      setVoidSaleError("El motivo es obligatorio.");
      return;
    }
    if (!adminCode) {
      setVoidSaleError("Ingresa el PIN de administrador.");
      return;
    }
    setVoidSaleBusy(true);
    setVoidSaleError("");
    try {
      const { data } = await api.post("/restaurant/order/void-paid", {
        orderId: voidSaleTarget.id,
        reason,
        adminCode,
        adminUser: adminUser || undefined,
      });
      const restored = Array.isArray(data?.inventoryRestored) ? data.inventoryRestored.length : 0;
      const parts = ["Venta anulada."];
      if (restored > 0) parts.push(`Inventario devuelto en ${restored} insumo(s).`);
      if (data?.eInvoicePending?.message) parts.push(data.eInvoicePending.message);
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Restaurante", desc: parts.join(" ") } })
      );
      setVoidSaleTarget(null);
      setVoidSaleForm({ adminUser: "", adminCode: "", reason: "" });
      await handleInvoicesApply();
    } catch (err) {
      setVoidSaleError(err?.response?.data?.message || err?.message || "No se pudo anular la venta.");
    } finally {
      setVoidSaleBusy(false);
    }
  };

  const confirmVoidInvoice = async () => {
    if (voidBusy || !voidTarget) return;
    const reason = String(voidForm.reason || "").trim();
    const adminCode = String(voidForm.adminCode || "").trim();
    const adminUser = String(voidForm.adminUser || "").trim();
    if (!reason) {
      setVoidError("El motivo es obligatorio.");
      return;
    }
    if (!adminCode) {
      setVoidError("Ingresa el PIN de administrador.");
      return;
    }
    setVoidBusy(true);
    setVoidError("");
    try {
      await api.post("/restaurant/order/void-invoice", {
        restaurantOrderId: voidTarget.restaurantOrderId || selectedInvoiceId,
        docType: voidTarget.docType,
        reason,
        adminCode,
        adminUser: adminUser || undefined,
      });
      setVoidTarget(null);
      setVoidForm({ adminUser: "", adminCode: "", reason: "" });
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Restaurante", desc: "Factura anulada." } })
      );
      await handleInvoicesApply();
    } catch (err) {
      setVoidError(err?.response?.data?.message || err?.message || "No se pudo anular la factura.");
    } finally {
      setVoidBusy(false);
    }
  };

const handleInvoicesApply = async () => {
    setInvoiceBusy(true);
    setInvoiceError("");
    setInvoiceMissing([]);
    try {
      const params = {
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
        limit: 100,
        offset: 0,
      };
      invoiceParamsRef.current = params;
      const { data } = await api.get("/restaurant/history/invoices", { params });
      const rows = Array.isArray(data?.items) ? data.items : [];
      setInvoiceRows(rows);
      setInvoiceTotal(Number(data?.total ?? rows.length));
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

  const loadMoreInvoices = async () => {
    if (invoiceLoadingMore || !invoiceParamsRef.current) return;
    setInvoiceLoadingMore(true);
    try {
      const params = { ...invoiceParamsRef.current, offset: invoiceRows.length };
      const { data } = await api.get("/restaurant/history/invoices", { params });
      const rows = Array.isArray(data?.items) ? data.items : [];
      setInvoiceRows((prev) => [...prev, ...rows]);
      setInvoiceTotal(Number(data?.total ?? 0));
    } catch {
      setInvoiceError("No se pudieron cargar más facturas.");
    } finally {
      setInvoiceLoadingMore(false);
    }
  };

  const items = [
    {
      title: "Ventas",
      desc: "Órdenes pagadas del turno con filtros y totales.",
      icon: BarChart3,
      onClick: () => setSalesDialogOpen(true),
    },
    {
      title: "Facturas",
      desc: "Comprobantes emitidos, reimpresión y anulación.",
      icon: FileText,
      onClick: () => setInvoicesDialogOpen(true),
      tone: "amber",
    },
    {
      title: "Turnos de Trabajo",
      desc: "Cierres X/Z y arqueos de caja.",
      icon: Briefcase,
      onClick: () => setShiftsDialogOpen(true),
    },
    {
      title: "Estadísticas",
      desc: "Resumen operativo del restaurante.",
      icon: BarChart3,
      onClick: openStatsDialog,
      tone: "green",
    },
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
              desc={item.desc}
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
            <div className="w-full max-w-[1200px] h-[90vh] rounded-2xl border border-lime-200 bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-lime-100">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-lime-800">Ventas</div>
                </div>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setSalesDialogOpen(false)}
                >
                  Cerrar
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 p-4 sm:p-6 overflow-y-auto h-[calc(90vh-72px)]">
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
                      checked={movementType === "VOIDS"}
                      onChange={() => setMovementType("VOIDS")}
                      className="accent-lime-600"
                    />
                    Anulaciones
                  </label>
                </div>

                <div className="rounded-xl border border-lime-200 p-4 bg-white">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                      className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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

                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                      className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                    className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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
                <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                    className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
                    disabled={!useMoneda}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="">Selecciona...</option>
                    <option value="BASE">Base</option>
                    <option value="SEC">Secundaria</option>
                  </select>
                </div>
                <div className="grid grid-cols-[140px_1fr_160px] gap-3 items-center">
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
                    className="h-8 rounded-lg border px-2 text-xs w-full max-w-[280px]"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setDateTo("");
                    }}
                    disabled={!useFecha}
                  />
                  <select
                    className="h-8 rounded-lg border px-2 text-xs w-full max-w-[160px] bg-white"
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
                    <div className="space-y-3">
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
                      className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                      className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                      className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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
                  <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
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
                      className="h-8 rounded-lg border px-2 text-xs w-full max-w-[300px] bg-white"
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

                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-lime-200 p-3 space-y-2 bg-lime-50/60">
                    <div className="text-xs uppercase text-lime-600">Agrupar por</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="groupBy"
                        className="accent-lime-600"
                        checked={!groupBy}
                        onChange={() => setGroupBy("")}
                      />
                      Ninguno
                    </label>
                    {["Familia", "Subfamilia", "Mesero", "Cajero", "Creador", "Turno", "Artículo", "Fecha"].map((label) => (
                      <label key={label} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="groupBy"
                          className="accent-lime-600"
                          checked={groupBy === label}
                          onChange={() => setGroupBy((prev) => prev === label ? "" : label)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="rounded-xl border border-lime-200 p-3 space-y-2 bg-lime-50/60">
                    <div className="text-xs uppercase text-lime-600">Ordenar por</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="orderBy"
                        className="accent-lime-600"
                        checked={!orderBy}
                        onChange={() => setOrderBy("")}
                      />
                      Predeterminado
                    </label>
                    {["Código", "Total (mayor a menor)", "Total (menor a mayor)", "Cantidad", "Fecha"].map((label) => (
                      <label key={label} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="orderBy"
                          className="accent-lime-600"
                          checked={orderBy === label}
                          onChange={() => setOrderBy((prev) => prev === label ? "" : label)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
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
              </div>
              <div className="space-y-2">
                <div className="rounded-xl border border-lime-200 p-3">
                  <div className="text-xs uppercase text-lime-600 mb-2">Enfoque rápido</div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "Familia",
                      "Subfamilia",
                      "Artículo",
                      "Fecha",
                      "Mesero",
                      "Cajero",
                      "Creador",
                      "Servicio",
                      "Cliente",
                    ].map((label) => (
                      <button
                        key={label}
                        className={`w-full h-10 rounded-lg text-[13px] font-semibold border border-lime-300 ${
                          focusKey === label
                            ? "bg-lime-200 text-lime-900"
                            : "bg-lime-100 text-lime-800 hover:bg-lime-150"
                        }`}
                        onClick={() => setFocusKey((prev) => prev === label ? "" : label)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
                {invoiceTotal > invoiceRows.length && (
                  <button
                    className="mr-auto h-10 px-3 rounded-lg border border-lime-200 bg-white text-sm disabled:opacity-60"
                    onClick={loadMoreInvoices}
                    disabled={invoiceLoadingMore}
                  >
                    {invoiceLoadingMore ? "Cargando..." : `Mostrar más (${invoiceTotal - invoiceRows.length} restantes)`}
                  </button>
                )}
                <button
                  className="h-10 px-3 rounded-lg bg-lime-100 border border-lime-200"
                  onClick={openSelectedInvoicePdf}
                >
                  Exportar PDF
                </button>
                <button
                  className="h-10 px-3 rounded-lg bg-red-100 border border-red-200 text-red-700 disabled:opacity-60"
                  onClick={openVoidInvoiceModal}
                  disabled={!selectedInvoiceDocId}
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
        {shiftsDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-6xl h-[90vh] rounded-2xl border border-lime-200 bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-lime-100">
                <div className="text-lg font-semibold text-lime-800">Turnos de Trabajo</div>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setShiftsDialogOpen(false)}
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
                          checked={shiftUseTurno}
                          onChange={(e) => setShiftUseTurno(e.target.checked)}
                        />
                        Turno
                      </label>
                      <select
                        className="h-9 rounded-lg border px-2 text-sm w-full bg-white"
                        disabled={!shiftUseTurno}
                        value={shiftIdFilter}
                        onChange={(e) => setShiftIdFilter(e.target.value)}
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
                          checked={shiftUseFecha}
                          onChange={(e) => setShiftUseFecha(e.target.checked)}
                        />
                        Fecha cierre
                      </label>
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <input
                          type="date"
                          className="h-9 rounded-lg border px-2 text-sm w-full"
                          disabled={!shiftUseFecha}
                          value={shiftDateFrom}
                          onChange={(e) => setShiftDateFrom(e.target.value)}
                        />
                        <input
                          type="date"
                          className="h-9 rounded-lg border px-2 text-sm w-full"
                          disabled={!shiftUseFecha}
                          value={shiftDateTo}
                          onChange={(e) => setShiftDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-lime-200 overflow-hidden overflow-x-auto">
                  <div className="grid grid-cols-[80px_160px_160px_110px_110px_1fr_90px] bg-lime-100 text-xs font-semibold text-lime-900 px-3 py-2 min-w-[920px]">
                    <div>Turno</div>
                    <div>Apertura</div>
                    <div>Cierre</div>
                    <div>Fondo apertura</div>
                    <div>Ventas Z</div>
                    <div>Pagos (desglose)</div>
                    <div></div>
                  </div>
                  <div className="min-h-[240px] bg-lime-50 min-w-[920px]">
                    {(shiftRows.length ? shiftRows : closedShifts).map((row) => {
                      const totals = row.closeTotals || {};
                      const payments = row.closePayments || {};
                      const saleTotal = Number(totals.system ?? totals.systemTotal ?? totals.totalSales ?? totals.total ?? 0);
                      const paymentEntries = Object.entries(payments).filter(([, v]) => Number(v) > 0);
                      return (
                        <div
                          key={row.id}
                          className="grid grid-cols-[80px_160px_160px_110px_110px_1fr_90px] text-xs px-3 py-2 border-t border-lime-200 items-center"
                        >
                          <div className="font-semibold">{row.shiftNumber ? `#${row.shiftNumber}` : "-"}</div>
                          <div>
                            <div>{row.openedAt ? new Date(row.openedAt).toLocaleString() : "-"}</div>
                            <div className="text-[10px] text-slate-500">{row.openedByName || "-"}</div>
                          </div>
                          <div>
                            <div>{row.closedAt ? new Date(row.closedAt).toLocaleString() : "-"}</div>
                            <div className="text-[10px] text-slate-500">{row.closedByName || "-"}</div>
                          </div>
                          <div>{Number(row.openingAmount || 0).toFixed(2)}</div>
                          <div className="font-semibold text-lime-800">
                            {saleTotal > 0 ? saleTotal.toFixed(2) : "-"}
                          </div>
                          <div className="truncate text-slate-600">
                            {paymentEntries.length > 0
                              ? paymentEntries.map(([k, v]) => `${k}: ${Number(v).toFixed(2)}`).join(" | ")
                              : row.closeNote || "-"}
                          </div>
                          <div>
                            <button
                              className="h-7 px-2 rounded-lg bg-lime-100 border border-lime-300 text-[11px] font-semibold text-lime-800 hover:bg-lime-200"
                              onClick={() => {
                                const txt = buildCloseReportTextHistory(row);
                                setClosePreviewText(txt);
                                setClosePreviewOpen(true);
                              }}
                            >
                              Reimprimir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {((shiftRows.length ? shiftRows : closedShifts).length === 0) && (
                      <div className="px-3 py-6 text-center text-xs text-slate-500">Sin resultados.</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <button
                    className="h-10 px-3 rounded-lg bg-lime-100 border border-lime-200 disabled:opacity-60"
                    onClick={handleShiftsApply}
                    disabled={shiftBusy}
                  >
                    {shiftBusy ? "Cargando..." : "Buscar"}
                  </button>
                </div>
                {shiftError && (
                  <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    {shiftError}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {statsDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-2xl rounded-2xl border border-lime-200 bg-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-lime-100">
                <div className="text-lg font-semibold text-lime-800">Estadísticas del turno</div>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setStatsDialogOpen(false)}
                >
                  Cerrar
                </button>
              </div>
              <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
                {statsLoading && <div className="text-center text-sm text-slate-500 py-8">Cargando estadísticas...</div>}
                {statsError && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{statsError}</div>}
                {statsData && !statsLoading && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-lime-200 bg-lime-50 p-4">
                        <div className="text-xs text-lime-600 uppercase font-semibold">Ventas del turno</div>
                        <div className="text-2xl font-bold text-lime-900 mt-1">
                          {Number(statsData.systemTotal || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{statsData.salesCount || 0} transacciones</div>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="text-xs text-amber-600 uppercase font-semibold">Órdenes abiertas</div>
                        <div className="text-2xl font-bold text-amber-900 mt-1">{statsData.openOrders || 0}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Valor: {Number(statsData.openOrderValue || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {statsData.byMethod && Object.keys(statsData.byMethod).length > 0 && (
                      <div className="rounded-xl border border-lime-200 overflow-hidden">
                        <div className="bg-lime-100 px-4 py-2 text-xs font-semibold text-lime-900 uppercase">
                          Desglose por método de pago
                        </div>
                        {Object.entries(statsData.byMethod).map(([method, amount]) => (
                          <div key={method} className="flex items-center justify-between px-4 py-2 border-t border-lime-100 text-sm">
                            <span className="text-slate-700">{method}</span>
                            <span className="font-semibold text-lime-900">{Number(amount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-4 py-2 border-t border-lime-200 bg-lime-50 text-sm font-bold">
                          <span>Total</span>
                          <span className="text-lime-900">{Number(statsData.systemTotal || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-slate-500 text-right">
                      {statsData.lastCloseAt
                        ? `Último cierre Z: ${new Date(statsData.lastCloseAt).toLocaleString()}`
                        : "Sin cierres Z registrados"}
                    </div>
                  </>
                )}
                <div className="flex justify-end pt-2">
                  <button
                    className="h-9 px-4 rounded-lg bg-lime-100 border border-lime-200 text-sm font-semibold"
                    onClick={openStatsDialog}
                    disabled={statsLoading}
                  >
                    {statsLoading ? "Cargando..." : "Actualizar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
      {closePreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-lime-200 overflow-hidden">
            <style>{`@media print { .close-preview-header { display:none!important; } }`}</style>
            <div className="close-preview-header flex items-center justify-between gap-3 px-4 py-3 bg-lime-100 border-b border-lime-200">
              <div className="text-sm font-semibold text-lime-900">Reporte de Cierre</div>
              <div className="flex items-center gap-2">
                <button className="h-9 px-3 rounded-lg bg-lime-700 text-white text-sm font-semibold" onClick={() => window.print()}>Imprimir</button>
                <button className="h-9 px-3 rounded-lg border border-lime-200 text-sm" onClick={() => setClosePreviewOpen(false)}>Cerrar</button>
              </div>
            </div>
            <div className="p-4 max-h-[75vh] overflow-auto">
              <pre className="text-[12px] leading-5 font-mono whitespace-pre-wrap text-slate-800">{closePreviewText}</pre>
            </div>
          </div>
        </div>
      )}
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
              <div className="text-sm font-semibold text-lime-900">Vista previa de ventas</div>
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
              {movementType === "VOIDS" ? (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-red-50 text-left">
                      <th className="border border-red-200 px-2 py-1">Orden</th>
                      <th className="border border-red-200 px-2 py-1">Sección</th>
                      <th className="border border-red-200 px-2 py-1">Mesa</th>
                      <th className="border border-red-200 px-2 py-1">Total</th>
                      <th className="border border-red-200 px-2 py-1">Cancelado por</th>
                      <th className="border border-red-200 px-2 py-1">Autorizado por</th>
                      <th className="border border-red-200 px-2 py-1">Motivo</th>
                      <th className="border border-red-200 px-2 py-1">Fecha anulación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePreviewRows.map((row) => (
                      <tr key={row.id} className="hover:bg-red-50">
                        <td className="border border-red-100 px-2 py-1">{row.saleNumber || row.id?.slice(-6) || "-"}</td>
                        <td className="border border-red-100 px-2 py-1">{row.sectionId || "-"}</td>
                        <td className="border border-red-100 px-2 py-1">{row.tableId || "-"}</td>
                        <td className="border border-red-100 px-2 py-1 font-semibold">{row.total ?? "-"}</td>
                        <td className="border border-red-100 px-2 py-1">{row.canceledBy || "-"}</td>
                        <td className="border border-red-100 px-2 py-1">{row.cancelAdminUser || "-"}</td>
                        <td className="border border-red-100 px-2 py-1">{row.cancelReason || "-"}</td>
                        <td className="border border-red-100 px-2 py-1">
                          {row.canceledAt ? new Date(row.canceledAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                    {salesPreviewRows.length === 0 && (
                      <tr>
                        <td className="border border-red-100 px-2 py-2 text-center text-slate-500" colSpan={8}>
                          Sin anulaciones en el período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-lime-50 text-left">
                      {groupBy ? <th className="border border-lime-200 px-2 py-1">Grupo</th> : null}
                      <th className="border border-lime-200 px-2 py-1">#Venta</th>
                      <th className="border border-lime-200 px-2 py-1">Turno</th>
                      <th className="border border-lime-200 px-2 py-1">Sección</th>
                      <th className="border border-lime-200 px-2 py-1">Mesa</th>
                      <th className="border border-lime-200 px-2 py-1">Cajero</th>
                      <th className="border border-lime-200 px-2 py-1">Mesero</th>
                      <th className="border border-lime-200 px-2 py-1">Items</th>
                      <th className="border border-lime-200 px-2 py-1">Método</th>
                      <th className="border border-lime-200 px-2 py-1">Subtotal</th>
                      <th className="border border-lime-200 px-2 py-1">IVA</th>
                      <th className="border border-lime-200 px-2 py-1">Serv.10%</th>
                      <th className="border border-lime-200 px-2 py-1 font-bold">Total</th>
                      <th className="border border-lime-200 px-2 py-1">Fecha</th>
                      <th className="border border-lime-200 px-2 py-1">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePreviewRows.map((row) => (
                      <tr key={row.id || `${row.sectionId}-${row.tableId}-${row.createdAt}`} className="hover:bg-lime-50">
                        {groupBy ? (
                          <td className="border border-lime-100 px-2 py-1">{row.groupKey || "-"}</td>
                        ) : null}
                        <td className="border border-lime-100 px-2 py-1 font-semibold">{row.saleNumber || row.id?.slice(-6) || "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.shiftNumber ? `#${row.shiftNumber}` : "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.sectionId || "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.tableId || "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.cashierName || getStaffName(row.cashierId) || "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.waiterName || getStaffName(row.waiterId) || "-"}</td>
                        <td className="border border-lime-100 px-2 py-1 text-center">{row.itemCount ?? "-"}</td>
                        <td className="border border-lime-100 px-2 py-1 text-xs text-slate-500">
                          {Array.isArray(row.paymentMethods) && row.paymentMethods.length > 0
                            ? row.paymentMethods.map((p) => p.name || p.key || p).join(", ")
                            : row.paymentKey || "-"}
                        </td>
                        <td className="border border-lime-100 px-2 py-1">{row.subtotal != null ? Number(row.subtotal).toFixed(2) : "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.tax != null ? Number(row.tax).toFixed(2) : "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">{row.tip10 != null ? Number(row.tip10).toFixed(2) : "-"}</td>
                        <td className="border border-lime-100 px-2 py-1 font-bold text-lime-900">{row.total != null ? Number(row.total).toFixed(2) : "-"}</td>
                        <td className="border border-lime-100 px-2 py-1">
                          {row.closedAt ? new Date(row.closedAt).toLocaleString() : row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                        </td>
                        <td className="border border-lime-100 px-2 py-1 text-center">
                          {String(row.status || "").toUpperCase() === "PAID" ? (
                            <button
                              type="button"
                              className="text-[11px] px-2 py-0.5 rounded border border-red-200 text-red-700 hover:bg-red-50"
                              onClick={() => openVoidSaleModal(row)}
                            >
                              Anular venta
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Anulada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {salesPreviewRows.length === 0 && (
                      <tr>
                        <td className="border border-lime-100 px-2 py-2 text-center text-slate-500" colSpan={groupBy ? 15 : 14}>
                          Sin resultados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {salesPreviewRows.length > 0 && (() => {
                  const grandTotal = Number(salesSummary.total || 0);
                  const grandSubtotal = Number(salesSummary.subtotal || 0);
                  const grandTax = Number(salesSummary.tax || 0);
                  const grandTip = Number(salesSummary.tip10 || 0);
                  const remaining = Math.max(0, salesTotal - salesPreviewRows.length);
                  return (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-6 text-xs font-semibold border-t border-lime-200 pt-2">
                      {remaining > 0 && (
                        <button
                          type="button"
                          className="mr-auto h-8 px-3 rounded-lg border border-lime-200 bg-white text-xs text-lime-900 hover:bg-lime-50 disabled:opacity-60"
                          onClick={loadMoreSales}
                          disabled={previewLoadingMore}
                        >
                          {previewLoadingMore ? "Cargando..." : `Mostrar más (${remaining} restantes)`}
                        </button>
                      )}
                      <span>Registros: {salesPreviewRows.length} de {salesTotal}</span>
                      <span>Subtotal: {grandSubtotal.toFixed(2)}</span>
                      <span>IVA: {grandTax.toFixed(2)}</span>
                      <span>Serv.10%: {grandTip.toFixed(2)}</span>
                      <span className="text-lime-900 text-sm">TOTAL: {grandTotal.toFixed(2)}</span>
                    </div>
                  );
                })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {voidSaleTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <div className="text-sm font-semibold text-red-800">Anular venta cobrada</div>
              <div className="text-xs text-red-700/80">
                Devuelve el inventario, quita el cargo a habitación y revierte la contabilidad. No se puede deshacer.
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-0.5">
                <div>Venta: {voidSaleTarget.saleNumber || "-"}</div>
                <div>Mesa: {voidSaleTarget.tableId || "-"}</div>
                <div>Total: {formatMoneyWithCurrency(voidSaleTarget.total, voidSaleTarget.currency || "")}</div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="void-sale-reason">
                  Motivo (obligatorio)
                </label>
                <textarea
                  id="void-sale-reason"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={voidSaleForm.reason}
                  onChange={(e) => setVoidSaleForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700" htmlFor="void-sale-admin-user">
                    Usuario autoriza
                  </label>
                  <input
                    id="void-sale-admin-user"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
                    value={voidSaleForm.adminUser}
                    onChange={(e) => setVoidSaleForm((f) => ({ ...f, adminUser: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700" htmlFor="void-sale-admin-code">
                    PIN admin
                  </label>
                  <input
                    id="void-sale-admin-code"
                    type="password"
                    autoComplete="off"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
                    value={voidSaleForm.adminCode}
                    onChange={(e) => setVoidSaleForm((f) => ({ ...f, adminCode: e.target.value }))}
                  />
                </div>
              </div>
              {voidSaleError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {voidSaleError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  onClick={closeVoidSaleModal}
                  disabled={voidSaleBusy}
                >
                  Cancelar
                </button>
                <button
                  className="h-10 px-3 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:bg-red-300"
                  onClick={confirmVoidSale}
                  disabled={voidSaleBusy}
                >
                  {voidSaleBusy ? "Anulando..." : "Anular venta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {voidTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-200">
              <div className="text-sm font-semibold text-red-800">Anular factura</div>
              <div className="text-xs text-red-700/80">
                Esta acción anula el comprobante y no se puede deshacer.
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-0.5">
                <div>Documento: {voidTarget.consecutive || "-"}</div>
                <div>Mesa: {voidTarget.order?.tableId || "-"}</div>
                <div>
                  Total: {formatMoneyWithCurrency(voidTarget.order?.total, voidTarget.order?.currency || "")}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="void-reason">
                  Motivo (obligatorio)
                </label>
                <textarea
                  id="void-reason"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  rows={3}
                  value={voidForm.reason}
                  onChange={(e) => setVoidForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700" htmlFor="void-admin-user">
                    Usuario autoriza
                  </label>
                  <input
                    id="void-admin-user"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
                    value={voidForm.adminUser}
                    onChange={(e) => setVoidForm((f) => ({ ...f, adminUser: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700" htmlFor="void-admin-code">
                    PIN admin
                  </label>
                  <input
                    id="void-admin-code"
                    type="password"
                    autoComplete="off"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
                    value={voidForm.adminCode}
                    onChange={(e) => setVoidForm((f) => ({ ...f, adminCode: e.target.value }))}
                  />
                </div>
              </div>
              {voidError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {voidError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  className="h-10 px-3 rounded-lg border border-slate-200 text-sm"
                  onClick={closeVoidInvoiceModal}
                  disabled={voidBusy}
                >
                  Cancelar
                </button>
                <button
                  className="h-10 px-3 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:bg-red-300"
                  onClick={confirmVoidInvoice}
                  disabled={voidBusy}
                >
                  {voidBusy ? "Anulando..." : "Anular factura"}
                </button>
              </div>
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
