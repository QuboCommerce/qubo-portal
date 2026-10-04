"use client";
import { useState } from "react";

export function Copy({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-neutral-50"
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-neutral-500">{label}</p>
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <code className={`min-w-0 flex-1 break-all text-sm ${mono ? "font-mono" : ""}`}>{value}</code>
        <Copy value={value} />
      </div>
    </div>
  );
}
