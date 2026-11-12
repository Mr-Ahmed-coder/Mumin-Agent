// Isolated presentation tests: no backend, credentials, or database connections.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
let role = 'CASHIER';
let state = 'open';
const session = {
  _id: 'test-shift', ledgerVersion: 1, openingVersion: 2, sessionNumber: 'SHIFT-TEST',
  openedAt: '2026-11-05T06:00:00Z', currentCashBalance: 500000, openingCash: 500000,
  cashierId: { name: 'Test Cashier' }, closingEligibility: { ready: true },
  accountBalances: [
    { id: 'cash-usd', name: 'USD Cash', currency: 'USD', balance: 100 },
    { id: 'cash-ugx', name: 'UGX Cash', currency: 'UGX', balance: 500000 },
    { id: 'wallet-a', name: 'Wallet A', currency: 'USD', balance: 200 },
    { id: 'wallet-b', name: 'Wallet B', currency: 'USD', balance: 300 },
  ],
};
function current() {
  return state === 'closed' ? null : { ...session, closingEligibility: { ready: state !== 'blocked', reason: 'Missing verified movements.' } };
}
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    module._compile(code, filename);
  };
}
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === '@/providers/AuthProvider') return { useAuth: () => ({ user: { _id: 'test-user', name: 'Test User', role }, isLoading: false, logout() {} }) };
  if (name === '@/lib/api') return { api: new Proxy({}, { get() { throw new Error('Network access is prohibited in this test'); } }) };
  if (name === 'next/navigation') return { usePathname: () => '/dashboard' };
  if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
  if (name === '@tanstack/react-query') return {
    useMutation: () => ({ isPending: false }), useQueryClient: () => ({ invalidateQueries() {} }),
    useQuery: ({ queryKey }) => {
      let data;
      switch (queryKey[0]) {
        case 'dashboardStats': data = { data: { activeSessions: current() ? [current()] : [], openCashiersCount: current() ? 1 : 0, cashAvailableUGX: 500000, todayTransactionsCount: 2, todayVolumeUSD: 100, todayServiceFeesUSD: 1 } }; break;
        case 'activeCashSession': data = { data: state === 'error' || state === 'loading' ? null : current() }; break;
        case 'dashboardShiftBalances': data = { accountBalances: session.accountBalances }; break;
        case 'dashboardCharts': data = { dailyStats: [] }; break;
        case 'recentTransactions': data = { data: [] }; break;
      }
      return { data, isLoading: queryKey[0] === 'activeCashSession' && state === 'loading', isError: queryKey[0] === 'activeCashSession' && state === 'error', refetch() {} };
    },
  };
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  return originalLoad.call(this, name, parent, main);
};
const Dashboard = require('../src/app/dashboard/page.tsx').default;
const render = () => renderToStaticMarkup(React.createElement(Dashboard));
const actionEnabled = (html, label) => new RegExp(`<a[^>]+aria-label="${label}\\.`).test(html);

for (const testRole of ['ADMIN', 'MANAGER', 'CASHIER']) {
  for (const testState of ['open', 'closed', 'blocked', 'loading', 'error']) {
    test(`${testRole}: ${testState} shift preserves action restrictions`, () => {
      role = testRole; state = testState;
      const html = render();
      for (const label of ['Open Shift', 'New Transaction', 'Close Shift', 'Daily Report']) assert.ok(html.includes(`aria-label="${label}.`), label);
      assert.equal(actionEnabled(html, 'Daily Report'), role !== 'CASHIER');
      assert.equal(actionEnabled(html, 'New Transaction'), role === 'CASHIER' && ['open', 'blocked'].includes(state));
      assert.equal(actionEnabled(html, 'Open Shift'), role !== 'CASHIER' || state === 'closed');
      assert.equal(actionEnabled(html, 'Close Shift'), role !== 'CASHIER' || state === 'open');
      if (role === 'CASHIER' && state === 'blocked') assert.ok(html.includes('Missing verified movements.'));
      if (role === 'CASHIER' && state === 'open') assert.ok(html.includes('href="/cash-sessions/test-shift/close"'));
      if (state === 'open') for (const name of ['USD Cash', 'UGX Cash', 'Wallet A', 'Wallet B']) assert.ok(html.includes(name));
      assert.ok(!html.includes('>Customers<') && !html.includes('>Internet Credit<'));
    });
  }
}

// Optional browser fixture output, generated only for local visual verification.
if (process.env.DASHBOARD_UI_FIXTURE) {
  role = process.env.DASHBOARD_UI_ROLE || 'CASHIER'; state = process.env.DASHBOARD_UI_STATE || 'open';
  const cssDir = path.join(root, '.next/static/css');
  const css = fs.readdirSync(cssDir).filter(x => x.endsWith('.css')).map(x => fs.readFileSync(path.join(cssDir, x), 'utf8')).join('\n');
  fs.writeFileSync(process.env.DASHBOARD_UI_FIXTURE, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${render()}<script>window.onload=()=>{document.body.dataset.overflow=String(document.documentElement.scrollWidth>innerWidth);document.body.dataset.width=innerWidth;}</script></body></html>`);
}
