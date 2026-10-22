import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Bell, CheckCheck, Package, Trash2, Truck } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import Button from '../../components/Button.js';
import { SkeletonList } from '../../components/Skeleton.js';
import TopHeader from '../../components/TopHeader.js';

const TYPE_ICON = {
  low_stock: Package,
  restock_new: Truck,
  restock_accepted: Truck,
  restock_delivered: Truck,
  restock_completed: Truck,
  restock_declined: Truck,
  restock_discrepancy: Truck,
};

export default function SupplierNotificationsScreen() {
  const toast = useToast();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    client
      // limit=200 is the server maximum.
      .get('/notifications?limit=200')
      .then((res) => setItems(res.data.notifications))
      .catch((e) => toast.error(extractError(e).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [load, isFocused]);

  async function markRead(n) {
    try {
      await client.patch(`/notifications/${n.id}/read`);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      if (n.referenceType === 'restock_request') {
        navigation.navigate('RequestDetail', { id: n.referenceId });
      }
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  async function markAll() {
    try {
      await client.patch('/notifications/read-all');
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      toast.success('All marked read');
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  async function clearAll() {
    try {
      await client.delete('/notifications');
      setItems([]);
      toast.success('Notifications cleared');
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="Alerts" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            {items.length > 0 ? (
              <View className="flex-row justify-end gap-2 mb-3">
                {items.some((n) => !n.isRead) ? (
                  <Button variant="secondary" icon={CheckCheck} onPress={markAll}>
                    Mark all read
                  </Button>
                ) : null}
                <Button variant="secondary" icon={Trash2} onPress={clearAll}>
                  Clear notifications
                </Button>
              </View>
            ) : null}

            {items.length === 0 ? (
              <View className="items-center justify-center py-16 px-6 border border-dashed border-gray300 rounded-xl bg-white">
                <Bell size={32} color="#A3A3A3" style={{ marginBottom: 12 }} />
                <Text className="text-sm font-semibold text-ink">No notifications</Text>
                <Text className="mt-1 text-xs text-gray500 text-center">
                  Restock updates from store owners will appear here.
                </Text>
              </View>
            ) : (
              <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
                {items.map((n, i) => {
                  const Icon = TYPE_ICON[n.type] || Bell;
                  return (
                    <Pressable
                      key={String(n.id)}
                      onPress={() => {
                      if (!n.isRead) markRead(n);
                      else if (n.referenceType === 'restock_request') {
                        navigation.navigate('RequestDetail', { id: n.referenceId });
                      }
                    }}
                      className={`flex-row gap-3 px-4 py-3 ${
                        i > 0 ? 'border-t border-gray200' : ''
                      } ${n.isRead ? 'opacity-60' : 'active:bg-gray100'}`}
                    >
                      <Icon size={18} color="#525252" style={{ marginTop: 2 }} />
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-medium text-ink flex-1">{n.title}</Text>
                          {!n.isRead ? <View className="w-2 h-2 rounded-full bg-black" /> : null}
                        </View>
                        <Text className="text-xs text-gray600 mt-0.5">{n.body}</Text>
                        <Text className="text-[11px] text-gray400 mt-0.5">{n.createdAt}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
