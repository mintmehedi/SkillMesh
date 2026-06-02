import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function getRoleHomePath(user) {
  if (user?.role === "employer") return "/employer";
  return "/";
}

export function isPremiumCandidate(user) {
  return (
    user?.role === "candidate" &&
    user?.membership?.plan_type === "premium" &&
    user?.membership?.status === "active"
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const me = await api("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMe();
  }, []);

  async function login(email, password) {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      withAuth: false,
    });
    await refreshMe();
  }

  async function register(payload) {
    if (payload.role === "candidate") {
      await api("/api/auth/register/candidate", {
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
      await refreshMe();
      return;
    }

    const body = {
      email: payload.email,
      username: payload.username,
      password: payload.password,
      password_confirm: payload.password_confirm,
      role: "employer",
    };
    if (payload.employer_invite_token) {
      body.employer_invite_token = payload.employer_invite_token;
    }
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      withAuth: false,
    });
    await login(payload.email, payload.password);
  }

  async function logout() {
    try {
      await api("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({}),
        credentials: "include",
        withAuth: false,
        _skipAuthRefresh: true,
      });
    } catch {
      /* session cleared via cookie expiry on server when possible */
    }
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
