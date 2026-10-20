import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Modal } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  AlertTriangle,
  Truck,
  Check,
} from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { formatMoney } from '../../config.js';
import { useToast } from '../../components/Toast.js';
import TopHeader from '../../components/TopHeader.js';
import Button from '../../components/Button.js';
import { SkeletonList } from '../../components/Skeleton.js';

export default function NewSaleScreen() {
  const toast = useToast();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState('search');
  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await client.get('/products');
      setProducts(res.data.products.filter((p) => p.isActive));
    } catch (e) {
      toast.error('Could not load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFocused) loadProducts();
  }, [isFocused]);

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
    if (p.stockQty <= 0) return toast.error('Out of stock');
    setCart((prev) => {
      const found = prev.find((c) => c.product.id === p.id);
      if (found) {
        if (found.quantity >= p.stockQty) {
          toast.error(`Only ${p.stockQty} in stock`);
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

  const grandTotal = useMemo(() => cart.reduce((s, c) => s + c.product.price * c.quantity, 0), [cart]);
  const changeDue = Number(tendered || 0) - grandTotal;

  async function confirmSale() {
    if (changeDue < 0) return toast.error('Amount tendered is less than the total');
    setBusy(true);
    try {
      const res = await client.post('/sales', {
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        amountTendered: Number(tendered),
      });
      setResult(res.data);
      await loadProducts();
      toast.success('Sale recorded');
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setCart([]);
    setTendered('');
    setResult(null);
    setStep('search');
  }

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="New Sale" notificationsPath="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Result / low-stock panel */}
        {result ? (
          <View className="gap-4">
            <View className="bg-white border border-gray200 rounded-xl p-5">
              <View className="flex-row items-center gap-2">
                <Check size={18} color="#000000" />
                <Text className="text-base font-semibold text-ink">Sale recorded</Text>
              </View>
              <Text className="mt-1 text-sm text-gray600">
                Receipt {result.sale.receiptNo} · {formatMoney(result.sale.total)}
              </Text>
              <View className="flex-row gap-2 mt-3">
                <Button variant="secondary" onPress={() => navigation.navigate('Receipt', { id: result.sale.id })}>
                  View Receipt
                </Button>
                <Button variant="ghost" onPress={startOver}>
                  New Sale
                </Button>
              </View>
            </View>

            {result.lowStock.length > 0 ? (
              <View className="bg-white border-2 border-black rounded-xl p-5">
                <View className="flex-row items-center gap-2">
                  <AlertTriangle size={18} color="#000000" />
                  <Text className="text-sm font-semibold text-ink">Output: low-stock alert</Text>
                </View>
                <View className="mt-3 border border-gray200 rounded-xl overflow-hidden">
                  {result.lowStock.map((p, i) => (
                    <View
                      key={String(p.id)}
                      className={`flex-row justify-between px-3 py-2 ${i > 0 ? 'border-t border-gray200' : ''}`}
                    >
                      <Text className="text-sm text-ink">{p.name}</Text>
                      <Text className="text-xs text-gray600">
                        {p.stockQty} / {p.reorderLevel}
                      </Text>
                    </View>
                  ))}
                </View>
                <Button
                  className="mt-4"
                  icon={Truck}
                  onPress={() =>
                    navigation.navigate('Restock', { create: true, preselect: result.lowStock.map((p) => p.id) })
                  }
                >
                  Create Restock Request
                </Button>
              </View>
            ) : (
              <View className="bg-white border border-gray200 rounded-xl p-5">
                <Text className="text-sm text-gray600">All items are sufficiently stocked.</Text>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Steps */}
            <View className="flex-row gap-2 mb-4">
              {['search', 'review', 'payment'].map((s, i) => (
                <View
                  key={s}
                  className={`px-3 py-1.5 rounded-xl border ${
                    step === s ? 'bg-black border-black' : 'bg-white border-gray300'
                  }`}
                >
                  <Text className={`text-xs font-medium ${step === s ? 'text-white' : 'text-gray500'}`}>
                    {i + 1}. {s === 'search' ? 'Add' : s === 'review' ? 'Review' : 'Pay'}
                  </Text>
                </View>
              ))}
            </View>

            {step === 'search' && (
              <>
                <View className="flex-row items-center bg-white border border-gray300 rounded-xl px-3 mb-3">
                  <Search size={16} color="#A3A3A3" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search product name or code"
                    className="flex-1 ml-2 py-3 text-sm text-ink"
                  />
                </View>

                {loading ? (
                  <SkeletonList rows={4} />
                ) : filtered.length === 0 ? (
                  <View className="items-center py-12">
                    <Search size={30} color="#A3A3A3" />
                    <Text className="mt-3 text-sm font-semibold text-ink">No products found</Text>
                    <Text className="text-xs text-gray500 mt-1">Add products from the Stock screen.</Text>
                  </View>
                ) : (
                  <View className="gap-2">
                    {filtered.map((p) => (
                      <View key={String(p.id)} className="flex-row items-center justify-between bg-white border border-gray200 rounded-xl p-3">
                        <View className="flex-1 pr-2">
                          <Text className="text-sm font-medium text-ink" numberOfLines={1}>{p.name}</Text>
                          <Text className="text-xs text-gray500">
                            {formatMoney(p.price)} · {p.stockQty} in stock
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => addToCart(p)}
                          disabled={p.stockQty <= 0 || cartQty(p.id) >= p.stockQty}
                          className={`p-2.5 rounded-lg bg-black ${p.stockQty <= 0 || cartQty(p.id) >= p.stockQty ? 'opacity-40' : ''}`}
                        >
                          <Plus size={16} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {cart.length > 0 && (
                  <View className="mt-4 flex-row items-center justify-between bg-white border border-gray200 rounded-xl p-3">
                    <Text className="text-sm text-ink">
                      {cart.length} · <Text className="font-bold">{formatMoney(grandTotal)}</Text>
                    </Text>
                    <Button onPress={() => setStep('review')}>Review Cart</Button>
                  </View>
                )}
              </>
            )}

            {step === 'review' && (
              <>
                {cart.length === 0 ? (
                  <EmptyCart onBack={() => setStep('search')} />
                ) : (
                  <>
                    <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
                      {cart.map((c, i) => (
                        <View key={String(c.product.id)} className={`p-4 ${i > 0 ? 'border-t border-gray200' : ''}`}>
                          <View className="flex-row justify-between">
                            <Text className="text-sm font-medium text-ink flex-1">{c.product.name}</Text>
                            <Pressable onPress={() => setQty(c.product.id, 0)} className="p-1">
                              <Trash2 size={16} color="#525252" />
                            </Pressable>
                          </View>
                          <View className="flex-row items-center justify-between mt-2">
                            <View className="flex-row items-center gap-2">
                              <Pressable onPress={() => setQty(c.product.id, c.quantity - 1)} className="p-2 rounded-lg border border-gray300">
                                <Minus size={14} color="#000000" />
                              </Pressable>
                              <Text className="w-8 text-center text-sm font-medium">{c.quantity}</Text>
                              <Pressable onPress={() => setQty(c.product.id, c.quantity + 1)} className="p-2 rounded-lg border border-gray300">
                                <Plus size={14} color="#000000" />
                              </Pressable>
                            </View>
                            <Text className="text-sm font-semibold text-ink">
                              {formatMoney(c.product.price * c.quantity)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <View className="flex-row gap-2 mt-4">
                      <Button variant="secondary" onPress={() => setStep('search')}>
                        More Items
                      </Button>
                      <Button className="flex-1" onPress={() => setStep('payment')}>
                        Proceed to Payment
                      </Button>
                    </View>
                  </>
                )}
              </>
            )}

            {step === 'payment' && (
              <>
                <View className="bg-white border border-gray200 rounded-xl p-4 mb-3">
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-gray600">Grand total</Text>
                    <Text className="text-sm font-bold text-ink">{formatMoney(grandTotal)}</Text>
                  </View>
                  <Text className="text-xs text-gray500 mt-1">Payment method: Cash only</Text>
                </View>

                <Text className="text-sm font-medium text-ink mb-1.5">Amount tendered</Text>
                <TextInput
                  keyboardType="numeric"
                  value={tendered}
                  onChangeText={setTendered}
                  placeholder="0.00"
                  className="bg-white border border-gray300 rounded-xl px-3.5 py-3 text-sm text-ink mb-2"
                />
                <View className="flex-row justify-between mb-4">
                  <Text className="text-sm text-gray600">Change due</Text>
                  <Text className="text-sm font-semibold text-ink">
                    {changeDue < 0 ? 'Insufficient' : formatMoney(changeDue)}
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <Button variant="secondary" onPress={() => setStep('review')} disabled={busy}>
                    Back to Cart
                  </Button>
                  <Button className="flex-1" onPress={confirmSale} disabled={busy || changeDue < 0}>
                    {busy ? 'Recording…' : 'Confirm Sale'}
                  </Button>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function EmptyCart({ onBack }) {
  return (
    <View className="items-center py-12 border border-dashed border-gray300 rounded-xl bg-white">
      <ShoppingCart size={30} color="#A3A3A3" />
      <Text className="mt-3 text-sm font-semibold text-ink">Cart is empty</Text>
      <View className="mt-4">
        <Button variant="secondary" onPress={onBack}>
          Add Items
        </Button>
      </View>
    </View>
  );
}
