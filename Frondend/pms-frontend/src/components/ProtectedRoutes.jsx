import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, fallback }) {
  const { token } = useAuth();
  if (!token) return fallback ?? <p>Necesitas iniciar sesión.</p>;
  return children;
}
