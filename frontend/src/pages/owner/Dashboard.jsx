import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  AlertTriangle,
  Truck,
  ArrowRight,
  Package,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import client from '../../api/client.js';
import { formatMoney } from '../../config.js';
import { useToast } from '../../components/Toast.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Badge from '../../components/Badge.jsx';

export default function Dashboard() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        // The report endpoint aggregates over the whole date range in SQL, so
        // these figures are exact. Summing /sales here would only add up the
        // first page (50 rows) and silently under-report a busy day.
        const [report, prod, restock] = await Promise.all([
          client.get(`/reports/sales?from=${today}&to=${today}`),
          client.get('/products?lowStock=true'),
          client.get('/restock?status=pending&limit=1'),
        ]);
        setStats({
          todaySales: report.data.summary.totalSales,
          todayCount: report.data.summary.transactionCount,
          lowStock: prod.data.products.length,
          // pagination.total counts every matching row, not just this page.
          pending: restock.data.pagination.total,
        });
        // Recent receipts (any date) for the list.
        const recent = await client.get('/sales?limit=6');
        setReceipts(recent.data.sales);
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
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-gray200 rounded-xl animate-pulse" />
          <div className="h-24 bg-gray200 rounded-xl animate-pulse" />
        </div>
        <SkeletonList rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={ShoppingCart}
          label="Today's Sales"
          value={formatMoney(stats.todaySales)}
          sub={`${stats.todayCount} transactions`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={stats.lowStock}
          sub="items to reorder"
        />
        <StatCard
          icon={Truck}
          label="Pending Requests"
          value={stats.pending}
          sub="restock in flight"
        />
        <StatCard
          icon={Package}
          label="Quick Action"
          value="New Sale"
          sub="record a cash sale"
          to="/owner/sale"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink">Recent Receipts</h2>
          <Link
            to="/owner/reports"
            className="text-xs font-medium text-gray600 hover:text-black inline-flex items-center gap-1"
          >
            View reports <ArrowRight size={14} />
          </Link>
        </div>

        {receipts.length === 0 ? (
          <EmptyState
            icon={ReceiptIcon}
            title="No sales recorded yet"
            hint="Start a new sale to record your first receipt."
            action={
              <Link to="/owner/sale">
                <button className="bg-black text-white rounded-xl px-4 py-2.5 text-sm font-medium touch-target">
                  New Sale
                </button>
              </Link>
            }
          />
        ) : (
          <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
            {receipts.map((r) => (
              <Link
                key={r.id}
                to={`/owner/receipt/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray100"
              >
                <div>
                  <p className="text-sm font-medium text-ink">{r.receiptNo}</p>
                  <p className="text-xs text-gray500">{r.createdAt}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">
                    {formatMoney(r.total)}
                  </p>
                  <Badge status="completed">Paid</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, to }) {
  const inner = (
    <div className="bg-white border border-gray200 rounded-xl p-4 h-full hover:border-black transition-colors">
      <div className="flex items-center gap-2 text-gray600">
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-ink truncate">{value}</p>
      <p className="text-xs text-gray500">{sub}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}
