import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

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
  const supplierName = getChildText(emisorNode, "NombreComercial") || getChildText(emisorNode, "Nombre") || "";
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

  const [invoiceForm, setInvoiceForm] = useState({
    supplierName: "",
    docNumber: "",
    issueDate: "",
    lines: [emptyLine()],
  });

  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const reloadAll = async () => {
    setLoading(true);
    try {
      const [invRes, invoicesRes, generalRes] = await Promise.allSettled([
        api.get("/restaurant/inventory"),
        api.get("/restaurant/inventory/invoices"),
        api.get("/restaurant/general"),
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
      setInvoiceForm({ supplierName: "", docNumber: "", issueDate: "", lines: [emptyLine()] });
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

  const renderInvoicePrintHtml = (inv) => {
    const lines = Array.isArray(inv?.lines) ? inv.lines : [];
    const title = `${t("mgmt.restaurant.inventory.print.invoiceTitle")} ${inv?.docNumber || inv?.id || ""}`.trim();
    const total = getInvoiceDisplayTotal(inv);
    const iva = inv?.taxTotalFromXml || inv?.taxTotal || 0;
    const currency = inv?.currency || "";
    const tc = inv?.exchangeRate || "";
    const issueDate = inv?.issueDate ? new Date(inv.issueDate).toLocaleString() : "";
    const supplier = inv?.supplierName || inv?.proveedor || "";
    return `
      <section style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:18px;font-weight:700;">${title}</div>
            <div style="font-size:12px;color:#555;">${t("mgmt.restaurant.inventory.labels.supplier")}: ${supplier || "-"}</div>
            <div style="font-size:12px;color:#555;">${t("mgmt.restaurant.inventory.labels.date")}: ${issueDate || "-"}</div>
          </div>
          <div style="text-align:right;font-size:12px;color:#555;">
            <div>${t("mgmt.restaurant.inventory.labels.currency")}: ${currency || "-"}</div>
            <div>${t("mgmt.restaurant.inventory.labels.exchangeRate")}: ${tc || "-"}</div>
            <div>${t("mgmt.restaurant.inventory.labels.total")}: ${total || 0}</div>
            <div>${t("mgmt.restaurant.inventory.labels.tax")}: ${iva || 0}</div>
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
            <div className="text-sm text-gray-600">{t("mgmt.restaurant.inventory.settings.desc")}</div>
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
        );
      case "invoices":
        return (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">{t("mgmt.restaurant.inventory.invoices.title")}</div>
              <div className="text-xs text-gray-500">{t("mgmt.restaurant.inventory.invoices.subtitle")}</div>
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">
                        {inv.proveedor || inv.supplierName} {inv.docNumber ? `- ${inv.docNumber}` : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            className="accent-lime-600"
                            checked={selectedInvoiceIds.includes(inv.id)}
                            onChange={() => toggleInvoiceSelection(inv.id)}
                          />
                          {t("mgmt.restaurant.inventory.invoices.select")}
                        </label>
                        <Button variant="outline" onClick={() => setPreviewInvoice(inv)}>
                          {t("mgmt.restaurant.inventory.invoices.view")}
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {t("mgmt.restaurant.inventory.labels.total")}: {inv.total || 0} |{" "}
                      {t("mgmt.restaurant.inventory.labels.tax")}: {inv.taxTotal || 0} |{" "}
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
                    {Array.isArray(inv.lines) && inv.lines.length > 0 && (
                      <div className="mt-2 grid md:grid-cols-2 gap-1">
                        {inv.lines.map((l) => (
                          <div key={l.id} className="text-xs text-gray-600">
                            {l.qty} {l.unit} - {l.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b">
          <div className="text-lg font-semibold">{t("mgmt.restaurant.inventory.title")}</div>
          <div className="text-xs text-gray-500">{t("mgmt.restaurant.inventory.subtitle")}</div>
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
                <div>
                  <div className="text-base font-semibold">
                    {previewInvoice.proveedor || previewInvoice.supplierName || "-"}
                  </div>
                  <div className="text-xs text-slate-600">
                    {t("mgmt.restaurant.inventory.labels.doc")}: {previewInvoice.docNumber || "-"}  - {t("mgmt.restaurant.inventory.labels.date")}: 
                    {previewInvoice.issueDate ? new Date(previewInvoice.issueDate).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="text-xs text-slate-600 text-right">
                  {t("mgmt.restaurant.inventory.labels.currency")}: {previewInvoice.currency || "-"}  -  {t("mgmt.restaurant.inventory.labels.exchangeRate")}: {previewInvoice.exchangeRate || "-"}
                  <div>
                    {t("mgmt.restaurant.inventory.labels.total")}: {getInvoiceDisplayTotal(previewInvoice)}  - {t("mgmt.restaurant.inventory.labels.tax")}: 
                    {previewInvoice.taxTotalFromXml || previewInvoice.taxTotal || 0}
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




