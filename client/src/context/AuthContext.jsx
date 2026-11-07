import { createContext, useContext, useEffect, useState } from "react";

import api from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("collabx_user")) || null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  // Verify existing login session on page refresh
  useEffect(() => {
    const verifyUser = async () => {
      const token = localStorage.getItem("collabx_token");

      if (!token) {
        disconnectSocket();
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");

        setUser(response.data.user);

        localStorage.setItem(
          "collabx_user",
          JSON.stringify(response.data.user),
        );

        // Connect socket only after successful verification
        connectSocket(token);
      } catch (error) {
        disconnectSocket();

        localStorage.removeItem("collabx_token");
        localStorage.removeItem("collabx_user");

        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();

    return () => {
      disconnectSocket();
    };
  }, []);

  // Save login/register session
  const saveSession = (data) => {
    localStorage.setItem("collabx_token", data.token);

    localStorage.setItem("collabx_user", JSON.stringify(data.user));

    setUser(data.user);

    // Connect authenticated socket
    connectSocket(data.token);
  };

  // Login
  const login = async (email, password) => {
    const response = await api.post("/auth/login", {
      email,
      password,
    });

    saveSession(response.data);

    return response.data;
  };

  // Register
  const register = async (name, email, password) => {
    const response = await api.post("/auth/register", {
      name,
      email,
      password,
    });

    saveSession(response.data);

    return response.data;
  };

  // Logout
  const logout = () => {
    disconnectSocket();

    localStorage.removeItem("collabx_token");
    localStorage.removeItem("collabx_user");

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
