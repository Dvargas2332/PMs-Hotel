import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Info, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

import { Input } from "../components/ui/input";



export default function Login({ onSuccess }) {
  const { login } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (loading) return;
    setLoading(true);
    try {
      const payload = await login(email, password);
      const isGestor = Boolean(payload?.isGestor);
      let next = searchParams.get("next") || (isGestor ? "/launchergestor" : "/launcher");
      if (isGestor && next.startsWith("/launcher")) next = "/launchergestor";
      onSuccess?.();
      navigate(next, { replace: true });
    } catch {
      setErr(t("login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--shell-bg)" }}
    >
      {/* Top-left: info + theme toggle */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1 text-xs shadow-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)", color: "var(--color-text-muted)" }}
          onClick={() => alert(t("login.infoSoon"))}
        >
          <Info size={14} className="text-emerald-600 dark:text-emerald-400" />
          {t("common.info")}
        </button>

      </div>

      {/* Top-right: language selector */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>{t("common.language")}</label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-xs rounded-md px-2 py-1 shadow-sm max-w-[160px]"
          style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--color-text-base)" }}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div
        className="w-full max-w-5xl rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-2 shadow-xl"
        style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)" }}
      >
        {/* Left panel — keeps emerald brand identity */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 p-8 flex items-center justify-center">
          <img src="/kazehanalogo.png" alt="Kazehana PMS" className="h-72 w-72 object-contain drop-shadow-2xl" />
        </div>

        {/* Right panel — form */}
        <div className="p-8 md:p-10" style={{ background: "var(--card-bg)" }}>
          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text-base)" }}>{t("login.title")}</h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t("login.subtitle")}</p>
          </div>

          <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <input type="text" name="fake_username" autoComplete="username" className="hidden" />
              <input type="password" name="fake_password" autoComplete="new-password" className="hidden" />

              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>{t("login.email")}</label>
                <Input
                  type="text"
                  name="login_email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                  autoFocus
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>{t("login.password")}</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    name="login_password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    required
                    autoComplete="new-password"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: "var(--color-text-muted)" }}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="pt-1 text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium hover:underline"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("login.forgotPassword")}
                  </Link>
                </div>
              </div>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span>{loading ? t("login.signingIn") : t("common.enter")}</span>
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}
