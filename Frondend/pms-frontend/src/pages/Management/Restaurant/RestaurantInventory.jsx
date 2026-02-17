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
      const xml = await file.text();
      await api.post("/restaurant/inventory/invoices/import-xml", { xml });
      await reloadAll();
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Inventario", desc: "XML importado" } }));
    } catch (err) {
      alert(err?.response?.data?.message || "No se pudo importar el XML");
    } finally {
      setXmlBusy(false);
    }
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
              <div className="text-xs text-gray-500">Carga una factura XML para alimentar inventario.</div>
            </div>
            <input
              type="file"
              accept=".xml,text/xml"
              disabled={xmlBusy}
              onChange={(e) => importXml(e.target.files && e.target.files[0])}
            />
            {xmlBusy && <div className="text-xs text-gray-500">Importando XML...</div>}
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
              <div className="grid md:grid-cols-2 gap-2">
                {inventory.map((i) => (
                  <div key={i.id} className="border rounded-lg px-3 py-2 text-sm">
                    <div className="font-semibold">
                      {i.sku} - {i.desc}
                    </div>
                    <div className="text-xs text-gray-600">
                      Stock: {i.stock || 0} {i.unit || i.unidad || ""} | Min: {i.minimo || i.min || 0}{" "}
                      {i.unit || i.unidad || ""}
                    </div>
                    <div className="text-xs text-gray-600">
                      Costo: {i.cost || i.costo || 0} | IVA: {i.taxRate ?? "-"}% | Proveedor:{" "}
                      {i.supplierName || i.proveedor || "-"}
                    </div>
                  </div>
                ))}
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
                      <div className="text-xs text-gray-500">
                        {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Total: {inv.total || 0} | IVA: {inv.taxTotal || 0} | {inv.source || "MANUAL"}
                    </div>
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
    </div>
  );
}
