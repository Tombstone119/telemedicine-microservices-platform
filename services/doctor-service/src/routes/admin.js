const router = require('express').Router();
const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');

const validStatuses = new Set(['pending', 'pending_verification', 'in_review', 'approved', 'rejected']);
const defaultQueueStatuses = ['pending', 'pending_verification', 'in_review'];

async function backfillDoctorProfiles() {
  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.users') IS NOT NULL AND to_regclass('public.doctors') IS NOT NULL THEN
        INSERT INTO doctors (user_id, available, approval_status)
        SELECT u.id, FALSE, 'pending'
        FROM users u
        WHERE u.role = 'doctor'
          AND NOT EXISTS (
            SELECT 1
            FROM doctors d
            WHERE d.user_id = u.id
          );
      END IF;
    END $$;
  `);
}

router.get('/admin', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await backfillDoctorProfiles();

    const queryText = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';

    const filters = [];
    const values = [];

    if (queryText) {
      values.push(`%${queryText.toLowerCase()}%`);
      const idx = values.length;
      filters.push(`(
        LOWER(COALESCE(u.full_name, '')) LIKE $${idx}
        OR LOWER(COALESCE(u.email, '')) LIKE $${idx}
        OR LOWER(COALESCE(d.specialty, '')) LIKE $${idx}
      )`);
    }

    if (status && validStatuses.has(status)) {
      values.push(status);
      filters.push(`d.approval_status = $${values.length}`);
    } else {
      values.push(defaultQueueStatuses);
      filters.push(`d.approval_status = ANY($${values.length}::text[])`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await pool.query(
      `
        SELECT
          d.id,
          d.user_id,
          COALESCE(u.full_name, CONCAT('Doctor #', d.id::text)) AS full_name,
          u.email,
          d.specialty,
          d.qualification,
          d.consultation_fee,
          d.rating,
          d.available,
          d.approval_status,
          d.verification_notes,
          d.verification_documents,
          d.reviewed_by,
          d.reviewed_at
        FROM doctors d
        LEFT JOIN users u ON u.id = d.user_id
        ${whereClause}
        ORDER BY
          CASE d.approval_status
            WHEN 'pending' THEN 0
            WHEN 'pending_verification' THEN 1
            WHEN 'in_review' THEN 2
            WHEN 'rejected' THEN 3
            ELSE 4
          END,
          d.id DESC
      `,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('[DoctorService] GET /admin error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const result = await pool.query(
      `
        SELECT
          d.id,
          d.user_id,
          COALESCE(u.full_name, CONCAT('Doctor #', d.id::text)) AS full_name,
          u.email,
          d.phone,
          d.specialty,
          d.qualification,
          d.consultation_fee,
          d.rating,
          d.bio,
          d.available,
          d.approval_status,
          d.verification_notes,
          d.verification_documents,
          d.reviewed_by,
          d.reviewed_at,
          u.created_at,
          u.updated_at
        FROM doctors d
        LEFT JOIN users u ON u.id = d.user_id
        WHERE d.id = $1
        LIMIT 1
      `,
      [doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] GET /admin/:id error:', error);
    return res.status(500).json({ error: 'Failed to fetch doctor details' });
  }
});

router.get('/admin/:id/appointments', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const result = await pool.query(
      `
        SELECT
          a.id,
          a.doctor_id,
          a.patient_id,
          a.appointment_time,
          a.status,
          a.payment_status,
          COALESCE(p.name, CONCAT('Patient #', a.patient_id::text)) AS patient_name,
          d.consultation_fee AS fee
        FROM appointments a
        LEFT JOIN patients p ON p.user_id = a.patient_id
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.doctor_id = $1
        ORDER BY a.appointment_time DESC NULLS LAST, a.created_at DESC
      `,
      [doctorId]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      doctor_id: row.doctor_id,
      patient_name: row.patient_name,
      date: row.appointment_time ? new Date(row.appointment_time).toLocaleDateString() : null,
      time: row.appointment_time
        ? new Date(row.appointment_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null,
      status: row.status,
      fee: row.fee,
      payment_status: row.payment_status,
    }));

    return res.json({ items });
  } catch (error) {
    console.error('[DoctorService] GET /admin/:id/appointments error:', error);
    return res.status(500).json({ error: 'Failed to fetch doctor appointments' });
  }
});

router.get('/admin/:id/availability', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const result = await pool.query(
      `
        SELECT id, doctor_id, day_of_week, start_time, end_time, is_available
        FROM availability
        WHERE doctor_id = $1
        ORDER BY day_of_week, start_time
      `,
      [doctorId]
    );

    return res.json({ items: result.rows });
  } catch (error) {
    console.error('[DoctorService] GET /admin/:id/availability error:', error);
    return res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

router.get('/admin/:id/earnings', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const result = await pool.query(
      `
        SELECT
          COUNT(*)::int AS appointments,
          COALESCE(SUM(COALESCE(d.consultation_fee, 0)), 0)::numeric AS total,
          COALESCE(SUM(CASE WHEN a.payment_status = 'paid' THEN COALESCE(d.consultation_fee, 0) ELSE 0 END), 0)::numeric AS paid,
          COALESCE(SUM(CASE WHEN a.payment_status = 'pending' THEN COALESCE(d.consultation_fee, 0) ELSE 0 END), 0)::numeric AS pending
        FROM appointments a
        JOIN doctors d ON d.id = a.doctor_id
        WHERE a.doctor_id = $1
      `,
      [doctorId]
    );

    return res.json(result.rows[0] || { total: 0, pending: 0, paid: 0, appointments: 0 });
  } catch (error) {
    console.error('[DoctorService] GET /admin/:id/earnings error:', error);
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

router.get('/admin/:id/activities', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    const result = await pool.query(
      `
        SELECT created_at, type, description
        FROM (
          SELECT
            a.created_at,
            'appointment'::text AS type,
            CONCAT('Appointment ', a.status, ' for ', COALESCE(p.name, CONCAT('Patient #', a.patient_id::text))) AS description
          FROM appointments a
          LEFT JOIN patients p ON p.user_id = a.patient_id
          WHERE a.doctor_id = $1

          UNION ALL

          SELECT
            d.reviewed_at AS created_at,
            'verification'::text AS type,
            CONCAT('Verification status set to ', d.approval_status) AS description
          FROM doctors d
          WHERE d.id = $1 AND d.reviewed_at IS NOT NULL
        ) activity_feed
        ORDER BY created_at DESC NULLS LAST
        LIMIT 50
      `,
      [doctorId]
    );

    const items = result.rows.map((row, index) => ({
      id: index + 1,
      type: row.type,
      description: row.description,
      created_at: row.created_at,
    }));

    return res.json({ items });
  } catch (error) {
    console.error('[DoctorService] GET /admin/:id/activities error:', error);
    return res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.patch('/admin/:id/verification', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    const status = typeof req.body.status === 'string' ? req.body.status.trim() : '';
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    if (!validStatuses.has(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }

    const result = await pool.query(
      `
        UPDATE doctors
        SET approval_status = $1,
            verification_notes = NULLIF($2, ''),
            available = CASE WHEN $1 = 'approved' THEN TRUE ELSE FALSE END,
            reviewed_by = $3,
            reviewed_at = NOW()
        WHERE id = $4
        RETURNING id, user_id, approval_status, verification_notes, reviewed_by, reviewed_at
      `,
      [status, notes, req.user.id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] PATCH /admin/:id/verification error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/admin/:id/suspend', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    await pool.query('UPDATE doctors SET available = false WHERE id = $1', [doctorId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Suspend error:', error);
    res.status(500).json({ error: 'Failed to suspend doctor' });
  }
});

router.post('/admin/:id/activate', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    await pool.query('UPDATE doctors SET available = true WHERE id = $1', [doctorId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Activate error:', error);
    res.status(500).json({ error: 'Failed to activate doctor' });
  }
});

router.patch('/admin/:id/documents', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const doctorId = Number(req.params.id);
    const documents = Array.isArray(req.body.documents) ? req.body.documents : null;

    if (!Number.isFinite(doctorId)) {
      return res.status(400).json({ error: 'Invalid doctor id' });
    }

    if (!documents) {
      return res.status(400).json({ error: 'documents must be an array' });
    }

    const result = await pool.query(
      `
        UPDATE doctors
        SET verification_documents = $1::jsonb,
            reviewed_by = $2,
            reviewed_at = NOW()
        WHERE id = $3
        RETURNING id, user_id, verification_documents, reviewed_by, reviewed_at
      `,
      [JSON.stringify(documents), req.user.id, doctorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] PATCH /admin/:id/documents error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
