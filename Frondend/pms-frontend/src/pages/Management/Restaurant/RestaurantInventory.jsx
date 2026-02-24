import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

const UNIT_OPTIONS = [
  { label: "Unit (un)", value: "un" },
  { label: "Grams (g)", value: "g" },
  { label: "Kilograms (kg)", value: "kg" },
  { label: "Pounds (lb)", value: "lb" },
  { label: "Milliliters (ml)", value: "ml" },
  { label: "Liters (l)", value: "l" },
  { label: "Ounces (oz)", value: "oz" },
];

const TAX_OPTIONS = [
  { label: "IVA 13%", value: "13" },
  { label: "IVA 1%", value: "1" },
  { label: "Exento", value: "0" },
];

const normalizeXmlUnit = (raw) => {
  const unit = String(raw || "").trim();
  if (!unit) return "";
  const lower = unit.toLowerCase();
  if (["unid", "unidad", "und", "u"].includes(lower)) return "un";
  return lower;
};

const parseXmlPreview = async (file) => {
  const xml = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML invalido");
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

const TABS = [
  { id: "settings", label: "Ajustes" },
  { id: "manual", label: "Factura manual" },
  { id: "xml", label: "XML" },
  { id: "items", label: "Inventario" },
  { id: "invoices", label: "Facturas" },
];

const emptyLine = () => ({
  sku: "",
  name: "",
  qty: "",
  unit: "",
  cost: "",
  taxRate: "13",
});

export default function RestaurantInventory() {
  const [inventory, setInventory] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [xmlBusy, setXmlBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");
  const [xmlPreview, setXmlPreview] = useState(null);
  const [xmlError, setXmlError] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);

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
    if (!invoiceForm.supplierName.trim()) return alert("Proveedor requerido");
    if (validLines.length === 0) return alert("Agrega al menos una linea valida");
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
        new CustomEvent("pms:push-alert", { detail: { title: "Inventario", desc: "Factura guardada" } })
      );
    } catch (err) {
      alert(err?.response?.data?.message || "No se pudo guardar la factura");
    } finally {
      setSavingInvoice(false);
    }
  };

  const importXml = async (file) => {
    if (!file || xmlBusy) return;
    setXmlBusy(true);
    try {
      const preview = await parseXmlPreview(file);
      setXmlPreview(preview);
      setXmlError("");
    } catch (err) {
      setXmlPreview(null);
      setXmlError(err?.message || "No se pudo leer el XML");
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
    const title = `Factura ${inv?.docNumber || inv?.id || ""}`.trim();
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
            <div style="font-size:12px;color:#555;">Proveedor: ${supplier || "-"}</div>
            <div style="font-size:12px;color:#555;">Fecha: ${issueDate || "-"}</div>
          </div>
          <div style="text-align:right;font-size:12px;color:#555;">
            <div>Moneda: ${currency || "-"}</div>
            <div>TC: ${tc || "-"}</div>
            <div>Total: ${total || 0}</div>
            <div>IVA: ${iva || 0}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;">
          <thead>
            <tr>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:left;">SKU</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:left;">Articulo</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">Cantidad</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:left;">Unidad</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">Costo</th>
              <th style="border-bottom:1px solid #ddd;padding:6px;text-align:right;">IVA</th>
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
          <title>Facturas</title>
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
            <div className="text-sm text-gray-600">El inventario se alimenta desde facturas manuales o XML.</div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inventoryEnabled}
                onChange={(e) => saveInventoryEnabled(e.target.checked)}
                disabled={savingConfig}
              />
              Activar inventario para restaurante
            </label>
            {!inventoryEnabled && (
              <div className="text-xs text-amber-600">
                Inventario desactivado: no se descuenta stock al cerrar ordenes.
              </div>
            )}
          </div>
        );
      case "xml":
        return (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">Importar XML</div>
              <div className="text-xs text-gray-500">
                Carga una factura XML para previsualizar y luego cargar al inventario.
              </div>
            </div>
            <input
              type="file"
              accept=".xml,text/xml"
              disabled={xmlBusy}
              onChange={(e) => importXml(e.target.files && e.target.files[0])}
            />
            {xmlBusy && <div className="text-xs text-gray-500">Importando XML...</div>}
            {xmlError && <div className="text-xs text-red-600">{xmlError}</div>}
            {xmlPreview && (
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  Proveedor: <span className="font-semibold">{xmlPreview.supplierName || "-"}</span> · Doc:{" "}
                  <span className="font-semibold">{xmlPreview.docNumber || "-"}</span> · Fecha:{" "}
                  <span className="font-semibold">{xmlPreview.issueDate || "-"}</span>
                </div>
                <div className="text-xs text-slate-600">
                  Moneda: <span className="font-semibold">{xmlPreview.currency || "-"}</span> · TC:{" "}
                  <span className="font-semibold">{xmlPreview.exchangeRate || "-"}</span> · Total:{" "}
                  <span className="font-semibold">{xmlPreview.totals?.totalComprobante || "-"}</span> · IVA:{" "}
                  <span className="font-semibold">{xmlPreview.totals?.totalImpuesto || "-"}</span> · Venta:{" "}
                  <span className="font-semibold">{xmlPreview.totals?.totalVenta || "-"}</span>
                </div>
                {xmlPreview.lines.length === 0 ? (
                  <div className="text-sm text-gray-500">Sin lineas en el XML.</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">SKU</th>
                            <th className="px-3 py-2 text-left font-semibold">Articulo</th>
                            <th className="px-3 py-2 text-left font-semibold">Cantidad</th>
                            <th className="px-3 py-2 text-left font-semibold">Unidad</th>
                            <th className="px-3 py-2 text-left font-semibold">Costo</th>
                            <th className="px-3 py-2 text-left font-semibold">IVA</th>
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
                    Usar en factura manual
                  </Button>
                  <Button variant="outline" onClick={() => setXmlPreview(null)} disabled={xmlBusy}>
                    Limpiar
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      case "items":
        return (
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">Inventario actual</div>
              <div className="text-xs text-gray-500">Articulos cargados y stock disponible.</div>
            </div>
            {loading ? (
              <div className="text-sm text-gray-500">Cargando...</div>
            ) : inventory.length === 0 ? (
              <div className="text-sm text-gray-500">Sin articulos.</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">SKU</th>
                        <th className="px-3 py-2 text-left font-semibold">Articulo</th>
                        <th className="px-3 py-2 text-left font-semibold">Stock</th>
                        <th className="px-3 py-2 text-left font-semibold">Min</th>
                        <th className="px-3 py-2 text-left font-semibold">Unidad</th>
                        <th className="px-3 py-2 text-left font-semibold">Costo</th>
                        <th className="px-3 py-2 text-left font-semibold">IVA</th>
                        <th className="px-3 py-2 text-left font-semibold">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((i, idx) => (
                        <tr key={i.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                          <td className="px-3 py-2">{i.sku || "-"}</td>
                          <td className="px-3 py-2">{i.desc || i.descripcion || "-"}</td>
                          <td className="px-3 py-2">{i.stock || 0}</td>
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
              <div className="text-sm font-semibold">Facturas registradas</div>
              <div className="text-xs text-gray-500">Historico de entradas al inventario.</div>
            </div>
            {selectedInvoiceIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-slate-600">
                  Seleccionadas: <span className="font-semibold">{selectedInvoiceIds.length}</span>
                </div>
                <Button onClick={() => printInvoices(selectedInvoiceIds)}>Imprimir seleccionadas</Button>
                <Button variant="outline" onClick={clearInvoiceSelection}>Limpiar seleccion</Button>
              </div>
            )}
            {invoices.length === 0 ? (
              <div className="text-sm text-gray-500">No hay facturas.</div>
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
                          Seleccionar
                        </label>
                        <Button variant="outline" onClick={() => setPreviewInvoice(inv)}>
                          Ver
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Total: {inv.total || 0} | IVA: {inv.taxTotal || 0} | {inv.source || "MANUAL"}
                    </div>
                    {(inv.currency || inv.exchangeRate || inv.totalFromXml || inv.taxTotalFromXml || inv.totalSaleFromXml) && (
                      <div className="text-xs text-gray-600">
                        Moneda: {inv.currency || "-"} | TC: {inv.exchangeRate || "-"} | Total XML:{" "}
                        {inv.totalFromXml || "-"} | IVA XML: {inv.taxTotalFromXml || "-"} | Venta XML:{" "}
                        {inv.totalSaleFromXml || "-"}
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
        );
      case "manual":
      default:
        return (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold">Factura manual</div>
              <div className="text-xs text-gray-500">Registra proveedores, articulos y cantidades.</div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Input
                placeholder="Proveedor"
                value={invoiceForm.supplierName}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, supplierName: e.target.value }))}
              />
              <Input
                placeholder="Numero de factura"
                value={invoiceForm.docNumber}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, docNumber: e.target.value }))}
              />
              <Input
                type="date"
                value={invoiceForm.issueDate}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, issueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              {invoiceForm.lines.map((line, idx) => (
                <div
                  key={`${idx}-${line.sku}`}
                  className="grid md:grid-cols-[140px_1fr_120px_120px_140px_120px_80px] gap-2 items-center"
                >
                  <Input
                    placeholder="Codigo (auto)"
                    value={line.sku}
                    onChange={(e) => updateLine(idx, "sku", e.target.value)}
                  />
                  <Input
                    placeholder="Nombre del articulo"
                    value={line.name}
                    onChange={(e) => updateLine(idx, "name", e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Cantidad"
                    value={line.qty}
                    onChange={(e) => updateLine(idx, "qty", e.target.value)}
                  />
                  <select
                    className="h-10 rounded-lg border px-3 text-sm bg-white"
                    value={line.unit}
                    onChange={(e) => updateLine(idx, "unit", e.target.value)}
                  >
                    <option value="">Unidad</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="Costo"
                    money
                    value={line.cost}
                    onChange={(e) => updateLine(idx, "cost", e.target.value)}
                  />
                  <select
                    className="h-10 rounded-lg border px-3 text-sm bg-white"
                    value={line.taxRate}
                    onChange={(e) => updateLine(idx, "taxRate", e.target.value)}
                  >
                    {TAX_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" onClick={() => removeLine(idx)} disabled={invoiceForm.lines.length === 1}>
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={addLine}>
                Agregar linea
              </Button>
              <Button onClick={saveInvoice} disabled={savingInvoice}>
                {savingInvoice ? "Guardando..." : "Guardar factura"}
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b">
          <div className="text-lg font-semibold">Inventario</div>
          <div className="text-xs text-gray-500">Secciones internas en una sola ventana.</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {TABS.map((tab) => (
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
                <div className="text-lg font-semibold text-lime-800">Vista previa de factura</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => printInvoices([previewInvoice.id])}
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl bg-lime-700 text-white text-sm font-semibold hover:bg-lime-600"
                  onClick={() => setPreviewInvoice(null)}
                >
                  Cerrar
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
                    Doc: {previewInvoice.docNumber || "-"} · Fecha:{" "}
                    {previewInvoice.issueDate ? new Date(previewInvoice.issueDate).toLocaleString() : "-"}
                  </div>
                </div>
                <div className="text-xs text-slate-600 text-right">
                  Moneda: {previewInvoice.currency || "-"} · TC: {previewInvoice.exchangeRate || "-"}
                  <div>
                    Total: {getInvoiceDisplayTotal(previewInvoice)} · IVA:{" "}
                    {previewInvoice.taxTotalFromXml || previewInvoice.taxTotal || 0}
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">SKU</th>
                        <th className="px-3 py-2 text-left font-semibold">Articulo</th>
                        <th className="px-3 py-2 text-left font-semibold">Cantidad</th>
                        <th className="px-3 py-2 text-left font-semibold">Unidad</th>
                        <th className="px-3 py-2 text-left font-semibold">Costo</th>
                        <th className="px-3 py-2 text-left font-semibold">IVA</th>
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
    </div>
  );
}
