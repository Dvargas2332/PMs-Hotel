import React, { useEffect, useState } from "react";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { api } from "../../../lib/api";
import { useLanguage } from "../../../context/LanguageContext";

export default function RestaurantFamilies() {
  const { t } = useLanguage();
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

  const pushAlert = (desc) => {
    window.dispatchEvent(
      new CustomEvent("pms:push-alert", {
        detail: { title: t("mgmt.restaurant.common.alertTitle"), desc },
      })
    );
  };

  const getApiError = (err, fallbackKey) => err?.response?.data?.message || err?.message || t(fallbackKey);

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
    const timeout = setTimeout(run, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
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
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.createFamily"));
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
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.createSubFamily"));
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
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.createSubSubFamily"));
    }
  };

  const saveFamilyCabys = async (value) => {
    if (!selectedFamilyId) return;
    const cabys = String(value ?? familyCabys ?? "").trim();
    try {
      const { data } = await api.patch(`/restaurant/families/${selectedFamilyId}`, { cabys: cabys || null });
      setFamilies((prev) => prev.map((f) => (f.id === selectedFamilyId ? data : f)));
    } catch (err) {
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.saveCabys"));
    }
  };

  const runCabysSearch = () => {
    const query = String(familyCabys || "").trim();
    setCabysModalQuery(query);
    setFamilyCabysSearch(query);
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
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.deleteFamily"));
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
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.deleteSubFamily"));
    }
  };

  const removeSubSubFamily = async (id) => {
    try {
      await api.delete(`/restaurant/subsubfamilies/${id}`);
      setSubSubFamilies((prev) => (prev || []).filter((ssf) => ssf.id !== id));
    } catch (err) {
      pushAlert(getApiError(err, "mgmt.restaurantFamilies.error.deleteSubSubFamily"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col gap-3">
      <Card className="p-4 space-y-3 border border-indigo-700/30 shadow-sm">
        <div className="rounded-lg bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-indigo-50 px-3 py-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base">{t("mgmt.restaurantFamilies.title")}</h3>
            <p className="text-[11px] text-indigo-200">{t("mgmt.restaurantFamilies.subtitle")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-600/30 bg-indigo/30 p-3 space-y-3 shadow-sm">
          <div className="grid lg:grid-cols-3 gap-3">
            <Card className="p-3 space-y-2 border border-indigo-600/30 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{t("mgmt.restaurantFamilies.families")}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-800 bg-indigo-600 text-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={addFamily}
                  disabled={loading}
                >
                  {t("mgmt.restaurant.common.add")}
                </Button>
              </div>
              <Input
                placeholder={t("mgmt.restaurantFamilies.newFamily")}
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="h-8 text-[14px] px-2 placeholder:text-[14px]"
              />
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder={t("mgmt.restaurantFamilies.familyCabysSet")}
                    value={familyCabys}
                    onChange={(e) => {
                      setFamilyCabys(e.target.value);
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
                  {t("mgmt.restaurantFamilies.searchCabys")}
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
                      className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
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
                      {t("mgmt.restaurant.common.delete")}
                    </span>
                  </button>
                ))}
                {(families || []).length === 0 && <div className="text-sm text-gray-500">{t("mgmt.restaurantFamilies.emptyFamilies")}</div>}
              </div>
            </Card>

            <Card className="p-3 space-y-2 border border-indigo-600/30 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{t("mgmt.restaurantFamilies.subFamilies")}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-800 bg-indigo-600 text-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={addSubFamily}
                  disabled={!selectedFamilyId}
                >
                  {t("mgmt.restaurant.common.add")}
                </Button>
              </div>
              <select
                className="h-8 rounded-lg border px-2 text-[14px] bg-white"
                value={selectedFamilyId}
                onChange={(e) => setSelectedFamilyId(e.target.value)}
                title={t("mgmt.restaurantFamilies.family")}
              >
                <option value="">{t("mgmt.restaurantFamilies.selectFamily")}</option>
                {(families || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder={t("mgmt.restaurantFamilies.familyCabysInherited")}
                value={familyCabys}
                disabled
                className="h-8 text-[14px] px-2 placeholder:text-[14px]"
              />
              <Input
                placeholder={t("mgmt.restaurantFamilies.newSubFamily")}
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
                      className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
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
                      {t("mgmt.restaurant.common.delete")}
                    </span>
                  </button>
                ))}
                {!selectedFamilyId && <div className="text-sm text-gray-500">{t("mgmt.restaurantFamilies.selectFamilyFirst")}</div>}
                {selectedFamilyId && (subFamilies || []).length === 0 && (
                  <div className="text-sm text-gray-500">{t("mgmt.restaurantFamilies.emptySubFamilies")}</div>
                )}
              </div>
            </Card>

            <Card className="p-3 space-y-2 border border-indigo-600/30 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{t("mgmt.restaurantFamilies.subSubFamilies")}</div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-800 bg-indigo-600 text-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 disabled:opacity-80 disabled:cursor-not-allowed"
                  onClick={addSubSubFamily}
                  disabled={!selectedSubFamilyId}
                >
                  {t("mgmt.restaurant.common.add")}
                </Button>
              </div>
              <select
                className="h-8 rounded-lg border px-2 text-[14px] bg-white"
                value={selectedSubFamilyId}
                onChange={(e) => setSelectedSubFamilyId(e.target.value)}
                title={t("mgmt.restaurantFamilies.subFamily")}
                disabled={!selectedFamilyId}
              >
                <option value="">{t("mgmt.restaurantFamilies.selectSubFamily")}</option>
                {(subFamilies || []).map((sf) => (
                  <option key={sf.id} value={sf.id}>
                    {sf.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder={t("mgmt.restaurantFamilies.newSubSubFamily")}
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
                    <button type="button" className="rounded border border-red-600 bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700" onClick={() => removeSubSubFamily(ssf.id)}>
                      {t("mgmt.restaurant.common.delete")}
                    </button>
                  </div>
                ))}
                {!selectedSubFamilyId && <div className="text-sm text-gray-500">{t("mgmt.restaurantFamilies.selectSubFamilyFirst")}</div>}
                {selectedSubFamilyId && (subSubFamilies || []).length === 0 && (
                  <div className="text-sm text-gray-500">{t("mgmt.restaurantFamilies.emptySubSubFamilies")}</div>
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
                <div className="text-sm font-semibold">{t("mgmt.restaurantFamilies.cabysModal.title")}</div>
                <div className="text-xs text-slate-500">{t("mgmt.restaurantFamilies.cabysModal.subtitle")}</div>
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center"
                onClick={() => setCabysModalOpen(false)}
              >
                X
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t("mgmt.restaurantFamilies.cabysModal.searchPlaceholder")}
                  value={cabysModalQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCabysModalQuery(v);
                    setFamilyCabysSearch(v);
                  }}
                  className="h-9"
                />
                <Button variant="outline" onClick={() => setFamilyCabysSearch(String(cabysModalQuery || "").trim())}>
                  {t("common.search")}
                </Button>
              </div>
              <div className="border rounded-lg max-h-[420px] overflow-y-auto">
                {familyCabysLoading && <div className="px-3 py-2 text-sm text-slate-600">{t("mgmt.restaurantFamilies.searching")}</div>}
                {!familyCabysLoading && (familyCabysResults || []).length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-600">{t("mgmt.restaurantFamilies.noResults")}</div>
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
