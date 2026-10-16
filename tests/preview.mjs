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
const jobs = Array.from({ length: 24 }, (_, i) => {
  const status = ['PENDING', 'IN_PROGRESS', 'FINISHED', 'APPROVED', 'READY_FOR_PICKUP', 'FINISHED'][i % 6];
  const id = i === 22 ? 'JOB-2026-000023-WORKSHOP' : 'JOB-2026-' + String(i + 1).padStart(6, '0');
  const noCost = i === 23;
  return { jobCostId: id, invoiceId: id, clientName: i === 22 ? 'Preview Customer With A Long Name' : 'Preview Customer ' + (i + 1), itemName: 'Custom ring',
    status, goldUsed: noCost ? 0 : 2, goldCostPerG: noCost ? 0 : 8000, laborCost: noCost ? 0 : 1000, sellingPrice: 25000 + i * 100,
    sales: i === 0 ? undefined : { ...sale, invoiceId: id, status: status === 'FINISHED' ? 'FINISHED' : 'PENDING', price: 25000 + i * 100, serviceType: ['Custom', 'Repair', 'Resize', 'Cleaning'][i % 4] },
  };
});
const inquiries = ['PENDING', 'APPROVED', 'FINISHED', 'REJECTED'].map((status, i) => ({
  inquiryId: 'TEST-INQUIRY-' + i, inqDate: stamp, customerName: 'Preview Customer ' + (i + 1),
  contactInfo: '09123456789', category: 'Custom', details: 'Preview ring inquiry', quotedPrice: 25000, isFullyPaid: i === 2, status,
}));
const expenses = [{ expenseId: 'TEST-EXPENSE', expDate: stamp, category: 'Supplies', description: 'Preview workshop supplies', amount: 250 }];
const audit = ['CREATE', 'UPDATE', 'ARCHIVE', 'SIGN_IN'].map((action, i) => ({ logId: 'TEST-LOG-' + i, createdAt: stamp, actorName: 'Preview Admin', actorRole: i % 2 ? 'STAFF' : 'ADMIN', action, entityType: 'INQUIRY', entityId: 'TEST-INQUIRY-' + i }));
const server = await createServer({ server: { host: '127.0.0.1', port: 5174, strictPort: true },
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://127.0.0.1:5174/__fixtures') },
  plugins: [{ name: 'local-test-fixtures', configureServer(vite) {
    vite.middlewares.use('/__fixtures', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const path = req.url.split('?')[0];
      if (req.method !== 'GET') { res.statusCode = 405; res.end(JSON.stringify({ error: 'Preview is read-only.' })); return; }
      const data = path === '/auth/me' ? { user: { empId: 'TEST-ADMIN', empName: 'Preview Admin', empRole: 'Admin' } }
        : path === '/job-cost' ? jobs : path === '/inquiries' ? inquiries : path === '/expenses' ? expenses : path === '/audit-logs' ? audit
        : path === '/inventory' ? inventory : path === '/sales' ? [sale, ...jobs.filter(job => job.sales).map(job => job.sales)]
        : path === '/gold/price' ? { ratePerGram: 8000, currency: 'PHP', source: 'Preview fixture', updatedAt: stamp, stale: false }
        : [];
      res.end(JSON.stringify(data));
    });
  } }] });
await server.listen();
console.log('Read-only fixture preview: http://127.0.0.1:5174');
