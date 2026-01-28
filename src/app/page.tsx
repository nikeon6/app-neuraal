"use client";

import { MainLayout } from "@/features/layout";
import { Dashboard } from "@/features/dashboard";

export default function Home() {
  return (
    <MainLayout>
      <Dashboard />
    </MainLayout>
  );
}
