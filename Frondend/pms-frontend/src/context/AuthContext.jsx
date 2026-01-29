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

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  // Hotel autenticado (login 1)
  const [hotel, setHotel] = useState(() => {
    try {
      const stored = localStorage.getItem("hotel");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  // Usuario del launcher (login 2, creado en Management > Perfiles)
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const decodeToken = (t) => {
    try {
      const payload = JSON.parse(atob(t.split(".")[1] || ""));
      return payload && typeof payload === "object" ? payload : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (hotel) localStorage.setItem("hotel", JSON.stringify(hotel));
    else localStorage.removeItem("hotel");
  }, [hotel]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  // Login de HOTEL (primer nivel). Solo habilita acceso al launcher.
  const login = useCallback(
    async (email, password) => {
      const { token: hotelToken, user: userResp, hotel: hotelResp } = await api.login(
        email,
        password
      );
      const payload = decodeToken(hotelToken);
      const isGestor = Boolean(userResp?.isGestor ?? payload?.isGestor);
      setToken(hotelToken);
      // Nivel 1: sesion del hotel (para launcher + management).
      // Preferimos `hotel` real del backend si viene (incluye membership/allowedModules).
      if (hotelResp) {
        setHotel({ ...hotelResp, email: userResp?.email ?? email, isGestor });
      } else if (userResp) {
        setHotel({ ...userResp, isGestor });
      } else {
        setHotel({ email, hotelId: payload?.hotelId, isGestor });
      }
      // Al cambiar de hotel, se limpia cualquier usuario de launcher
      setUser(null);
      return payload ? { ...payload, isGestor } : { isGestor };
    },
    [] // setToken/setHotel/setUser son estables
  );

  // Login de USUARIO DEL LAUNCHER (segundo nivel).
  const loginUser = useCallback(async (username, password) => {
    const data = await api.loginUser(username, password);
    const launcher = data?.launcher;
    const nextToken = data?.token;
    if (!launcher || !nextToken) return null;

    // Por ahora mantenemos el token del HOTEL para que
    // las pantallas de Management sigan funcionando sin 403.
    // El token del launcher solo se usa para construir el perfil (permisos/front-end).

    const u = {
      id: launcher.id,
      username: launcher.username,
      name: launcher.name || launcher.username,
      hotelId: launcher.hotelId,
      hotelName: launcher.hotelName,
      roleId: launcher.roleId,
      role: launcher.roleId,
      permissions: launcher.permissions || [],
      allowedModules: launcher.allowedModules || [],
    };
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    // Cierra todo: hotel + usuario de launcher
    setToken(null);
    setHotel(null);
    setUser(null);
  }, []);

  const logoutUser = useCallback(() => {
    // Solo cierra la sesión del usuario de launcher, manteniendo el hotel
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      hotel,
      user,
      setUser,
      login, // login de hotel
      loginUser,
      logout, // logout completo (hotel + usuario)
      logoutUser,
    }),
    [token, hotel, user, login, loginUser, logout, logoutUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
