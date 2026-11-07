import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MailQuestion, MailCheck, ArrowLeft } from "lucide-react";
import { http } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { Input } from "../components/ui/input";

export default function ForgotPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSaving(true);
    try {
      // El backend responde igual exista o no el correo (no se filtra).
      await http.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (ex) {
      setErr(ex?.response?.data?.message || t("forgotPassword.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--shell-bg)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl p-8"
        style={{ border: "1px solid var(--card-border)", background: "var(--card-bg)" }}
      >
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <MailCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--color-text-base)" }}>
              {t("forgotPassword.sentTitle")}
            </h1>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {t("forgotPassword.sentBody")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
            >
              {t("forgotPassword.goLogin")}
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-1 mb-6">
              <div className="flex items-center gap-2">
                <MailQuestion className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h1 className="text-xl font-semibold" style={{ color: "var(--color-text-base)" }}>
                  {t("forgotPassword.title")}
                </h1>
              </div>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                {t("forgotPassword.subtitle")}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: "var(--color-text-base)" }}>
                  {t("login.email")}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("login.emailPlaceholder")}
                  required
                  autoFocus
                />
              </div>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/30 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #059669, #0891b2)" }}
              >
                {saving ? t("forgotPassword.sending") : t("forgotPassword.send")}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full flex items-center justify-center gap-1 text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("forgotPassword.back")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
