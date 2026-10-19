import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import Badge from '../../components/Badge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'discrepancy', label: 'Discrepancy' },
];

export default function Requests() {
  const toast = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}&limit=200` : '?limit=200';
      const res = await client.get(`/restock${q}`);
      setRequests(res.data.requests);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-nowrap ${
              filter === f.id
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray600 border-gray300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests"
          hint="There are no requests matching this filter."
        />
      ) : (
        <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/supplier/request/${r.id}`)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray100 text-left"
            >
              <div>
                <p className="text-sm font-medium text-ink">Request #{r.id}</p>
                <p className="text-xs text-gray500">
                  {r.itemCount} item(s) · {r.counterpart} · {r.createdAt}
                </p>
              </div>
              <Badge status={r.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
