import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { extractError } from '../../api/client.js';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import { SYSTEM_TITLE } from '../../config.js';

export default function CreateAccount() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('store_owner');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErr, setFieldErr] = useState({});
  const [busy, setBusy] = useState(false);

  function clientValidate() {
    const fe = {};
    if (!name.trim()) fe.name = 'Name is required';
    if (!/^[A-Za-z0-9_.]{4,20}$/.test(username))
      fe.username = 'Username must be 4-20 chars: letters, numbers, underscore, period';
    if (password.length < 8) fe.password = 'Password must be at least 8 characters';
    if (password !== confirm) fe.confirm = 'Passwords do not match';
    setFieldErr(fe);
    return Object.keys(fe).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!clientValidate()) return;
    setBusy(true);
    try {
      const user = await register({ role, name, username, password });
      navigate(user.role === 'store_owner' ? '/owner' : '/supplier');
    } catch (err) {
      const { message, field } = extractError(err);
      setError(message);
      if (field) setFieldErr((p) => ({ ...p, [field]: message }));
    } finally {
      setBusy(false);
    }
  }

  const nameLabel = role === 'store_owner' ? 'Store Owner Name' : 'Supplier Name';
  const namePlaceholder =
    role === 'store_owner' ? 'Enter your full name' : 'Enter your supplier name';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold text-ink">BentaTrack:</h1>
          <p className="mt-1 text-xs text-gray500">{SYSTEM_TITLE}</p>
        </div>

        <form
          id="create-account-form"
          onSubmit={onSubmit}
          className="bg-white border border-gray200 rounded-xl p-6 space-y-4"
        >
          {/* Account type toggle */}
          <div>
            <span className="block mb-1.5 text-sm font-medium text-ink">
              Account Type
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'store_owner', l: 'Store Owner' },
                { v: 'supplier', l: 'Supplier' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => setRole(opt.v)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium border touch-target ${
                    role === opt.v
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-gray300'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <Input
            label={nameLabel}
            name="name"
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErr.name}
          />
          <Input
            label="Username"
            name="username"
            placeholder="4-20 characters: letters, numbers, _ or ."
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={fieldErr.username}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErr.password}
          />
          <Input
            label="Confirm Password"
            name="confirm"
            type="password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={fieldErr.confirm}
          />

          {error ? (
            <p className="flex items-center gap-1.5 text-sm font-medium text-black">
              <AlertCircle size={16} /> {error}
            </p>
          ) : null}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating…' : 'Create Account'}
          </Button>
        </form>

        {/* Link-style actions, outside the form */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <Link
            to="/login"
            className="text-sm font-semibold text-black hover:text-gray600 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded-sm transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
