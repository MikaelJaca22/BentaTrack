import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Truck, Clock, AlertTriangle } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import Skeleton from '../../components/Skeleton.jsx';

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [delivered, setDelivered] = useState({});

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

  async function accept() {
    setBusy(true);
    try {
      await client.post(`/restock/${id}/accept`);
      toast.success('Request accepted');
      load();
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!reason.trim()) {
      toast.error('A reason is required');
      return;
    }
    setBusy(true);
    try {
      await client.post(`/restock/${id}/decline`, { reason });
      toast.success('Request declined');
      setDeclineOpen(false);
      load();
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  function openDeliver() {
    const init = {};
    data.items.forEach((it) => {
      init[it.id] = it.quantityDelivered ?? it.quantityRequested;
    });
    setDelivered(init);
    setDeliverOpen(true);
  }

  async function submitDeliver() {
    setBusy(true);
    try {
      await client.post(`/restock/${id}/deliver`, {
        items: data.items.map((it) => ({
          itemId: it.id,
          quantityDelivered: Number(delivered[it.id] || 0),
        })),
      });
      toast.success('Marked as delivered');
      setDeliverOpen(false);
      load();
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

  const canAct = data.status === 'pending';
  const canDeliver = data.status === 'accepted' || data.status === 'discrepancy';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 no-print">
        <button
          onClick={() => navigate('/supplier/requests')}
          className="p-2 rounded-lg hover:bg-gray100 touch-target"
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>
        <h2 className="text-base font-semibold text-black">Request #{data.id}</h2>
        <Badge status={data.status} />
      </div>

      <div className="bg-white border border-gray200 rounded-xl p-4 space-y-1 text-sm">
        <Line label="Store Owner" value={data.storeOwner.name} />
        <Line label="Created" value={data.createdAt} />
        {data.note ? <Line label="Note" value={data.note} /> : null}
        {data.declineReason ? (
          <Line label="Declined reason" value={data.declineReason} />
        ) : null}
      </div>

      <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
        <div className="px-4 py-2 text-xs font-medium text-black">Items</div>
        {data.items.map((it) => (
          <div key={it.id} className="px-4 py-3 text-sm">
            <div className="flex items-start gap-3">
              <ProductImage
                src={it.imageUrl}
                alt={it.name}
                className="w-12 h-12 shrink-0"
                iconSize={16}
              />
              <div className="min-w-0">
                <p className="font-medium text-black">{it.name}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-black">
                  <span>Requested: {it.quantityRequested}</span>
                  <span>Delivered: {it.quantityDelivered ?? '—'}</span>
                  <span>Received: {it.quantityReceived ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.status === 'discrepancy' ? (
        <div className="bg-white border-2 border-primary rounded-xl p-4">
          <div className="flex items-center gap-2 text-black">
            <AlertTriangle size={16} strokeWidth={1.5} />
            <p className="text-sm font-semibold">Output: report discrepancy</p>
          </div>
          <p className="mt-1 text-xs text-black">
            The store reported a discrepancy. Review the received quantities below and re-deliver.
          </p>
          <div className="mt-2 text-xs text-black space-y-1">
            {data.items.map((it) => (
              <p key={it.id}>
                {it.name}: delivered {it.quantityDelivered ?? '—'}, received{' '}
                {it.quantityReceived ?? '—'}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {/* Can fulfil? */}
      {canAct ? (
        <div className="bg-white border-2 border-primary rounded-xl p-4 no-print">
          <p className="text-sm font-semibold text-black mb-3">Can fulfil this request?</p>
          <div className="flex flex-wrap gap-2">
            <Button icon={Check} onClick={accept} disabled={busy}>
              Accept
            </Button>
            <Button variant="secondary" icon={X} onClick={() => setDeclineOpen(true)} disabled={busy}>
              Decline with reason
            </Button>
          </div>
        </div>
      ) : null}

      {canDeliver ? (
        <div className="no-print">
          <div className="flex flex-wrap gap-2">
            <Button icon={Truck} onClick={openDeliver} disabled={busy}>
              Accept, prepare and deliver goods
            </Button>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-gray200 rounded-xl p-4">
        <p className="text-xs font-medium text-black mb-3">History</p>
        <div className="space-y-3">
          {data.events.map((e) => (
            <div key={e.id} className="flex gap-2 text-sm">
              <Clock size={14} strokeWidth={1.5} className="text-black mt-0.5 shrink-0" />
              <div>
                <p className="text-black">
                  {e.actorName} · <span className="font-medium">{e.eventType}</span>
                </p>
                {e.message ? <p className="text-xs text-black">{e.message}</p> : null}
                <p className="text-[11px] text-black">{e.createdAt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decline modal */}
      <Modal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        title="Decline request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclineOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="secondary" icon={X} onClick={decline} disabled={busy}>
              {busy ? 'Declining…' : 'Decline'}
            </Button>
          </>
        }
      >
        <Input
          label="Reason (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why you cannot fulfil this request"
        />
      </Modal>

      {/* Deliver modal */}
      <Modal
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        title="Enter delivered quantities"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeliverOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button icon={Truck} onClick={submitDeliver} disabled={busy}>
              {busy ? 'Saving…' : 'Mark Delivered'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {data.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <ProductImage
                src={it.imageUrl}
                alt={it.name}
                className="w-9 h-9 shrink-0"
                iconSize={14}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-black truncate">{it.name}</p>
                <p className="text-xs text-black">Requested: {it.quantityRequested}</p>
              </div>
              <input
                type="number"
                min="0"
                value={delivered[it.id] ?? 0}
                onChange={(e) =>
                  setDelivered((prev) => ({ ...prev, [it.id]: Number(e.target.value) }))
                }
                className="w-20 px-3 py-2 rounded-xl border border-gray300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-black">{label}</span>
      <span className="text-black text-right">{value}</span>
    </div>
  );
}
