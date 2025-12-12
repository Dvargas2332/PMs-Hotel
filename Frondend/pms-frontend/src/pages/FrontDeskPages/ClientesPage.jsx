import React, { useEffect, useMemo, useState } from "react";
import { useHotelData } from "../../context/HotelDataContext";
import { api } from "../../lib/api";
import { COUNTRIES } from "../../lib/countries";

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

export default function ClientesPage() {
  const { guests, loading, refreshGuests, createGuest, updateGuest } = useHotelData();
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);

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
    if (!form.firstName || !form.lastName) {
      alert("Nombre y apellidos son obligatorios");
      return;
    }
    if (form.isCompany && !form.company.trim()) {
      alert("Para clientes empresariales debes indicar el nombre de la empresa");
      return;
    }
    try {
      if (editId) {
        await updateGuest(editId, { ...form, isCompany: undefined });
      } else {
        await createGuest({ ...form, isCompany: undefined });
      }
      setForm(emptyForm);
      setEditId(null);
      setSearch("");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo guardar el huesped";
      alert(msg);
    }
  };

  const onEdit = (g) => {
    setEditId(g.id);
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
    <div className="p-6 bg-gray-50 min-h-screen space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Huespedes</h1>
          <p className="text-sm text-slate-600">Listado conectado al backend /guests.</p>
        </div>
        
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">{editId ? "Editar cliente" : "Crear cliente"}</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Tipo:</span>
            <button
              type="button"
              className={`px-3 py-1 rounded-full border text-xs ${
                !form.isCompany
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
              onClick={() => setForm((f) => ({ ...f, isCompany: false }))}
            >
              Cliente normal
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-full border text-xs ${
                form.isCompany
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
              onClick={() => setForm((f) => ({ ...f, isCompany: true }))}
            >
              Empresarial
            </button>
          </div>
        </div>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              className="w-full max-w-[300px] border rounded px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Apellidos</label>
            <input
              className="w-full max-w-[300px] border rounded px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email principal</label>
            <input
              type="email"
              className="w-full max-w-[300px] border rounded px-3 py-2"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Telefono</label>
            <input
              className="w-full max-w-[220px] border rounded px-3 py-2"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tipo de documento</label>
            <select
              className="w-full max-w-[220px] border rounded px-3 py-2 bg-white"
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
              <option value="">Seleccionar...</option>
              <option value="CEDULA_FISICA">Cedula fisica</option>
              <option value="CEDULA_JURIDICA">Cedula juridica</option>
              <option value="PASAPORTE">Pasaporte</option>
              <option value="DIMEX">DIMEX</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Numero de documento</label>
            <input
              className="w-full max-w-[220px] border rounded px-3 py-2"
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
            <label className="block text-xs text-slate-500 mb-1">Pais</label>
            <select
              className="w-full max-w-[220px] border rounded px-3 py-2 bg-white"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, state: "", city: "" }))}
            >
              <option value="">Seleccionar pais...</option>
              {countries.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Estado / Provincia</label>
            {form.country && regions.length > 0 ? (
              <select
                className="w-full max-w-[220px] border rounded px-3 py-2 bg-white"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value, city: "" }))}
              >
                <option value="">Seleccionar estado / provincia...</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full max-w-[220px] border rounded px-3 py-2"
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                placeholder="Estado / provincia"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Ciudad</label>
            {form.country && cities.length > 0 ? (
              <select
                className="w-full max-w-[220px] border rounded px-3 py-2 bg-white"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              >
                <option value="">Seleccionar ciudad...</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full max-w-[220px] border rounded px-3 py-2"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Ciudad"
              />
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Direccion</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              {form.isCompany ? "Nombre de la empresa" : "Empresa (opcional)"}
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder={form.isCompany ? "Ej. ACME Corp" : ""}
            />
          </div>
          {form.isCompany && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Razón social</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.legalName}
                  onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre de gerente</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.managerName}
                  onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Actividad económica</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.economicActivity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, economicActivity: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Correo alternativo 1</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={form.emailAlt1}
                  onChange={(e) => setForm((f) => ({ ...f, emailAlt1: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Correo alternativo 2</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={form.emailAlt2}
                  onChange={(e) => setForm((f) => ({ ...f, emailAlt2: e.target.value }))}
                />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notas</label>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded border bg-gray-100 text-sm"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
              }}
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={loading.action}
              className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500"
            >
              {editId ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Listas de clientes</h2>
          <input
            className="border rounded px-3 py-2 text-sm w-full md:w-64"
            placeholder="Buscar por nombre, email, telefono o documento"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {(() => {
          const empresas = filtered.filter((g) => !!g.company);
          const personas = filtered.filter((g) => !g.company);
          return (
            <>
              {/* Clientes normales */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  Clientes normales ({personas.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500">
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Documento</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Telefono</th>
                        <th className="p-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personas.map((g) => (
                        <tr key={g.id} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">
                              {[g.firstName, g.lastName].filter(Boolean).join(" ") || g.id}
                            </div>
                            {g.company && (
                              <div className="text-xs text-slate-500">{g.company}</div>
                            )}
                          </td>
                          <td className="p-2 text-xs">
                            {g.idType || g.idNumber
                              ? `${g.idType || ""} ${g.idNumber || ""}`.trim()
                              : <span className="text-slate-400">Sin documento</span>}
                          </td>
                          <td className="p-2">
                            {g.email || <span className="text-slate-400">Sin email</span>}
                          </td>
                          <td className="p-2">
                            {g.phone || <span className="text-slate-400">Sin telefono</span>}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-100 text-xs"
                              onClick={() => onEdit(g)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {personas.length === 0 && (
                        <tr>
                          <td className="p-3 text-center text-slate-500" colSpan={5}>
                            No hay clientes normales que coincidan con la busqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clientes empresariales */}
              <div className="space-y-2 mt-6">
                <h3 className="text-sm font-semibold text-slate-800">
                  Clientes empresariales ({empresas.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-slate-500">
                        <th className="p-2">Empresa</th>
                        <th className="p-2">Contacto</th>
                        <th className="p-2">Documento</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Telefono</th>
                        <th className="p-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresas.map((g) => (
                        <tr key={g.id} className="border-t">
                          <td className="p-2 font-medium">{g.company || "Empresa"}</td>
                          <td className="p-2 text-xs">
                            {[g.firstName, g.lastName].filter(Boolean).join(" ") || "Sin contacto"}
                          </td>
                          <td className="p-2 text-xs">
                            {g.idType || g.idNumber
                              ? `${g.idType || ""} ${g.idNumber || ""}`.trim()
                              : <span className="text-slate-400">Sin documento</span>}
                          </td>
                          <td className="p-2">
                            {g.email || <span className="text-slate-400">Sin email</span>}
                          </td>
                          <td className="p-2">
                            {g.phone || <span className="text-slate-400">Sin telefono</span>}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-100 text-xs"
                              onClick={() => onEdit(g)}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                      {empresas.length === 0 && (
                        <tr>
                          <td className="p-3 text-center text-slate-500" colSpan={6}>
                            No hay empresas que coincidan con la busqueda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
