import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingCart, AlertTriangle, Truck, Receipt as ReceiptIcon, Plus } from 'lucide-react-native';
import client from '../../api/client.js';
import { formatMoney } from '../../config.js';
import { useToast } from '../../components/Toast.js';
import { SkeletonList } from '../../components/Skeleton.js';
import TopHeader from '../../components/TopHeader.js';
import Badge from '../../components/Badge.js';

export default function DashboardScreen() {
  const toast = useToast();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ todaySales: 0, todayCount: 0, lowStock: 0, pending: 0 });
  const [receipts, setReceipts] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [prod, sales, restock] = await Promise.all([
          client.get('/products?lowStock=true'),
          client.get(`/sales?from=${today}&to=${today}`),
          client.get('/restock?status=pending'),
        ]);
        const todayTotal = sales.data.sales.reduce((s, x) => s + x.total, 0);
        setStats({
          todaySales: todayTotal,
          todayCount: sales.data.sales.length,
          lowStock: prod.data.products.length,
          pending: restock.data.requests.length,
        });
        const all = await client.get('/sales');
        setReceipts(all.data.sales.slice(0, 6));
      } catch (e) {
        toast.error('Could not load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <View className="flex-1 bg-gray100">
      <TopHeader title="Dashboard" notificationsPath="Notifications" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {loading ? (
          <SkeletonList rows={4} />
        ) : (
          <>
            <View className="flex-row flex-wrap gap-3 mb-5">
              <Stat icon={ShoppingCart} label="Today's Sales" value={formatMoney(stats.todaySales)} sub={`${stats.todayCount} txns`} />
              <Stat icon={AlertTriangle} label="Low Stock" value={String(stats.lowStock)} sub="to reorder" />
              <Stat icon={Truck} label="Pending" value={String(stats.pending)} sub="requests" />
              <Pressable
                onPress={() => navigation.getParent()?.navigate('Sale') || navigation.navigate('Tabs')}
                className="bg-black rounded-xl p-4 flex-1 min-w-[45%] justify-center"
              >
                <Plus size={18} color="#FFFFFF" />
                <Text className="mt-2 text-white text-base font-bold">New Sale</Text>
              </Pressable>
            </View>

            <Text className="text-sm font-semibold text-ink mb-2">Recent Receipts</Text>
            {receipts.length === 0 ? (
              <View className="items-center justify-center py-12 border border-dashed border-gray300 rounded-xl bg-white">
                <ReceiptIcon size={30} color="#A3A3A3" />
                <Text className="mt-3 text-sm font-semibold text-ink">No sales recorded yet</Text>
                <Text className="text-xs text-gray500 mt-1">Record a cash sale to see receipts here.</Text>
              </View>
            ) : (
              <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
                {receipts.map((r, i) => (
                  <Pressable
                    key={String(r.id)}
                    onPress={() => navigation.navigate('Receipt', { id: r.id })}
                    className={`flex-row items-center justify-between px-4 py-3 ${
                      i > 0 ? 'border-t border-gray200' : ''
                    } active:bg-gray100`}
                  >
                    <View>
                      <Text className="text-sm font-medium text-ink">{r.receiptNo}</Text>
                      <Text className="text-xs text-gray500">{r.createdAt}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm font-semibold text-ink">{formatMoney(r.total)}</Text>
                      <Badge status="completed">Paid</Badge>
                    </View>
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

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <View className="bg-white border border-gray200 rounded-xl p-4 flex-1 min-w-[45%]">
      <View className="flex-row items-center gap-2">
        <Icon size={16} color="#525252" />
        <Text className="text-xs font-medium text-gray600">{label}</Text>
      </View>
      <Text className="mt-2 text-xl font-bold text-ink" numberOfLines={1}>{value}</Text>
      <Text className="text-xs text-gray500">{sub}</Text>
    </View>
  );
}
