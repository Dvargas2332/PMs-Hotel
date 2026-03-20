import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, fallback }) {
  const { token, hotel, user } = useAuth();
  const location = useLocation();
  const isLauncher = location.pathname.startsWith("/launcher");
  const isGestorPanel = location.pathname.startsWith("/launchergestor");

  // Sin login de HOTEL no se puede entrar a nada
  if (!token || !hotel) {
    if (fallback) return fallback;
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Usuario SaaS (gestor): solo puede entrar a su panel
  if (hotel?.isGestor) {
    if (!isGestorPanel) return <Navigate to="/launchergestor" replace />;
    return children;
  }

  // No-gestor intentando entrar al panel
  if (isGestorPanel) return <Navigate to="/launcher" replace />;

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
    else if (path.startsWith("/e-invoicing")) moduleCode = "einvoicing";
    else if (path.startsWith("/management")) moduleCode = "management";

    const hasAllowedModules = Array.isArray(user.allowedModules) && user.allowedModules.length > 0;
    const allowedByList = hasAllowedModules ? user.allowedModules.includes(moduleCode) : false;
    const allowedByPerms =
      Array.isArray(user.permissions) &&
      user.permissions.some((p) => typeof p === "string" && p.startsWith(`${moduleCode}.`));

    const allowed = allowedByList || allowedByPerms;

    if (moduleCode && !allowed) {
      // Si no tiene permiso para este módulo, lo devolvemos al launcher
      return <Navigate to="/launcher" replace />;
    }
  }

  return children;
}
