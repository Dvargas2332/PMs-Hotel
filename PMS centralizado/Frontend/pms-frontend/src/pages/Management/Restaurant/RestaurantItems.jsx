import React, { useEffect, useMemo, useState } from "react";
import { CustomSelect } from "../../../components/ui/CustomSelect";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { parseMoneyInput } from "../../../lib/money";
import { useLanguage } from "../../../context/LanguageContext";

export default function RestaurantItems({ onItemsChange } = {}) {
  const { t } = useLanguage();
  const empty = {
    name: "",
    barcode: "",
    familyId: "",
    subFamilyId: "",
    subSubFamilyId: "",
    price: "",
    imageUrl: "",
    priceIncludesTaxesAndService: true,
    taxIds: [],
    notes: "",
    sizes: [],
    details: [],
    active: true,
  };
  const makeItemFilter = () => ({
    search: "",
    familyId: "",
    status: "",
    code: "",
  });

  const [form, setForm] = useState(empty);
  const [items, setItems] = useState([]);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [subSubFamilies, setSubSubFamilies] = useState([]);
  const [taxCatalog, setTaxCatalog] = useState([]);
  const [savingItem, setSavingItem] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [sizeDraft, setSizeDraft] = useState({ label: "", price: "", isDefault: false });
  const [detailDraft, setDetailDraft] = useState({ label: "", priceDelta: "" });
  const [sizesEnabled, setSizesEnabled] = useState(false);
  const [detailsEnabled, setDetailsEnabled] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [itemFilter, setItemFilter] = useState(() => makeItemFilter());
  const [itemFilterDraft, setItemFilterDraft] = useState(() => makeItemFilter());
  const [itemsPanelTab, setItemsPanelTab] = useState("form");

  const pushAlert = (desc) => {
    window.dispatchEvent(
      new CustomEvent("pms:push-alert", {
        detail: { title: t("mgmt.restaurant.common.alertTitle"), desc },
      })
    );
  };

  const getApiError = (err, fallbackKey) => err?.response?.data?.message || err?.message || t(fallbackKey);

  useEffect(() => {
    if (typeof onItemsChange === "function") onItemsChange(items);
    window.dispatchEvent(
      new CustomEvent("pms:restaurant-items-updated", {
        detail: { items: Array.isArray(items) ? items : [] },
      })
    );
  }, [items, onItemsChange]);

  useEffect(() => {
    const load = async () => {
      try {
        const results = await Promise.allSettled([
          api.get("/restaurant/families"),
          api.get("/restaurant/subfamilies"),
          api.get("/restaurant/subsubfamilies"),
          api.get("/restaurant/items"),
          api.get("/restaurant/taxes"),
        ]);
        const [f, sf, ssf, it, tx] = results.map((r) => (r.status === "fulfilled" ? r.value : null));
        setFamilies(Array.isArray(f?.data) ? f.data : []);
        setSubFamilies(Array.isArray(sf?.data) ? sf.data : []);
        setSubSubFamilies(Array.isArray(ssf?.data) ? ssf.data : []);
        setItems(Array.isArray(it?.data) ? it.data : []);
        setTaxCatalog(Array.isArray(tx?.data) ? tx.data : []);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

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

  const handleImageFile = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const resized = await resizeImageDataUrl(dataUrl, 512, 0.86);
      setForm((f) => ({ ...f, imageUrl: resized || dataUrl }));
    } catch {
      pushAlert(t("mgmt.restaurantItems.error.imageLoad"));
    }
  };

  const familiesById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const subFamiliesById = useMemo(() => new Map((subFamilies || []).map((sf) => [sf.id, sf])), [subFamilies]);
  const subSubFamiliesById = useMemo(() => new Map((subSubFamilies || []).map((ssf) => [ssf.id, ssf])), [subSubFamilies]);

  const filteredSubFamilies = useMemo(() => {
    if (!form.familyId) return subFamilies || [];
    return (subFamilies || []).filter((sf) => String(sf.familyId) === String(form.familyId));
  }, [subFamilies, form.familyId]);

  const filteredSubSubFamilies = useMemo(() => {
    if (!form.subFamilyId) return subSubFamilies || [];
    return (subSubFamilies || []).filter((ssf) => String(ssf.subFamilyId) === String(form.subFamilyId));
  }, [subSubFamilies, form.subFamilyId]);

  const familyCabys = useMemo(() => {
    const cabys = familiesById.get(form.familyId)?.cabys;
    return cabys ? String(cabys) : "";
  }, [familiesById, form.familyId]);

  const hasActiveItemFilter = useMemo(
    () =>
      Object.values(itemFilter || {}).some((value) => String(value || "").trim() !== ""),
    [itemFilter]
  );

  const itemCodeOptions = useMemo(() => {
    const seen = new Set();
    return (items || [])
      .map((i) => String(i.code || i.id || "").trim())
      .filter(Boolean)
      .filter((code) => {
        const key = code.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = String(itemFilter?.search || "").trim().toLowerCase();
    const filterFamilyId = String(itemFilter?.familyId || "").trim();
    const filterStatus = String(itemFilter?.status || "").trim();
    const filterCode = String(itemFilter?.code || "").trim().toLowerCase();

    const hasAnyFilter = term || filterFamilyId || filterStatus || filterCode;
    if (!hasAnyFilter) return items || [];

    return (items || []).filter((i) => {
      if (filterFamilyId && String(i.familyId || "") !== filterFamilyId) return false;
      if (filterStatus === "active" && i.active !== true) return false;
      if (filterStatus === "inactive" && i.active !== false) return false;
      if (filterCode) {
        const code = String(i.code || i.id || "").trim().toLowerCase();
        if (code !== filterCode) return false;
      }
      if (!term) return true;

      const familyName = i.family || familiesById.get(i.familyId)?.name || "";
      const subFamilyName = i.subFamily || subFamiliesById.get(i.subFamilyId)?.name || "";
      const subSubFamilyName = i.subSubFamily || subSubFamiliesById.get(i.subSubFamilyId)?.name || "";
      const haystack = [i.code, i.barcode, i.name, i.cabys, familyName, subFamilyName, subSubFamilyName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [itemFilter, items, familiesById, subFamiliesById, subSubFamiliesById]);

  const activeTaxCatalog = useMemo(
    () => (taxCatalog || []).filter((tax) => tax.active !== false),
    [taxCatalog]
  );

  const normalizeSizes = (sizes) =>
    Array.isArray(sizes)
      ? sizes.map((s, idx) => {
          const sizePrice = parseMoneyInput(s?.price);
          return {
            id: String(s?.id || s?.label || s?.name || idx),
            label: String(s?.label || s?.name || "").trim(),
            price: Number.isFinite(sizePrice) ? sizePrice : 0,
            isDefault: s?.isDefault === true,
          };
        })
      : [];

  const normalizeDetails = (details) =>
    Array.isArray(details)
      ? details.map((d, idx) => {
          const delta = parseMoneyInput(d?.priceDelta ?? d?.price ?? 0);
          return {
            id: String(d?.id || d?.label || d?.name || idx),
            label: String(d?.label || d?.name || "").trim(),
            priceDelta: Number.isFinite(delta) ? delta : 0,
          };
        })
      : [];

  const saveItem = async () => {
    if (editingId) return;
    if (!form.name || !form.familyId || !form.price) return;
    const selectedFamily = (families || []).find((f) => String(f.id) === String(form.familyId));
    if (!selectedFamily?.cabys) {
      pushAlert(t("mgmt.restaurantItems.error.familyCabysMissing"));
      return;
    }
    const priceValue = parseMoneyInput(form.price);
    const payload = {
      name: String(form.name || "").trim(),
      barcode: String(form.barcode || "").trim() || null,
      familyId: String(form.familyId || ""),
      subFamilyId: form.subFamilyId ? String(form.subFamilyId) : null,
      subSubFamilyId: form.subSubFamilyId ? String(form.subSubFamilyId) : null,
      price: Number.isFinite(priceValue) ? priceValue : 0,
      notes: String(form.notes || "").trim() || null,
      imageUrl: String(form.imageUrl || "").trim() || null,
      taxIds: Array.isArray(form.taxIds) ? form.taxIds : [],
      active: form.active !== false,
      priceIncludesTaxesAndService: form.priceIncludesTaxesAndService !== false,
      sizes: normalizeSizes(form.sizes),
      details: normalizeDetails(form.details),
    };
    try {
      setSavingItem(true);
      const { data } = await api.post("/restaurant/items", { items: [payload] });
      const savedList = Array.isArray(data) ? data : [data];
      const saved = savedList[0];
      setItems((prev) => [...prev, ...(saved ? [saved] : [])]);
      setForm(empty);
      setSizesEnabled(false);
      setDetailsEnabled(false);
      pushAlert(t("mgmt.restaurantItems.saved"));
    } catch (err) {
      pushAlert(getApiError(err, "mgmt.restaurantItems.error.saveItem"));
    } finally {
      setSavingItem(false);
    }
  };

  const startEdit = (it) => {
    if (!it?.id) return;
    setItemsPanelTab("form");
    setEditingId(it.id);
    setForm({
      name: String(it.name || ""),
      barcode: String(it.barcode || ""),
      familyId: String(it.familyId || ""),
      subFamilyId: String(it.subFamilyId || ""),
      subSubFamilyId: String(it.subSubFamilyId || ""),
      price: String(it.price ?? ""),
      imageUrl: String(it.imageUrl || ""),
      taxIds: Array.isArray(it.taxIds) ? it.taxIds : [],
      notes: String(it.notes || ""),
      sizes: Array.isArray(it.sizes) ? it.sizes : [],
      details: Array.isArray(it.details) ? it.details : [],
      active: it.active !== false,
      priceIncludesTaxesAndService: it.priceIncludesTaxesAndService !== false,
    });
    setSizesEnabled(Array.isArray(it.sizes) && it.sizes.length > 0);
    setDetailsEnabled(Array.isArray(it.details) && it.details.length > 0);
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(empty);
    setSizesEnabled(false);
    setDetailsEnabled(false);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const priceValue = parseMoneyInput(form.price);
    const payload = {
      name: String(form.name || "").trim(),
      barcode: String(form.barcode || "").trim() || null,
      familyId: String(form.familyId || ""),
      subFamilyId: form.subFamilyId ? String(form.subFamilyId) : null,
      subSubFamilyId: form.subSubFamilyId ? String(form.subSubFamilyId) : null,
      price: Number.isFinite(priceValue) ? priceValue : 0,
      taxIds: Array.isArray(form.taxIds) ? form.taxIds : [],
      notes: String(form.notes || "").trim() || null,
      imageUrl: String(form.imageUrl || "").trim() || null,
      active: form.active !== false,
      priceIncludesTaxesAndService: form.priceIncludesTaxesAndService !== false,
      sizes: normalizeSizes(form.sizes),
      details: normalizeDetails(form.details),
    };
    try {
      const { data } = await api.patch(`/restaurant/items/${editingId}`, payload);
      setItems((prev) => prev.map((x) => (x.id === data.id ? data : x)));
      cancelEdit();
    } catch (err) {
      pushAlert(getApiError(err, "mgmt.restaurantItems.error.saveEdit"));
    }
  };

  const removeItem = (id) => {
    api.delete(`/restaurant/items/${id}`).finally(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  };

  const addSize = () => {
    if (!sizeDraft.label || !sizeDraft.price) return;
    const newSize = {
      id: String(Date.now()),
      label: String(sizeDraft.label).trim(),
      price: Number(sizeDraft.price || 0),
      isDefault: sizeDraft.isDefault === true,
    };
    setForm((f) => {
      const prev = Array.isArray(f.sizes) ? f.sizes : [];
      let next = [...prev, newSize];
      if (newSize.isDefault) {
        next = next.map((s, idx) => ({ ...s, isDefault: idx === next.length - 1 }));
      }
      return { ...f, sizes: next };
    });
    setSizeDraft({ label: "", price: "", isDefault: false });
  };

  const removeSize = (idx) => {
    setForm((f) => ({ ...f, sizes: (Array.isArray(f.sizes) ? f.sizes : []).filter((_, i) => i !== idx) }));
  };

  const setDefaultSize = (idx) => {
    setForm((f) => ({
      ...f,
      sizes: (Array.isArray(f.sizes) ? f.sizes : []).map((s, i) => ({ ...s, isDefault: i === idx })),
    }));
  };

  const addDetail = () => {
    if (!detailDraft.label) return;
    const newDetail = {
      id: String(Date.now()),
      label: String(detailDraft.label).trim(),
      priceDelta: Number(detailDraft.priceDelta ?? 0),
    };
    setForm((f) => ({
      ...f,
      details: [...(Array.isArray(f.details) ? f.details : []), newDetail],
    }));
    setDetailDraft({ label: "", priceDelta: "" });
  };

  const removeDetail = (idx) => {
    setForm((f) => ({ ...f, details: (Array.isArray(f.details) ? f.details : []).filter((_, i) => i !== idx) }));
  };

  const toggleSizes = (enabled) => {
    const next = Boolean(enabled);
    setSizesEnabled(next);
    if (!next) {
      setForm((f) => ({ ...f, sizes: [] }));
      setSizeDraft({ label: "", price: "", isDefault: false });
    }
  };

  const toggleDetails = (enabled) => {
    const next = Boolean(enabled);
    setDetailsEnabled(next);
    if (!next) {
      setForm((f) => ({ ...f, details: [] }));
      setDetailDraft({ label: "", priceDelta: "" });
    }
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3 border border-indigo-500/30 shadow-sm bg-white/5">
        <div className="rounded-xl border border-indigo-700/40 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 p-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setItemsPanelTab("form")}
            className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
              itemsPanelTab === "form"
                ? "bg-indigo-600 border-indigo-400/60 text-white shadow-sm"
                : "bg-white/20 border-indigo-300/40 text-indigo-100 hover:bg-white/30 hover:text-white"
            }`}
          >
            {t("mgmt.restaurantItems.title")}
          </button>
          <button
            type="button"
            onClick={() => setItemsPanelTab("created")}
            className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
              itemsPanelTab === "created"
                ? "bg-indigo-600 border-indigo-400/60 text-white shadow-sm"
                : "bg-white/20 border-indigo-300/40 text-indigo-100 hover:bg-white/30 hover:text-white"
            }`}
          >
            {t("mgmt.restaurantItems.createdItems", { filtered: filteredItems.length, total: items.length })}
          </button>
        </div>

        {itemsPanelTab === "form" ? (
          <>
        <div className="rounded-xl border border-indigo-500/20 bg-white/5 p-3 grid md:grid-cols-5 gap-2">
          <Input className="w-full md:max-w-[190px] border-indigo-500/30 bg-white/5 text-white" placeholder={t("mgmt.restaurantItems.codeAuto")} value="" disabled />
          <Input
            className="w-full md:col-span-2 border-indigo-500/30 bg-white/5 text-white"
            placeholder={t("mgmt.restaurantItems.name")}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input className="w-full md:col-span-2 border-indigo-500/30 bg-white/5 text-white" placeholder={t("mgmt.restaurantItems.cabysInherited")} value={familyCabys} disabled />
          <CustomSelect
            className="h-10 w-full"
            value={form.familyId}
            onChange={(e) => {
              const familyId = e.target.value;
              setForm((f) => ({ ...f, familyId, subFamilyId: "", subSubFamilyId: "" }));
            }}
          >
            <option value="">{t("mgmt.restaurantItems.family")}</option>
            {(families || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            className="h-10 w-full"
            value={form.subFamilyId}
            onChange={(e) => {
              const subFamilyId = e.target.value;
              setForm((f) => ({ ...f, subFamilyId, subSubFamilyId: "" }));
            }}
            disabled={!form.familyId}
          >
            <option value="">{t("mgmt.restaurantItems.subFamily")}</option>
            {filteredSubFamilies.map((sf) => (
              <option key={sf.id} value={sf.id}>
                {sf.name}
              </option>
            ))}
          </CustomSelect>
          <CustomSelect
            className="h-10 w-full"
            value={form.subSubFamilyId}
            onChange={(e) => setForm((f) => ({ ...f, subSubFamilyId: e.target.value }))}
            disabled={!form.subFamilyId}
          >
            <option value="">{t("mgmt.restaurantItems.subSubFamily")}</option>
            {filteredSubSubFamilies.map((ssf) => (
              <option key={ssf.id} value={ssf.id}>
                {ssf.name}
              </option>
            ))}
          </CustomSelect>
          <Input
            className="border-indigo-500/30 bg-white/5 text-white"
            placeholder={t("mgmt.restaurantItems.barcodeOptional")}
            value={form.barcode}
            onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
          />
          <Input
            className="w-full md:max-w-[160px] border-indigo-500/30 bg-white/5 text-white"
            placeholder={t("mgmt.restaurantItems.price")}
            type="number"
            money
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>

        <div className="rounded-xl border border-indigo-500/20 bg-white/5 p-3 grid md:grid-cols-[minmax(260px,420px)_auto] gap-2 items-center">
          <Input
            className="w-full md:w-[420px] border-indigo-500/30 bg-white/5 text-white"
            placeholder={t("mgmt.restaurantItems.imageUrlOptional")}
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 bg-white/5 cursor-pointer hover:bg-indigo-800/500/10">
              {t("mgmt.restaurantItems.uploadImage")}
              <input type="file" accept="image/*,.svg" className="hidden" onChange={(e) => handleImageFile(e.target.files && e.target.files[0])} />
            </label>
            {form.imageUrl ? (
              <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}>
                {t("mgmt.restaurantItems.removeImage")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-indigo-500/20 bg-white/5 px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: Boolean(v) }))} />
            {t("mgmt.restaurantItems.activeItem")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.priceIncludesTaxesAndService !== false}
              onCheckedChange={(v) => setForm((f) => ({ ...f, priceIncludesTaxesAndService: Boolean(v) }))}
            />
            {t("mgmt.restaurantItems.priceIncludesTaxes")}
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Card className="p-3 space-y-2 border border-indigo-500/30 bg-white/5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm text-indigo-200">{t("mgmt.restaurantItems.sizesTitle")}</div>
              <label className="flex items-center gap-2 text-xs text-indigo-300">
                <Checkbox checked={sizesEnabled} onCheckedChange={toggleSizes} />
                {t("mgmt.restaurantItems.enable")}
              </label>
            </div>
            {sizesEnabled ? (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
                  <Input
                    className="border-indigo-500/30 bg-white/5 text-white"
                    placeholder={t("mgmt.restaurantItems.size")}
                    value={sizeDraft.label}
                    onChange={(e) => setSizeDraft((s) => ({ ...s, label: e.target.value }))}
                  />
                  <Input
                    className="border-indigo-500/30 bg-white/5 text-white"
                    placeholder={t("mgmt.restaurantItems.sizePrice")}
                    type="number"
                    money
                    value={sizeDraft.price}
                    onChange={(e) => setSizeDraft((s) => ({ ...s, price: e.target.value }))}
                  />
                  <label className="flex items-center gap-2 text-xs text-indigo-300">
                    <Checkbox
                      checked={sizeDraft.isDefault}
                      onCheckedChange={(v) => setSizeDraft((s) => ({ ...s, isDefault: Boolean(v) }))}
                    />
                    {t("mgmt.restaurantItems.default")}
                  </label>
                  <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" size="sm" variant="outline" onClick={addSize}>
                    {t("mgmt.restaurantItems.add")}
                  </Button>
                </div>
                <div className="space-y-1">
                  {(form.sizes || []).map((s, idx) => (
                    <div key={`${s.id || s.label}-${idx}`} className="flex items-center justify-between border border-indigo-500/20 rounded px-2 py-1 text-xs">
                      <span>
                        {s.label} - {Number(s.price || 0).toFixed(2)}
                        {s.isDefault ? ` (${t("mgmt.restaurantItems.default")})` : ""}
                      </span>
                      <div className="flex gap-2">
                        <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" size="sm" variant="outline" onClick={() => setDefaultSize(idx)}>
                          {t("mgmt.restaurantItems.default")}
                        </Button>
                        <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" size="sm" variant="outline" onClick={() => removeSize(idx)}>
                          {t("mgmt.restaurantItems.remove")}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(form.sizes || []).length === 0 && <div className="text-xs text-slate-500">{t("mgmt.restaurantItems.noSizes")}</div>}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">{t("mgmt.restaurantItems.enableSizesHint")}</div>
            )}
          </Card>

          <Card className="p-3 space-y-2 border border-indigo-500/30 bg-white/5 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm text-indigo-200">{t("mgmt.restaurantItems.detailsTitle")}</div>
              <label className="flex items-center gap-2 text-xs text-indigo-300">
                <Checkbox checked={detailsEnabled} onCheckedChange={toggleDetails} />
                {t("mgmt.restaurantItems.enable")}
              </label>
            </div>
            {detailsEnabled ? (
              <>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    className="border-indigo-500/30 bg-white/5 text-white"
                    placeholder={t("mgmt.restaurantItems.detail")}
                    value={detailDraft.label}
                    onChange={(e) => setDetailDraft((d) => ({ ...d, label: e.target.value }))}
                  />
                  <Input
                    className="border-indigo-500/30 bg-white/5 text-white"
                    placeholder={t("mgmt.restaurantItems.detailPricePlus")}
                    type="number"
                    money
                    value={detailDraft.priceDelta}
                    onChange={(e) => setDetailDraft((d) => ({ ...d, priceDelta: e.target.value }))}
                  />
                  <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" size="sm" variant="outline" onClick={addDetail}>
                    {t("mgmt.restaurantItems.add")}
                  </Button>
                </div>
                <div className="space-y-1">
                  {(form.details || []).map((d, idx) => (
                    <div key={`${d.id || d.label}-${idx}`} className="flex items-center justify-between border border-indigo-500/20 rounded px-2 py-1 text-xs">
                      <span>
                        {d.label}
                        {Number(d.priceDelta || 0) ? ` - +${Number(d.priceDelta || 0).toFixed(2)}` : ""}
                      </span>
                      <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" size="sm" variant="outline" onClick={() => removeDetail(idx)}>
                        {t("mgmt.restaurantItems.remove")}
                      </Button>
                    </div>
                  ))}
                  {(form.details || []).length === 0 && <div className="text-xs text-slate-500">{t("mgmt.restaurantItems.noDetails")}</div>}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500">{t("mgmt.restaurantItems.enableDetailsHint")}</div>
            )}
          </Card>
        </div>

        {activeTaxCatalog.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-xl border border-indigo-500/20 bg-white/5 p-2">
            {activeTaxCatalog.map((tax) => {
              const checked = Array.isArray(form.taxIds) && form.taxIds.includes(tax.id);
              return (
                <label
                  key={tax.id}
                  className={`px-2 py-1 rounded-lg border text-xs cursor-pointer ${
                    checked ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-200" : "bg-white/5 border-white/10 text-slate-300 hover:bg-indigo-800/500/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={checked}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setForm((p) => {
                        const prev = Array.isArray(p.taxIds) ? p.taxIds : [];
                        const next = on ? Array.from(new Set([...prev, tax.id])) : prev.filter((x) => x !== tax.id);
                        return { ...p, taxIds: next };
                      });
                    }}
                  />
                  {tax.code} - {tax.name} ({Number(tax.percent || 0).toFixed(2)}%)
                </label>
              );
            })}
          </div>
        ) : null}

        <div className="grid md:grid-cols-[minmax(0,520px)_1fr] gap-3 items-end">
          <Textarea
            placeholder={t("mgmt.restaurantItems.notes")}
            className="min-h-[80px] w-full border-indigo-500/30 bg-white/5 text-white"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          {editingId ? (
            <div className="flex justify-end gap-2">
              <Button className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" variant="outline" onClick={cancelEdit}>
                {t("common.cancel")}
              </Button>
              <Button onClick={saveEdit}>{t("common.save")}</Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button
                variant="outline"
                className="!bg-white/5 border-indigo-500/40 text-indigo-800 hover:!bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={savingItem || !form.name || !form.familyId || !form.price}
                onClick={saveItem}
              >
                Save
              </Button>
            </div>
          )}
        </div>
          </>
        ) : null}

        {itemsPanelTab === "created" ? (
          <div className="space-y-3">
        <div className="rounded-lg bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-indigo-50 px-3 py-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-indigo-50">{t("mgmt.restaurantItems.createdItems", { filtered: filteredItems.length, total: items.length })}</div>
          <div className="flex items-center gap-2">
            <Button
              className="!bg-indigo-700/30 border-indigo-300/40 !text-indigo-50 hover:!bg-indigo-700/45"
              variant="outline"
              size="sm"
              onClick={() => setFilterOpen((v) => !v)}
            >
              {filterOpen ? t("mgmt.restaurantItems.hideFilter") : t("mgmt.restaurantItems.filter")}
            </Button>
            {hasActiveItemFilter ? <span className="text-xs border border-indigo-300 text-white bg-indigo-700/50 rounded px-2 py-1">{t("mgmt.restaurantItems.activeFilter")}</span> : null}
          </div>
        </div>

        {filterOpen ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-indigo-500/20 bg-white/5 p-2">
            <div className="w-[170px]">
              <div className="mb-1 text-[11px] font-medium text-indigo-300">{t("common.search")}</div>
              <Input
                className="h-10 border-indigo-500/30 bg-white/5 text-white"
                placeholder={t("mgmt.restaurantItems.searchItem")}
                value={itemFilterDraft.search}
                onChange={(e) => setItemFilterDraft((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setItemFilter({ ...itemFilterDraft });
                }}
              />
            </div>

            <div className="w-[180px]">
              <div className="mb-1 text-[11px] font-medium text-indigo-300">{t("mgmt.restaurantItems.columns.family")}</div>
              <CustomSelect
                className="h-10 w-full"
                value={itemFilterDraft.familyId}
                onChange={(e) => setItemFilterDraft((prev) => ({ ...prev, familyId: e.target.value }))}
              >
                <option value="">{t("common.all")}</option>
                {(families || []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </CustomSelect>
            </div>

            <div className="w-[140px]">
              <div className="mb-1 text-[11px] font-medium text-indigo-300">{t("mgmt.restaurantItems.columns.status")}</div>
              <CustomSelect
                className="h-10 w-full"
                value={itemFilterDraft.status}
                onChange={(e) => setItemFilterDraft((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">{t("common.all")}</option>
                <option value="active">{t("mgmt.restaurantItems.active")}</option>
                <option value="inactive">{t("mgmt.restaurantItems.inactive")}</option>
              </CustomSelect>
            </div>

            <div className="w-[150px]">
              <div className="mb-1 text-[11px] font-medium text-indigo-300">{t("mgmt.restaurantItems.columns.code")}</div>
              <CustomSelect
                className="h-10 w-full"
                value={itemFilterDraft.code}
                onChange={(e) => setItemFilterDraft((prev) => ({ ...prev, code: e.target.value }))}
              >
                <option value="">{t("common.all")}</option>
                {itemCodeOptions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </CustomSelect>
            </div>

            <Button className="h-10 border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50" variant="outline" onClick={() => setItemFilter({ ...itemFilterDraft })}>
              {t("mgmt.restaurantItems.applyFilter")}
            </Button>
            <Button
              className="h-10 border-indigo-500/40 text-indigo-300 hover:bg-indigo-800/50"
              variant="outline"
              onClick={() => {
                const clean = makeItemFilter();
                setItemFilterDraft(clean);
                setItemFilter(clean);
              }}
            >
              {t("common.clear")}
            </Button>
          </div>
        ) : null}

        <div className="overflow-auto max-h-[52vh] rounded-lg border border-indigo-500/20">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-indigo-50 text-indigo-200 sticky top-0 z-10">
              <tr>
                <th className="text-left px-2 py-2">{t("mgmt.restaurantItems.columns.code")}</th>
                <th className="text-left px-2 py-2">{t("mgmt.restaurantItems.columns.name")}</th>
                <th className="text-left px-2 py-2">{t("mgmt.restaurantItems.columns.family")}</th>
                <th className="text-left px-2 py-2">{t("mgmt.restaurantItems.columns.cabys")}</th>
                <th className="text-right px-2 py-2">{t("mgmt.restaurantItems.columns.price")}</th>
                <th className="text-center px-2 py-2">{t("mgmt.restaurantItems.columns.status")}</th>
                <th className="text-right px-2 py-2">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((i) => {
                const familyName = i.family || familiesById.get(i.familyId)?.name || "";
                const subFamilyName = i.subFamily || subFamiliesById.get(i.subFamilyId)?.name || "";
                const subSubFamilyName = i.subSubFamily || subSubFamiliesById.get(i.subSubFamilyId)?.name || "";
                const familyLabel = [familyName, subFamilyName, subSubFamilyName].filter(Boolean).join(" / ");
                const cabys = String(i.cabys || familiesById.get(i.familyId)?.cabys || "");
                return (
                  <tr key={i.id} className="border-t border-indigo-500/20 hover:bg-indigo-800/50/40 transition-colors">
                    <td className="px-2 py-2">
                      <div>{i.code || i.id}</div>
                      {i.barcode ? <div className="text-[10px] text-slate-500">{t("mgmt.restaurantItems.barcode")}: {i.barcode}</div> : null}
                    </td>
                    <td className="px-2 py-2">{i.name || ""}</td>
                    <td className="px-2 py-2">{familyLabel || "-"}</td>
                    <td className="px-2 py-2">{cabys || "-"}</td>
                    <td className="px-2 py-2 text-right">{Number(i.price || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          i.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {i.active ? t("mgmt.restaurantItems.active") : t("mgmt.restaurantItems.inactive")}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right space-x-1">
                      <Button variant="indigo" size="sm" onClick={() => startEdit(i)}>
                        {t("common.edit")}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => removeItem(i.id)}>
                        {t("mgmt.restaurant.common.delete")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                    {t("mgmt.restaurantItems.noMatches")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
