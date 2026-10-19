import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '..');
const port = 4010;
const baseUrl = `http://localhost:${port}/api`;
const jwtSecret = 'smoke-test-secret-at-least-32-chars-long';

const dataDir = mkdtempSync(path.join(tmpdir(), 'bentatrack-smoke-'));
const dbPath = path.join(dataDir, 'test.db');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(port),
  JWT_SECRET: jwtSecret,
  DB_PATH: dbPath,
  CORS_ORIGINS: '',
};

let child;
let failed = false;

function assert(cond, msg) {
  if (!cond) {
    failed = true;
    console.error('FAIL:', msg);
  } else {
    console.log('PASS:', msg);
  }
}

async function request(method, pathUrl, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathUrl}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

async function waitForHealth() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('backend did not start');
}

async function main() {
  child = spawn('node', ['src/server.js'], { cwd: backendDir, env, stdio: 'ignore' });
  await waitForHealth();

  // register
  const supReg = await request('POST', '/auth/register', { body: { role: 'supplier', name: 'Supplier One', username: 'sup1', password: 'password123' } });
  assert(supReg.status === 201, 'register supplier');
  const ownReg = await request('POST', '/auth/register', { body: { role: 'store_owner', name: 'Owner One', username: 'own1', password: 'password123' } });
  assert(ownReg.status === 201, 'register owner');

  const supToken = supReg.data.token;
  const ownToken = ownReg.data.token;
  const supId = supReg.data.user.id;

  // login wrong password
  const badLogin = await request('POST', '/auth/login', { body: { username: 'own1', password: 'wrong' } });
  assert(badLogin.status === 401, 'bad login rejected');

  // link supplier
  const link = await request('POST', '/suppliers/link', { token: ownToken, body: { supplierId: supId } });
  assert(link.status === 201, 'link supplier');

  // create product
  const prod = await request('POST', '/products', { token: ownToken, body: { name: 'Widget', price: 10, stockQty: 5, reorderLevel: 2 } });
  assert(prod.status === 201, 'create product');
  const productId = prod.data.product.id;

  // duplicate product code rejected (create another with same code? none; test price negative)
  const badProd = await request('POST', '/products', { token: ownToken, body: { name: 'Bad', price: -1 } });
  assert(badProd.status === 400, 'negative price rejected');

  // adjust stock requires reason
  const badAdj = await request('PATCH', `/products/${productId}/stock`, { token: ownToken, body: { quantity: 1 } });
  assert(badAdj.status === 400, 'adjust without reason rejected');

  // sale
  const sale = await request('POST', '/sales', { token: ownToken, body: { items: [{ productId, quantity: 2 }], amountTendered: 20 } });
  assert(sale.status === 201 && sale.data.sale.receiptNo === 'BT-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-0001', 'first sale receipt number');
  assert(sale.data.sale.total === 20 && sale.data.sale.changeDue === 0, 'sale totals');

  // insufficient stock
  const bigSale = await request('POST', '/sales', { token: ownToken, body: { items: [{ productId, quantity: 100 }], amountTendered: 1000 } });
  assert(bigSale.status === 400, 'insufficient stock rejected');

  // tendered less than total
  const shortSale = await request('POST', '/sales', { token: ownToken, body: { items: [{ productId, quantity: 1 }], amountTendered: 1 } });
  assert(shortSale.status === 400, 'short tender rejected');

  // low stock notification after selling down
  await request('POST', '/sales', { token: ownToken, body: { items: [{ productId, quantity: 2 }], amountTendered: 20 } });
  const notif = await request('GET', '/notifications', { token: ownToken });
  assert(notif.data.unreadCount >= 1, 'low stock notification created');

  // restock flow
  const req = await request('POST', '/restock', { token: ownToken, body: { supplierId: supId, items: [{ productId, quantity: 3 }] } });
  assert(req.status === 201 && req.data.status === 'pending', 'create restock request');
  const rid = req.data.id;
  const itemId = req.data.items[0].id;

  const acc = await request('POST', `/restock/${rid}/accept`, { token: supToken });
  assert(acc.status === 200 && acc.data.status === 'accepted', 'accept request');

  const del = await request('POST', `/restock/${rid}/deliver`, { token: supToken, body: { items: [{ itemId, quantityDelivered: 3 }] } });
  assert(del.status === 200 && del.data.status === 'delivered' && del.data.items[0].quantityDelivered === 3, 'deliver');

  const badVerify = await request('POST', `/restock/${rid}/verify`, { token: ownToken, body: { items: [{ itemId, quantityReceived: 2 }] } });
  assert(badVerify.status === 400, 'verify mismatch rejected');

  const disc = await request('POST', `/restock/${rid}/discrepancy`, { token: ownToken, body: { items: [{ itemId, quantityReceived: 2 }], note: 'short' } });
  assert(disc.status === 200 && disc.data.status === 'discrepancy', 'discrepancy recorded');

  const del2 = await request('POST', `/restock/${rid}/deliver`, { token: supToken, body: { items: [{ itemId, quantityDelivered: 2 }] } });
  assert(del2.status === 200 && del2.data.items[0].quantityDelivered === 2, 're-deliver 2');

  const ver = await request('POST', `/restock/${rid}/verify`, { token: ownToken, body: { items: [{ itemId, quantityReceived: 2 }] } });
  assert(ver.status === 200 && ver.data.status === 'completed', 'verify completes');

  const prodAfter = await request('GET', '/products', { token: ownToken });
  assert(prodAfter.data.products[0].stockQty === 3, 'inventory increased by received qty');

  // resend guard
  const sup2Reg = await request('POST', '/auth/register', { body: { role: 'supplier', name: 'Supplier Two', username: 'sup2', password: 'password123' } });
  const sup2Id = sup2Reg.data.user.id;
  await request('POST', '/suppliers/link', { token: ownToken, body: { supplierId: sup2Id } });
  const req2 = await request('POST', '/restock', { token: ownToken, body: { supplierId: supId, items: [{ productId, quantity: 1 }] } });
  await request('POST', `/restock/${req2.data.id}/decline`, { token: supToken, body: { reason: 'no' } });
  const resend = await request('POST', `/restock/${req2.data.id}/resend`, { token: ownToken, body: { supplierId: sup2Id } });
  assert(resend.status === 201, 'resend to another supplier');
  const resend2 = await request('POST', `/restock/${req2.data.id}/resend`, { token: ownToken, body: { supplierId: supId } });
  assert(resend2.status === 400, 'second resend blocked');

  // reports
  const rep = await request('GET', '/reports/sales', { token: ownToken });
  assert(rep.status === 200 && rep.data.summary.transactionCount === 2, 'sales report');

  // notifications pagination hasMore shape
  const n2 = await request('GET', '/notifications?limit=1', { token: ownToken });
  assert(n2.data.pagination && typeof n2.data.pagination.hasMore === 'boolean', 'notifications pagination shape');

  console.log(failed ? '\nSOME TESTS FAILED' : '\nALL TESTS PASSED');
}

main()
  .catch((e) => { console.error('ERROR:', e); failed = true; })
  .finally(() => {
    if (child) child.kill();
    try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
    process.exit(failed ? 1 : 0);
  });