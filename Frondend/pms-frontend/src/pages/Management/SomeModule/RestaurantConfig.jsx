import React, { useEffect, useMemo, useRef, useState } from "react";

import { useLocation } from "react-router-dom";

import { X as XIcon } from "lucide-react";

import { Card } from "../../../components/ui/card";

import { Input } from "../../../components/ui/input";

import { Textarea } from "../../../components/ui/textarea";

import { Button } from "../../../components/ui/button";

import { api } from "../../../lib/api";

import RestaurantItems from "../Restaurant/RestaurantItems";

import RestaurantFamilies from "../Restaurant/RestaurantFamilies";

import RestaurantInventory from "../Restaurant/RestaurantInventory";



const NAV_TABS = [

  { id: "generalConfig", label: "Configuración general" },

  { id: "sections", label: "Secciones y mesas" },

  { id: "floorplan", label: "Plano de planta" },

  { id: "groups", label: "Grupos / familias" },

  { id: "items", label: "Artículos" },

  { id: "recipes", label: "Recetas" },

  { id: "inventory", label: "Inventario" },

  { id: "printers", label: "Impresoras" },

];



const TABS = [

  { id: "sections", label: "Sections & tables" },

  { id: "floorplan", label: "Floorplan" },

  { id: "printers", label: "Printers" },

  { id: "items", label: "Artículos" },

  { id: "groups", label: "Groups / families" },

  { id: "generalConfig", label: "Configuración general" },

  { id: "recipes", label: "Recipes" },

  { id: "inventory", label: "Inventory" },

];



const TOP_TABS = [

  { id: "sections", label: "Secciones" },

  { id: "tables", label: "Mesas" },

  { id: "menus", label: "Menús" },

];



const applyTableStylesToSections = (sectionsList, tableStyles) => {

  const styles = tableStyles && typeof tableStyles === "object" ? tableStyles : null;

  if (!styles) return sectionsList;

  return (sectionsList || []).map((sec) => {

    const secId = String(sec?.id || "");

    const byTable = secId && styles[secId] && typeof styles[secId] === "object" ? styles[secId] : null;

    if (!byTable) return sec;

    return {

      ...sec,

      tables: (sec.tables || []).map((t) => {

        const tableId = String(t?.id || "");

        const st = tableId && byTable[tableId] && typeof byTable[tableId] === "object" ? byTable[tableId] : null;

        if (!st) return t;

        const next = { ...t };

        const size = Number(st.size ?? st.iconSize);

        const rotation = Number(st.rotation ?? st.angle);

        const color = String(st.color || st.colorHex || st.iconColor || "").trim();

        const kind = st.kind;

        if (Number.isFinite(size)) next.size = size;

        if (Number.isFinite(rotation)) next.rotation = rotation;

        if (color) next.color = color;

        if (kind) next.kind = kind;

        return next;

      }),

    };

  });

};



