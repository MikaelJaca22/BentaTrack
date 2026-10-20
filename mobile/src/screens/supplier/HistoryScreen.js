import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { History as HistoryIcon } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';
import TopHeader from '../../components/TopHeader.js';

export default function HistoryScreen() {
  const toast = useToast();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Each status is fetched separately. Filtering one /restock page would hide
      // completed requests whenever 50 newer requests of other statuses pushed
      // them off the first page.
      const [done, declined] = await Promise.all([
        client.get('/restock?status=completed&limit=200'),
        client.get('/restock?status=declined&limit=200'),
      ]);
      setRows(
        [...done.data.requests, ...declined.data.requests].sort((a, b) =>
          String(b.updatedAt).localeCompare(String(a.updatedAt))
        )
      );
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [load, isFocused]);

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="History" notificationsPath="Alerts" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <SkeletonList rows={4} />
        ) : rows.length === 0 ? (
          <View className="items-center justify-center py-16 px-6 border border-dashed border-gray300 rounded-xl bg-white">
            <HistoryIcon size={32} color="#A3A3A3" style={{ marginBottom: 12 }} />
            <Text className="text-sm font-semibold text-ink">No history yet</Text>
            <Text className="mt-1 text-xs text-gray500 text-center">
              Completed and declined requests will appear here.
            </Text>
          </View>
        ) : (
          <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
            {rows.map((r, i) => (
              <Pressable
                key={String(r.id)}
                onPress={() => navigation.navigate('RequestDetail', { id: r.id })}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  i > 0 ? 'border-t border-gray200' : ''
                } active:bg-gray100`}
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-medium text-ink">Request #{r.id}</Text>
                  <Text className="text-xs text-gray500">
                    {r.itemCount} item(s) · {r.counterpart} · {r.updatedAt}
                  </Text>
                </View>
                <Badge status={r.status} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
