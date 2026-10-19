import { useNavigate } from 'react-router-dom';
import { LogOut, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { SYSTEM_TITLE } from '../config.js';

export default function TopBar({ unread = 0, notificationsPath }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray200 no-print">
      {/* minmax(0,..) lets the long brand line wrap instead of overflowing on narrow screens */}
      <div className="grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center px-4 md:px-8 h-16">
        <div />
        <div className="text-center min-w-0 px-2">
          <p className="text-base font-bold text-ink leading-snug">
            BentaTrack: {SYSTEM_TITLE}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          {notificationsPath ? (
            <button
              onClick={() => navigate(notificationsPath)}
              aria-label="Notifications"
              className="relative p-2.5 rounded-xl hover:bg-gray100 text-ink touch-target"
            >
              <Bell size={18} />
              {unread > 0 ? (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-black text-white text-[9px] flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </button>
          ) : null}
          <span className="hidden sm:inline text-xs text-gray600 px-2">
            {user?.name}
          </span>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            aria-label="Log out"
            className="p-2.5 rounded-xl hover:bg-gray100 text-ink touch-target"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
