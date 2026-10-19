import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Share2, Copy, Check } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { formatMoney, SYSTEM_TITLE } from '../../config.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Skeleton from '../../components/Skeleton.jsx';

function receiptText(data) {
  const lines = [
    SYSTEM_TITLE,
    `Store: ${data.store.name}`,
    `Receipt: ${data.sale.receiptNo}`,
    `Date: ${data.sale.createdAt}`,
    '----------------------------',
    ...data.items.map(
      (i) => `${i.quantity} x ${i.name} @ ${formatMoney(i.unitPrice)} = ${formatMoney(i.lineTotal)}`
    ),
    '----------------------------',
    `Total: ${formatMoney(data.sale.total)}`,
    `Tendered: ${formatMoney(data.sale.amountTendered)}`,
    `Change: ${formatMoney(data.sale.changeDue)}`,
    `Payment: ${data.sale.paymentMethod}`,
    '',
    'Thank you!',
  ];
  return lines.join('\n');
}

export default function Receipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    client
      .get(`/sales/${id}`)
      .then((res) => setData(res.data))
      .catch((e) => toast.error(extractError(e).message))
      .finally(() => setLoading(false));
  }, [id, toast]);

  async function share() {
    const text = receiptText(data);
    if (navigator.share) {
      try {
        await navigator.share({ title: data.sale.receiptNo, text });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
      toast.info('Sharing not supported; copied instead');
    }
  }

  function copy() {
    navigator.clipboard
      .writeText(receiptText(data))
      .then(() => {
        setCopied(true);
        toast.success('Copied as text');
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error('Could not copy'));
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray100 touch-target"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-medium text-ink">Receipt</span>
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
          Print
        </Button>
        <Button variant="secondary" icon={Share2} onClick={share}>
          Share
        </Button>
        <Button variant="ghost" icon={copied ? Check : Copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy as text'}
        </Button>
      </div>

      <div className="print-area bg-white border border-gray200 rounded-xl p-6 max-w-md mx-auto">
        <div className="text-center border-b border-gray200 pb-4">
          <p className="text-sm font-bold text-ink">BentaTrack</p>
          <p className="text-[11px] text-gray500">{SYSTEM_TITLE}</p>
        </div>
        <div className="py-4 text-sm space-y-1">
          <Row label="Store" value={data.store.name} />
          <Row label="Receipt" value={data.sale.receiptNo} />
          <Row label="Date" value={data.sale.createdAt} />
        </div>
        <div className="border-t border-b border-gray200 py-3 space-y-1.5">
          {data.items.map((i) => (
            <div key={i.id} className="text-sm">
              <div className="flex justify-between">
                <span className="text-ink">{i.name}</span>
                <span className="text-gray600">
                  {i.quantity} × {formatMoney(i.unitPrice)}
                </span>
              </div>
              <div className="flex justify-between text-gray600 text-xs">
                <span>Line total</span>
                <span>{formatMoney(i.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-3 space-y-1 text-sm">
          <Row label="Total" value={formatMoney(data.sale.total)} bold />
          <Row label="Tendered" value={formatMoney(data.sale.amountTendered)} />
          <Row label="Change" value={formatMoney(data.sale.changeDue)} />
          <Row label="Payment" value={data.sale.paymentMethod} />
        </div>
        <p className="text-center text-xs text-gray500 mt-4">Thank you!</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray600">{label}</span>
      <span className={bold ? 'font-bold text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}
