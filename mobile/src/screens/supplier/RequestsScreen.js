import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Inbox } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';
import TopHeader from '../../components/TopHeader.js';

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'discrepancy', label: 'Discrepancy' },
];

export default function RequestsScreen() {
  const toast = useToast();
  const navigation = useNavigation();
  const [filter, setFilter] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}&limit=200` : '?limit=200';
      const res = await client.get(`/restock${q}`);
      setRequests(res.data.requests);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="Requests" notificationsPath="Alerts" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row flex-wrap gap-1.5 mb-4">
          {FILTERS.map((f) => (
            <Pressable
              key={f.id || 'all'}
              onPress={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg border ${
                filter === f.id ? 'bg-black border-black' : 'bg-white border-gray300'
              }`}
            >
              <Text className={`text-xs font-medium ${filter === f.id ? 'text-white' : 'text-gray600'}`}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <SkeletonList rows={4} />
        ) : requests.length === 0 ? (
          <View className="items-center justify-center py-16 px-6 border border-dashed border-gray300 rounded-xl bg-white">
            <Inbox size={32} color="#A3A3A3" style={{ marginBottom: 12 }} />
            <Text className="text-sm font-semibold text-ink">No requests</Text>
            <Text className="mt-1 text-xs text-gray500 text-center">
              There are no requests matching this filter.
            </Text>
          </View>
        ) : (
          <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
            {requests.map((r, i) => (
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
                    {r.itemCount} item(s) · {r.counterpart} · {r.createdAt}
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
