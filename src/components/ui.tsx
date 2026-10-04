export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-steel mb-1.5">{label}</span>
      {children}
    </label>
  );
}
