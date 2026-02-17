import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { parseMoneyInput } from "../../../lib/money";

export default function RestaurantItems({ onItemsChange } = {}) {
  const empty = {
    name: "",
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
  const [form, setForm] = useState(empty);
  const [drafts, setDrafts] = useState([]);
  const [items, setItems] = useState([]);
  const [itemFilter, setItemFilter] = useState("");
  const [itemFilterDraft, setItemFilterDraft] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [taxCatalog, setTaxCatalog] = useState([]);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [subSubFamilies, setSubSubFamilies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [sizeDraft, setSizeDraft] = useState({ label: "", price: "", isDefault: false });
  const [detailDraft, setDetailDraft] = useState({ label: "", priceDelta: "" });
  const [sizesEnabled, setSizesEnabled] = useState(false);
  const [detailsEnabled, setDetailsEnabled] = useState(false);

  const pushAlert = (title, desc) => {
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title, desc } }));
  };
  const getApiError = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

  const notifyItems = useCallback(
    (next) => {
      if (typeof onItemsChange === "function") onItemsChange(next);
      window.dispatchEvent(
        new CustomEvent("pms:restaurant-items-updated", { detail: { items: Array.isArray(next) ? next : [] } })
      );
    },
    [onItemsChange]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [f, sf, ssf, it, tx] = await Promise.all([
          api.get("/restaurant/families"),
          api.get("/restaurant/subfamilies"),
          api.get("/restaurant/subsubfamilies"),
          api.get("/restaurant/items"),
          api.get("/taxes"),
        ]);
        setFamilies(Array.isArray(f?.data) ? f.data : []);
        setSubFamilies(Array.isArray(sf?.data) ? sf.data : []);
        setSubSubFamilies(Array.isArray(ssf?.data) ? ssf.data : []);
        const list = Array.isArray(it?.data) ? it.data : [];
        setItems(list);
        notifyItems(list);
        setTaxCatalog(Array.isArray(tx?.data) ? tx.data : []);
      } catch {
        // ignore
      }
    };
    load();
  }, [notifyItems]);

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
      pushAlert("Restaurant", "No se pudo cargar la imagen.");
    }
  };

  const addDraft = () => {
    if (!form.name || !form.familyId || !form.price) return;
    const draft = { ...form, id: `draft-${Date.now()}` };
    setDrafts((prev) => [...prev, draft]);
    setForm(empty);
    setSizesEnabled(false);
    setDetailsEnabled(false);
  };

  const removeDraft = (id) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const saveDrafts = async () => {
    if (!drafts.length) return;
    try {
      setSaving(true);
      const payload = drafts.map((d) => {
        const { id: _id, ...rest } = d;
        const priceValue = parseMoneyInput(rest.price);
        return {
          ...rest,
          familyId: String(rest.familyId || ""),
          subFamilyId: rest.subFamilyId ? String(rest.subFamilyId) : null,
          subSubFamilyId: rest.subSubFamilyId ? String(rest.subSubFamilyId) : null,
          price: Number.isFinite(priceValue) ? priceValue : 0,
          notes: String(rest.notes || "").trim() || null,
          imageUrl: String(rest.imageUrl || "").trim() || null,
          taxIds: Array.isArray(rest.taxIds) ? rest.taxIds : [],
          active: rest.active !== false,
          priceIncludesTaxesAndService: rest.priceIncludesTaxesAndService !== false,
          sizes: Array.isArray(rest.sizes)
            ? rest.sizes.map((s, idx) => {
                const sizePrice = parseMoneyInput(s?.price);
                return {
                  id: String(s?.id || s?.label || s?.name || idx),
                  label: String(s?.label || s?.name || "").trim(),
                  price: Number.isFinite(sizePrice) ? sizePrice : 0,
                  isDefault: s?.isDefault === true,
                };
              })
            : [],
          details: Array.isArray(rest.details)
            ? rest.details.map((s, idx) => {
                const delta = parseMoneyInput(s?.priceDelta ?? s?.price ?? 0);
                return {
                  id: String(s?.id || s?.label || s?.name || idx),
                  label: String(s?.label || s?.name || "").trim(),
                  priceDelta: Number.isFinite(delta) ? delta : 0,
                };
              })
            : [],
        };
      });
      const { data } = await api.post("/restaurant/items", { items: payload });
      const savedList = Array.isArray(data) ? data : [data];
      setItems((prev) => {
        const next = [...prev, ...savedList];
        notifyItems(next);
        return next;
      });
      setDrafts([]);
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Items saved" } }));
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "No se pudo guardar los artículos."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (it) => {
    if (!it?.id) return;
    setEditingId(it.id);
    setForm({
      name: String(it.name || ""),
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
      name: form.name,
      familyId: form.familyId,
      subFamilyId: form.subFamilyId ? form.subFamilyId : null,
      subSubFamilyId: form.subSubFamilyId ? form.subSubFamilyId : null,
      price: Number.isFinite(priceValue) ? priceValue : 0,
      taxIds: Array.isArray(form.taxIds) ? form.taxIds : [],
      notes: String(form.notes || "").trim() || null,
      imageUrl: String(form.imageUrl || "").trim() || null,
      active: form.active !== false,
      priceIncludesTaxesAndService: form.priceIncludesTaxesAndService !== false,
      sizes: Array.isArray(form.sizes)
        ? form.sizes.map((s, idx) => {
            const sizePrice = parseMoneyInput(s?.price);
            return {
              id: String(s?.id || s?.label || s?.name || idx),
              label: String(s?.label || s?.name || "").trim(),
              price: Number.isFinite(sizePrice) ? sizePrice : 0,
              isDefault: s?.isDefault === true,
            };
          })
        : [],
      details: Array.isArray(form.details)
        ? form.details.map((s, idx) => {
            const delta = parseMoneyInput(s?.priceDelta ?? s?.price ?? 0);
            return {
              id: String(s?.id || s?.label || s?.name || idx),
              label: String(s?.label || s?.name || "").trim(),
              priceDelta: Number.isFinite(delta) ? delta : 0,
            };
          })
        : [],
    };
    try {
      const { data } = await api.patch(`/restaurant/items/${editingId}`, payload);
      setItems((prev) => {
        const next = prev.map((x) => (x.id === data.id ? data : x));
        notifyItems(next);
        return next;
      });
      cancelEdit();
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "No se pudo guardar el artículo."));
    }
  };

  const removeItem = (id) => {
    api.delete(`/restaurant/items/${id}`).finally(() => {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id);
        notifyItems(next);
        return next;
      });
    });
  };

  const familiesById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const subFamiliesById = useMemo(() => new Map((subFamilies || []).map((f) => [f.id, f])), [subFamilies]);
  const subSubFamiliesById = useMemo(() => new Map((subSubFamilies || []).map((f) => [f.id, f])), [subSubFamilies]);
  const familyCabys = useMemo(() => (familiesById.get(form.familyId)?.cabys ? String(familiesById.get(form.familyId)?.cabys) : ""), [familiesById, form.familyId]);

  const filteredSubFamilies = useMemo(() => {
    if (!form.familyId) return subFamilies || [];
    return (subFamilies || []).filter((sf) => sf.familyId === form.familyId);
  }, [subFamilies, form.familyId]);

  const filteredSubSubFamilies = useMemo(() => {
    if (!form.subFamilyId) return subSubFamilies || [];
    return (subSubFamilies || []).filter((ssf) => ssf.subFamilyId === form.subFamilyId);
  }, [subSubFamilies, form.subFamilyId]);

  const filteredItems = useMemo(() => {
    const term = String(itemFilter || "").trim().toLowerCase();
    if (!term) return items || [];
    return (items || []).filter((i) => {
      const familyName = i.family || familiesById.get(i.familyId)?.name || "";
      const subFamilyName = i.subFamily || (i.subFamilyId ? subFamiliesById.get(i.subFamilyId)?.name || "" : "");
      const subSubFamilyName = i.subSubFamily || (i.subSubFamilyId ? subSubFamiliesById.get(i.subSubFamilyId)?.name || "" : "");
      const haystack = [
        i.code,
        i.name,
        i.cabys,
        familyName,
        subFamilyName,
        subSubFamilyName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [itemFilter, items, familiesById, subFamiliesById, subSubFamiliesById]);

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
    <div className="min-h-screen flex flex-col gap-3">
      <Card className="p-4 space-y-3 max-h-[48vh] overflow-y-auto border border-indigo-900/20 shadow-sm">
        <div className="rounded-lg bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-indigo-50 px-3 py-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base">Items</h3>
            <p className="text-[11px] text-indigo-200">Crear y editar artículos.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-100 disabled:cursor-not-allowed"
              onClick={() => setDrafts([])}
              disabled={!drafts.length}
            >
              Clear drafts
            </Button>
            <Button
              size="sm"
              className="bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 disabled:opacity-100 disabled:cursor-not-allowed"
              disabled={!drafts.length || saving}
              onClick={saveDrafts}
            >
              {saving ? "Saving..." : "Save items"}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 space-y-3 shadow-sm">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
          <Input
            placeholder="Code (auto)"
            value=""
            disabled
            className="h-8 text-[14px] px-2 placeholder:text-[14px] w-full min-w-0"
          />
          <Input
            placeholder="Name"
            className="h-8 text-[14px] px-2 placeholder:text-[14px] w-full min-w-0"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="h-8 rounded-lg border px-2 text-[14px] bg-white w-full min-w-0"
            value={form.familyId}
            onChange={(e) => {
              const familyId = e.target.value;
              setForm((f) => ({ ...f, familyId, subFamilyId: "", subSubFamilyId: "" }));
            }}
          >
            <option value="">Family</option>
            {(families || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-lg border px-2 text-[14px] bg-white w-full min-w-0"
            value={form.subFamilyId}
            onChange={(e) => {
              const subFamilyId = e.target.value;
              setForm((f) => ({ ...f, subFamilyId, subSubFamilyId: "" }));
            }}
            disabled={!form.familyId}
          >
            <option value="">Subfamily</option>
            {filteredSubFamilies.map((sf) => (
              <option key={sf.id} value={sf.id}>
                {sf.name}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-lg border px-2 text-[14px] bg-white w-full min-w-0"
            value={form.subSubFamilyId}
            onChange={(e) => setForm((f) => ({ ...f, subSubFamilyId: e.target.value }))}
            disabled={!form.subFamilyId}
          >
            <option value="">Sub-subfamily</option>
            {filteredSubSubFamilies.map((ssf) => (
              <option key={ssf.id} value={ssf.id}>
                {ssf.name}
              </option>
              ))}
          </select>
          <Input
            placeholder="CABYS (inherited)"
            value={familyCabys}
            disabled
            className="h-8 text-[14px] px-2 placeholder:text-[14px] w-full min-w-0"
          />
          <Input
            placeholder="Price"
            type="number"
            money
            className="h-8 text-[14px] px-2 placeholder:text-[14px] w-full min-w-0"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
          </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <Input
            placeholder="Image URL (optional)"
            className="h-8 text-[14px] px-2 placeholder:text-[14px] w-full min-w-0"
            value={form.imageUrl || ""}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs px-3 py-1 rounded-md border bg-white cursor-pointer hover:bg-slate-50">
              Cargar imagen
              <input
                type="file"
                accept="image/*,.svg"
                className="hidden"
                onChange={(e) => handleImageFile(e.target.files && e.target.files[0])}
              />
            </label>
            {form.imageUrl ? (
              <>
                <img
                  src={form.imageUrl}
                  alt=""
                  className="h-8 w-8 rounded-md object-cover border"
                  onError={(ev) => {
                    ev.currentTarget.style.display = "none";
                  }}
                />
                <Button
                  size="xs"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                >
                  Quitar
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-700">Caracteristicas adicionales</div>
          <div className="grid md:grid-cols-2 gap-2">
            <div className={`rounded-xl border p-3 ${sizesEnabled ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Precios por tamano</div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <Checkbox checked={sizesEnabled} onCheckedChange={toggleSizes} />
                  Activar
                </label>
              </div>
              {sizesEnabled ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Tamano"
                      className="h-8 text-[11px] px-2 placeholder:text-[11px]"
                      value={sizeDraft.label}
                      onChange={(e) => setSizeDraft((s) => ({ ...s, label: e.target.value }))}
                    />
                    <Input
                      placeholder="Precio"
                      type="number"
                      money
                      className="h-8 text-[11px] px-2 placeholder:text-[11px]"
                      value={sizeDraft.price}
                      onChange={(e) => setSizeDraft((s) => ({ ...s, price: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <Checkbox
                        checked={sizeDraft.isDefault}
                        onCheckedChange={(v) => setSizeDraft((s) => ({ ...s, isDefault: Boolean(v) }))}
                      />
                      Default
                    </label>
                    <Button size="xs" variant="outline" onClick={addSize}>
                      Agregar
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(form.sizes || []).map((s, idx) => (
                      <div key={`${s.id || s.label}-${idx}`} className="flex items-center justify-between rounded-lg border px-2 py-1 text-xs">
                        <div>
                          {s.label} - {Number(s.price || 0).toFixed(2)}
                          {s.isDefault ? " (Default)" : ""}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="xs" variant="outline" onClick={() => setDefaultSize(idx)}>
                            Default
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => removeSize(idx)}>
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(form.sizes || []).length === 0 && (
                      <div className="text-xs text-slate-400">Sin tamanos configurados.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-xs text-slate-400">Activa para agregar precios por tamano.</div>
              )}
            </div>
            <div className={`rounded-xl border p-3 ${detailsEnabled ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Opciones de comanda</div>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <Checkbox checked={detailsEnabled} onCheckedChange={toggleDetails} />
                  Activar
                </label>
              </div>
              {detailsEnabled ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Input
                      placeholder="Detalle"
                      className="h-8 text-[11px] px-2 placeholder:text-[11px]"
                      value={detailDraft.label}
                      onChange={(e) => setDetailDraft((d) => ({ ...d, label: e.target.value }))}
                    />
                    <Input
                      placeholder="Precio +"
                      type="number"
                      money
                      className="h-8 text-[11px] px-2 placeholder:text-[11px]"
                      value={detailDraft.priceDelta}
                      onChange={(e) => setDetailDraft((d) => ({ ...d, priceDelta: e.target.value }))}
                    />
                    <Button size="xs" variant="outline" onClick={addDetail}>
                      Agregar
                    </Button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {(form.details || []).map((d, idx) => (
                      <div key={`${d.id || d.label}-${idx}`} className="flex items-center justify-between rounded-lg border px-2 py-1 text-xs">
                        <div>
                          {d.label}
                          {Number(d.priceDelta || 0) ? ` - +${Number(d.priceDelta || 0).toFixed(2)}` : ""}
                        </div>
                        <Button size="xs" variant="outline" onClick={() => removeDetail(idx)}>
                          Quitar
                        </Button>
                      </div>
                    ))}
                    {(form.details || []).length === 0 && (
                      <div className="text-xs text-slate-400">Sin opciones configuradas.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-xs text-slate-400">Activa para agregar extras de comanda.</div>
              )}
            </div>
          </div>
        </div>
        <div>
            <div className="flex flex-wrap gap-2">
            {(taxCatalog || []).filter((t) => t.active !== false).map((t) => {
              const checked = Array.isArray(form.taxIds) && form.taxIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`px-2 py-1 rounded-lg border text-xs cursor-pointer select-none ${
                    checked ? "bg-slate-100 border-slate-300" : "bg-white border-slate-200"
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
                        const next = on ? Array.from(new Set([...prev, t.id])) : prev.filter((x) => x !== t.id);
                        return { ...p, taxIds: next };
                      });
                    }}
                  />
                  {t.code} · {t.name} ({Number(t.percent || 0).toFixed(2)}%)
                </label>
              );
            })}
            
          </div>
        </div>
        <div className="w-full max-w-[420px]">
          <Textarea
            placeholder="Notes"
            className="min-h-[60px] max-w-[350px] text-[14px] px-2 placeholder:text-[14px]"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: Boolean(v) }))} />
          Active item
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.priceIncludesTaxesAndService !== false}
            onCheckedChange={(v) => setForm((f) => ({ ...f, priceIncludesTaxesAndService: Boolean(v) }))}
          />
          Price includes taxes and service
        </label>
        <div className="flex justify-end">
          {editingId ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={saveEdit}>
                Save changes
              </Button>
            </div>
          ) : (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={addDraft}>
              Add to draft
            </Button>
          )}
        </div>
        </div>
      </Card>

      {drafts.length > 0 && (
        <Card className="p-4 space-y-2 border border-indigo-900/10 shadow-sm">
          <div className="text-sm font-semibold">Drafts ({drafts.length})</div>
          <div className="grid md:grid-cols-2 gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="border rounded-md px-3 py-2 flex justify-between items-start gap-2">
                <div className="text-sm">
                  <div className="font-semibold">{d.name}</div>
                  <div className="text-xs text-gray-600">
                    {familiesById.get(d.familyId)?.name || ""}
                    {d.subFamilyId ? ` / ${subFamiliesById.get(d.subFamilyId)?.name || ""}` : ""}
                    {d.subSubFamilyId ? ` / ${subSubFamiliesById.get(d.subSubFamilyId)?.name || ""}` : ""}
                  </div>
                  <div className="text-xs text-gray-600">CABYS: {familiesById.get(d.familyId)?.cabys || "-"}</div>
                  <div className="text-xs text-gray-600">Taxes: {(d.taxIds || []).length}</div>
                  <div className="text-xs text-gray-600">Price: {Number(d.price || 0).toFixed(2)}</div>
                  {d.notes && <div className="text-xs text-gray-600 mt-1">Notes: {d.notes}</div>}
                  <div className="text-xs mt-1">{d.active ? "Active" : "Inactive"}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => removeDraft(d.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 flex flex-col flex-1 min-h-0 border border-indigo-900/20 shadow-sm">
        <div className="rounded-lg bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-indigo-50 px-3 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">
            Artículos creados ({filteredItems.length}/{items.length})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-indigo-300/60 text-indigo-900 bg-indigo-900/10 hover:bg-indigo-700/60"
              onClick={() => setFilterOpen((v) => !v)}
            >
              {filterOpen ? "Ocultar filtro" : "Filtro"}
            </Button>
            {itemFilter ? (
              <span className="text-[11px] text-slate-900 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded-lg">
                Filtro activo
              </span>
            ) : null}
          </div>
        </div>
        {filterOpen && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-2">
            <Input
              placeholder="Buscar artículo..."
              className="h-8 text-[11px] px-2 placeholder:text-[11px]"
              value={itemFilterDraft}
              onChange={(e) => setItemFilterDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setItemFilter(itemFilterDraft);
                }
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              onClick={() => setItemFilter(itemFilterDraft)}
            >
              Filtrar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => {
                setItemFilterDraft("");
                setItemFilter("");
              }}
            >
              Limpiar
            </Button>
          </div>
        )}
        <div className="mt-3 overflow-auto flex-1 min-h-0">
          <div className="rounded-xl border border-indigo-900/20 shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-indigo-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[11px]">Código</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[11px]">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[11px]">Familia</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[11px]">CABYS</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-[11px]">Precio</th>
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-[11px]">Estado</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-[11px]">Acciones</th>
                </tr>
              </thead>
              <tbody>
              {filteredItems.map((i) => {
                const familyName = i.family || familiesById.get(i.familyId)?.name || "";
                const subFamilyName = i.subFamily || (i.subFamilyId ? subFamiliesById.get(i.subFamilyId)?.name || "" : "");
                const subSubFamilyName = i.subSubFamily || (i.subSubFamilyId ? subSubFamiliesById.get(i.subSubFamilyId)?.name || "" : "");
                const familyLabel = [familyName, subFamilyName, subSubFamilyName].filter(Boolean).join(" / ");
                const cabys = String(i.cabys || familiesById.get(i.familyId)?.cabys || "");
                return (
                  <tr key={i.id} className="border-b border-indigo-100/60 last:border-b-0 hover:bg-indigo-50/60 even:bg-indigo-50/30">
                    <td className="px-3 py-2 font-mono text-slate-700">{i.code || i.id}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-800">{i.name || ""}</div>
                      {i.notes ? <div className="text-[11px] text-slate-500 line-clamp-1">{i.notes}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{familyLabel || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{cabys || "-"}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{Number(i.price || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
                          i.active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {i.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          onClick={() => startEdit(i)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => removeItem(i.id)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-sm text-gray-500" colSpan={7}>
                      No hay artículos que coincidan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
