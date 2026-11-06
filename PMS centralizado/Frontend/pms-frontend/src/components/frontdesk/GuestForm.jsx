import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { COUNTRIES } from "../../lib/countries";
import {
  User, Mail, Phone, CreditCard, MapPin, Building, Briefcase,
  Globe, Hash, FileText, ChevronDown, Search, X, Check
} from "lucide-react";

const ID_TYPES = [
  { value: "CEDULA_FISICA", label: "Cédula Física" },
  { value: "CEDULA_JURIDICA", label: "Cédula Jurídica" },
  { value: "DIMEX", label: "DIMEX" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "OTRO", label: "Otro" },
];

function Field({ icon: Icon, label, required, error, children, className = "" }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--color-text-muted)" }}>
        {Icon && <Icon size={13} />}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  );
}

function InputField({ icon, ...props }) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">{icon}</span>
      )}
      <input
        {...props}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 ${icon ? "pl-9" : ""}`}
        style={{
          borderColor: "var(--input-border)",
          background: "var(--input-bg)",
          color: "var(--color-text-base)",
        }}
      />
    </div>
  );
}

export default function GuestForm({ initialData, onSave, onCancel, compact = false }) {
  const [form, setForm] = useState({
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
    ...initialData,
  });
  const [countries, setCountries] = useState(COUNTRIES);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/geo/countries").then(({ data }) => {
      if (Array.isArray(data)?.length) setCountries(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.country) { setRegions([]); setCities([]); return; }
    api.get("/geo/regions", { params: { country: form.country } })
      .then(({ data }) => setRegions(Array.isArray(data) ? data : []))
      .catch(() => setRegions([]));
  }, [form.country]);

  useEffect(() => {
    if (!form.country) { setCities([]); return; }
    const params = { country: form.country };
    if (form.state) {
      const region = regions.find(r => r.name === form.state || r.id === form.state);
      if (region) params.regionId = region.id;
    }
    api.get("/geo/cities", { params })
      .then(({ data }) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, [form.country, form.state, regions]);

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = "Requerido";
    if (!form.lastName.trim()) errs.lastName = "Requerido";
    if (!form.email.trim() && !form.phone.trim()) errs.email = "Email o teléfono requerido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { isCompany: _ic, ...data } = form;
      await onSave(data);
    } catch (err) {
      setErrors({ submit: err?.response?.data?.message || "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type toggle */}
      <div className="flex items-center gap-2 p-1 rounded-xl" style={{ background: "var(--input-bg)" }}>
        {[
          { key: false, label: "Persona Física", icon: User },
          { key: true, label: "Empresa", icon: Building },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => update("isCompany", opt.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              form.isCompany === opt.key
                ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <opt.icon size={15} />
            {opt.label}
          </button>
        ))}
      </div>

      {errors.submit && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2 text-sm text-rose-600">
          {errors.submit}
        </div>
      )}

      {/* Sección: Datos principales */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
        <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-base)" }}>
          <User size={15} className="text-emerald-500" />
          Datos {form.isCompany ? "de la empresa" : "personales"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {form.isCompany ? (
            <>
              <Field icon={Building} label="Razón Social" required error={errors.legalName}>
                <InputField value={form.legalName} onChange={e => update("legalName", e.target.value)} placeholder="Nombre de la empresa" />
              </Field>
              <Field icon={User} label="Nombre Comercial">
                <InputField value={form.company} onChange={e => update("company", e.target.value)} placeholder="Nombre comercial" />
              </Field>
              <Field icon={Briefcase} label="Actividad Económica">
                <InputField value={form.economicActivity} onChange={e => update("economicActivity", e.target.value)} placeholder="Código o descripción" />
              </Field>
              <Field icon={User} label="Representante Legal" required error={errors.firstName}>
                <InputField value={form.managerName} onChange={e => { update("managerName", e.target.value); update("lastName", e.target.value); }} placeholder="Nombre del representante" />
              </Field>
            </>
          ) : (
            <>
              <Field icon={User} label="Nombre" required error={errors.firstName}>
                <InputField value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="Nombre(s)" autoFocus />
              </Field>
              <Field icon={User} label="Apellidos" required error={errors.lastName}>
                <InputField value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Apellido(s)" />
              </Field>
            </>
          )}
        </div>
      </div>

      {/* Sección: Contacto */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
        <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-base)" }}>
          <Mail size={15} className="text-blue-500" />
          Contacto
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field icon={Mail} label="Email principal" error={errors.email}>
            <InputField type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="correo@ejemplo.com" />
          </Field>
          <Field icon={Phone} label="Teléfono" error={errors.phone}>
            <InputField type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+506 0000-0000" />
          </Field>
          <Field icon={Mail} label="Email alternativo 1">
            <InputField type="email" value={form.emailAlt1} onChange={e => update("emailAlt1", e.target.value)} />
          </Field>
          <Field icon={Mail} label="Email alternativo 2">
            <InputField type="email" value={form.emailAlt2} onChange={e => update("emailAlt2", e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Sección: Identificación */}
      {!compact && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-base)" }}>
            <CreditCard size={15} className="text-purple-500" />
            Identificación
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field icon={Hash} label="Tipo de ID">
              <select
                value={form.idType}
                onChange={e => update("idType", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              >
                <option value="">Seleccionar...</option>
                {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field icon={Hash} label="Número de ID">
              <InputField value={form.idNumber} onChange={e => update("idNumber", e.target.value)} placeholder="000000000" />
            </Field>
          </div>
        </div>
      )}

      {/* Sección: Ubicación */}
      {!compact && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "var(--card-border)", background: "var(--card-bg)" }}>
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--color-text-base)" }}>
            <MapPin size={15} className="text-amber-500" />
            Ubicación
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field icon={Globe} label="País">
              <select
                value={form.country}
                onChange={e => update("country", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              >
                <option value="">Seleccionar...</option>
                {countries.map(c => <option key={c.code || c} value={c.code || c}>{(c.name || c)}</option>)}
              </select>
            </Field>
            <Field icon={MapPin} label="Provincia/Estado">
              <select
                value={form.state}
                onChange={e => update("state", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              >
                <option value="">Seleccionar...</option>
                {regions.map(r => <option key={r.id || r} value={r.name || r}>{r.name || r}</option>)}
              </select>
            </Field>
            <Field icon={MapPin} label="Ciudad">
              <select
                value={form.city}
                onChange={e => update("city", e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm"
                style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
              >
                <option value="">Seleccionar...</option>
                {cities.map(c => <option key={c.id || c} value={c.name || c}>{c.name || c}</option>)}
              </select>
            </Field>
          </div>
          <Field icon={MapPin} label="Dirección">
            <InputField value={form.address} onChange={e => update("address", e.target.value)} placeholder="Dirección completa" />
          </Field>
        </div>
      )}

      {/* Sección: Notas */}
      <Field icon={FileText} label="Notas">
        <textarea
          value={form.notes}
          onChange={e => update("notes", e.target.value)}
          rows={2}
          className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none"
          style={{ borderColor: "var(--input-border)", background: "var(--input-bg)", color: "var(--color-text-base)" }}
          placeholder="Notas adicionales..."
        />
      </Field>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            style={{ borderColor: "var(--card-border)", color: "var(--color-text-base)" }}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          <Check size={16} />
          {saving ? "Guardando..." : initialData ? "Actualizar" : "Crear Huésped"}
        </button>
      </div>
    </form>
  );
}
