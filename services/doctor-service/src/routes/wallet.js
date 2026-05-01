const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');
const { publishEvent } = require('../rabbitmq');

const router = express.Router();

// Get doctor's wallet info
router.get('/', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get doctor_id from user_id
    const doctorResult = await pool.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const doctorId = doctorResult.rows[0].id;

    // Get wallet info
    const walletResult = await pool.query(
      `
        SELECT
          id,
          balance,
          total_earned,
          total_withdrawn,
          updated_at
        FROM doctor_wallets
        WHERE doctor_id = $1
      `,
      [doctorId]
    );

    if (walletResult.rows.length === 0) {
      return res.json({
        balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
        updated_at: new Date(),
      });
    }

    const wallet = walletResult.rows[0];
    return res.json({
      balance: Number(wallet.balance || 0),
      total_earned: Number(wallet.total_earned || 0),
      total_withdrawn: Number(wallet.total_withdrawn || 0),
      updated_at: wallet.updated_at,
    });
  } catch (error) {
    console.error('[DoctorService] GET /wallet error:', error);
    return res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

// Get withdrawal history
router.get('/withdrawals', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get doctor_id from user_id
    const doctorResult = await pool.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const doctorId = doctorResult.rows[0].id;

    // Get withdrawal history
    const withdrawalsResult = await pool.query(
      `
        SELECT
          id,
          amount,
          status,
          bank_name,
          account_number,
          requested_at,
          processed_at,
          notes
        FROM wallet_withdrawals
        WHERE doctor_id = $1
        ORDER BY requested_at DESC
      `,
      [doctorId]
    );

    const items = withdrawalsResult.rows.map(row => ({
      id: row.id,
      amount: Number(row.amount || 0),
      status: row.status,
      bank_name: row.bank_name,
      account_number: row.account_number ? `****${row.account_number.slice(-4)}` : null,
      requested_at: row.requested_at,
      processed_at: row.processed_at,
      notes: row.notes,
    }));

    return res.json({ items });
  } catch (error) {
    console.error('[DoctorService] GET /wallet/withdrawals error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawal history' });
  }
});

// Request withdrawal
router.post('/withdraw', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount, bank_name, account_number, notes } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }

    if (!bank_name || !account_number) {
      return res.status(400).json({ error: 'Bank details are required' });
    }

    // Get doctor_id from user_id
    const doctorResult = await pool.query(
      'SELECT id FROM doctors WHERE user_id = $1',
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const doctorId = doctorResult.rows[0].id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check wallet balance
      const walletResult = await client.query(
        'SELECT balance FROM doctor_wallets WHERE doctor_id = $1 FOR UPDATE',
        [doctorId]
      );

      if (walletResult.rows.length === 0 || Number(walletResult.rows[0].balance) < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Create withdrawal request
      const withdrawalResult = await client.query(
        `
          INSERT INTO wallet_withdrawals 
          (doctor_id, amount, bank_name, account_number, status, notes, requested_at)
          VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
          RETURNING id, amount, status, requested_at
        `,
        [doctorId, amount, bank_name, account_number, notes || null]
      );

      // Update wallet balance (place on hold)
      await client.query(
        `
          UPDATE doctor_wallets
          SET balance = balance - $1,
              updated_at = NOW()
          WHERE doctor_id = $2
        `,
        [amount, doctorId]
      );

      await client.query('COMMIT');

      const withdrawal = withdrawalResult.rows[0];

      // Publish event
      await publishEvent('wallet.withdrawal_requested', {
        doctor_id: doctorId,
        withdrawal_id: withdrawal.id,
        amount: Number(amount),
        bank_name,
        account_number: `****${account_number.slice(-4)}`,
        requested_at: withdrawal.requested_at,
      });

      return res.status(201).json({
        id: withdrawal.id,
        amount: Number(withdrawal.amount),
        status: withdrawal.status,
        requested_at: withdrawal.requested_at,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DoctorService] POST /wallet/withdraw error:', error);
    return res.status(500).json({ error: 'Failed to process withdrawal request' });
  }
});

module.exports = router;
