import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Inbox, CheckCircle2, Truck, ArrowRight } from 'lucide-react-native';
import client from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import { SkeletonList } from '../../components/Skeleton.js';
import TopHeader from '../../components/TopHeader.js';
import Badge from '../../components/Badge.js';

export default function SupplierDashboardScreen() {
  const toast = useToast();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, accepted: 0, delivered: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (!isFocused) return;
    async function load() {
      setLoading(true);
      try {
        // Counts come from the server: filtering one page of /restock would
      // under-report once a supplier has more than 50 requests. limit=1 is
      // enough because pagination.total counts every matching row.
      const countFor = async (status) => {
        const res = await client.get(`/restock?status=${status}&limit=1`);
        return res.data.pagination.total;
      };
      const [pending, accepted, delivered, all] = await Promise.all([
        countFor('pending'),
        countFor('accepted'),
        countFor('delivered'),
        client.get('/restock?limit=6'),
      ]);
      setCounts({ pending, accepted, delivered });
      setRecent(all.data.requests);
      } catch (e) {
        toast.error('Could not load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isFocused]);

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="Dashboard" notificationsPath="Alerts" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <View className="flex-row gap-3 mb-5">
              <Stat icon={Inbox} label="Pending" value={counts.pending} />
              <Stat icon={CheckCircle2} label="Accepted" value={counts.accepted} />
              <Stat icon={Truck} label="Awaiting verify" value={counts.delivered} />
            </View>

            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-ink">Recent Requests</Text>
              <Pressable
                onPress={() => navigation.navigate('Requests')}
                className="flex-row items-center gap-1"
              >
                <Text className="text-xs font-medium text-gray600">All requests</Text>
                <ArrowRight size={14} color="#525252" />
              </Pressable>
            </View>

            {recent.length === 0 ? (
              <View className="items-center justify-center py-12 px-6 border border-dashed border-gray300 rounded-xl bg-white">
                <Inbox size={30} color="#A3A3A3" style={{ marginBottom: 12 }} />
                <Text className="text-sm font-semibold text-ink">No requests yet</Text>
                <Text className="text-xs text-gray500 text-center">
                  Restock requests from store owners will appear here.
                </Text>
              </View>
            ) : (
              <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
                {recent.map((r, i) => (
                  <Pressable
                    key={String(r.id)}
                    onPress={() => navigation.navigate('RequestDetail', { id: r.id })}
                    className={`flex-row items-center justify-between px-4 py-3 ${
                      i > 0 ? 'border-t border-gray200' : ''
                    } active:bg-gray100`}
                  >
                    <View>
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <View className="flex-1 bg-white border border-gray200 rounded-xl p-4">
      <View className="flex-row items-center gap-2">
        <Icon size={15} color="#525252" />
        <Text className="text-[11px] font-medium text-gray600">{label}</Text>
      </View>
      <Text className="mt-1.5 text-2xl font-bold text-ink">{value}</Text>
    </View>
  );
}
