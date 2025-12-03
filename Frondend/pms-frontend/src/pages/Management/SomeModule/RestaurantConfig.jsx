import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

const TABS = [
  { id: "sections", label: "Secciones y mesas" },
  { id: "printers", label: "Impresoras" },
  { id: "items", label: "Articulos" },
  { id: "groups", label: "Grupos / familias" },
  { id: "taxes", label: "Impuestos y descuentos" },
  { id: "general", label: "Informacion general" },
  { id: "billing", label: "Facturacion" },
  { id: "payments", label: "Pagos y divisa" },
  { id: "recipes", label: "Recetario" },
  { id: "inventory", label: "Inventario" },
];

const emptyItem = { id: "", name: "", price: "", category: "General", code: "" };

export default function RestaurantConfig() {
  const [active, setActive] = useState("sections");

  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [formSection, setFormSection] = useState({ id: "", name: "" });
  const [formTable, setFormTable] = useState({ id: "", name: "", seats: 2 });
  const [menu, setMenu] = useState([]);
  const [menuItem, setMenuItem] = useState(emptyItem);

  const [printers, setPrinters] = useState({ kitchenPrinter: "", barPrinter: "" });

  const [general, setGeneral] = useState({
    nombreComercial: "",
    razonSocial: "",
    cedula: "",
    telefono: "",
    email: "",
    direccion: "",
    horario: "",
    resolucion: "",
    notas: "",
  });
  const [billing, setBilling] = useState({ comprobante: "factura", margen: "", propina: "", autoFactura: true });
  const [taxes, setTaxes] = useState({ iva: "", servicio: "", descuentoMax: "", permitirDescuentos: true, impuestoIncluido: true });
  const [payments, setPayments] = useState({ monedaBase: "CRC", monedaSec: "USD", tipoCambio: "", cobros: "", cargoHabitacion: false });
  const [groupForm, setGroupForm] = useState({ family: "", subFamily: "", subSubFamily: "" });
  const [families, setFamilies] = useState([]);
  const [items, setItems] = useState([]);
  const [quickItem, setQuickItem] = useState({ code: "", family: "", cabys: "", price: "", tax: "", notes: "" });
  const [recipeForm, setRecipeForm] = useState({ name: "", article: "", yieldUnits: "", notes: "" });
  const [recipes, setRecipes] = useState([]);
  const [inventoryForm, setInventoryForm] = useState({ name: "", stock: "", min: "", cost: "", location: "" });
  const [inventory, setInventory] = useState([]);
  const [saving, setSaving] = useState({
    section: false,
    table: false,
    menuItem: false,
    item: false,
    inventory: false,
  });

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  const alert = (title, desc) => {
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title, desc } }));
  };
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/restaurant/sections");
        if (Array.isArray(data)) {
          setSections(data);
          if (!selectedSectionId && data[0]?.id) setSelectedSectionId(data[0].id);
        }
      } catch {
        setSections([]);
      }
      try {
        const { data } = await api.get("/restaurant/config");
        if (data) setPrinters({ kitchenPrinter: data.kitchenPrinter || "", barPrinter: data.barPrinter || "" });
      } catch {
        setPrinters({ kitchenPrinter: "", barPrinter: "" });
      }
      try {
        const { data } = await api.get("/restaurant/general");
        if (data) setGeneral((prev) => ({ ...prev, ...data }));
      } catch {
        /* ignore */
      }
      try {
        const { data } = await api.get("/restaurant/billing");
        if (data) setBilling((prev) => ({ ...prev, ...data }));
      } catch {
        /* ignore */
      }
      try {
        const { data } = await api.get("/restaurant/taxes");
        if (data) setTaxes((prev) => ({ ...prev, ...data }));
      } catch {
        /* ignore */
      }
      try {
        const { data } = await api.get("/restaurant/payments");
        if (data) setPayments((prev) => ({ ...prev, ...data, cobros: Array.isArray(data.cobros) ? data.cobros.join(", ") : data.cobros || "" }));
      } catch {
        /* ignore */
      }
      try {
        const { data } = await api.get("/restaurant/families");
        if (Array.isArray(data)) setFamilies(data);
      } catch {
        setFamilies([]);
      }
      try {
        const { data } = await api.get("/restaurant/items");
        if (Array.isArray(data)) setItems(data);
      } catch {
        setItems([]);
      }
      try {
        const { data } = await api.get("/restaurant/recipes");
        if (Array.isArray(data)) setRecipes(data);
      } catch {
        setRecipes([]);
      }
      try {
        const { data } = await api.get("/restaurant/inventory");
        if (Array.isArray(data)) setInventory(data);
      } catch {
        setInventory([]);
      }
    };
    load();
  }, [selectedSectionId]);

  useEffect(() => {
    const loadMenu = async () => {
      if (!selectedSectionId) {
        setMenu([]);
        return;
      }
      try {
        const { data } = await api.get(`/restaurant/menu?section=${selectedSectionId}`);
        setMenu(Array.isArray(data) ? data : []);
      } catch {
        setMenu([]);
      }
    };
    loadMenu();
  }, [selectedSectionId]);

  const addSection = async () => {
    if (saving.section || !formSection.id || !formSection.name) return;
    setSaving((s) => ({ ...s, section: true }));
    try {
      const payload = { id: formSection.id, name: formSection.name };
      const { data } = await api.post("/restaurant/sections", payload);
      setSections((prev) => [...prev, data]);
      setFormSection({ id: "", name: "" });
      setSelectedSectionId(data.id);
      alert("Restaurante", "Seccion creada");
    } finally {
      setSaving((s) => ({ ...s, section: false }));
    }
  };

  const removeSection = async (id) => {
    await api.delete(`/restaurant/sections/${id}`);
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId("");
  };

  const addTable = async () => {
    if (saving.table || !selectedSectionId || !formTable.id || !formTable.name) return;
    setSaving((s) => ({ ...s, table: true }));
    try {
      const { data } = await api.post(`/restaurant/sections/${selectedSectionId}/tables`, {
        id: formTable.id,
        name: formTable.name,
        seats: Number(formTable.seats || 0) || 2,
      });
      setSections((prev) =>
        prev.map((s) => (s.id === selectedSectionId ? { ...s, tables: data } : s))
      );
      setFormTable({ id: "", name: "", seats: 2 });
      alert("Restaurante", "Mesa agregada");
    } finally {
      setSaving((s) => ({ ...s, table: false }));
    }
  };

  const removeTable = async (tableId) => {
    if (!selectedSectionId) return;
    await api.delete(`/restaurant/sections/${selectedSectionId}/tables/${tableId}`);
    setSections((prev) =>
      prev.map((s) =>
        s.id === selectedSectionId ? { ...s, tables: (s.tables || []).filter((t) => t.id !== tableId) } : s
      )
    );
  };

  const addMenuItem = async () => {
    if (saving.menuItem || !selectedSectionId || !menuItem.name) return;
    setSaving((s) => ({ ...s, menuItem: true }));
    try {
      const payload = {
        id: menuItem.id || undefined,
        code: menuItem.code || `ART-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        name: menuItem.name,
        price: Number(menuItem.price || 0),
        category: menuItem.category || "General",
      };
      const { data } = await api.post(`/restaurant/menu/${selectedSectionId}`, payload);
      setMenu((prev) => [...prev, data]);
      setMenuItem(emptyItem);
    } finally {
      setSaving((s) => ({ ...s, menuItem: false }));
    }
  };

  const removeMenuItem = async (itemId) => {
    if (!selectedSectionId) return;
    await api.delete(`/restaurant/menu/${selectedSectionId}/${itemId}`);
    setMenu((prev) => prev.filter((m) => m.id !== itemId));
  };

  const savePrinters = async () => {
    const { data } = await api.put("/restaurant/config", printers);
    setPrinters({ kitchenPrinter: data?.kitchenPrinter || "", barPrinter: data?.barPrinter || "" });
    alert("Restaurante", "Impresoras guardadas");
  };

  const saveGeneral = async () => {
    await api.put("/restaurant/general", general);
    alert("Restaurante", "Informacion general guardada");
  };

  const saveBilling = async () => {
    await api.put("/restaurant/billing", billing);
    alert("Restaurante", "Facturacion guardada");
  };

  const saveTaxes = async () => {
    await api.put("/restaurant/taxes", taxes);
    alert("Restaurante", "Impuestos guardados");
  };

  const savePayments = async () => {
    const payload = {
      ...payments,
      cobros: payments.cobros ? payments.cobros.split(",").map((c) => c.trim()).filter(Boolean) : [],
    };
    await api.put("/restaurant/payments", payload);
    alert("Restaurante", "Pagos y divisa guardados");
  };
  const addFamily = async () => {
    if (!groupForm.family) return;
    const { data } = await api.post("/restaurant/families", groupForm);
    setFamilies((prev) => [...prev, data]);
    setGroupForm({ family: "", subFamily: "", subSubFamily: "" });
  };

  const removeFamily = async (id) => {
    await api.delete(`/restaurant/families/${id}`);
    setFamilies((prev) => prev.filter((f) => f.id !== id));
  };

  const addItem = async () => {
    if (saving.item || !quickItem.family || !quickItem.cabys || !quickItem.price) return;
    setSaving((s) => ({ ...s, item: true }));
    try {
      const payload = {
        ...quickItem,
        code: quickItem.code || `ART-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        price: Number(quickItem.price || 0),
        tax: Number(quickItem.tax || 0),
      };
      const { data } = await api.post("/restaurant/items", payload);
      const saved = Array.isArray(data) ? data : [data];
      setItems((prev) => [...prev, ...saved]);
      setQuickItem({ family: "", cabys: "", price: "", tax: "", notes: "", code: "" });
    } finally {
      setSaving((s) => ({ ...s, item: false }));
    }
  };

  const removeItem = async (id) => {
    await api.delete(`/restaurant/items/${id}`);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const addRecipe = async () => {
    if (!recipeForm.name) return;
    const { data } = await api.post("/restaurant/recipes", recipeForm);
    setRecipes((prev) => [...prev, data]);
    setRecipeForm({ name: "", article: "", yieldUnits: "", notes: "" });
  };

  const removeRecipe = async (id) => {
    await api.delete(`/restaurant/recipes/${id}`);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  const addInventory = async () => {
    if (saving.inventory || !inventoryForm.name) return;
    setSaving((s) => ({ ...s, inventory: true }));
    try {
      const payload = {
        ...inventoryForm,
        stock: Number(inventoryForm.stock || 0),
        min: Number(inventoryForm.min || 0),
        cost: Number(inventoryForm.cost || 0),
      };
      const { data } = await api.post("/restaurant/inventory", payload);
      setInventory((prev) => [...prev, data]);
      setInventoryForm({ name: "", stock: "", min: "", cost: "", location: "" });
    } finally {
      setSaving((s) => ({ ...s, inventory: false }));
    }
  };

  const removeInventory = async (id) => {
    await api.delete(`/restaurant/inventory/${id}`);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  };
  const renderSections = () => (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-500">Secciones</div>
            <h3 className="font-semibold text-lg">Crear o seleccionar seccion</h3>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="ID"
              value={formSection.id}
              onChange={(e) => setFormSection((f) => ({ ...f, id: e.target.value }))}
              className="w-28"
            />
            <Input
              placeholder="Nombre"
              value={formSection.name}
              onChange={(e) => setFormSection((f) => ({ ...f, name: e.target.value }))}
              className="w-56"
            />
            <Button onClick={addSection} disabled={saving.section}>
              {saving.section ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <div key={s.id} className={`border rounded-lg px-3 py-2 flex items-center gap-2 ${selectedSectionId === s.id ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}>
              <button className="text-sm font-semibold" onClick={() => setSelectedSectionId(s.id)}>
                {s.name || s.id}
              </button>
              <span className="text-xs text-gray-500">({(s.tables || []).length} mesas)</span>
              <button className="text-xs text-red-600" onClick={() => removeSection(s.id)}>
                Eliminar
              </button>
            </div>
          ))}
          {sections.length === 0 && <div className="text-sm text-gray-500">No hay secciones.</div>}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-500">Mesas</div>
            <h3 className="font-semibold text-lg">Distribucion de mesas</h3>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="ID mesa"
              value={formTable.id}
              onChange={(e) => setFormTable((f) => ({ ...f, id: e.target.value }))}
              className="w-32"
            />
            <Input
              placeholder="Nombre"
              value={formTable.name}
              onChange={(e) => setFormTable((f) => ({ ...f, name: e.target.value }))}
              className="w-40"
            />
            <Input
              type="number"
              placeholder="Puestos"
              value={formTable.seats}
              onChange={(e) => setFormTable((f) => ({ ...f, seats: e.target.value }))}
              className="w-24"
            />
            <Button onClick={addTable} disabled={!selectedSectionId || saving.table}>
              {saving.table ? "Guardando..." : "Agregar mesa"}
            </Button>
          </div>
        </div>
        {selectedSection ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {(selectedSection.tables || []).map((t) => (
              <div key={t.id} className="border rounded-lg p-3 flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.seats} puestos</div>
                </div>
                <button className="text-xs text-red-600" onClick={() => removeTable(t.id)}>
                  Eliminar
                </button>
              </div>
            ))}
            {(selectedSection.tables || []).length === 0 && <div className="text-sm text-gray-500">Sin mesas en esta seccion.</div>}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Selecciona una seccion para administrar sus mesas.</div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase text-gray-500">Menu</div>
            <h3 className="font-semibold text-lg">Articulos por seccion</h3>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="ID"
              value={menuItem.id}
              onChange={(e) => setMenuItem((f) => ({ ...f, id: e.target.value }))}
              className="w-24"
            />
            <Input
              placeholder="Codigo"
              value={menuItem.code}
              onChange={(e) => setMenuItem((f) => ({ ...f, code: e.target.value }))}
              className="w-32"
            />
            <Input
              placeholder="Nombre"
              value={menuItem.name}
              onChange={(e) => setMenuItem((f) => ({ ...f, name: e.target.value }))}
              className="w-40"
            />
            <Input
              placeholder="Categoria"
              value={menuItem.category}
              onChange={(e) => setMenuItem((f) => ({ ...f, category: e.target.value }))}
              className="w-32"
            />
            <Input
              type="number"
              placeholder="Precio"
              value={menuItem.price}
              onChange={(e) => setMenuItem((f) => ({ ...f, price: e.target.value }))}
              className="w-28"
            />
            <Button onClick={addMenuItem} disabled={!selectedSectionId || saving.menuItem}>
              {saving.menuItem ? "Guardando..." : "Agregar al menu"}
            </Button>
          </div>
        </div>
        {selectedSection ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {menu.map((m) => (
              <div key={m.id} className="border rounded-lg p-3 flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.category}</div>
                  <div className="text-xs text-gray-600">${Number(m.price || 0).toFixed(2)}</div>
                </div>
                <button className="text-xs text-red-600" onClick={() => removeMenuItem(m.id)}>
                  Eliminar
                </button>
              </div>
            ))}
            {menu.length === 0 && <div className="text-sm text-gray-500">Sin items en esta seccion.</div>}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Selecciona una seccion para ver su menu.</div>
        )}
      </Card>
    </div>
  );
  const renderPrinters = () => (
    <Card className="p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-lg">Impresoras de restaurante</h3>
        <p className="text-sm text-gray-600">Configura impresora para cocina y bar (no comparte con front desk).</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Input
          placeholder="ID impresora cocina"
          value={printers.kitchenPrinter}
          onChange={(e) => setPrinters((p) => ({ ...p, kitchenPrinter: e.target.value }))}
        />
        <Input
          placeholder="ID impresora bar"
          value={printers.barPrinter}
          onChange={(e) => setPrinters((p) => ({ ...p, barPrinter: e.target.value }))}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={savePrinters}>Guardar impresoras</Button>
      </div>
    </Card>
  );

  const renderItems = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Articulos</h3>
          <p className="text-sm text-gray-600">Creacion rapida de articulos con familia, CABYS e impuesto.</p>
        </div>
        <Button onClick={addItem} disabled={saving.item}>{saving.item ? "Guardando..." : "Agregar"}</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Codigo (auto)" value={quickItem.code} onChange={(e) => setQuickItem((f) => ({ ...f, code: e.target.value }))} />
        <Input placeholder="Familia" value={quickItem.family} onChange={(e) => setQuickItem((f) => ({ ...f, family: e.target.value }))} />
        <Input placeholder="CABYS" value={quickItem.cabys} onChange={(e) => setQuickItem((f) => ({ ...f, cabys: e.target.value }))} />
        <Input type="number" placeholder="Precio" value={quickItem.price} onChange={(e) => setQuickItem((f) => ({ ...f, price: e.target.value }))} />
        <Input type="number" placeholder="Impuesto %" value={quickItem.tax} onChange={(e) => setQuickItem((f) => ({ ...f, tax: e.target.value }))} />
        <Textarea placeholder="Notas" value={quickItem.notes} onChange={(e) => setQuickItem((f) => ({ ...f, notes: e.target.value }))} className="md:col-span-2" />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.id} className="border rounded-lg p-3 flex justify-between items-start">
            <div className="text-sm">
              <div className="font-semibold">{it.family}</div>
              <div className="text-xs text-gray-500">CABYS: {it.cabys}</div>
              <div className="text-xs text-gray-500">Impuesto: {it.tax || 0}%</div>
              <div className="text-xs text-gray-600">${Number(it.price || 0).toFixed(2)}</div>
            </div>
            <button className="text-xs text-red-600" onClick={() => removeItem(it.id)}>
              Eliminar
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm text-gray-500">Sin articulos cargados.</div>}
      </div>
    </Card>
  );
  const renderGroups = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Grupos, familias y subfamilias</h3>
          <p className="text-sm text-gray-600">Organiza el menu por familias.</p>
        </div>
        <Button onClick={addFamily}>Agregar</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Familia" value={groupForm.family} onChange={(e) => setGroupForm((f) => ({ ...f, family: e.target.value }))} />
        <Input placeholder="Subfamilia" value={groupForm.subFamily} onChange={(e) => setGroupForm((f) => ({ ...f, subFamily: e.target.value }))} />
        <Input placeholder="Sub subfamilia" value={groupForm.subSubFamily} onChange={(e) => setGroupForm((f) => ({ ...f, subSubFamily: e.target.value }))} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {families.map((fam) => (
          <div key={fam.id} className="border rounded-lg p-3 flex justify-between items-start">
            <div className="text-sm">
              <div className="font-semibold">{fam.family}</div>
              <div className="text-xs text-gray-500">{fam.subFamily}</div>
              <div className="text-xs text-gray-500">{fam.subSubFamily}</div>
            </div>
            <button className="text-xs text-red-600" onClick={() => removeFamily(fam.id)}>
              Eliminar
            </button>
          </div>
        ))}
        {families.length === 0 && <div className="text-sm text-gray-500">Sin familias registradas.</div>}
      </div>
    </Card>
  );

  const renderTaxes = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Impuestos y descuentos</h3>
          <p className="text-sm text-gray-600">Porcentaje de IVA, servicio y maximo de descuentos.</p>
        </div>
        <Button onClick={saveTaxes}>Guardar</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Input type="number" placeholder="IVA %" value={taxes.iva} onChange={(e) => setTaxes((t) => ({ ...t, iva: e.target.value }))} />
        <Input type="number" placeholder="Servicio %" value={taxes.servicio} onChange={(e) => setTaxes((t) => ({ ...t, servicio: e.target.value }))} />
        <Input type="number" placeholder="Descuento max %" value={taxes.descuentoMax} onChange={(e) => setTaxes((t) => ({ ...t, descuentoMax: e.target.value }))} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(taxes.permitirDescuentos)} onChange={(e) => setTaxes((t) => ({ ...t, permitirDescuentos: e.target.checked }))} />
          Permitir descuentos en POS
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(taxes.impuestoIncluido)} onChange={(e) => setTaxes((t) => ({ ...t, impuestoIncluido: e.target.checked }))} />
          Impuesto incluido en precios
        </label>
      </div>
    </Card>
  );
  const renderGeneral = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Informacion general</h3>
          <p className="text-sm text-gray-600">Datos legales y de contacto del restaurante.</p>
        </div>
        <Button onClick={saveGeneral}>Guardar</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Nombre comercial" value={general.nombreComercial} onChange={(e) => setGeneral((g) => ({ ...g, nombreComercial: e.target.value }))} />
        <Input placeholder="Razon social" value={general.razonSocial} onChange={(e) => setGeneral((g) => ({ ...g, razonSocial: e.target.value }))} />
        <Input placeholder="Cedula juridica" value={general.cedula} onChange={(e) => setGeneral((g) => ({ ...g, cedula: e.target.value }))} />
        <Input placeholder="Telefono" value={general.telefono} onChange={(e) => setGeneral((g) => ({ ...g, telefono: e.target.value }))} />
        <Input placeholder="Email" value={general.email} onChange={(e) => setGeneral((g) => ({ ...g, email: e.target.value }))} />
        <Input placeholder="Direccion" value={general.direccion} onChange={(e) => setGeneral((g) => ({ ...g, direccion: e.target.value }))} />
        <Input placeholder="Horario" value={general.horario} onChange={(e) => setGeneral((g) => ({ ...g, horario: e.target.value }))} />
        <Input placeholder="Resolucion Hacienda" value={general.resolucion} onChange={(e) => setGeneral((g) => ({ ...g, resolucion: e.target.value }))} />
      </div>
      <Textarea placeholder="Notas" value={general.notas} onChange={(e) => setGeneral((g) => ({ ...g, notas: e.target.value }))} />
    </Card>
  );

  const renderBilling = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Facturacion</h3>
          <p className="text-sm text-gray-600">Margenes, tipo de comprobante y propina.</p>
        </div>
        <Button onClick={saveBilling}>Guardar</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Tipo de comprobante" value={billing.comprobante} onChange={(e) => setBilling((b) => ({ ...b, comprobante: e.target.value }))} />
        <Input placeholder="Margen %" value={billing.margen} onChange={(e) => setBilling((b) => ({ ...b, margen: e.target.value }))} />
        <Input placeholder="Propina %" value={billing.propina} onChange={(e) => setBilling((b) => ({ ...b, propina: e.target.value }))} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(billing.autoFactura)} onChange={(e) => setBilling((b) => ({ ...b, autoFactura: e.target.checked }))} />
        Autogenerar factura o ticket segun ley
      </label>
    </Card>
  );
  const renderPayments = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Pagos y divisa</h3>
          <p className="text-sm text-gray-600">Configura monedas y cobros disponibles.</p>
        </div>
        <Button onClick={savePayments}>Guardar</Button>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Moneda base" value={payments.monedaBase} onChange={(e) => setPayments((p) => ({ ...p, monedaBase: e.target.value }))} />
        <Input placeholder="Moneda secundaria" value={payments.monedaSec} onChange={(e) => setPayments((p) => ({ ...p, monedaSec: e.target.value }))} />
        <Input type="number" placeholder="Tipo de cambio" value={payments.tipoCambio} onChange={(e) => setPayments((p) => ({ ...p, tipoCambio: e.target.value }))} />
        <Input
          placeholder="Cobros disponibles (coma)"
          value={payments.cobros}
          onChange={(e) => setPayments((p) => ({ ...p, cobros: e.target.value }))}
          className="md:col-span-2"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(payments.cargoHabitacion)} onChange={(e) => setPayments((p) => ({ ...p, cargoHabitacion: e.target.checked }))} />
          Permitir cargos a habitacion (consulta a front desk)
        </label>
      </div>
    </Card>
  );

  const renderRecipes = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Recetario</h3>
          <p className="text-sm text-gray-600">Asocia recetas a articulos para costo real.</p>
        </div>
        <Button onClick={addRecipe}>Agregar</Button>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <Input placeholder="Nombre" value={recipeForm.name} onChange={(e) => setRecipeForm((f) => ({ ...f, name: e.target.value }))} />
        <Input placeholder="Articulo" value={recipeForm.article} onChange={(e) => setRecipeForm((f) => ({ ...f, article: e.target.value }))} />
        <Input placeholder="Rendimiento" value={recipeForm.yieldUnits} onChange={(e) => setRecipeForm((f) => ({ ...f, yieldUnits: e.target.value }))} />
        <Input placeholder="Notas" value={recipeForm.notes} onChange={(e) => setRecipeForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {recipes.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 flex justify-between items-start">
            <div className="text-sm">
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-gray-500">{r.article}</div>
              <div className="text-xs text-gray-500">{r.yieldUnits}</div>
              <div className="text-xs text-gray-600">{r.notes}</div>
            </div>
            <button className="text-xs text-red-600" onClick={() => removeRecipe(r.id)}>
              Eliminar
            </button>
          </div>
        ))}
        {recipes.length === 0 && <div className="text-sm text-gray-500">Sin recetas.</div>}
      </div>
    </Card>
  );
  const renderInventory = () => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Inventario</h3>
          <p className="text-sm text-gray-600">Control de existencias ligadas al recetario.</p>
        </div>
        <Button onClick={addInventory} disabled={saving.inventory}>{saving.inventory ? "Guardando..." : "Agregar"}</Button>
      </div>
      <div className="grid md:grid-cols-5 gap-3">
        <Input placeholder="Articulo" value={inventoryForm.name} onChange={(e) => setInventoryForm((f) => ({ ...f, name: e.target.value }))} />
        <Input type="number" placeholder="Existencias" value={inventoryForm.stock} onChange={(e) => setInventoryForm((f) => ({ ...f, stock: e.target.value }))} />
        <Input type="number" placeholder="Minimo" value={inventoryForm.min} onChange={(e) => setInventoryForm((f) => ({ ...f, min: e.target.value }))} />
        <Input type="number" placeholder="Costo" value={inventoryForm.cost} onChange={(e) => setInventoryForm((f) => ({ ...f, cost: e.target.value }))} />
        <Input placeholder="Ubicacion" value={inventoryForm.location} onChange={(e) => setInventoryForm((f) => ({ ...f, location: e.target.value }))} />
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {inventory.map((i) => (
          <div key={i.id} className="border rounded-lg p-3 flex justify-between items-start">
            <div className="text-sm">
              <div className="font-semibold">{i.name}</div>
              <div className="text-xs text-gray-500">Stock: {i.stock}</div>
              <div className="text-xs text-gray-500">Minimo: {i.min}</div>
              <div className="text-xs text-gray-500">Costo: {i.cost}</div>
              <div className="text-xs text-gray-500">{i.location}</div>
            </div>
            <button className="text-xs text-red-600" onClick={() => removeInventory(i.id)}>
              Eliminar
            </button>
          </div>
        ))}
        {inventory.length === 0 && <div className="text-sm text-gray-500">Sin inventario.</div>}
      </div>
    </Card>
  );
  const renderContent = () => {
    switch (active) {
      case "sections":
        return renderSections();
      case "printers":
        return renderPrinters();
      case "items":
        return renderItems();
      case "groups":
        return renderGroups();
      case "taxes":
        return renderTaxes();
      case "general":
        return renderGeneral();
      case "billing":
        return renderBilling();
      case "payments":
        return renderPayments();
      case "recipes":
        return renderRecipes();
      case "inventory":
        return renderInventory();
      default:
        return renderSections();
    }
  };

  return (
    <div className="grid lg:grid-cols-[230px_1fr] gap-4">
      <Card className="p-3 space-y-2 h-max">
        <div className="text-xs uppercase text-gray-500 px-2">Ajustes de restaurante</div>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
              active === tab.id ? "bg-indigo-600 text-white" : "hover:bg-indigo-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </Card>
      <div className="space-y-4">{renderContent()}</div>
    </div>
  );
}
