import { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { formatMoney } from '../../config.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';

const empty = {
  productCode: '',
  name: '',
  category: '',
  unit: 'pc',
  price: '',
  cost: '',
  stockQty: '',
  reorderLevel: '',
};

export default function Products() {
  const toast = useToast();
  const ctx = useOutletContext() || {};
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [form, setForm] = useState(empty);
  const [formErr, setFormErr] = useState({});
  const [busy, setBusy] = useState(false);

  const [adjust, setAdjust] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', reason: '' });

  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await client.get(`/products${q}`);
      setProducts(res.data.products);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openNew() {
    setForm(empty);
    setFormErr({});
    setEditing('new');
  }
  function openEdit(p) {
    setForm({
      productCode: p.productCode || '',
      name: p.name,
      category: p.category || '',
      unit: p.unit || 'pc',
      price: String(p.price),
      cost: String(p.cost),
      stockQty: String(p.stockQty),
      reorderLevel: String(p.reorderLevel),
    });
    setFormErr({});
    setEditing(p);
  }

  function validateForm() {
    const fe = {};
    if (!form.name.trim()) fe.name = 'Name is required';
    if (form.price === '' || Number(form.price) < 0) fe.price = 'Enter a valid price';
    if (form.cost !== '' && Number(form.cost) < 0) fe.cost = 'Cost cannot be negative';
    if (form.stockQty !== '' && Number(form.stockQty) < 0) fe.stockQty = 'Stock cannot be negative';
    if (form.reorderLevel !== '' && Number(form.reorderLevel) < 0)
      fe.reorderLevel = 'Reorder level cannot be negative';
    setFormErr(fe);
    return Object.keys(fe).length === 0;
  }

  async function save() {
    if (!validateForm()) return;
    setBusy(true);
    const payload = {
      productCode: form.productCode || null,
      name: form.name.trim(),
      category: form.category || null,
      unit: form.unit || 'pc',
      price: Number(form.price),
      cost: form.cost === '' ? 0 : Number(form.cost),
      stockQty: form.stockQty === '' ? 0 : Number(form.stockQty),
      reorderLevel: form.reorderLevel === '' ? 0 : Number(form.reorderLevel),
    };
    try {
      if (editing === 'new') {
        await client.post('/products', payload);
        toast.success('Product added');
      } else {
        await client.put(`/products/${editing.id}`, payload);
        toast.success('Product updated');
      }
      setEditing(null);
      await load();
      if (ctx.refreshUnread) ctx.refreshUnread();
    } catch (e) {
      const { message } = extractError(e);
      setFormErr({ form: message });
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    try {
      await client.delete(`/products/${toDelete.id}`);
      toast.success('Product removed');
      setToDelete(null);
      await load();
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  function openAdjust(p) {
    setAdjust(p);
    setAdjustForm({ quantity: '', reason: '' });
  }
  async function saveAdjust() {
    if (adjustForm.quantity === '' || Number(adjustForm.quantity) === 0) return;
    if (!adjustForm.reason.trim()) {
      toast.error('A reason is required');
      return;
    }
    try {
      await client.patch(`/products/${adjust.id}/stock`, {
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
      });
      toast.success('Stock adjusted');
      setAdjust(null);
      await load();
      if (ctx.refreshUnread) ctx.refreshUnread();
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <Button icon={Plus} onClick={openNew}>
          Add
        </Button>
      </div>

      {loading ? (
        <SkeletonList rows={4} />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No products yet"
          hint="Add your first product to start selling and tracking stock."
          action={<Button onClick={openNew}>Add Product</Button>}
        />
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className={`bg-white border rounded-xl p-4 ${
                p.isActive ? 'border-gray200' : 'border-gray200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                    {p.isLow && p.isActive ? (
                      <Badge status="low">
                        <AlertTriangle size={12} /> Low
                      </Badge>
                    ) : null}
                    {!p.isActive ? <Badge status="declined">Inactive</Badge> : null}
                  </div>
                  <p className="text-xs text-gray500 mt-0.5">
                    {formatMoney(p.price)} · stock {p.stockQty} {p.unit} · reorder at{' '}
                    {p.reorderLevel}
                    {p.productCode ? ` · code ${p.productCode}` : ''}
                    {p.category ? ` · ${p.category}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openAdjust(p)}
                    aria-label="Adjust stock"
                    className="p-2 rounded-lg hover:bg-gray100 text-gray600 touch-target"
                  >
                    <SlidersHorizontal size={16} />
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    aria-label="Edit"
                    className="p-2 rounded-lg hover:bg-gray100 text-gray600 touch-target"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setToDelete(p)}
                    aria-label="Delete"
                    className="p-2 rounded-lg hover:bg-gray100 text-gray600 touch-target"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add Product' : 'Edit Product'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formErr.name}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Product Code"
              value={form.productCode}
              onChange={(e) => setForm({ ...form, productCode: e.target.value })}
            />
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Price (₱)"
              type="number"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              error={formErr.price}
            />
            <Input
              label="Cost (₱)"
              type="number"
              step="0.01"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              error={formErr.cost}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <Input
              label="Stock Qty"
              type="number"
              value={form.stockQty}
              onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
              error={formErr.stockQty}
            />
            <Input
              label="Reorder Lvl"
              type="number"
              value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              error={formErr.reorderLevel}
            />
          </div>
          {formErr.form ? <p className="text-xs font-medium text-black">{formErr.form}</p> : null}
        </div>
      </Modal>

      {/* Adjust stock modal */}
      <Modal
        open={!!adjust}
        onClose={() => setAdjust(null)}
        title={`Adjust stock: ${adjust?.name || ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjust(null)}>
              Cancel
            </Button>
            <Button onClick={saveAdjust}>Apply</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-gray600">
            Current stock: {adjust?.stockQty}. Enter a positive number to add or negative to reduce.
          </p>
          <Input
            label="Adjustment quantity"
            type="number"
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
          />
          <Input
            label="Reason"
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            placeholder="e.g. damaged, recount"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        destructive
        title="Remove product?"
        message={`"${toDelete?.name}" will be deactivated and blocked from selling. This does not delete past sales.`}
        confirmLabel="Remove"
        onConfirm={doDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
