import React, { useEffect, useMemo, useRef, useState } from "react";



import { useLocation } from "react-router-dom";
import { CustomSelect } from "../../../components/ui/CustomSelect";



import { X as XIcon } from "lucide-react";



import { Card } from "../../../components/ui/card";



import { Input } from "../../../components/ui/input";



import { Textarea } from "../../../components/ui/textarea";



import { Button } from "../../../components/ui/button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";



import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";
import { sanitizeCssBackgroundImage, sanitizeImageUrl } from "../../../lib/security";
import SectionImageField from "../../../components/restaurant/SectionImageField";



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



        const kind = st.kind;



        if (Number.isFinite(size)) next.size = size;



        if (Number.isFinite(rotation)) next.rotation = rotation;



        if (Number.isFinite(x)) next.x = x;



        if (Number.isFinite(y)) next.y = y;



        if (kind) next.kind = kind;



        return next;



      }),



    };



  });



};







// Una dirección de imagen termina en extensión de imagen (o es data:/blob:).
// Si no, lo más probable es que se haya pegado la dirección de la página donde
// se vio la imagen, y el navegador no puede pintarla.
function looksLikeImageUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return true;
  if (/^(data:image\/|blob:)/i.test(value)) return true;
  return /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?(#.*)?$/i.test(value);
}

