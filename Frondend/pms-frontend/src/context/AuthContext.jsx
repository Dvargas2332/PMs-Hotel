import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
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

    // Si hay token pero no tenemos user (p.ej. refresh), intenta decodificar email/role/hotel
    if (token && !user) {
      const payload = decodeToken(token);
      if (payload?.email) {
        setUser({
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          name: payload.name,
          hotelId: payload.hotelId,
        });
      }
    }
  }, [token, user]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const login = async (email, password) => {
    const { token, user: userResp } = await api.login(email, password);
    setToken(token);
    if (userResp) setUser(userResp);
    else {
      const payload = decodeToken(token);
      setUser({ email, hotelId: payload?.hotelId });
    }
    return token;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, setUser, login, logout }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
