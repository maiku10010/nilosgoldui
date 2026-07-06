import express, { Request, Response, Router } from 'express';
import { prisma } from '../db';

const router = Router();

// ─── 1. CREATE OPERATION (POST) ─────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const { serviceType, price, status, downpayment, salesDate, date, clientId } = req.body;

    // 🚨 Guard Rail: Prevent Prisma crash if clientId is missing
    if (!clientId) {
      return res.status(400).json({ error: 'Cannot create sale without a valid clientId.' });
    }

    // Accept either 'salesDate' or 'date' from the frontend
    const targetDateStr = salesDate || date;
    const resolvedDate = targetDateStr ? new Date(targetDateStr) : new Date();

    const newSales = await prisma.sales.create({
      data: {
        serviceType: serviceType || 'Custom',
        price: Number(price) || 0.00,
        status: status || 'Ongoing',
        downpayment: Number(downpayment) || 0.00,
        salesDate: resolvedDate,
        client: {
          // Wrap in Number() if your Prisma clientId is an Int, otherwise leave as String(clientId)
          connect: { clientId: Number(clientId) }
        }
      }
    });

    return res.status(201).json(newSales);
  } catch (error: any) {
    console.error('Error creating sales:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// ─── 2. READ OPERATION (GET) ────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const allSales = await prisma.sales.findMany({
      include: { client: true },
      orderBy: { salesDate: 'desc' } // Optional: Sorts newest sales first!
    });
    res.json(allSales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── 3. UPDATE OPERATION (PUT) ──────────────────────────────
router.put('/:invoiceId', async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { serviceType, price, status, downpayment, salesDate, date } = req.body;

    const targetDateStr = salesDate || date;

    const updatedSales = await prisma.sales.update({
      where: { invoiceId: invoiceId },
      data: {
        ...(serviceType !== undefined && { serviceType }),
        ...(price !== undefined && { price: Number(price) }),
        ...(status !== undefined && { status }),
        ...(downpayment !== undefined && { downpayment: Number(downpayment) }),
        ...(targetDateStr !== undefined && { salesDate: new Date(targetDateStr) })
      }
    });

    res.json(updatedSales);
  } catch (error) {
    console.error('Error updating sales:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─── 4. DELETE OPERATION (DELETE) ───────────────────────────
router.delete('/:invoiceId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { invoiceId } = req.params;

    await prisma.sales.delete({
      where: { invoiceId: invoiceId }
    });

    return res.json({ message: 'Sale invoice successfully deleted' });
  } catch (error: any) {
    // P2003 = Prisma Foreign Key Constraint Failure
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        error: 'Cannot delete sale: Please delete the associated Job Costing record first.' 
      });
    }
    console.error('Error deleting sale:', error);
    return res.status(500).json({ error: 'Failed to delete sale' });
  }
});

export default router;