export default function RestaurantConfig() {



  const location = useLocation();



  const [active, setActive] = useState("generalConfig");



  const [generalConfigTab, setGeneralConfigTab] = useState("general");



  const [subTab, setSubTab] = useState("sections");



  const { t } = useLanguage();

  const serviceTypeLabels = useMemo(
    () => ({
      DINE_IN: "Salón",
      TAKEOUT: "Para llevar",
      DELIVERY: "Delivery",
      ROOM: "Habitación",
    }),
    []
  );

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

  // Edición de una sección ya creada (sólo nombre e imagen, y sólo si no tiene ventas)
  const [editingSection, setEditingSection] = useState(null);
  const [savingSectionMeta, setSavingSectionMeta] = useState(false);
  // Imágenes de sección que no cargaron: la URL guardada puede ser la de la
  // página y no la del archivo, así que se muestra "Sin imagen" y no un roto.
  const [brokenSectionImages, setBrokenSectionImages] = useState({});



  const [formTable, setFormTable] = useState({ id: "", name: "", kind: "mesa", seats: 2, x: "", y: "", size: 56, rotation: 0, color: "" });



  const [menu, setMenu] = useState([]);



  const [menus, setMenus] = useState([]);



  const [menuName, setMenuName] = useState("");



  const [menuCreateSectionIds, setMenuCreateSectionIds] = useState([]);



  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [menuItemsDrawerOpen, setMenuItemsDrawerOpen] = useState(false);
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



  const [menuAssignServiceType, setMenuAssignServiceType] = useState("");
  const [menuPickerOpen, setMenuPickerOpen] = useState(false);



  const [menuPickerCategory, setMenuPickerCategory] = useState("");



  const [menuPickerSearch, setMenuPickerSearch] = useState("");
  const [menuPickerMenuId, setMenuPickerMenuId] = useState("");
  const [menuPickerEntries, setMenuPickerEntries] = useState([]);
  const [menuPickerSelectedIds, setMenuPickerSelectedIds] = useState([]);
  const [menuPickerFamily, setMenuPickerFamily] = useState("");



  const [menuEntrySearch, setMenuEntrySearch] = useState("");
  const managementPrimaryButtonClass = "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
  const snap = (value, step) => {
    const st = Number(step) || 0;
    const v = Number(value) || 0;
    if (!st) return v;
    return Math.round(v / st) * st;
  };
  const normDeg = (value) => {
    const v = Number(value) || 0;
    return ((v % 360) + 360) % 360;
  };


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



  const [dirtyStyleTableIds, setDirtyStyleTableIds] = useState([]); // size/rotation changed

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
      Object.prototype.hasOwnProperty.call(patch, "rotation")
    ) {
      markStyleDirty(tableId);
    }
  };

  const onCanvasPointerDown = (e, type, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (type !== "table" || !selectedSectionId) return;

    const tableId = String(id || "").trim();
    if (!tableId) return;
    setSelectedTableId(tableId);

    const canvasEl = e.currentTarget?.closest?.("[data-canvas]");
    const rect = canvasEl?.getBoundingClientRect?.();
    if (!rect || !rect.width || !rect.height) return;

    const section = sections.find((sec) => String(sec?.id || "") === String(selectedSectionId));
    const table = (section?.tables || []).find((t) => String(t?.id || "") === tableId);
    if (!table) return;

    setDrag({
      type: "table",
      mode: "move",
      id: tableId,
      sectionId: String(selectedSectionId),
      rect,
      startX: Number(e.clientX),
      startY: Number(e.clientY),
      baseX: Number.isFinite(Number(table.x)) ? Number(table.x) : 50,
      baseY: Number.isFinite(Number(table.y)) ? Number(table.y) : 50,
    });
  };

  useEffect(() => {
    if (!drag || drag.type !== "table" || drag.mode !== "move") return undefined;

    let rafId = null;

    const commit = () => {
      rafId = null;
      const latest = dragLatestRef.current;
      if (!latest) return;

      const dx = Number(latest.x) - Number(drag.startX);
      const dy = Number(latest.y) - Number(drag.startY);
      const x = clamp(Number(drag.baseX) + (dx / Number(drag.rect.width || 1)) * 100, 2, 98);
      const y = clamp(Number(drag.baseY) + (dy / Number(drag.rect.height || 1)) * 100, 5, 95);

      setSections((prev) =>
        (prev || []).map((s) => {
          if (String(s?.id || "") !== String(drag.sectionId)) return s;
          return {
            ...s,
            tables: (s.tables || []).map((t) => (String(t?.id || "") === String(drag.id) ? { ...t, x, y } : t)),
          };
        })
      );
      setTableEdit((prev) => (prev && String(prev.id || "") === String(drag.id) ? { ...prev, x, y } : prev));
      setDirtyPosTableIds((prev) => (prev.includes(drag.id) ? prev : [...prev, drag.id]));
    };

    const onPointerMove = (ev) => {
      dragLatestRef.current = { x: ev.clientX, y: ev.clientY };
      if (rafId == null) rafId = window.requestAnimationFrame(commit);
    };

    const stopDrag = (ev) => {
      if (ev && Number.isFinite(Number(ev.clientX)) && Number.isFinite(Number(ev.clientY))) {
        dragLatestRef.current = { x: ev.clientX, y: ev.clientY };
      }
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      commit();
      dragLatestRef.current = null;
      setDrag(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [drag]);

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



  // Pagos y divisas se ordena en dos carpetas: la divisa que manda sobre los
  // precios y, aparte, los métodos de cobro que ve el TPV.
  const [paymentsTab, setPaymentsTab] = useState("currency");
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
    if (menuItemsDrawerOpen && subTab !== "menus") setMenuItemsDrawerOpen(false);



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
    setDrag(null);
    dragLatestRef.current = null;


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
        serviceType: menuAssignServiceType || null,
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






        serviceType: menuAssignServiceType || null,
        active: menuAssignForm.active !== false,



      };



      const { data } = await api.post(



        `/restaurant/sections/${encodeURIComponent(String(selectedSectionId))}/menus`,



        payload



      );



      setSectionMenuAssignments((prev) => [data, ...prev]);



      setMenuAssignForm((p) => ({ ...p, menuId: "" }));
      setMenuAssignServiceType("");



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
        serviceType: menuAssignServiceType || null,
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
      setMenuAssignServiceType("");
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
    setMenuAssignServiceType(assignment.serviceType || "");
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
    setMenuAssignServiceType("");
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



    // La moneda base manda sobre los precios del restaurante: base y cambio
    // tienen que ser distintas y las dos tasas mayores que cero.
    const baseCurrency = String(payments.monedaBase || "").toUpperCase();
    const exchangeCurrency = String(payments.monedaSec || "").toUpperCase();
    if (!baseCurrency || !exchangeCurrency) {
      alert(t("mgmt.restaurant.alert.title"), "Elegí la moneda base y la moneda de cambio.");
      return;
    }
    if (baseCurrency === exchangeCurrency) {
      alert(t("mgmt.restaurant.alert.title"), "La moneda base y la moneda de cambio deben ser distintas.");
      return;
    }
    const buyRate = Number(String(payments.tipoCambioCompra ?? "").replace(",", "."));
    const sellRate = Number(String(payments.tipoCambioVenta ?? "").replace(",", "."));
    if (!payments.useBCCR && (!Number.isFinite(buyRate) || buyRate <= 0 || !Number.isFinite(sellRate) || sellRate <= 0)) {
      alert(t("mgmt.restaurant.alert.title"), "Los tipos de cambio de compra y de venta deben ser mayores que cero.");
      return;
    }
    if (buyRate > sellRate) {
      alert(t("mgmt.restaurant.alert.title"), "El tipo de cambio de compra no puede ser mayor que el de venta.");
      return;
    }

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



  







  const MesaFreeIcon = ({ className = "" }) => {
  const [ok, setOk] = React.useState(true);
  if (!ok) {
    return <div className={`${className} rounded bg-slate-200`} />;
  }
  return (
    <img
      alt="Mesa"
      src={TABLE_FREE_ICON_URL}
      className={className}
      style={{ objectFit: "contain" }}
      onError={() => setOk(false)}
    />
  );
};

const BASE_URL = import.meta.env.BASE_URL || "/";

const TABLE_FREE_ICON_URL = `${BASE_URL}assets/restaurant/table-free.png`;



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



        {/* Row 1: title + section selector */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.floorplan.title")}</div>
            <h3 className="font-semibold text-lg" style={{ color: "var(--color-text-base)" }}>{t("mgmt.restaurant.floorplan.subtitle")}</h3>
          </div>
          <CustomSelect
            className="h-9"
            value={selectedSectionId || ""}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            title={t("mgmt.restaurant.floorplan.selectSectionTitle")}
          >
            {(sections || []).map((s) => (
              <option key={s.id} value={s.id}>{s.name || s.id}</option>
            ))}
          </CustomSelect>
        </div>

        {/* Row 2: background controls + status + save */}
        {selectedSectionId && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.floorplan.backgroundTitle")}</span>
            <input
              type="color"
              value={backgroundForm.color || "#eefce5"}
              onChange={(e) => setBackgroundForm((f) => ({ ...f, color: e.target.value }))}
              className="h-8 w-10 rounded cursor-pointer"
              style={{ border: "1px solid var(--input-border)" }}
              title={t("mgmt.restaurant.floorplan.backgroundColor")}
            />
            <input
              type="text"
              value={backgroundForm.image || ""}
              onChange={(e) => setBackgroundForm((f) => ({ ...f, image: e.target.value }))}
              placeholder={t("mgmt.restaurant.floorplan.backgroundImage")}
              className="h-8 flex-1 min-w-[180px] max-w-xs"
            />
            <div className="ml-auto flex items-center gap-2">
              {(floorplanHasChanges || backgroundDirty) ? (
                <span className="px-2 py-0.5 rounded-lg text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300">{t("mgmt.restaurant.floorplan.unsaved")}</span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">{t("mgmt.restaurant.floorplan.saved")}</span>
              )}
              <Button type="button" onClick={saveFloorplan} disabled={floorplanSaving || (!floorplanHasChanges && !backgroundDirty)}>
                {floorplanSaving ? t("mgmt.restaurant.floorplan.saving") : t("mgmt.restaurant.floorplan.save")}
              </Button>
            </div>
          </div>
        )}







        {!selectedSectionId && <div className="text-sm text-slate-400">{t("mgmt.restaurant.assignments.selectSection")}</div>}







        {selectedSectionId && (



          <div className="space-y-3">

            {/* ── Panel Selected Table — barra horizontal compacta ── */}
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide shrink-0">
                  {t("mgmt.restaurant.floorplan.selectedTable")}
                </div>

                {!selectedTable || !tableEdit ? (
                  <div className="text-sm text-slate-400 italic">{t("mgmt.restaurant.floorplan.selectedTableHint")}</div>
                ) : (
                  <>
                    {/* Nombre + tipo */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-slate-800">{selectedTable.id}</span>
                      <span className="text-xs text-slate-400 bg-white/10 rounded px-1.5 py-0.5">
                        {(TABLE_KIND_OPTIONS.find((o) => o.id === String(tableEdit.kind || "mesa").toLowerCase())?.label) || "Mesa"}
                      </span>
                    </div>

                    {/* Posición */}
                    <div className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 shrink-0">
                      X: {Number(tableEdit.x ?? 50).toFixed(1)}% · Y: {Number(tableEdit.y ?? 50).toFixed(1)}%
                    </div>

                    {/* Tamaño */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-slate-600">{t("mgmt.restaurant.floorplan.iconSize")}</span>
                      <input
                        type="range" min="24" max="160"
                        value={Number(tableEdit.size ?? 56)}
                        onChange={(e) => applyTableEdit({ size: clamp(Number(e.target.value || 56), 24, 160) })}
                        className="w-28"
                      />
                      <span className="text-xs text-slate-500 w-10">{Number(tableEdit.size ?? 56)}px</span>
                    </div>

                    {/* Rotation snap */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-slate-600">{t("mgmt.restaurant.floorplan.rotationSnap")}</span>
                      <CustomSelect
                        className="h-7"
                        value={rotationSnap}
                        onChange={(e) => setRotationSnap(Number(e.target.value || 0))}
                      >
                        {[0, 5, 10, 15, 30, 45, 90].map((v) => (
                          <option key={v} value={v}>{v === 0 ? "Off" : `${v}°`}</option>
                        ))}
                      </CustomSelect>
                      <button type="button" className="h-7 w-7 rounded border hover:bg-white/5 text-xs font-bold"
                        onClick={() => applyTableEdit({ rotation: normDeg(Number(tableEdit.rotation || 0) - (Number(rotationSnap) || 15)) })}>-</button>
                      <span className="text-xs text-slate-500 w-8 text-center">{tableEdit.rotation ?? 0}°</span>
                      <button type="button" className="h-7 w-7 rounded border hover:bg-white/5 text-xs font-bold"
                        onClick={() => applyTableEdit({ rotation: normDeg(Number(tableEdit.rotation || 0) + (Number(rotationSnap) || 15)) })}>+</button>
                    </div>

                    {/* Estado guardado */}
                    <div className="ml-auto text-xs text-slate-400 shrink-0">
                      {dirtyStyleTableIds.includes(selectedTable.id) ? "Estilo sin guardar" : "Estilo guardado"} · {t("mgmt.restaurant.floorplan.useSave")}
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* ── Canvas — ahora ocupa todo el ancho ── */}
            <div className="space-y-3">



              <div



                data-canvas



                className="relative w-full h-[580px] rounded-2xl border overflow-hidden"



                style={{



                  backgroundColor: backgroundForm.color || "#f3fce8",



                  backgroundImage: sanitizeCssBackgroundImage(backgroundForm.image),



                  backgroundSize: "cover",



                  backgroundPosition: "center",



                }}



              >







                {(selectedSection?.tables || []).map((t) => {



                  const Icon = getTableFreeIcon(t.kind || "mesa");



                  const size = Number(t.size ?? 56) || 56;



                  const rotation = Number(t.rotation ?? 0) || 0;



                  const selected = selectedTableId === t.id;



                  return (



                    <button



                      key={t.id}



                      type="button"



                      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 select-none group cursor-grab active:cursor-grabbing touch-none"



                      style={{ left: `${Number(t.x ?? 50)}%`, top: `${Number(t.y ?? 50)}%` }}



                      onPointerDown={(e) => onCanvasPointerDown(e, "table", t.id)}



                      title={`Mesa ${t.id} (${t.seats} personas) - ${selectedSection?.name || selectedSection?.id || ""}`}



                    >



                      <div



                        className={`${selected ? "ring-2 ring-amber-500" : ""} rounded-xl`}



                        style={{ width: size, height: size, transform: `rotate(${rotation}deg)` }}



                      >



                        <Icon className="w-full h-full" />



                      </div>



                      <div



                        className={`text-sm font-bold bg-slate-800 border border-white/10 rounded-lg px-2 py-0.5 shadow-sm transition ${selected ? "border-amber-400 text-amber-300" : "border-white/10 text-amber-300 group-hover:border-amber-400"}`}



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







              <div className="text-xs text-slate-400 hidden">{t("mgmt.restaurant.floorplan.tip")}</div>



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



      return false;



    }



    return true;



  };



  const saveSectionMeta = async (sectionId) => {
    if (!editingSection || savingSectionMeta) return;
    const name = String(editingSection.name || "").trim();
    if (!name) return;
    setSavingSectionMeta(true);
    try {
      const ok = await updateSectionMeta(sectionId, {
        name,
        imageUrl: String(editingSection.imageUrl || "").trim(),
      });
      if (!ok) return;
      setEditingSection(null);
    } finally {
      setSavingSectionMeta(false);
    }
  };

  const renderSections = ({ showSections = true, showTables = true, showMenus = true } = {}) => (



    <div className="space-y-4">



      {showSections && (



        <Card className="p-4 space-y-3">



          <div className="flex items-center justify-between gap-3 flex-wrap">



            <div>



              <div className="text-xs uppercase text-slate-400">{t("mgmt.restaurant.sections.title")}</div>



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







          <div className="grid md:grid-cols-[9rem_1fr_1fr_auto] gap-3 items-center">



            <Input



              placeholder={t("mgmt.restaurant.sections.idOptional")}



              value={formSection.id}



              onChange={(e) => setFormSection((f) => ({ ...f, id: e.target.value }))}



            />



            <Input



              placeholder={t("mgmt.restaurant.sections.name")}



              value={formSection.name}



              onChange={(e) => setFormSection((f) => ({ ...f, name: e.target.value }))}



            />



            <SectionImageField
              placeholder={t("mgmt.restaurant.sections.imageOptional")}
              value={formSection.imageUrl}
              onChange={(next) => setFormSection((f) => ({ ...f, imageUrl: next }))}
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

          {!looksLikeImageUrl(formSection.imageUrl) && (
            <div className="text-[11px] text-amber-600">
              Esa dirección parece una página, no una imagen. Usá clic derecho sobre la imagen → «Copiar dirección de la imagen» (termina en .jpg, .png o .webp).
            </div>
          )}







          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">



            {(sections || []).map((s) => (



              <div



                key={s.id}



                className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer ${



                  String(selectedSectionId) === String(s.id) ? "ring-2 ring-indigo-400" : ""



                }`}



                onClick={() => setSelectedSectionId(s.id)}



              >



                <div className="relative h-28 bg-white/5">



                  {s.imageUrl && !brokenSectionImages[s.id] ? (
                    <img
                      src={sanitizeImageUrl(s.imageUrl)}
                      alt={s.name || s.id}
                      className="h-full w-full object-cover"
                      onError={() => setBrokenSectionImages((prev) => ({ ...prev, [s.id]: true }))}
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-0.5 px-2 text-center text-xs text-slate-400">
                      <span>{t("mgmt.restaurant.sections.noImage")}</span>
                      {s.imageUrl ? <span className="text-[10px] opacity-80">La dirección no es una imagen</span> : null}
                    </div>
                  )}



                </div>



                <div className="p-3 space-y-1">



                  <div className="text-xs uppercase text-slate-400">{t("mgmt.restaurant.sections.cardLabel")}</div>



                  <div className="font-semibold text-slate-900">{s.name || s.id}</div>



                  <div className="text-xs text-slate-500">ID: {s.id}</div>



                  <div className="text-xs text-slate-500">{(s.tables || []).length} {t("mgmt.restaurant.common.tables")}</div>



                  {editingSection?.id === s.id && (



                    <div className="space-y-2 pt-2" onClick={(e) => e.stopPropagation()}>



                      <Input



                        placeholder={t("mgmt.restaurant.sections.name")}



                        value={editingSection.name}



                        onChange={(e) => setEditingSection((f) => ({ ...f, name: e.target.value }))}
                        disabled={Boolean(s.used)}
                        title={s.used ? "Ya tiene ventas: el nombre no se puede cambiar, la imagen sí" : undefined}



                      />



                      <SectionImageField
                        placeholder={t("mgmt.restaurant.sections.imageOptional")}
                        value={editingSection.imageUrl}
                        onChange={(next) => setEditingSection((f) => ({ ...f, imageUrl: next }))}
                      />



                      <div className="flex items-center gap-2">



                        <Button



                          onClick={() => saveSectionMeta(s.id)}



                          disabled={savingSectionMeta || !String(editingSection.name || "").trim()}



                          className={managementPrimaryButtonClass}



                        >{savingSectionMeta ? "Guardando..." : "Guardar"}</Button>



                        <Button variant="outline" onClick={() => setEditingSection(null)}>Cancelar</Button>



                      </div>



                    </div>



                  )}



                  <div className="flex items-center justify-between pt-2">



                    <button



                      type="button"



                      className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"



                      onClick={(e) => {



                        e.preventDefault();



                        e.stopPropagation();



                        removeSection(s.id);



                      }}



                    >{t("mgmt.restaurant.common.delete")}</button>



                    {s.used && (
                      <span className="text-[11px] text-slate-500" title="Ya tiene ventas registradas: el nombre queda fijo para no alterar reportes ni contabilidad. La imagen sí se puede cambiar.">En uso · nombre fijo</span>
                    )}
                      <button
                        type="button"
                        className="text-xs text-indigo-600"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingSection({ id: s.id, name: s.name || "", imageUrl: s.imageUrl || "" });
                        }}
                      >Editar</button>




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



            <div className="text-xs uppercase text-slate-400">{t("mgmt.restaurant.tables.title")}</div>



            <h3 className="font-semibold text-lg">{t("mgmt.restaurant.tables.subtitle")}</h3>



            <p className="text-xs text-slate-400 mt-1">{t("mgmt.restaurant.tables.help")}</p>



          </div>



          <div className="flex gap-2">



            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1">



              {TABLE_KIND_OPTIONS.map((opt) => {



                const Icon = getTableFreeIcon(opt.id);



                const activeKind = String(formTable.kind || "mesa").toLowerCase() === opt.id;



                return (



                  <button



                    key={opt.id}



                    type="button"



                    className={`h-9 w-9 rounded-lg border flex items-center justify-center transition ${



                      activeKind ? "bg-amber-500/20 border-amber-500/40" : "bg-white/5 border-white/10 hover:bg-white/10"



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



            <CustomSelect



              className="h-10 w-60"



              value={selectedSectionId || ""}



              onChange={(e) => setSelectedSectionId(e.target.value)}



              title={t("mgmt.restaurant.tables.sectionTitle")}



            >



              {(sections || []).map((s) => (



                <option key={s.id} value={s.id}>



                  {s.name || s.id}



                </option>



              ))}



            </CustomSelect>



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



            <div className="text-xs text-slate-400">{t("mgmt.restaurant.tables.layoutFor")} <span className="font-semibold">{selectedSection.name || selectedSection.id}</span></div>



            <div className="mt-2 border border-white/10 rounded-lg p-3 bg-white/5">



              <div className="text-[11px] text-slate-400 mb-2">{t("mgmt.restaurant.tables.gridHint")}</div>



              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">



                {(selectedSection.tables || []).map((table) => (



                  <div



                    key={table.id}



                    className="relative flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-sm py-3 px-2"



                  >



                    <div className="text-sm text-slate-400">{selectedSection.name || selectedSection.id}</div>



                    <div className="text-base font-bold text-slate-200">{table.id}</div>



                    <div className="text-sm text-slate-400">{table.seats} {t("mgmt.restaurant.tables.people")}</div>



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



                  <div className="text-sm text-slate-400 col-span-full">{t("mgmt.restaurant.tables.empty")}</div>



                )}



              </div>



            </div>



          </>



        ) : (



          <div className="text-sm text-slate-400">{t("mgmt.restaurant.tables.selectSection")}</div>



        )}



        </Card>



      )}







      {showMenus && (
      <div className="space-y-4">

        {/* ── Header ── */}
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.menus.title")}</div>
          <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>{t("mgmt.restaurant.menus.header")}</h3>
        </div>

        {/* ── Crear menú + Horario, todo en una fila ── */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] max-w-[340px] flex-1">
              <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.menus.createTitle")}</div>
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder={t("mgmt.restaurant.menus.newMenuPlaceholder")}
                  value={menuName}
                  onChange={(e) => setMenuName(e.target.value)}
                />
                {editingAssignmentId ? (
                  <>
                    <Button onClick={applyAssignmentEdit} className={managementPrimaryButtonClass}>{t("mgmt.restaurant.menus.updateAssignment")}</Button>
                    <Button variant="outline" onClick={cancelAssignmentEdit}>{t("mgmt.restaurant.menus.cancel")}</Button>
                  </>
                ) : (
                  <Button onClick={createMenu} className={managementPrimaryButtonClass}>{t("mgmt.restaurant.menus.createButton")}</Button>
                )}
              </div>
            </div>
            <div className="w-44">
              <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>Tipo de servicio</div>
              <select
                className="h-10 w-full rounded-lg border px-2 text-sm"
                style={{
                  background: "var(--input-bg, var(--card-bg))",
                  borderColor: "var(--card-border)",
                  color: "var(--color-text-base)",
                }}
                value={menuAssignServiceType}
                onChange={(e) => setMenuAssignServiceType(e.target.value)}
              >
                <option value="">Todos los servicios</option>
                <option value="DINE_IN">Salón (Dine in)</option>
                <option value="TAKEOUT">Para llevar</option>
                <option value="DELIVERY">Delivery</option>
                <option value="ROOM">Habitación</option>
              </select>
            </div>
            <div className="w-28">
              <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.menus.start")}</div>
              <Input type="time" value={menuAssignForm.startTime} onChange={(e) => setMenuAssignForm((p) => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div className="w-28">
              <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.menus.end")}</div>
              <Input type="time" value={menuAssignForm.endTime} onChange={(e) => setMenuAssignForm((p) => ({ ...p, endTime: e.target.value }))} />
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.assignments.column.days")}</div>
              <div className="flex gap-1">
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
                    <label key={d.label} className={`inline-flex items-center justify-center w-9 h-10 rounded-lg border text-[10px] font-semibold cursor-pointer select-none transition-colors ${checked ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"}`}>
                      <input type="checkbox" className="hidden" checked={checked} onChange={(e) => setMenuAssignForm((p) => ({ ...p, daysMask: e.target.checked ? Number(p.daysMask) | d.bit : Number(p.daysMask) & ~d.bit }))} />
                      {d.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {editingAssignmentId && (
            <div className="text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600">{t("mgmt.restaurant.assignments.editingHint")}</div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.menus.visibleInSections")}</span>
            {(sections || []).map((s) => {
              const checked = (menuCreateSectionIds || []).includes(s.id);
              return (
                <label key={s.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer select-none transition-colors ${checked ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400 font-medium" : "bg-transparent border-white/10 text-slate-400 hover:bg-white/5"}`}>
                  <input type="checkbox" className="hidden" checked={checked} onChange={(e) => {
                    const isChecked = e.target.checked;
                    setMenuCreateSectionIds((prev) => {
                      const list = Array.isArray(prev) ? [...prev] : [];
                      if (isChecked) { if (!list.includes(s.id)) list.push(s.id); }
                      else { return list.filter((x) => x !== s.id); }
                      return list;
                    });
                  }} />
                  {checked ? "✓ " : ""}{s.name || s.id}
                </label>
              );
            })}
            {(sections || []).length === 0 && <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.menus.noSections")}</div>}
          </div>
        </Card>

        {/* ── Cards de menús ── */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.assignments.title")}</div>
          {!selectedSectionId ? (
            <div className="py-10 text-center text-sm rounded-xl border border-dashed" style={{ color: "var(--color-text-muted)", borderColor: "var(--card-border)" }}>
              {t("mgmt.restaurant.assignments.selectSection")}
            </div>
          ) : sectionMenuRows.length === 0 ? (
            <div className="py-10 text-center text-sm rounded-xl border border-dashed" style={{ color: "var(--color-text-muted)", borderColor: "var(--card-border)" }}>
              {t("mgmt.restaurant.assignments.empty")}
            </div>
          ) : (
            <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--color-text-muted)", borderBottom: "1px solid var(--card-border)" }}>
                    <th className="text-left font-semibold px-3 py-2 w-8">#</th>
                    <th className="text-left font-semibold px-3 py-2">Menú</th>
                    <th className="text-left font-semibold px-3 py-2">Estado</th>
                    <th className="text-left font-semibold px-3 py-2">Servicio</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Horario</th>
                    <th className="text-left font-semibold px-3 py-2">Secciones</th>
                    <th className="text-right font-semibold px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(sectionMenuRows || []).map((row, idx) => {
                    const a = row.assignment;
                    const menu = row.menu;
                    const rowMenuId = String(row?.menuId || menu?.id || a?.menuId || a?.menu?.id || "").trim();
                    const visibleSections = Array.isArray(row?.visibleSections) ? row.visibleSections : [];
                    const isSelected = rowMenuId && String(selectedMenuId || "").trim() === rowMenuId;
                    const assignmentSectionId = String(a?.sectionId || a?.section?.id || "").trim();
                    const canEditAssignment = !!a && !!String(a?.id || "").trim() && !!assignmentSectionId;
                    const isActive = a ? a.active !== false : false;
                    const menuName_ = menu?.name || a?.menu?.name || rowMenuId || "-";
                    const statusLabel = isActive ? t("mgmt.restaurant.assignments.status.active") : a ? t("mgmt.restaurant.assignments.status.inactive") : t("mgmt.restaurant.assignments.status.unassigned");
                    const statusDot = isActive ? "#059669" : a ? "#e11d48" : "#94a3b8";
                    return (
                      <tr
                        key={rowMenuId || menu?.id || a?.id || idx}
                        className="cursor-pointer transition-colors hover:bg-white/5"
                        style={{
                          borderBottom: "1px solid var(--card-border)",
                          background: isSelected ? "rgba(99,102,241,0.10)" : undefined,
                          boxShadow: isSelected ? "inset 3px 0 0 #6366f1" : undefined,
                        }}
                        onClick={() => {
                          if (!rowMenuId) return;
                          setSelectedMenuId(rowMenuId);
                          setMenuAssignForm((prev) => ({ ...prev, menuId: rowMenuId }));
                          setMenuPickerMenuId(rowMenuId);
                          setMenuItemsDrawerOpen(false);
                        }}
                      >
                        <td className="px-3 py-2 tabular-nums text-xs align-middle" style={{ color: "var(--color-text-muted)" }}>{idx + 1}</td>
                        <td className="px-3 py-2 align-middle">
                          <div className="font-semibold leading-tight" style={{ color: "var(--color-text-base)" }}>{menuName_}</div>
                        </td>
                        <td className="px-3 py-2 align-middle whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-text-base)" }}>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusDot }} />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle whitespace-nowrap text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {a?.serviceType ? (serviceTypeLabels[a.serviceType] || a.serviceType) : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle whitespace-nowrap text-xs tabular-nums" style={{ color: "var(--color-text-muted)" }}>
                          {a ? `${a.startTime || "00:00"} – ${a.endTime || "24:00"}` : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {visibleSections.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {visibleSections.map((sRef, si) => {
                                const sid = String(sRef?.id || "").trim();
                                const isCurrent = sid && String(selectedSectionId || "").trim() === sid;
                                return (
                                  <span key={`${rowMenuId}-${sid || si}`} className={`text-[11px] px-2 py-0.5 rounded-full border ${isCurrent ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" : "bg-white/5 text-slate-400 border-white/10"}`}>
                                    {sRef?.name || sid || "-"}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors hover:bg-indigo-500/10 hover:border-indigo-400/40 hover:text-indigo-400 whitespace-nowrap"
                              style={{ borderColor: "var(--card-border)", color: "var(--color-text-muted)" }}
                              onClick={() => {
                                if (!rowMenuId) return;
                                setSelectedMenuId(rowMenuId);
                                setMenuAssignForm((prev) => ({ ...prev, menuId: rowMenuId }));
                                setMenuPickerMenuId(rowMenuId);
                                setMenuItemsDrawerOpen(true);
                              }}
                            >
                              {t("mgmt.restaurant.menuItems.title")}
                            </button>
                            {canEditAssignment && (
                              <button
                                className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors hover:bg-indigo-500/10 hover:border-indigo-400/40 hover:text-indigo-400 whitespace-nowrap"
                                style={{ borderColor: "var(--card-border)", color: "var(--color-text-muted)" }}
                                onClick={() => {
                                  if (!a) return;
                                  const targetSectionId = String(a?.sectionId || a?.section?.id || "").trim();
                                  if (targetSectionId && targetSectionId !== String(selectedSectionId || "").trim()) setSelectedSectionId(targetSectionId);
                                  startEditAssignment({ ...a, menuId: String(a?.menuId || rowMenuId || "").trim() });
                                }}
                              >
                                {t("mgmt.restaurant.assignments.action.edit")}
                              </button>
                            )}
                            <button
                              className="text-xs px-2 py-1 rounded-lg border font-medium transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-rose-500 border-rose-200/50"
                              onClick={() => deleteMenuById(rowMenuId)}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Drawer: items del menú seleccionado ── */}
        {menuItemsDrawerOpen && selectedMenuId && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-6" onClick={() => setMenuItemsDrawerOpen(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative z-10 flex flex-col w-full max-w-[min(94vw,760px)] max-h-[86vh] rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del drawer */}
              <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">🍽</div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--color-text-base)" }}>
                      {sectionMenuRows.find((r) => {
                        const mid = String(r?.menuId || r?.menu?.id || r?.assignment?.menuId || r?.assignment?.menu?.id || "").trim();
                        return mid === selectedMenuId;
                      })?.menu?.name || selectedMenuId}
                    </div>
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {t("mgmt.restaurant.menuItems.title")} · {menuEntries.length} {t("mgmt.restaurant.menuItems.count") || "items"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={reloadMenuPickerEntries} disabled={saving.menuEntries} className="h-8 px-3 text-xs">
                    {t("mgmt.restaurant.menuItems.reload")}
                  </Button>
                  <Button onClick={() => setMenuPickerOpen(true)} className={`${managementPrimaryButtonClass} h-8 px-3 text-xs`}>
                    {t("mgmt.restaurant.menuItems.openPicker")}
                  </Button>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10 text-slate-400 hover:text-white text-lg"
                    onClick={() => setMenuItemsDrawerOpen(false)}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Buscador */}
              <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--card-border)" }}>
                <Input
                  placeholder={t("mgmt.restaurant.menuItems.searchPlaceholder")}
                  value={menuEntrySearch}
                  onChange={(e) => setMenuEntrySearch(e.target.value)}
                />
              </div>

              {/* Lista de items */}
              <div className="flex-1 overflow-y-auto">
                {(filteredMenuEntries || []).length === 0 ? (
                  <div className="py-16 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                    {t("mgmt.restaurant.menuItems.empty")}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
                    {(filteredMenuEntries || []).map((e) => {
                      const it = e?.item || {};
                      const colorVal =
                        typeof it.color === "string" && /^#?[0-9a-fA-F]{6}$/.test(it.color)
                          ? it.color.startsWith("#") ? it.color : `#${it.color}`
                          : "#ffffff";
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                          {/* Color swatch */}
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
                            className="w-7 h-7 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                          />

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate" style={{ color: "var(--color-text-base)" }}>{it.name || e.itemId}</div>
                            <div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
                              {[it.familyName, it.subFamilyName, it.subSubFamilyName].filter(Boolean).join(" › ") || it.code || ""}
                            </div>
                          </div>

                          {/* Código */}
                          {it.code && (
                            <div className="text-xs font-mono shrink-0" style={{ color: "var(--color-text-muted)" }}>{it.code}</div>
                          )}

                          {/* Toggle activo */}
                          <input
                            type="checkbox"
                            checked={it.active !== false}
                            onChange={(ev) => patchItemQuick(e.itemId, { active: ev.target.checked })}
                            title={t("mgmt.restaurant.menuItems.action.toggleActive")}
                            className="w-4 h-4 accent-indigo-600 cursor-pointer shrink-0"
                          />

                          {/* Quitar */}
                          <button
                            className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-rose-500 border-rose-200/50 shrink-0"
                            onClick={() => removeMenuEntry(e.id)}
                            disabled={saving.menuEntries}
                          >
                            {t("mgmt.restaurant.menuItems.action.remove")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 shrink-0 text-xs" style={{ borderTop: "1px solid var(--card-border)", color: "var(--color-text-muted)" }}>
                {t("mgmt.restaurant.menuItems.helper")}
              </div>
            </div>
          </div>
        )}

      </div>
      )}







      {menuPickerOpen && (



        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 md:p-6">



          <div className="w-full max-w-[min(92vw,1240px)] bg-slate-800 rounded-2xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">



            <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b bg-white/5">



              <div className="min-w-0">



                <div className="text-xs uppercase tracking-wide text-slate-400">{t("mgmt.restaurant.menuItems.openPicker")}</div>



              </div>



              <button



                className="h-9 w-9 rounded-lg border bg-white/5 hover:bg-white/10 flex items-center justify-center"



                onClick={() => setMenuPickerOpen(false)}



                title={t("mgmt.restaurant.menuPicker.close")}



              >



                <XIcon className="h-5 w-5 text-slate-600" />



              </button>



            </div>







            <div className="p-3 md:p-4 grid md:grid-cols-[220px_minmax(0,1fr)] gap-3 md:gap-4 min-h-0 flex-1 overflow-hidden">



              <div className="space-y-3 min-h-0 flex flex-col">



                <Input



                  placeholder={t("mgmt.restaurant.menuPicker.search")}



                  value={menuPickerSearch}



                  onChange={(e) => setMenuPickerSearch(e.target.value)}



                />



                <div className="text-xs uppercase text-slate-400">{t("mgmt.restaurant.menuPicker.categories")}</div>



                <div className="space-y-2 overflow-auto pr-1 min-h-0 rounded-xl border border-white/10 p-2 bg-white/5">



                  <button



                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${menuPickerCategory === "" ? "bg-white/5 border-indigo-500/40 text-indigo-200" : "bg-white/5 border-white/10 text-slate-300"}`}



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



                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${menuPickerCategory === cat ? "bg-white/5 border-indigo-500/40 text-indigo-200" : "bg-white/5 border-white/10 text-slate-300"}`}



                        onClick={() => setMenuPickerCategory(cat)}



                      >



                        {cat}



                      </button>



                    ))}



                </div>



              </div>







              <div className="space-y-3 min-h-0 flex flex-col overflow-hidden">



                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 p-2 bg-white/5">
                  <div className="flex items-center gap-2">
                    <CustomSelect
                      className="h-9"
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
                    </CustomSelect>
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

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-2 bg-white/5">
                  <CustomSelect
                    className="h-9"
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
                  </CustomSelect>
                  <Button variant="outline" onClick={assignFamilyToMenu} disabled={!menuPickerFamily}>{t("mgmt.restaurant.menuPicker.assignFamily")}</Button>
                  <Button variant="outline" onClick={() => setMenuPickerSelectedIds([])}>
                    Limpiar seleccion
                  </Button>
                </div>







                <div className="min-h-0 flex-1 overflow-auto pr-1">
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



                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">



                      {filtered.map((it) => {



                        const entry = inMenu.get(it.id);



                        const isInMenu = Boolean(entry);



                        const isSelected = (menuPickerSelectedIds || []).includes(it.id);



                        const displayPrice = Number(it.price || 0);



                        return (



                          <button



                            key={it.id}



                            className={`text-left border rounded-xl p-3 hover:shadow-sm transition ${isInMenu ? "bg-emerald-900/30 border-emerald-500/40" : isSelected ? "bg-white/5 border-indigo-500/40" : "bg-white/5 border-white/10"}`}



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



                                <div className="text-xs text-slate-400">{it.code}</div>



                                <div className="font-semibold text-sm truncate">{it.name}</div>



                                <div className="text-xs text-slate-400 truncate">



                                  {String(it?.subSubFamily || it?.subFamily || it?.family || "General")}



                                </div>



                              </div>



                              {isInMenu ? (
                                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{t("mgmt.restaurant.menuPicker.inMenu")}</span>
                              ) : isSelected ? (
                                <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-indigo-300 border border-indigo-500/40">{t("mgmt.restaurant.menuPicker.selected")}</span>
                              ) : (
                                <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">{t("mgmt.restaurant.menuPicker.select")}</span>
                              )}



                            </div>



                            <div className="mt-2 text-sm font-semibold">${displayPrice.toFixed(2)}</div>



                          </button>



                        );



                      })}



                      {filtered.length === 0 && <div className="text-sm text-slate-400 col-span-full">{t("mgmt.restaurant.menuPicker.noItems")}</div>}



                    </div>



                  );



                })()}
                </div>



              </div>



            </div>



          </div>



        </div>



      )}



    </div>



  );



  const renderPrinters = () => (



    <Card className="p-5 space-y-3 mx-auto w-full max-w-5xl">



      <div>



        <h3 className="font-semibold text-lg">{t("mgmt.restaurant.printers.title")}</h3>



        <p className="text-sm text-slate-400">{t("mgmt.restaurant.printers.help")}</p>



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



            <div className="text-xs text-slate-400 mb-1">{t("mgmt.restaurant.printers.paperType")}</div>



            <CustomSelect



              className="h-10 w-full rounded-lg px-3 text-sm"



              value={printing.paperType || "80mm"}



              onChange={(e) => setPrinting((p) => ({ ...p, paperType: e.target.value }))}



            >



              <option value="80mm">80mm</option>



              <option value="58mm">58mm</option>



              <option value="A4">A4</option>



            </CustomSelect>



          </label>



          <label className="text-sm">



            <div className="text-xs text-slate-400 mb-1">{t("mgmt.restaurant.printers.defaultDoc")}</div>



            <CustomSelect



              className="h-10 w-full rounded-lg px-3 text-sm"



              value={printing.defaultDocType || "TE"}



              onChange={(e) => setPrinting((p) => ({ ...p, defaultDocType: e.target.value }))}



            >



              <option value="TE">{t("mgmt.restaurant.printers.ticketTE")}</option>



              <option value="FE">{t("mgmt.restaurant.printers.invoiceFE")}</option>



            </CustomSelect>



          </label>



          <div className="text-xs text-slate-400 flex items-end">{t("mgmt.restaurant.printers.typesHelp")}</div>



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



              <div key={printType.key} className="grid md:grid-cols-[140px_120px_1fr_1fr_120px] gap-2 items-center border border-white/10 rounded-lg p-3 bg-white/5">



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



                <CustomSelect



                  className="h-10"



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



                </CustomSelect>



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







      <div className="grid gap-4 lg:grid-cols-2 items-start">



        <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--card-border)" }}>



          <div className="text-[11px] uppercase tracking-wide text-slate-800 font-semibold">{t("mgmt.restaurant.taxes.title")}</div>



          <div className="flex flex-wrap items-end gap-4">



            <div>



              <div className="text-xs uppercase text-slate-400 mb-1">{t("mgmt.restaurant.taxes.vat")}</div>



              <Input



                type="number"



                placeholder="0"



                value={taxes.iva}



                onChange={(e) => setTaxes((t) => ({ ...t, iva: e.target.value }))}



                className="!w-20 !min-w-0"



              />



            </div>



            <div>



              <div className="text-xs uppercase text-slate-400 mb-1">{t("mgmt.restaurant.taxes.service")}</div>



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







        <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: "var(--card-border)" }}>



          <div className="text-[11px] uppercase tracking-wide text-slate-800 font-semibold">{t("mgmt.restaurant.discounts.title")}</div>



          <div className="flex items-center gap-2 text-sm h-10">



            <input



              type="checkbox"



              checked={Boolean(taxes.permitirDescuentos)}



              onChange={(e) => setTaxes((t) => ({ ...t, permitirDescuentos: e.target.checked }))}



            />



            {t("mgmt.restaurant.discounts.allow")}



          </div>



          <div className="space-y-3">



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



            <div className="border rounded-lg overflow-hidden w-full">



              <div className="px-3 py-2 text-xs uppercase text-slate-400 bg-white/5">{t("mgmt.restaurant.discounts.created")}</div>



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



                                className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"



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



          <p className="text-sm text-slate-400">{t("mgmt.restaurant.general.subtitle")}</p>



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
          <p className="text-sm text-slate-400">{t("mgmt.restaurant.billing.subtitle")}</p>
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

      <Card className="p-4 space-y-3 border border-white/10">
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
        <Card className="p-4 space-y-3 border border-white/10">
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

        <Card className="p-4 space-y-3 border border-white/10">
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

      <Card className="p-4 space-y-3 border border-white/10">
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



          <p className="text-sm text-slate-400">{t("mgmt.restaurant.payments.subtitle")}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setPaymentsTab("currency")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                paymentsTab === "currency"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Divisa
            </button>
            <button
              type="button"
              onClick={() => setPaymentsTab("methods")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                paymentsTab === "methods"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Métodos de pago
            </button>
          </div>



        </div>



        {showSave && (
          <Button onClick={savePayments} className={managementPrimaryButtonClass}>
            {t("mgmt.restaurant.payments.save")}
          </Button>
        )}



      </div>







      <Card className={"p-5 space-y-4 " + (paymentsTab === "currency" ? "" : "hidden")}>



        <div>



          <div className="text-xs uppercase text-slate-400">{t("mgmt.restaurant.payments.currencyTitle")}</div>



          <div className="font-semibold">{t("mgmt.restaurant.payments.currencySubtitle")}</div>



          <div className="text-sm text-slate-400">



            <div className="text-[11px] text-slate-500">
              {t("mgmt.restaurant.payments.currencyNote")}
            </div>



          </div>



        </div>







        <div className="grid grid-cols-2 gap-3 max-w-[360px]">



          <label className="text-sm">



            <div className="text-xs text-slate-400 mb-1">{t("mgmt.restaurant.payments.baseCurrency") }</div>



            <CustomSelect



              className="h-10 w-full rounded-lg px-3 text-sm"



              value={payments.monedaBase || "CRC"}



              onChange={(e) => setPayments((p) => ({ ...p, monedaBase: e.target.value }))}



            >



              {currencyOptions.map((c) => (



                <option key={c} value={c}>



                  {c}



                </option>



              ))}



            </CustomSelect>



          </label>







          <label className="text-sm">



            <div className="text-xs text-slate-400 mb-1">{t("mgmt.restaurant.payments.exchangeCurrency") }</div>



            <CustomSelect



              className="h-10 w-full rounded-lg px-3 text-sm"



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



            </CustomSelect>



          </label>







                    <label className="text-sm">
            <div className="text-xs text-slate-400 mb-1">{t("mgmt.restaurant.payments.rateBuy") }</div>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder={t("mgmt.restaurant.payments.exchangePlaceholder")}
              value={payments.tipoCambioCompra ?? ""}
              disabled={Boolean(payments.useBCCR)}
              onChange={(e) => setPayments((p) => ({ ...p, tipoCambioCompra: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <div className="text-xs text-slate-400 mb-1">{t("mgmt.restaurant.payments.rateSell") }</div>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder={t("mgmt.restaurant.payments.exchangePlaceholder")}
              value={payments.tipoCambioVenta ?? ""}
              disabled={Boolean(payments.useBCCR)}
              onChange={(e) => setPayments((p) => ({ ...p, tipoCambioVenta: e.target.value }))}
            />
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







      <Card className={"p-5 space-y-4 " + (paymentsTab === "methods" ? "" : "hidden")}>



        <div>



          <div className="text-xs uppercase text-slate-400">{t("mgmt.restaurant.payments.methodsTitle")}</div>



          <div className="font-semibold">{t("mgmt.restaurant.payments.methodsSubtitle") }</div>



          <div className="text-sm text-slate-400">



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



              variant="indigo"



              onClick={() => startEditPaymentMethod((payments.paymentMethods || []).find((m) => m.id === selectedPaymentMethodId))}



              disabled={!selectedPaymentMethodId}



            >



              Editar



            </Button>



            <Button type="button" variant="destructive" onClick={deleteSelectedPaymentMethod} disabled={!selectedPaymentMethodId}>{t("mgmt.restaurant.common.delete")}</Button>



          </div>



        </div>







        <div className="grid md:grid-cols-[1fr_320px] gap-4">



          <div className="overflow-auto rounded-xl border">



            <table className="min-w-full text-sm">



              <thead className="bg-white/5 text-xs uppercase text-slate-500 border-b">



                <tr>



                  <th className="px-3 py-2 text-left w-10">{t("mgmt.restaurant.payments.select")}</th>



                  <th className="px-3 py-2 text-left w-16">{t("mgmt.restaurant.common.active")}</th>


                  <th className="px-3 py-2 text-left">{t("mgmt.restaurant.payments.method")}</th>







                  



                </tr>



              </thead>



              <tbody>



                {(payments.paymentMethods || []).map((m) => {



                  const selected = m.id === selectedPaymentMethodId;



                  return (



                    <tr key={m.id} className={`border-b ${selected ? "bg-white/5" : "bg-transparent"}`}>



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















                      



                    </tr>



                  );



                })}



                {(payments.paymentMethods || []).length === 0 && (



                  <tr>



                    <td className="px-3 py-4 text-slate-500" colSpan={3}>{t("mgmt.restaurant.payments.empty")}</td>



                  </tr>



                )}



              </tbody>



            </table>



          </div>







          <Card className="p-4 space-y-3 border border-white/10">



            <div className="font-semibold">{t("mgmt.restaurant.payments.addEdit")}</div>



            <Input



              placeholder="Nombre del método (Ej: SINPE, Efectivo)"



              value={paymentMethodForm.name}



              onChange={(e) => setPaymentMethodForm((f) => ({ ...f, name: e.target.value }))}



            />



            {payments.accountingEnabled && (



            <p className="text-xs text-slate-500">La cuenta contable de cada método se asigna en Management → Contabilidad → Formas de cobro del restaurante.</p>



















            )}



            <div className="flex justify-end gap-2">



              <Button type="button" variant="outline" onClick={() => setPaymentMethodForm({ id: "", name: "", account: "" })}>



                Limpiar



              </Button>



              <Button type="button" onClick={savePaymentMethodForm}>{t("mgmt.restaurant.payments.saveMethod")}</Button>



            </div>



            <div className="text-[11px] text-slate-400">{t("mgmt.restaurant.payments.note")}</div>



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



          <p className="text-sm text-slate-400">{t("mgmt.restaurant.recipes.subtitle")}</p>



        </div>







        <div className="grid md:grid-cols-3 gap-3 items-end">



          <div className="md:col-span-2">



            <div className="text-xs text-slate-600 mb-1">{t("mgmt.restaurant.recipes.sellable") }</div>



            <CustomSelect



              className="h-10 rounded-lg px-3 text-sm w-full"



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



            </CustomSelect>



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



          <Card className="p-3 space-y-2 bg-white/5">



            <div className="font-semibold text-sm">{t("mgmt.restaurant.recipes.addIngredient")}</div>



            <div className="grid md:grid-cols-4 gap-2 items-end">



              <div className="md:col-span-2">



                <div className="text-xs text-slate-600 mb-1">{t("mgmt.restaurant.recipes.inventoryItem") }</div>



                <CustomSelect



                  className="h-10 rounded-lg px-3 text-sm w-full"



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



                </CustomSelect>



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



            <thead className="bg-white/5 text-slate-400">



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



                      <button className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700" onClick={() => removeRecipeLine(l.id)}>



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



  const renderInventory = () => (
    <div className="mx-auto w-full max-w-5xl">
      <RestaurantInventory />
    </div>
  );



  const renderSectionsTabbed = () => (



    <div className="space-y-4">



      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          {topTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className="relative flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                subTab === tab.id
                  ? { background: "#4f46e5", color: "#ffffff", boxShadow: "0 1px 6px rgba(79,70,229,0.35)" }
                  : { background: "transparent", color: "var(--color-text-muted)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>







      {subTab === "sections" && (
        <div className="mx-auto w-full max-w-5xl">
          {renderSections({ showTables: false, showMenus: false })}
        </div>
      )}



      {subTab === "tables" && (



        <div className="space-y-4 mx-auto w-full max-w-5xl">



          {renderSections({ showSections: false, showMenus: false })}



        </div>



      )}



      {subTab === "menus" && renderSections({ showSections: false, showTables: false })}



    </div>



  );



  const renderGeneralConfig = () => (



    <div className="space-y-4 mx-auto w-full max-w-3xl">



      <Card className="p-4 space-y-2">



        <div className="flex items-end justify-between gap-3 flex-wrap">



          <div className="flex items-baseline gap-2">



            <div className="font-semibold text-lg text-slate-900">{t("mgmt.restaurant.generalConfig.title")}</div>



            <div className="font-semibold text-lg text-slate-900">{t("mgmt.restaurant.generalConfig.restaurantLabel")}</div>



          </div>



          



        </div>



        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          {[
            { id: "general", label: "Información general" },
            { id: "billing", label: "Facturación" },
            { id: "payments", label: "Pagos y divisas" },
            { id: "taxes", label: t("mgmt.restaurant.tabs.taxes") },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGeneralConfigTab(tab.id)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={generalConfigTab === tab.id ? { background: "#4f46e5", color: "#ffffff", boxShadow: "0 1px 6px rgba(79,70,229,0.35)" } : { background: "transparent", color: "var(--color-text-muted)" }}
            >
              {tab.label}
            </button>



          ))}



        </div>



      </Card>







      {generalConfigTab === "general" && renderGeneral({ showSave: true })}



      {generalConfigTab === "billing" && renderBilling({ showSave: true })}



      {generalConfigTab === "payments" && renderPayments({ showSave: true })}



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



      <div className="flex flex-col gap-1 p-1.5 rounded-xl h-max lg:sticky lg:self-start lg:top-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="text-[11px] text-center uppercase tracking-wider px-2 py-1 font-semibold" style={{ color: "var(--color-text-muted)" }}>{t("mgmt.restaurant.generalConfig.subtitle")}</div>



        {navTabs.map((tab) => (



          <button



            key={tab.id}



            onClick={() => setActive(tab.id)}



            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={active === tab.id ? { background: "#4f46e5", color: "#ffffff", boxShadow: "0 1px 6px rgba(79,70,229,0.35)" } : { background: "transparent", color: "var(--color-text-muted)" }}
          >



            {tab.label}



          </button>



        ))}
      </div>

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

