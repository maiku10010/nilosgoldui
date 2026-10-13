// Local-only visual verification. All API responses are synthetic; no live account is used.
import { createServer } from 'vite';
const stamp = new Date().toISOString();
const inventory = [
  { referenceId: 'TEST-G1', itemName: 'Workshop gold', category: 'GOLD', unit: 'grams', quantityIn: 50, balance: 50 },
  { referenceId: 'TEST-G2', itemName: 'Ring material', category: 'GOLD', unit: 'grams', quantityOut: 10, balance: 40 },
  { referenceId: 'TEST-B1', itemName: 'Ring box', category: 'BOXES', unit: 'pieces', quantityIn: 20, balance: 20 },
  { referenceId: 'TEST-B2', itemName: 'Ring box', category: 'BOXES', unit: 'pieces', quantityOut: 5, balance: 15 },
].map(row => ({ quantityIn: 0, quantityOut: 0, quantityLoss: 0, unitPrice: 100, updatedAt: stamp, ...row }));
const sale = { invoiceId: 'TEST-SALE', status: 'FINISHED', price: 1000, payment: 1000, serviceType: 'Repair', salesDate: stamp,
  clientId: 'TEST-CLIENT', client: { clientName: 'Preview Customer', contactNum: '+639123456789', email: 'preview@example.com' } };
const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true },
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:5174/__fixtures') },
  plugins: [{ name: 'local-test-fixtures', configureServer(vite) {
    vite.middlewares.use('/__fixtures', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const path = req.url.split('?')[0];
      if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Preview is read-only.' })); return; }
      const data = path === '/auth/me' ? { user: { empId: 'TEST-ADMIN', empName: 'Preview Admin', empRole: 'Admin' } }
        : path === '/inventory' ? inventory : path === '/sales' ? [sale]
        : path === '/gold/price' ? { ratePerGram: 8000, currency: 'PHP', source: 'Preview fixture', updatedAt: stamp, stale: false }
        : [];
      res.end(JSON.stringify(data));
    });
  } }] });
await server.listen();
console.log('Read-only fixture preview: http://127.0.0.1:5174');
