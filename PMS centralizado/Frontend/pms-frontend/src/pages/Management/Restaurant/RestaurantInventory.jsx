import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const formatPhone = (countryCode, number) => {
  const cc = String(countryCode || "").trim();
  const num = String(number || "").trim();
  if (!cc && !num) return "";
  if (!cc) return num;
  const normalizedCc = cc.startsWith("+") ? cc : `+${cc}`;
  return [normalizedCc, num].filter(Boolean).join(" ").trim();
};

const normalizeXmlUnit = (raw) => {
  const unit = String(raw || "").trim();
  if (!unit) return "";
  const lower = unit.toLowerCase();
  if (["unid", "unidad", "und", "u"].includes(lower)) return "un";
  return lower;
};

const parseXmlPreview = async (file, invalidXmlMessage) => {
  const xml = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error(invalidXmlMessage || "XML invalido");
  }
  const getFirstByLocalName = (root, name) =>
    root ? root.getElementsByTagNameNS("*", name)[0] || null : null;
  const safeText = (node) => (node && typeof node.textContent === "string" ? node.textContent.trim() : "");
  const getChildText = (root, name) => {
    if (!root || !root.childNodes) return "";
    for (const n of root.childNodes) {
      if (n && n.localName === name) return safeText(n);
    }
    return "";
  };
  const emisorNode = getFirstByLocalName(doc, "Emisor");
  const supplierCommercialName = getChildText(emisorNode, "NombreComercial") || "";
  const supplierLegalName = getChildText(emisorNode, "Nombre") || "";
  const supplierName = supplierCommercialName || supplierLegalName || "";
  const supplierIdNode = getFirstByLocalName(emisorNode, "Identificacion");
  const supplierLegalId = getChildText(supplierIdNode, "Numero") || "";
  const supplierPhoneNode = getFirstByLocalName(emisorNode, "Telefono");
  const supplierPhone = formatPhone(
    getChildText(supplierPhoneNode, "CodigoPais"),
    getChildText(supplierPhoneNode, "NumTelefono")
  );
  const supplierEmail = getChildText(emisorNode, "CorreoElectronico") || "";
  const supplierLocationNode = getFirstByLocalName(emisorNode, "Ubicacion");
  const supplierAddress = [
    getChildText(supplierLocationNode, "Provincia"),
    getChildText(supplierLocationNode, "Canton"),
    getChildText(supplierLocationNode, "Distrito"),
    getChildText(supplierLocationNode, "Barrio"),
    getChildText(supplierLocationNode, "OtrasSenas"),
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
  const docNumber =
    safeText(getFirstByLocalName(doc, "NumeroConsecutivo")) ||
    safeText(getFirstByLocalName(doc, "NumeroConsecutivoComprobante")) ||
    "";
  const issueDate =
    safeText(getFirstByLocalName(doc, "FechaEmision")) ||
    safeText(getFirstByLocalName(doc, "FechaEmisionComprobante")) ||
    "";
  const detalleServicio = getFirstByLocalName(doc, "DetalleServicio");
  const lineNodes = detalleServicio
    ? Array.from(detalleServicio.getElementsByTagNameNS("*", "LineaDetalle"))
    : Array.from(doc.getElementsByTagNameNS("*", "LineaDetalle"));
  const lines = lineNodes.map((line) => {
    const sku =
      getChildText(line, "Codigo") ||
      getChildText(getFirstByLocalName(line, "CodigoComercial"), "Codigo") ||
      "";
    const name = getChildText(line, "Detalle") || getChildText(line, "Descripcion") || "";
    const qty = getChildText(line, "Cantidad") || "0";
    const unit = normalizeXmlUnit(getChildText(line, "UnidadMedida") || getChildText(line, "Unidad"));
    const cost = getChildText(line, "PrecioUnitario") || getChildText(line, "Precio") || "";
    const taxRate = getChildText(getFirstByLocalName(line, "Impuesto"), "Tarifa") || getChildText(line, "Tarifa") || "";
    return { sku, name, qty, unit, cost, taxRate };
  });
  const resumenNode = getFirstByLocalName(doc, "ResumenFactura");
  const monedaNode = getFirstByLocalName(resumenNode, "CodigoTipoMoneda");
  const currency = getChildText(monedaNode, "CodigoMoneda") || "";
  const exchangeRate = getChildText(monedaNode, "TipoCambio") || "";
  const totalComprobante = getChildText(resumenNode, "TotalComprobante") || "";
  const totalImpuesto = getChildText(resumenNode, "TotalImpuesto") || "";
  const totalVenta = getChildText(resumenNode, "TotalVenta") || "";
  return {
    xml,
    supplierName,
    supplierCommercialName,
    supplierLegalName,
    supplierLegalId,
    supplierPhone,
    supplierEmail,
    supplierAddress,
    docNumber,
    issueDate,
    currency,
    exchangeRate,
    totals: {
      totalComprobante,
      totalImpuesto,
      totalVenta,
    },
    lines: lines.filter((l) => l.name || l.sku),
  };
};

