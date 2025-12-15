import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, fallback }) {
  const { token, hotel, user } = useAuth();
  const location = useLocation();
  const isLauncher = location.pathname.startsWith("/launcher");

  // Sin login de HOTEL no se puede entrar a nada
  if (!token || !hotel) {
    if (fallback) return fallback;
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Para cualquier ruta distinta de /launcher se exige usuario interno
  if (!isLauncher) {
    if (!user) {
      return <Navigate to="/launcher" replace />;
    }

    // Seguridad extra: validar que el usuario tenga permiso para este módulo
    const path = location.pathname || "";
    let moduleCode = null;
    if (path.startsWith("/frontdesk")) moduleCode = "frontdesk";
    else if (path.startsWith("/restaurant")) moduleCode = "restaurant";
    else if (path.startsWith("/accounting")) moduleCode = "accounting";
    else if (path.startsWith("/management")) moduleCode = "management";

    const allowed = Array.isArray(user.allowedModules)
      ? user.allowedModules.includes(moduleCode)
      : false;

    if (moduleCode && !allowed) {
      // Si no tiene permiso para este módulo, lo devolvemos al launcher
      return <Navigate to="/launcher" replace />;
    }
  }

  return children;
}
