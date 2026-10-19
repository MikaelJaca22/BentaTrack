import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Printer, Share2 } from 'lucide-react-native';
import client, { extractError } from '../../api/client.js';
import { formatMoney, SYSTEM_TITLE } from '../../config.js';
import { useToast } from '../../components/Toast.js';
import Button from '../../components/Button.js';

function receiptHtml(data) {
  const rows = data.items
    .map(
      (i) => `<tr><td>${i.quantity} × ${i.name}</td><td style="text-align:right">${formatMoney(
        i.lineTotal
      )}</td></tr>`
    )
    .join('');
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>body{font-family:sans-serif;color:#0A0A0A;padding:24px}
  h1{font-size:16px;margin:0} .muted{color:#737373;font-size:11px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  td{padding:6px 0;font-size:13px;border-bottom:1px solid #E5E5E5}
  .tot{font-weight:bold} hr{border:none;border-top:1px solid #E5E5E5;margin:12px 0}</style></head>
  <body>
    <h1>BentaTrack</h1>
    <div class="muted">${SYSTEM_TITLE}</div>
    <hr/>
    <div>Store: ${data.store.name}</div>
    <div>Receipt: ${data.sale.receiptNo}</div>
    <div>Date: ${data.sale.createdAt}</div>
    <table>${rows}</table>
    <hr/>
    <table>
      <tr class="tot"><td>Total</td><td style="text-align:right">${formatMoney(data.sale.total)}</td></tr>
      <tr><td>Tendered</td><td style="text-align:right">${formatMoney(data.sale.amountTendered)}</td></tr>
      <tr><td>Change</td><td style="text-align:right">${formatMoney(data.sale.changeDue)}</td></tr>
      <tr><td>Payment</td><td style="text-align:right">${data.sale.paymentMethod}</td></tr>
    </table>
    <p class="muted">Thank you!</p>
  </body></html>`;
}

export default function ReceiptScreen({ route, navigation }) {
  const toast = useToast();
  const id = route.params.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client
      .get(`/sales/${id}`)
      .then((res) => setData(res.data))
      .catch((e) => toast.error(extractError(e).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function printOrShare(share) {
    if (!data) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: receiptHtml(data) });
      if (share) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
        } else {
          toast.info('Sharing not available on this device');
        }
      } else {
        await Print.printAsync({ html: receiptHtml(data) });
      }
    } catch (e) {
      toast.error('Could not print/share the receipt');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray100">
        <ActivityIndicator color="#000000" />
      </View>
    );
  }
  if (!data) return null;

  return (
    <View className="flex-1 bg-gray100">
      <View className="flex-row items-center justify-between bg-white border-b border-gray200 px-4 py-3">
        <Text className="text-base font-semibold text-ink">Receipt</Text>
        <View className="flex-row gap-2">
          <Button variant="secondary" icon={Printer} onPress={() => printOrShare(false)} disabled={busy}>
            Print
          </Button>
          <Button variant="ghost" icon={Share2} onPress={() => printOrShare(true)} disabled={busy}>
            Share
          </Button>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-white border border-gray200 rounded-xl p-6">
          <View className="items-center border-b border-gray200 pb-4">
            <Text className="text-sm font-bold text-ink">BentaTrack</Text>
            <Text className="text-[11px] text-gray500 text-center mt-1">{SYSTEM_TITLE}</Text>
          </View>

          <KV label="Store" value={data.store.name} />
          <KV label="Receipt" value={data.sale.receiptNo} />
          <KV label="Date" value={data.sale.createdAt} />

          <View className="border-y border-gray200 py-3 my-3 gap-1">
            {data.items.map((i) => (
              <View key={String(i.id)} className="flex-row justify-between">
                <Text className="text-sm text-ink flex-1">{i.name}</Text>
                <Text className="text-sm text-gray600">{formatMoney(i.lineTotal)}</Text>
              </View>
            ))}
          </View>

          <View className="gap-1">
            <KV label="Total" value={formatMoney(data.sale.total)} bold />
            <KV label="Tendered" value={formatMoney(data.sale.amountTendered)} />
            <KV label="Change" value={formatMoney(data.sale.changeDue)} />
            <KV label="Payment" value={data.sale.paymentMethod} />
          </View>

          <Text selectable className="text-center text-xs text-gray500 mt-4">
            Thank you! (long-press to copy this receipt)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function KV({ label, value, bold }) {
  return (
    <View className="flex-row justify-between py-0.5">
      <Text className="text-sm text-gray500">{label}</Text>
      <Text className={`text-sm ${bold ? 'font-bold text-ink' : 'text-ink'}`}>{value}</Text>
    </View>
  );
}