const emptyLine = () => ({
  sku: "",
  name: "",
  qty: "",
  unit: "",
  cost: "",
  taxRate: "13",
});

export default function RestaurantInventory() {
  const { t } = useLanguage();
  const unitOptions = useMemo(
    () => [
      { label: t("mgmt.restaurant.inventory.units.unit"), value: "un" },
      { label: t("mgmt.restaurant.inventory.units.grams"), value: "g" },
      { label: t("mgmt.restaurant.inventory.units.kilograms"), value: "kg" },
      { label: t("mgmt.restaurant.inventory.units.pounds"), value: "lb" },
      { label: t("mgmt.restaurant.inventory.units.milliliters"), value: "ml" },
      { label: t("mgmt.restaurant.inventory.units.liters"), value: "l" },
      { label: t("mgmt.restaurant.inventory.units.ounces"), value: "oz" },
    ],
    [t]
  );
  const taxOptions = useMemo(
    () => [
      { label: t("mgmt.restaurant.inventory.tax.iva13"), value: "13" },
      { label: t("mgmt.restaurant.inventory.tax.iva1"), value: "1" },
      { label: t("mgmt.restaurant.inventory.tax.exempt"), value: "0" },
    ],
    [t]
  );
  const tabs = useMemo(
    () => [
      { id: "settings", label: t("mgmt.restaurant.inventory.tabs.settings") },
      { id: "manual", label: t("mgmt.restaurant.inventory.tabs.manual") },
      { id: "items", label: t("mgmt.restaurant.inventory.tabs.items") },
      { id: "invoices", label: t("mgmt.restaurant.inventory.tabs.invoices") },
    ],
    [t]
  );
  const [inventory, setInventory] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [xmlBusy, setXmlBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [xmlPreview, setXmlPreview] = useState(null);
  const [xmlError, setXmlError] = useState("");
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [controlMode, setControlMode] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("CRC");

  const [invoiceForm, setInvoiceForm] = useState({
    supplierName: "",
    supplierLegalName: "",
    supplierCommercialName: "",
    supplierLegalId: "",
    supplierPhone: "",
    supplierEmail: "",
    supplierAddress: "",
    docNumber: "",
    issueDate: "",
    lines: [emptyLine()],
  });

  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const reloadAll = async () => {
    setLoading(true);
    try {
      const [invRes, invoicesRes, generalRes, paymentsRes] = await Promise.allSettled([
        api.get("/restaurant/inventory"),
        api.get("/restaurant/inventory/invoices"),
        api.get("/restaurant/general"),
        api.get("/restaurant/payments"),
      ]);
      if (invRes.status === "fulfilled" && Array.isArray(invRes.value?.data)) {
        setInventory(invRes.value.data);
      }
      if (invoicesRes.status === "fulfilled" && Array.isArray(invoicesRes.value?.data)) {
        setInvoices(invoicesRes.value.data);
      }
      if (generalRes.status === "fulfilled" && generalRes.value?.data && typeof generalRes.value.data === "object") {
        const enabled = generalRes.value.data.inventoryEnabled !== false;
        setInventoryEnabled(enabled);
      }
      if (paymentsRes.status === "fulfilled" && paymentsRes.value?.data) {
        const configured = String(paymentsRes.value.data?.monedaBase || "CRC").toUpperCase();
        setBaseCurrency(configured || "CRC");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll().catch(() => {});
  }, []);

  const updateLine = (idx, field, value) => {
    setInvoiceForm((prev) => {
      const nextLines = prev.lines.map((line, i) => (i === idx ? { ...line, [field]: value } : line));
      return { ...prev, lines: nextLines };
    });
  };

  const addLine = () => {
    setInvoiceForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  };

  const removeLine = (idx) => {
    setInvoiceForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== idx) }));
  };

  const validLines = useMemo(
    () =>
      invoiceForm.lines.filter(
        (l) => String(l.name || "").trim() && Number(l.qty || 0) > 0 && String(l.unit || "").trim()
      ),
    [invoiceForm.lines]
  );

  const saveInvoice = async () => {
    if (savingInvoice) return;
    if (!invoiceForm.supplierName.trim()) return window.alert(t("mgmt.restaurant.inventory.alerts.supplierRequired"));
    if (validLines.length === 0) return window.alert(t("mgmt.restaurant.inventory.alerts.linesRequired"));
    setSavingInvoice(true);
    try {
      await api.post("/restaurant/inventory/invoices", {
        supplierName: invoiceForm.supplierName,
        supplierLegalName: invoiceForm.supplierLegalName || undefined,
        supplierCommercialName: invoiceForm.supplierCommercialName || undefined,
        supplierLegalId: invoiceForm.supplierLegalId || undefined,
        supplierPhone: invoiceForm.supplierPhone || undefined,
        supplierEmail: invoiceForm.supplierEmail || undefined,
        supplierAddress: invoiceForm.supplierAddress || undefined,
        docNumber: invoiceForm.docNumber || undefined,
        issueDate: invoiceForm.issueDate || undefined,
        lines: validLines.map((l) => ({
          sku: l.sku,
          name: l.name,
          qty: l.qty,
          unit: l.unit,
          cost: l.cost,
          taxRate: l.taxRate,
        })),
      });
      setInvoiceForm({
        supplierName: "",
        supplierLegalName: "",
        supplierCommercialName: "",
        supplierLegalId: "",
        supplierPhone: "",
        supplierEmail: "",
        supplierAddress: "",
        docNumber: "",
        issueDate: "",
        lines: [emptyLine()],
      });
      await reloadAll();
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", {
          detail: {
            title: t("mgmt.restaurant.inventory.alerts.title"),
            desc: t("mgmt.restaurant.inventory.alerts.invoiceSaved"),
          },
        })
      );
    } catch (err) {
      window.alert(err?.response?.data?.message || t("mgmt.restaurant.inventory.alerts.invoiceSaveFailed"));
    } finally {
      setSavingInvoice(false);
    }
  };

  const importXml = async (file) => {
    if (!file || xmlBusy) return;
    setXmlBusy(true);
    try {
      const preview = await parseXmlPreview(file, t("mgmt.restaurant.inventory.alerts.xmlInvalid"));
      setXmlPreview(preview);
      setXmlError("");
    } catch (err) {
      setXmlPreview(null);
      setXmlError(err?.message || t("mgmt.restaurant.inventory.alerts.xmlReadFailed"));
    } finally {
      setXmlBusy(false);
    }
  };

  const applyXmlToManual = () => {
    if (!xmlPreview) return;
    const nextLines =
      xmlPreview.lines && xmlPreview.lines.length > 0
        ? xmlPreview.lines.map((l) => ({
            sku: l.sku || "",
            name: l.name || "",
            qty: l.qty || "",
            unit: l.unit || "",
            cost: l.cost || "",
            taxRate: l.taxRate || "13",
          }))
        : [emptyLine()];
    setInvoiceForm({
      supplierName: xmlPreview.supplierName || "",
      supplierLegalName: xmlPreview.supplierLegalName || "",
      supplierCommercialName: xmlPreview.supplierCommercialName || "",
      supplierLegalId: xmlPreview.supplierLegalId || "",
      supplierPhone: xmlPreview.supplierPhone || "",
      supplierEmail: xmlPreview.supplierEmail || "",
      supplierAddress: xmlPreview.supplierAddress || "",
      docNumber: xmlPreview.docNumber || "",
      issueDate: xmlPreview.issueDate ? String(xmlPreview.issueDate).slice(0, 10) : "",
      lines: nextLines,
    });
    setXmlPreview(null);
    setActiveTab("manual");
  };

  const saveInventoryEnabled = async (nextValue) => {
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      const { data } = await api.get("/restaurant/general");
      const current = data && typeof data === "object" ? data : {};
      const payload = { ...current, inventoryEnabled: nextValue };
      await api.put("/restaurant/general", payload);
      setInventoryEnabled(nextValue);
    } catch {
      // ignore
    } finally {
      setSavingConfig(false);
    }
  };

  const updateInventoryControl = async (id, nextValue) => {
    try {
      await api.patch(`/restaurant/inventory/${id}`, { inventoryControlled: nextValue });
      setInventory((prev) =>
        prev.map((i) => (i.id === id ? { ...i, inventoryControlled: nextValue } : i))
      );
    } catch (err) {
      window.alert(err?.response?.data?.message || t("mgmt.restaurant.inventory.alerts.inventoryControlFailed"));
    }
  };

  const toggleInvoiceSelection = (id) => {
    setSelectedInvoiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearInvoiceSelection = () => setSelectedInvoiceIds([]);

  const getInvoiceDisplayTotal = (inv) => {
    return (
      inv?.totalFromXml ||
      inv?.totalSaleFromXml ||
      inv?.total ||
      0
    );
  };

  const getInvoiceDisplayTax = (inv) => {
    return inv?.taxTotalFromXml || inv?.taxTotal || 0;
  };

  const getInvoiceDisplayDiscount = (inv) => {
    return (
      inv?.discountTotalFromXml ||
      inv?.totalDiscountFromXml ||
      inv?.discountFromXml ||
      inv?.discountTotal ||
      inv?.discountAmount ||
      inv?.discount ||
      inv?.descuento ||
      0
    );
  };

  const getInvoiceCurrency = (inv) => {
    return String(inv?.currency || baseCurrency || "CRC").toUpperCase();
  };

  const formatAmountWithCurrency = (amount, currencyCode) => {
    const parsed = Number(amount || 0);
    const safeAmount = Number.isFinite(parsed) ? parsed.toFixed(2) : String(amount || 0);
    const code = String(currencyCode || baseCurrency || "CRC").toUpperCase();
    return `${code} ${safeAmount}`;
  };

  const escapeHtml = (raw) =>
    String(raw || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const getInvoiceSupplierMeta = (inv) => {
    const supplierObj = inv?.supplier && typeof inv.supplier === "object" ? inv.supplier : {};
    const supplierInfoObj = inv?.supplierInfo && typeof inv.supplierInfo === "object" ? inv.supplierInfo : {};
    const emisorObj = inv?.emisor && typeof inv.emisor === "object" ? inv.emisor : {};
    const supplierIdObj =
      supplierObj?.identification && typeof supplierObj.identification === "object" ? supplierObj.identification : {};
    const emisorIdObj =
      emisorObj?.identificacion && typeof emisorObj.identificacion === "object" ? emisorObj.identificacion : {};
    const supplierPhoneObj = supplierObj?.phone && typeof supplierObj.phone === "object" ? supplierObj.phone : {};
    const emisorPhoneObj = emisorObj?.telefono && typeof emisorObj.telefono === "object" ? emisorObj.telefono : {};
    const supplierAddressObj =
      supplierObj?.address && typeof supplierObj.address === "object" ? supplierObj.address : {};
    const emisorAddressObj =
      emisorObj?.direccion && typeof emisorObj.direccion === "object" ? emisorObj.direccion : {};
    const joinAddressObject = (obj) =>
      [
        obj?.province || obj?.provincia,
        obj?.canton,
        obj?.district || obj?.distrito,
        obj?.neighborhood || obj?.barrio,
        obj?.otherSigns || obj?.otrasSenas,
      ]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(", ");
    const legalName = firstNonEmpty(
      inv?.supplierLegalName,
      inv?.legalName,
      inv?.razonSocial,
      inv?.nombreLegal,
      supplierObj?.legalName,
      supplierInfoObj?.legalName,
      emisorObj?.nombre,
      inv?.supplierName,
      inv?.proveedor
    );
    const commercialName = firstNonEmpty(
      inv?.supplierCommercialName,
      inv?.commercialName,
      inv?.nombreComercial,
      supplierObj?.commercialName,
      supplierInfoObj?.commercialName,
      emisorObj?.nombreComercial
    );
    const legalId = firstNonEmpty(
      inv?.supplierLegalId,
      inv?.legalId,
      inv?.taxId,
      inv?.fiscalId,
      inv?.cedulaJuridica,
      inv?.cedula,
      inv?.identificacion,
      supplierObj?.legalId,
      supplierInfoObj?.legalId,
      emisorObj?.identificacion,
      supplierIdObj?.number,
      supplierIdObj?.numero,
      emisorIdObj?.number,
      emisorIdObj?.numero
    );
    const email = firstNonEmpty(
      inv?.supplierEmail,
      inv?.email,
      inv?.correo,
      inv?.correoElectronico,
      supplierObj?.email,
      supplierInfoObj?.email,
      emisorObj?.correoElectronico
    );
    const phone = firstNonEmpty(
      inv?.supplierPhone,
      inv?.phone,
      inv?.telefono,
      inv?.telefonoProveedor,
      supplierObj?.phone,
      supplierInfoObj?.phone,
      emisorObj?.telefono,
      formatPhone(supplierPhoneObj?.countryCode || supplierPhoneObj?.codigoPais, supplierPhoneObj?.number || supplierPhoneObj?.numTelefono),
      formatPhone(emisorPhoneObj?.countryCode || emisorPhoneObj?.codigoPais, emisorPhoneObj?.number || emisorPhoneObj?.numTelefono)
    );
    const address = firstNonEmpty(
      inv?.supplierAddress,
      inv?.address,
      inv?.direccion,
      inv?.direccionProveedor,
      supplierObj?.address,
      supplierInfoObj?.address,
      emisorObj?.direccion,
      joinAddressObject(supplierAddressObj),
      joinAddressObject(emisorAddressObj)
    );
    const displayName = firstNonEmpty(commercialName, legalName, inv?.supplierName, inv?.proveedor);
    return { displayName, legalName, commercialName, legalId, email, phone, address };
  };

  const renderInvoicePrintHtml = (inv) => {
    const lines = Array.isArray(inv?.lines) ? inv.lines : [];
    const title = `${t("mgmt.restaurant.inventory.print.invoiceTitle")} ${inv?.docNumber || inv?.id || ""}`.trim();
    const total = getInvoiceDisplayTotal(inv);
    const iva = getInvoiceDisplayTax(inv);
    const discount = getInvoiceDisplayDiscount(inv);
    const currency = getInvoiceCurrency(inv);
    const tc = inv?.exchangeRate || "";
    const issueDate = inv?.issueDate ? new Date(inv.issueDate).toLocaleString() : "";
    const supplierMeta = getInvoiceSupplierMeta(inv);
    const supplierName = supplierMeta.displayName || "-";
    const legalName =
      supplierMeta.legalName && supplierMeta.legalName !== supplierName ? supplierMeta.legalName : "";
    const commercialName =
      supplierMeta.commercialName && supplierMeta.commercialName !== supplierName
        ? supplierMeta.commercialName
        : "";
    const supplierInfoRows = [
      [t("mgmt.restaurant.inventory.labels.supplier"), supplierName],
      [t("mgmt.restaurant.inventory.labels.legalName"), legalName],
      [t("mgmt.restaurant.inventory.labels.commercialName"), commercialName],
      [t("mgmt.restaurant.inventory.labels.legalId"), supplierMeta.legalId],
      [t("mgmt.restaurant.inventory.labels.email"), supplierMeta.email],
      [t("mgmt.restaurant.inventory.labels.phone"), supplierMeta.phone],
      [t("mgmt.restaurant.inventory.labels.address"), supplierMeta.address],
    ].filter(([, value]) => String(value || "").trim());
    const supplierInfoHtml = supplierInfoRows
      .map(
        ([label, value]) =>
          `<div style="font-size:12px;color:#444;line-height:1.35;"><strong style="color:#111;">${escapeHtml(
            label
          )}:</strong> ${escapeHtml(value)}</div>`
      )
      .join("");
    return `
      <section style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="max-width:66%;">
            <div style="font-size:18px;font-weight:700;">${title}</div>
            <div style="margin-top:6px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;">
              ${supplierInfoHtml || `<div style="font-size:12px;color:#555;">-</div>`}
            </div>
          </div>
          <div style="text-align:right;font-size:12px;color:#555;min-width:240px;">
            <div><strong style="color:#111;">${t("mgmt.restaurant.inventory.labels.doc")}:</strong> ${escapeHtml(inv?.docNumber || inv?.id || "-")}</div>
            <div><strong style="color:#111;">${t("mgmt.restaurant.inventory.labels.date")}:</strong> ${escapeHtml(issueDate || "-")}</div>
            <div><strong style="color:#111;">${t("mgmt.restaurant.inventory.labels.currency")}:</strong> ${escapeHtml(currency || "-")}</div>
            <div><strong style="color:#111;">${t("mgmt.restaurant.inventory.labels.exchangeRate")}:</strong> ${escapeHtml(tc || "-")}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:left;">${t("mgmt.restaurant.inventory.columns.sku")}</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:left;">${t("mgmt.restaurant.inventory.columns.item")}</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">${t("mgmt.restaurant.inventory.columns.qty")}</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:left;">${t("mgmt.restaurant.inventory.columns.unit")}</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">${t("mgmt.restaurant.inventory.columns.cost")}</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">${t("mgmt.restaurant.inventory.columns.tax")}</th>
            </tr>
          </thead>
          <tbody>
            ${lines
              .map(
                (l) => `
              <tr>
                <td style="border-bottom:1px solid #f0f0f0;padding:6px;">${l.sku || "-"}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:6px;">${l.name || "-"}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:6px;text-align:right;">${l.qty || 0}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:6px;">${l.unit || ""}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:6px;text-align:right;">${l.cost || 0}</td>
                <td style="border-bottom:1px solid #f0f0f0;padding:6px;text-align:right;">${l.taxRate || "-"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-top:14px;">
          <div style="min-width:280px;max-width:360px;border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fafafa;">
            <div style="display:flex;justify-content:space-between;gap:16px;font-size:13px;color:#555;">
              <span>${t("mgmt.restaurant.inventory.labels.discount")}</span>
              <strong>${formatAmountWithCurrency(discount, currency)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-top:6px;font-size:13px;color:#555;">
              <span>${t("mgmt.restaurant.inventory.labels.tax")}</span>
              <strong>${formatAmountWithCurrency(iva, currency)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-top:8px;padding-top:8px;border-top:1px solid #ddd;font-size:17px;font-weight:700;color:#111;">
              <span>${t("mgmt.restaurant.inventory.labels.total")}</span>
              <span>${formatAmountWithCurrency(total, currency)}</span>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  const printInvoices = (ids = []) => {
    const toPrint = (invoices || []).filter((i) => ids.includes(i.id));
    if (toPrint.length === 0) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const body = toPrint.map(renderInvoicePrintHtml).join("<hr style='border:none;border-top:1px solid #ddd;margin:24px 0;' />");
    win.document.write(`
      <html>
        <head>
          <title>${t("mgmt.restaurant.inventory.print.title")}</title>
        </head>
        <body style="font-family:Arial, sans-serif; color:#111; padding:24px;">
          ${body}
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "settings":
        return (
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inventoryEnabled}
                onChange={(e) => saveInventoryEnabled(e.target.checked)}
                disabled={savingConfig}
              />
              {t("mgmt.restaurant.inventory.settings.enable")}
            </label>
            {!inventoryEnabled && (
              <div className="text-xs text-amber-600">
                {t("mgmt.restaurant.inventory.settings.disabledNote")}
              </div>
            )}
          </div>
        );
      case "items":
        return (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">{t("mgmt.restaurant.inventory.items.title")}</div>
              <div className="text-xs text-gray-500">{t("mgmt.restaurant.inventory.items.subtitle")}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setControlMode((v) => !v)}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                  controlMode ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50"
                }`}
              >
                {t("mgmt.restaurant.inventory.items.control")}
              </button>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("pms:push-alert", {
                      detail: { title: t("mgmt.restaurant.inventory.alerts.title"), desc: t("mgmt.restaurant.inventory.items.adjustmentsSoon") },
                    })
                  )
                }
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold hover:bg-slate-50"
              >
                {t("mgmt.restaurant.inventory.items.adjustments")}
              </button>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("pms:push-alert", {
                      detail: { title: t("mgmt.restaurant.inventory.alerts.title"), desc: t("mgmt.restaurant.inventory.items.countSoon") },
                    })
                  )
                }
                className="px-4 py-2 rounded-lg border bg-white text-sm font-semibold hover:bg-slate-50"
              >
                {t("mgmt.restaurant.inventory.items.count")}
              </button>
            </div>
            {loading ? (
              <div className="text-sm text-gray-500">{t("common.loading")}</div>
            ) : inventory.length === 0 ? (
              <div className="text-sm text-gray-500">{t("mgmt.restaurant.inventory.items.empty")}</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {controlMode && <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.control")}</th>}
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.sku")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.item")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.stock")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.min")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.unit")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.cost")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.tax")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.supplier")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((i, idx) => (
                        <tr
                          key={i.id}
                          className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${
                            i.inventoryControlled === false ? "text-slate-400" : ""
                          }`}
                        >
                          {controlMode && (
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                className="accent-lime-600"
                                checked={i.inventoryControlled !== false}
                                onChange={(e) => updateInventoryControl(i.id, e.target.checked)}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2">{i.sku || "-"}</td>
                          <td className="px-3 py-2">{i.desc || i.descripcion || "-"}</td>
                          <td className="px-3 py-2">{i.inventoryControlled === false ? 0 : i.stock || 0}</td>
                          <td className="px-3 py-2">{i.minimo || i.min || 0}</td>
                          <td className="px-3 py-2">{i.unit || i.unidad || ""}</td>
                          <td className="px-3 py-2">{i.cost || i.costo || 0}</td>
                          <td className="px-3 py-2">{i.taxRate ?? "-"}</td>
                          <td className="px-3 py-2">{i.supplierName || i.proveedor || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case "invoices":
        return (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">{t("mgmt.restaurant.inventory.invoices.title")}</div>
            </div>
            {selectedInvoiceIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-slate-600">
                  {t("mgmt.restaurant.inventory.invoices.selected")}{" "}
                  <span className="font-semibold">{selectedInvoiceIds.length}</span>
                </div>
                <Button onClick={() => printInvoices(selectedInvoiceIds)}>
                  {t("mgmt.restaurant.inventory.invoices.printSelected")}
                </Button>
                <Button variant="outline" onClick={clearInvoiceSelection}>
                  {t("mgmt.restaurant.inventory.invoices.clearSelection")}
                </Button>
              </div>
            )}
            {invoices.length === 0 ? (
              <div className="text-sm text-gray-500">{t("mgmt.restaurant.inventory.invoices.empty")}</div>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="border rounded-lg px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center text-xs text-slate-600">
                        <input
                          type="checkbox"
                          className="accent-lime-600"
                          checked={selectedInvoiceIds.includes(inv.id)}
                          onChange={() => toggleInvoiceSelection(inv.id)}
                          aria-label={t("mgmt.restaurant.inventory.invoices.select")}
                        />
                      </label>
                      <div className="font-semibold flex-1 min-w-[220px]">
                        {(getInvoiceSupplierMeta(inv).displayName || inv.proveedor || inv.supplierName)} {inv.docNumber ? `- ${inv.docNumber}` : ""}
                      </div>
                      <div className="text-xs text-gray-500 ml-auto">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ""}
                      </div>
                      <Button variant="outline" onClick={() => setPreviewInvoice(inv)}>
                        {t("mgmt.restaurant.inventory.invoices.view")}
                      </Button>
                    </div>
                    <div className="text-xs text-gray-600">
                      {t("mgmt.restaurant.inventory.labels.total")}: {formatAmountWithCurrency(getInvoiceDisplayTotal(inv), getInvoiceCurrency(inv))} |{" "}
                      {t("mgmt.restaurant.inventory.labels.tax")}: {formatAmountWithCurrency(getInvoiceDisplayTax(inv), getInvoiceCurrency(inv))} |{" "}
                      {inv.source || t("mgmt.restaurant.inventory.invoices.sourceManual")}
                    </div>
                    {(inv.currency || inv.exchangeRate || inv.totalFromXml || inv.taxTotalFromXml || inv.totalSaleFromXml) && (
                      <div className="text-xs text-gray-600">
                        {t("mgmt.restaurant.inventory.labels.currency")}: {inv.currency || "-"} |{" "}
                        {t("mgmt.restaurant.inventory.labels.exchangeRate")}: {inv.exchangeRate || "-"} |{" "}
                        {t("mgmt.restaurant.inventory.invoices.totalXml")}: {inv.totalFromXml || "-"} |{" "}
                        {t("mgmt.restaurant.inventory.invoices.taxXml")}: {inv.taxTotalFromXml || "-"} |{" "}
                        {t("mgmt.restaurant.inventory.invoices.saleXml")}: {inv.totalSaleFromXml || "-"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
        );
      case "manual":
      default:
        return (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold">{t("mgmt.restaurant.inventory.manual.title")}</div>
              <div className="text-xs text-gray-500">{t("mgmt.restaurant.inventory.manual.subtitle")}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setXmlModalOpen(true)}>
                {t("mgmt.restaurant.inventory.manual.loadXml")}
              </Button>
              {xmlPreview && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  {t("mgmt.restaurant.inventory.labels.supplier")}: 
                  <span className="font-semibold">{xmlPreview.supplierName || "-"}</span>  -  
                  {t("mgmt.restaurant.inventory.labels.doc")}: 
                  <span className="font-semibold">{xmlPreview.docNumber || "-"}</span>  -  
                  {t("mgmt.restaurant.inventory.labels.date")}: 
                  <span className="font-semibold">{xmlPreview.issueDate || "-"}</span>
                </div>
                {(xmlPreview.supplierLegalId || xmlPreview.supplierEmail || xmlPreview.supplierPhone || xmlPreview.supplierAddress || xmlPreview.supplierLegalName || xmlPreview.supplierCommercialName) && (
                  <div className="text-xs text-slate-600">
                    {xmlPreview.supplierLegalName && (
                      <>
                        {t("mgmt.restaurant.inventory.labels.legalName")}:{" "}
                        <span className="font-semibold">{xmlPreview.supplierLegalName}</span>  -  
                      </>
                    )}
                    {xmlPreview.supplierCommercialName && (
                      <>
                        {t("mgmt.restaurant.inventory.labels.commercialName")}:{" "}
                        <span className="font-semibold">{xmlPreview.supplierCommercialName}</span>  -  
                      </>
                    )}
                    {xmlPreview.supplierLegalId && (
                      <>
                        {t("mgmt.restaurant.inventory.labels.legalId")}:{" "}
                        <span className="font-semibold">{xmlPreview.supplierLegalId}</span>  -  
                      </>
                    )}
                    {xmlPreview.supplierEmail && (
                      <>
                        {t("mgmt.restaurant.inventory.labels.email")}:{" "}
                        <span className="font-semibold">{xmlPreview.supplierEmail}</span>  -  
                      </>
                    )}
                    {xmlPreview.supplierPhone && (
                      <>
                        {t("mgmt.restaurant.inventory.labels.phone")}:{" "}
                        <span className="font-semibold">{xmlPreview.supplierPhone}</span>  -  
                      </>
                    )}
                    {xmlPreview.supplierAddress && (
                      <>
                        {t("mgmt.restaurant.inventory.labels.address")}:{" "}
                        <span className="font-semibold">{xmlPreview.supplierAddress}</span>
                      </>
                    )}
                  </div>
                )}
                <div className="text-xs text-slate-600">
                  {t("mgmt.restaurant.inventory.labels.currency")}: 
                  <span className="font-semibold">{xmlPreview.currency || "-"}</span>  -  
                  {t("mgmt.restaurant.inventory.labels.exchangeRate")}: 
                  <span className="font-semibold">{xmlPreview.exchangeRate || "-"}</span>  -  
                  {t("mgmt.restaurant.inventory.labels.total")}: 
                  <span className="font-semibold">{xmlPreview.totals?.totalComprobante || "-"}</span>  -  
                  {t("mgmt.restaurant.inventory.labels.tax")}: 
                  <span className="font-semibold">{xmlPreview.totals?.totalImpuesto || "-"}</span>  -  
                  {t("mgmt.restaurant.inventory.labels.sale")}: 
                  <span className="font-semibold">{xmlPreview.totals?.totalVenta || "-"}</span>
                </div>
                {xmlPreview.lines.length === 0 ? (
                  <div className="text-sm text-gray-500">{t("mgmt.restaurant.inventory.manual.xmlNoLines")}</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.sku")}</th>
                            <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.item")}</th>
                            <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.qty")}</th>
                            <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.unit")}</th>
                            <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.cost")}</th>
                            <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.tax")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {xmlPreview.lines.map((l, idx) => (
                            <tr key={`${l.sku}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                              <td className="px-3 py-2">{l.sku || "-"}</td>
                              <td className="px-3 py-2">{l.name || "-"}</td>
                              <td className="px-3 py-2">{l.qty || 0}</td>
                              <td className="px-3 py-2">{l.unit || ""}</td>
                              <td className="px-3 py-2">{l.cost || 0}</td>
                              <td className="px-3 py-2">{l.taxRate || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={applyXmlToManual} disabled={xmlBusy || xmlPreview.lines.length === 0}>
                    {t("mgmt.restaurant.inventory.actions.applyXml")}
                  </Button>
                  <Button variant="outline" onClick={() => setXmlPreview(null)} disabled={xmlBusy}>
                    {t("common.clear")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        );
    }
  };

  const previewSupplierMeta = previewInvoice ? getInvoiceSupplierMeta(previewInvoice) : null;
  const previewSupplierName =
    previewSupplierMeta?.displayName || previewInvoice?.proveedor || previewInvoice?.supplierName || "-";

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b">
          <div className="text-lg font-semibold">{t("mgmt.restaurant.inventory.title")}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold border rounded-t-lg transition ${
                  activeTab === tab.id
                    ? "bg-white border-b-white text-slate-900"
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">{renderTabContent()}</div>
      </Card>
      {previewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-[1200px] h-[90vh] rounded-2xl border border-lime-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-lime-100">
              <div className="flex items-center gap-3">
                <div className="text-lg font-semibold text-lime-800">{t("mgmt.restaurant.inventory.preview.title")}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => printInvoices([previewInvoice.id])}
                >
                  {t("mgmt.restaurant.inventory.actions.print")}
                </button>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setPreviewInvoice(null)}
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto h-[calc(90vh-72px)] space-y-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[340px] rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-base font-semibold">{previewSupplierName}</div>
                  {previewSupplierMeta?.legalName && previewSupplierMeta.legalName !== previewSupplierName && (
                    <div className="text-xs text-slate-600">
                      {t("mgmt.restaurant.inventory.labels.legalName")}: {previewSupplierMeta.legalName}
                    </div>
                  )}
                  {previewSupplierMeta?.commercialName && previewSupplierMeta.commercialName !== previewSupplierName && (
                    <div className="text-xs text-slate-600">
                      {t("mgmt.restaurant.inventory.labels.commercialName")}: {previewSupplierMeta.commercialName}
                    </div>
                  )}
                  {previewSupplierMeta?.legalId && (
                    <div className="text-xs text-slate-600">
                      {t("mgmt.restaurant.inventory.labels.legalId")}: {previewSupplierMeta.legalId}
                    </div>
                  )}
                  {previewSupplierMeta?.email && (
                    <div className="text-xs text-slate-600">
                      {t("mgmt.restaurant.inventory.labels.email")}: {previewSupplierMeta.email}
                    </div>
                  )}
                  {previewSupplierMeta?.phone && (
                    <div className="text-xs text-slate-600">
                      {t("mgmt.restaurant.inventory.labels.phone")}: {previewSupplierMeta.phone}
                    </div>
                  )}
                  {previewSupplierMeta?.address && (
                    <div className="text-xs text-slate-600">
                      {t("mgmt.restaurant.inventory.labels.address")}: {previewSupplierMeta.address}
                    </div>
                  )}
                </div>
                <div className="min-w-[280px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold">{t("mgmt.restaurant.inventory.labels.doc")}:</span> {previewInvoice.docNumber || previewInvoice.id || "-"}
                  </div>
                  <div>
                    <span className="font-semibold">{t("mgmt.restaurant.inventory.labels.date")}:</span>{" "}
                    {previewInvoice.issueDate ? new Date(previewInvoice.issueDate).toLocaleString() : "-"}
                  </div>
                  <div>
                    <span className="font-semibold">{t("mgmt.restaurant.inventory.labels.currency")}:</span> {getInvoiceCurrency(previewInvoice)}
                  </div>
                  <div>
                    <span className="font-semibold">{t("mgmt.restaurant.inventory.labels.exchangeRate")}:</span> {previewInvoice.exchangeRate || "-"}
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.sku")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.item")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.qty")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.unit")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.cost")}</th>
                        <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.inventory.columns.tax")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewInvoice.lines || []).map((l, idx) => (
                        <tr key={l.id || `${l.sku}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                          <td className="px-3 py-2">{l.sku || "-"}</td>
                          <td className="px-3 py-2">{l.name || "-"}</td>
                          <td className="px-3 py-2">{l.qty || 0}</td>
                          <td className="px-3 py-2">{l.unit || ""}</td>
                          <td className="px-3 py-2">{l.cost || 0}</td>
                          <td className="px-3 py-2">{l.taxRate || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <div className="flex items-center justify-between gap-4 text-sm text-slate-700">
                    <span>{t("mgmt.restaurant.inventory.labels.discount")}</span>
                    <span className="font-semibold">
                      {formatAmountWithCurrency(getInvoiceDisplayDiscount(previewInvoice), getInvoiceCurrency(previewInvoice))}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4 text-sm text-slate-700">
                    <span>{t("mgmt.restaurant.inventory.labels.tax")}</span>
                    <span className="font-semibold">
                      {formatAmountWithCurrency(getInvoiceDisplayTax(previewInvoice), getInvoiceCurrency(previewInvoice))}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-300 pt-2 text-xl font-bold text-slate-900">
                    <span>{t("mgmt.restaurant.inventory.labels.total")}</span>
                    <span>
                      {formatAmountWithCurrency(getInvoiceDisplayTotal(previewInvoice), getInvoiceCurrency(previewInvoice))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="text-base font-semibold">{t("mgmt.restaurant.inventory.manual.selectXml")}</div>
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300"
                onClick={() => setXmlModalOpen(false)}
              >
                {t("common.close")}
              </button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="text-xs text-slate-600">{t("mgmt.restaurant.inventory.manual.selectXmlHelp")}</div>
              <input
                type="file"
                accept=".xml,text/xml"
                disabled={xmlBusy}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (file) importXml(file);
                  setXmlModalOpen(false);
                }}
              />
              {xmlBusy && <div className="text-xs text-gray-500">{t("mgmt.restaurant.inventory.manual.importingXml")}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




