import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoApp } from "@/components/demo-app";

export const metadata: Metadata = { title: "Local demo" };

export default function DemoPage() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center text-[var(--muted)]">Loading private sandbox…</div>}><DemoApp /></Suspense>;
}
