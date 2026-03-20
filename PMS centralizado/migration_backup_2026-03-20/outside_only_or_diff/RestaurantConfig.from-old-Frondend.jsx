import React, { useEffect, useMemo, useRef, useState } from "react";



import { useLocation } from "react-router-dom";



import { X as XIcon } from "lucide-react";



import { Card } from "../../../components/ui/card";



import { Input } from "../../../components/ui/input";



import { Textarea } from "../../../components/ui/textarea";



import { Button } from "../../../components/ui/button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";



import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";



import RestaurantItems from "../Restaurant/RestaurantItems";



import RestaurantFamilies from "../Restaurant/RestaurantFamilies";



import RestaurantInventory from "../Restaurant/RestaurantInventory";



















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



        const x = Number(st.x);



        const y = Number(st.y);



        const color = String(st.color || st.colorHex || st.iconColor || "").trim();



        const kind = st.kind;



        if (Number.isFinite(size)) next.size = size;



        if (Number.isFinite(rotation)) next.rotation = rotation;



        if (Number.isFinite(x)) next.x = x;



        if (Number.isFinite(y)) next.y = y;



        if (color) next.color = color;



        if (kind) next.kind = kind;



        return next;



      }),



    };



  });



};







export default function RestaurantConfig() {



  const location = useLocation();



  const [active, setActive] = useState("generalConfig");



  const [generalConfigTab, setGeneralConfigTab] = useState("general");



  const [subTab, setSubTab] = useState("sections");



  const { t } = useLanguage();

  const navTabs = useMemo(
    () => [
      { id: "generalConfig", label: t("mgmt.restaurant.nav.general") },
      { id: "sections", label: t("mgmt.restaurant.nav.sectionsTables") },
      { id: "floorplan", label: t("mgmt.restaurant.nav.floorplan") },
      { id: "groups", label: t("mgmt.restaurant.nav.groups") },
      { id: "items", label: t("mgmt.restaurant.nav.items") },
      { id: "recipes", label: t("mgmt.restaurant.nav.recipes") },
      { id: "inventory", label: t("mgmt.restaurant.nav.inventory") },
      { id: "printers", label: t("mgmt.restaurant.nav.printers") },
    ],
    [t]
  );

  const tabs = useMemo(
    () => [
      { id: "sections", label: t("mgmt.restaurant.tabs.sectionsTables") },
      { id: "floorplan", label: t("mgmt.restaurant.tabs.floorplan") },
      { id: "printers", label: t("mgmt.restaurant.tabs.printers") },
      { id: "items", label: t("mgmt.restaurant.tabs.items") },
      { id: "groups", label: t("mgmt.restaurant.tabs.groups") },
      { id: "generalConfig", label: t("mgmt.restaurant.tabs.general") },
      { id: "recipes", label: t("mgmt.restaurant.tabs.recipes") },
      { id: "inventory", label: t("mgmt.restaurant.tabs.inventory") },
    ],
    [t]
  );

  const topTabs = useMemo(
    () => [
      { id: "sections", label: t("mgmt.restaurant.topTabs.sections") },
      { id: "tables", label: t("mgmt.restaurant.topTabs.tables") },
      { id: "menus", label: t("mgmt.restaurant.topTabs.menus") },
    ],
    [t]
  );

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
  const [menuDeleteTargetId, setMenuDeleteTargetId] = useState("");
  const [discountDeleteTarget, setDiscountDeleteTarget] = useState(null);
  const [paymentMethodDeleteTargetId, setPaymentMethodDeleteTargetId] = useState("");



  const [menuEditForm, setMenuEditForm] = useState({ name: "", active: true });



  const [menuEntries, setMenuEntries] = useState([]);



  const [sectionMenuAssignments, setSectionMenuAssignments] = useState([]);
  const [menuVisibilityMap, setMenuVisibilityMap] = useState({});
  const [editingAssignmentId, setEditingAssignmentId] = useState("");



  const [menuAssignForm, setMenuAssignForm] = useState({



    menuId: "",



    daysMask: 127,



    startTime: "",



    endTime: "",





    active: true,



  });



  const [menuPickerOpen, setMenuPickerOpen] = useState(false);



  const [menuPickerCategory, setMenuPickerCategory] = useState("");



  const [menuPickerSearch, setMenuPickerSearch] = useState("");
  const [menuPickerMenuId, setMenuPickerMenuId] = useState("");
  const [menuPickerEntries, setMenuPickerEntries] = useState([]);
  const [menuPickerSelectedIds, setMenuPickerSelectedIds] = useState([]);
  const [menuPickerFamily, setMenuPickerFamily] = useState("");



  const [menuEntrySearch, setMenuEntrySearch] = useState("");
  const managementPrimaryButtonClass = "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600";

  const sectionMenuRows = useMemo(() => {
    const list = Array.isArray(menus) ? menus : [];
    const assignmentList = Array.isArray(sectionMenuAssignments) ? sectionMenuAssignments : [];
    const visibilityByMenu = menuVisibilityMap && typeof menuVisibilityMap === "object" ? menuVisibilityMap : {};

    const menuById = new Map(list.map((menu) => [String(menu?.id || "").trim(), menu]).filter(([id]) => !!id));
    const assignmentByMenuId = new Map();
    assignmentList.forEach((assignment) => {
      const menuId = String(assignment?.menuId || assignment?.menu?.id || "").trim();
      if (!menuId || assignmentByMenuId.has(menuId)) return;
      assignmentByMenuId.set(menuId, assignment);
    });

    const rows = [];
    const seen = new Set();
    const pushRow = (menuIdRaw, fallbackName) => {
      const menuId = String(menuIdRaw || "").trim();
      if (!menuId || seen.has(menuId)) return;
      seen.add(menuId);
      const visibleSections = Array.isArray(visibilityByMenu[menuId]) ? visibilityByMenu[menuId] : [];
      const directAssignment = assignmentByMenuId.get(menuId) || null;
      const fallbackVisible = directAssignment ? null : visibleSections[0] || null;
      const assignment = directAssignment
        ? directAssignment
        : fallbackVisible
        ? {
            id: String(fallbackVisible?.assignmentId || "").trim(),
            sectionId: String(fallbackVisible?.sectionId || fallbackVisible?.id || "").trim(),
            menuId,
            daysMask: Number(fallbackVisible?.daysMask ?? 127),
            startTime: fallbackVisible?.startTime || null,
            endTime: fallbackVisible?.endTime || null,
            active: fallbackVisible?.active !== false,
          }
        : null;
      rows.push({
        menuId,
        menu: menuById.get(menuId) || { id: menuId, name: fallbackName || assignment?.menu?.name || menuId },
        assignment,
        visibleSections,
      });
    };

    list.forEach((menu) => pushRow(menu?.id, menu?.name));
    assignmentList.forEach((assignment) => pushRow(assignment?.menuId || assignment?.menu?.id, assignment?.menu?.name));
    Object.keys(visibilityByMenu || {}).forEach((menuId) => pushRow(menuId, ""));

    return rows
      .filter((row) => row?.assignment || (Array.isArray(row?.visibleSections) && row.visibleSections.length > 0))
      .sort((a, b) => String(a?.menu?.name || a?.menuId || "").localeCompare(String(b?.menu?.name || b?.menuId || "")));
  }, [menus, sectionMenuAssignments, menuVisibilityMap]);



  const [drag, setDrag] = useState(null); // { type: 'table', mode: 'move', id, rect, startX, startY, baseX, baseY }

  const formatDaysMask = (mask) => {
    const m = Number(mask ?? 0);
    const days = [
      { bit: 1 << 1, label: "Lun" },
      { bit: 1 << 2, label: "Mar" },
      { bit: 1 << 3, label: "Mie" },
      { bit: 1 << 4, label: "Jue" },
      { bit: 1 << 5, label: "Vie" },
      { bit: 1 << 6, label: "Sab" },
      { bit: 1 << 0, label: "Dom" },
    ];
    const allMask = days.reduce((acc, d) => acc | d.bit, 0);
    const weekendMask = (1 << 5) | (1 << 6) | (1 << 0);
    if ((m & allMask) === allMask) return "Semanal";
    if ((m & weekendMask) === weekendMask && (m & ~weekendMask) === 0) return "Fin de sem.";
    return days.filter((d) => (m & d.bit) !== 0).map((d) => d.label).join(", ") || "-";
  };



  const dragLatestRef = useRef(null);



  const [selectedTableId, setSelectedTableId] = useState("");



  const [tableEdit, setTableEdit] = useState(null);



  const [rotationSnap, setRotationSnap] = useState(15); // 0 = off



  const [floorplanSaving, setFloorplanSaving] = useState(false); // posiciones
  const [floorplanError, setFloorplanError] = useState("");



  const [dirtyPosTableIds, setDirtyPosTableIds] = useState([]); // X/Y moved on floorplan



  const [dirtyStyleTableIds, setDirtyStyleTableIds] = useState([]); // size/rotation/color changed

  const filteredMenuEntries = useMemo(() => {
    const list = Array.isArray(menuEntries) ? menuEntries : [];
    const q = String(menuEntrySearch || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((entry) => {
      const it = entry?.item || {};
      const hay = [
        it.name,
        it.code,
        it.familyName,
        it.subFamilyName,
        it.subSubFamilyName,
        entry?.itemId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [menuEntries, menuEntrySearch]);



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
  const backgroundDirty = (() => {
    if (!selectedSectionId) return false;
    const bg = general?.backgrounds?.[selectedSectionId] || {};
    return (backgroundForm.color || "") !== (bg.color || "") || (backgroundForm.image || "") !== (bg.image || "");
  })();



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

  const patchTableLocal = (tableId, patch) => {
    if (!tableId || !selectedSectionId) return;
    setSections((prev) =>
      (prev || []).map((s) => {
        if (s.id !== selectedSectionId) return s;
        const tables = (s.tables || []).map((t) => (t.id === tableId ? { ...t, ...patch } : t));
        return { ...s, tables };
      })
    );
    if (Object.prototype.hasOwnProperty.call(patch, "x") || Object.prototype.hasOwnProperty.call(patch, "y")) {
      markPosDirty(tableId);
    }
    if (
      Object.prototype.hasOwnProperty.call(patch, "size") ||
      Object.prototype.hasOwnProperty.call(patch, "rotation") ||
      Object.prototype.hasOwnProperty.call(patch, "color") ||
      Object.prototype.hasOwnProperty.call(patch, "colorHex")
    ) {
      markStyleDirty(tableId);
    }
  };

  const onCanvasPointerDown = (e, type, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "table") setSelectedTableId(String(id));
  };

  const saveFloorplan = async () => {
    if (!selectedSectionId || floorplanSaving) return;
    setFloorplanSaving(true);
    setFloorplanError("");
    try {
      const sec = sections.find((s) => s.id === selectedSectionId);
      const tables = Array.isArray(sec?.tables) ? sec.tables : [];

      try {
        await api.put(`/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/layout`, {
          tables,
        });
      } catch {
        // ignore if backend does not support /layout
      }

      const tableStyles = { ...(general?.tableStyles || {}) };
      const styleById = {};
      tables.forEach((t) => {
        if (!t?.id) return;
        const entry = {};
        if (Number.isFinite(Number(t.size))) entry.size = Number(t.size);
        if (Number.isFinite(Number(t.rotation))) entry.rotation = Number(t.rotation);
        if (Number.isFinite(Number(t.x))) entry.x = Number(t.x);
        if (Number.isFinite(Number(t.y))) entry.y = Number(t.y);
        const color = String(t.color || t.colorHex || "").trim();
        if (color) entry.color = color;
        if (Object.keys(entry).length > 0) styleById[t.id] = entry;
      });
      if (Object.keys(styleById).length > 0) {
        tableStyles[selectedSectionId] = styleById;
      } else {
        delete tableStyles[selectedSectionId];
      }

      const backgrounds = { ...(general?.backgrounds || {}) };
      if (backgroundForm.color || backgroundForm.image) {
        backgrounds[selectedSectionId] = {
          color: backgroundForm.color || "",
          image: backgroundForm.image || "",
        };
      } else {
        delete backgrounds[selectedSectionId];
      }

      const nextGeneral = { ...general, tableStyles, backgrounds };
      setGeneral(nextGeneral);
      await api.put("/restaurant/general", nextGeneral);

      tables.forEach((t) => {
        if (!t?.id) return;
        clearPosDirty(t.id);
        clearStyleDirty(t.id);
      });

      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.floorplanSaved"));
    } catch (err) {
      const msg = getApiError(err, "No se pudo guardar el plano.");
      setFloorplanError(msg);
      alert(t("mgmt.restaurant.alert.title"), msg);
    } finally {
      setFloorplanSaving(false);
    }
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
    ticketHeader: "",
    ticketFooter: "",
    invoiceHeader: "",
    invoiceFooter: "",
    reprintHeader: "",
    reprintFooter: "",
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
  const selectedTable = useMemo(() => {
    if (!selectedSectionId) return null;
    const sec = sections.find((s) => s.id === selectedSectionId);
    if (!sec) return null;
    return (sec.tables || []).find((t) => t.id === selectedTableId) || null;
  }, [sections, selectedSectionId, selectedTableId]);



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



    if (tabs.some((t) => t.id === tab)) {



      setActive(tab);



      return;



    }



    if (topTabs.some((t) => t.id === tab)) {



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



        const { data } = await api.get("/restaurant/print-forms");



        const forms = data?.forms;



        setEinvPrintForms(Array.isArray(forms) ? forms : []);



      } catch {



        try {



          const { data } = await api.get("/einvoicing/config");



          const forms = data?.settings?.printForms;



          setEinvPrintForms(Array.isArray(forms) ? forms : []);



        } catch {



          setEinvPrintForms([]);



        }



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
    let cancelled = false;

    const loadMenuVisibility = async () => {
      const sectionList = Array.isArray(sections) ? sections : [];
      if (sectionList.length === 0) {
        setMenuVisibilityMap({});
        return;
      }

      const results = await Promise.all(
        sectionList.map(async (section) => {
          const sectionId = String(section?.id || "").trim();
          if (!sectionId) return { section, assignments: [] };
          try {
            const { data } = await api.get(`/restaurant/sections/${encodeURIComponent(sectionId)}/menus`);
            return { section, assignments: Array.isArray(data) ? data : [] };
          } catch {
            return { section, assignments: [] };
          }
        })
      );

      if (cancelled) return;

      const next = {};
      results.forEach(({ section, assignments }) => {
        const sectionId = String(section?.id || "").trim();
        if (!sectionId) return;
        const sectionName = String(section?.name || sectionId).trim();
        assignments.forEach((assignment) => {
          const menuId = String(assignment?.menuId || assignment?.menu?.id || "").trim();
          if (!menuId) return;
          if (!Array.isArray(next[menuId])) next[menuId] = [];
          if (!next[menuId].some((entry) => entry.id === sectionId)) {
            next[menuId].push({
              id: sectionId,
              name: sectionName,
              sectionId,
              assignmentId: String(assignment?.id || "").trim(),
              menuId,
              daysMask: Number(assignment?.daysMask ?? 127),
              startTime: assignment?.startTime || null,
              endTime: assignment?.endTime || null,
              active: assignment?.active !== false,
            });
          }
        });
      });

      Object.keys(next).forEach((menuId) => {
        next[menuId] = (next[menuId] || []).sort((a, b) =>
          String(a?.name || a?.id || "").localeCompare(String(b?.name || b?.id || ""))
        );
      });

      setMenuVisibilityMap(next);
    };

    loadMenuVisibility();

    return () => {
      cancelled = true;
    };
  }, [sections, menus, sectionMenuAssignments]);

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
    if (!menuPickerOpen) return;
    const fallback = selectedMenuId || (menus && menus[0] ? menus[0].id : "");
    if (!menuPickerMenuId && fallback) setMenuPickerMenuId(fallback);
  }, [menuPickerOpen, menuPickerMenuId, selectedMenuId, menus]);

  useEffect(() => {
    const loadPickerEntries = async () => {
      if (!menuPickerOpen || !menuPickerMenuId) {
        setMenuPickerEntries([]);
        return;
      }
      try {
        const { data } = await api.get(`/restaurant/menus/${encodeURIComponent(String(menuPickerMenuId))}/entries`);
        setMenuPickerEntries(Array.isArray(data) ? data : []);
      } catch {
        setMenuPickerEntries([]);
      }
    };
    loadPickerEntries();
  }, [menuPickerOpen, menuPickerMenuId]);

  useEffect(() => {



    setDirtyPosTableIds([]);



    setDirtyStyleTableIds([]);






  }, [selectedSectionId]);

  useEffect(() => {
    if (!selectedTable) {
      setTableEdit(null);
      return;
    }
    setTableEdit({
      id: selectedTable.id,
      kind: selectedTable.kind || "mesa",
      size: Number(selectedTable.size ?? 56) || 56,
      rotation: Number(selectedTable.rotation ?? 0) || 0,
      x: Number(selectedTable.x ?? 50),
      y: Number(selectedTable.y ?? 50),
      color: selectedTable.color || selectedTable.colorHex || "",
    });
  }, [selectedTable]);







  useEffect(() => {



    const loadMenu = async () => {



      if (!selectedSectionId) {



        setMenu([]);



        return;



      }



      try {



        const { data } = await api.get(
          `/restaurant/menu?section=${encodeURIComponent(String(selectedSectionId))}`
        );



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



        alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.nameRequired"));



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



        alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.idRequired"));



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



      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.sectionCreated"));



    } catch (err) {



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.sectionCreateFailed")));



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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.sectionDeleteFailed")));



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



      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.tableAdded"));



    } catch (err) {



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.tableAddFailed")));



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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.tableDeleteFailed")));



    }



  };







  const applyTableEdit = (patch) => {



    if (!selectedTableId) return;



    setTableEdit((prev) => (prev ? { ...prev, ...patch } : prev));



    patchTableLocal(selectedTableId, patch);



  };







  const createMenu = async () => {
    const nm = String(menuName || "").trim();
    if (!nm) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.menuNameRequired"));
    const sectionIds = (Array.isArray(menuCreateSectionIds) ? menuCreateSectionIds : [])
      .map((sid) => String(sid || "").trim())
      .filter(Boolean);
    if (sectionIds.length === 0) {
      return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.selectSection"));
    }

    if (!menuAssignForm.startTime || !menuAssignForm.endTime) {
      return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.scheduleRequiresTimes"));
    }

    try {
      const { data } = await api.post("/restaurant/menus", {
        name: nm,
        sectionIds,
        daysMask: Number(menuAssignForm.daysMask ?? 127),
        startTime: String(menuAssignForm.startTime || "").trim() || null,
        endTime: String(menuAssignForm.endTime || "").trim() || null,
        assignmentActive: menuAssignForm.active !== false,
      });
      const createdMenuId = String(data?.id || "").trim();
      if (!createdMenuId) {
        throw new Error("menu_without_id");
      }

      setMenus((prev) => [...prev, data].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
      setSelectedMenuId(createdMenuId);
      setMenuPickerMenuId(createdMenuId);

      if (selectedSectionId) {
        try {
          const { data: refreshedAssignments } = await api.get(
            `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus`
          );
          setSectionMenuAssignments(Array.isArray(refreshedAssignments) ? refreshedAssignments : []);
        } catch {
          // ignore refresh errors; next section change will reload
        }
      }

      setMenuName("");
      setMenuCreateSectionIds([]);
      setMenuAssignForm((p) => ({
        ...p,
        menuId: "",
        startTime: "",
        endTime: "",
        daysMask: 127,
        active: true,
      }));

      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.menuCreated"));
    } catch (err) {
      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.menuCreateFailed")));
    }
  };






  const saveSelectedMenu = async () => {



    if (!selectedMenuId) return;



    const payload = {



      name: String(menuEditForm.name || "").trim(),



      active: menuEditForm.active !== false,



    };



    if (!payload.name) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.menuNameRequired"));



    try {



      const { data } = await api.patch(`/restaurant/menus/${encodeURIComponent(String(selectedMenuId))}`, payload);



      setMenus((prev) =>



        (prev || [])



          .map((m) => (m.id === selectedMenuId ? { ...m, ...data } : m))



          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))



      );



      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.menuUpdated"));



    } catch (err) {



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.menuUpdateFailed")));



    }



  };







  const openDeleteMenuConfirm = (menuId) => {
    const id = String(menuId || "").trim();
    if (!id) return;
    setMenuDeleteTargetId(id);
  };

  const deleteSelectedMenu = () => {
    if (!selectedMenuId) return;
    openDeleteMenuConfirm(selectedMenuId);
  };

  const deleteMenuById = (menuId) => {
    openDeleteMenuConfirm(menuId);
  };

  const confirmDeleteMenu = async () => {
    const menuId = String(menuDeleteTargetId || "").trim();
    if (!menuId) return;
    setMenuDeleteTargetId("");
    try {
      await api.delete(`/restaurant/menus/${encodeURIComponent(menuId)}`);
      setMenus((prev) => (prev || []).filter((m) => m.id !== menuId));
      setSectionMenuAssignments((prev) => (prev || []).filter((a) => a.menuId !== menuId));
      if (selectedMenuId === menuId) {
        setSelectedMenuId("");
        setMenuEntries([]);
      }
      if (menuPickerMenuId === menuId) {
        setMenuPickerMenuId("");
        setMenuPickerEntries([]);
        setMenuPickerSelectedIds([]);
      }
      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.menuDeleted"));
    } catch (err) {
      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.menuDeleteFailed")));
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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.menuAddItemFailed")));



    } finally {



      setSaving((s) => ({ ...s, menuEntries: false }));



    }



  };







  const reloadMenuPickerEntries = async () => {
    if (!menuPickerMenuId) return;
    try {
      const { data } = await api.get(`/restaurant/menus/${encodeURIComponent(String(menuPickerMenuId))}/entries`);
      setMenuPickerEntries(Array.isArray(data) ? data : []);
      if (menuPickerMenuId === selectedMenuId) setMenuEntries(Array.isArray(data) ? data : []);
    } catch {
      setMenuPickerEntries([]);
    }
  };

  const saveMenuPickerSelection = async () => {
    if (!menuPickerMenuId) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.selectMenuFirst"));
    const ids = Array.from(new Set(menuPickerSelectedIds || [])).filter(Boolean);
    if (!ids.length) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.noItemsSelected"));
    if (saving.menuEntries) return;
    setSaving((s) => ({ ...s, menuEntries: true }));
    try {
      const inMenu = new Set((menuPickerEntries || []).map((e) => e.itemId));
      const toAdd = ids.filter((id) => !inMenu.has(id));
      await Promise.all(
        toAdd.map((itemId) =>
          api.post(`/restaurant/menus/${encodeURIComponent(String(menuPickerMenuId))}/entries`, { itemId })
        )
      );
      const { data } = await api.get(`/restaurant/menus/${encodeURIComponent(String(menuPickerMenuId))}/entries`);
      setMenuPickerEntries(Array.isArray(data) ? data : []);
      if (menuPickerMenuId === selectedMenuId) setMenuEntries(Array.isArray(data) ? data : []);
      setMenuPickerSelectedIds([]);
      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.itemsAssigned"));
    } catch (err) {
      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.assignItemsFailed")));
    } finally {
      setSaving((s) => ({ ...s, menuEntries: false }));
    }
  };

  const assignFamilyToMenu = async () => {
    if (!menuPickerMenuId) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.selectMenuFirst"));
    if (!menuPickerFamily) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.selectFamily"));
    const ids = (items || [])
      .filter((it) => it?.active !== false)
      .filter((it) => String(it?.subSubFamily || it?.subFamily || it?.family || "General") === menuPickerFamily)
      .map((it) => it.id)
      .filter(Boolean);
    if (!ids.length) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.noItemsForFamily"));
    if (saving.menuEntries) return;
    setSaving((s) => ({ ...s, menuEntries: true }));
    try {
      const inMenu = new Set((menuPickerEntries || []).map((e) => e.itemId));
      const toAdd = ids.filter((id) => !inMenu.has(id));
      await Promise.all(
        toAdd.map((itemId) =>
          api.post(`/restaurant/menus/${encodeURIComponent(String(menuPickerMenuId))}/entries`, { itemId })
        )
      );
      await reloadMenuPickerEntries();
      setMenuPickerSelectedIds([]);
      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.familyAssigned"));
    } catch (err) {
      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.assignFamilyFailed")));
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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.menuEntryDeleteFailed")));



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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.itemUpdateFailed")));



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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.itemDeleteFailed")));



    }



  };







  const createMenuAssignment = async () => {



    if (!selectedSectionId) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.selectSectionFirst"));



    const menuId = String(menuAssignForm.menuId || selectedMenuId || "").trim();



    if (!menuId) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.selectMenuToAssign"));







    try {



      const payload = {



        menuId,



        daysMask: Number(menuAssignForm.daysMask ?? 127),



        startTime: menuAssignForm.startTime ? String(menuAssignForm.startTime).trim() : null,



        endTime: menuAssignForm.endTime ? String(menuAssignForm.endTime).trim() : null,






        active: menuAssignForm.active !== false,



      };



      const { data } = await api.post(



        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus`,



        payload



      );



      setSectionMenuAssignments((prev) => [data, ...prev]);



      setMenuAssignForm((p) => ({ ...p, menuId: "" }));



      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.menuAssigned"));



    } catch (err) {



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.menuAssignFailed")));



    }



  };

  const applyAssignmentEdit = async () => {
    if (!selectedSectionId || !editingAssignmentId) return;
    try {
      const payload = {
        daysMask: Number(menuAssignForm.daysMask ?? 127),
        startTime: menuAssignForm.startTime ? String(menuAssignForm.startTime).trim() : null,
        endTime: menuAssignForm.endTime ? String(menuAssignForm.endTime).trim() : null,
        active: menuAssignForm.active !== false,
      };
      const { data } = await api.patch(
        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus/${encodeURIComponent(
          String(editingAssignmentId)
        )}`,
        payload
      );
      setSectionMenuAssignments((prev) => (prev || []).map((a) => (a.id === editingAssignmentId ? data : a)));
      setEditingAssignmentId("");
      setMenuAssignForm((p) => ({
        ...p,
        menuId: "",
        startTime: "",
        endTime: "",
        daysMask: 127,
        active: true,
      }));
      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.assignmentUpdated"));
    } catch (err) {
      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.assignmentUpdateFailed")));
    }
  };

  const startEditAssignment = (assignment) => {
    if (!assignment) return;
    setEditingAssignmentId(assignment.id);
    setMenuAssignForm((p) => ({
      ...p,
      menuId: assignment.menuId || "",
      daysMask: Number(assignment.daysMask ?? 127),
      startTime: assignment.startTime || "",
      endTime: assignment.endTime || "",
      active: assignment.active !== false,
    }));
  };

  const cancelAssignmentEdit = () => {
    setEditingAssignmentId("");
    setMenuAssignForm((p) => ({
      ...p,
      menuId: "",
      startTime: "",
      endTime: "",
      daysMask: 127,
      active: true,
    }));
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



    alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.printSettingsSaved"));



  };







  const saveGeneral = async (silent = false) => {



    await api.put("/restaurant/general", general);



    if (!silent) alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.generalInfoSaved"));



  };







  const saveBilling = async (silent = false) => {



    await api.put("/restaurant/billing", billing);



    if (!silent) alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.billingSaved"));



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



      if (!silent) alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.taxesSaved"));



    } catch (err) {



      if (!silent) alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.taxesSaveFailed")));



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



    if (!silent) alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.paymentsSaved"));



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



    if (!name) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.discountNameRequired"));



    if (!Number.isFinite(percent) || percent <= 0) return alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.invalidPercent"));



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

    try {

      await api.put(`/discounts/${encodeURIComponent(d.id)}`, {

        name: String(d.name || d.id || "").trim(),

        value: Number(d.value ?? d.percent ?? 0) || 0,

        requiresPin: Boolean(d.requiresPin),

        active: d.active === false ? true : false,

        expiresAt: d.expiresAt || null,

      });

      setDiscountsList((prev) =>

        (prev || []).map((x) => (x.id === d.id ? { ...x, active: !(d.active === false) } : x))

      );

    } catch (err) {

      const msg = err?.response?.data?.message || err?.message || "No se pudo actualizar el descuento.";

      alert(t("mgmt.restaurant.alert.title"), msg);

    }

  };



  const deleteDiscount = (d) => {

    if (!d?.id) return;

    setDiscountDeleteTarget({ id: d.id, name: d.name || d.id });

  };

  const confirmDeleteDiscount = async () => {
    const target = discountDeleteTarget;
    if (!target?.id) return;
    setDiscountDeleteTarget(null);
    try {
      await api.delete(`/discounts/${encodeURIComponent(target.id)}`);
      setDiscountsList((prev) => (prev || []).filter((x) => x.id !== target.id));
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo eliminar el descuento.";
      alert(t("mgmt.restaurant.alert.title"), msg);
    }
  };



  const saveGeneralConfig = async () => {



    try {



      await saveGeneral(true);



      await saveBilling(true);



      await savePayments(true);



      await saveTaxes(true);



      alert(t("mgmt.restaurant.alert.title"), t("mgmt.restaurant.alert.generalConfigSaved"));



    } catch (err) {



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.generalConfigSaveFailed")));



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



            <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.floorplan.title")}</div>



            <h3 className="font-semibold text-lg">{t("mgmt.restaurant.floorplan.subtitle")}</h3>



            <p className="text-sm text-gray-600">{t("mgmt.restaurant.floorplan.help")}</p>



          </div>



          {selectedSectionId && (



            <div className="flex flex-col gap-1 text-xs text-slate-700">



              <div className="font-semibold">{t("mgmt.restaurant.floorplan.backgroundTitle")}</div>



              <div className="flex items-center gap-2">



                <input



                  type="color"



                  value={backgroundForm.color || "#eefce5"}



                  onChange={(e) => setBackgroundForm((f) => ({ ...f, color: e.target.value }))}



                  className="h-10 w-16 rounded border"



                  title={t("mgmt.restaurant.floorplan.backgroundColor")}



                />



                <input



                  type="text"



                  value={backgroundForm.image || ""}



                  onChange={(e) => setBackgroundForm((f) => ({ ...f, image: e.target.value }))}



                  placeholder={t("mgmt.restaurant.floorplan.backgroundImage")}



                  className="h-10 w-64 rounded border px-3 text-sm"



                />



              </div>



            </div>



          )}



          <div className="flex items-center gap-2">



            {selectedSectionId && (



              <div className="flex items-center gap-2 text-xs text-slate-600">



                {(floorplanHasChanges || backgroundDirty) ? (



                  <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">{t("mgmt.restaurant.floorplan.unsaved")}</span>



                ) : (



                  <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">{t("mgmt.restaurant.floorplan.saved")}</span>



                )}



                <Button type="button" onClick={saveFloorplan} disabled={floorplanSaving || (!floorplanHasChanges && !backgroundDirty)}>



                  {floorplanSaving ? t("mgmt.restaurant.floorplan.saving") : t("mgmt.restaurant.floorplan.save")}



                </Button>



              </div>



            )}



            <select



              className="h-10 rounded-lg border px-3 text-sm"



              value={selectedSectionId || ""}



              onChange={(e) => setSelectedSectionId(e.target.value)}



              title={t("mgmt.restaurant.floorplan.selectSectionTitle")}



            >



              {(sections || []).map((s) => (



                <option key={s.id} value={s.id}>



                  {s.name || s.id}



                </option>



              ))}



            </select>



          </div>



        </div>







        {!selectedSectionId && <div className="text-sm text-gray-600">{t("mgmt.restaurant.assignments.selectSection")}</div>}







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



                  <div className="absolute inset-0 flex items-center justify-center text-sm text-amber-700">{t("mgmt.restaurant.tables.empty")}</div>



                )}



              </div>







              <div className="text-xs text-gray-500 hidden">{t("mgmt.restaurant.floorplan.tip")}</div>



            </div>







            <div className="space-y-3">



              <Card className="p-3 space-y-2">



                <div className="font-semibold text-sm">{t("mgmt.restaurant.floorplan.selectedTable") }</div>



                {!selectedTable || !tableEdit ? (



                  <div className="text-sm text-gray-600">{t("mgmt.restaurant.floorplan.selectedTableHint")}</div>



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



                        placeholder={t("mgmt.restaurant.tables.x")}



                        value={tableEdit.x}



                        onChange={(e) => applyTableEdit({ x: clamp(Number(e.target.value || 50), 2, 98) })}



                      />



                      <Input



                        type="number"



                        placeholder={t("mgmt.restaurant.tables.y")}



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



                          title={t("mgmt.restaurant.common.color")}



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



                          <div className="text-xs font-semibold text-slate-700">{t("mgmt.restaurant.floorplan.rotationSnap")}</div>



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



                          <div className="text-xs font-semibold text-slate-700">{t("mgmt.restaurant.floorplan.iconSize")}</div>



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



                      <div className="text-xs text-slate-400">{t("mgmt.restaurant.floorplan.useSave")}</div>



                    </div>



                  </>



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



      alert(t("mgmt.restaurant.alert.title"), getApiError(err, t("mgmt.restaurant.alert.sectionUpdateFailed")));



    }



  };



  const renderSections = ({ showSections = true, showTables = true, showMenus = true } = {}) => (



    <div className="space-y-4">



      {showSections && (



        <Card className="p-4 space-y-3">



          <div className="flex items-center justify-between gap-3 flex-wrap">



            <div>



              <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.sections.title")}</div>



              <h3 className="font-semibold text-lg">{t("mgmt.restaurant.sections.subtitle")}</h3>



            </div>



            <Button
              onClick={addSection}
              disabled={saving.section || !String(formSection.name || "").trim()}
              className={managementPrimaryButtonClass}
            >



              {saving.section ? "Guardando..." : "Crear sección"}



            </Button>



          </div>







          <div className="grid md:grid-cols-4 gap-3">



            <Input



              placeholder={t("mgmt.restaurant.sections.name")}



              value={formSection.name}



              onChange={(e) => setFormSection((f) => ({ ...f, name: e.target.value }))}



            />



            <Input



              placeholder={t("mgmt.restaurant.sections.idOptional")}



              value={formSection.id}



              onChange={(e) => setFormSection((f) => ({ ...f, id: e.target.value }))}



            />



            <Input



              placeholder={t("mgmt.restaurant.sections.imageOptional")}



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



                    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">{t("mgmt.restaurant.sections.noImage")}</div>



                  )}



                </div>



                <div className="p-3 space-y-1">



                  <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.sections.cardLabel")}</div>



                  <div className="font-semibold text-slate-900">{s.name || s.id}</div>



                  <div className="text-xs text-slate-500">ID: {s.id}</div>



                  <div className="text-xs text-slate-500">{(s.tables || []).length} {t("mgmt.restaurant.common.tables")}</div>



                  <div className="flex items-center justify-between pt-2">



                    <button



                      type="button"



                      className="text-xs text-red-600"



                      onClick={(e) => {



                        e.preventDefault();



                        e.stopPropagation();



                        removeSection(s.id);



                      }}



                    >{t("mgmt.restaurant.common.delete")}</button>



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



              <div className="text-sm text-slate-500">{t("mgmt.restaurant.sections.empty")}</div>



            )}



          </div>



        </Card>



      )}







      {showTables && (



        <Card className="p-4 space-y-3">



        <div className="flex items-center justify-between">



          <div>



            <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.tables.title")}</div>



            <h3 className="font-semibold text-lg">{t("mgmt.restaurant.tables.subtitle")}</h3>



            <p className="text-xs text-gray-500 mt-1">{t("mgmt.restaurant.tables.help")}</p>



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



              title={t("mgmt.restaurant.tables.sectionTitle")}



            >



              {(sections || []).map((s) => (



                <option key={s.id} value={s.id}>



                  {s.name || s.id}



                </option>



              ))}



            </select>



            <Input



              placeholder={t("mgmt.restaurant.tables.tableId")}



              value={formTable.id}



              onChange={(e) => setFormTable((f) => ({ ...f, id: e.target.value, name: e.target.value }))}



              className="w-32"



            />



            <Input



              type="number"



              placeholder={t("mgmt.restaurant.tables.seats")}



              value={formTable.seats}



              onChange={(e) => setFormTable((f) => ({ ...f, seats: e.target.value }))}



              className="w-24"



            />



            <Input



              type="number"



              placeholder={t("mgmt.restaurant.tables.x")}



              value={formTable.x}



              onChange={(e) => setFormTable((f) => ({ ...f, x: e.target.value }))}



              className="w-20"



            />



            <Input



              type="number"



              placeholder={t("mgmt.restaurant.tables.y")}



              value={formTable.y}



              onChange={(e) => setFormTable((f) => ({ ...f, y: e.target.value }))}



              className="w-20"



            />



            <Button
              onClick={addTable}
              disabled={!selectedSectionId || saving.table}
              className={`${managementPrimaryButtonClass} min-w-[140px]`}
            >



              {saving.table ? t("mgmt.restaurant.tables.saving") : t("mgmt.restaurant.tables.add")}



            </Button>



          </div>



        </div>



        {selectedSection ? (



          <>



            <div className="text-xs text-gray-500">{t("mgmt.restaurant.tables.layoutFor")} <span className="font-semibold">{selectedSection.name || selectedSection.id}</span></div>



            <div className="mt-2 border rounded-lg p-3 bg-slate-50">



              <div className="text-[11px] text-gray-500 mb-2">{t("mgmt.restaurant.tables.gridHint")}</div>



              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">



                {(selectedSection.tables || []).map((table) => (



                  <div



                    key={table.id}



                    className="relative flex flex-col items-center justify-center rounded-xl border bg-white shadow-sm py-3 px-2"



                  >



                    <div className="text-sm text-gray-500">{selectedSection.name || selectedSection.id}</div>



                    <div className="text-base font-bold text-gray-800">{table.id}</div>



                    <div className="text-sm text-gray-500">{table.seats} {t("mgmt.restaurant.tables.people")}</div>



                    <button



                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-100 text-red-600 text-xs flex items-center justify-center"



                      onClick={() => removeTable(table.id)}



                      title={t("mgmt.restaurant.tables.deleteTitle")}



                    >



                      <XIcon className="h-3.5 w-3.5" />



                    </button>



                  </div>



                ))}



                {(selectedSection.tables || []).length === 0 && (



                  <div className="text-sm text-gray-500 col-span-full">{t("mgmt.restaurant.tables.empty")}</div>



                )}



              </div>



            </div>



          </>



        ) : (



          <div className="text-sm text-gray-500">{t("mgmt.restaurant.tables.selectSection")}</div>



        )}



        </Card>



      )}







      {showMenus && (



      <Card className="p-4 space-y-3">



        <div className="flex items-center justify-between">



          <div>



            <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.menus.title")}</div>



            <h3 className="font-semibold text-lg">{t("mgmt.restaurant.menus.header")}</h3>



          </div>



        </div>

        <div className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="text-sm font-semibold">{t("mgmt.restaurant.menus.createTitle")}</div>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="w-full md:w-[320px] lg:w-[340px]"
                  placeholder={t("mgmt.restaurant.menus.newMenuPlaceholder")}
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                />
                {editingAssignmentId ? (
                  <>
                    <Button onClick={applyAssignmentEdit} className={managementPrimaryButtonClass}>
                      {t("mgmt.restaurant.menus.updateAssignment")}
                    </Button>
                    <Button variant="outline" onClick={cancelAssignmentEdit}>
                      {t("mgmt.restaurant.menus.cancel")}
                    </Button>
                  </>
                ) : (
                  <Button onClick={createMenu} className={managementPrimaryButtonClass}>
                    {t("mgmt.restaurant.menus.createButton")}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <div className="text-xs text-gray-500">{t("mgmt.restaurant.menus.visibleInSections")}</div>
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
                  {(sections || []).length === 0 && (
                    <div className="text-sm text-gray-500">{t("mgmt.restaurant.menus.noSections")}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold">{t("mgmt.restaurant.menus.scheduleTitle")}</div>
              <div className="flex items-center gap-2">
                <div className="w-25">
                  <Input
                    className="w-full"
                    type="time"
                    placeholder={t("mgmt.restaurant.menus.start")}
                    value={menuAssignForm.startTime}
                    onChange={(e) => setMenuAssignForm((p) => ({ ...p, startTime: e.target.value }))}
                  />
                </div>
                <div className="w-25">
                  <Input
                    className="w-full"
                    type="time"
                    placeholder={t("mgmt.restaurant.menus.end")}
                    value={menuAssignForm.endTime}
                    onChange={(e) => setMenuAssignForm((p) => ({ ...p, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { bit: 1 << 1, label: t("mgmt.restaurant.days.mon") },
                  { bit: 1 << 2, label: t("mgmt.restaurant.days.tue") },
                  { bit: 1 << 3, label: t("mgmt.restaurant.days.wed") },
                  { bit: 1 << 4, label: t("mgmt.restaurant.days.thu") },
                  { bit: 1 << 5, label: t("mgmt.restaurant.days.fri") },
                  { bit: 1 << 6, label: t("mgmt.restaurant.days.sat") },
                  { bit: 1 << 0, label: t("mgmt.restaurant.days.sun") },
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
              {editingAssignmentId && (
                <div className="text-xs text-amber-700">{t("mgmt.restaurant.assignments.editingHint")}</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">{t("mgmt.restaurant.assignments.title")}</div>
            {!selectedSectionId ? (
              <div className="text-sm text-gray-500">{t("mgmt.restaurant.assignments.selectSection")}</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.assignments.column.section")}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.menus.title")}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.assignments.column.schedule")}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.assignments.column.days")}</th>
                      <th className="px-3 py-2 text-left font-semibold">{t("mgmt.restaurant.assignments.column.status")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t("mgmt.restaurant.assignments.column.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sectionMenuRows || []).map((row, idx) => {
                      const a = row.assignment;
                      const menu = row.menu;
                      const rowMenuId = String(row?.menuId || menu?.id || a?.menuId || a?.menu?.id || "").trim();
                      const visibleSections = Array.isArray(row?.visibleSections) ? row.visibleSections : [];
                      const isSelectedRow = rowMenuId && String(selectedMenuId || "").trim() === rowMenuId;
                      const assignmentSectionId = String(a?.sectionId || a?.section?.id || "").trim();
                      const canEditAssignment = !!a && !!String(a?.id || "").trim() && !!assignmentSectionId;
                      const statusMeta = a
                        ? a.active === false
                          ? {
                              label: t("mgmt.restaurant.assignments.status.inactive"),
                              className: "bg-rose-50 text-rose-700 border-rose-200",
                            }
                          : {
                              label: t("mgmt.restaurant.assignments.status.active"),
                              className: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            }
                        : {
                            label: t("mgmt.restaurant.assignments.status.unassigned"),
                            className: "bg-slate-100 text-slate-700 border-slate-200",
                          };
                      return (
                        <tr
                          key={rowMenuId || menu?.id || a?.id || idx}
                          className={[
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/60",
                            isSelectedRow ? "bg-indigo-50/50" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <td className="px-3 py-2">
                            {visibleSections.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {visibleSections.map((sectionRef, sectionIdx) => {
                                  const sectionId = String(sectionRef?.id || "").trim();
                                  const isCurrentSection = sectionId && String(selectedSectionId || "").trim() === sectionId;
                                  return (
                                    <span
                                      key={`${rowMenuId || "menu"}-${sectionId || sectionRef?.name || sectionIdx}`}
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                                        isCurrentSection
                                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                          : "bg-slate-100 text-slate-700 border-slate-200"
                                      }`}
                                    >
                                      {sectionRef?.name || sectionId || "-"}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className={`inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium transition ${
                                isSelectedRow
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                if (!rowMenuId) return;
                                setSelectedMenuId(rowMenuId);
                                setMenuAssignForm((prev) => ({ ...prev, menuId: rowMenuId }));
                                setMenuPickerMenuId(rowMenuId);
                              }}
                              title={t("mgmt.restaurant.menuItems.selectMenu")}
                            >
                              {menu?.name || a?.menu?.name || rowMenuId || "-"}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            {a ? `${a.startTime || "00:00"} - ${a.endTime || "24:00"}` : "-"}
                          </td>
                          <td className="px-3 py-2">{a ? formatDaysMask(a.daysMask) : "-"}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {canEditAssignment && (
                                <Button
                                  variant="outline"
                                  className="h-8 px-2 text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
                                  onClick={() => {
                                    if (!a) return;
                                    const targetSectionId = String(a?.sectionId || a?.section?.id || "").trim();
                                    if (targetSectionId && targetSectionId !== String(selectedSectionId || "").trim()) {
                                      setSelectedSectionId(targetSectionId);
                                    }
                                    startEditAssignment({
                                      ...a,
                                      menuId: String(a?.menuId || rowMenuId || "").trim(),
                                    });
                                  }}
                                >
                                  {t("mgmt.restaurant.assignments.action.edit")}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                className="h-8 px-2 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                                onClick={() => deleteMenuById(rowMenuId)}
                              >
                                {t("mgmt.restaurant.assignments.action.deleteMenu")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {sectionMenuRows.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                          {t("mgmt.restaurant.assignments.empty")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">{t("mgmt.restaurant.menuItems.title")}</div>
            {!selectedMenuId ? (
              <div className="text-sm text-gray-500">{t("mgmt.restaurant.menuItems.selectMenu")}</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    {t("mgmt.restaurant.menuItems.count")} <span className="font-semibold">{menuEntries.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={t("mgmt.restaurant.menuItems.searchPlaceholder")}
                      value={menuEntrySearch}
                      onChange={(e) => setMenuEntrySearch(e.target.value)}
                    />
                    <Button variant="outline" onClick={reloadMenuPickerEntries} disabled={saving.menuEntries}>
                      {t("mgmt.restaurant.menuItems.reload")}
                    </Button>
                    <Button onClick={() => setMenuPickerOpen(true)} className={managementPrimaryButtonClass}>
                      {t("mgmt.restaurant.menuItems.openPicker")}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{t("mgmt.restaurant.menuItems.helper")}</div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-xs text-slate-600">
                        <th className="text-left px-3 py-2">{t("mgmt.restaurant.menuItems.column.family")}</th>
                        <th className="text-left px-3 py-2">{t("mgmt.restaurant.menuItems.column.subFamily")}</th>
                        <th className="text-left px-3 py-2">{t("mgmt.restaurant.menuItems.column.subSubfamily")}</th>
                        <th className="text-left px-3 py-2">{t("mgmt.restaurant.menuItems.column.article")}</th>
                        <th className="text-center px-3 py-2">{t("mgmt.restaurant.menuItems.column.active")}</th>
                        <th className="text-center px-3 py-2">{t("mgmt.restaurant.menuItems.column.color")}</th>
                        <th className="text-left px-3 py-2">{t("mgmt.restaurant.menuItems.column.thumbnail")}</th>
                        <th className="text-right px-3 py-2">{t("mgmt.restaurant.menuItems.column.actions")}</th>
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
                                title={t("mgmt.restaurant.menuItems.action.toggleActive")}
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
                                title={t("mgmt.restaurant.menuItems.action.color")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <input
                                  className="h-9 w-full rounded-lg border px-2 text-xs"
                                  placeholder={t("mgmt.restaurant.menuItems.imagePlaceholder")}
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
                              <Button
                                variant="outline"
                                className="h-8 px-2 text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                                onClick={() => removeMenuEntry(e.id)}
                                disabled={saving.menuEntries}
                              >
                                {t("mgmt.restaurant.menuItems.action.remove")}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {(filteredMenuEntries || []).length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>
                            {t("mgmt.restaurant.menuItems.empty")}
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




      </Card>



      )}







      {menuPickerOpen && (



        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">



          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden">



            <div className="flex items-center justify-between px-4 py-3 border-b">



              <div className="min-w-0">



                <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.menuItems.openPicker")}</div>



              </div>



              <button



                className="h-9 w-9 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center"



                onClick={() => setMenuPickerOpen(false)}



                title={t("mgmt.restaurant.menuPicker.close")}



              >



                <XIcon className="h-5 w-5 text-slate-600" />



              </button>



            </div>







            <div className="p-4 grid md:grid-cols-[220px_1fr] gap-4">



              <div className="space-y-3">



                <Input



                  placeholder={t("mgmt.restaurant.menuPicker.search")}



                  value={menuPickerSearch}



                  onChange={(e) => setMenuPickerSearch(e.target.value)}



                />



                <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.menuPicker.categories")}</div>



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



                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 rounded-lg border px-2 text-sm bg-white"
                      value={menuPickerMenuId}
                      onChange={(e) => {
                        setMenuPickerMenuId(e.target.value);
                        setMenuPickerSelectedIds([]);
                      }}
                    >
                      <option value="">{t("mgmt.restaurant.menuPicker.selectMenu")}</option>
                      {(menus || []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={saveMenuPickerSelection}
                      disabled={saving.menuEntries || !menuPickerMenuId}
                      className={managementPrimaryButtonClass}
                    >
                      {t("mgmt.restaurant.menuPicker.save")}
                    </Button>
                    <Button variant="outline" onClick={reloadMenuPickerEntries} disabled={saving.menuEntries}>{t("mgmt.restaurant.menuPicker.refresh")}</Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-lg border px-2 text-sm bg-white"
                    value={menuPickerFamily}
                    onChange={(e) => setMenuPickerFamily(e.target.value)}
                  >
                    <option value="">{t("mgmt.restaurant.menuPicker.selectFamily")}</option>
                    {Array.from(
                      new Set(
                        (items || [])
                          .map((it) => String(it?.subSubFamily || it?.subFamily || it?.family || "General"))
                          .filter(Boolean)
                      )
                    )
                      .sort((a, b) => a.localeCompare(b))
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                  <Button variant="outline" onClick={assignFamilyToMenu} disabled={!menuPickerFamily}>{t("mgmt.restaurant.menuPicker.assignFamily")}</Button>
                  <Button variant="outline" onClick={() => setMenuPickerSelectedIds([])}>
                    Limpiar seleccion
                  </Button>
                </div>







                {(() => {



                  const q = String(menuPickerSearch || "").trim().toLowerCase();



                  const inMenu = new Map((menuPickerEntries || []).map((e) => [e.itemId, e]));



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



                        const isSelected = (menuPickerSelectedIds || []).includes(it.id);



                        const displayPrice = Number(it.price || 0);



                        return (



                          <button



                            key={it.id}



                            className={`text-left border rounded-xl p-3 hover:shadow-sm transition ${isInMenu ? "bg-emerald-50 border-emerald-200" : isSelected ? "bg-indigo-50 border-indigo-200" : "bg-white"}`}



                            onClick={() =>
                              setMenuPickerSelectedIds((prev) =>
                                (prev || []).includes(it.id) ? (prev || []).filter((x) => x !== it.id) : [...(prev || []), it.id]
                              )
                            }



                            disabled={saving.menuEntries}



                            title={isInMenu ? t("mgmt.restaurant.menuPicker.inMenu") : isSelected ? t("mgmt.restaurant.menuPicker.selected") : t("mgmt.restaurant.menuPicker.select")}



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
                                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{t("mgmt.restaurant.menuPicker.inMenu")}</span>
                              ) : isSelected ? (
                                <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{t("mgmt.restaurant.menuPicker.selected")}</span>
                              ) : (
                                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200">{t("mgmt.restaurant.menuPicker.select")}</span>
                              )}



                            </div>



                            <div className="mt-2 text-sm font-semibold">${displayPrice.toFixed(2)}</div>



                          </button>



                        );



                      })}



                      {filtered.length === 0 && <div className="text-sm text-gray-500 col-span-full">{t("mgmt.restaurant.menuPicker.noItems")}</div>}



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



        <h3 className="font-semibold text-lg">{t("mgmt.restaurant.printers.title")}</h3>



        <p className="text-sm text-gray-600">{t("mgmt.restaurant.printers.help")}</p>



      </div>



      <div className="grid md:grid-cols-3 gap-3">



        <Input



          placeholder={t("mgmt.restaurant.printers.kitchen")}



          value={printers.kitchenPrinter}



          onChange={(e) => setPrinters((p) => ({ ...p, kitchenPrinter: e.target.value }))}



        />



        <Input



          placeholder={t("mgmt.restaurant.printers.bar")}



          value={printers.barPrinter}



          onChange={(e) => setPrinters((p) => ({ ...p, barPrinter: e.target.value }))}



        />



        <Input



          placeholder={t("mgmt.restaurant.printers.cashier")}



          value={printers.cashierPrinter}



          onChange={(e) => setPrinters((p) => ({ ...p, cashierPrinter: e.target.value }))}



        />



      </div>







      <div className="pt-3 border-t">



        <div className="text-sm font-semibold">{t("mgmt.restaurant.printers.printing")}</div>



        <div className="grid md:grid-cols-3 gap-3 mt-2">



          <label className="text-sm">



            <div className="text-xs text-gray-500 mb-1">{t("mgmt.restaurant.printers.paperType")}</div>



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



            <div className="text-xs text-gray-500 mb-1">{t("mgmt.restaurant.printers.defaultDoc")}</div>



            <select



              className="h-10 w-full rounded-lg border px-3 text-sm bg-white"



              value={printing.defaultDocType || "TE"}



              onChange={(e) => setPrinting((p) => ({ ...p, defaultDocType: e.target.value }))}



            >



              <option value="TE">{t("mgmt.restaurant.printers.ticketTE")}</option>



              <option value="FE">{t("mgmt.restaurant.printers.invoiceFE")}</option>



            </select>



          </label>



          <div className="text-xs text-gray-500 flex items-end">{t("mgmt.restaurant.printers.typesHelp")}</div>



        </div>







        <div className="grid gap-2 mt-3">



          {[



            { key: "comanda", label: t("mgmt.restaurant.printers.type.comanda"), docType: "COMANDA" },



            { key: "ticket", label: t("mgmt.restaurant.printers.type.ticket"), docType: "TE" },



            { key: "document", label: t("mgmt.restaurant.printers.type.subinvoice"), docType: "DOCUMENT" },



            { key: "electronicInvoice", label: t("mgmt.restaurant.printers.type.invoice"), docType: "FE" },



            { key: "closes", label: t("mgmt.restaurant.printers.type.closes"), docType: "CLOSES" },



          ].map((printType) => {


            const cfg = printing.types?.[printType.key] || { enabled: true, printerId: "", copies: 1, formId: "" };



            const docType = printType.docType;



            const matchingForms = (einvPrintForms || [])



              .filter((f) => String(f?.module || "").toLowerCase() === "restaurant");



            return (



              <div key={printType.key} className="grid md:grid-cols-[140px_120px_1fr_1fr_120px] gap-2 items-center border rounded-lg p-3 bg-slate-50">



                <div className="font-semibold text-sm">{printType.label}</div>



                <label className="inline-flex items-center gap-2 text-sm">



                  <input



                    type="checkbox"



                    checked={cfg.enabled !== false}



                    onChange={(e) =>



                      setPrinting((p) => ({



                        ...p,



                        types: { ...p.types, [printType.key]: { ...cfg, enabled: e.target.checked } },



                      }))



                    }



                  />



                  Enabled



                </label>



                <Input



                  placeholder={t("mgmt.restaurant.printers.printerId")}



                  value={cfg.printerId || ""}



                  onChange={(e) =>



                    setPrinting((p) => ({



                      ...p,



                      types: { ...p.types, [printType.key]: { ...cfg, printerId: e.target.value } },



                    }))



                  }



                />



                <select



                  className="h-10 rounded-lg border px-3 text-sm bg-white"



                  value={cfg.formId || ""}



                  onChange={(e) =>



                    setPrinting((p) => ({



                      ...p,



                      types: { ...p.types, [printType.key]: { ...cfg, formId: e.target.value } },



                    }))



                  }



                  title={t("mgmt.restaurant.printers.printForm")}



                >



                  <option value="">{t("mgmt.restaurant.printers.defaultForm")}</option>



                  {matchingForms.map((f) => (



                    <option key={f.id} value={f.id}>



                      {f.name}



                    </option>



                  ))}



                </select>



                <Input



                  type="number"



                  placeholder={t("mgmt.restaurant.printers.copies")}



                  value={cfg.copies ?? 1}



                  onChange={(e) =>



                    setPrinting((p) => ({



                      ...p,



                      types: { ...p.types, [printType.key]: { ...cfg, copies: Number(e.target.value || 1) } },



                    }))



                  }



                />



              </div>



            );



          })}



        </div>



      </div>







      <div className="flex justify-end">



        <Button onClick={savePrinters} className={managementPrimaryButtonClass}>
          {t("mgmt.restaurant.printers.save")}
        </Button>



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



          <div className="text-[11px] uppercase tracking-wide text-slate-800 font-semibold">{t("mgmt.restaurant.taxes.title")}</div>



          <div className="space-y-3">



            <div>



              <div className="text-xs uppercase text-gray-500 mb-1">{t("mgmt.restaurant.taxes.vat")}</div>



              <Input



                type="number"



                placeholder="0"



                value={taxes.iva}



                onChange={(e) => setTaxes((t) => ({ ...t, iva: e.target.value }))}



                className="!w-20 !min-w-0"



              />



            </div>



            <div>



              <div className="text-xs uppercase text-gray-500 mb-1">{t("mgmt.restaurant.taxes.service")}</div>



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



              {t("mgmt.restaurant.taxes.included")}



            </label>



          </div>



        </div>







        <div className="hidden lg:block w-px bg-slate-200 self-stretch" />







        <div className="space-y-3">



          <div className="text-[11px] uppercase tracking-wide text-slate-800 font-semibold">{t("mgmt.restaurant.discounts.title")}</div>



          <div className="flex items-center gap-2 text-sm h-10">



            <input



              type="checkbox"



              checked={Boolean(taxes.permitirDescuentos)}



              onChange={(e) => setTaxes((t) => ({ ...t, permitirDescuentos: e.target.checked }))}



            />



            {t("mgmt.restaurant.discounts.allow")}



          </div>



          <div className="grid md:grid-cols-2 gap-4 items-start">



            <div className="space-y-2">



              <Input



                placeholder={t("mgmt.restaurant.discounts.name")}



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



                <Button onClick={createDiscount} className={managementPrimaryButtonClass}>
                  {t("mgmt.restaurant.discounts.create")}
                </Button>



              </div>



            </div>



            <div className="border rounded-lg overflow-hidden max-w-sm">



              <div className="px-3 py-2 text-xs uppercase text-gray-500 bg-slate-50">{t("mgmt.restaurant.discounts.created")}</div>



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



                              >{t("mgmt.restaurant.common.delete")}</button>



                            </div>



                          </div>



                        );



                      })}



                </div>



              ) : (



                <div className="px-3 py-3 text-sm text-slate-500">{t("mgmt.restaurant.discounts.empty")}</div>



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



          <h3 className="font-semibold text-lg">{t("mgmt.restaurant.general.title")}</h3>



          <p className="text-sm text-gray-600">{t("mgmt.restaurant.general.subtitle")}</p>



        </div>



        {showSave && (
          <Button onClick={saveGeneral} className={managementPrimaryButtonClass}>
            {t("mgmt.restaurant.common.save")}
          </Button>
        )}



      </div>



      <div className="grid md:grid-cols-2 gap-3">



        <Input placeholder={t("mgmt.restaurant.general.tradeName")} value={general.nombreComercial} onChange={(e) => setGeneral((g) => ({ ...g, nombreComercial: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.legalName")} value={general.razonSocial} onChange={(e) => setGeneral((g) => ({ ...g, razonSocial: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.legalId")} value={general.cedula} onChange={(e) => setGeneral((g) => ({ ...g, cedula: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.phone")} value={general.telefono} onChange={(e) => setGeneral((g) => ({ ...g, telefono: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.email")} value={general.email} onChange={(e) => setGeneral((g) => ({ ...g, email: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.address")} value={general.direccion} onChange={(e) => setGeneral((g) => ({ ...g, direccion: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.hours")} value={general.horario} onChange={(e) => setGeneral((g) => ({ ...g, horario: e.target.value }))} />



        <Input placeholder={t("mgmt.restaurant.general.resolution")} value={general.resolucion} onChange={(e) => setGeneral((g) => ({ ...g, resolucion: e.target.value }))} />



      </div>



      <Textarea placeholder={t("mgmt.restaurant.general.notes")} value={general.notas} onChange={(e) => setGeneral((g) => ({ ...g, notas: e.target.value }))} />



    </Card>



  );







  const renderBilling = ({ showSave = true } = {}) => (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{t("mgmt.restaurant.billing.title")}</h3>
          <p className="text-sm text-gray-600">{t("mgmt.restaurant.billing.subtitle")}</p>
        </div>
        {showSave && (
          <Button onClick={saveBilling} className={managementPrimaryButtonClass}>
            {t("mgmt.restaurant.common.save")}
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.restaurant.billing.ticketType") }</label>
          <Input
            placeholder={t("mgmt.restaurant.billing.ticketPlaceholder")}
            value={billing.ticketComprobante || ""}
            onChange={(e) => setBilling((b) => ({ ...b, ticketComprobante: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t("mgmt.restaurant.billing.invoiceType") }</label>
          <Input
            placeholder={t("mgmt.restaurant.billing.invoicePlaceholder")}
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
        />{t("mgmt.restaurant.billing.autoGenerate")}</label>

      <Card className="p-4 space-y-3 border border-slate-200">
        <div className="font-semibold text-sm text-slate-800">{t("mgmt.restaurant.billing.previewTitle")}</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={printing?.showPreview !== false}
            onChange={(e) => setPrinting((p) => ({ ...p, showPreview: e.target.checked }))}
          />{t("mgmt.restaurant.billing.previewBefore")}</label>

        <div className="grid md:grid-cols-3 gap-2 text-sm">
          {[
            { id: "comanda", label: t("mgmt.restaurant.billing.preview.comanda") },
            { id: "subtotal", label: t("mgmt.restaurant.billing.preview.subtotal") },
            { id: "invoice", label: t("mgmt.restaurant.billing.preview.invoice") },
          ].map((opt) => (
            <label key={opt.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={printing?.previewByType?.[opt.id] !== false}
                onChange={(e) =>
                  setPrinting((p) => ({
                    ...p,
                    previewByType: { ...(p.previewByType || {}), [opt.id]: e.target.checked },
                  }))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3 border border-slate-200">
          <div className="font-semibold text-sm text-slate-800">{t("mgmt.restaurant.billing.ticketTitle")}</div>
          <div className="grid gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">{t("mgmt.restaurant.billing.header")}</div>
              <Textarea
                rows={3}
                placeholder={t("mgmt.restaurant.billing.ticketHeaderPlaceholder")}
                value={billing.ticketHeader || ""}
                onChange={(e) => setBilling((b) => ({ ...b, ticketHeader: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">{t("mgmt.restaurant.billing.footer")}</div>
              <Textarea
                rows={3}
                placeholder={t("mgmt.restaurant.billing.ticketFooterPlaceholder")}
                value={billing.ticketFooter || ""}
                onChange={(e) => setBilling((b) => ({ ...b, ticketFooter: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3 border border-slate-200">
          <div className="font-semibold text-sm text-slate-800">{t("mgmt.restaurant.billing.invoiceTitle")}</div>
          <div className="grid gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">{t("mgmt.restaurant.billing.header")}</div>
              <Textarea
                rows={3}
                placeholder={t("mgmt.restaurant.billing.invoiceHeaderPlaceholder")}
                value={billing.invoiceHeader || ""}
                onChange={(e) => setBilling((b) => ({ ...b, invoiceHeader: e.target.value }))}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">{t("mgmt.restaurant.billing.footer")}</div>
              <Textarea
                rows={3}
                placeholder={t("mgmt.restaurant.billing.invoiceFooterPlaceholder")}
                value={billing.invoiceFooter || ""}
                onChange={(e) => setBilling((b) => ({ ...b, invoiceFooter: e.target.value }))}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 space-y-3 border border-slate-200">
        <div className="font-semibold text-sm text-slate-800">{t("mgmt.restaurant.billing.reprintTitle") }</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">{t("mgmt.restaurant.billing.header")}</div>
            <Textarea
              rows={3}
              placeholder={t("mgmt.restaurant.billing.reprintHeaderPlaceholder")}
              value={billing.reprintHeader || ""}
              onChange={(e) => setBilling((b) => ({ ...b, reprintHeader: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">{t("mgmt.restaurant.billing.footer")}</div>
            <Textarea
              rows={3}
              placeholder={t("mgmt.restaurant.billing.reprintFooterPlaceholder")}
              value={billing.reprintFooter || ""}
              onChange={(e) => setBilling((b) => ({ ...b, reprintFooter: e.target.value }))}
            />
          </div>
        </div>
      </Card>
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

    setPaymentMethodDeleteTargetId(selectedPaymentMethodId);

  };

  const confirmDeletePaymentMethod = () => {
    const targetId = String(paymentMethodDeleteTargetId || "").trim();
    if (!targetId) return;
    setPaymentMethodDeleteTargetId("");

    setPayments((prev) => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).filter((m) => m.id !== targetId),
    }));

    setSelectedPaymentMethodId("");
    setPaymentMethodForm({ id: "", name: "", account: "" });
  };

  const renderPayments = ({ showSave = true } = {}) => (



    <div className="space-y-4">



      <div className="flex items-center justify-between">



        <div>



          <h3 className="font-semibold text-lg">{t("mgmt.restaurant.payments.title")}</h3>



          <p className="text-sm text-gray-600">{t("mgmt.restaurant.payments.subtitle")}</p>



        </div>



        {showSave && (
          <Button onClick={savePayments} className={managementPrimaryButtonClass}>
            {t("mgmt.restaurant.payments.save")}
          </Button>
        )}



      </div>







      <Card className="p-5 space-y-4">



        <div>



          <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.payments.currencyTitle")}</div>



          <div className="font-semibold">{t("mgmt.restaurant.payments.currencySubtitle")}</div>



          <div className="text-sm text-gray-600">



            {t("mgmt.restaurant.payments.currencyHelp")}



          </div>



        </div>







        <div className="grid md:grid-cols-3 gap-3">



          <label className="text-sm">



            <div className="text-xs text-gray-500 mb-1">{t("mgmt.restaurant.payments.baseCurrency") }</div>



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



            <div className="text-xs text-gray-500 mb-1">{t("mgmt.restaurant.payments.exchangeCurrency") }</div>



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



            <div className="text-xs text-gray-500 mb-1">{t("mgmt.restaurant.payments.exchangeRate") }</div>



            <Input



              type="number"



              placeholder={t("mgmt.restaurant.payments.exchangePlaceholder")}



              value={payments.tipoCambio}



              disabled={Boolean(payments.useBCCR)}



              onChange={(e) => setPayments((p) => ({ ...p, tipoCambio: e.target.value }))}



            />



            {Boolean(payments.useBCCR) && (



              <div className="text-[11px] text-gray-500 mt-1">{t("mgmt.restaurant.payments.autoUpdate") }</div>



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



          <div className="text-xs uppercase text-gray-500">{t("mgmt.restaurant.payments.methodsTitle")}</div>



          <div className="font-semibold">{t("mgmt.restaurant.payments.methodsSubtitle") }</div>



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



              placeholder={t("mgmt.restaurant.payments.accountingConnector")}



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



            <Button type="button" variant="outline" onClick={startNewPaymentMethod}>{t("mgmt.restaurant.common.new")}</Button>



            <Button



              type="button"



              variant="outline"



              onClick={() => startEditPaymentMethod((payments.paymentMethods || []).find((m) => m.id === selectedPaymentMethodId))}



              disabled={!selectedPaymentMethodId}



            >



              Editar



            </Button>



            <Button type="button" variant="outline" onClick={deleteSelectedPaymentMethod} disabled={!selectedPaymentMethodId}>{t("mgmt.restaurant.common.delete")}</Button>



          </div>



        </div>







        <div className="grid md:grid-cols-[1fr_320px] gap-4">



          <div className="overflow-auto rounded-xl border">



            <table className="min-w-full text-sm">



              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">



                <tr>



                  <th className="px-3 py-2 text-left w-10">{t("mgmt.restaurant.payments.select")}</th>



                  <th className="px-3 py-2 text-left w-16">{t("mgmt.restaurant.common.active")}</th>



                  <th className="px-3 py-2 text-left">{t("mgmt.restaurant.payments.method")}</th>



                  {payments.accountingEnabled && <th className="px-3 py-2 text-left">{t("mgmt.restaurant.payments.account")}</th>}



                  <th className="px-3 py-2 text-right w-28">{t("mgmt.restaurant.payments.action")}</th>



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



                    <td className="px-3 py-4 text-slate-500" colSpan={payments.accountingEnabled ? 5 : 4}>{t("mgmt.restaurant.payments.empty")}</td>



                  </tr>



                )}



              </tbody>



            </table>



          </div>







          <Card className="p-4 space-y-3 border border-slate-200">



            <div className="font-semibold">{t("mgmt.restaurant.payments.addEdit")}</div>



            <Input



              placeholder="Nombre del método (Ej: SINPE, Efectivo)"



              value={paymentMethodForm.name}



              onChange={(e) => setPaymentMethodForm((f) => ({ ...f, name: e.target.value }))}



            />



            {payments.accountingEnabled && (



              <Input



                placeholder={t("mgmt.restaurant.payments.accountingAccount")}



                value={paymentMethodForm.account}



                onChange={(e) => setPaymentMethodForm((f) => ({ ...f, account: e.target.value }))}



              />



            )}



            <div className="flex justify-end gap-2">



              <Button type="button" variant="outline" onClick={() => setPaymentMethodForm({ id: "", name: "", account: "" })}>



                Limpiar



              </Button>



              <Button type="button" onClick={savePaymentMethodForm}>{t("mgmt.restaurant.payments.saveMethod")}</Button>



            </div>



            <div className="text-[11px] text-gray-500">{t("mgmt.restaurant.payments.note")}</div>



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



          <h3 className="font-semibold text-lg">{t("mgmt.restaurant.recipes.title")}</h3>



          <p className="text-sm text-gray-600">{t("mgmt.restaurant.recipes.subtitle")}</p>



        </div>







        <div className="grid md:grid-cols-3 gap-3 items-end">



          <div className="md:col-span-2">



            <div className="text-xs text-slate-600 mb-1">{t("mgmt.restaurant.recipes.sellable") }</div>



            <select



              className="h-10 rounded-lg border px-3 text-sm w-full"



              value={selectedRecipeItemId}



              onChange={(e) => setSelectedRecipeItemId(e.target.value)}



            >



              <option value="">{t("mgmt.restaurant.recipes.selectArticle")}</option>



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



              <div>{t("mgmt.restaurant.recipes.selectHint") }</div>



            )}



          </div>



        </div>







        {selectedRecipeItemId && (



          <Card className="p-3 space-y-2 bg-slate-50">



            <div className="font-semibold text-sm">{t("mgmt.restaurant.recipes.addIngredient")}</div>



            <div className="grid md:grid-cols-4 gap-2 items-end">



              <div className="md:col-span-2">



                <div className="text-xs text-slate-600 mb-1">{t("mgmt.restaurant.recipes.inventoryItem") }</div>



                <select



                  className="h-10 rounded-lg border px-3 text-sm w-full"



                  value={recipeLineForm.inventoryItemId}



                  onChange={(e) => {



                    const id = e.target.value;



                    const inv = (inventory || []).find((i) => i.id === id);



                    setRecipeLineForm((p) => ({ ...p, inventoryItemId: id, unit: inv?.unit || "" }));



                  }}



                >



                  <option value="">{t("mgmt.restaurant.recipes.selectInventory")}</option>



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



                <div className="text-xs text-slate-600 mb-1">{t("mgmt.restaurant.recipes.qty") }</div>



                <Input



                  type="number"



                  placeholder="0"



                  value={recipeLineForm.qty}



                  onChange={(e) => setRecipeLineForm((p) => ({ ...p, qty: e.target.value }))}



                />



              </div>



              <div className="flex gap-2">



                <Input placeholder={t("mgmt.restaurant.recipes.unit")} value={recipeLineForm.unit} disabled />



                <Button
                  onClick={addRecipeLine}
                  disabled={!recipeLineForm.inventoryItemId || !(Number(recipeLineForm.qty) > 0)}
                  className={managementPrimaryButtonClass}
                >



                  Add



                </Button>



              </div>



            </div>



            <div className="text-xs text-slate-500">{t("mgmt.restaurant.recipes.tip") }</div>



          </Card>



        )}







        <div className="overflow-auto border rounded-lg">



          <table className="min-w-full text-sm">



            <thead className="bg-slate-50 text-slate-600">



              <tr>



                <th className="px-3 py-2 text-left">{t("mgmt.restaurant.menuItems.column.article")}</th>



                <th className="px-3 py-2 text-left">{t("mgmt.restaurant.recipes.ingredient") }</th>



                <th className="px-3 py-2 text-left">{t("mgmt.restaurant.recipes.qty") }</th>



                <th className="px-3 py-2 text-left">{t("mgmt.restaurant.recipes.unit") }</th>



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



                    {selectedRecipeItemId ? t("mgmt.restaurant.recipes.emptyLines") : t("mgmt.restaurant.recipes.emptySelect")}



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



          {topTabs.map((tab) => (



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



            <div className="font-semibold text-lg text-slate-900">{t("mgmt.restaurant.generalConfig.title")}</div>



            <div className="font-semibold text-lg text-slate-900">{t("mgmt.restaurant.generalConfig.restaurantLabel")}</div>



          </div>



          <Button onClick={saveGeneralConfig} className={`${managementPrimaryButtonClass} mt-3`}>
            {t("mgmt.restaurant.menuPicker.save")}
          </Button>



        </div>



        <div className="flex flex-wrap gap-2">



          {[



            { id: "general", label: "Informacin general" },



            { id: "billing", label: "Facturacin" },



            { id: "payments", label: "Pagos y divisas" },



            { id: "taxes", label: t("mgmt.restaurant.tabs.taxes") },



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



        <div className="text-[15px] text-center uppercase tracking-wide text-indigo-200 px-2">{t("mgmt.restaurant.generalConfig.subtitle")}</div>



        {navTabs.map((tab) => (



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



      <ConfirmDialog
        open={Boolean(menuDeleteTargetId)}
        title={t("mgmt.restaurant.alert.title")}
        message={t("mgmt.restaurant.confirm.deleteMenu")}
        cancelText={t("common.cancel")}
        confirmText={t("mgmt.restaurant.common.delete")}
        onCancel={() => setMenuDeleteTargetId("")}
        onConfirm={confirmDeleteMenu}
      />

      <ConfirmDialog
        open={Boolean(discountDeleteTarget)}
        title={t("mgmt.restaurant.alert.title")}
        message={t("mgmt.restaurant.discounts.deleteConfirm", { name: discountDeleteTarget?.name || "" })}
        cancelText={t("common.cancel")}
        confirmText={t("mgmt.restaurant.common.delete")}
        onCancel={() => setDiscountDeleteTarget(null)}
        onConfirm={confirmDeleteDiscount}
      />

      <ConfirmDialog
        open={Boolean(paymentMethodDeleteTargetId)}
        title={t("mgmt.restaurant.alert.title")}
        message={t("mgmt.restaurant.payments.deleteConfirm")}
        cancelText={t("common.cancel")}
        confirmText={t("mgmt.restaurant.common.delete")}
        onCancel={() => setPaymentMethodDeleteTargetId("")}
        onConfirm={confirmDeletePaymentMethod}
      />



    </div>



  );



}



















































































































