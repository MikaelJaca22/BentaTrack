import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Check, AlertTriangle, RefreshCw, Clock } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import Skeleton from '../../components/Skeleton.jsx';

export default function RestockDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const ctx = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState(null); // 'verify' | 'discrepancy'
  const [received, setReceived] = useState({}); // itemId -> qty
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // resend
  const [resendOpen, setResendOpen] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [resendSupplier, setResendSupplier] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    client
      .get(`/restock/${id}`)
      .then((res) => setData(res.data))
      .catch((e) => toast.error(extractError(e).message))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openMode(m) {
    setMode(m);
    setNote('');
    // Default received to delivered quantities.
    const init = {};
    data.items.forEach((it) => {
      init[it.id] = it.quantityDelivered ?? it.quantityRequested;
    });
    setReceived(init);
  }

  async function submitVerify() {
    setBusy(true);
    try {
      await client.post(`/restock/${id}/verify`, {
        items: data.items.map((it) => ({
          itemId: it.id,
          quantityReceived: Number(received[it.id] || 0),
        })),
      });
      toast.success('Delivery verified, inventory updated');
      setMode(null);
      load();
      if (ctx.refreshUnread) ctx.refreshUnread();
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDiscrepancy() {
    if (!note.trim()) {
      toast.error('A note is required');
      return;
    }
    setBusy(true);
    try {
      await client.post(`/restock/${id}/discrepancy`, {
        items: data.items.map((it) => ({
          itemId: it.id,
          quantityReceived: Number(received[it.id] || 0),
        })),
        note,
      });
      toast.success('Discrepancy reported');
      setMode(null);
      load();
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function openResend() {
    const res = await client.get('/suppliers/linked');
    setSuppliers(res.data.suppliers);
    setResendSupplier('');
    setResendOpen(true);
  }

  async function submitResend() {
    if (!resendSupplier) {
      toast.error('Choose a supplier');
      return;
    }
    setBusy(true);
    try {
      const res = await client.post(`/restock/${id}/resend`, {
        supplierId: Number(resendSupplier),
      });
      toast.success('Request resent');
      navigate(`/owner/restock/${res.data.id}`, { replace: true });
      setTimeout(load, 0);
      setResendOpen(false);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const canVerify = data.status === 'delivered';
  const canResend = data.status === 'declined';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 no-print">
        <button
          onClick={() => navigate('/owner/restock')}
          className="p-2 rounded-lg hover:bg-gray100 touch-target"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-base font-semibold text-ink">Request #{data.id}</h2>
        <Badge status={data.status} />
      </div>

      <div className="bg-white border border-gray200 rounded-xl p-4 space-y-1 text-sm">
        <Line label="Store Owner" value={data.storeOwner.name} />
        <Line label="Supplier" value={data.supplier.name} />
        <Line label="Created" value={data.createdAt} />
        {data.note ? <Line label="Note" value={data.note} /> : null}
        {data.declineReason ? (
          <Line label="Declined reason" value={data.declineReason} />
        ) : null}
      </div>

      <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
        <div className="px-4 py-2 text-xs font-medium text-gray600">Items</div>
        {data.items.map((it) => (
          <div key={it.id} className="px-4 py-3 text-sm">
            <p className="font-medium text-ink">{it.name}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray600">
              <span>Requested: {it.quantityRequested}</span>
              <span>Delivered: {it.quantityDelivered ?? '—'}</span>
              <span>Received: {it.quantityReceived ?? '—'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Store verifies delivery? actions */}
      {canVerify ? (
        <div className="bg-white border-2 border-black rounded-xl p-4 no-print">
          <p className="text-sm font-semibold text-ink mb-1">Store verifies delivery?</p>
          <p className="text-xs text-gray600 mb-3">
            Enter quantity received per item. If every item matches delivered, confirm to complete
            and update inventory. Otherwise report a discrepancy.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={Check} onClick={() => openMode('verify')}>
              Verify &amp; Confirm
            </Button>
            <Button variant="secondary" icon={AlertTriangle} onClick={() => openMode('discrepancy')}>
              Report Discrepancy
            </Button>
          </div>
        </div>
      ) : null}

      {canResend ? (
        <div className="no-print">
          <Button variant="secondary" icon={RefreshCw} onClick={openResend}>
            Resend to another supplier
          </Button>
        </div>
      ) : null}

      {/* Event timeline */}
      <div className="bg-white border border-gray200 rounded-xl p-4">
        <p className="text-xs font-medium text-gray600 mb-3">History</p>
        <div className="space-y-3">
          {data.events.map((e) => (
            <div key={e.id} className="flex gap-2 text-sm">
              <Clock size={14} className="text-gray400 mt-0.5 shrink-0" />
              <div>
                <p className="text-ink">
                  {e.actorName} · <span className="font-medium">{e.eventType}</span>
                </p>
                {e.message ? <p className="text-xs text-gray500">{e.message}</p> : null}
                <p className="text-[11px] text-gray400">{e.createdAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verify / Discrepancy modal */}
      <Modal
        open={!!mode}
        onClose={() => setMode(null)}
        title={mode === 'verify' ? 'Verify received quantities' : 'Report discrepancy'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={mode === 'verify' ? submitVerify : submitDiscrepancy}
              disabled={busy}
            >
              {busy ? 'Working…' : mode === 'verify' ? 'Confirm' : 'Report'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {data.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{it.name}</p>
                <p className="text-xs text-gray500">
                  Delivered: {it.quantityDelivered ?? it.quantityRequested}
                </p>
              </div>
              <input
                type="number"
                min="0"
                value={received[it.id] ?? 0}
                onChange={(e) =>
                  setReceived((prev) => ({ ...prev, [it.id]: Number(e.target.value) }))
                }
                className="w-20 px-3 py-2 rounded-xl border border-gray300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          ))}
          {mode === 'discrepancy' ? (
            <Input
              label="Note (required)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the problem with this delivery"
            />
          ) : null}
        </div>
      </Modal>

      {/* Resend modal */}
      <Modal
        open={resendOpen}
        onClose={() => setResendOpen(false)}
        title="Resend to another supplier"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResendOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitResend} disabled={busy}>
              {busy ? 'Resending…' : 'Resend'}
            </Button>
          </>
        }
      >
        <select
          value={resendSupplier}
          onChange={(e) => setResendSupplier(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">Select a supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (@{s.username})
            </option>
          ))}
        </select>
      </Modal>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray500">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
