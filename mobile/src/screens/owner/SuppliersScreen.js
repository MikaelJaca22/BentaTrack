import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Alert } from 'react-native';
import { Search, UserPlus, Trash2, Users } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { useToast } from '../../components/Toast.js';
import Button from '../../components/Button.js';
import { SkeletonList } from '../../components/Skeleton.js';

export default function SuppliersScreen() {
  const toast = useToast();
  const [linked, setLinked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const loadLinked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/suppliers/linked');
      setLinked(res.data.suppliers);
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinked();
  }, [loadLinked]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await client.get(`/suppliers/search?q=${encodeURIComponent(term)}`);
        const linkedIds = new Set(linked.map((l) => l.id));
        setResults(res.data.suppliers.filter((s) => !linkedIds.has(s.id)));
      } catch (e) {
        toast.error(extractError(e).message);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, linked]);

  async function link(supplierId) {
    try {
      await client.post('/suppliers/link', { supplierId });
      toast.success('Supplier linked');
      setQ('');
      setResults([]);
      await loadLinked();
    } catch (e) {
      toast.error(extractError(e).message);
    }
  }

  function confirmUnlink(s) {
    Alert.alert('Unlink supplier?', `Unlink "${s.name}" from your store?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/suppliers/link/${s.id}`);
            toast.success('Supplier unlinked');
            await loadLinked();
          } catch (e) {
            toast.error(extractError(e).message);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-gray100" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-sm font-semibold text-ink mb-2">Linked Suppliers</Text>
      {loading ? (
        <SkeletonList rows={2} />
      ) : linked.length === 0 ? (
        <View className="flex-row items-center gap-2 py-6 border border-dashed border-gray300 rounded-xl bg-white justify-center">
          <Users size={22} color="#A3A3A3" />
          <Text className="text-sm font-semibold text-ink">No linked suppliers</Text>
        </View>
      ) : (
        <View className="bg-white border border-gray200 rounded-xl overflow-hidden mb-5">
          {linked.map((s, i) => (
            <View key={String(s.id)} className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray200' : ''}`}>
              <View>
                <Text className="text-sm font-medium text-ink">{s.name}</Text>
                <Text className="text-xs text-gray500">@{s.username}</Text>
              </View>
              <Pressable onPress={() => confirmUnlink(s)} className="p-2">
                <Trash2 size={16} color="#525252" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text className="text-sm font-semibold text-ink mb-2">Register Supplier (find an account)</Text>
      <View className="flex-row items-center bg-white border border-gray300 rounded-xl px-3 mb-3">
        <Search size={16} color="#A3A3A3" />
        <TextInput value={q} onChangeText={setQ} placeholder="Search by name or username" className="flex-1 ml-2 py-3 text-sm text-ink" />
      </View>
      <Text className="text-xs text-gray500 mb-3">
        Only suppliers who created their own accounts can be linked. There are no preloaded suppliers.
      </Text>

      {searching ? (
        <SkeletonList rows={2} />
      ) : q.trim() === '' ? null : results.length === 0 ? (
        <Text className="text-sm text-gray500">No matching suppliers found.</Text>
      ) : (
        <View className="bg-white border border-gray200 rounded-xl overflow-hidden">
          {results.map((s, i) => (
            <View key={String(s.id)} className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-gray200' : ''}`}>
              <View className="flex-1 pr-2">
                <Text className="text-sm font-medium text-ink">{s.name}</Text>
                <Text className="text-xs text-gray500">@{s.username}</Text>
              </View>
              <Button variant="secondary" icon={UserPlus} onPress={() => link(s.id)}>
                Link
              </Button>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
