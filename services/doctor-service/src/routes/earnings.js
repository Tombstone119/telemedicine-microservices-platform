const express = require('express');
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// Get doctor's earnings history
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

    // Get earnings with appointment details
    const earningsResult = await pool.query(
      `
        SELECT
          de.id,
          de.appointment_id,
          de.total_amount,
          de.platform_fee,
          de.doctor_amount,
          de.created_at,
          a.appointment_time,
          p.name as patient_name,
          u_patient.full_name as patient_full_name,
          u_patient.email as patient_email,
          pr.receipt_number
        FROM doctor_earnings de
        JOIN appointments a ON a.id = de.appointment_id
        LEFT JOIN patients p ON p.user_id = a.patient_id
        LEFT JOIN users u_patient ON u_patient.id = a.patient_id
        LEFT JOIN payment_receipts pr ON pr.appointment_id = a.id
        WHERE de.doctor_id = $1
        ORDER BY de.created_at DESC
      `,
      [doctorId]
    );

    const items = earningsResult.rows.map(row => ({
      id: row.id,
      appointment_id: row.appointment_id,
      total_amount: Number(row.total_amount || 0),
      platform_fee: Number(row.platform_fee || 0),
      doctor_amount: Number(row.doctor_amount || 0),
      created_at: row.created_at,
      appointment_time: row.appointment_time,
      patient_name: row.patient_name || row.patient_full_name || 'Patient',
      patient_email: row.patient_email,
      receipt_number: row.receipt_number,
    }));

    // Calculate summary
    const summaryResult = await pool.query(
      `
        SELECT
          COUNT(*)::int AS payment_count,
          COALESCE(SUM(doctor_amount), 0)::numeric AS total_earned,
          COALESCE(SUM(platform_fee), 0)::numeric AS total_platform_fees,
          COALESCE(SUM(total_amount), 0)::numeric AS total_payments
        FROM doctor_earnings
        WHERE doctor_id = $1
      `,
      [doctorId]
    );

    const summary = summaryResult.rows[0] || {
      payment_count: 0,
      total_earned: 0,
      total_platform_fees: 0,
      total_payments: 0,
    };

    return res.json({
      summary: {
        payment_count: summary.payment_count,
        total_earned: Number(summary.total_earned || 0),
        total_platform_fees: Number(summary.total_platform_fees || 0),
        total_payments: Number(summary.total_payments || 0),
      },
      items,
    });
  } catch (error) {
    console.error('[DoctorService] GET /earnings error:', error);
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// Get receipt for download
router.get('/receipt/:appointmentId', verifyToken, requireRole('doctor'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const appointmentId = parseInt(req.params.appointmentId, 10);

    if (!userId || Number.isNaN(appointmentId)) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Verify doctor owns this appointment
    const doctorResult = await pool.query(
      `
        SELECT d.id FROM doctors d
        WHERE d.user_id = $1
      `,
      [userId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const doctorId = doctorResult.rows[0].id;

    // Get receipt details
    const receiptResult = await pool.query(
      `
        SELECT
          pr.receipt_number,
          pr.total_amount,
          pr.platform_fee,
          pr.doctor_amount,
          pr.generated_at,
          a.appointment_time,
          d.consultation_fee,
          d.specialty,
          u_doctor.full_name as doctor_name,
          u_doctor.email as doctor_email,
          p.name as patient_name,
          u_patient.full_name as patient_full_name,
          u_patient.email as patient_email
        FROM payment_receipts pr
        JOIN appointments a ON a.id = pr.appointment_id
        JOIN doctors d ON d.id = pr.doctor_id
        JOIN users u_doctor ON u_doctor.id = d.user_id
        LEFT JOIN patients p ON p.user_id = a.patient_id
        LEFT JOIN users u_patient ON u_patient.id = a.patient_id
        WHERE pr.appointment_id = $1 AND pr.doctor_id = $2
      `,
      [appointmentId, doctorId]
    );

    if (receiptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = receiptResult.rows[0];

    // Generate HTML receipt
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Payment Receipt ${receipt.receipt_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #107393; padding-bottom: 20px; }
            .header h1 { color: #107393; margin: 0; }
            .header p { margin: 5px 0; font-size: 12px; color: #666; }
            .section { margin: 20px 0; }
            .section-title { font-weight: bold; color: #107393; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; }
            .label { font-weight: 500; color: #555; }
            .value { color: #333; }
            .amount { font-weight: bold; }
            .success { color: #059669; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: bold; }
            .total-row { background: #f0f8ff; font-weight: bold; }
            .doctor-earn { background: #f0fdf4; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Receipt</h1>
              <p>Receipt #: <strong>${receipt.receipt_number}</strong></p>
              <p>Date: ${new Date(receipt.generated_at).toLocaleDateString()}</p>
            </div>

            <div class="section">
              <div class="section-title">Doctor Information</div>
              <div class="row">
                <span class="label">Name:</span>
                <span class="value">${receipt.doctor_name}</span>
              </div>
              <div class="row">
                <span class="label">Specialty:</span>
                <span class="value">${receipt.specialty || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="label">Email:</span>
                <span class="value">${receipt.doctor_email}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Patient Information</div>
              <div class="row">
                <span class="label">Name:</span>
                <span class="value">${receipt.patient_name || receipt.patient_full_name || 'Patient'}</span>
              </div>
              <div class="row">
                <span class="label">Email:</span>
                <span class="value">${receipt.patient_email || 'N/A'}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Appointment Details</div>
              <div class="row">
                <span class="label">Date & Time:</span>
                <span class="value">${new Date(receipt.appointment_time).toLocaleString()}</span>
              </div>
              <div class="row">
                <span class="label">Consultation Fee:</span>
                <span class="value amount">Rs. ${Number(receipt.total_amount).toLocaleString()}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Payment Breakdown</div>
              <table>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
                <tr>
                  <td>Total Amount</td>
                  <td class="amount">Rs. ${Number(receipt.total_amount).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Platform Fee (20%)</td>
                  <td class="amount">- Rs. ${Number(receipt.platform_fee).toLocaleString()}</td>
                </tr>
                <tr class="total-row doctor-earn">
                  <td>Amount Received (80%)</td>
                  <td class="amount success">Rs. ${Number(receipt.doctor_amount).toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <div class="footer">
              <p>This is an automatically generated receipt. Please keep this for your records.</p>
              <p>For queries, please contact support@telemedicine.com</p>
            </div>
          </div>
        </body>
      </html>
    `;

    res.set('Content-Type', 'text/html');
    res.set('Content-Disposition', `attachment; filename="receipt-${receipt.receipt_number}.html"`);
    return res.send(html);
  } catch (error) {
    console.error('[DoctorService] GET /receipt error:', error);
    return res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

module.exports = router;
