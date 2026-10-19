import { useEffect, useState, useCallback } from 'react';
import { Link2, Trash2, Search, UserPlus, Users } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';

export default function Suppliers() {
  const toast = useToast();
  const [linked, setLinked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [toUnlink, setToUnlink] = useState(null);

  const loadLinked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/suppliers/linked');
      setLinked(res.data.suppliers);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadLinked();
  }, [loadLinked]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await client.get(`/suppliers/search?q=${encodeURIComponent(term)}`);
        const linkedIds = new Set(linked.map((l) => l.id));
        setResults(res.data.suppliers.filter((s) => !linkedIds.has(s.id)));
      } catch (e) {
        toast.error(extractError(e).message);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, linked, toast]);

  async function link(supplierId) {
    try {
      await client.post('/suppliers/link', { supplierId });
      toast.success('Supplier linked');
      setQ('');
      setResults([]);
      await loadLinked();
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  async function doUnlink() {
    try {
      await client.delete(`/suppliers/link/${toUnlink.id}`);
      toast.success('Supplier unlinked');
      setToUnlink(null);
      await loadLinked();
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Linked Suppliers</h2>
        {loading ? (
          <SkeletonList rows={2} />
        ) : linked.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No linked suppliers"
            hint="Search below to link suppliers who have created their own accounts."
          />
        ) : (
          <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
            {linked.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-gray500">@{s.username}</p>
                </div>
                <button
                  onClick={() => setToUnlink(s)}
                  aria-label="Unlink"
                  className="p-2 rounded-lg hover:bg-gray100 text-gray600 touch-target"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Register Supplier (find an account)</h2>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search suppliers by name or username"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        {q.trim() === '' ? (
          <p className="text-xs text-gray500">
            Only suppliers who created their own accounts can be linked. There are no preloaded
            suppliers.
          </p>
        ) : searching ? (
          <SkeletonList rows={2} />
        ) : results.length === 0 ? (
          <p className="text-sm text-gray500">No matching suppliers found.</p>
        ) : (
          <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
            {results.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-gray500">@{s.username}</p>
                </div>
                <Button variant="secondary" icon={UserPlus} onClick={() => link(s.id)}>
                  Link
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!toUnlink}
        destructive
        title="Unlink supplier?"
        message={`Unlink "${toUnlink?.name}" from your store? Existing requests remain.`}
        confirmLabel="Unlink"
        onConfirm={doUnlink}
        onClose={() => setToUnlink(null)}
      />
    </div>
  );
}
