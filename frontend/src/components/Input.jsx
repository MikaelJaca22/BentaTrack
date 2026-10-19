import { AlertCircle } from 'lucide-react';

export default function Input({
  label,
  error,
  className = '',
  id,
  ...props
}) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="block mb-1.5 text-sm font-medium text-ink"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={`w-full rounded-xl bg-white border px-3.5 py-2.5 text-sm text-ink placeholder:text-gray400 focus:outline-none focus:ring-2 focus:ring-black focus:border-black touch-target ${
          error ? 'border-black border-2' : 'border-gray300'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-black">
          <AlertCircle size={14} strokeWidth={2} />
          {error}
        </p>
      ) : null}
    </div>
  );
}
