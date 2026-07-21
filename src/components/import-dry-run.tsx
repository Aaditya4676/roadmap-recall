"use client";

import { FileCheck2 } from "lucide-react";
import { useState } from "react";

export function ImportDryRun() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function check(file?: File) {
    if (!file) return;
    setBusy(true); setStatus("");
    try {
      const backup = JSON.parse(await file.text());
      const response = await fetch("/api/app/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ backup, dryRun: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? data.error?.issues?.[0]?.message ?? "Invalid backup.");
      setStatus(`${data.valid ? "Valid" : "Needs attention"}: ${Object.values(data.counts as Record<string, number>).reduce((a, b) => a + b, 0)} rows inspected. ${data.warnings.join(" ")}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not inspect this file."); }
    finally { setBusy(false); }
  }
  return <section className="card p-5 sm:p-6"><h2 className="text-xl font-bold">Validate a restore file</h2><p className="mt-1 text-sm text-[var(--muted)]">Dry-run validation checks schema, table counts, and orphaned note references without changing any row.</p><label className="button-secondary mt-4 cursor-pointer"><FileCheck2 size={17} /> {busy ? "Inspecting…" : "Choose JSON backup"}<input className="sr-only" type="file" accept="application/json,.json" disabled={busy} onChange={(e) => check(e.target.files?.[0])} /></label>{status && <p role="status" className="mt-3 text-sm text-[var(--muted)]">{status}</p>}</section>;
}
