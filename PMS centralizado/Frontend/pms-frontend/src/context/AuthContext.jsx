import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

// Helpers para sessionStorage (persiste entre refrescos pero no entre pestañas)
function loadFromSession(key) {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}
function saveToSession(key, value) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* noop */ }
}

export function AuthProvider({ children }) {
  // Ya no guardamos token en localStorage — va en cookies httpOnly
  const [token, setToken] = useState(null); // solo en memoria para compat interna
  const [hotel, setHotel] = useState(() => loadFromSession("hotel"));
  const [user, setUser] = useState(() => loadFromSession("user"));
  const [ready, setReady] = useState(false); // true cuando se completa el intento de restaurar sesión

  // Persistir hotel/user en sessionStorage (NO en localStorage)
  useEffect(() => { saveToSession("hotel", hotel); }, [hotel]);
  useEffect(() => { saveToSession("user", user); }, [user]);

  // Al montar, intentar restaurar sesión vía refresh token
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        // Siempre se intenta: la cookie de refresco dura 7 días, así que la
        // sesión se restaura aunque sessionStorage esté vacío (pestaña nueva)
        // o el usuario recargue.
        const data = await api.refresh();
        if (cancelled) return;
        if (data?.user) setUser(data.user);
        if (data?.hotel) setHotel(data.hotel);
      } catch {
        // Refresh falló — limpiar sesión
        if (!cancelled) {
          setHotel(null);
          setUser(null);
          setToken(null);
          saveToSession("hotel", null);
          saveToSession("user", null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    restore();

    // Escuchar evento de logout forzado (desde el interceptor de axios)
    const handleForceLogout = () => {
      setToken(null);
      setHotel(null);
      setUser(null);
      saveToSession("hotel", null);
      saveToSession("user", null);
    };
    window.addEventListener("auth:logout", handleForceLogout);
    return () => {
      cancelled = true;
      window.removeEventListener("auth:logout", handleForceLogout);
    };
  }, []);

  const decodeToken = (t) => {
    try {
      const payload = JSON.parse(atob(t.split(".")[1] || ""));
      return payload && typeof payload === "object" ? payload : null;
    } catch {
      return null;
    }
  };

  // Login de HOTEL (primer nivel). Las cookies httpOnly se setean automáticamente.
  const login = useCallback(
    async (email, password) => {
      const { token: hotelToken, user: userResp, hotel: hotelResp } = await api.login(
        email,
        password
      );
      const payload = decodeToken(hotelToken);
      const isGestor = Boolean(userResp?.isGestor ?? payload?.isGestor);
      // token se guarda en memoria (el valor real está en la cookie httpOnly)
      setToken(hotelToken);

      let hotelData;
      if (hotelResp) {
        hotelData = { ...hotelResp, email: userResp?.email ?? email, isGestor };
      } else if (userResp) {
        hotelData = { ...userResp, isGestor };
      } else {
        hotelData = { email, hotelId: payload?.hotelId, isGestor };
      }
      setHotel(hotelData);
      setUser(null);
      saveToSession("user", null);
      return payload ? { ...payload, isGestor } : { isGestor };
    },
    []
  );

  // Login de USUARIO DEL LAUNCHER (segundo nivel).
  const loginUser = useCallback(async (username, password) => {
    const hotelId = hotel?.id || hotel?.hotelId || hotel?.hotel_id;
    const data = await api.loginUser(username, password, hotelId);
    const launcher = data?.launcher ?? data?.user;
    const nextToken = data?.token;
    if (!launcher || !nextToken) return null;

    const permissions = Array.isArray(launcher.permissions) ? launcher.permissions : [];
    const allowedModules = Array.isArray(launcher.allowedModules)
      ? launcher.allowedModules
      : Array.isArray(launcher.modules)
        ? launcher.modules
        : [];
    const roleId =
      launcher.roleId ??
      launcher.role ??
      (Array.isArray(launcher.roles) ? launcher.roles[0] : undefined);

    const u = {
      id: launcher.id,
      username: launcher.username || launcher.email || "",
      name: launcher.name || launcher.username || launcher.email || "",
      hotelId: launcher.hotelId,
      hotelName: launcher.hotelName,
      roleId,
      role: roleId || launcher.role || "",
      permissions,
      allowedModules,
    };
    setUser(u);
    return u;
  }, [hotel]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // No importa si falla
    }
    setToken(null);
    setHotel(null);
    setUser(null);
    saveToSession("hotel", null);
    saveToSession("user", null);
  }, []);

  const logoutUser = useCallback(() => {
    setUser(null);
    saveToSession("user", null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      hotel,
      user,
      ready,
      setUser,
      login,
      loginUser,
      logout,
      logoutUser,
    }),
    [token, hotel, user, ready, login, loginUser, logout, logoutUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
