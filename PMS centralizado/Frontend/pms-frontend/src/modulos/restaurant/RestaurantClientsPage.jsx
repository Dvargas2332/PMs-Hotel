import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import { useHotelData } from "../../context/useHotelData";
import { api } from "../../lib/api";
import { COUNTRIES } from "../../lib/countries";
import useNoAutocomplete from "../../hooks/useNoAutocomplete";
import { useLanguage } from "../../context/LanguageContext";
import RestaurantUserMenu from "./RestaurantUserMenu";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  idType: "",
  idNumber: "",
  isCompany: false,
  legalName: "",
  managerName: "",
  economicActivity: "",
  emailAlt1: "",
  emailAlt2: "",
  country: "",
  state: "",
  city: "",
  address: "",
  company: "",
  notes: "",
};

export default function RestaurantClientsPage() {
  const { t } = useLanguage();
  const { guests, loading, refreshGuests, createGuest, updateGuest } = useHotelData();
  useNoAutocomplete();
  const [now, setNow] = useState(new Date());
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [peopleLimit, setPeopleLimit] = useState(50);
  const [companyLimit, setCompanyLimit] = useState(50);
  const [editId, setEditId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const shift = useMemo(() => {
    const h = now.getHours();
    if (h < 15) return "Turno mañana";
    if (h < 22) return "Turno tarde";
    return "Turno noche";
  }, [now]);

  const normalizeIdNumber = (raw, type) => {
    if (!raw) return "";
    if (!type || type === "OTRO") return raw;

    if (type === "PASAPORTE") {
      // Hasta 3 letras al inicio, resto numeros
      let cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const lettersMatch = cleaned.match(/^[A-Z]{0,3}/);
      const letters = lettersMatch ? lettersMatch[0] : "";
      const rest = cleaned.slice(letters.length).replace(/\D/g, "");
      return (letters + rest).slice(0, 12);
    }

    // Tipos numericos
    const digits = String(raw).replace(/\D/g, "");
    let max = undefined;
    if (type === "CEDULA_FISICA") max = 9;
    else if (type === "CEDULA_JURIDICA") max = 10;
    else if (type === "DIMEX") max = 12; // 11 o 12, dejamos max 12

    return max ? digits.slice(0, max) : digits;
  };

  useEffect(() => {
    refreshGuests();
  }, [refreshGuests]);

  useEffect(() => {
    // cargar paises desde backend geo
    api
      .get("/geo/countries")
      .then(({ data }) => {
        if (Array.isArray(data) && data.length) setCountries(data);
        else setCountries(COUNTRIES);
      })
      .catch(() => {
        // fallback a lista estatica con todos los paises
        setCountries(COUNTRIES);
      });
  }, []);

  useEffect(() => {
    if (!form.country) {
      setRegions([]);
      setCities([]);
      return;
    }
    api
      .get("/geo/regions", { params: { country: form.country } })
      .then(({ data }) => {
        if (Array.isArray(data)) setRegions(data);
        else setRegions([]);
      })
      .catch(() => setRegions([]));
  }, [form.country]);

  useEffect(() => {
    if (!form.country) {
      setCities([]);
      return;
    }
    const params = { country: form.country };
    if (form.state) {
      // en backend regionId es id de Region
      const region = regions.find((r) => r.name === form.state || r.id === form.state);
      if (region) params.regionId = region.id;
    }
    api
      .get("/geo/cities", { params })
      .then(({ data }) => {
        if (Array.isArray(data)) setCities(data);
        else setCities([]);
      })
      .catch(() => setCities([]));
  }, [form.country, form.state, regions]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Al cambiar la búsqueda se vuelve a mostrar el primer bloque de cada lista.
  useEffect(() => {
    setPeopleLimit(50);
    setCompanyLimit(50);
  }, [search]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) => {
      const name = `${g.firstName || ""} ${g.lastName || ""}`.toLowerCase();
      return (
        name.includes(term) ||
        (g.email || "").toLowerCase().includes(term) ||
        (g.phone || "").toLowerCase().includes(term) ||
        (g.idNumber || "").toLowerCase().includes(term)
      );
    });
  }, [guests, search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError(t("frontdesk.guests.errors.incompleteDesc"));
      return;
    }
    if (form.isCompany && !form.company.trim()) {
      setFormError(t("frontdesk.guests.errors.companyMissingDesc"));
      return;
    }
    // Los campos vacíos van como ausentes: el backend valida que el correo sea
    // un correo y una cadena vacía no lo es, así que el guardado fallaba.
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        typeof value === "string" ? (value.trim() ? value.trim() : undefined) : value,
      ])
    );
    delete payload.isCompany;
    try {
      if (editId) {
        await updateGuest(editId, payload);
      } else {
        await createGuest(payload);
      }
      setForm(emptyForm);
      setEditId(null);
      setSearch("");
      setFormOpen(false);
    } catch (err) {
      setFormError(
        err?.response?.data?.message ||
          err?.response?.data?.errors?.[0]?.message ||
          err?.message ||
          t("restaurant.clients.saveFailed")
      );
    }
  };

  const onEdit = (g) => {
    setEditId(g.id);
    setFormError("");
    setFormOpen(true);
    setForm({
      firstName: g.firstName || "",
      lastName: g.lastName || "",
      email: g.email || "",
      phone: g.phone || "",
      idType: g.idType || "",
      idNumber: g.idNumber || "",
      isCompany: !!g.company,
      legalName: g.legalName || "",
      managerName: g.managerName || "",
      economicActivity: g.economicActivity || "",
      emailAlt1: g.emailAlt1 || "",
      emailAlt2: g.emailAlt2 || "",
      country: g.country || "",
      state: g.state || "",
      city: g.city || "",
      address: g.address || "",
      company: g.company || "",
      notes: g.notes || "",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-200 text-black">
      <header className="relative h-14 bg-gradient-to-r from-lime-700 to-emerald-600 flex items-center justify-between px-10 shadow">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">Restaurant</span>
          <span className="text-sm text-white/80">{t("frontdesk.guests.title")}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold">
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">
              {now.toLocaleDateString()} {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/15 text-white">{shift}</div>
          </div>
          <RestaurantUserMenu />
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("restaurant.clients.title")}</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setForm(emptyForm);
              setFormError("");
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            {t("restaurant.clients.createTitle")}
          </button>
        </div>

        {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[1px]"
          onClick={() => setFormOpen(false)}
        >
        <div
          className="my-6 w-full max-w-3xl rounded-2xl border border-lime-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{editId ? t("restaurant.clients.editTitle") : t("restaurant.clients.createTitle")}</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">{t("frontdesk.guests.typeLabel")}</span>
            <button
              type="button"
              className={`px-3 py-1 rounded-full border text-xs ${
                !form.isCompany
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
              onClick={() => setForm((f) => ({ ...f, isCompany: false }))}
            >
              {t("frontdesk.guests.typeIndividual")}
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-full border text-xs ${
                form.isCompany
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
              onClick={() => setForm((f) => ({ ...f, isCompany: true }))}
            >
              {t("frontdesk.guests.typeCorporate")}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 px-5 py-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.firstName")}</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.lastName")}</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.primaryEmail")}</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("common.phone")}</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.idType")}</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.idType}
              onChange={(e) => {
                const nextType = e.target.value;
                setForm((f) => ({
                  ...f,
                  idType: nextType,
                  idNumber: normalizeIdNumber(f.idNumber, nextType),
                }));
              }}
            >
              <option value="">{t("frontdesk.guests.selectOption")}</option>
              <option value="CEDULA_FISICA">{t("frontdesk.guests.idTypePhysical")}</option>
              <option value="CEDULA_JURIDICA">{t("frontdesk.guests.idTypeLegal")}</option>
              <option value="PASAPORTE">{t("frontdesk.guests.idTypePassport")}</option>
              <option value="DIMEX">{t("frontdesk.guests.idTypeDimex")}</option>
              <option value="OTRO">{t("frontdesk.guests.idTypeOther")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.idNumber")}</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.idNumber}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  idNumber: normalizeIdNumber(e.target.value, f.idType),
                }))
              }
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.country")}</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, state: "", city: "" }))}
            >
              <option value="">{t("frontdesk.guests.selectCountry")}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.state")}</label>
            {form.country && regions.length > 0 ? (
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value, city: "" }))}
              >
                <option value="">{t("frontdesk.guests.selectState")}</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder={t("frontdesk.guests.statePlaceholder")}
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.city")}</label>
            {form.country && cities.length > 0 ? (
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              >
                <option value="">{t("frontdesk.guests.selectCity")}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder={t("frontdesk.guests.cityPlaceholder")}
              />
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.address")}</label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {form.isCompany ? t("frontdesk.guests.companyName") : t("frontdesk.guests.companyOptional")}
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder={form.isCompany ? t("frontdesk.guests.companyPlaceholder") : ""}
            />
          </div>
          {form.isCompany && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.legalName")}</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                  value={form.legalName}
                  onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.managerName")}</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                  value={form.managerName}
                  onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.businessActivity")}</label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                  value={form.economicActivity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, economicActivity: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.altEmail1")}</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                  value={form.emailAlt1}
                  onChange={(e) => setForm((f) => ({ ...f, emailAlt1: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.altEmail2")}</label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
                  value={form.emailAlt2}
                  onChange={(e) => setForm((f) => ({ ...f, emailAlt2: e.target.value }))}
                />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t("frontdesk.guests.notes")}</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-lime-400 focus:outline-none"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          {formError && (
            <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="md:col-span-2 flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
              }}
            >
              {t("common.clear")}
            </button>
            <button
              type="submit"
              disabled={loading.action}
              className="h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-500 disabled:bg-emerald-300"
            >
              {t("common.save")}
            </button>
          </div>
        </form>
        </div>
        </div>
        )}

      <div className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("restaurant.clients.listsTitle")}</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{filtered.length}</span>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-lime-400 focus:outline-none"
              placeholder={t("frontdesk.guests.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {(() => {
          const empresas = filtered.filter((g) => !!g.company);
          const personas = filtered.filter((g) => !g.company);
          const visiblePersonas = personas.slice(0, peopleLimit);
          const visibleEmpresas = empresas.slice(0, companyLimit);
          return (
            <>
              {/* Clientes normales */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{t("restaurant.clients.individualList")}</h3>
                  <span className="rounded-full bg-lime-100 px-2 py-0.5 text-xs font-semibold text-lime-800">{personas.length}</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5">{t("common.name")}</th>
                        <th className="px-3 py-2.5">{t("frontdesk.guests.idShort")}</th>
                        <th className="px-3 py-2.5">{t("common.email")}</th>
                        <th className="px-3 py-2.5">{t("common.phone")}</th>
                        <th className="px-3 py-2.5 text-right">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visiblePersonas.map((g) => (
                        <tr key={g.id} className="hover:bg-lime-50/40">
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-900">
                              {[g.firstName, g.lastName].filter(Boolean).join(" ") || g.id}
                            </div>
                            {g.company && (
                              <div className="text-xs text-slate-500">{g.company}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {g.idType || g.idNumber
                              ? `${g.idType || ""} ${g.idNumber || ""}`.trim()
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {g.email || <span className="text-slate-400">{t("frontdesk.guests.noEmail")}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {g.phone || <span className="text-slate-400">{t("frontdesk.guests.noPhone")}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-lime-300 hover:bg-lime-50"
                              onClick={() => onEdit(g)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("common.edit")}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {personas.length === 0 && (
                        <tr>
                          <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                            {t("restaurant.clients.noIndividuals")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
                {personas.length > visiblePersonas.length && (
                  <button
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                    onClick={() => setPeopleLimit((n) => n + 50)}
                  >
                    Mostrar más ({personas.length - visiblePersonas.length} restantes)
                  </button>
                )}
              </div>

              {/* Clientes empresariales */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{t("frontdesk.guests.corporateList")}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{empresas.length}</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5">{t("frontdesk.guests.company")}</th>
                        <th className="px-3 py-2.5">{t("frontdesk.guests.contact")}</th>
                        <th className="px-3 py-2.5">{t("frontdesk.guests.idShort")}</th>
                        <th className="px-3 py-2.5">{t("common.email")}</th>
                        <th className="px-3 py-2.5">{t("common.phone")}</th>
                        <th className="px-3 py-2.5 text-right">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleEmpresas.map((g) => (
                        <tr key={g.id} className="hover:bg-lime-50/40">
                          <td className="px-3 py-2.5 font-medium text-slate-900">{g.company || t("frontdesk.guests.companyFallback")}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {[g.firstName, g.lastName].filter(Boolean).join(" ") || t("frontdesk.guests.noContact")}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {g.idType || g.idNumber
                              ? `${g.idType || ""} ${g.idNumber || ""}`.trim()
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {g.email || <span className="text-slate-400">{t("frontdesk.guests.noEmail")}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {g.phone || <span className="text-slate-400">{t("frontdesk.guests.noPhone")}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-lime-300 hover:bg-lime-50"
                              onClick={() => onEdit(g)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {t("common.edit")}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {empresas.length === 0 && (
                        <tr>
                          <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                            {t("frontdesk.guests.noCompanies")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                </div>
                {empresas.length > visibleEmpresas.length && (
                  <button
                    className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                    onClick={() => setCompanyLimit((n) => n + 50)}
                  >
                    Mostrar más ({empresas.length - visibleEmpresas.length} restantes)
                  </button>
                )}
              </div>
            </>
          );
        })()}
      </div>
      </div>
    </div>
  );
}
