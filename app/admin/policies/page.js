// /lyvoira_app/app/admin/policies/page.js
// Tier: Pro/Enterprise ✅
// Purpose: Policies admin entry (UI shell)

"use client";

import Link from "next/link";

export default function AdminPoliciesPage() {
  return (
    <div className="ly-page">
      <div className="ly-shell">
        <div className="ly-glass ly-header animate-fadeIn">
          <div>
            <div className="ly-title">Policies</div>
            <div className="ly-subtitle">Správa pravidiel a odpovedí</div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/admin" className="ly-btn ly-btn-soft">Admin</Link>
            <Link href="/admin/dashboard" className="ly-btn ly-btn-soft">Dashboard</Link>
            <Link href="/admin/policies" className="ly-btn ly-btn-soft">Policies</Link>
          </div>
        </div>

        <div className="mt-4 ly-card p-6">
          <div className="ly-h2">Policies panel</div>
          <div className="text-sm ly-muted mt-2">
            Ak máš policies editor ako samostatnú stránku/komponent, pošli mi sem jeho kód
            a ja ho sem vložím v tomto štýle (high-end, kontrast, rovnaké tvary).
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}
