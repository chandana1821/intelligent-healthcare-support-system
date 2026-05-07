import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("name");
    const email = localStorage.getItem("email");
    const phone = localStorage.getItem("phone");
    return token ? { token, role, name, email, phone } : null;
  });

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name);
    localStorage.setItem("email", email);
    setSession({ token: data.access_token, role: data.role, name: data.name, email });
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("name", data.name);
    localStorage.setItem("email", payload.email);
    if (payload.phone) localStorage.setItem("phone", payload.phone);
    setSession({ token: data.access_token, role: data.role, name: data.name, email: payload.email, phone: payload.phone });
  };

  const logout = () => {
    localStorage.clear();
    setSession(null);
  };

  const value = useMemo(() => ({ session, login, register, logout }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
