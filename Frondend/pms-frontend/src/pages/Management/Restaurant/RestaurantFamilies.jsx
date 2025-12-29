import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantFamilies() {
  const [loading, setLoading] = useState(false);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [subSubFamilies, setSubSubFamilies] = useState([]);

  const [familyForm, setFamilyForm] = useState({ name: "" });
  const [subFamilyForm, setSubFamilyForm] = useState({ familyId: "", name: "" });
  const [subSubFamilyForm, setSubSubFamilyForm] = useState({ subFamilyId: "", name: "" });

  const refresh = async () => {
    setLoading(true);
    try {
      const [f, sf, ssf] = await Promise.all([
        api.get("/restaurant/families"),
        api.get("/restaurant/subfamilies"),
        api.get("/restaurant/subsubfamilies"),
      ]);
      setFamilies(Array.isArray(f?.data) ? f.data : []);
      setSubFamilies(Array.isArray(sf?.data) ? sf.data : []);
      setSubSubFamilies(Array.isArray(ssf?.data) ? ssf.data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const familiesById = useMemo(() => new Map((families || []).map((f) => [f.id, f])), [families]);
  const subFamiliesById = useMemo(() => new Map((subFamilies || []).map((f) => [f.id, f])), [subFamilies]);

  const addFamily = async () => {
    const name = String(familyForm.name || "").trim();
    if (!name) return;
    try {
      const { data } = await api.post("/restaurant/families", { name });
      setFamilies((prev) => [...(prev || []), data].filter(Boolean));
      setFamilyForm({ name: "" });
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not create family" } }));
    }
  };

  const addSubFamily = async () => {
    const name = String(subFamilyForm.name || "").trim();
    if (!subFamilyForm.familyId || !name) return;
    try {
      const { data } = await api.post("/restaurant/subfamilies", { familyId: subFamilyForm.familyId, name });
      setSubFamilies((prev) => [...(prev || []), data].filter(Boolean));
      setSubFamilyForm((f) => ({ ...f, name: "" }));
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not create subfamily" } }));
    }
  };

  const addSubSubFamily = async () => {
    const name = String(subSubFamilyForm.name || "").trim();
    if (!subSubFamilyForm.subFamilyId || !name) return;
    try {
      const { data } = await api.post("/restaurant/subsubfamilies", { subFamilyId: subSubFamilyForm.subFamilyId, name });
      setSubSubFamilies((prev) => [...(prev || []), data].filter(Boolean));
      setSubSubFamilyForm((f) => ({ ...f, name: "" }));
    } catch {
      window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not create sub-subfamily" } }));
    }
  };

  const removeFamily = async (id) => {
    try {
      await api.delete(`/restaurant/families/${id}`);
      setFamilies((prev) => (prev || []).filter((f) => f.id !== id));
      setSubFamilies((prev) => (prev || []).filter((sf) => sf.familyId !== id));
      setSubSubFamilies((prev) => {
        const remainingSub = new Set((subFamilies || []).filter((sf) => sf.familyId !== id).map((sf) => sf.id));
        return (prev || []).filter((ssf) => remainingSub.has(ssf.subFamilyId));
      });
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not delete family (it may have items)" } })
      );
    }
  };

  const removeSubFamily = async (id) => {
    try {
      await api.delete(`/restaurant/subfamilies/${id}`);
      setSubFamilies((prev) => (prev || []).filter((sf) => sf.id !== id));
      setSubSubFamilies((prev) => (prev || []).filter((ssf) => ssf.subFamilyId !== id));
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not delete subfamily (it may have items)" } })
      );
    }
  };

  const removeSubSubFamily = async (id) => {
    try {
      await api.delete(`/restaurant/subsubfamilies/${id}`);
      setSubSubFamilies((prev) => (prev || []).filter((ssf) => ssf.id !== id));
    } catch {
      window.dispatchEvent(
        new CustomEvent("pms:push-alert", { detail: { title: "Restaurant", desc: "Could not delete sub-subfamily (it may have items)" } })
      );
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">Families</h3>
            <p className="text-sm text-gray-600">A family can have many subfamilies and items.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input
            placeholder="Family name"
            value={familyForm.name}
            onChange={(e) => setFamilyForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={addFamily}>
              Add family
            </Button>
          </div>
        </div>

        {(families || []).length > 0 && (
          <div className="grid md:grid-cols-3 gap-2">
            {(families || []).map((f) => (
              <div key={f.id} className="border rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{f.name}</div>
                <Button size="sm" variant="outline" onClick={() => removeFamily(f.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Subfamilies</h3>
          <p className="text-sm text-gray-600">A subfamily belongs to one family.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <select
            className="h-11 rounded-lg border px-3 text-sm bg-white"
            value={subFamilyForm.familyId}
            onChange={(e) => setSubFamilyForm((f) => ({ ...f, familyId: e.target.value }))}
          >
            <option value="">Select family</option>
            {(families || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Subfamily name"
            value={subFamilyForm.name}
            onChange={(e) => setSubFamilyForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={addSubFamily}>
              Add subfamily
            </Button>
          </div>
        </div>

        {(subFamilies || []).length > 0 && (
          <div className="grid md:grid-cols-3 gap-2">
            {(subFamilies || []).map((sf) => (
              <div key={sf.id} className="border rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-semibold">{sf.name}</div>
                  <div className="text-xs text-gray-600">{familiesById.get(sf.familyId)?.name || ""}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => removeSubFamily(sf.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-lg">Sub-subfamilies</h3>
          <p className="text-sm text-gray-600">A sub-subfamily belongs to one subfamily.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <select
            className="h-11 rounded-lg border px-3 text-sm bg-white"
            value={subSubFamilyForm.subFamilyId}
            onChange={(e) => setSubSubFamilyForm((f) => ({ ...f, subFamilyId: e.target.value }))}
          >
            <option value="">Select subfamily</option>
            {(subFamilies || []).map((sf) => (
              <option key={sf.id} value={sf.id}>
                {(familiesById.get(sf.familyId)?.name ? `${familiesById.get(sf.familyId).name} / ` : "") + sf.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Sub-subfamily name"
            value={subSubFamilyForm.name}
            onChange={(e) => setSubSubFamilyForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={addSubSubFamily}>
              Add sub-subfamily
            </Button>
          </div>
        </div>

        {(subSubFamilies || []).length > 0 && (
          <div className="grid md:grid-cols-3 gap-2">
            {(subSubFamilies || []).map((ssf) => {
              const sf = subFamiliesById.get(ssf.subFamilyId);
              const fam = sf ? familiesById.get(sf.familyId) : null;
              const path = `${fam?.name || ""}${fam ? " / " : ""}${sf?.name || ""}`;
              return (
                <div key={ssf.id} className="border rounded-lg px-3 py-2 flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-semibold">{ssf.name}</div>
                    <div className="text-xs text-gray-600">{path}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeSubSubFamily(ssf.id)}>
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}
    </div>
  );
}
