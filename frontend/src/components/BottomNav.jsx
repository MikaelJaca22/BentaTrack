import { NavLink } from 'react-router-dom';

// Bottom navigation bar, shown on every screen size and on every route. Fixed to
// the viewport so the tabs stay reachable no matter how far the page is scrolled.
export default function BottomNav({ items }) {
  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray200 flex justify-around px-1 py-1">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg flex-1 min-h-[56px] ${
              isActive ? 'text-black font-semibold' : 'text-gray400 font-medium'
            } hover:bg-gray100`
          }
        >
          <div className="relative">
            <it.icon size={20} strokeWidth={2} />
            {it.badge ? (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-black text-white text-[9px] flex items-center justify-center">
                {it.badge > 9 ? '9+' : it.badge}
              </span>
            ) : null}
          </div>
          <span className="text-[11px] leading-tight text-center">{it.short || it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}