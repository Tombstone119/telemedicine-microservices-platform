const { subscribeToEvents } = require('./rabbitmq');
const { pool } = require('./db');

async function initializeEventListeners() {
  try {
    // Subscribe to payment completion events
    await subscribeToEvents(
      ['payment.completed', 'payment.refunded'],
      handlePaymentEvent
    );

    console.log('[PaymentService] Event listeners initialized');
  } catch (error) {
    console.error('[PaymentService] Failed to initialize event listeners:', error);
  }
}

async function handlePaymentEvent(routingKey, payload) {
  try {
    if (routingKey === 'payment.completed') {
      // Update patient wallet - deduct payment
      await updatePatientWallet(
        payload.patient_id,
        payload.appointment_id,
        -Number(payload.total_amount),
        'payment',
        `Payment for appointment ${payload.appointment_id} with doctor`,
        payload
      );
    } else if (routingKey === 'payment.refunded') {
      // Update patient wallet - refund
      await updatePatientWallet(
        payload.patient_id,
        payload.appointment_id,
        Number(payload.refund_amount),
        'refund',
        `Refund for cancelled appointment ${payload.appointment_id}`,
        payload
      );
    }
  } catch (error) {
    console.error('[PaymentService] Error handling payment event:', error);
  }
}

async function updatePatientWallet(
  patientId,
  appointmentId,
  amount,
  transactionType,
  description,
  metadata
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get or create wallet
    const walletResult = await client.query(
      `
        SELECT id, balance, total_spent FROM patient_wallets 
        WHERE user_id = $1 FOR UPDATE
      `,
      [patientId]
    );

    let wallet;
    if (walletResult.rows.length === 0) {
      // Create new wallet
      const newWallet = await client.query(
        `
          INSERT INTO patient_wallets (user_id, balance, total_spent, total_credits)
          VALUES ($1, $2, 0, 0)
          RETURNING id, balance
        `,
        [patientId, amount < 0 ? 0 : amount]
      );
      wallet = newWallet.rows[0];
    } else {
      wallet = walletResult.rows[0];
    }

    // Calculate new balance
    const newBalance = Number(wallet.balance) + amount;
    if (newBalance < 0) {
      throw new Error('Insufficient wallet balance');
    }

    // Update wallet
    await client.query(
      `
        UPDATE patient_wallets
        SET balance = $1,
            total_spent = CASE WHEN $2 < 0 THEN total_spent + ABS($2) ELSE total_spent END,
            total_credits = CASE WHEN $2 > 0 THEN total_credits + $2 ELSE total_credits END,
            updated_at = NOW()
        WHERE user_id = $3
      `,
      [newBalance, amount, patientId]
    );

    // Create transaction record
    await client.query(
      `
        INSERT INTO wallet_transactions 
        (user_id, appointment_id, type, amount, description, balance_before, balance_after, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        patientId,
        appointmentId,
        transactionType,
        Math.abs(amount),
        description,
        wallet.balance,
        newBalance,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  initializeEventListeners,
};
