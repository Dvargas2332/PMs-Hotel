import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";

export default function RestaurantFamilies() {
  const [loading, setLoading] = useState(false);
  const [families, setFamilies] = useState([]);
  const [subFamilies, setSubFamilies] = useState([]);
  const [subSubFamilies, setSubSubFamilies] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [selectedSubFamilyId, setSelectedSubFamilyId] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [subFamilyName, setSubFamilyName] = useState("");
  const [subSubFamilyName, setSubSubFamilyName] = useState("");
  const [familyCabys, setFamilyCabys] = useState("");
  const [familyCabysSearch, setFamilyCabysSearch] = useState("");
  const [familyCabysLoading, setFamilyCabysLoading] = useState(false);
  const [familyCabysResults, setFamilyCabysResults] = useState([]);
  const [cabysModalOpen, setCabysModalOpen] = useState(false);
  const [cabysModalQuery, setCabysModalQuery] = useState("");

  const pushAlert = (title, desc) => {
    window.dispatchEvent(new CustomEvent("pms:push-alert", { detail: { title, desc } }));
  };
  const getApiError = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

  const loadFamilies = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/restaurant/families");
      if (Array.isArray(data)) {
        setFamilies(data);
        setSelectedFamilyId((cur) => cur || data[0]?.id || "");
      } else {
        setFamilies([]);
      }
    } catch {
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamilies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = String(familyCabysSearch || "").trim();
    if (q.length < 3) {
      setFamilyCabysResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setFamilyCabysLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("q", q);
        qs.set("take", "25");
        const { data } = await api.get(`/einvoicing/cabys?${qs.toString()}`);
        if (!cancelled) setFamilyCabysResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFamilyCabysResults([]);
      } finally {
        if (!cancelled) setFamilyCabysLoading(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [familyCabysSearch]);

  useEffect(() => {
    const fam = (families || []).find((f) => f.id === selectedFamilyId) || null;
    setFamilyCabys(String(fam?.cabys || ""));
  }, [families, selectedFamilyId]);

  useEffect(() => {
    const loadSub = async () => {
      if (!selectedFamilyId) {
        setSubFamilies([]);
        setSelectedSubFamilyId("");
        return;
      }
      try {
        const { data } = await api.get(`/restaurant/subfamilies?familyId=${encodeURIComponent(selectedFamilyId)}`);
        if (Array.isArray(data)) {
          setSubFamilies(data);
          setSelectedSubFamilyId((cur) => (cur && data.some((sf) => sf.id === cur) ? cur : data[0]?.id || ""));
        } else {
          setSubFamilies([]);
        }
      } catch {
        setSubFamilies([]);
      }
    };
    loadSub();
  }, [selectedFamilyId]);

  useEffect(() => {
    const loadSubSub = async () => {
      if (!selectedSubFamilyId) {
        setSubSubFamilies([]);
        return;
      }
      try {
        const { data } = await api.get(`/restaurant/subsubfamilies?subFamilyId=${encodeURIComponent(selectedSubFamilyId)}`);
        setSubSubFamilies(Array.isArray(data) ? data : []);
      } catch {
        setSubSubFamilies([]);
      }
    };
    loadSubSub();
  }, [selectedSubFamilyId]);

  const addFamily = async () => {
    const name = String(familyName || "").trim();
    if (!name) return;
    try {
      const cabys = String(familyCabys || "").trim();
      const { data } = await api.post("/restaurant/families", { name, cabys: cabys || undefined });
      setFamilies((prev) => [...(prev || []), data].filter(Boolean));
      setFamilyName("");
      if (data?.id) setSelectedFamilyId(data.id);
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not create family."));
    }
  };

  const addSubFamily = async () => {
    const name = String(subFamilyName || "").trim();
    if (!selectedFamilyId || !name) return;
    try {
      const { data } = await api.post("/restaurant/subfamilies", { familyId: selectedFamilyId, name });
      setSubFamilies((prev) => [...(prev || []), data].filter(Boolean));
      setSubFamilyName("");
      if (data?.id) setSelectedSubFamilyId(data.id);
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not create sub-family."));
    }
  };

  const addSubSubFamily = async () => {
    const name = String(subSubFamilyName || "").trim();
    if (!selectedSubFamilyId || !name) return;
    try {
      const { data } = await api.post("/restaurant/subsubfamilies", { subFamilyId: selectedSubFamilyId, name });
      setSubSubFamilies((prev) => [...(prev || []), data].filter(Boolean));
      setSubSubFamilyName("");
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not create sub-sub-family."));
    }
  };

  const saveFamilyCabys = async (value) => {
    if (!selectedFamilyId) return;
    const cabys = String(value ?? familyCabys ?? "").trim();
    try {
      const { data } = await api.patch(`/restaurant/families/${selectedFamilyId}`, { cabys: cabys || null });
      setFamilies((prev) => prev.map((f) => (f.id === selectedFamilyId ? data : f)));
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not save family CABYS."));
    }
  };

  const runCabysSearch = () => {
    setCabysModalQuery(String(familyCabys || "").trim());
    setFamilyCabysSearch(String(familyCabys || "").trim());
    setCabysModalOpen(true);
  };

  const removeFamily = async (id) => {
    try {
      await api.delete(`/restaurant/families/${id}`);
      setFamilies((prev) => (prev || []).filter((f) => f.id !== id));
      if (selectedFamilyId === id) {
        setSelectedFamilyId("");
        setSelectedSubFamilyId("");
        setSubFamilies([]);
        setSubSubFamilies([]);
      }
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not delete family (it may have items)."));
    }
  };

  const removeSubFamily = async (id) => {
    try {
      await api.delete(`/restaurant/subfamilies/${id}`);
      setSubFamilies((prev) => (prev || []).filter((sf) => sf.id !== id));
      if (selectedSubFamilyId === id) {
        setSelectedSubFamilyId("");
        setSubSubFamilies([]);
      }
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not delete sub-family (it may have items)."));
    }
  };

  const removeSubSubFamily = async (id) => {
    try {
      await api.delete(`/restaurant/subsubfamilies/${id}`);
      setSubSubFamilies((prev) => (prev || []).filter((ssf) => ssf.id !== id));
    } catch (err) {
      pushAlert("Restaurant", getApiError(err, "Could not delete sub-sub-family (it may have items)."));
    }
  };

  return (
    <div className="min-h-screen flex flex-col gap-3">
      <Card className="p-4 space-y-3 border border-indigo-700/30 shadow-sm">
        <div className="rounded-lg bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-indigo-50 px-3 py-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base">Families</h3>
            <p className="text-[11px] text-indigo-200">Crear y administrar familias.</p>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-600/30 bg-indigo/30 p-3 space-y-3 shadow-sm">
          <div className="grid lg:grid-cols-3 gap-3">
            <Card className="p-3 space-y-2 border border-indigo-600/30 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">Families</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-800 bg-indigo-600 text-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={addFamily}
                  disabled={loading}
                >
                  Add
                </Button>
              </div>
              <Input
                placeholder="New family name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="h-8 text-[14px] px-2 placeholder:text-[14px]"
              />
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Family CABYS (set here only)"
                    value={familyCabys}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFamilyCabys(v);
                    }}
                    className="h-8 text-[14px] px-2 placeholder:text-[14px]"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={runCabysSearch}
                  disabled={!selectedFamilyId}
                >
                  Search CABYS
                </Button>
              </div>
              <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
                {(families || []).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-indigo-50/60 ${
                      selectedFamilyId === f.id ? "border-indigo-300 bg-indigo-50" : "border-indigo-100"
                    }`}
                    onClick={() => setSelectedFamilyId(f.id)}
                  >
                    <span className="text-sm font-semibold truncate">
                      {f.name}
                      {f.cabys ? <span className="ml-2 text-[11px] font-semibold text-slate-500">{f.cabys}</span> : null}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-xs text-red-600 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFamily(f.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFamily(f.id);
                        }
                      }}
                    >
                      Delete
                    </span>
                  </button>
                ))}
                {(families || []).length === 0 && <div className="text-sm text-gray-500">No families yet.</div>}
              </div>
            </Card>

            <Card className="p-3 space-y-2 border border-indigo-600/30 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">Sub-families</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-800 bg-indigo-600 text-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={addSubFamily}
                  disabled={!selectedFamilyId}
                >
                  Add
                </Button>
              </div>
              <select
                className="h-8 rounded-lg border px-2 text-[14px] bg-white"
                value={selectedFamilyId}
                onChange={(e) => setSelectedFamilyId(e.target.value)}
                title="Family"
              >
                <option value="">Select family...</option>
                {(families || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <Input placeholder="Family CABYS (inherited)" value={familyCabys} disabled className="h-8 text-[14px] px-2 placeholder:text-[14px]" />
              <Input
                placeholder="New sub-family name"
                value={subFamilyName}
                onChange={(e) => setSubFamilyName(e.target.value)}
                disabled={!selectedFamilyId}
                className="h-8 text-[14px] px-2 placeholder:text-[14px]"
              />
              <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
                {(subFamilies || []).map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-indigo-50/60 ${
                      selectedSubFamilyId === sf.id ? "border-indigo-300 bg-indigo-50" : "border-indigo-100"
                    }`}
                    onClick={() => setSelectedSubFamilyId(sf.id)}
                  >
                    <span className="text-sm font-semibold truncate">{sf.name}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-xs text-red-600 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeSubFamily(sf.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSubFamily(sf.id);
                        }
                      }}
                    >
                      Delete
                    </span>
                  </button>
                ))}
                {!selectedFamilyId && <div className="text-sm text-gray-500">Select a family first.</div>}
                {selectedFamilyId && (subFamilies || []).length === 0 && (
                  <div className="text-sm text-gray-500">No sub-families yet.</div>
                )}
              </div>
            </Card>

            <Card className="p-3 space-y-2 border border-indigo-600/30 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">Sub-sub-families</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-800 bg-indigo-600 text-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 disabled:opacity-80 disabled:cursor-not-allowed"
                  onClick={addSubSubFamily}
                  disabled={!selectedSubFamilyId}
                >
                  Add
                </Button>
              </div>
              <select
                className="h-8 rounded-lg border px-2 text-[14px] bg-white"
                value={selectedSubFamilyId}
                onChange={(e) => setSelectedSubFamilyId(e.target.value)}
                title="Sub-family"
                disabled={!selectedFamilyId}
              >
                <option value="">Select sub-family...</option>
                {(subFamilies || []).map((sf) => (
                  <option key={sf.id} value={sf.id}>
                    {sf.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="New sub-sub-family name"
                value={subSubFamilyName}
                onChange={(e) => setSubSubFamilyName(e.target.value)}
                disabled={!selectedSubFamilyId}
                className="h-8 text-[14px] px-2 placeholder:text-[14px]"
              />
              <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
                {(subSubFamilies || []).map((ssf) => (
                  <div
                    key={ssf.id}
                    className="w-full rounded-lg border border-indigo-100 px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-indigo-50/60"
                  >
                    <span className="text-sm font-semibold truncate">{ssf.name}</span>
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeSubSubFamily(ssf.id)}>
                      Delete
                    </button>
                  </div>
                ))}
                {!selectedSubFamilyId && <div className="text-sm text-gray-500">Select a sub-family first.</div>}
                {selectedSubFamilyId && (subSubFamilies || []).length === 0 && (
                  <div className="text-sm text-gray-500">No sub-sub-families yet.</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Card>

      {cabysModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl border">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <div className="text-sm font-semibold">Search CABYS catalog</div>
                <div className="text-xs text-slate-500">Search by activity name or CABYS code.</div>
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center"
                onClick={() => setCabysModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type CABYS code or activity name..."
                  value={cabysModalQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCabysModalQuery(v);
                    setFamilyCabysSearch(v);
                  }}
                  className="h-9"
                />
                <Button
                  variant="outline"
                  onClick={() => setFamilyCabysSearch(String(cabysModalQuery || "").trim())}
                >
                  Search
                </Button>
              </div>
              <div className="border rounded-lg max-h-[420px] overflow-y-auto">
                {familyCabysLoading && <div className="px-3 py-2 text-sm text-slate-600">Searching...</div>}
                {!familyCabysLoading && (familyCabysResults || []).length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-600">No results.</div>
                )}
                {(familyCabysResults || []).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b last:border-b-0"
                    onClick={() => {
                      const code = String(r.id);
                      setFamilyCabys(code);
                      setFamilyCabysSearch("");
                      setFamilyCabysResults([]);
                      saveFamilyCabys(code);
                      setCabysModalOpen(false);
                    }}
                  >
                    <div className="text-sm font-semibold text-slate-900">{r.id}</div>
                    <div className="text-xs text-slate-600 line-clamp-2">{r.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
