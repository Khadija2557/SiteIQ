import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";

export function setupAuth() {
  const token = localStorage.getItem("token");
  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    }
  }, [token, location, setLocation]);

  if (!token) return null;

  return <>{children}</>;
}