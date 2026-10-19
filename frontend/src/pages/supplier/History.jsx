import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import Badge from '../../components/Badge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';
import Button from '../../components/Button.jsx';

export default function History() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  // Each status is requested separately. Filtering a single /restock page would
  // hide completed requests whenever 50 newer requests of other statuses pushed
  // them off the first page.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [done, declined] = await Promise.all([
        client.get(`/restock?status=completed&limit=${limit}`),
        client.get(`/restock?status=declined&limit=${limit}`),
      ]);
      const merged = [...done.data.requests, ...declined.data.requests].sort(
        (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))
      );
      setRows(merged);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [limit, toast]);

  const hasMore = rows.length >= limit;

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <SkeletonList rows={4} />;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No history yet"
          hint="Completed and declined requests will appear here."
        />
      ) : (
        <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/supplier/request/${r.id}`)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray100 text-left"
            >
              <div>
                <p className="text-sm font-medium text-ink">Request #{r.id}</p>
                <p className="text-xs text-gray500">
                  {r.itemCount} item(s) · {r.counterpart} · {r.updatedAt}
                </p>
              </div>
              <Badge status={r.status} />
            </button>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((n) => n + 50)} disabled={loading}>
            {loading ? 'Loading...' : 'Load older'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
