import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Modal, TextInput } from 'react-native';
import { Check, AlertTriangle, RefreshCw, Clock } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import Button from '../../components/Button.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';

export default function RestockDetailScreen({ route, navigation }) {
  const toast = useToast();
  const id = route.params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState(null); // 'verify' | 'discrepancy'
  const [received, setReceived] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function openMode(m) {
    setMode(m);
    setNote('');
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
        items: data.items.map((it) => ({ itemId: it.id, quantityReceived: Number(received[it.id] || 0) })),
      });
      toast.success('Verified, inventory updated');
      setMode(null);
      load();
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDiscrepancy() {
    if (!note.trim()) return toast.error('A note is required');
    setBusy(true);
    try {
      await client.post(`/restock/${id}/discrepancy`, {
        items: data.items.map((it) => ({ itemId: it.id, quantityReceived: Number(received[it.id] || 0) })),
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
    try {
      const res = await client.get('/suppliers/linked');
      setSuppliers(res.data.suppliers);
      setResendSupplier('');
      setResendOpen(true);
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  async function submitResend() {
    if (!resendSupplier) return toast.error('Choose a supplier');
    setBusy(true);
    try {
      const res = await client.post(`/restock/${id}/resend`, { supplierId: Number(resendSupplier) });
      toast.success('Request resent');
      setResendOpen(false);
      navigation.replace('RestockDetail', { id: res.data.id });
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-gray100 p-4">
        <SkeletonList rows={4} />
      </View>
    );
  }
  if (!data) return null;

  const canVerify = data.status === 'delivered';
  const canResend = data.status === 'declined';

  return (
    <ScrollView className="flex-1 bg-gray100" contentContainerStyle={{ padding: 16 }}>
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-base font-semibold text-ink">Request #{data.id}</Text>
        <Badge status={data.status} />
      </View>

      <View className="bg-white border border-gray200 rounded-xl p-4 mb-3">
        <Row label="Store Owner" value={data.storeOwner.name} />
        <Row label="Supplier" value={data.supplier.name} />
        <Row label="Created" value={data.createdAt} />
        {data.note ? <Row label="Note" value={data.note} /> : null}
        {data.declineReason ? <Row label="Declined reason" value={data.declineReason} /> : null}
      </View>

      <View className="bg-white border border-gray200 rounded-xl mb-3">
        <Text className="px-4 py-2 text-xs font-medium text-gray600">Items</Text>
        {data.items.map((it, i) => (
          <View key={String(it.id)} className={`px-4 py-3 ${i > 0 ? 'border-t border-gray200' : ''}`}>
            <Text className="text-sm font-medium text-ink">{it.name}</Text>
            <Text className="text-xs text-gray600 mt-1">
              Req {it.quantityRequested} · Del {it.quantityDelivered ?? '—'} · Rec {it.quantityReceived ?? '—'}
            </Text>
          </View>
        ))}
      </View>

      {canVerify ? (
        <View className="bg-white border-2 border-black rounded-xl p-4 mb-3">
          <Text className="text-sm font-semibold text-ink mb-1">Store verifies delivery?</Text>
          <Text className="text-xs text-gray600 mb-3">
            Enter quantity received per item. If every item matches delivered, confirm. Otherwise report a discrepancy.
          </Text>
          <View className="flex-row gap-2">
            <Button icon={Check} onPress={() => openMode('verify')} className="flex-1">
              Verify
            </Button>
            <Button variant="secondary" icon={AlertTriangle} onPress={() => openMode('discrepancy')} className="flex-1">
              Discrepancy
            </Button>
          </View>
        </View>
      ) : null}

      {canResend ? (
        <Button variant="secondary" icon={RefreshCw} onPress={openResend}>
          Resend to another supplier
        </Button>
      ) : null}

      <View className="bg-white border border-gray200 rounded-xl p-4 mt-3">
        <Text className="text-xs font-medium text-gray600 mb-3">History</Text>
        {data.events.map((e) => (
          <View key={String(e.id)} className="flex-row gap-2 mb-3">
            <Clock size={14} color="#A3A3A3" />
            <View className="flex-1">
              <Text className="text-sm text-ink">
                {e.actorName} · {e.eventType}
              </Text>
              {e.message ? <Text className="text-xs text-gray500">{e.message}</Text> : null}
              <Text className="text-[11px] text-gray400">{e.createdAt}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Verify / Discrepancy modal */}
      <Modal visible={!!mode} transparent animationType="slide" onRequestClose={() => setMode(null)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5 max-h-[85%]">
            <Text className="text-base font-semibold text-ink mb-3">
              {mode === 'verify' ? 'Verify received quantities' : 'Report discrepancy'}
            </Text>
            <ScrollView>
              {data.items.map((it) => (
                <View key={String(it.id)} className="flex-row items-center justify-between py-2">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm text-ink">{it.name}</Text>
                    <Text className="text-xs text-gray500">Delivered: {it.quantityDelivered ?? it.quantityRequested}</Text>
                  </View>
                  <TextInput
                    keyboardType="numeric"
                    value={String(received[it.id] ?? 0)}
                    onChangeText={(v) => setReceived((prev) => ({ ...prev, [it.id]: Number(v) }))}
                    className="w-20 px-3 py-2 rounded-xl border border-gray300 text-center text-sm bg-white"
                  />
                </View>
              ))}
              {mode === 'discrepancy' ? (
                <TextInput
                  multiline
                  value={note}
                  onChangeText={setNote}
                  placeholder="Describe the problem (required)"
                  className="mt-3 px-3 py-3 rounded-xl border border-gray300 text-sm bg-white min-h-[80px]"
                  textAlignVertical="top"
                />
              ) : null}
            </ScrollView>
            <View className="flex-row gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onPress={() => setMode(null)} disabled={busy}>
                Cancel
              </Button>
              <Button className="flex-1" onPress={mode === 'verify' ? submitVerify : submitDiscrepancy} disabled={busy}>
                {busy ? 'Working…' : mode === 'verify' ? 'Confirm' : 'Report'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Resend modal */}
      <Modal visible={resendOpen} transparent animationType="slide" onRequestClose={() => setResendOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5">
            <Text className="text-base font-semibold text-ink mb-3">Resend to another supplier</Text>
            {suppliers.map((s) => (
              <Button
                key={String(s.id)}
                variant={resendSupplier === String(s.id) ? 'primary' : 'secondary'}
                className="mb-2"
                onPress={() => setResendSupplier(String(s.id))}
              >
                {s.name}
              </Button>
            ))}
            <View className="flex-row gap-2 mt-2">
              <Button variant="secondary" className="flex-1" onPress={() => setResendOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button className="flex-1" onPress={submitResend} disabled={busy}>
                Resend
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-gray500">{label}</Text>
      <Text className="text-sm text-ink flex-1 text-right ml-3">{value}</Text>
    </View>
  );
}
