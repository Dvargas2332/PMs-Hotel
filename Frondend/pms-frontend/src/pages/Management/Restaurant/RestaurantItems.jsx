import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { Checkbox } from "../../../components/ui/checkbox";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantItems() {
  const empty = {
    name: "",
    familyId: "",
    subFamilyId: "",
    subSubFamilyId: "",
    price: "",
    taxIds: [],
    notes: "",
    active: true,
  };
  const [form, setForm] = useState(empty);
  const [drafts, setDrafts] = useState([]);
  const [items, setItems] = useState([]);
  const [taxCatalog, setTaxCatalog] = useState([]);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [subSubFamilies, setSubSubFamilies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");

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
        setItems(Array.isArray(it?.data) ? it.data : []);
        setTaxCatalog(Array.isArray(tx?.data) ? tx.data : []);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const addDraft = () => {
    if (!form.name || !form.familyId || !form.price) return;
    const draft = { ...form, id: `draft-${Date.now()}` };
    setDrafts((prev) => [...prev, draft]);
    setForm(empty);
  };

  const removeDraft = (id) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  const saveDrafts = async () => {
    if (!drafts.length) return;
    try {
      setSaving(true);
      const payload = drafts.map((d) => ({
        ...d,
        price: Number(d.price || 0),
        taxIds: Array.isArray(d.taxIds) ? d.taxIds : [],
      }));
      const { data } = await api.post("/restaurant/items", { items: payload });
      const savedList = Array.isArray(data) ? data : [data];
      setItems((prev) => [...prev, ...savedList]);
      setDrafts([]);
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Items saved" } }));
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
      taxIds: Array.isArray(it.taxIds) ? it.taxIds : [],
      notes: String(it.notes || ""),
      active: it.active !== false,
    });
  };

  const cancelEdit = () => {
    setEditingId("");
    setForm(empty);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = {
      name: form.name,
      familyId: form.familyId,
      subFamilyId: form.subFamilyId ? form.subFamilyId : null,
      subSubFamilyId: form.subSubFamilyId ? form.subSubFamilyId : null,
      price: Number(form.price || 0),
      taxIds: Array.isArray(form.taxIds) ? form.taxIds : [],
      notes: form.notes || null,
      active: form.active !== false,
    };
    const { data } = await api.patch(`/restaurant/items/${editingId}`, payload);
    setItems((prev) => prev.map((x) => (x.id === data.id ? data : x)));
    cancelEdit();
  };

  const removeItem = (id) => {
    api.delete(`/restaurant/items/${id}`).finally(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
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

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Items</h3>
            <p className="text-sm text-gray-600">Create items with CABYS, families and taxes.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDrafts([])} disabled={!drafts.length}>
              Clear drafts
            </Button>
            <Button disabled={!drafts.length || saving} onClick={saveDrafts}>
              {saving ? "Saving..." : "Save items"}
            </Button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Code (auto)" value="" disabled />
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <select
            className="h-11 rounded-lg border px-3 text-sm bg-white"
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
            className="h-11 rounded-lg border px-3 text-sm bg-white"
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
            className="h-11 rounded-lg border px-3 text-sm bg-white"
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
          <Input placeholder="CABYS (inherited)" value={familyCabys} disabled />
          <Input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
        </div>
        <div>
          <div className="text-xs text-slate-600 mb-1">Taxes</div>
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
            {(taxCatalog || []).length === 0 && <div className="text-xs text-slate-500">No taxes created yet.</div>}
          </div>
        </div>
        <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: Boolean(v) }))} />
          Active item
        </label>
        <div className="flex justify-end">
          {editingId ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit}>Save changes</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={addDraft}>
              Add to draft
            </Button>
          )}
        </div>
      </Card>

        {drafts.length > 0 && (
          <Card className="p-4 space-y-2">
            <div className="text-sm font-semibold">Drafts ({drafts.length})</div>
          <div className="grid md:grid-cols-2 gap-2">
            {drafts.map((d) => (
              <div key={d.id} className="border rounded-md px-3 py-2 flex justify-between items-start gap-2">
                <div className="text-sm">
                  <div className="font-semibold">
                    {d.name}
                  </div>
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
                <Button size="sm" variant="outline" onClick={() => removeDraft(d.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Card>
        )}

      {items.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="text-sm font-semibold">Existing items ({items.length})</div>
          <div className="grid md:grid-cols-2 gap-2">
            {items.map((i) => (
              <div key={i.id} className="border rounded-md px-3 py-2 flex justify-between items-start gap-2">
                <div className="text-sm">
                  <div className="font-semibold">{i.code || i.id} - {i.name || ""}</div>
                  <div className="text-xs text-gray-600">
                    {i.family || familiesById.get(i.familyId)?.name || ""}
                    {i.subFamily || (i.subFamilyId ? ` / ${subFamiliesById.get(i.subFamilyId)?.name || ""}` : "")}
                    {i.subSubFamily || (i.subSubFamilyId ? ` / ${subSubFamiliesById.get(i.subSubFamilyId)?.name || ""}` : "")}
                  </div>
                  <div className="text-xs text-gray-600">CABYS: {i.cabys}</div>
                  <div className="text-xs text-gray-600">Tax: {i.tax || 0}%</div>
                  <div className="text-xs text-gray-600">Price: {Number(i.price || 0).toFixed(2)}</div>
                  {i.notes && <div className="text-xs text-gray-600 mt-1">Notes: {i.notes}</div>}
                  <div className="text-xs mt-1">{i.active ? "Active" : "Inactive"}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(i)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeItem(i.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
