import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Share2, Download, BarChart3, Package, Truck } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { formatMoney, API_URL, SYSTEM_TITLE } from '../../config.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';

const TABS = [
  { id: 'sales', label: 'Sales', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'restock', label: 'Restock', icon: Truck },
];

function rangeForPreset(preset) {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (preset === 'today') return { from: to, to };
  const d = new Date(today);
  if (preset === '7d') d.setDate(d.getDate() - 6);
  if (preset === '30d') d.setDate(d.getDate() - 29);
  return { from: d.toISOString().slice(0, 10), to };
}

export default function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState('sales');

  const [sales, setSales] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [restock, setRestock] = useState(null);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(rangeForPreset('30d').from);
  const [to, setTo] = useState(rangeForPreset('30d').to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'inventory') {
        const res = await client.get('/reports/inventory');
        setInventory(res.data);
      } else if (tab === 'sales') {
        const res = await client.get(`/reports/sales?from=${from}&to=${to}`);
        setSales(res.data);
      } else {
        const res = await client.get(`/reports/restock?from=${from}&to=${to}`);
        setRestock(res.data);
      }
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(p) {
    setPreset(p);
    if (p !== 'custom') {
      const r = rangeForPreset(p);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  // Download CSV with the JWT via fetch (endpoint returns text/csv).
  async function downloadCsv() {
    const token = localStorage.getItem('bentatrack_token');
    const qs = tab === 'inventory' ? '' : `?from=${from}&to=${to}`;
    const url = `${API_URL}/reports/${tab}${qs}${qs ? '&' : '?'}format=csv`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${tab}-report.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('CSV downloaded');
    } catch (e) {
      toast.error('Could not download CSV');
    }
  }

  async function shareSummary() {
    const text = buildSummary({ tab, sales, inventory, restock });
    if (navigator.share) {
      try {
        await navigator.share({ title: `${tab} report`, text });
      } catch {
        /* cancelled */
      }
    } else {
      navigator.clipboard?.writeText(text);
      toast.info('Sharing not supported; summary copied');
    }
  }

  const maxDaily = sales ? Math.max(1, ...sales.daily.map((d) => d.revenue)) : 1;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border ${
              tab === t.id
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray600 border-gray300'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        {tab !== 'inventory' && (
          <div className="flex gap-1">
            {[
              ['today', 'Today'],
              ['7d', '7 days'],
              ['30d', '30 days'],
              ['custom', 'Custom'],
            ].map(([v, l]) => (
              <button
                key={v}
                onClick={() => applyPreset(v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                  preset === v
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray600 border-gray300'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        {tab !== 'inventory' && preset === 'custom' && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray300 text-xs"
            />
            <span className="text-xs text-gray500">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray300 text-xs"
            />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Print / PDF
          </Button>
          <Button variant="ghost" icon={Share2} onClick={shareSummary}>
            Share
          </Button>
          <Button variant="ghost" icon={Download} onClick={downloadCsv}>
            CSV
          </Button>
        </div>
      </div>

      <div className="print-area space-y-4">
        <p className="hidden print:block text-xs text-gray600">
          {SYSTEM_TITLE} — {tab} report
        </p>

        {loading ? (
          <SkeletonList rows={4} />
        ) : tab === 'sales' && sales ? (
          <SalesReport sales={sales} maxDaily={maxDaily} />
        ) : tab === 'inventory' && inventory ? (
          <InventoryReport inventory={inventory} />
        ) : tab === 'restock' && restock ? (
          <RestockReport restock={restock} />
        ) : null}
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-gray200 rounded-xl p-4 ${className}`}>{children}</div>
  );
}

function SalesReport({ sales, maxDaily }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <p className="text-xs text-gray500">Total Sales</p>
          <p className="text-lg font-bold text-ink">{formatMoney(sales.summary.totalSales)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray500">Transactions</p>
          <p className="text-lg font-bold text-ink">{sales.summary.transactionCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray500">Items Sold</p>
          <p className="text-lg font-bold text-ink">{sales.summary.itemsSold}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray500">Average Sale</p>
          <p className="text-lg font-bold text-ink">{formatMoney(sales.summary.averageSale)}</p>
        </Card>
      </div>

      <Card>
        <p className="text-sm font-semibold text-ink mb-3">Daily Breakdown</p>
        {sales.daily.length === 0 ? (
          <p className="text-xs text-gray500">No sales in this range.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {sales.daily.slice(-14).map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={formatMoney(d.revenue)}>
                <div
                  className="w-full bg-gray800 rounded-t"
                  style={{ height: `${(d.revenue / maxDaily) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[9px] text-gray500">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <p className="text-sm font-semibold text-ink mb-2">Top Products (quantity)</p>
          <TopList rows={sales.topProductsByQuantity} metric="quantity" />
        </Card>
        <Card>
          <p className="text-sm font-semibold text-ink mb-2">Top Products (revenue)</p>
          <TopList rows={sales.topProductsByRevenue} metric="revenue" />
        </Card>
      </div>

      <Card>
        <p className="text-sm font-semibold text-ink mb-2">Receipts</p>
        {sales.receipts.length === 0 ? (
          <p className="text-xs text-gray500">No receipts in this range.</p>
        ) : (
          <div className="divide-y divide-gray200">
            {sales.receipts.map((r) => (
              <Link
                key={r.id}
                to={`/owner/receipt/${r.id}`}
                className="flex justify-between py-2 text-sm hover:bg-gray100 -mx-1 px-1 rounded"
              >
                <span className="text-ink">{r.receiptNo}</span>
                <span className="text-gray600">{formatMoney(r.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TopList({ rows, metric }) {
  if (!rows.length) return <p className="text-xs text-gray500">No data.</p>;
  return (
    <ol className="space-y-1.5">
      {rows.map((p, i) => (
        <li key={p.name + i} className="flex justify-between text-sm">
          <span className="text-ink truncate">
            <span className="text-gray400">{i + 1}. </span>
            {p.name}
          </span>
          <span className="text-gray600 shrink-0">
            {metric === 'quantity' ? `${p.quantity} sold` : formatMoney(p.revenue)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function InventoryReport({ inventory }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-xs text-gray500">Total Stock Value</p>
          <p className="text-lg font-bold text-ink">{formatMoney(inventory.summary.totalStockValue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray500">Low Stock</p>
          <p className="text-lg font-bold text-ink">{inventory.summary.lowStockCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray500">Products</p>
          <p className="text-lg font-bold text-ink">{inventory.summary.productCount}</p>
        </Card>
      </div>
      <Card>
        {inventory.products.length === 0 ? (
          <p className="text-xs text-gray500">No products yet.</p>
        ) : (
          <div className="divide-y divide-gray200">
            {inventory.products.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 text-sm gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  {p.isLow ? <Badge status="low">Low</Badge> : null}
                  <span className="text-ink truncate">{p.name}</span>
                </div>
                <div className="text-right shrink-0 text-xs text-gray600">
                  <p>
                    {p.stockQty} · reorder {p.reorderLevel}
                  </p>
                  <p>{formatMoney(p.stockValue)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RestockReport({ restock }) {
  const statuses = ['pending', 'accepted', 'delivered', 'completed', 'discrepancy', 'declined'];
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-semibold text-ink mb-3">By Status</p>
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <Badge status={s} />
              <span className="text-sm text-ink">{restock.summary.byStatus[s] || 0}</span>
            </div>
          ))}
          <span className="ml-auto text-sm text-gray600">
            Discrepancies: {restock.summary.discrepancyCount}
          </span>
        </div>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-ink mb-2">Per Supplier</p>
        {restock.perSupplier.length === 0 ? (
          <p className="text-xs text-gray500">No restock requests yet.</p>
        ) : (
          <div className="divide-y divide-gray200">
            {restock.perSupplier.map((s) => (
              <div key={s.supplierId} className="py-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink">{s.supplierName}</span>
                  <span className="text-gray600">{s.total} request(s)</span>
                </div>
                <p className="text-xs text-gray500 mt-0.5">
                  Completed {s.completed} · Discrepancy {s.discrepancy} · Declined {s.declined}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function buildSummary({ tab, sales, inventory, restock }) {
  if (tab === 'sales' && sales) {
    return `Sales report\nTotal: ${formatMoney(sales.summary.totalSales)}\nTransactions: ${
      sales.summary.transactionCount
    }\nItems sold: ${sales.summary.itemsSold}\nAverage sale: ${formatMoney(sales.summary.averageSale)}`;
  }
  if (tab === 'inventory' && inventory) {
    return `Inventory report\nTotal stock value: ${formatMoney(
      inventory.summary.totalStockValue
    )}\nLow stock items: ${inventory.summary.lowStockCount}\nProducts: ${inventory.summary.productCount}`;
  }
  if (tab === 'restock' && restock) {
    return `Restock report\nTotal requests: ${restock.summary.totalRequests}\nDiscrepancies: ${restock.summary.discrepancyCount}`;
  }
  return 'Report';
}
