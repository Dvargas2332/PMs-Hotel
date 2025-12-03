import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, fallback }) {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    // Si se pasa un fallback personalizado, úsalo; de lo contrario redirige a login con "next"
    if (fallback) return fallback;
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
