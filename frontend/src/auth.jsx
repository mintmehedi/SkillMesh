import { createContext, useContext, useEffect, useState } from "react";
import { api, clearTokens, setTokens } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const me = await api("/api/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function login(email, password) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      withAuth: false,
    });
    setTokens(data.access, data.refresh);
    await refreshMe();
  }

  async function register(payload) {
    if (payload.role === "candidate") {
      const data = await api("/api/auth/register/candidate", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          username: payload.username,
          password: payload.password,
          password_confirm: payload.password_confirm,
          first_name: payload.first_name,
          last_name: payload.last_name,
          date_of_birth: payload.date_of_birth,
          postcode: payload.postcode,
          suburb: payload.suburb,
          country: payload.country,
          mobile_number: payload.mobile_number,
        }),
        withAuth: false,
      });
      setTokens(data.access, data.refresh);
      await refreshMe();
      return;
    }

    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        username: payload.username,
        password: payload.password,
        role: "employer",
      }),
      withAuth: false,
    });
    await login(payload.email, payload.password);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
