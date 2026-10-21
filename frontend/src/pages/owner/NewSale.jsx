import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  ShoppingCart,
  AlertTriangle,
  Truck,
  Check,
} from 'lucide-react';
import client, { extractError } from '../../api/client.js';
import { formatMoney } from '../../config.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SkeletonList } from '../../components/Skeleton.jsx';

export default function NewSale() {
  const toast = useToast();
  const ctx = useOutletContext() || {};
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState('');

  const [cart, setCart] = useState([]); // {product, quantity}
  const [step, setStep] = useState('search'); // search | review | payment

  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [saleResult, setSaleResult] = useState(null); // receipt after commit

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const res = await client.get('/products');
      setProducts(res.data.products.filter((p) => p.isActive));
    } catch (e) {
      toast.error('Could not load products');
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.productCode || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const cartQty = (id) => cart.find((c) => c.product.id === id)?.quantity || 0;

  function addToCart(p) {
    if (p.stockQty <= 0) {
      toast.error('Out of stock');
      return;
    }
    setCart((prev) => {
      const found = prev.find((c) => c.product.id === p.id);
      if (found) {
        if (found.quantity >= p.stockQty) {
          toast.error(`Only ${p.stockQty} in stock for "${p.name}"`);
          return prev;
        }
        return prev.map((c) =>
          c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }

  function setQty(id, qty) {
    setCart((prev) => {
      const line = prev.find((c) => c.product.id === id);
      if (!line) return prev;
      if (qty > line.product.stockQty) {
        toast.error(`Only ${line.product.stockQty} in stock`);
        qty = line.product.stockQty;
      }
      if (qty <= 0) return prev.filter((c) => c.product.id !== id);
      return prev.map((c) => (c.product.id === id ? { ...c, quantity: qty } : c));
    });
  }

  function removeLine(id) {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
  }

  const grandTotal = useMemo(
    () => cart.reduce((s, c) => s + c.product.price * c.quantity, 0),
    [cart]
  );

  const changeDue = useMemo(() => {
    const t = Number(tendered || 0);
    return t - grandTotal;
  }, [tendered, grandTotal]);

  async function confirmSale() {
    if (changeDue < 0) {
      toast.error('Amount tendered is less than the total');
      return;
    }
    setBusy(true);
    try {
      const res = await client.post('/sales', {
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        amountTendered: Number(tendered),
      });
      setSaleResult(res.data);
      await loadProducts();
      if (ctx.refreshUnread) ctx.refreshUnread();
      toast.success('Sale recorded');
    } catch (e) {
      const { message } = extractError(e);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setCart([]);
    setTendered('');
    setSaleResult(null);
    setStep('search');
  }

  // -------- Low-stock alert panel after sale --------
  if (saleResult) {
    const low = saleResult.lowStock || [];
    return (
      <div className="space-y-5">
        <div className="bg-white border border-gray200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-ink">
            <Check size={18} />
            <h2 className="text-base font-semibold">Sale recorded</h2>
          </div>
          <p className="mt-1 text-sm text-gray600">
            Receipt <span className="font-medium text-ink">{saleResult.sale.receiptNo}</span> ·{' '}
            {formatMoney(saleResult.sale.total)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate(`/owner/receipt/${saleResult.sale.id}`)}
            >
              View Receipt
            </Button>
            <Button variant="ghost" onClick={startOver}>
              New Sale
            </Button>
          </div>
        </div>

        {low.length > 0 ? (
          <div className="bg-white border-2 border-black rounded-xl p-5">
            <div className="flex items-center gap-2 text-ink">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-semibold">Output: low-stock alert</h3>
            </div>
            <p className="mt-1 text-xs text-gray600">
              These items are at or below their reorder level.
            </p>
            <div className="mt-3 divide-y divide-gray200 border border-gray200 rounded-xl">
              {low.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-ink">{p.name}</span>
                  <span className="text-xs text-gray600">
                    {p.stockQty} left · reorder at {p.reorderLevel}
                  </span>
                </div>
              ))}
            </div>
            <Button
              className="mt-4 w-full"
              icon={Truck}
              onClick={() =>
                navigate('/owner/restock?create=1', {
                  state: { preselect: low.map((p) => p.id) },
                })
              }
            >
              Create Restock Request
            </Button>
          </div>
        ) : (
          <div className="bg-white border border-gray200 rounded-xl p-5 text-sm text-gray600">
            All items are sufficiently stocked. Continue to reports when ready.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step tabs */}
      <div className="flex gap-2 text-xs font-medium">
        {['search', 'review', 'payment'].map((s, i) => (
          <span
            key={s}
            className={`px-3 py-1.5 rounded-xl border ${
              step === s
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray500 border-gray300'
            }`}
          >
            {i + 1}. {s === 'search' ? 'Add Items' : s === 'review' ? 'Review Cart' : 'Payment'}
          </span>
        ))}
      </div>

      {step === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray400"
            />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or code"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {loadingProducts ? (
            <SkeletonList rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No products found"
              hint="Type a product name or code. Add products from the Products screen first."
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-gray200 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                    <p className="text-xs text-gray500">
                      {formatMoney(p.price)} · {p.stockQty} in stock
                      {p.productCode ? ` · ${p.productCode}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    disabled={p.stockQty <= 0 || cartQty(p.id) >= p.stockQty}
                    aria-label={`Add ${p.name}`}
                    className="p-2.5 rounded-lg bg-black text-white disabled:opacity-40 touch-target shrink-0"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <CartBar
            cart={cart}
            total={grandTotal}
            onReview={() => setStep('review')}
            onMore={() => toast.info('Keep adding items')}
          />
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          {cart.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Cart is empty"
              hint="Go back and add items to this sale."
              action={
                <Button variant="secondary" onClick={() => setStep('search')}>
                  Add Items
                </Button>
              }
            />
          ) : (
            <>
              <div className="bg-white border border-gray200 rounded-xl divide-y divide-gray200">
                {cart.map((c) => (
                  <div key={c.product.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {c.product.name}
                        </p>
                        <p className="text-xs text-gray500">
                          {formatMoney(c.product.price)} each
                        </p>
                      </div>
                      <button
                        onClick={() => removeLine(c.product.id)}
                        aria-label="Remove"
                        className="p-2 rounded-lg hover:bg-gray100 text-gray600 touch-target"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(c.product.id, c.quantity - 1)}
                          className="p-2 rounded-lg border border-gray300 touch-target"
                          aria-label="Decrease"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {c.quantity}
                        </span>
                        <button
                          onClick={() => setQty(c.product.id, c.quantity + 1)}
                          disabled={c.quantity >= c.product.stockQty}
                          className="p-2 rounded-lg border border-gray300 disabled:opacity-40 touch-target"
                          aria-label="Increase"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-ink">
                        {formatMoney(c.product.price * c.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setStep('search')}>
                  More Items
                </Button>
                <Button className="flex-1" onClick={() => setStep('payment')}>
                  Proceed to Payment
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray600">Grand total</span>
              <span className="font-bold text-ink">{formatMoney(grandTotal)}</span>
            </div>
            <p className="text-xs text-gray500">Payment method: Cash only</p>
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-medium text-ink">
              Amount tendered
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray300 text-sm focus:outline-none focus:ring-2 focus:ring-black touch-target"
              placeholder="0.00"
            />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-gray600">Change due</span>
              <span
                className={`font-semibold ${
                  changeDue < 0 ? 'text-black' : 'text-ink'
                }`}
              >
                {changeDue < 0 ? 'Insufficient' : formatMoney(changeDue)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep('review')} disabled={busy}>
              <X size={16} /> Back to Cart
            </Button>
            <Button
              className="flex-1"
              onClick={confirmSale}
              disabled={busy || changeDue < 0}
            >
              {busy ? 'Recording…' : 'Confirm Sale'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CartBar({ cart, total, onReview, onMore }) {
  return (
    <div className="sticky bottom-20 md:bottom-4 bg-white border border-gray200 rounded-xl p-3 flex items-center justify-between gap-3">
      <div className="text-sm">
        <span className="text-gray500">{cart.length} item(s) · </span>
        <span className="font-bold text-ink">{formatMoney(total)}</span>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onMore}>
          More Items
        </Button>
        <Button onClick={onReview} disabled={cart.length === 0}>
          Review Cart
        </Button>
      </div>
    </div>
  );
}
