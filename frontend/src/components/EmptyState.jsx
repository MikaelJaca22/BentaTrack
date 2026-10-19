export default function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 border border-dashed border-gray300 rounded-xl bg-white">
      {Icon ? <Icon size={32} strokeWidth={1.5} className="text-gray400 mb-3" /> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-xs text-gray500 max-w-xs">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
