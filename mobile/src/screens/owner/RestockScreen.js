import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Plus, Truck, X, Minus, Search } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import TopHeader from '../../components/TopHeader.js';
import Button from '../../components/Button.js';
import Input from '../../components/Input.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';

// Stable identity so CreateRequest's effect does not reset its form on every
// parent render when no products were preselected.
const EMPTY_IDS = [];

export default function RestockScreen({ route }) {
  const toast = useToast();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const opened = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // limit=200 is the server maximum, so long request histories are not
      // silently truncated at the default 50.
      const res = await client.get('/restock?limit=200');
      setRequests(res.data.requests);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [load, isFocused]);

  // Open create modal when arriving from the low-stock alert.
  useEffect(() => {
    if (route.params?.create && !opened.current) {
      opened.current = true;
      setCreating(true);
    }
  }, [route.params]);

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="Restock" notificationsPath="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Button icon={Plus} className="mb-4" onPress={() => setCreating(true)}>
          New Request
        </Button>

        {loading ? (
          <SkeletonList rows={3} />
        ) : requests.length === 0 ? (
          <View className="items-center py-12 border border-dashed border-gray300 rounded-xl bg-white">
            <Truck size={30} color="#A3A3A3" />
            <Text className="mt-3 text-sm font-semibold text-ink">No restock requests yet</Text>
            <Text className="text-xs text-gray500 mt-1">Create a request to send to a supplier.</Text>
          </View>
        ) : (
          <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
            {requests.map((r, i) => (
              <Pressable
                key={String(r.id)}
                onPress={() => navigation.navigate('RestockDetail', { id: r.id })}
                className={`flex-row items-center justify-between px-4 py-3 active:bg-gray100 ${
                  i > 0 ? 'border-t border-gray200' : ''
                }`}
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-medium text-ink">Request #{r.id}</Text>
                  <Text className="text-xs text-gray500">
                    {r.itemCount} item(s) · {r.counterpart}
                  </Text>
                </View>
                <Badge status={r.status} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <CreateRequest
        visible={creating}
        preselect={route.params?.preselect || EMPTY_IDS}
        onClose={() => {
          setCreating(false);
          opened.current = false;
        }}
        onCreated={() => {
          setCreating(false);
          opened.current = false;
          load();
        }}
      />
    </View>
  );
}

function CreateRequest({ visible, onClose, onCreated, preselect }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pq, setPq] = useState('');

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const [s, p] = await Promise.all([
          client.get('/suppliers/linked'),
          client.get('/products'),
        ]);
        setSuppliers(s.data.suppliers);
        const list = p.data.products.filter((x) => x.isActive);
        setProducts(list);
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
  }, [visible, preselect]);

  function addLine(p) {
    if (lines.find((l) => l.productId === p.id)) return;
    setLines((prev) => [...prev, { productId: p.id, name: p.name, quantity: 1 }]);
  }
  function setQty(id, q) {
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, quantity: Math.max(1, Number(q) || 1) } : l)));
  }

  async function submit() {
    setErr('');
    if (!supplierId) return setErr('Choose a supplier');
    if (lines.length === 0) return setErr('Add at least one product');
    setBusy(true);
    try {
      await client.post('/restock', {
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

  const filtered = products
    .filter((p) => !lines.find((l) => l.productId === p.id))
    .filter(
      (p) =>
        p.name.toLowerCase().includes(pq.toLowerCase()) ||
        (p.productCode || '').toLowerCase().includes(pq.toLowerCase())
    )
    .slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-white rounded-t-xl p-5 max-h-[92%]">
          <Text className="text-base font-semibold text-ink mb-4">Create Restock Request</Text>
          <ScrollView>
            {suppliers.length === 0 ? (
              <Text className="text-sm text-gray600 mb-3">
                No suppliers linked yet. Link one from the Suppliers screen first.
              </Text>
            ) : (
              <View className="mb-3">
                <Text className="mb-1.5 text-sm font-medium text-ink">Supplier</Text>
                {suppliers.map((s) => (
                  <Pressable
                    key={String(s.id)}
                    onPress={() => setSupplierId(String(s.id))}
                    className={`flex-row items-center justify-between px-3 py-3 rounded-xl border mb-2 ${
                      supplierId === String(s.id) ? 'bg-black border-black' : 'bg-white border-gray300'
                    }`}
                  >
                    <Text className={supplierId === String(s.id) ? 'text-white text-sm' : 'text-ink text-sm'}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text className="mb-1.5 text-sm font-medium text-ink">Add products</Text>
            <View className="flex-row items-center bg-white border border-gray300 rounded-xl px-3 mb-2">
              <Search size={16} color="#A3A3A3" />
              <TextInput value={pq} onChangeText={setPq} placeholder="Search product" className="flex-1 ml-2 py-2.5 text-sm text-ink" />
            </View>
            {filtered.map((p) => (
              <Pressable key={String(p.id)} onPress={() => addLine(p)} className="flex-row justify-between px-3 py-2.5 rounded-lg border border-gray200 mb-1.5">
                <Text className="text-sm text-ink">{p.name}</Text>
                <Text className="text-xs text-gray500">stock {p.stockQty}</Text>
              </Pressable>
            ))}

            {lines.length > 0 && (
              <View className="mt-3">
                <Text className="text-xs font-medium text-gray600 mb-2">Items</Text>
                {lines.map((l) => (
                  <View key={String(l.productId)} className="flex-row items-center justify-between py-2">
                    <Text className="flex-1 text-sm text-ink">{l.name}</Text>
                    <Pressable onPress={() => setQty(l.productId, l.quantity - 1)} className="p-2 rounded-lg border border-gray300">
                      <Minus size={14} color="#000000" />
                    </Pressable>
                    <Text className="w-10 text-center text-sm">{l.quantity}</Text>
                    <Pressable onPress={() => setQty(l.productId, l.quantity + 1)} className="p-2 rounded-lg border border-gray300">
                      <Plus size={14} color="#000000" />
                    </Pressable>
                    <Pressable onPress={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))} className="p-2 ml-1">
                      <X size={16} color="#525252" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <View className="mt-3">
              <Input label="Note (optional)" value={note} onChangeText={setNote} />
            </View>
            {err ? <Text className="text-xs font-medium text-black mb-2">{err}</Text> : null}
          </ScrollView>
          <View className="flex-row gap-2 mt-3">
            <Button variant="secondary" className="flex-1" onPress={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button className="flex-1" onPress={submit} disabled={busy || suppliers.length === 0}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
