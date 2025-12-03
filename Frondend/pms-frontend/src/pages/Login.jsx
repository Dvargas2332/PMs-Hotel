import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function Login({ onSuccess }) {
  const { login } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("admin@pms.local");
  const [password, setPassword] = useState("Admin1234");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (loading) return;
    setLoading(true);
    const next = searchParams.get("next") || "/launcher";
    try {
      await login(email, password);
      onSuccess?.();
      navigate(next, { replace: true });
    } catch (e) {
      setErr("Credenciales invalidas o servidor no disponible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <div className="absolute left-4 top-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
          onClick={() => alert("Aquí irá el chatbot de ayuda próximamente.")}
        >
          <Info size={14} className="text-emerald-600" />
          Información
        </button>
      </div>
      <div className="absolute right-4 top-4">
        <label className="text-xs text-slate-600 mr-2">Idioma</label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm max-w-[160px]"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="pt">Português</option>
          <option value="de">Deutsch</option>
          <option value="it">Italiano</option>
          <option value="nl">Nederlands</option>
          <option value="sv">Svenska</option>
          <option value="no">Norsk</option>
          <option value="da">Dansk</option>
          <option value="fi">Suomi</option>
          <option value="pl">Polski</option>
          <option value="tr">Türkçe</option>
          <option value="ru">Русский</option>
          <option value="uk">Українська</option>
          <option value="cs">Čeština</option>
          <option value="sk">Slovenčina</option>
          <option value="hu">Magyar</option>
          <option value="ro">Română</option>
          <option value="el">Ελληνικά</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="ar">العربية</option>
          <option value="he">עברית</option>
          <option value="hi">हिन्दी</option>
          <option value="th">ไทย</option>
          <option value="id">Bahasa Indonesia</option>
          <option value="ms">Bahasa Melayu</option>
          <option value="vi">Tiếng Việt</option>
        </select>
      </div>
      <div className="w-full max-w-5xl rounded-3xl border bg-white shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Logo grande a la izquierda */}
        <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 p-8 flex items-center justify-center">
          <img src="/kazehanalogo.png" alt="Kazehana PMS" className="h-72 w-72 object-contain drop-shadow-2xl" />
        </div>

        {/* Formulario a la derecha */}
        <div className="p-8 md:p-10">
          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Bienvenido de vuelta</h1>
            <p className="text-sm text-slate-600">Ingresa tus credenciales para acceder al panel del hotel.</p>
          </div>

          <Card className="p-6 shadow-lg border border-slate-200/80">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Contrasena</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  required
                />
              </div>

              {err && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {err}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="h-4 w-4 mr-2" />
                {loading ? "Ingresando..." : "Entrar"}
              </Button>

              <p className="text-xs text-center text-slate-500">
                Demo: admin@pms.local / Admin1234
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
