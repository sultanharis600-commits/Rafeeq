'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-12 rounded-lg bg-brand-700 px-4 text-white">
      {label}
    </button>
  );
}
