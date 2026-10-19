import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { BarChart3, Package, Truck, Printer, Share2, Download } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { formatMoney, SYSTEM_TITLE } from '../../config.js';
import { useToast } from '../../components/Toast.js';
import Badge from '../../components/Badge.js';
import { SkeletonList } from '../../components/Skeleton.js';

const TABS = [
  { id: 'sales', label: 'Sales', icon: BarChart3 },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'restock', label: 'Restock', icon: Truck },
];

function rangeForPreset(preset) {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (preset === 'today') return { from: to, to };
  const d = new Date(today);
  if (preset === '7d') d.setDate(d.getDate() - 6);
  if (preset === '30d') d.setDate(d.getDate() - 29);
  return { from: d.toISOString().slice(0, 10), to };
}

export default function ReportsScreen() {
  const toast = useToast();
  const [tab, setTab] = useState('sales');

  const [sales, setSales] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [restock, setRestock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(rangeForPreset('30d').from);
  const [to, setTo] = useState(rangeForPreset('30d').to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'inventory') {
        const res = await client.get('/reports/inventory');
        setInventory(res.data);
      } else if (tab === 'sales') {
        const res = await client.get(`/reports/sales?from=${from}&to=${to}`);
        setSales(res.data);
      } else {
        const res = await client.get(`/reports/restock?from=${from}&to=${to}`);
        setRestock(res.data);
      }
    } catch (e) {
      toast.error(extractError(e).message);
    } finally {
      setLoading(false);
    }
  }, [tab, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function applyPreset(p) {
    setPreset(p);
    if (p !== 'custom') {
      const r = rangeForPreset(p);
      setFrom(r.from);
      setTo(r.to);
    }
  }

  // Build printable HTML for the current tab.
  function reportHtml() {
    const head = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <style>body{font-family:sans-serif;color:#0A0A0A;padding:24px}
      h1{font-size:16px;margin:0 0 4px} h2{font-size:13px;margin:18px 0 6px}
      .muted{color:#737373;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      td,th{padding:6px 0;font-size:12px;border-bottom:1px solid #E5E5E5;text-align:left}
      .r{text-align:right}</style></head><body>
      <h1>BentaTrack</h1><div class="muted">${SYSTEM_TITLE}</div>
      <h2>${tab} report ${tab !== 'inventory' ? `(${from} → ${to})` : ''}</h2>`;
    let body = '';
    if (tab === 'sales' && sales) {
      body = `<table>
        <tr><td>Total Sales</td><td class="r">${formatMoney(sales.summary.totalSales)}</td></tr>
        <tr><td>Transactions</td><td class="r">${sales.summary.transactionCount}</td></tr>
        <tr><td>Items Sold</td><td class="r">${sales.summary.itemsSold}</td></tr>
        <tr><td>Average Sale</td><td class="r">${formatMoney(sales.summary.averageSale)}</td></tr>
      </table>
      <h2>Top Products (revenue)</h2><table><tr><th>Product</th><th class="r">Revenue</th></tr>
        ${sales.topProductsByRevenue.map((p) => `<tr><td>${p.name}</td><td class="r">${formatMoney(p.revenue)}</td></tr>`).join('')}
      </table>
      <h2>Receipts</h2><table><tr><th>Receipt</th><th class="r">Total</th></tr>
        ${sales.receipts.map((r) => `<tr><td>${r.receiptNo}</td><td class="r">${formatMoney(r.total)}</td></tr>`).join('')}
      </table>`;
    } else if (tab === 'inventory' && inventory) {
      body = `<table>
        <tr><td>Total Stock Value</td><td class="r">${formatMoney(inventory.summary.totalStockValue)}</td></tr>
        <tr><td>Low Stock</td><td class="r">${inventory.summary.lowStockCount}</td></tr>
        <tr><td>Products</td><td class="r">${inventory.summary.productCount}</td></tr>
      </table>
      <h2>Products</h2><table><tr><th>Product</th><th class="r">Stock</th><th class="r">Value</th></tr>
        ${inventory.products
          .map((p) => `<tr><td>${p.name}${p.isLow ? ' (low)' : ''}</td><td class="r">${p.stockQty}/${p.reorderLevel}</td><td class="r">${formatMoney(p.stockValue)}</td></tr>`)
          .join('')}
      </table>`;
    } else if (tab === 'restock' && restock) {
      body = `<table>
        <tr><td>Total Requests</td><td class="r">${restock.summary.totalRequests}</td></tr>
        <tr><td>Discrepancies</td><td class="r">${restock.summary.discrepancyCount}</td></tr>
      </table>
      <h2>Per Supplier</h2><table><tr><th>Supplier</th><th class="r">Total</th><th class="r">Completed</th></tr>
        ${restock.perSupplier.map((s) => `<tr><td>${s.supplierName}</td><td class="r">${s.total}</td><td class="r">${s.completed}</td></tr>`).join('')}
      </table>`;
    }
    return `${head}${body}</body></html>`;
  }

  async function printReport() {
    setBusy(true);
    try {
      await Print.printAsync({ html: reportHtml() });
    } catch (e) {
      toast.error('Could not print the report');
    } finally {
      setBusy(false);
    }
  }

  async function shareReport() {
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: reportHtml() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } else {
        toast.info('Sharing not available on this device');
      }
    } catch (e) {
      toast.error('Could not share the report');
    } finally {
      setBusy(false);
    }
  }

  // Fetch the CSV (server returns text/csv) and share it from a local file.
  async function downloadCsv() {
    setBusy(true);
    try {
      const qs = tab === 'inventory' ? 'format=csv' : `from=${from}&to=${to}&format=csv`;
      const res = await client.get(`/reports/${tab}?${qs}`, { responseType: 'text' });
      const file = `${FileSystem.cacheDirectory}${tab}-report.csv`;
      await FileSystem.writeAsStringAsync(file, res.data, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file, { mimeType: 'text/csv' });
      } else {
        toast.info('Download not available on this device');
      }
    } catch (e) {
      toast.error('Could not download CSV');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray100" contentContainerStyle={{ padding: 16 }}>
      {/* Tabs */}
      <View className="flex-row gap-2 mb-3">
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
              tab === t.id ? 'bg-black border-black' : 'bg-white border-gray300'
            }`}
          >
            <t.icon size={15} color={tab === t.id ? '#FFFFFF' : '#525252'} />
            <Text className={`text-sm font-medium ${tab === t.id ? 'text-white' : 'text-gray600'}`}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Presets */}
      {tab !== 'inventory' ? (
        <View className="flex-row flex-wrap gap-1 mb-3">
          {[
            ['today', 'Today'],
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['custom', 'Custom'],
          ].map(([v, l]) => (
            <Pressable
              key={v}
              onPress={() => applyPreset(v)}
              className={`px-2.5 py-1.5 rounded-lg border ${
                preset === v ? 'bg-black border-black' : 'bg-white border-gray300'
              }`}
            >
              <Text className={`text-xs font-medium ${preset === v ? 'text-white' : 'text-gray600'}`}>
                {l}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab !== 'inventory' && preset === 'custom' ? (
        <View className="flex-row items-center gap-2 mb-3">
          <TextInput
            value={from}
            onChangeText={setFrom}
            placeholder="YYYY-MM-DD"
            className="flex-1 px-3 py-2 rounded-lg border border-gray300 text-xs bg-white"
            placeholderTextColor="#A3A3A3"
          />
          <Text className="text-xs text-gray500">to</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="YYYY-MM-DD"
            className="flex-1 px-3 py-2 rounded-lg border border-gray300 text-xs bg-white"
            placeholderTextColor="#A3A3A3"
          />
        </View>
      ) : null}

      {/* Actions */}
      <View className="flex-row gap-2 mb-4">
        <ActionBtn icon={Printer} label="Print/PDF" onPress={printReport} disabled={busy} />
        <ActionBtn icon={Share2} label="Share" onPress={shareReport} disabled={busy} />
        <ActionBtn icon={Download} label="CSV" onPress={downloadCsv} disabled={busy} />
      </View>

      {loading ? (
        <SkeletonList rows={4} />
      ) : tab === 'sales' && sales ? (
        <SalesReport sales={sales} />
      ) : tab === 'inventory' && inventory ? (
        <InventoryReport inventory={inventory} />
      ) : tab === 'restock' && restock ? (
        <RestockReport restock={restock} />
      ) : null}
    </ScrollView>
  );
}

function ActionBtn({ icon: Icon, label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-1.5 bg-white border border-gray300 rounded-xl px-3 py-2 flex-1 justify-center ${
        disabled ? 'opacity-50' : 'active:bg-gray100'
      }`}
    >
      <Icon size={15} color="#000000" />
      <Text className="text-xs font-medium text-black">{label}</Text>
    </Pressable>
  );
}

function Card({ children }) {
  return <View className="bg-white border border-gray200 rounded-xl p-4 mb-3">{children}</View>;
}

function Metric({ label, value }) {
  return (
    <View className="flex-1 min-w-[42%] bg-white border border-gray200 rounded-xl p-4">
      <Text className="text-xs text-gray500">{label}</Text>
      <Text className="text-lg font-bold text-ink mt-1">{value}</Text>
    </View>
  );
}

function SalesReport({ sales }) {
  return (
    <>
      <View className="flex-row flex-wrap gap-3 mb-3">
        <Metric label="Total Sales" value={formatMoney(sales.summary.totalSales)} />
        <Metric label="Transactions" value={String(sales.summary.transactionCount)} />
        <Metric label="Items Sold" value={String(sales.summary.itemsSold)} />
        <Metric label="Average Sale" value={formatMoney(sales.summary.averageSale)} />
      </View>
      <Card>
        <Text className="text-sm font-semibold text-ink mb-2">Top Products (quantity)</Text>
        {sales.topProductsByQuantity.length === 0 ? (
          <Text className="text-xs text-gray500">No data.</Text>
        ) : (
          sales.topProductsByQuantity.map((p, i) => (
            <View key={p.name + i} className="flex-row justify-between py-1">
              <Text className="text-sm text-ink flex-1">{i + 1}. {p.name}</Text>
              <Text className="text-sm text-gray600">{p.quantity} sold</Text>
            </View>
          ))
        )}
      </Card>
      <Card>
        <Text className="text-sm font-semibold text-ink mb-2">Receipts</Text>
        {sales.receipts.length === 0 ? (
          <Text className="text-xs text-gray500">No receipts in this range.</Text>
        ) : (
          sales.receipts.map((r) => (
            <View key={String(r.id)} className="flex-row justify-between py-1.5 border-t border-gray200">
              <Text className="text-sm text-ink">{r.receiptNo}</Text>
              <Text className="text-sm text-gray600">{formatMoney(r.total)}</Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function InventoryReport({ inventory }) {
  return (
    <>
      <View className="flex-row flex-wrap gap-3 mb-3">
        <Metric label="Total Stock Value" value={formatMoney(inventory.summary.totalStockValue)} />
        <Metric label="Low Stock" value={String(inventory.summary.lowStockCount)} />
        <Metric label="Products" value={String(inventory.summary.productCount)} />
      </View>
      <Card>
        {inventory.products.length === 0 ? (
          <Text className="text-xs text-gray500">No products yet.</Text>
        ) : (
          inventory.products.map((p, i) => (
            <View
              key={String(p.id)}
              className={`flex-row items-center justify-between py-2.5 gap-2 ${i > 0 ? 'border-t border-gray200' : ''}`}
            >
              <View className="flex-row items-center gap-2 flex-1">
                {p.isLow ? <Badge status="low">Low</Badge> : null}
                <Text className="text-sm text-ink flex-1" numberOfLines={1}>{p.name}</Text>
              </View>
              <View className="items-end">
                <Text className="text-xs text-gray600">{p.stockQty} · reorder {p.reorderLevel}</Text>
                <Text className="text-xs text-gray600">{formatMoney(p.stockValue)}</Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function RestockReport({ restock }) {
  const statuses = ['pending', 'accepted', 'delivered', 'completed', 'discrepancy', 'declined'];
  return (
    <>
      <Card>
        <Text className="text-sm font-semibold text-ink mb-3">By Status</Text>
        <View className="flex-row flex-wrap gap-2">
          {statuses.map((s) => (
            <View key={s} className="flex-row items-center gap-2 mb-1">
              <Badge status={s} />
              <Text className="text-sm text-ink">{restock.summary.byStatus[s] || 0}</Text>
            </View>
          ))}
        </View>
        <Text className="text-sm text-gray600 mt-2">
          Discrepancies: {restock.summary.discrepancyCount}
        </Text>
      </Card>
      <Card>
        <Text className="text-sm font-semibold text-ink mb-2">Per Supplier</Text>
        {restock.perSupplier.length === 0 ? (
          <Text className="text-xs text-gray500">No restock requests yet.</Text>
        ) : (
          restock.perSupplier.map((s) => (
            <View key={String(s.supplierId)} className="py-2.5 border-t border-gray200">
              <View className="flex-row justify-between">
                <Text className="text-sm text-ink">{s.supplierName}</Text>
                <Text className="text-sm text-gray600">{s.total} request(s)</Text>
              </View>
              <Text className="text-xs text-gray500 mt-0.5">
                Completed {s.completed} · Discrepancy {s.discrepancy} · Declined {s.declined}
              </Text>
            </View>
          ))
        )}
      </Card>
    </>
  );
}
