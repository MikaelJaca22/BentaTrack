import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Modal, TextInput } from 'react-native';
import { Check, X, Truck, Clock, AlertTriangle } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import Button from '../../components/Button.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';

export default function RequestDetailScreen({ route, navigation }) {
  const toast = useToast();
  const id = route.params.id;
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
  }, [id]);

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
      <View className="flex-1 bg-gray100 p-4">
        <SkeletonList rows={4} />
      </View>
    );
  }
  if (!data) return null;

  const canAct = data.status === 'pending';
  const canDeliver = data.status === 'accepted' || data.status === 'discrepancy';

  return (
    <ScrollView className="flex-1 bg-gray100" contentContainerStyle={{ padding: 16 }}>
      <View className="flex-row items-center gap-2 mb-3">
        <Text className="text-base font-semibold text-ink">Request #{data.id}</Text>
        <Badge status={data.status} />
      </View>

      <View className="bg-white border border-gray200 rounded-xl p-4 mb-3">
        <Row label="Store Owner" value={data.storeOwner.name} />
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

      {data.status === 'discrepancy' ? (
        <View className="bg-white border-2 border-black rounded-xl p-4 mb-3">
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={16} color="#0A0A0A" />
            <Text className="text-sm font-semibold text-ink">Output: report discrepancy</Text>
          </View>
          <Text className="mt-1 text-xs text-gray600">
            The store reported a discrepancy. Review the received quantities below and re-deliver.
          </Text>
          {data.items.map((it) => (
            <Text key={String(it.id)} className="text-xs text-gray600 mt-1">
              {it.name}: delivered {it.quantityDelivered ?? '—'}, received {it.quantityReceived ?? '—'}
            </Text>
          ))}
        </View>
      ) : null}

      {canAct ? (
        <View className="bg-white border-2 border-black rounded-xl p-4 mb-3">
          <Text className="text-sm font-semibold text-ink mb-3">Can fulfil this request?</Text>
          <View className="flex-row gap-2">
            <Button icon={Check} onPress={accept} disabled={busy} className="flex-1">
              Accept
            </Button>
            <Button variant="secondary" icon={X} onPress={() => setDeclineOpen(true)} disabled={busy} className="flex-1">
              Decline
            </Button>
          </View>
        </View>
      ) : null}

      {canDeliver ? (
        <View className="mb-3">
          <Button icon={Truck} onPress={openDeliver} disabled={busy}>
            Prepare and deliver goods
          </Button>
        </View>
      ) : null}

      <View className="bg-white border border-gray200 rounded-xl p-4">
        <Text className="text-xs font-medium text-gray600 mb-3">History</Text>
        {data.events.map((e) => (
          <View key={String(e.id)} className="flex-row gap-2 mb-3">
            <Clock size={14} color="#A3A3A3" />
            <View className="flex-1">
              <Text className="text-sm text-ink">{e.actorName} · {e.eventType}</Text>
              {e.message ? <Text className="text-xs text-gray500">{e.message}</Text> : null}
              <Text className="text-[11px] text-gray400">{e.createdAt}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Decline modal */}
      <Modal visible={declineOpen} transparent animationType="slide" onRequestClose={() => setDeclineOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5">
            <Text className="text-base font-semibold text-ink mb-3">Decline request</Text>
            <TextInput
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Reason (required) — why you cannot fulfil this request"
              className="px-3 py-3 rounded-xl border border-gray300 text-sm bg-white min-h-[80px]"
              textAlignVertical="top"
              placeholderTextColor="#A3A3A3"
            />
            <View className="flex-row gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onPress={() => setDeclineOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="secondary" icon={X} className="flex-1" onPress={decline} disabled={busy}>
                {busy ? 'Declining…' : 'Decline'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deliver modal */}
      <Modal visible={deliverOpen} transparent animationType="slide" onRequestClose={() => setDeliverOpen(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-xl p-5 max-h-[85%]">
            <Text className="text-base font-semibold text-ink mb-3">Enter delivered quantities</Text>
            <ScrollView>
              {data.items.map((it) => (
                <View key={String(it.id)} className="flex-row items-center justify-between py-2">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm text-ink">{it.name}</Text>
                    <Text className="text-xs text-gray500">Requested: {it.quantityRequested}</Text>
                  </View>
                  <TextInput
                    keyboardType="numeric"
                    value={String(delivered[it.id] ?? 0)}
                    onChangeText={(v) => setDelivered((prev) => ({ ...prev, [it.id]: Number(v) }))}
                    className="w-20 px-3 py-2 rounded-xl border border-gray300 text-center text-sm bg-white"
                  />
                </View>
              ))}
            </ScrollView>
            <View className="flex-row gap-2 mt-4">
              <Button variant="secondary" className="flex-1" onPress={() => setDeliverOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button icon={Truck} className="flex-1" onPress={submitDeliver} disabled={busy}>
                {busy ? 'Saving…' : 'Mark Delivered'}
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
