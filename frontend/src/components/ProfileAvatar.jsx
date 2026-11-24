import { Store, UsersRound } from 'lucide-react';

// Role-specific profile avatar with distinct designs:
// - store_owner: solid black circle with a white Store icon
// - supplier: outlined circle with a black UsersRound icon
export default function ProfileAvatar({ user }) {
  if (!user) return null;
  const label = user.role === 'store_owner' ? 'Store owner' : 'Supplier';
  if (user.role === 'store_owner') {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black"
        title={label}
        aria-label={label}
      >
        <Store size={15} strokeWidth={1.5} className="text-white" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white border-2 border-black"
      title={label}
      aria-label={label}
    >
      <UsersRound size={15} strokeWidth={1.5} className="text-black" />
    </span>
  );
}
