export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-gray200 rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
