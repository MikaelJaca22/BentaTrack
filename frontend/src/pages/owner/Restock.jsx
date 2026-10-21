import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { Plus, Truck, X, Minus, Search } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';

export default function Restock() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const ctx = useOutletContext() || {};
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // limit=200 is the server maximum, so a large catalogue of requests is
      // shown in one page rather than silently truncated at the default 50.
      const res = await client.get('/restock?limit=200');
      setRequests(res.data.requests);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Open create flow when arriving from the low-stock alert.
  useEffect(() => {
    if (location.state?.preselect) setCreating(true);
  }, [location.state]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray600">Create and track restock requests to suppliers.</p>
        <Button icon={Plus} onClick={() => setCreating(true)}>
          New Request
        </Button>
      </div>

      {loading ? (
        <SkeletonList rows={3} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No restock requests yet"
          hint="When stock runs low, create a request to send to a supplier."
          action={<Button onClick={() => setCreating(true)}>New Request</Button>}
        />
      ) : (
        <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
          {requests.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/owner/restock/${r.id}`)}
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

      <CreateRequestModal
        open={creating}
        preselect={location.state?.preselect || []}
        onClose={() => {
          setCreating(false);
          // clear route state so it does not reopen
          if (location.state) navigate('/owner/restock', { replace: true });
        }}
        onCreated={() => {
          setCreating(false);
          navigate('/owner/restock', { replace: true });
          load();
          if (ctx.refreshUnread) ctx.refreshUnread();
        }}
      />
    </div>
  );
}

function CreateRequestModal({ open, onClose, onCreated, preselect }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]); // {productId, name, quantity}
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [s, p] = await Promise.all([
          client.get('/suppliers/linked'),
          client.get('/products'),
        ]);
        setSuppliers(s.data.suppliers);
        const list = p.data.products.filter((x) => x.isActive);
        setProducts(list);
        // Preselect low-stock products if provided.
        const pre = (preselect || [])
          .map((id) => list.find((x) => x.id === id))
          .filter(Boolean)
          .map((x) => ({ productId: x.id, name: x.name, quantity: 1 }));
        setLines(pre);
        setSupplierId('');
        setNote('');
      } catch (e) {
        toast.error(extractError(e).message);
      }
    })();
  }, [open, preselect, toast]);

  function addLine(p) {
    if (lines.find((l) => l.productId === p.id)) return;
    setLines((prev) => [...prev, { productId: p.id, name: p.name, quantity: 1 }]);
  }
  function removeLine(id) {
    setLines((prev) => prev.filter((l) => l.productId !== id));
  }
  function setQty(id, q) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === id ? { ...l, quantity: Math.max(1, Number(q) || 1) } : l
      )
    );
  }

  async function submit() {
    setErr('');
    if (!supplierId) {
      setErr('Choose a supplier');
      return;
    }
    if (lines.length === 0) {
      setErr('Add at least one product');
      return;
    }
    setBusy(true);
    try {
      const res = await client.post('/restock', {
        supplierId: Number(supplierId),
        note: note || null,
        items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
      });
      toast.success('Request sent');
      onCreated();
    } catch (e) {
      setErr(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const noSuppliers = suppliers.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Restock Request"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || noSuppliers}>
            {busy ? 'Sending…' : 'Send Request'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {noSuppliers ? (
          <div className="border border-gray300 rounded-xl p-4 text-sm text-gray600">
            No suppliers linked yet. Link a supplier first from the{' '}
            <span className="font-medium text-ink">Suppliers</span> screen.
          </div>
        ) : (
          <div>
            <label className="block mb-1.5 text-sm font-medium text-ink">Supplier</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black touch-target"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (@{s.username})
                </option>
              ))}
            </select>
          </div>
        )}

        <ProductPicker products={products} lines={lines} onAdd={addLine} />

        {lines.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray600">Items</p>
            {lines.map((l) => (
              <div key={l.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-ink truncate">{l.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(l.productId, l.quantity - 1)}
                    className="p-2 rounded-lg border border-gray300 touch-target"
                    aria-label="Decrease"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={l.quantity}
                    onChange={(e) => setQty(l.productId, e.target.value)}
                    className="w-14 text-center py-1.5 rounded-lg border border-gray300 text-sm"
                  />
                  <button
                    onClick={() => setQty(l.productId, l.quantity + 1)}
                    className="p-2 rounded-lg border border-gray300 touch-target"
                    aria-label="Increase"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={() => removeLine(l.productId)}
                  className="p-2 rounded-lg hover:bg-gray100 text-gray600 touch-target"
                  aria-label="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. needed before weekend"
        />

        {err ? <p className="text-xs font-medium text-black">{err}</p> : null}
      </div>
    </Modal>
  );
}

function ProductPicker({ products, lines, onAdd }) {
  const [q, setQ] = useState('');
  const shown = products
    .filter(
      (p) =>
        !lines.find((l) => l.productId === p.id) &&
        (p.name.toLowerCase().includes(q.toLowerCase()) ||
          (p.productCode || '').toLowerCase().includes(q.toLowerCase()))
    )
    .slice(0, 6);
  return (
    <div>
      <label className="block mb-1.5 text-sm font-medium text-ink">Add products</label>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div className="mt-2 space-y-1">
        {q && shown.length === 0 ? (
          <p className="text-xs text-gray500">No matching products.</p>
        ) : (
          shown.map((p) => (
            <button
              key={p.id}
              onClick={() => onAdd(p)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray200 hover:bg-gray100 text-left"
            >
              <span className="text-sm text-ink truncate">{p.name}</span>
              <span className="text-xs text-gray500">stock {p.stockQty}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
