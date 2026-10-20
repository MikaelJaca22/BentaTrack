import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, AlertTriangle } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { formatMoney } from '../../config.js';
import { useToast } from '../../components/Toast.js';
import TopHeader from '../../components/TopHeader.js';
import Button from '../../components/Button.js';
import Input from '../../components/Input.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';

const empty = { productCode: '', name: '', category: '', unit: 'pc', price: '', cost: '', stockQty: '', reorderLevel: '' };

export default function ProductsScreen() {
  const toast = useToast();
  const isFocused = useIsFocused();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null); // 'new' | product
  const [form, setForm] = useState(empty);
  const [formErr, setFormErr] = useState({});
  const [busy, setBusy] = useState(false);

  const [adjust, setAdjust] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: '', reason: '' });

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
  }, [search]);

  useEffect(() => {
    if (!isFocused) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, isFocused]);

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

  function validate() {
    const fe = {};
    if (!form.name.trim()) fe.name = 'Name is required';
    if (form.price === '' || Number(form.price) < 0) fe.price = 'Enter a valid price';
    if (form.stockQty !== '' && Number(form.stockQty) < 0) fe.stockQty = 'Stock cannot be negative';
    setFormErr(fe);
    return Object.keys(fe).length === 0;
  }

  async function save() {
    if (!validate()) return;
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
    } catch (e) {
      setFormErr({ form: extractError(e).message });
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(p) {
    Alert.alert('Remove product?', `"${p.name}" will be deactivated and blocked from selling.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/products/${p.id}`);
            toast.success('Product removed');
            await load();
          } catch (e) {
            toast.error(extractError(e).message);
          }
        },
      },
    ]);
  }

  function openAdjust(p) {
    setAdjust(p);
    setAdjustForm({ quantity: '', reason: '' });
  }
  async function saveAdjust() {
    if (adjustForm.quantity === '' || Number(adjustForm.quantity) === 0) return;
    if (!adjustForm.reason.trim()) return toast.error('A reason is required');
    try {
      await client.patch(`/products/${adjust.id}/stock`, {
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
      });
      toast.success('Stock adjusted');
      setAdjust(null);
      await load();
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="Products" notificationsPath="Notifications" />
      <View className="flex-row items-center bg-white border border-gray300 rounded-xl px-3 mx-4 mt-4">
        <Search size={16} color="#A3A3A3" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products"
          className="flex-1 ml-2 py-3 text-sm text-ink"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Button icon={Plus} className="mb-4" onPress={openNew}>
          Add Product
        </Button>

        {loading ? (
          <SkeletonList rows={4} />
        ) : products.length === 0 ? (
          <View className="items-center py-12 border border-dashed border-gray300 rounded-xl bg-white">
            <Plus size={30} color="#A3A3A3" />
            <Text className="mt-3 text-sm font-semibold text-ink">No products yet</Text>
            <Text className="text-xs text-gray500 mt-1">Add your first product to start selling.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {products.map((p) => (
              <View key={String(p.id)} className={`bg-white border rounded-xl p-4 ${p.isActive ? 'border-gray200' : 'border-gray200 opacity-60'}`}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-sm font-semibold text-ink">{p.name}</Text>
                      {p.isLow && p.isActive ? <Badge status="low">Low</Badge> : null}
                      {!p.isActive ? <Badge status="declined">Inactive</Badge> : null}
                    </View>
                    <Text className="text-xs text-gray500 mt-1">
                      {formatMoney(p.price)} · stock {p.stockQty} {p.unit} · reorder {p.reorderLevel}
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-1 mt-3 justify-end">
                  <Pressable onPress={() => openAdjust(p)} className="p-2 rounded-lg active:bg-gray100">
                    <SlidersHorizontal size={16} color="#525252" />
                  </Pressable>
                  <Pressable onPress={() => openEdit(p)} className="p-2 rounded-lg active:bg-gray100">
                    <Pencil size={16} color="#525252" />
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(p)} className="p-2 rounded-lg active:bg-gray100">
                    <Trash2 size={16} color="#525252" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add / Edit modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5 max-h-[90%]">
            <Text className="text-base font-semibold text-ink mb-4">
              {editing === 'new' ? 'Add Product' : 'Edit Product'}
            </Text>
            <ScrollView>
              <Input label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} error={formErr.name} />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Code" value={form.productCode} onChangeText={(v) => setForm({ ...form, productCode: v })} />
                </View>
                <View className="flex-1">
                  <Input label="Category" value={form.category} onChangeText={(v) => setForm({ ...form, category: v })} />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Price" keyboardType="numeric" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} error={formErr.price} />
                </View>
                <View className="flex-1">
                  <Input label="Cost" keyboardType="numeric" value={form.cost} onChangeText={(v) => setForm({ ...form, cost: v })} />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Unit" value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} />
                </View>
                <View className="flex-1">
                  <Input label="Stock" keyboardType="numeric" value={form.stockQty} onChangeText={(v) => setForm({ ...form, stockQty: v })} error={formErr.stockQty} />
                </View>
                <View className="flex-1">
                  <Input label="Reorder" keyboardType="numeric" value={form.reorderLevel} onChangeText={(v) => setForm({ ...form, reorderLevel: v })} />
                </View>
              </View>
            </ScrollView>
            <View className="flex-row gap-2 mt-3">
              <Button variant="secondary" className="flex-1" onPress={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button className="flex-1" onPress={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Adjust modal */}
      <Modal visible={!!adjust} transparent animationType="slide" onRequestClose={() => setAdjust(null)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5">
            <Text className="text-base font-semibold text-ink mb-1">Adjust stock</Text>
            <Text className="text-xs text-gray500 mb-4">Current: {adjust?.stockQty}. Positive adds, negative reduces.</Text>
            <Input label="Adjustment quantity" keyboardType="numeric" value={adjustForm.quantity} onChangeText={(v) => setAdjustForm({ ...adjustForm, quantity: v })} />
            <Input label="Reason" value={adjustForm.reason} onChangeText={(v) => setAdjustForm({ ...adjustForm, reason: v })} />
            <View className="flex-row gap-2 mt-2">
              <Button variant="secondary" className="flex-1" onPress={() => setAdjust(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onPress={saveAdjust}>
                Apply
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
