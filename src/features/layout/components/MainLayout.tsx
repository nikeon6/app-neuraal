"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import { useStore } from "@/shared/store";
import { LogOut } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, login, logout } = useStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Verify auth state with server
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Unauthorized");
      })
      .then((data) => {
        if (data?.user) {
          Sentry.setUser({ id: data.user.id, email: data.user.email });
          Sentry.addBreadcrumb({
            category: "auth",
            message: "Authenticated user loaded in main layout",
            level: "info",
          });
          login(data.user);
        } else {
          throw new Error("No user");
        }
      })
      .catch(() => {
        Sentry.setUser(null);
        Sentry.addBreadcrumb({
          category: "auth",
          message: "Auth check failed, redirecting to login",
          level: "warning",
        });
        logout();
        router.push("/login");
      })
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      Sentry.addBreadcrumb({
        category: "auth",
        message: "Logout request completed",
        level: "info",
      });
    } catch {
      Sentry.addBreadcrumb({
        category: "auth",
        message: "Logout request failed, continuing client logout",
        level: "warning",
      });
      // Proceed with client-side logout even if API fails
    }
    Sentry.setUser(null);
    queryClient.clear();
    logout();
    router.push("/login");
  };

  if (checking || !user) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {/* Background Ambient Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Area */}
      <main className="flex-1 relative z-10 flex flex-col overflow-hidden">
        {/* Top Bar (Minimal) — mobile: aligned with nav tabs row; md+: top-right corner */}
        <div className="absolute top-3 right-3 z-50 md:top-6 md:right-6">
          <button
            onClick={handleLogout}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="Logout"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}
