import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractError } from '../../api/client.js';
import { SYSTEM_TITLE } from '../../config.js';
import Input from '../../components/Input.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(username, password);
      navigate(user.role === 'store_owner' ? '/owner' : '/supplier');
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink leading-snug">
            BentaTrack:
          </h1>
          <p className="mt-1.5 text-sm font-bold text-gray500 leading-snug">
            {SYSTEM_TITLE}
          </p>
        </div>

        <form
          id="login-form"
          onSubmit={onSubmit}
          className="bg-white border border-gray200 rounded-xl p-6 space-y-4"
        >
          <Input
            label="Username"
            name="username"
            placeholder="Enter your username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-black">
              <AlertCircle size={16} /> {error}
            </p>
          ) : null}
        </form>

        {/* Link-style actions, outside the form */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <button
            type="submit"
            form="login-form"
            disabled={busy}
            className="text-sm font-semibold text-black hover:text-gray600 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
          <Link
            to="/create-account"
            className="text-sm font-semibold text-black hover:text-gray600 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded-sm transition-colors"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