export default function RestaurantConfig() {

  const location = useLocation();

  const [active, setActive] = useState("sections");

  const [generalConfigTab, setGeneralConfigTab] = useState("general");

  const [subTab, setSubTab] = useState("sections");



  const readFileAsDataUrl = (file) =>

    new Promise((resolve, reject) => {

      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));

      reader.onerror = reject;

      reader.readAsDataURL(file);

    });



  const resizeImageDataUrl = async (dataUrl, maxDim = 512, quality = 0.86) => {

    if (!dataUrl || typeof dataUrl !== "string") return "";

    if (dataUrl.startsWith("data:image/svg+xml")) return dataUrl;



    return new Promise((resolve) => {

      const img = new Image();

      img.onload = () => {

        const w0 = Number(img.naturalWidth || img.width || 0) || 0;

        const h0 = Number(img.naturalHeight || img.height || 0) || 0;

        if (!w0 || !h0) return resolve(dataUrl);



        const scale = Math.min(1, maxDim / Math.max(w0, h0));

        const w = Math.max(1, Math.round(w0 * scale));

        const h = Math.max(1, Math.round(h0 * scale));

        const canvas = document.createElement("canvas");

        canvas.width = w;

        canvas.height = h;

        const ctx = canvas.getContext("2d");

        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0, w, h);



        try {

          resolve(canvas.toDataURL("image/webp", quality));

        } catch {

          try {

            resolve(canvas.toDataURL("image/jpeg", quality));

          } catch {

            resolve(dataUrl);

          }

        }

      };

      img.onerror = () => resolve(dataUrl);

      img.src = dataUrl;

    });

  };



  const [sections, setSections] = useState([]);

  const [selectedSectionId, setSelectedSectionId] = useState("");

  const [formSection, setFormSection] = useState({ id: "", name: "", imageUrl: "", quickCashEnabled: false });

  const [formTable, setFormTable] = useState({ id: "", name: "", kind: "mesa", seats: 2, x: "", y: "", size: 56, rotation: 0, color: "" });

  const [menu, setMenu] = useState([]);

  const [menus, setMenus] = useState([]);

  const [menuName, setMenuName] = useState("");

  const [menuCreateSectionIds, setMenuCreateSectionIds] = useState([]);

  const [selectedMenuId, setSelectedMenuId] = useState("");

  const [menuEditForm, setMenuEditForm] = useState({ name: "", active: true });

  const [menuEntries, setMenuEntries] = useState([]);

  const [sectionMenuAssignments, setSectionMenuAssignments] = useState([]);

  const [menuAssignForm, setMenuAssignForm] = useState({

    menuId: "",

    daysMask: 127,

    startTime: "",

    endTime: "",

    priority: 0,

    active: true,

  });

  const [menuPickerOpen, setMenuPickerOpen] = useState(false);

  const [menuPickerCategory, setMenuPickerCategory] = useState("");

  const [menuPickerSearch, setMenuPickerSearch] = useState("");

  const [menuEntrySearch, setMenuEntrySearch] = useState("");

  const [drag, setDrag] = useState(null); // { type: 'table', mode: 'move', id, rect, startX, startY, baseX, baseY }

  const dragLatestRef = useRef(null);

  const [selectedTableId, setSelectedTableId] = useState("");

  const [selectedObjectId, setSelectedObjectId] = useState("");

  const [tableEdit, setTableEdit] = useState(null);

  const [rotationSnap, setRotationSnap] = useState(15); // 0 = off

  const [floorplanSaving, setFloorplanSaving] = useState(false); // posiciones

  const [dirtyPosTableIds, setDirtyPosTableIds] = useState([]); // X/Y moved on floorplan

  const [dirtyStyleTableIds, setDirtyStyleTableIds] = useState([]); // size/rotation/color changed

  const [backgroundForm, setBackgroundForm] = useState({ color: "", image: "" });

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

    backgrounds: {},

  });



  // eslint-disable-next-line no-use-before-define

  useEffect(() => {

    const bg = general?.backgrounds?.[selectedSectionId] || {};

    setBackgroundForm({

      color: bg.color || "",

      image: bg.image || "",

    });

  }, [general?.backgrounds, selectedSectionId]);



  const floorplanDirty = (dirtyPosTableIds || []).length > 0;

  const floorplanHasChanges = floorplanDirty || (dirtyStyleTableIds || []).length > 0;

  const markPosDirty = (tableId) => {

    if (!tableId) return;

    setDirtyPosTableIds((prev) => (prev.includes(tableId) ? prev : [...prev, tableId]));

  };

  const clearPosDirty = (tableId) => {

    if (!tableId) return;

    setDirtyPosTableIds((prev) => prev.filter((id) => id !== tableId));

  };

  const markStyleDirty = (tableId) => {

    if (!tableId) return;

    setDirtyStyleTableIds((prev) => (prev.includes(tableId) ? prev : [...prev, tableId]));

  };

  const clearStyleDirty = (tableId) => {

    if (!tableId) return;

    setDirtyStyleTableIds((prev) => prev.filter((id) => id !== tableId));

  };



  const [printers, setPrinters] = useState({ kitchenPrinter: "", barPrinter: "", cashierPrinter: "" });

  const [printing, setPrinting] = useState({

    paperType: "80mm",

    defaultDocType: "TE",

    types: {

      comanda: { enabled: true, printerId: "", copies: 1, formId: "" },

      ticket: { enabled: true, printerId: "", copies: 1, formId: "" },

      electronicInvoice: { enabled: true, printerId: "", copies: 1, formId: "" },

      closes: { enabled: true, printerId: "", copies: 1, formId: "" },

      document: { enabled: true, printerId: "", copies: 1, formId: "" },

    },

  });



  const [einvPrintForms, setEinvPrintForms] = useState([]);

  const [billing, setBilling] = useState({
    ticketComprobante: "tiquete",
    invoiceComprobante: "factura",
    autoFactura: true,
  });

  const [taxes, setTaxes] = useState({ iva: "", servicio: "", descuentoMax: "", permitirDescuentos: true, impuestoIncluido: true });

  const [discountsList, setDiscountsList] = useState([]);

  const [discountForm, setDiscountForm] = useState({ name: "", percent: "" });

  const [payments, setPayments] = useState({

    monedaBase: "CRC",

    monedaSec: "USD",

    tipoCambio: "",

    useBCCR: false,

    paymentMethods: [], // [{ id, name, enabled, account }]

    accountingEnabled: false,

    accountingConnectorRef: "",

    cargoHabitacion: false,

  });

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");

  const [paymentMethodForm, setPaymentMethodForm] = useState({ id: "", name: "", account: "" });

  const [items, setItems] = useState([]);  const [recipeLines, setRecipeLines] = useState([]);

  const [selectedRecipeItemId, setSelectedRecipeItemId] = useState("");

  const [recipeLineForm, setRecipeLineForm] = useState({ inventoryItemId: "", qty: "", unit: "" });

  const [inventory, setInventory] = useState([]);

  const [saving, setSaving] = useState({

    section: false,

    table: false,

    menuEntries: false,

    item: false,

  });



  const selectedSection = useMemo(

    () => sections.find((s) => s.id === selectedSectionId) || null,

    [sections, selectedSectionId]

  );



  const alert = (title, desc) => {

    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title, desc } }));

  };

  const getApiError = (err, fallback) => err?.response?.data?.message || err?.message || fallback;



  useEffect(() => {

    const params = new URLSearchParams(location.search || "");

    const tab = params.get("tab");

    if (!tab) return;

    if (["general", "billing", "payments", "taxes"].includes(tab)) {

      setActive("generalConfig");

      return;

    }

    if (TABS.some((t) => t.id === tab)) {

      setActive(tab);

      return;

    }

    if (TOP_TABS.some((t) => t.id === tab)) {

      setActive("sections");

      setSubTab(tab);

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [location.search]);



  useEffect(() => {

    if (menuPickerOpen && (active !== "sections" || subTab !== "menus")) setMenuPickerOpen(false);

  }, [active, subTab, menuPickerOpen]);



  const isCostaRica = useMemo(() => {

    const base = String(payments?.monedaBase || "").toUpperCase();

    if (base === "CRC") return true;

    const addr = String(general?.direccion || "").toUpperCase();

    if (addr.includes(", CR") || addr.includes("COSTA RICA")) return true;

    const phone = String(general?.telefono || "");

    if (phone.includes("+506")) return true;

    return false;

  }, [payments?.monedaBase, general?.direccion, general?.telefono]);



  useEffect(() => {

    if (!isCostaRica) return;

    setPayments((prev) => {

      const list = Array.isArray(prev.paymentMethods) ? prev.paymentMethods : [];

      if (list.length > 0) return prev;

      const defaults = [

        "Efectivo",

        "Tarjeta",

        "SINPE",

        "Transferencia",

        "Depsito",

        "Cheque",

        "Crdito",

        "Cortesa",

      ];

      const enabledByDefault = new Set(["Efectivo", "Tarjeta"]);

      const normalizeId = (value) =>

        String(value || "")

          .trim()

          .toLowerCase()

          .replace(/\s+/g, "-")

          .replace(/[^a-z0-9_-]/g, "")

          .slice(0, 64) || `pm-${Date.now()}`;



      return {

        ...prev,

        paymentMethods: defaults.map((name) => ({ id: normalizeId(name), name, enabled: enabledByDefault.has(name), account: "" })),

      };

    });

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [isCostaRica]);



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

        const { data } = await api.get("/restaurant/menus");

        if (Array.isArray(data)) {

          setMenus(data);

          setSelectedMenuId((cur) => cur || data[0]?.id || "");

        }

      } catch {

        setMenus([]);

      }

      try {

        const { data } = await api.get("/restaurant/config");

        if (data) {

          setPrinters({

            kitchenPrinter: data.kitchenPrinter || "",

            barPrinter: data.barPrinter || "",

            cashierPrinter: data.cashierPrinter || "",

          });

          const p = data.printing && typeof data.printing === "object" ? data.printing : null;

          if (p) {

            setPrinting((prev) => ({

              ...prev,

              ...p,

              types: { ...prev.types, ...(p.types || {}) },

            }));

          }

        }

      } catch {

        setPrinters({ kitchenPrinter: "", barPrinter: "", cashierPrinter: "" });

      }

      try {

        const { data } = await api.get("/restaurant/general");

        if (data) {

          setGeneral((prev) => ({ ...prev, ...data }));

          if (data?.tableStyles) setSections((prev) => applyTableStylesToSections(prev, data.tableStyles));

        }

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

        if (data) {

          setPayments((prev) => {

            const cobros = Array.isArray(data.cobros)

              ? data.cobros.map((c) => String(c || "").trim()).filter(Boolean)

              : typeof data.cobros === "string"

                ? data.cobros.split(",").map((c) => c.trim()).filter(Boolean)

                : [];



            const raw = Array.isArray(data.paymentMethods) ? data.paymentMethods : null;

            const isCR = String(data?.monedaBase || prev.monedaBase || "").toUpperCase() === "CRC";



            const defaultsCR = [

              "Efectivo",

              "Tarjeta",

              "SINPE",

              "Transferencia",

              "Depsito",

              "Cheque",

              "Crdito",

              "Cortesa",

            ];



            const normalizeId = (value) =>

              String(value || "")

                .trim()

                .toLowerCase()

                .replace(/\s+/g, "-")

                .replace(/[^a-z0-9_-]/g, "")

                .slice(0, 64) || `pm-${Date.now()}`;



            const fromCobros = cobros.map((name) => ({

              id: normalizeId(name),

              name,

              enabled: true,

              account: "",

            }));



            const normalizedRaw = raw

              ? raw

                  .filter(Boolean)

                  .map((m) => ({

                    id: normalizeId(m.id || m.name),

                    name: String(m.name || m.id || "").trim(),

                    enabled: m.enabled !== false,

                    account: String(m.account || ""),

                  }))

                  .filter((m) => m.name)

              : null;



            const merged = (() => {

              const base = normalizedRaw || fromCobros;

              if (!isCR) return base;

              const map = new Map(base.map((m) => [normalizeId(m.id || m.name), m]));

              defaultsCR.forEach((n) => {

                const id = normalizeId(n);

                if (!map.has(id)) map.set(id, { id, name: n, enabled: cobros.includes(n), account: "" });

              });

              return Array.from(map.values());

            })();



            return {

              ...prev,

              ...data,

              paymentMethods: merged,

              useBCCR: Boolean(data?.useBCCR),

              accountingEnabled: Boolean(data?.accountingEnabled),

              accountingConnectorRef: String(data?.accountingConnectorRef || ""),

            };

          });

        }

      } catch {

        /* ignore */

      }

      try {

        const { data } = await api.get("/restaurant/items");

        if (Array.isArray(data)) setItems(data);

      } catch {

        setItems([]);

      }

      try {

        const { data } = await api.get("/discounts");

        setDiscountsList(Array.isArray(data) ? data : []);

      } catch {

        setDiscountsList([]);

      }

      try {

        const { data } = await api.get("/restaurant/recipes");

        if (Array.isArray(data)) setRecipeLines(data);

      } catch {

        setRecipeLines([]);

      }

      try {

        const { data } = await api.get("/restaurant/inventory");

        if (Array.isArray(data)) setInventory(data);

      } catch {

        setInventory([]);

      }

      try {

        const { data } = await api.get("/einvoicing/config");

        const forms = data?.settings?.printForms;

        setEinvPrintForms(Array.isArray(forms) ? forms : []);

      } catch {

        setEinvPrintForms([]);

      }

    };

    load();

  }, [selectedSectionId]);



  useEffect(() => {

    const loadAssignments = async () => {

      if (!selectedSectionId) {

        setSectionMenuAssignments([]);

        return;

      }

      try {

        const { data } = await api.get(`/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus`);

        const list = Array.isArray(data) ? data : [];

        setSectionMenuAssignments(list);

        setSelectedMenuId((cur) => cur || list[0]?.menuId || "");

      } catch {

        setSectionMenuAssignments([]);

      }

    };

    loadAssignments();

  }, [selectedSectionId]);



  useEffect(() => {

    const loadMenuItems = async () => {

      if (!selectedMenuId) {

        setMenuEntries([]);

        return;

      }

      try {

        const { data } = await api.get(`/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}/entries`);

        setMenuEntries(Array.isArray(data) ? data : []);

      } catch {

        setMenuEntries([]);

      }

    };

    loadMenuItems();

  }, [selectedMenuId]);



  // Floorplan state reset per section

  useEffect(() => {

    setDirtyPosTableIds([]);

    setDirtyStyleTableIds([]);

    setSelectedObjectId("");

  }, [selectedSectionId]);



  useEffect(() => {

    const loadMenu = async () => {

      if (!selectedSectionId) {

        setMenu([]);

        return;

      }

      try {

        const { data } = await api.get(`/restaurant/menu-section=${encodeURIComponent(String(selectedSectionId))}`);

        setMenu(Array.isArray(data) ? data : []);

      } catch {

        setMenu([]);

      }

    };

    loadMenu();

  }, [selectedSectionId]);



  const addSection = async () => {

    if (saving.section) return;

    setSaving((s) => ({ ...s, section: true }));

    try {

      const name = String(formSection.name || "").trim();

      if (!name) {

        alert("Restaurant", "Name is required.");

        return;

      }



      const normalizeId = (value) =>

        String(value || "")

          .trim()

          .replace(/\s+/g, "-")

          .replace(/[^a-zA-Z0-9_-]/g, "")

          .slice(0, 64);

      const slugFromName = (value) => {

        const slug = normalizeId(String(value || "").toLowerCase());

        return slug || `section-${Date.now()}`;

      };



      const id = formSection.id ? normalizeId(formSection.id) : slugFromName(name);

      if (!id) {

        alert("Restaurant", "ID is required.");

        return;

      }



      const payload = {

        id,

        name,

        quickCashEnabled: !!formSection.quickCashEnabled,

        imageUrl: formSection.imageUrl?.trim() || undefined,

      };

      const { data } = await api.post("/restaurant/sections", payload);

      setSections((prev) => {

        const idx = prev.findIndex((s) => s.id === data.id);

        if (idx === -1) return [...prev, data];

        const next = [...prev];

        next[idx] = { ...next[idx], ...data };

        return next;

      });

      setFormSection({ id: "", name: "", imageUrl: "", quickCashEnabled: false });

      setSelectedSectionId(data.id);

      alert("Restaurant", "Section created.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not create section."));

    } finally {

      setSaving((s) => ({ ...s, section: false }));

    }

  };



  const removeSection = async (id) => {

    try {

      await api.delete(`/restaurant/sections/${encodeURIComponent(String(id))}`);

      setSections((prev) => prev.filter((s) => s.id !== id));

      if (selectedSectionId === id) setSelectedSectionId("");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not delete section."));

    }

  };



  const addTable = async () => {

    if (saving.table || !selectedSectionId || !formTable.id) return;

    setSaving((s) => ({ ...s, table: true }));

    try {

      const { data } = await api.post(`/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables`, {

        id: formTable.id,

        name: formTable.name || formTable.id,

        kind: formTable.kind || "mesa",

        size: Number(formTable.size) || 56,

        rotation: Number(formTable.rotation) || 0,

        color: formTable.color || "",

        colorHex: formTable.color || "",

        seats: Number(formTable.seats || 0) || 2,

        x: formTable.x === "" ? undefined : Number(formTable.x),

        y: formTable.y === "" ? undefined : Number(formTable.y),

      });

      setSections((prev) =>

        prev.map((s) => (s.id === selectedSectionId ? { ...s, tables: data } : s))

      );

      setFormTable({ id: "", name: "", kind: formTable.kind || "mesa", seats: 2, x: "", y: "", size: Number(formTable.size) || 56, rotation: Number(formTable.rotation) || 0, color: formTable.color || "" });

      alert("Restaurant", "Table added");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not add table."));

    } finally {

      setSaving((s) => ({ ...s, table: false }));

    }

  };



  const removeTable = async (tableId) => {

    if (!selectedSectionId) return;

    try {

      await api.delete(

        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables/${encodeURIComponent(String(tableId))}`

      );

      setSections((prev) =>

        prev.map((s) =>

          s.id === selectedSectionId ? { ...s, tables: (s.tables || []).filter((t) => t.id !== tableId) } : s

        )

      );

      clearPosDirty(tableId);

      clearStyleDirty(tableId);

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not delete table."));

    }

  };



  const updateSectionObjects = (sectionId, updater) => {

    setSections((prev) =>

      prev.map((s) => {

        if (String(s.id) !== String(sectionId)) return s;

        const current = Array.isArray(s.objects) ? s.objects : [];

        const nextObjects = updater(current);

        return { ...s, objects: nextObjects };

      })

    );

  };



  const addBarObject = async () => {

    if (!selectedSectionId) return;

    try {

      const payload = {

        kind: "BAR",

        label: "Barra",

        x: 50,

        y: 50,

        w: 24,

        h: 10,

        rotation: 0,

        color: "#f59e0b",

        meta: { iconUrl: BAR_DECOR_ICON_URL },

      };

      const { data } = await api.post(`/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/objects`, payload);

      updateSectionObjects(selectedSectionId, (prev) => [...prev, data]);

      setSelectedObjectId(String(data?.id || ""));

      alert("Restaurant", "Barra agregada.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "No se pudo agregar la barra."));

    }

  };



  const updateObjectXY = async (objectId, patch) => {

    if (!selectedSectionId || !objectId) return;

    try {

      const { data } = await api.patch(

        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/objects/${encodeURIComponent(String(objectId))}`,

        patch

      );

      updateSectionObjects(selectedSectionId, (prev) =>

        prev.map((o) => (String(o.id) === String(objectId) ? { ...o, ...data } : o))

      );

    } catch (err) {

      alert("Restaurant", getApiError(err, "No se pudo actualizar el objeto."));

    }

  };



  const removeObject = async (objectId) => {

    if (!selectedSectionId || !objectId) return;

    try {

      await api.delete(

        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/objects/${encodeURIComponent(String(objectId))}`

      );

      updateSectionObjects(selectedSectionId, (prev) => prev.filter((o) => String(o.id) !== String(objectId)));

      if (String(selectedObjectId) === String(objectId)) setSelectedObjectId("");

    } catch (err) {

      alert("Restaurant", getApiError(err, "No se pudo eliminar el objeto."));

    }

  };



  const saveLayoutPositions = async () => {

    if (!selectedSectionId) return;

    if ((dirtyPosTableIds || []).length === 0) return;

    const tables = (selectedSection?.tables || [])

      .map((t) => {

        const x = typeof t.x === "number" ? t.x : Number(t.x);

        const y = typeof t.y === "number" ? t.y : Number(t.y);

        const color = String(t.color || t.colorHex || t.iconColor || "").trim();

        return {

          id: t.id,

          kind: t.kind || "mesa",

          x,

          y,

          size: Number(t.size ?? 56) || 56,

          rotation: Number(t.rotation ?? 0) || 0,

          color,

          colorHex: color,

          iconColor: color,

        };

      })

      .filter((t) => Number.isFinite(t.x) && Number.isFinite(t.y));



    const moved = new Set((dirtyPosTableIds || []).map(String));

    const movedTables = tables.filter((t) => moved.has(String(t.id)));



    const results = await Promise.allSettled(

      movedTables.map((t) =>

        api.patch(

          `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables/${encodeURIComponent(String(t.id))}/position`,

          { x: t.x, y: t.y }

        )

      )

    );

    const patchOk = results.every((r) => r.status === "fulfilled");

    if (!patchOk) throw new Error("No se pudo guardar posiciones (backend rechaz la solicitud).");

    setDirtyPosTableIds([]);

  };



  // eslint-disable-next-line no-unused-vars

  const saveTableStyleLegacy = async (tableId, style) => {

    if (!selectedSectionId || !tableId) return;

    const base = (selectedSection?.tables || []).find((t) => String(t.id) === String(tableId)) || null;

    const x = typeof base?.x === "number" ? base.x : Number(base?.x);

    const y = typeof base?.y === "number" ? base.y : Number(base?.y);

    const color = String(style?.color || base?.color || base?.colorHex || base?.iconColor || "").trim();

    const payload = {

      id: String(tableId),

      kind: style?.kind ?? base?.kind,

      size: Number(style?.size ?? base?.size ?? 56) || 56,

      rotation: Number(style?.rotation ?? base?.rotation ?? 0) || 0,

      color,

      colorHex: color,

      iconColor: color,

      x: Number.isFinite(x) ? x : 50,

      y: Number.isFinite(y) ? y : 50,

    };



    const stylePayload = {

      kind: payload.kind,

      size: payload.size,

      rotation: payload.rotation,

      color: payload.color,

      colorHex: payload.color,

      iconColor: payload.color,

      iconSize: payload.size,

      angle: payload.rotation,

    };



    const isStylePersisted = (sectionsData) => {

      const sec = Array.isArray(sectionsData) ? sectionsData.find((s) => String(s?.id) === String(selectedSectionId)) : null;

      const t = sec?.tables ? sec.tables.find((tt) => String(tt?.id) === String(tableId)) : null;

      if (!t) return false;

      const savedColor = String(t.color || t.colorHex || t.iconColor || "").trim();

      const savedSize = Number(t.size ?? t.iconSize);

      const savedRotation = Number(t.rotation ?? t.angle);

      const wantColor = String(stylePayload.color || "").trim();

      const wantSize = Number(stylePayload.size);

      const wantRotation = Number(stylePayload.rotation);

      const colorOk = wantColor ? savedColor === wantColor : true;

      const sizeOk = Number.isFinite(wantSize) ? Number.isFinite(savedSize) && savedSize === wantSize : true;

      const rotationOk = Number.isFinite(wantRotation) ? Number.isFinite(savedRotation) && savedRotation === wantRotation : true;

      return colorOk && sizeOk && rotationOk;

    };



    const candidates = [

      { method: "patch", url: `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables/${encodeURIComponent(String(tableId))}`, data: stylePayload },

      { method: "put", url: `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables/${encodeURIComponent(String(tableId))}`, data: stylePayload },

      { method: "patch", url: `/restaurant/tables/${encodeURIComponent(String(tableId))}`, data: stylePayload },

      { method: "put", url: `/restaurant/tables/${encodeURIComponent(String(tableId))}`, data: stylePayload },

      // last resort: some backends accept style on /position

      { method: "patch", url: `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables/${encodeURIComponent(String(tableId))}/position`, data: stylePayload },

    ];



    const formatErr = (err) => {

      const status = err?.response?.status;

      const msg = err?.response?.data?.message || err?.message || "Error";

      if (status) return `${status}: ${msg}`;

      const baseURL = err?.config?.baseURL;

      const url = err?.config?.url;

      const full = baseURL && url ? `${String(baseURL).replace(/\/+$/, "")}${String(url).startsWith("/") ? "" : "/"}${String(url)}` : "";

      return full ? `${msg} (${full})` : msg;

    };



    let lastErr = null;

    for (const c of candidates) {

      try {

        // eslint-disable-next-line no-await-in-loop

        await api[c.method](c.url, c.data);



        // Verify persistence from backend (avoid false positives when backend ignores style fields).

        // eslint-disable-next-line no-await-in-loop

        const { data: secData } = await api.get("/restaurant/sections");

        if (Array.isArray(secData) && isStylePersisted(secData)) {

          setSections(secData);

          clearStyleDirty(tableId);

          return;

        }



        lastErr = `${c.method.toUpperCase()} ${c.url} -> 200 pero el backend no persisti (o no devuelve) color/tamao/rotacin.`;

      } catch (err) {

        lastErr = `${c.method.toUpperCase()} ${c.url} -> ${formatErr(err)}`;

      }

    }



    throw new Error(lastErr || "No se pudo guardar estilo.");

  };



  const saveTableStyle = async (tableId, style) => {

    if (!selectedSectionId || !tableId) return;

    const base = (selectedSection?.tables || []).find((t) => String(t.id) === String(tableId)) || null;

    const color = String(style?.color || base?.color || "").trim();

    const nextStyle = {

      kind: style?.kind ?? base?.kind ?? "mesa",

      size: Number(style?.size ?? base?.size ?? 56) || 56,

      rotation: Number(style?.rotation ?? base?.rotation ?? 0) || 0,

      color: color || "",

    };



    const isStylePersisted = (sectionsData) => {

      const sec = Array.isArray(sectionsData) ? sectionsData.find((s) => String(s?.id) === String(selectedSectionId)) : null;

      const t = sec?.tables ? sec.tables.find((tt) => String(tt?.id) === String(tableId)) : null;

      if (!t) return false;

      const savedColor = String(t.color || t.colorHex || t.iconColor || "").trim();

      const savedSize = Number(t.size ?? t.iconSize);

      const savedRotation = Number(t.rotation ?? t.angle);

      const wantColor = String(nextStyle.color || "").trim();

      const wantSize = Number(nextStyle.size);

      const wantRotation = Number(nextStyle.rotation);

      const colorOk = wantColor ? savedColor === wantColor : true;

      const sizeOk = Number.isFinite(wantSize) ? Number.isFinite(savedSize) && savedSize === wantSize : true;

      const rotationOk = Number.isFinite(wantRotation) ? Number.isFinite(savedRotation) && savedRotation === wantRotation : true;

      return colorOk && sizeOk && rotationOk;

    };



    const persistToGeneral = async () => {

      const { data: gen } = await api.get("/restaurant/general");

      const existing = gen && typeof gen === "object" ? gen : {};

      const prevStyles = existing.tableStyles && typeof existing.tableStyles === "object" ? existing.tableStyles : {};

      const secKey = String(selectedSectionId);

      const tableKey = String(tableId);

      const nextStyles = {

        ...prevStyles,

        [secKey]: {

          ...(prevStyles?.[secKey] && typeof prevStyles[secKey] === "object" ? prevStyles[secKey] : {}),

          [tableKey]: {

            ...((prevStyles?.[secKey]?.[tableKey] && typeof prevStyles[secKey][tableKey] === "object")

              ? prevStyles[secKey][tableKey]

              : {}),

            ...nextStyle,

          },

        },

      };

      const nextGeneral = { ...existing, tableStyles: nextStyles };

      await api.put("/restaurant/general", nextGeneral);

      setGeneral((prev) => ({ ...prev, ...nextGeneral }));

      setSections((prev) => applyTableStylesToSections(prev, nextStyles));

      clearStyleDirty(tableId);

    };



    try {

      await api.patch(

        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/tables/${encodeURIComponent(String(tableId))}`,

        nextStyle

      );

      const { data: secData } = await api.get("/restaurant/sections");

      if (Array.isArray(secData)) {

        setSections(secData);

        if (isStylePersisted(secData)) {

          clearStyleDirty(tableId);

          return;

        }

      }

      await persistToGeneral();

    } catch (err) {

      // Backward compatibility: if backend doesn't have the endpoint yet, keep the old fallback.

      if (err?.response?.status !== 404) {

        await persistToGeneral();

        return;

      }

      await persistToGeneral();

    }

  };



  const saveAllTableStyles = async () => {

    if (!selectedSectionId) return;

    const ids = Array.from(new Set(dirtyStyleTableIds || [])).map(String);

    if (ids.length === 0) return;

    for (const id of ids) {

      const table = (selectedSection?.tables || []).find((t) => String(t.id) === String(id)) || null;

      // eslint-disable-next-line no-await-in-loop

      await saveTableStyle(String(id), table || {});

    }

  };



  const saveFloorplan = async () => {

    if (!selectedSectionId || floorplanSaving) return;

    if (!floorplanHasChanges) return;

    setFloorplanSaving(true);

    try {

      if (floorplanDirty) await saveLayoutPositions();

      if ((dirtyStyleTableIds || []).length > 0) await saveAllTableStyles();

      alert("Restaurant", "Floorplan guardado.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "No se pudo guardar el floorplan."));

    } finally {

      setFloorplanSaving(false);

    }

  };



  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const toPct = (val, size) => (size ? (val / size) * 100 : 0);

  const snap = (n, step) => {

    const s = Number(step) || 0;

    if (!s) return n;

    return Math.round(n / s) * s;

  };

  const normDeg = (n) => {

    const v = Number(n) || 0;

    return ((v % 360) + 360) % 360;

  };

  const onCanvasPointerDown = (e, type, id) => {

    const el = e.currentTarget?.closest?.("[data-canvas]");

    if (!el) return;

    const rect = el.getBoundingClientRect();

    const startX = e.clientX;

    const startY = e.clientY;

    if (type === "table") {

      const base = (selectedSection?.tables || []).find((t) => t.id === id) || null;

      if (!base) return;

      setSelectedTableId(id);

      setSelectedObjectId("");

      dragLatestRef.current = {

        type: "table",

        mode: "move",

        id,

        x: Number(base.x ?? 50),

        y: Number(base.y ?? 50),

      };

      setDrag({

        type: "table",

        mode: "move",

        id,

        rect,

        startX,

        startY,

        baseX: Number(base.x ?? 50),

        baseY: Number(base.y ?? 50),

      });

      e.preventDefault();

      return;

    }

    if (type === "object") {

      const base = (selectedSection?.objects || []).find((o) => String(o.id) === String(id)) || null;

      if (!base) return;

      setSelectedObjectId(String(id));

      setSelectedTableId("");

      dragLatestRef.current = {

        type: "object",

        mode: "move",

        id,

        x: Number(base.x ?? 50),

        y: Number(base.y ?? 50),

      };

      setDrag({

        type: "object",

        mode: "move",

        id,

        rect,

        startX,

        startY,

        baseX: Number(base.x ?? 50),

        baseY: Number(base.y ?? 50),

      });

      e.preventDefault();

    }

  };



  useEffect(() => {

    if (!drag) return;

    const onMove = (e) => {

      if (drag.mode === "move") {

        const dx = e.clientX - drag.startX;

        const dy = e.clientY - drag.startY;

        const nx = clamp(drag.baseX + toPct(dx, drag.rect.width), 2, 98);

        const ny = clamp(drag.baseY + toPct(dy, drag.rect.height), 5, 95);

        dragLatestRef.current = { ...dragLatestRef.current, x: nx, y: ny };

        if (drag.type === "table") {

          markPosDirty(drag.id);

          if (drag.id === selectedTableId) setTableEdit((prev) => (prev ? { ...prev, x: nx, y: ny } : prev));

          setSections((prev) =>

            prev.map((s) =>

              s.id === selectedSectionId

                ? { ...s, tables: (s.tables || []).map((t) => (t.id === drag.id ? { ...t, x: nx, y: ny } : t)) }

                : s

            )

          );

        }

        if (drag.type === "object") {

          setSections((prev) =>

            prev.map((s) =>

              s.id === selectedSectionId

                ? { ...s, objects: (s.objects || []).map((o) => (String(o.id) === String(drag.id) ? { ...o, x: nx, y: ny } : o)) }

                : s

            )

          );

        }

        return;

      }

    };

    const onUp = () => {

      const latest = dragLatestRef.current;

      const nx = Number(latest?.x ?? drag.baseX);

      const ny = Number(latest?.y ?? drag.baseY);

      setDrag(null);

      if (drag.type === "table" && drag.id === selectedTableId) {

        setTableEdit((prev) => (prev ? { ...prev, x: nx, y: ny } : prev));

      }

      if (drag.type === "object") {

        updateObjectXY(drag.id, { x: nx, y: ny });

      }

    };

    window.addEventListener("pointermove", onMove);

    window.addEventListener("pointerup", onUp, { once: true });

    return () => {

      window.removeEventListener("pointermove", onMove);

    };

  // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [drag]);



  const selectedTable = useMemo(

    () => (selectedSection?.tables || []).find((t) => t.id === selectedTableId) || null,

    [selectedSection, selectedTableId]

  );



  const barObjects = useMemo(

    () => (selectedSection?.objects || []).filter((o) => String(o.kind || "").toUpperCase() === "BAR"),

    [selectedSection]

  );



  const filteredMenuEntries = useMemo(() => {

    const q = String(menuEntrySearch || "").trim().toLowerCase();

    if (!q) return menuEntries || [];

    return (menuEntries || []).filter((e) => {

      const it = e?.item || {};

      const hay = [it.familyName, it.subFamilyName, it.subSubFamilyName, it.code, it.name].filter(Boolean).join(" ").toLowerCase();

      return hay.includes(q);

    });

  }, [menuEntries, menuEntrySearch]);



  const menuPreviewGroups = useMemo(() => {

    const groups = new Map();

    (menu || []).forEach((m) => {

      const key = String(m?.category || "General").trim() || "General";

      const list = groups.get(key) || [];

      list.push(m);

      groups.set(key, list);

    });

    return Array.from(groups.entries())

      .map(([category, items]) => ({ category, items }))

      .sort((a, b) => a.category.localeCompare(b.category));

  }, [menu]);



  const isDarkHex = (hex) => {

    if (!hex) return false;

    const c = String(hex).trim().replace("#", "");

    if (!/^[0-9a-fA-F]{6}$/.test(c)) return false;

    const r = parseInt(c.slice(0, 2), 16);

    const g = parseInt(c.slice(2, 4), 16);

    const b = parseInt(c.slice(4, 6), 16);

    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    return luminance < 0.45;

  };



  useEffect(() => {

    if (!selectedMenuId) {

      setMenuEditForm({ name: "", active: true });

      return;

    }

    const m = (menus || []).find((x) => x.id === selectedMenuId);

    if (!m) return;

    setMenuEditForm({ name: String(m.name || ""), active: m.active !== false });

  }, [selectedMenuId, menus]);



  useEffect(() => {

    if (!selectedTable) {

      setTableEdit(null);

      return;

    }

    setTableEdit({

      id: selectedTable.id,

      kind: String(selectedTable.kind || "mesa").toLowerCase(),

      x: Number(selectedTable.x ?? 50),

      y: Number(selectedTable.y ?? 50),

      rotation: Number(selectedTable.rotation ?? 0),

      size: Number(selectedTable.size ?? 56),

      color: String(selectedTable.color || ""),

    });

  }, [selectedTableId, selectedTable]);



  const patchTableLocal = (tableId, patch) => {

    if (!tableId || !selectedSectionId) return;

    if (Object.prototype.hasOwnProperty.call(patch, "x") || Object.prototype.hasOwnProperty.call(patch, "y")) {

      markPosDirty(tableId);

    }

    if (

      Object.prototype.hasOwnProperty.call(patch, "size") ||

      Object.prototype.hasOwnProperty.call(patch, "rotation") ||

      Object.prototype.hasOwnProperty.call(patch, "color") ||

      Object.prototype.hasOwnProperty.call(patch, "kind")

    ) {

      markStyleDirty(tableId);

    }

    setSections((prev) =>

      prev.map((s) =>

        s.id === selectedSectionId

          ? { ...s, tables: (s.tables || []).map((t) => (t.id === tableId ? { ...t, ...patch } : t)) }

          : s

      )

    );

  };



  const applyTableEdit = (patch) => {

    if (!selectedTableId) return;

    setTableEdit((prev) => (prev ? { ...prev, ...patch } : prev));

    patchTableLocal(selectedTableId, patch);

  };



  const createMenu = async () => {

    const nm = String(menuName || "").trim();

    if (!nm) return alert("Restaurant", "Menu name is required.");

    try {

      const { data } = await api.post("/restaurant/menus", { name: nm, sectionIds: menuCreateSectionIds });

      setMenus((prev) => [...prev, data].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));

      setMenuName("");

      setMenuCreateSectionIds([]);

      if (!selectedMenuId) setSelectedMenuId(data.id);

      alert("Restaurant", "Menu created.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not create menu."));

    }

  };



  const saveSelectedMenu = async () => {

    if (!selectedMenuId) return;

    const payload = {

      name: String(menuEditForm.name || "").trim(),

      active: menuEditForm.active !== false,

    };

    if (!payload.name) return alert("Restaurant", "Menu name is required.");

    try {

      const { data } = await api.patch(`/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}`, payload);

      setMenus((prev) =>

        (prev || [])

          .map((m) => (m.id === selectedMenuId ? { ...m, ...data } : m))

          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))

      );

      alert("Restaurant", "Menu updated.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not update menu."));

    }

  };



  const deleteSelectedMenu = async () => {

    if (!selectedMenuId) return;

    if (!window.confirm("Delete this menu? This will remove its entries and schedules.")) return;

    try {

      await api.delete(`/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}`);

      setMenus((prev) => (prev || []).filter((m) => m.id !== selectedMenuId));

      setSelectedMenuId("");

      setMenuEntries([]);

      alert("Restaurant", "Menu deleted.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not delete menu."));

    }

  };



  const reloadMenuEntries = async () => {

    if (!selectedMenuId) return;

    try {

      const { data } = await api.get(`/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}/entries`);

      setMenuEntries(Array.isArray(data) ? data : []);

    } catch {

      // ignore

    }

  };



  const addItemToMenuFromPicker = async (itemId) => {

    if (!selectedMenuId) return;

    if (saving.menuEntries) return;

    setSaving((s) => ({ ...s, menuEntries: true }));

    try {

      await api.post(`/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}/entries`, { itemId });

      await reloadMenuEntries();

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not add item to menu."));

    } finally {

      setSaving((s) => ({ ...s, menuEntries: false }));

    }

  };



  const removeMenuEntry = async (entryId) => {

    if (!selectedMenuId) return;

    if (saving.menuEntries) return;

    setSaving((s) => ({ ...s, menuEntries: true }));

    try {

      await api.delete(

        `/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}/entries/${encodeURIComponent(String(entryId))}`

      );

      await reloadMenuEntries();

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not delete menu entry."));

    } finally {

      setSaving((s) => ({ ...s, menuEntries: false }));

    }

  };



  const patchItemQuick = async (itemId, patch) => {

    if (!itemId) return;

    try {

      const { data } = await api.patch(`/restaurant/items/${encodeURIComponent(String(itemId))}`, patch);

      setItems((prev) => (prev || []).map((it) => (it.id === itemId ? { ...it, ...data } : it)));

      setMenuEntries((prev) =>

        (prev || []).map((e) => (e.itemId === itemId && e.item ? { ...e, item: { ...e.item, ...data } } : e))

      );

      setMenu((prev) => (prev || []).map((m) => (m.id === itemId ? { ...m, ...data } : m)));

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not update item."));

    }

  };



  const removeActiveMenuPreviewItem = async (item) => {

    if (!item?.id) return;

    try {

      if (item.menuEntryId && item.menuId) {

        await api.delete(

          `/restaurant/menus/${encodeURIComponent(String(item.menuId))}/entries/${encodeURIComponent(String(item.menuEntryId))}`

        );

      } else if (selectedSectionId) {

        await api.delete(

          `/restaurant/menu/${encodeURIComponent(String(selectedSectionId))}/${encodeURIComponent(String(item.id))}`

        );

      }

      setMenu((prev) => prev.filter((m) => m.id !== item.id));

      setMenuEntries((prev) => prev.filter((e) => e.itemId !== item.id));

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not delete item."));

    }

  };



  const createMenuAssignment = async () => {

    if (!selectedSectionId) return alert("Restaurant", "Select a section first.");

    const menuId = String(menuAssignForm.menuId || selectedMenuId || "").trim();

    if (!menuId) return alert("Restaurant", "Select a menu to assign.");



    try {

      const payload = {

        menuId,

        daysMask: Number(menuAssignForm.daysMask ?? 127),

        startTime: menuAssignForm.startTime ? String(menuAssignForm.startTime).trim() : null,

        endTime: menuAssignForm.endTime ? String(menuAssignForm.endTime).trim() : null,

        priority: Number(menuAssignForm.priority ?? 0),

        active: menuAssignForm.active !== false,

      };

      const { data } = await api.post(

        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus`,

        payload

      );

      setSectionMenuAssignments((prev) => [data, ...prev]);

      setMenuAssignForm((p) => ({ ...p, menuId: "" }));

      alert("Restaurant", "Menu assigned to section.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not assign menu."));

    }

  };



  const removeMenuAssignment = async (assignmentId) => {

    if (!selectedSectionId) return;

    try {

      await api.delete(

        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus/${encodeURIComponent(String(assignmentId))}`

      );

      setSectionMenuAssignments((prev) => prev.filter((a) => a.id !== assignmentId));

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not delete assignment."));

    }

  };



  const savePrinters = async () => {

    const payload = { ...printers, printing };

    const { data } = await api.put("/restaurant/config", payload);

    setPrinters({

      kitchenPrinter: data?.kitchenPrinter || "",

      barPrinter: data?.barPrinter || "",

      cashierPrinter: data?.cashierPrinter || "",

    });

    const p = data?.printing && typeof data.printing === "object" ? data.printing : null;

    if (p) setPrinting((prev) => ({ ...prev, ...p, types: { ...prev.types, ...(p.types || {}) } }));

    alert("Restaurant", "Print settings saved");

  };



  const saveGeneral = async (silent = false) => {

    await api.put("/restaurant/general", general);

    if (!silent) alert("Restaurant", "General info saved");

  };



  const saveBilling = async (silent = false) => {

    await api.put("/restaurant/billing", billing);

    if (!silent) alert("Restaurant", "Billing saved");

  };



  const saveTaxes = async (silent = false) => {

    const payload = {

      iva: taxes.iva,

      servicio: taxes.servicio,

      descuentoMax: taxes.descuentoMax,

      permitirDescuentos: Boolean(taxes.permitirDescuentos),

      impuestoIncluido: Boolean(taxes.impuestoIncluido),

    };

    try {

      const { data } = await api.put("/restaurant/taxes", payload);

      if (data && typeof data === "object") {

        setTaxes((t) => ({

          ...t,

          iva: data.iva ?? t.iva,

          servicio: data.servicio ?? t.servicio,

          descuentoMax: data.descuentoMax ?? t.descuentoMax,

          permitirDescuentos: data.permitirDescuentos ?? t.permitirDescuentos,

          impuestoIncluido: data.impuestoIncluido ?? t.impuestoIncluido,

        }));

      }

      if (!silent) alert("Restaurant", "Taxes saved");

    } catch (err) {

      if (!silent) alert("Restaurant", getApiError(err, "Could not save taxes."));

      if (silent) throw err;

    }

  };



  const savePayments = async (silent = false) => {

    const enabledCobros = (payments.paymentMethods || [])

      .filter((m) => m && m.enabled !== false)

      .map((m) => String(m.name || "").trim())

      .filter(Boolean);



    const payload = { ...payments, cobros: enabledCobros };

    await api.put("/restaurant/payments", payload);

    if (!silent) alert("Restaurant", "Payments and currency saved");

  };



  const normalizeDiscountId = (value) =>

    String(value || "")

      .trim()

      .toUpperCase()

      .replace(/\s+/g, "_")

      .replace(/[^A-Z0-9_]/g, "")

      .slice(0, 32);



  const createDiscount = async () => {

    const name = String(discountForm.name || "").trim();

    const percent = Number(discountForm.percent || 0);

    if (!name) return alert("Restaurant", "Nombre del descuento requerido.");

    if (!Number.isFinite(percent) || percent <= 0) return alert("Restaurant", "Porcentaje invlido.");

    const id = normalizeDiscountId(name) || `DISC_${Date.now()}`;

    await api.post("/discounts", {

      id,

      name,

      type: "percent",

      value: percent,

      requiresPin: false,

      active: true,

    });

    setDiscountForm({ name: "", percent: "" });

    try {

      const { data } = await api.get("/discounts");

      setDiscountsList(Array.isArray(data) ? data : []);

    } catch {

      setDiscountsList([]);

    }

  };



  const toggleDiscountActive = async (d) => {

    if (!d?.id) return;

    await api.put(`/discounts/${encodeURIComponent(d.id)}`, {

      ...d,

      active: d.active === false ? true : false,

    });

    setDiscountsList((prev) =>

      (prev || []).map((x) => (x.id === d.id ? { ...x, active: !(d.active === false) } : x))

    );

  };



  const deleteDiscount = async (d) => {

    if (!d?.id) return;

    if (!window.confirm(`Eliminar descuento \"${d.name || d.id}\"?`)) return;

    await api.delete(`/discounts/${encodeURIComponent(d.id)}`);

    setDiscountsList((prev) => (prev || []).filter((x) => x.id !== d.id));

  };



  const saveGeneralConfig = async () => {

    try {

      await saveGeneral(true);

      await saveBilling(true);

      await savePayments(true);

      await saveTaxes(true);

      alert("Restaurant", "Configuración general guardada.");

    } catch (err) {

      alert("Restaurant", getApiError(err, "No se pudo guardar la configuracin general."));

    }

  };



  const MesaFreeIcon = ({ className = "" }) => {

    return (

      <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">

        <rect x="150" y="148" width="212" height="212" rx="22" fill="currentColor" />

        <rect x="164" y="162" width="184" height="184" rx="18" fill="currentColor" opacity="0.22" />



        <rect x="210" y="70" width="92" height="70" rx="30" fill="#374151" opacity="0.95" />

        <path d="M202 92c18-16 90-16 108 0" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

        {Array.from({ length: 9 }).map((_, i) => {

          const x = 210 + i * 10;

          return <line key={`t-${i}`} x1={x} y1="88" x2={x + 6} y2="128" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;

        })}



        <rect x="210" y="372" width="92" height="70" rx="30" fill="#374151" opacity="0.95" />

        <path d="M202 420c18 16 90 16 108 0" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

        {Array.from({ length: 9 }).map((_, i) => {

          const x = 210 + i * 10;

          return <line key={`b-${i}`} x1={x} y1="384" x2={x + 6} y2="424" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;

        })}



        <rect x="70" y="210" width="70" height="92" rx="30" fill="#374151" opacity="0.95" />

        <path d="M92 202c-16 18-16 90 0 108" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

        {Array.from({ length: 9 }).map((_, i) => {

          const y = 210 + i * 10;

          return <line key={`l-${i}`} x1="88" y1={y} x2="128" y2={y + 6} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;

        })}



        <rect x="372" y="210" width="70" height="92" rx="30" fill="#374151" opacity="0.95" />

        <path d="M420 202c16 18 16 90 0 108" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />

        {Array.from({ length: 9 }).map((_, i) => {

          const y = 210 + i * 10;

          return <line key={`r-${i}`} x1="384" y1={y} x2="424" y2={y + 6} stroke="currentColor" strokeWidth="6" strokeLinecap="round" />;

        })}

      </svg>

    );

  };



  const BASE_URL = import.meta.env.BASE_URL || "/";

  const CAMASTRO_FREE_ICON_URL = `${BASE_URL}assets/restaurant/camastro-free.png`;

  const TABURETE_FREE_ICON_URL = `${BASE_URL}assets/restaurant/taburete-free.png`;

  const BAR_DECOR_ICON_URL = `${BASE_URL}assets/restaurant/bar.svg`;



  const CamastroFreeIcon = ({ className = "" }) => {

    const [ok, setOk] = React.useState(true);

    if (!ok) return <MesaFreeIcon className={className} />;

    return (

      <img

        alt="Camastro"

        src={CAMASTRO_FREE_ICON_URL}

        className={className}

        style={{ objectFit: "contain" }}

        onError={() => setOk(false)}

      />

    );

  };



  const TabureteFreeIcon = ({ className = "" }) => {

    const [ok, setOk] = React.useState(true);

    if (!ok) return <MesaFreeIcon className={className} />;

    return (

      <img

        alt="Taburete"

        src={TABURETE_FREE_ICON_URL}

        className={className}

        style={{ objectFit: "contain" }}

        onError={() => setOk(false)}

      />

    );

  };



  const BarDecorIcon = ({ className = "", src }) => {

    const [ok, setOk] = React.useState(true);

    const resolved = src || BAR_DECOR_ICON_URL;

    if (!ok) {

      return <div className={`rounded-xl bg-orange-400/80 ${className}`} />;

    }

    return (

      <img

        alt="Barra"

        src={resolved}

        className={className}

        style={{ objectFit: "contain" }}

        onError={() => setOk(false)}

      />

    );

  };



  const getTableFreeIcon = (kind) => {

    const k = String(kind || "mesa").toLowerCase();

    if (k === "mesa") return MesaFreeIcon;

    if (k === "camastro") return CamastroFreeIcon;

    if (k === "taburete" || k === "butaca") return TabureteFreeIcon;

    return MesaFreeIcon;

  };



  const TABLE_KIND_OPTIONS = [

    { id: "mesa", label: "Mesa" },

    { id: "butaca", label: "Taburete" },

    { id: "camastro", label: "Camastro" },

    { id: "sillon", label: "Sill\u00F3n" },

    { id: "sofa", label: "Sof\u00E1" },

  ];



  const renderFloorplan = () => (

    <div className="space-y-4">

      <Card className="p-4 space-y-4">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-xs uppercase text-gray-500">Floorplan</div>

            <h3 className="font-semibold text-lg">Section layout editor</h3>

            <p className="text-sm text-gray-600">Drag tables to set X/Y. This is stored per hotel and rendered in the TPV.</p>

          </div>

          {selectedSectionId && (

            <div className="flex flex-col gap-1 text-xs text-slate-700">

              <div className="font-semibold">Fondo de la secci\u00f3n</div>

              <div className="flex items-center gap-2">

                <input

                  type="color"

                  value={backgroundForm.color || "#eefce5"}

                  onChange={(e) => setBackgroundForm((f) => ({ ...f, color: e.target.value }))}

                  className="h-10 w-16 rounded border"

                  title="Color de fondo"

                />

                <input

                  type="text"

                  value={backgroundForm.image || ""}

                  onChange={(e) => setBackgroundForm((f) => ({ ...f, image: e.target.value }))}

                  placeholder="URL de imagen opcional"

                  className="h-10 w-64 rounded border px-3 text-sm"

                />

                <Button

                  type="button"

                  variant="outline"

                  onClick={async () => {

                    if (!selectedSectionId) return;

                    const nextBackgrounds = {

                      ...(general.backgrounds || {}),

                      [selectedSectionId]: { color: backgroundForm.color || "", image: backgroundForm.image || "" },

                    };

                    const payload = { ...general, backgrounds: nextBackgrounds };

                    try {

                      await api.put("/restaurant/general", payload);

                      setGeneral((prev) => ({ ...prev, backgrounds: nextBackgrounds }));

                      alert("Restaurant", "Fondo guardado");

                    } catch (err) {

                      alert("Restaurant", getApiError(err, "No se pudo guardar el fondo."));

                    }

                  }}

                >

                  Guardar fondo

                </Button>

              </div>

            </div>

          )}

          <div className="flex items-center gap-2">

            {selectedSectionId && (

              <div className="flex items-center gap-2 text-xs text-slate-600">

                {floorplanHasChanges ? (

                  <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">

                    Cambios sin guardar

                  </span>

                ) : (

                  <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">

                    Guardado

                  </span>

                )}

                <Button type="button" onClick={saveFloorplan} disabled={floorplanSaving || !floorplanHasChanges}>

                  {floorplanSaving ? "Guardando..." : "Guardar todo"}

                </Button>

              </div>

            )}

            <select

              className="h-10 rounded-lg border px-3 text-sm"

              value={selectedSectionId || ""}

              onChange={(e) => setSelectedSectionId(e.target.value)}

              title="Select section"

            >

              {(sections || []).map((s) => (

                <option key={s.id} value={s.id}>

                  {s.name || s.id}

                </option>

              ))}

            </select>

          </div>

        </div>



        {!selectedSectionId && <div className="text-sm text-gray-600">Select a section first.</div>}



        {selectedSectionId && (

          <div className="grid lg:grid-cols-[1fr_360px] gap-4">

            <div className="space-y-3">

              <div

                data-canvas

                className="relative w-full h-[420px] rounded-2xl border overflow-hidden"

                style={{

                  backgroundColor: backgroundForm.color || "#f3fce8",

                  backgroundImage: backgroundForm.image ? `url(${backgroundForm.image})` : undefined,

                  backgroundSize: "cover",

                  backgroundPosition: "center",

                }}

              >

                <div className="absolute inset-x-4 top-3 flex justify-between text-[11px] text-amber-700">

                  <span>Entrance</span>

                  <span>Bar / Kitchen</span>

                </div>



                {(barObjects || []).map((o) => {

                  const iconSrc = o?.meta?.iconDataUrl || o?.meta?.iconUrl || BAR_DECOR_ICON_URL;

                  const selected = String(selectedObjectId) === String(o.id);

                  const w = Number(o.w ?? 24) || 24;

                  const h = Number(o.h ?? 10) || 10;

                  return (

                    <div

                      key={String(o.id)}

                      className={`absolute -translate-x-1/2 -translate-y-1/2 select-none ${selected ? "ring-2 ring-amber-400" : ""}`}

                      style={{

                        left: `${Number(o.x ?? 50)}%`,

                        top: `${Number(o.y ?? 50)}%`,

                        width: `${w}%`,

                        height: `${h}%`,

                        transform: `translate(-50%, -50%) rotate(${Number(o.rotation ?? 0)}deg)`,

                        zIndex: Number(o.zIndex ?? 0),

                      }}

                      onPointerDown={(e) => onCanvasPointerDown(e, "object", o.id)}

                      title="Barra"

                    >

                      <BarDecorIcon className="w-full h-full" src={iconSrc} />

                    </div>

                  );

                })}



                {(selectedSection?.tables || []).map((t) => {

                  const Icon = getTableFreeIcon(t.kind || "mesa");

                  const size = Number(t.size ?? 56) || 56;

                  const rotation = Number(t.rotation ?? 0) || 0;

                  const color = String(t.color || t.colorHex || t.iconColor || "").trim();

                  const selected = selectedTableId === t.id;

                  return (

                    <button

                      key={t.id}

                      type="button"

                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 select-none group"

                      style={{ left: `${Number(t.x ?? 50)}%`, top: `${Number(t.y ?? 50)}%` }}

                      onPointerDown={(e) => onCanvasPointerDown(e, "table", t.id)}

                      title={`Mesa ${t.id} (${t.seats} personas) - ${selectedSection?.name || selectedSection?.id || ""}`}

                    >

                      <div

                        className={`${selected ? "ring-2 ring-amber-500" : ""} rounded-xl`}

                        style={{ width: size, height: size, transform: `rotate(${rotation}deg)`, color: color || undefined }}

                      >

                        <Icon className="w-full h-full" />

                      </div>

                      <div

                        className={`text-sm font-bold bg-white/90 border rounded-lg px-2 py-0.5 shadow-sm transition ${selected ? "border-amber-400 text-amber-900" : "border-slate-200 text-amber-900 group-hover:border-amber-300"}`}

                      >

                        {t.id}

                      </div>

                    </button>

                  );

                })}



                {(selectedSection?.tables || []).length === 0 && (

                  <div className="absolute inset-0 flex items-center justify-center text-sm text-amber-700">

                    No tables in this section.

                  </div>

                )}

              </div>



              <div className="text-xs text-gray-500 hidden">

                Tip: Use Sections & tables to create tables first. Then come back here to position them.

              </div>

            </div>



            <div className="space-y-3">

              <Card className="p-3 space-y-2">

                <div className="font-semibold text-sm">Selected table</div>

                {!selectedTable || !tableEdit ? (

                  <div className="text-sm text-gray-600">Select a table on the map to edit its size, color, position and rotation.</div>

                ) : (

                  <>

                    <div className="flex items-center justify-between gap-2">

                      <div className="text-sm font-semibold truncate">{selectedTable.id}</div>

                      <div className="text-xs text-slate-500">

                        {(TABLE_KIND_OPTIONS.find((o) => o.id === String(tableEdit.kind || "mesa").toLowerCase())?.label) || "Mesa"}

                      </div>

                    </div>



                    <div className="grid grid-cols-2 gap-2">

                      <select

                        className="h-10 rounded-lg border px-3 text-sm"

                        value={tableEdit.kind || "mesa"}

                        onChange={(e) => applyTableEdit({ kind: e.target.value })}

                        title="Tipo"

                      >

                        {TABLE_KIND_OPTIONS.map((opt) => (

                          <option key={opt.id} value={opt.id}>

                            {opt.label}

                          </option>

                        ))}

                      </select>

                      <Input

                        type="number"

                        placeholder="Size (px)"

                        value={tableEdit.size ?? 56}

                        onChange={(e) => applyTableEdit({ size: clamp(Number(e.target.value || 56), 24, 160) })}

                      />



                      <Input

                        type="number"

                        placeholder="X %"

                        value={tableEdit.x}

                        onChange={(e) => applyTableEdit({ x: clamp(Number(e.target.value || 50), 2, 98) })}

                      />

                      <Input

                        type="number"

                        placeholder="Y %"

                        value={tableEdit.y}

                        onChange={(e) => applyTableEdit({ y: clamp(Number(e.target.value || 50), 5, 95) })}

                      />



                      <Input

                        type="number"

                        placeholder="Rotation (deg)"

                        value={tableEdit.rotation}

                        onChange={(e) => applyTableEdit({ rotation: normDeg(snap(Number(e.target.value || 0), rotationSnap)) })}

                      />

                      <div className="flex items-center gap-2 rounded-lg border px-2 h-10">

                        <input

                          type="color"

                          className="h-7 w-7 p-0 border-0 bg-transparent"

                          value={tableEdit.color || "#f59e0b"}

                          onChange={(e) => applyTableEdit({ color: e.target.value })}

                          title="Color"

                        />

                        <Input

                          placeholder="#rrggbb"

                          value={tableEdit.color || ""}

                          onChange={(e) => applyTableEdit({ color: e.target.value })}

                          className="border-0 h-9 px-2"

                        />

                      </div>



                      <div className="col-span-2 rounded-lg border px-3 py-2">

                        <div className="flex items-center justify-between gap-3">

                          <div className="text-xs font-semibold text-slate-700">Rotation snap</div>

                          <select

                            className="h-8 rounded-md border px-2 text-xs"

                            value={rotationSnap}

                            onChange={(e) => setRotationSnap(Number(e.target.value || 0))}

                          >

                            {[0, 5, 10, 15, 30, 45, 90].map((v) => (

                              <option key={v} value={v}>

                                {v === 0 ? "Off" : `${v}\u00B0`}

                              </option>

                            ))}

                          </select>

                        </div>

                        <div className="mt-2 flex items-center gap-2">

                          <button

                            type="button"

                            className="h-8 px-2 rounded border hover:bg-slate-50 text-xs"

                            onClick={() => applyTableEdit({ rotation: normDeg(Number(tableEdit.rotation || 0) - (Number(rotationSnap) || 0 || 15)) })}

                          >

                            -

                          </button>

                          <div className="text-xs text-slate-600">

                            {rotationSnap ? `${rotationSnap}\u00B0` : "Manual"}

                          </div>

                          <button

                            type="button"

                            className="h-8 px-2 rounded border hover:bg-slate-50 text-xs"

                            onClick={() => applyTableEdit({ rotation: normDeg(Number(tableEdit.rotation || 0) + (Number(rotationSnap) || 0 || 15)) })}

                          >

                            +

                          </button>

                        </div>

                      </div>



                      <div className="col-span-2 rounded-lg border px-3 py-2">

                        <div className="flex items-center justify-between gap-2">

                          <div className="text-xs font-semibold text-slate-700">Icon size</div>

                          <div className="text-xs text-slate-600">{Number(tableEdit.size ?? 56)}px</div>

                        </div>

                        <input

                          type="range"

                          min="24"

                          max="160"

                          value={Number(tableEdit.size ?? 56)}

                          onChange={(e) => applyTableEdit({ size: clamp(Number(e.target.value || 56), 24, 160) })}

                          className="w-full"

                        />

                      </div>

                    </div>



                    <div className="flex items-center justify-between gap-2 pt-1">

                      <div className="text-xs text-slate-500">

                        {dirtyStyleTableIds.includes(selectedTable.id) ? "Estilo sin guardar" : "Estilo guardado"}

                      </div>

                      <div className="text-xs text-slate-400">Usa "Guardar todo"</div>

                    </div>

                  </>

                )}

              </Card>



              <Card className="p-3 space-y-2">

                <div className="flex items-center justify-between gap-2">

                  <div className="font-semibold text-sm">Barra decorativa</div>

                  <Button type="button" variant="outline" onClick={addBarObject}>

                    Agregar barra

                  </Button>

                </div>

                <div className="text-xs text-slate-500">Arrastra la barra en el plano para ubicarla.</div>

                {(barObjects || []).length === 0 && <div className="text-sm text-gray-600">No hay barras en esta sección.</div>}

                {(barObjects || []).length > 0 && (

                  <div className="space-y-2">

                    {barObjects.map((o) => {

                      const iconSrc = o?.meta?.iconDataUrl || o?.meta?.iconUrl || BAR_DECOR_ICON_URL;

                      const isSelected = String(selectedObjectId) === String(o.id);

                      return (

                        <div

                          key={String(o.id)}

                          className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 ${isSelected ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}

                        >

                          <button

                            type="button"

                            className="flex items-center gap-2 min-w-0"

                            onClick={() => setSelectedObjectId(String(o.id))}

                          >

                            <div className="h-7 w-12">

                              <BarDecorIcon className="w-full h-full" src={iconSrc} />

                            </div>

                            <div className="text-xs font-semibold text-slate-700 truncate">{o.label || "Barra"}</div>

                          </button>

                          <button

                            type="button"

                            className="text-xs text-red-600"

                            onClick={(e) => {

                              e.preventDefault();

                              e.stopPropagation();

                              removeObject(o.id);

                            }}

                          >

                            Eliminar

                          </button>

                        </div>

                      );

                    })}

                  </div>

                )}

              </Card>



              

              <Card className="p-3 space-y-2">

                <div className="font-semibold text-sm">Selected object</div>

                {!selectedObject || !objectEdit ? (

                  <div className="text-sm text-gray-600">Select an object on the map or from the list.</div>

                ) : (

                  <>

                    <div className="flex items-center justify-between gap-2">

                      <div className="min-w-0 flex items-center gap-2">

                        <DecorPreview kind={String(selectedObject.kind || "OTHER").toUpperCase()} />

                        <div className="text-sm font-semibold truncate">{selectedObject.label || selectedObject.kind}</div>

                      </div>

                      <button className="text-xs text-red-600" onClick={() => removeObject(selectedObject.id)}>

                        Delete

                      </button>

                    </div>



                    <div className="grid grid-cols-2 gap-2">

                      <select

                        className="h-10 rounded-lg border px-3 text-sm"

                        value={objectEdit.kind}

                        onChange={(e) => setObjectEdit((p) => ({ ...p, kind: e.target.value }))}

                      >

                        {["LABEL", "BAR", "POOL", "PLANT", "WALL", "COUNTER", "DOOR", "WC", "OTHER"].map((k) => (

                          <option key={k} value={k}>

                            {k}

                          </option>

                        ))}

                      </select>

                      <Input placeholder="Label" value={objectEdit.label} onChange={(e) => setObjectEdit((p) => ({ ...p, label: e.target.value }))} />

                      <Input type="number" placeholder="X %" value={objectEdit.x} onChange={(e) => setObjectEdit((p) => ({ ...p, x: e.target.value }))} />

                      <Input type="number" placeholder="Y %" value={objectEdit.y} onChange={(e) => setObjectEdit((p) => ({ ...p, y: e.target.value }))} />

                      <Input type="number" placeholder="W %" value={objectEdit.w} onChange={(e) => setObjectEdit((p) => ({ ...p, w: e.target.value }))} />

                      <Input type="number" placeholder="H %" value={objectEdit.h} onChange={(e) => setObjectEdit((p) => ({ ...p, h: e.target.value }))} />

                      <Input

                        type="number"

                        placeholder="Layer (zIndex)"

                        value={objectEdit.zIndex}

                        onChange={(e) => setObjectEdit((p) => ({ ...p, zIndex: e.target.value }))}

                      />

                      <Input

                        type="number"

                        placeholder="Rotation (deg)"

                        value={objectEdit.rotation}

                        onChange={(e) =>

                          setObjectEdit((p) => ({ ...p, rotation: normDeg(snap(Number(e.target.value || 0), rotationSnap)) }))

                        }

                      />

                      <div className="col-span-2 rounded-lg border px-3 py-2">

                        <div className="flex items-center justify-between gap-3">

                          <div className="text-xs font-semibold text-slate-700">Rotation</div>

                          <select

                            className="h-8 rounded-md border px-2 text-xs"

                            value={rotationSnap}

                            onChange={(e) => setRotationSnap(Number(e.target.value || 0))}

                            title="Snap step"

                          >

                            <option value={0}>Snap off</option>

                            <option value={15}>Snap 15</option>

                            <option value={45}>Snap 45</option>

                            <option value={90}>Snap 90</option>

                          </select>

                        </div>

                        <input

                          type="range"

                          min={0}

                          max={359}

                          step={1}

                          className="w-full mt-2"

                          value={Number(objectEdit.rotation) || 0}

                          onChange={(e) =>

                            setObjectEdit((p) => ({ ...p, rotation: normDeg(snap(Number(e.target.value || 0), rotationSnap)) }))

                          }

                        />

                        <div className="flex gap-2 mt-2">

                          {[0, 90, 180, 270].map((deg) => (

                            <Button key={deg} type="button" variant="outline" className="h-8" onClick={() => setObjectEdit((p) => ({ ...p, rotation: deg }))}>

                              {deg}

                            </Button>

                          ))}

                        </div>

                      </div>

                      <div className="flex items-center gap-2 rounded-lg border px-2 h-10">

                        <input

                          type="color"

                          className="h-7 w-7 p-0 border-0 bg-transparent"

                          value={objectEdit.color || "#94a3b8"}

                          onChange={(e) => setObjectEdit((p) => ({ ...p, color: e.target.value }))}

                          title="Color"

                        />

                        <Input

                          placeholder="#rrggbb"

                          value={objectEdit.color}

                          onChange={(e) => setObjectEdit((p) => ({ ...p, color: e.target.value }))}

                          className="border-0 h-9 px-2"

                        />

                      </div>

                      <Input

                        placeholder="Icon URL (optional)"

                        value={objectEdit.iconUrl}

                        onChange={(e) => setObjectEdit((p) => ({ ...p, iconUrl: e.target.value, iconDataUrl: "" }))}

                        className="col-span-2"

                      />

                      <input

                        type="file"

                        accept="image/*,.svg"

                        className="col-span-2 text-xs"

                        onChange={(e) => setObjectIconFromFile(e.target.files?.[0], setObjectEdit)}

                      />

                      {(objectEdit.iconUrl || objectEdit.iconDataUrl) && (

                        <Button

                          type="button"

                          variant="outline"

                          className="col-span-2"

                          onClick={() => setObjectEdit((p) => ({ ...p, iconUrl: "", iconDataUrl: "" }))}

                        >

                          Clear icon

                        </Button>

                      )}

                    </div>



                    <div className="grid grid-cols-2 gap-2">

                      <Button

                        type="button"

                        variant="outline"

                        onClick={() => {

                          const zs = (objects || []).map((o) => Number(o.zIndex ?? 0));

                          const minZ = zs.length ? Math.min(...zs) : 0;

                          updateObjectXY(selectedObject.id, { zIndex: minZ - 1 });

                        }}

                      >

                        Send to back

                      </Button>

                      <Button type="button" variant="outline" onClick={() => updateObjectXY(selectedObject.id, { zIndex: Number(selectedObject.zIndex ?? 0) - 1 })}>

                        Backward

                      </Button>

                      <Button type="button" variant="outline" onClick={() => updateObjectXY(selectedObject.id, { zIndex: Number(selectedObject.zIndex ?? 0) + 1 })}>

                        Forward

                      </Button>

                      <Button

                        type="button"

                        variant="outline"

                        onClick={() => {

                          const zs = (objects || []).map((o) => Number(o.zIndex ?? 0));

                          const maxZ = zs.length ? Math.max(...zs) : 0;

                          updateObjectXY(selectedObject.id, { zIndex: maxZ + 1 });

                        }}

                      >

                        Bring to front

                      </Button>

                    </div>



                    <div className="flex items-center justify-between gap-2">

                      <div className="flex gap-2">

                        <Button

                          type="button"

                          variant="outline"

                          onClick={() =>

                            setObjectEdit((p) => ({ ...p, rotation: normDeg(snap(Number(p.rotation || 0) - 15, rotationSnap)) }))

                          }

                        >

                          Rotate -15

                        </Button>

                        <Button

                          type="button"

                          variant="outline"

                          onClick={() =>

                            setObjectEdit((p) => ({ ...p, rotation: normDeg(snap(Number(p.rotation || 0) + 15, rotationSnap)) }))

                          }

                        >

                          Rotate +15

                        </Button>

                      </div>

                      <Button

                        type="button"

                        onClick={() =>

                          updateObjectXY(selectedObject.id, {

                            kind: objectEdit.kind,

                            label: objectEdit.label,

                            x: Number(objectEdit.x),

                            y: Number(objectEdit.y),

                            w: Number(objectEdit.w),

                            h: Number(objectEdit.h),

                            zIndex: Number(objectEdit.zIndex),

                            rotation: Number(objectEdit.rotation),

                            color: objectEdit.color || null,

                            meta:

                              objectEdit.iconUrl || objectEdit.iconDataUrl

                                ? { iconUrl: objectEdit.iconUrl || undefined, iconDataUrl: objectEdit.iconDataUrl || undefined }

                                : {},

                          })

                        }

                      >

                        Save changes

                      </Button>

                    </div>

                  </>

                )}

              </Card>



              <Card className="p-3 space-y-2">

                <div className="font-semibold text-sm">Objects</div>

                <div className="grid grid-cols-3 gap-2">

                  {["LABEL", "BAR", "POOL", "PLANT", "WALL", "COUNTER", "DOOR", "WC", "OTHER"].map((k) => (

                    <button

                      key={k}

                      type="button"

                      className="h-9 rounded-lg border bg-white hover:bg-slate-50 text-xs font-semibold"

                      onClick={() => addObject(k)}

                    >

                      {k}

                    </button>

                  ))}

                </div>

                {(objects || []).length === 0 && <div className="text-sm text-gray-600">No objects yet.</div>}

                {(objects || []).length > 0 && (

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">

                    {objects.map((o) => (

                      <button

                        key={o.id}

                        type="button"

                        className={`w-full rounded-lg border p-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 ${

                          selectedObjectId === o.id ? "border-indigo-300 bg-indigo-50" : ""

                        }`}

                        onClick={() => setSelectedObjectId(o.id)}

                      >

                        <div className="min-w-0">

                          <div className="flex items-center gap-2">

                            {renderObjectIcon(o)}

                            <div className="text-sm font-semibold truncate">{o.label || o.kind}</div>

                          </div>

                          <div className="text-xs text-gray-500">

                            x:{Number(o.x ?? 0).toFixed(1)} y:{Number(o.y ?? 0).toFixed(1)} z:{Number(o.zIndex ?? 0)}

                          </div>

                        </div>

                        <button

                          type="button"

                          className="text-xs text-red-600"

                          onClick={(e) => {

                            e.preventDefault();

                            e.stopPropagation();

                            removeObject(o.id);

                          }}

                        >

                          Delete

                        </button>

                      </button>

                    ))}

                  </div>

                )}

              </Card>

              

            </div>

          </div>

        )}

        </Card>

      

      

    </div>

  );

  const addRecipeLine = async () => {

    if (!selectedRecipeItemId) return;

    const inventoryItemId = String(recipeLineForm.inventoryItemId || "").trim();

    const qty = Number(recipeLineForm.qty || 0);

    const unit = String(recipeLineForm.unit || "").trim();

    if (!inventoryItemId || !Number.isFinite(qty) || qty <= 0) return;

    const { data } = await api.post("/restaurant/recipes", {

      codigo: selectedRecipeItemId,

      ingrediente: inventoryItemId,

      cantidad: qty,

      unidad: unit || undefined,

    });

    setRecipeLines((prev) => [data, ...prev]);

    const inv = (inventory || []).find((i) => i.id === inventoryItemId);

    setRecipeLineForm({ inventoryItemId: "", qty: "", unit: inv?.unit || "" });

  };



  const removeRecipeLine = async (id) => {

    await api.delete(`/restaurant/recipes/${id}`);

    setRecipeLines((prev) => prev.filter((r) => r.id !== id));

  };



  const updateSectionMeta = async (sectionId, payload) => {

    if (!sectionId) return;

    try {

      const { data } = await api.patch(`/restaurant/sections/${encodeURIComponent(String(sectionId))}`, payload);

      setSections((prev) =>

        prev.map((s) =>

          String(s.id) === String(sectionId)

            ? {

                ...s,

                ...data,

                ...payload,

              }

            : s

        )

      );

    } catch (err) {

      alert("Restaurant", getApiError(err, "Could not update section."));

    }

  };

  const renderSections = ({ showSections = true, showTables = true, showMenus = true } = {}) => (

    <div className="space-y-4">

      {showSections && (

        <Card className="p-4 space-y-3">

          <div className="flex items-center justify-between gap-3 flex-wrap">

            <div>

              <div className="text-xs uppercase text-gray-500">Secciones</div>

              <h3 className="font-semibold text-lg">Secciones del restaurante</h3>

            </div>

            <Button onClick={addSection} disabled={saving.section || !String(formSection.name || "").trim()}>

              {saving.section ? "Guardando..." : "Crear sección"}

            </Button>

          </div>



          <div className="grid md:grid-cols-4 gap-3">

            <Input

              placeholder="Nombre"

              value={formSection.name}

              onChange={(e) => setFormSection((f) => ({ ...f, name: e.target.value }))}

            />

            <Input

              placeholder="ID (opcional)"

              value={formSection.id}

              onChange={(e) => setFormSection((f) => ({ ...f, id: e.target.value }))}

            />

            <Input

              placeholder="URL de imagen (opcional)"

              value={formSection.imageUrl}

              onChange={(e) => setFormSection((f) => ({ ...f, imageUrl: e.target.value }))}

            />

            <label className="flex items-center gap-2 text-sm">

              <input

                type="checkbox"

                checked={Boolean(formSection.quickCashEnabled)}

                onChange={(e) => setFormSection((f) => ({ ...f, quickCashEnabled: e.target.checked }))}

              />

              Caja rpida

            </label>

          </div>



          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {(sections || []).map((s) => (

              <div

                key={s.id}

                className={`rounded-xl border bg-white overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer ${

                  String(selectedSectionId) === String(s.id) ? "ring-2 ring-indigo-400" : ""

                }`}

                onClick={() => setSelectedSectionId(s.id)}

              >

                <div className="relative h-28 bg-slate-100">

                  {s.imageUrl ? (

                    <img src={s.imageUrl} alt={s.name || s.id} className="h-full w-full object-cover" />

                  ) : (

                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">

                      Sin imagen

                    </div>

                  )}

                </div>

                <div className="p-3 space-y-1">

                  <div className="text-xs uppercase text-gray-500">Seccin</div>

                  <div className="font-semibold text-slate-900">{s.name || s.id}</div>

                  <div className="text-xs text-slate-500">ID: {s.id}</div>

                  <div className="text-xs text-slate-500">{(s.tables || []).length} mesas</div>

                  <div className="flex items-center justify-between pt-2">

                    <button

                      type="button"

                      className="text-xs text-red-600"

                      onClick={(e) => {

                        e.preventDefault();

                        e.stopPropagation();

                        removeSection(s.id);

                      }}

                    >

                      Eliminar

                    </button>

                    <button

                      type="button"

                      className="text-xs text-indigo-600"

                      onClick={(e) => {

                        e.preventDefault();

                        e.stopPropagation();

                        setSelectedSectionId(s.id);

                      }}

                    >

                      Administrar

                    </button>

                  </div>

                </div>

              </div>

            ))}

            {(sections || []).length === 0 && (

              <div className="text-sm text-slate-500">No hay secciones creadas.</div>

            )}

          </div>

        </Card>

      )}



      {showTables && (

        <Card className="p-4 space-y-3">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-xs uppercase text-gray-500">Tables</div>

            <h3 className="font-semibold text-lg">Table layout</h3>

            <p className="text-xs text-gray-500 mt-1">Simple layout per section.</p>

          </div>

          <div className="flex gap-2">

            <div className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1">

              {TABLE_KIND_OPTIONS.map((opt) => {

                const Icon = getTableFreeIcon(opt.id);

                const activeKind = String(formTable.kind || "mesa").toLowerCase() === opt.id;

                return (

                  <button

                    key={opt.id}

                    type="button"

                    className={`h-9 w-9 rounded-lg border flex items-center justify-center transition ${

                      activeKind ? "bg-amber-100 border-amber-300" : "bg-white border-slate-200 hover:bg-slate-50"

                    }`}

                    onClick={() => setFormTable((f) => ({ ...f, kind: opt.id }))}

                    title={opt.label}

                    aria-label={opt.label}

                  >

                    <Icon className="h-6 w-6" />

                  </button>

                );

              })}

            </div>

            <select

              className="h-10 rounded-lg border px-3 text-sm"

              value={selectedSectionId || ""}

              onChange={(e) => setSelectedSectionId(e.target.value)}

              title="Section"

            >

              {(sections || []).map((s) => (

                <option key={s.id} value={s.id}>

                  {s.name || s.id}

                </option>

              ))}

            </select>

            <Input

              placeholder="Table ID"

              value={formTable.id}

              onChange={(e) => setFormTable((f) => ({ ...f, id: e.target.value, name: e.target.value }))}

              className="w-32"

            />

            <Input

              type="number"

              placeholder="Seats"

              value={formTable.seats}

              onChange={(e) => setFormTable((f) => ({ ...f, seats: e.target.value }))}

              className="w-24"

            />

            <Input

              type="number"

              placeholder="X %"

              value={formTable.x}

              onChange={(e) => setFormTable((f) => ({ ...f, x: e.target.value }))}

              className="w-20"

            />

            <Input

              type="number"

              placeholder="Y %"

              value={formTable.y}

              onChange={(e) => setFormTable((f) => ({ ...f, y: e.target.value }))}

              className="w-20"

            />

            <Button onClick={addTable} disabled={!selectedSectionId || saving.table} className="min-w-[140px]">

              {saving.table ? "Saving..." : "Add table"}

            </Button>

          </div>

        </div>

        {selectedSection ? (

          <>

            <div className="text-xs text-gray-500">Layout for: <span className="font-semibold">{selectedSection.name || selectedSection.id}</span></div>

            <div className="mt-2 border rounded-lg p-3 bg-slate-50">

              <div className="text-[11px] text-gray-500 mb-2">Simulated grid. Each card is a table.</div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">

                {(selectedSection.tables || []).map((t) => (

                  <div

                    key={t.id}

                    className="relative flex flex-col items-center justify-center rounded-xl border bg-white shadow-sm py-3 px-2"

                  >

                    <div className="text-sm text-gray-500">{selectedSection.name || selectedSection.id}</div>

                    <div className="text-base font-bold text-gray-800">{t.id}</div>

                    <div className="text-sm text-gray-500">{t.seats} personas</div>

                    <button

                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-100 text-red-600 text-xs flex items-center justify-center"

                      onClick={() => removeTable(t.id)}

                      title="Delete table"

                    >

                      <XIcon className="h-3.5 w-3.5" />

                    </button>

                  </div>

                ))}

                {(selectedSection.tables || []).length === 0 && (

                  <div className="text-sm text-gray-500 col-span-full">No tables in this section.</div>

                )}

              </div>

            </div>

          </>

        ) : (

          <div className="text-sm text-gray-500">Select a section to manage its tables.</div>

        )}

        </Card>

      )}



      {showMenus && (

      <Card className="p-4 space-y-3">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-xs uppercase text-gray-500">Menu</div>

            <h3 className="font-semibold text-lg">Menus & schedule (per section)</h3>

          </div>

        </div>



        <div className="grid lg:grid-cols-12 gap-4">

          <div className="lg:col-span-4 space-y-3 rounded-xl border bg-white p-3">

            <div className="text-sm font-semibold">Menus</div>

            <div className="flex gap-2">

              <Input placeholder="New menu name" value={menuName} onChange={(e) => setMenuName(e.target.value)} />

              <Button onClick={createMenu}>Create</Button>

            </div>

            <div className="rounded-xl border bg-white p-3 space-y-2">

              <div className="text-sm font-semibold">Visible in sections</div>

              <div className="text-xs text-gray-500">

                Select where this menu will be visible. A checkbox appears for every section you create.

              </div>

              <div className="grid gap-2">

                {(sections || []).map((s) => (

                  <label key={s.id} className="flex items-center gap-2 text-sm">

                    <input

                      type="checkbox"

                      checked={(menuCreateSectionIds || []).includes(s.id)}

                      onChange={(e) => {

                        const checked = e.target.checked;

                        setMenuCreateSectionIds((prev) => {

                          const list = Array.isArray(prev) ? [...prev] : [];

                          if (checked) {

                            if (!list.includes(s.id)) list.push(s.id);

                          } else {

                            return list.filter((x) => x !== s.id);

                          }

                          return list;

                        });

                      }}

                    />

                    {s.name || s.id}

                  </label>

                ))}

                {(sections || []).length === 0 && <div className="text-sm text-gray-500">No sections yet.</div>}

              </div>

            </div>

            <div className="grid gap-2 max-h-56 overflow-auto pr-1">

              {(menus || []).map((m) => (

                <button

                  key={m.id}

                  className={`px-3 py-2 rounded-lg border text-sm text-left ${selectedMenuId === m.id ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}

                  onClick={() => setSelectedMenuId(m.id)}

                  title={m.active === false ? "Inactive" : "Active"}

                >

                  <div className="font-semibold truncate">{m.name}</div>

                  <div className="text-[11px] text-slate-500">{m.active === false ? "Inactive" : "Active"}</div>

                </button>

              ))}

              {menus.length === 0 && <div className="text-sm text-gray-500">No menus yet.</div>}

            </div>



             {selectedMenuId && (

               <div className="rounded-xl border bg-white p-3 space-y-2">

                 <div className="text-sm font-semibold">Edit selected menu</div>

                 <div className="grid grid-cols-2 gap-2">

                   <Input

                     className="col-span-2"

                     placeholder="Menu name"

                     value={menuEditForm.name}

                     onChange={(e) => setMenuEditForm((p) => ({ ...p, name: e.target.value }))}

                   />

                   <label className="inline-flex items-center gap-2 text-sm">

                     <input

                       type="checkbox"

                       checked={menuEditForm.active !== false}

                       onChange={(e) => setMenuEditForm((p) => ({ ...p, active: e.target.checked }))}

                     />

                     Active

                   </label>

                   <div className="flex justify-end gap-2">

                     <Button variant="outline" onClick={deleteSelectedMenu}>

                       Delete

                     </Button>

                     <Button onClick={saveSelectedMenu}>Save</Button>

                   </div>

                 </div>

               </div>

             )}

           </div>



          <div className="lg:col-span-4 space-y-3 rounded-xl border bg-white p-3">

            <div className="text-sm font-semibold">Assign to section (schedule)</div>

            {!selectedSectionId ? (

              <div className="text-sm text-gray-500">Select a section first.</div>

            ) : (

              <>

                <div className="grid grid-cols-2 gap-2">

                  <select

                    className="h-10 rounded-lg border px-3 text-sm"

                    value={menuAssignForm.menuId}

                    onChange={(e) => setMenuAssignForm((p) => ({ ...p, menuId: e.target.value }))}

                    title="Menu"

                  >

                    <option value="">(use selected menu)</option>

                    {(menus || []).map((m) => (

                      <option key={m.id} value={m.id}>

                        {m.name}

                      </option>

                    ))}

                  </select>

                  <Input

                    type="number"

                    placeholder="Priority"

                    value={menuAssignForm.priority}

                    onChange={(e) => setMenuAssignForm((p) => ({ ...p, priority: e.target.value }))}

                  />

                  <Input

                    type="time"

                    placeholder="Start"

                    value={menuAssignForm.startTime}

                    onChange={(e) => setMenuAssignForm((p) => ({ ...p, startTime: e.target.value }))}

                  />

                  <Input

                    type="time"

                    placeholder="End"

                    value={menuAssignForm.endTime}

                    onChange={(e) => setMenuAssignForm((p) => ({ ...p, endTime: e.target.value }))}

                  />

                </div>

                <div className="flex flex-wrap gap-2 text-xs">

                  {[

                    { bit: 1 << 1, label: "Mon" },

                    { bit: 1 << 2, label: "Tue" },

                    { bit: 1 << 3, label: "Wed" },

                    { bit: 1 << 4, label: "Thu" },

                    { bit: 1 << 5, label: "Fri" },

                    { bit: 1 << 6, label: "Sat" },

                    { bit: 1 << 0, label: "Sun" },

                  ].map((d) => {

                    const checked = (Number(menuAssignForm.daysMask) & d.bit) !== 0;

                    return (

                      <label key={d.label} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white">

                        <input

                          type="checkbox"

                          checked={checked}

                          onChange={(e) =>

                            setMenuAssignForm((p) => ({

                              ...p,

                              daysMask: e.target.checked

                                ? Number(p.daysMask) | d.bit

                                : Number(p.daysMask) & ~d.bit,

                            }))

                          }

                        />

                        {d.label}

                      </label>

                    );

                  })}

                </div>

                <div className="flex justify-end">

                  <Button onClick={createMenuAssignment}>Assign</Button>

                </div>



                <div className="space-y-2">

                  {(sectionMenuAssignments || []).map((a) => (

                    <div key={a.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">

                      <div className="min-w-0">

                        <div className="font-semibold text-sm truncate">{a?.menu?.name || a.menuId}</div>

                        <div className="text-xs text-gray-500">

                          {a.startTime || "00:00"} - {a.endTime || "24:00"}  daysMask {a.daysMask}  prio {a.priority}

                        </div>

                        {a.active === false && <div className="text-xs text-amber-700 mt-1">Inactive</div>}

                      </div>

                      <button className="text-xs text-red-600" onClick={() => removeMenuAssignment(a.id)}>

                        Delete

                      </button>

                    </div>

                  ))}

                  {sectionMenuAssignments.length === 0 && (

                    <div className="text-sm text-gray-500">No schedules for this section yet.</div>

                  )}

                </div>

              </>

            )}

          </div>



          <div className="lg:col-span-4 space-y-3 rounded-xl border bg-white p-3">

            <div className="text-sm font-semibold">Menu items</div>

            {!selectedMenuId ? (

              <div className="text-sm text-gray-500">Select a menu to manage its items.</div>

            ) : (

              <>

                <div className="flex items-center justify-between gap-3">

                  <div className="text-sm text-gray-600">

                    Items: <span className="font-semibold">{menuEntries.length}</span>

                  </div>

                  <div className="flex items-center gap-2">

                    <Input

                      placeholder="Search assigned items..."

                      value={menuEntrySearch}

                      onChange={(e) => setMenuEntrySearch(e.target.value)}

                    />

                    <Button variant="outline" onClick={reloadMenuEntries} disabled={saving.menuEntries}>

                      Reload

                    </Button>

                    <Button onClick={() => setMenuPickerOpen(true)}>Open menu picker</Button>

                  </div>

                </div>

                <div className="text-xs text-gray-500">

                  Items are pulled from <span className="font-semibold">Artículos</span> and added to the menu.

                </div>



                <div className="rounded-xl border bg-white overflow-hidden">

                  <table className="w-full text-sm">

                    <thead className="bg-slate-50">

                      <tr className="text-xs text-slate-600">

                        <th className="text-left px-3 py-2">Family</th>

                        <th className="text-left px-3 py-2">Sub family</th>

                        <th className="text-left px-3 py-2">Sub subfamily</th>

                        <th className="text-left px-3 py-2">Article</th>

                        <th className="text-center px-3 py-2">Active</th>

                        <th className="text-center px-3 py-2">Color</th>

                        <th className="text-left px-3 py-2">Thumbnail</th>

                        <th className="text-right px-3 py-2">Actions</th>

                      </tr>

                    </thead>

                    <tbody className="divide-y">

                      {(filteredMenuEntries || []).map((e) => {

                        const it = e?.item || {};

                        const colorVal =

                          typeof it.color === "string" && /^#?[0-9a-fA-F]{6}$/.test(it.color)

                            ? it.color.startsWith("#")

                              ? it.color

                              : `#${it.color}`

                            : "#ffffff";

                        return (

                          <tr key={e.id} className="hover:bg-slate-50">

                            <td className="px-3 py-2">{it.familyName || "-"}</td>

                            <td className="px-3 py-2">{it.subFamilyName || "-"}</td>

                            <td className="px-3 py-2">{it.subSubFamilyName || "-"}</td>

                            <td className="px-3 py-2">

                              <div className="font-medium">{it.name || e.itemId}</div>

                              <div className="text-xs text-slate-500">{it.code || ""}</div>

                            </td>

                            <td className="px-3 py-2 text-center">

                              <input

                                type="checkbox"

                                checked={it.active !== false}

                                onChange={(ev) => patchItemQuick(e.itemId, { active: ev.target.checked })}

                                title="Enable/disable for sale"

                              />

                            </td>

                            <td className="px-3 py-2 text-center">

                              <input

                                type="color"

                                value={colorVal}

                                onChange={(ev) => {

                                  const v = ev.target.value;

                                  setMenuEntries((prev) =>

                                    (prev || []).map((x) =>

                                      x.itemId === e.itemId && x.item ? { ...x, item: { ...x.item, color: v } } : x

                                    )

                                  );

                                }}

                                onBlur={(ev) => patchItemQuick(e.itemId, { color: ev.target.value })}

                                title="Tile color"

                              />

                            </td>

                            <td className="px-3 py-2">

                              <div className="flex items-center gap-2">

                                <input

                                  className="h-9 w-full rounded-lg border px-2 text-xs"

                                  placeholder="Image URL (optional)"

                                  value={it.imageUrl || ""}

                                  onChange={(ev) => {

                                    const v = ev.target.value;

                                    setMenuEntries((prev) =>

                                      (prev || []).map((x) =>

                                        x.itemId === e.itemId && x.item ? { ...x, item: { ...x.item, imageUrl: v } } : x

                                      )

                                    );

                                  }}

                                  onBlur={(ev) => patchItemQuick(e.itemId, { imageUrl: ev.target.value })}

                                />

                                {it.imageUrl ? (

                                  <img

                                    src={it.imageUrl}

                                    alt=""

                                    className="h-9 w-9 rounded-lg object-cover border"

                                    onError={(ev) => {

                                      ev.currentTarget.style.display = "none";

                                    }}

                                  />

                                ) : null}

                              </div>

                            </td>

                            <td className="px-3 py-2 text-right">

                              <button

                                className="text-xs text-red-600 hover:underline"

                                onClick={() => removeMenuEntry(e.id)}

                                disabled={saving.menuEntries}

                              >

                                Remove

                              </button>

                            </td>

                          </tr>

                        );

                      })}

                      {(filteredMenuEntries || []).length === 0 && (

                        <tr>

                          <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>

                            No items assigned.

                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </>

            )}

          </div>

        </div>



        <div className="pt-3 border-t">

          <div className="text-sm font-semibold">Active items now (preview)</div>

          {!selectedSectionId ? (

            <div className="text-sm text-gray-500">Select a section to preview.</div>

          ) : (

            <div className="space-y-4 mt-2">

              {menuPreviewGroups.map((g) => (

                <div key={g.category} className="space-y-2">

                  <div className="text-xs uppercase tracking-wide text-slate-500">{g.category}</div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">

                    {(g.items || []).map((m) => {

                      const bg = typeof m.color === "string" && m.color.trim() ? m.color.trim() : "#ffffff";

                      const dark = isDarkHex(bg);

                      return (

                        <div

                          key={m.id}

                          className={`border rounded-lg p-3 flex justify-between items-start gap-3 ${dark ? "text-white" : "text-slate-900"}`}

                          style={{ backgroundColor: bg }}

                        >

                          <div className="min-w-0 flex items-start gap-2">

                            {m.imageUrl ? (

                              <img

                                src={m.imageUrl}

                                alt=""

                                className="h-12 w-12 rounded-lg object-cover border bg-white/60"

                                onError={(ev) => {

                                  ev.currentTarget.style.display = "none";

                                }}

                              />

                            ) : null}

                            <div className="min-w-0">

                              <div className="font-semibold text-sm truncate">{m.name}</div>

                              <div className={`text-xs ${dark ? "text-white/80" : "text-slate-600"}`}>

                                ${Number(m.price || 0).toFixed(2)}

                              </div>

                            </div>

                          </div>

                          <button

                            className={`text-xs ${dark ? "text-white/90" : "text-red-600"} hover:underline`}

                            onClick={() => removeActiveMenuPreviewItem(m)}

                            title="Remove"

                          >

                            Remove

                          </button>

                        </div>

                      );

                    })}

                  </div>

                </div>

              ))}

              {menu.length === 0 && <div className="text-sm text-gray-500">No active items for this section.</div>}

            </div>

          )}

        </div>

      </Card>

      )}



      {menuPickerOpen && (

        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden">

            <div className="flex items-center justify-between px-4 py-3 border-b">

              <div className="min-w-0">

                <div className="text-xs uppercase text-gray-500">Menu picker</div>

                <div className="font-semibold truncate">

                  {(menus || []).find((m) => m.id === selectedMenuId)?.name || "Menu"}

                </div>

              </div>

              <button

                className="h-9 w-9 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center"

                onClick={() => setMenuPickerOpen(false)}

                title="Close"

              >

                <XIcon className="h-5 w-5 text-slate-600" />

              </button>

            </div>



            <div className="p-4 grid md:grid-cols-[220px_1fr] gap-4">

              <div className="space-y-3">

                <Input

                  placeholder="Search items..."

                  value={menuPickerSearch}

                  onChange={(e) => setMenuPickerSearch(e.target.value)}

                />

                <div className="text-xs uppercase text-gray-500">Categories</div>

                <div className="space-y-2">

                  <button

                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${menuPickerCategory === "" ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}

                    onClick={() => setMenuPickerCategory("")}

                  >

                    All

                  </button>

                  {Array.from(

                    new Set(

                      (items || [])

                        .map((it) => String(it?.subSubFamily || it?.subFamily || it?.family || "General"))

                        .filter(Boolean)

                    )

                  )

                    .sort((a, b) => a.localeCompare(b))

                    .map((cat) => (

                      <button

                        key={cat}

                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${menuPickerCategory === cat ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}

                        onClick={() => setMenuPickerCategory(cat)}

                      >

                        {cat}

                      </button>

                    ))}

                </div>

              </div>



              <div className="space-y-3">

                <div className="flex items-center justify-between">

                  <div className="text-sm text-gray-600">

                    Click an item to add it to the menu. Items already in the menu are highlighted.

                  </div>

                  <Button variant="outline" onClick={reloadMenuEntries} disabled={saving.menuEntries}>

                    Refresh

                  </Button>

                </div>



                {(() => {

                  const q = String(menuPickerSearch || "").trim().toLowerCase();

                  const inMenu = new Map(menuEntries.map((e) => [e.itemId, e]));

                  const filtered = (items || [])

                    .filter((it) => it?.active !== false)

                    .filter((it) => {

                      if (menuPickerCategory) {

                        const cat = String(it?.subSubFamily || it?.subFamily || it?.family || "General");

                        if (cat !== menuPickerCategory) return false;

                      }

                      if (!q) return true;

                      return (

                        String(it?.name || "").toLowerCase().includes(q) ||

                        String(it?.code || "").toLowerCase().includes(q)

                      );

                    });



                  return (

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

                      {filtered.map((it) => {

                        const entry = inMenu.get(it.id);

                        const isInMenu = Boolean(entry);

                        const displayPrice = Number(it.price || 0);

                        return (

                          <button

                            key={it.id}

                            className={`text-left border rounded-xl p-3 hover:shadow-sm transition ${isInMenu ? "bg-emerald-50 border-emerald-200" : "bg-white"}`}

                            onClick={() => (isInMenu ? undefined : addItemToMenuFromPicker(it.id))}

                            disabled={saving.menuEntries}

                            title={isInMenu ? "Already in menu" : "Add to menu"}

                          >

                            <div className="flex items-start justify-between gap-2">

                              <div className="min-w-0">

                                <div className="text-xs text-gray-500">{it.code}</div>

                                <div className="font-semibold text-sm truncate">{it.name}</div>

                                <div className="text-xs text-gray-500 truncate">

                                  {String(it?.subSubFamily || it?.subFamily || it?.family || "General")}

                                </div>

                              </div>

                              {isInMenu ? (

                                <button

                                  className="h-7 w-7 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center text-xs"

                                  onClick={(e) => {

                                    e.stopPropagation();

                                    removeMenuEntry(entry.id);

                                  }}

                                  title="Remove from menu"

                                >

                                  <XIcon className="h-4 w-4 text-slate-600" />

                                </button>

                              ) : (

                                <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">

                                  Add

                                </span>

                              )}

                            </div>

                            <div className="mt-2 text-sm font-semibold">${displayPrice.toFixed(2)}</div>

                          </button>

                        );

                      })}

                      {filtered.length === 0 && <div className="text-sm text-gray-500 col-span-full">No items.</div>}

                    </div>

                  );

                })()}

              </div>

            </div>

          </div>

        </div>

      )}

    </div>

  );

  const renderPrinters = () => (

    <Card className="p-5 space-y-3">

      <div>

        <h3 className="font-semibold text-lg">Restaurant printers</h3>

        <p className="text-sm text-gray-600">Configure printer IDs for kitchen and bar (separate from Front Desk).</p>

      </div>

      <div className="grid md:grid-cols-3 gap-3">

        <Input

          placeholder="Kitchen printer ID"

          value={printers.kitchenPrinter}

          onChange={(e) => setPrinters((p) => ({ ...p, kitchenPrinter: e.target.value }))}

        />

        <Input

          placeholder="Bar printer ID"

          value={printers.barPrinter}

          onChange={(e) => setPrinters((p) => ({ ...p, barPrinter: e.target.value }))}

        />

        <Input

          placeholder="Cashier printer ID (tickets/invoices)"

          value={printers.cashierPrinter}

          onChange={(e) => setPrinters((p) => ({ ...p, cashierPrinter: e.target.value }))}

        />

      </div>



      <div className="pt-3 border-t">

        <div className="text-sm font-semibold">Printing</div>

        <div className="grid md:grid-cols-3 gap-3 mt-2">

          <label className="text-sm">

            <div className="text-xs text-gray-500 mb-1">Paper type</div>

            <select

              className="h-10 w-full rounded-lg border px-3 text-sm bg-white"

              value={printing.paperType || "80mm"}

              onChange={(e) => setPrinting((p) => ({ ...p, paperType: e.target.value }))}

            >

              <option value="80mm">80mm</option>

              <option value="58mm">58mm</option>

              <option value="A4">A4</option>

            </select>

          </label>

          <label className="text-sm">

            <div className="text-xs text-gray-500 mb-1">Default billing document</div>

            <select

              className="h-10 w-full rounded-lg border px-3 text-sm bg-white"

              value={printing.defaultDocType || "TE"}

              onChange={(e) => setPrinting((p) => ({ ...p, defaultDocType: e.target.value }))}

            >

              <option value="TE">Ticket (TE)</option>

              <option value="FE">Electronic invoice (FE)</option>

            </select>

          </label>

          <div className="text-xs text-gray-500 flex items-end">

            Configure 5 print types used across Restaurant.

          </div>

        </div>



        <div className="grid gap-2 mt-3">

          {[

            { key: "comanda", label: "Comanda", docType: "COMANDA" },

            { key: "ticket", label: "Ticket", docType: "TE" },

            { key: "document", label: "Subfactura", docType: "DOCUMENT" },

            { key: "electronicInvoice", label: "Factura (FE)", docType: "FE" },

            { key: "closes", label: "Cierre", docType: "CLOSES" },

          ].map((t) => {

            const cfg = printing.types?.[t.key] || { enabled: true, printerId: "", copies: 1, formId: "" };

            const docType = t.docType;

            const matchingForms = (einvPrintForms || [])

              .filter((f) => String(f?.module || "").toLowerCase() === "restaurant")

              .filter((f) => String(f?.docType || "").toUpperCase() === docType)

              .filter((f) => String(f?.paperType || "") === String(printing.paperType || "80mm"));

            return (

              <div key={t.key} className="grid md:grid-cols-[140px_120px_1fr_1fr_120px] gap-2 items-center border rounded-lg p-3 bg-slate-50">

                <div className="font-semibold text-sm">{t.label}</div>

                <label className="inline-flex items-center gap-2 text-sm">

                  <input

                    type="checkbox"

                    checked={cfg.enabled !== false}

                    onChange={(e) =>

                      setPrinting((p) => ({

                        ...p,

                        types: { ...p.types, [t.key]: { ...cfg, enabled: e.target.checked } },

                      }))

                    }

                  />

                  Enabled

                </label>

                <Input

                  placeholder="Printer ID (leave empty to use Cashier printer)"

                  value={cfg.printerId || ""}

                  onChange={(e) =>

                    setPrinting((p) => ({

                      ...p,

                      types: { ...p.types, [t.key]: { ...cfg, printerId: e.target.value } },

                    }))

                  }

                />

                <select

                  className="h-10 rounded-lg border px-3 text-sm bg-white"

                  value={cfg.formId || ""}

                  onChange={(e) =>

                    setPrinting((p) => ({

                      ...p,

                      types: { ...p.types, [t.key]: { ...cfg, formId: e.target.value } },

                    }))

                  }

                  title="Print form"

                >

                  <option value="">Default form</option>

                  {matchingForms.map((f) => (

                    <option key={f.id} value={f.id}>

                      {f.name}

                    </option>

                  ))}

                </select>

                <Input

                  type="number"

                  placeholder="Copies"

                  value={cfg.copies ?? 1}

                  onChange={(e) =>

                    setPrinting((p) => ({

                      ...p,

                      types: { ...p.types, [t.key]: { ...cfg, copies: Number(e.target.value || 1) } },

                    }))

                  }

                />

              </div>

            );

          })}

        </div>

      </div>



      <div className="flex justify-end">

        <Button onClick={savePrinters}>Save printers</Button>

      </div>

    </Card>

  );



  const renderItems = () => <RestaurantItems onItemsChange={setItems} />;



  const renderGroups = () => <RestaurantFamilies />;



  const renderTaxes = () => (

    <Card className="p-5 space-y-4">

      <div />



      <div className="grid lg:grid-cols-[1fr_auto_1.4fr] gap-6 items-start">

        <div className="space-y-3">

          <div className="text-[11px] uppercase tracking-wide text-slate-800 font-semibold">Impuestos</div>

          <div className="space-y-3">

            <div>

              <div className="text-xs uppercase text-gray-500 mb-1">IVA %</div>

              <Input

                type="number"

                placeholder="0"

                value={taxes.iva}

                onChange={(e) => setTaxes((t) => ({ ...t, iva: e.target.value }))}

                className="!w-20 !min-w-0"

              />

            </div>

            <div>

              <div className="text-xs uppercase text-gray-500 mb-1">Servicio %</div>

              <Input

                type="number"

                placeholder="0"

                value={taxes.servicio}

                onChange={(e) => setTaxes((t) => ({ ...t, servicio: e.target.value }))}

                className="!w-20 !min-w-0"

              />

            </div>

            <label className="flex items-center gap-2 text-sm h-10">

              <input

                type="checkbox"

                checked={Boolean(taxes.impuestoIncluido)}

                onChange={(e) => setTaxes((t) => ({ ...t, impuestoIncluido: e.target.checked }))}

              />

              Impuesto incluido en precios

            </label>

          </div>

        </div>



        <div className="hidden lg:block w-px bg-slate-200 self-stretch" />



        <div className="space-y-3">

          <div className="text-[11px] uppercase tracking-wide text-slate-800 font-semibold">

            Descuentos

          </div>

          <div className="flex items-center gap-2 text-sm h-10">

            <input

              type="checkbox"

              checked={Boolean(taxes.permitirDescuentos)}

              onChange={(e) => setTaxes((t) => ({ ...t, permitirDescuentos: e.target.checked }))}

            />

            Permitir descuentos en POS

          </div>

          <div className="grid md:grid-cols-2 gap-4 items-start">

            <div className="space-y-2">

              <Input

                placeholder="Nombre del descuento"

                value={discountForm.name}

                onChange={(e) => setDiscountForm((f) => ({ ...f, name: e.target.value }))}

                className="max-w-sm"

              />

              <div className="flex items-center gap-2">

                <Input

                  type="number"

                  placeholder="%"

                  value={discountForm.percent}

                  onChange={(e) => setDiscountForm((f) => ({ ...f, percent: e.target.value }))}

                  className="!w-20 !min-w-0"

                />

                <Button onClick={createDiscount}>Crear descuento</Button>

              </div>

            </div>

            <div className="border rounded-lg overflow-hidden max-w-sm">

              <div className="px-3 py-2 text-xs uppercase text-gray-500 bg-slate-50">Descuentos creados</div>

              {(discountsList || []).length ? (

                <div className="divide-y">

                    {(discountsList || []).map((d) => {

                        const name = d?.name || d?.id || "Descuento";

                        const value = Number(d?.value ?? 0);

                        const type = String(d?.type || "percent").toLowerCase();

                        const label = type === "money" ? value.toFixed(2) : `${value}%`;

                        return (

                          <div key={String(d.id || name)} className="flex items-center justify-between px-3 py-2 text-sm">

                            <div className="min-w-0">

                              <div className="font-medium text-slate-800 truncate">{name}</div>

                              <div className="text-xs text-slate-500">{label}</div>

                            </div>

                            <div className="flex items-center gap-2">

                              <label className="flex items-center gap-1 text-xs text-slate-600">

                                <input

                                  type="checkbox"

                                  checked={d.active !== false}

                                  onChange={() => toggleDiscountActive(d)}

                                />

                                Activo

                              </label>

                              <button

                                type="button"

                                className="text-xs text-red-600"

                                onClick={() => deleteDiscount(d)}

                              >

                                Eliminar

                              </button>

                            </div>

                          </div>

                        );

                      })}

                </div>

              ) : (

                <div className="px-3 py-3 text-sm text-slate-500">No hay descuentos creados.</div>

              )}

            </div>

          </div>

        </div>

      </div>

    </Card>

);



  const renderGeneral = ({ showSave = true } = {}) => (

    <Card className="p-5 space-y-3">

      <div className="flex items-center justify-between">

        <div>

          <h3 className="font-semibold text-lg">General info</h3>

          <p className="text-sm text-gray-600">Legal and contact details.</p>

        </div>

        {showSave && <Button onClick={saveGeneral}>Save</Button>}

      </div>

      <div className="grid md:grid-cols-2 gap-3">

        <Input placeholder="Trade name" value={general.nombreComercial} onChange={(e) => setGeneral((g) => ({ ...g, nombreComercial: e.target.value }))} />

        <Input placeholder="Legal name" value={general.razonSocial} onChange={(e) => setGeneral((g) => ({ ...g, razonSocial: e.target.value }))} />

        <Input placeholder="Legal ID" value={general.cedula} onChange={(e) => setGeneral((g) => ({ ...g, cedula: e.target.value }))} />

        <Input placeholder="Phone" value={general.telefono} onChange={(e) => setGeneral((g) => ({ ...g, telefono: e.target.value }))} />

        <Input placeholder="Email" value={general.email} onChange={(e) => setGeneral((g) => ({ ...g, email: e.target.value }))} />

        <Input placeholder="Address" value={general.direccion} onChange={(e) => setGeneral((g) => ({ ...g, direccion: e.target.value }))} />

        <Input placeholder="Business hours" value={general.horario} onChange={(e) => setGeneral((g) => ({ ...g, horario: e.target.value }))} />

        <Input placeholder="Tax authority resolution" value={general.resolucion} onChange={(e) => setGeneral((g) => ({ ...g, resolucion: e.target.value }))} />

      </div>

      <Textarea placeholder="Notes" value={general.notas} onChange={(e) => setGeneral((g) => ({ ...g, notas: e.target.value }))} />

    </Card>

  );



  const renderBilling = ({ showSave = true } = {}) => (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Billing</h3>
          <p className="text-sm text-gray-600">Receipt type, margin, and gratuity.</p>
        </div>
        {showSave && <Button onClick={saveBilling}>Save</Button>}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Ticket receipt type</label>
          <Input
            placeholder="e.g. tiquete / TE"
            value={billing.ticketComprobante || ""}
            onChange={(e) => setBilling((b) => ({ ...b, ticketComprobante: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Electronic invoice type</label>
          <Input
            placeholder="e.g. factura / FE"
            value={billing.invoiceComprobante || ""}
            onChange={(e) => setBilling((b) => ({ ...b, invoiceComprobante: e.target.value }))}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(billing.autoFactura)}
          onChange={(e) => setBilling((b) => ({ ...b, autoFactura: e.target.checked }))}
        />
        Auto-generate invoice/receipt per local requirements
      </label>
    </Card>
  );



  const currencyOptions = ["CRC", "USD", "EUR", "MXN", "COP", "NIO", "PAB", "GTQ"];



  const normalizePaymentMethodId = (value) =>

    String(value || "")

      .trim()

      .toLowerCase()

      .replace(/\s+/g, "-")

      .replace(/[^a-z0-9_-]/g, "")

      .slice(0, 64) || `pm-${Date.now()}`;



  const setPaymentMethodEnabled = (id, enabled) => {

    setPayments((prev) => ({

      ...prev,

      paymentMethods: (prev.paymentMethods || []).map((m) => (m.id === id ? { ...m, enabled: Boolean(enabled) } : m)),

    }));

  };



  const startNewPaymentMethod = () => {

    setSelectedPaymentMethodId("");

    setPaymentMethodForm({ id: "", name: "", account: "" });

  };



  const startEditPaymentMethod = (m) => {

    if (!m) return;

    setSelectedPaymentMethodId(m.id);

    setPaymentMethodForm({ id: m.id, name: m.name || "", account: m.account || "" });

  };



  const savePaymentMethodForm = () => {

    const name = String(paymentMethodForm.name || "").trim();

    if (!name) return;

    const id = paymentMethodForm.id || normalizePaymentMethodId(name);

    setPayments((prev) => {

      const list = Array.isArray(prev.paymentMethods) ? prev.paymentMethods : [];

      const exists = list.some((m) => m.id === id);

      const nextMethod = {

        id,

        name,

        enabled: exists ? list.find((m) => m.id === id)?.enabled !== false : true,

        account: String(paymentMethodForm.account || ""),

      };

      const next = exists ? list.map((m) => (m.id === id ? { ...m, ...nextMethod } : m)) : [...list, nextMethod];

      return { ...prev, paymentMethods: next };

    });

    setSelectedPaymentMethodId(id);

    setPaymentMethodForm({ id: "", name: "", account: "" });

  };



  const deleteSelectedPaymentMethod = () => {

    if (!selectedPaymentMethodId) return;

    if (!window.confirm("Eliminar este método de pago?")) return;

    setPayments((prev) => ({

      ...prev,

      paymentMethods: (prev.paymentMethods || []).filter((m) => m.id !== selectedPaymentMethodId),

    }));

    setSelectedPaymentMethodId("");

    setPaymentMethodForm({ id: "", name: "", account: "" });

  };



  const renderPayments = ({ showSave = true } = {}) => (

    <div className="space-y-4">

      <div className="flex items-center justify-between">

        <div>

          <h3 className="font-semibold text-lg">Pagos y divisa</h3>

          <p className="text-sm text-gray-600">Configura divisa del restaurante y los métodos de pago que se mostrarán en el TPV.</p>

        </div>

        {showSave && <Button onClick={savePayments}>Guardar</Button>}

      </div>



      <Card className="p-5 space-y-4">

        <div>

          <div className="text-xs uppercase text-gray-500">Divisa</div>

          <div className="font-semibold">Monedas y tipo de cambio</div>

          <div className="text-sm text-gray-600">

            Primero define la moneda base (la moneda en que se venden los artculos). Luego la moneda de cambio.

          </div>

        </div>



        <div className="grid md:grid-cols-3 gap-3">

          <label className="text-sm">

            <div className="text-xs text-gray-500 mb-1">Moneda base (ventas)</div>

            <select

              className="h-10 w-full rounded-lg border px-3 text-sm bg-white"

              value={payments.monedaBase || "CRC"}

              onChange={(e) => setPayments((p) => ({ ...p, monedaBase: e.target.value }))}

            >

              {currencyOptions.map((c) => (

                <option key={c} value={c}>

                  {c}

                </option>

              ))}

            </select>

          </label>



          <label className="text-sm">

            <div className="text-xs text-gray-500 mb-1">Moneda de cambio</div>

            <select

              className="h-10 w-full rounded-lg border px-3 text-sm bg-white"

              value={payments.monedaSec || "USD"}

              onChange={(e) => setPayments((p) => ({ ...p, monedaSec: e.target.value }))}

            >

              {currencyOptions

                .filter((c) => c !== String(payments.monedaBase || "").toUpperCase())

                .map((c) => (

                  <option key={c} value={c}>

                    {c}

                  </option>

                ))}

            </select>

          </label>



          <label className="text-sm">

            <div className="text-xs text-gray-500 mb-1">Tipo de cambio</div>

            <Input

              type="number"

              placeholder="Ej: 540"

              value={payments.tipoCambio}

              disabled={Boolean(payments.useBCCR)}

              onChange={(e) => setPayments((p) => ({ ...p, tipoCambio: e.target.value }))}

            />

            {Boolean(payments.useBCCR) && (

              <div className="text-[11px] text-gray-500 mt-1">Se actualizar automticamente (prximamente).</div>

            )}

          </label>

        </div>



        {isCostaRica && (

          <label className="flex items-center gap-2 text-sm">

            <input

              type="checkbox"

              checked={Boolean(payments.useBCCR)}

              onChange={(e) => setPayments((p) => ({ ...p, useBCCR: e.target.checked }))}

            />

            Activar API Banco Central (Costa Rica)

          </label>

        )}

      </Card>



      <Card className="p-5 space-y-4">

        <div>

          <div className="text-xs uppercase text-gray-500">Pagos</div>

          <div className="font-semibold">Mtodos de pago</div>

          <div className="text-sm text-gray-600">

            Activa o desactiva los métodos que deben aparecer en el TPV{isCostaRica ? " (Costa Rica)." : "."}

          </div>

        </div>



        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-start">

          <div className="space-y-2">

            <label className="flex items-center gap-2 text-sm">

              <input

                type="checkbox"

                checked={Boolean(payments.accountingEnabled)}

                onChange={(e) => setPayments((p) => ({ ...p, accountingEnabled: e.target.checked }))}

              />

              Contabilidad (prximamente)

            </label>

            <Input

              placeholder="Conector/ID contable (pendiente de mdulo de contabilidad)"

              value={payments.accountingConnectorRef || ""}

              onChange={(e) => setPayments((p) => ({ ...p, accountingConnectorRef: e.target.value }))}

              disabled={!payments.accountingEnabled}

            />

            <label className="flex items-center gap-2 text-sm">

              <input

                type="checkbox"

                checked={Boolean(payments.cargoHabitacion)}

                onChange={(e) => setPayments((p) => ({ ...p, cargoHabitacion: e.target.checked }))}

              />

              Permitir cargo a habitacin (usa Front Desk)

            </label>

          </div>



          <div className="flex flex-wrap gap-2 justify-end">

            <Button type="button" variant="outline" onClick={startNewPaymentMethod}>

              Nuevo

            </Button>

            <Button

              type="button"

              variant="outline"

              onClick={() => startEditPaymentMethod((payments.paymentMethods || []).find((m) => m.id === selectedPaymentMethodId))}

              disabled={!selectedPaymentMethodId}

            >

              Editar

            </Button>

            <Button type="button" variant="outline" onClick={deleteSelectedPaymentMethod} disabled={!selectedPaymentMethodId}>

              Eliminar

            </Button>

          </div>

        </div>



        <div className="grid md:grid-cols-[1fr_320px] gap-4">

          <div className="overflow-auto rounded-xl border">

            <table className="min-w-full text-sm">

              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">

                <tr>

                  <th className="px-3 py-2 text-left w-10">Sel</th>

                  <th className="px-3 py-2 text-left w-16">Activo</th>

                  <th className="px-3 py-2 text-left">Mtodo</th>

                  {payments.accountingEnabled && <th className="px-3 py-2 text-left">Cuenta</th>}

                  <th className="px-3 py-2 text-right w-28">Accin</th>

                </tr>

              </thead>

              <tbody>

                {(payments.paymentMethods || []).map((m) => {

                  const selected = m.id === selectedPaymentMethodId;

                  return (

                    <tr key={m.id} className={`border-b ${selected ? "bg-indigo-50" : "bg-white"}`}>

                      <td className="px-3 py-2">

                        <input type="radio" checked={selected} onChange={() => setSelectedPaymentMethodId(m.id)} />

                      </td>

                      <td className="px-3 py-2">

                        <input

                          type="checkbox"

                          checked={m.enabled !== false}

                          onChange={(e) => setPaymentMethodEnabled(m.id, e.target.checked)}

                        />

                      </td>

                      <td className="px-3 py-2 font-medium text-slate-800">{m.name}</td>

                      {payments.accountingEnabled && (

                        <td className="px-3 py-2 text-slate-600">{m.account ? <span className="font-mono">{m.account}</span> : "-"}</td>

                      )}

                      <td className="px-3 py-2 text-right">

                        <button

                          type="button"

                          className="text-xs px-2 py-1 rounded border hover:bg-slate-50"

                          onClick={() => startEditPaymentMethod(m)}

                        >

                          Editar

                        </button>

                      </td>

                    </tr>

                  );

                })}

                {(payments.paymentMethods || []).length === 0 && (

                  <tr>

                    <td className="px-3 py-4 text-slate-500" colSpan={payments.accountingEnabled ? 5 : 4}>

                      No hay métodos de pago configurados.

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>



          <Card className="p-4 space-y-3 border border-slate-200">

            <div className="font-semibold">Agregar / editar</div>

            <Input

              placeholder="Nombre del método (Ej: SINPE, Efectivo)"

              value={paymentMethodForm.name}

              onChange={(e) => setPaymentMethodForm((f) => ({ ...f, name: e.target.value }))}

            />

            {payments.accountingEnabled && (

              <Input

                placeholder="Cuenta contable (pendiente de mdulo de contabilidad)"

                value={paymentMethodForm.account}

                onChange={(e) => setPaymentMethodForm((f) => ({ ...f, account: e.target.value }))}

              />

            )}

            <div className="flex justify-end gap-2">

              <Button type="button" variant="outline" onClick={() => setPaymentMethodForm({ id: "", name: "", account: "" })}>

                Limpiar

              </Button>

              <Button type="button" onClick={savePaymentMethodForm}>

                Guardar método

              </Button>

            </div>

            <div className="text-[11px] text-gray-500">

              Nota: Estos métodos controlan qué opciones aparecen en el TPV. La integración contable es un placeholder.

            </div>

          </Card>

        </div>

      </Card>

    </div>

  );



  const renderRecipes = () => {

    const selectedItem = (items || []).find((i) => i.id === selectedRecipeItemId) || null;

    const lines = (recipeLines || []).filter((l) => l.restaurantItemId === selectedRecipeItemId);



    return (

      <Card className="p-5 space-y-3">

        <div>

          <h3 className="font-semibold text-lg">Recipes</h3>

          <p className="text-sm text-gray-600">Each recipe belongs to a sellable article and consumes inventory on payment.</p>

        </div>



        <div className="grid md:grid-cols-3 gap-3 items-end">

          <div className="md:col-span-2">

            <div className="text-xs text-slate-600 mb-1">Sellable article</div>

            <select

              className="h-10 rounded-lg border px-3 text-sm w-full"

              value={selectedRecipeItemId}

              onChange={(e) => setSelectedRecipeItemId(e.target.value)}

            >

              <option value="">Select an article</option>

              {(items || [])

                .slice()

                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))

                .map((it) => (

                  <option key={it.id} value={it.id}>

                    {it.name} ({it.code})

                  </option>

                ))}

            </select>

          </div>

          <div className="text-xs text-slate-500">

            {selectedItem ? (

              <div>

                <div className="font-semibold text-slate-700">{selectedItem.name}</div>

                <div className="text-[11px]">Recipe lines: {lines.length}</div>

              </div>

            ) : (

              <div>Select an article to manage its recipe.</div>

            )}

          </div>

        </div>



        {selectedRecipeItemId && (

          <Card className="p-3 space-y-2 bg-slate-50">

            <div className="font-semibold text-sm">Add ingredient</div>

            <div className="grid md:grid-cols-4 gap-2 items-end">

              <div className="md:col-span-2">

                <div className="text-xs text-slate-600 mb-1">Inventory item</div>

                <select

                  className="h-10 rounded-lg border px-3 text-sm w-full"

                  value={recipeLineForm.inventoryItemId}

                  onChange={(e) => {

                    const id = e.target.value;

                    const inv = (inventory || []).find((i) => i.id === id);

                    setRecipeLineForm((p) => ({ ...p, inventoryItemId: id, unit: inv?.unit || "" }));

                  }}

                >

                  <option value="">Select inventory item</option>

                  {(inventory || [])

                    .slice()

                    .sort((a, b) => String(a.desc || "").localeCompare(String(b.desc || "")))

                    .map((inv) => (

                      <option key={inv.id} value={inv.id}>

                        {inv.sku} - {inv.desc} ({inv.unit})

                      </option>

                    ))}

                </select>

              </div>

              <div>

                <div className="text-xs text-slate-600 mb-1">Qty</div>

                <Input

                  type="number"

                  placeholder="0"

                  value={recipeLineForm.qty}

                  onChange={(e) => setRecipeLineForm((p) => ({ ...p, qty: e.target.value }))}

                />

              </div>

              <div className="flex gap-2">

                <Input placeholder="Unit" value={recipeLineForm.unit} disabled />

                <Button onClick={addRecipeLine} disabled={!recipeLineForm.inventoryItemId || !(Number(recipeLineForm.qty) > 0)}>

                  Add

                </Button>

              </div>

            </div>

            <div className="text-xs text-slate-500">Tip: quantities are stored in the inventory unit.</div>

          </Card>

        )}



        <div className="overflow-auto border rounded-lg">

          <table className="min-w-full text-sm">

            <thead className="bg-slate-50 text-slate-600">

              <tr>

                <th className="px-3 py-2 text-left">Article</th>

                <th className="px-3 py-2 text-left">Ingredient</th>

                <th className="px-3 py-2 text-left">Qty</th>

                <th className="px-3 py-2 text-left">Unit</th>

                <th className="px-3 py-2 text-left"></th>

              </tr>

            </thead>

            <tbody>

              {lines.length ? (

                lines.map((l) => (

                  <tr key={l.id} className="border-t">

                    <td className="px-3 py-2">{l.restaurantItemName || l.restaurantItemCode || l.codigo || "-"}</td>

                    <td className="px-3 py-2">

                      {l.inventorySku || l.ingrediente} {l.inventoryDesc ? `- ${l.inventoryDesc}` : ""}

                    </td>

                    <td className="px-3 py-2">{Number(l.qty ?? l.cantidad ?? 0)}</td>

                    <td className="px-3 py-2">{l.unit || l.unidad || ""}</td>

                    <td className="px-3 py-2">

                      <button className="text-xs text-red-600" onClick={() => removeRecipeLine(l.id)}>

                        Delete

                      </button>

                    </td>

                  </tr>

                ))

              ) : (

                <tr>

                  <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>

                    {selectedRecipeItemId ? "No recipe lines yet for this article." : "Select an article to view its recipe."}

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </Card>

    );

  };

  const renderInventory = () => <RestaurantInventory />;

  const renderSectionsTabbed = () => (

    <div className="space-y-4">

      <Card className="p-3">

        <div className="flex flex-wrap gap-2">

          {TOP_TABS.map((tab) => (

            <button

              key={tab.id}

              type="button"

              onClick={() => setSubTab(tab.id)}

              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${

                subTab === tab.id

                  ? "bg-indigo-600 text-white border-indigo-600"

                  : "bg-white text-slate-700 border-slate-200 hover:bg-indigo-50"

              }`}

            >

              {tab.label}

            </button>

          ))}

        </div>

      </Card>



      {subTab === "sections" && renderSections({ showTables: false, showMenus: false })}

      {subTab === "tables" && (

        <div className="space-y-4">

          {renderSections({ showSections: false, showMenus: false })}

        </div>

      )}

      {subTab === "menus" && renderSections({ showSections: false, showTables: false })}

    </div>

  );

  const renderGeneralConfig = () => (

    <div className="space-y-4">

      <Card className="p-4 space-y-2">

        <div className="flex items-end justify-between gap-3 flex-wrap">

          <div className="flex items-baseline gap-2">

            <div className="font-semibold text-lg text-slate-900">Configuración general</div>

            <div className="font-semibold text-lg text-slate-900">Restaurante</div>

          </div>

          <Button onClick={saveGeneralConfig} className="mt-3">Guardar</Button>

        </div>

        <div className="flex flex-wrap gap-2">

          {[

            { id: "general", label: "Informacin general" },

            { id: "billing", label: "Facturacin" },

            { id: "payments", label: "Pagos y divisas" },

            { id: "taxes", label: "Impuestos y descuentos" },

          ].map((tab) => (

            <button

              key={tab.id}

              type="button"

              onClick={() => setGeneralConfigTab(tab.id)}

              className={`px-4 py-2 rounded-t-lg border text-sm font-semibold transition ${

                generalConfigTab === tab.id

                  ? "bg-white text-slate-900 border-slate-300 shadow-sm"

                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-white"

              }`}

            >

              {tab.label}

            </button>

          ))}

        </div>

      </Card>



      {generalConfigTab === "general" && renderGeneral({ showSave: false })}

      {generalConfigTab === "billing" && renderBilling({ showSave: false })}

      {generalConfigTab === "payments" && renderPayments({ showSave: false })}

      {generalConfigTab === "taxes" && renderTaxes()}

    </div>

  );

  const renderContent = () => {

    switch (active) {

      case "sections":

        return renderSectionsTabbed();

      case "floorplan":

        return renderFloorplan();

      case "printers":

        return renderPrinters();

      case "items":

        return renderItems();

      case "groups":

        return renderGroups();

      case "generalConfig":

      case "general":

      case "billing":

      case "payments":

      case "taxes":

        return renderGeneralConfig();

      case "recipes":

        return renderRecipes();

      case "inventory":

        return renderInventory();

      default:

        return renderSectionsTabbed();

    }

  };



  return (

    <div className="grid lg:grid-cols-[230px_1fr] gap-4">

      <Card className="p-3 space-y-2 h-max bg-indigo-900 text-indigo-50 border border-indigo-900 shadow-lg">

        <div className="text-[15px] text-center uppercase tracking-wide text-indigo-200 px-2">Configuración del restaurante</div>

        {NAV_TABS.map((tab) => (

          <button

            key={tab.id}

            onClick={() => setActive(tab.id)}

            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${

              active === tab.id

                ? "bg-indigo-700 text-white border border-indigo-500/60 shadow-sm"

                : "text-indigo-100 hover:bg-indigo-800/70"

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























































