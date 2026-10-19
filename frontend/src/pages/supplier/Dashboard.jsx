import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, CheckCircle2, Truck, ArrowRight } from 'lucide-react';
import client from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Badge from '../../components/Badge.jsx';

export default function SupplierDashboard() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, delivered: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const all = await client.get('/restock');
        const reqs = all.data.requests;
        setCounts({
          pending: reqs.filter((r) => r.status === 'pending').length,
          accepted: reqs.filter((r) => r.status === 'accepted').length,
          delivered: reqs.filter((r) => r.status === 'delivered').length,
        });
        setRecent(reqs.slice(0, 6));
      } catch (e) {
        toast.error('Could not load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="h-24 bg-gray200 rounded-xl animate-pulse" />
          <div className="h-24 bg-gray200 rounded-xl animate-pulse" />
          <div className="h-24 bg-gray200 rounded-xl animate-pulse" />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={Inbox} label="Pending" value={counts.pending} />
        <Stat icon={CheckCircle2} label="Accepted" value={counts.accepted} />
        <Stat icon={Truck} label="Awaiting verify" value={counts.delivered} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink">Recent Requests</h2>
          <Link
            to="/supplier/requests"
            className="text-xs font-medium text-gray600 hover:text-black inline-flex items-center gap-1"
          >
            All requests <ArrowRight size={14} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No requests yet"
            hint="Restock requests from store owners will appear here."
          />
        ) : (
          <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
            {recent.map((r) => (
              <Link
                key={r.id}
                to={`/supplier/request/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray100"
              >
                <div>
                  <p className="text-sm font-medium text-ink">Request #{r.id}</p>
                  <p className="text-xs text-gray500">
                    {r.itemCount} item(s) · {r.counterpart}
                  </p>
                </div>
                <Badge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-gray200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray600">
        <Icon size={15} />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
