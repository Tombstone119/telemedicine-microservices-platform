const { verifyToken, requireRole } = require('../../../../shared/middleware/auth');
const { pool } = require('../db');
const multer = require('multer');

const router = require('express').Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
});

function parseDocumentMeta(rawMeta) {
  if (!rawMeta) return [];

  if (Array.isArray(rawMeta)) return rawMeta;

  if (typeof rawMeta === 'string') {
    try {
      const parsed = JSON.parse(rawMeta);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function mergeDocuments(existing, next) {
  const merged = new Map();

  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(next) ? next : [])].forEach((doc) => {
    if (!doc || typeof doc !== 'object') return;
    const candidate = doc;
    if (!candidate.type) return;
    merged.set(candidate.type, candidate);
  });

  return Array.from(merged.values());
}

async function getDoctorByUserId(userId) {
  const result = await pool.query(
    `SELECT * FROM doctors WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function upsertDoctorProfile(userId, fields) {
  const existing = await getDoctorByUserId(userId);
  const {
    specialty,
    qualification,
    consultation_fee,
    phone,
    experience,
    license_number,
    bio,
    approval_status,
    verification_documents,
    verification_notes,
    reviewed_by,
    reviewed_at,
  } = fields;

  const hasApprovalStatus = Object.prototype.hasOwnProperty.call(fields, 'approval_status');
  const hasDocuments = Object.prototype.hasOwnProperty.call(fields, 'verification_documents');
  const hasNotes = Object.prototype.hasOwnProperty.call(fields, 'verification_notes');
  const hasReviewedBy = Object.prototype.hasOwnProperty.call(fields, 'reviewed_by');
  const hasReviewedAt = Object.prototype.hasOwnProperty.call(fields, 'reviewed_at');

  if (!existing) {
    return pool.query(
      `
        INSERT INTO doctors (
          user_id,
          specialty,
          qualification,
          consultation_fee,
          phone,
          experience,
          license_number,
          bio,
          available,
          approval_status,
          verification_documents,
          verification_notes,
          reviewed_by,
          reviewed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, COALESCE($9, 'pending'), COALESCE($10::jsonb, '[]'::jsonb), $11, $12, $13)
        RETURNING *
      `,
      [
        userId,
        specialty || null,
        qualification || null,
        consultation_fee != null ? consultation_fee : null,
        phone || null,
        experience != null ? experience : null,
        license_number || null,
        bio || null,
        hasApprovalStatus ? approval_status : null,
        hasDocuments ? JSON.stringify(verification_documents) : null,
        hasNotes ? verification_notes || null : null,
        hasReviewedBy ? (reviewed_by != null ? reviewed_by : null) : null,
        hasReviewedAt ? reviewed_at || null : null,
      ]
    );
  }

  return pool.query(
    `
      UPDATE doctors
      SET
        specialty = COALESCE($2, specialty),
        qualification = COALESCE($3, qualification),
        consultation_fee = COALESCE($4, consultation_fee),
        phone = COALESCE($5, phone),
        experience = COALESCE($6, experience),
        license_number = COALESCE($7, license_number),
        bio = COALESCE($8, bio),
        approval_status = CASE WHEN $9::boolean THEN COALESCE($10, approval_status) ELSE approval_status END,
        verification_documents = CASE WHEN $11::boolean THEN COALESCE($12::jsonb, verification_documents) ELSE verification_documents END,
        verification_notes = CASE WHEN $13::boolean THEN $14 ELSE verification_notes END,
        reviewed_by = CASE WHEN $15::boolean THEN $16 ELSE reviewed_by END,
        reviewed_at = CASE WHEN $17::boolean THEN $18 ELSE reviewed_at END
      WHERE user_id = $1
      RETURNING *
    `,
    [
      userId,
      specialty || null,
      qualification || null,
      consultation_fee != null ? consultation_fee : null,
      phone || null,
      experience != null ? experience : null,
      license_number || null,
      bio || null,
      hasApprovalStatus,
      approval_status || null,
      hasDocuments,
      hasDocuments ? JSON.stringify(verification_documents) : null,
      hasNotes,
      hasNotes ? verification_notes || null : null,
      hasReviewedBy,
      hasReviewedBy ? (reviewed_by != null ? reviewed_by : null) : null,
      hasReviewedAt,
      hasReviewedAt ? reviewed_at || null : null,
    ]
  );
}

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(requireRole('doctor'));

// Get doctor profile
router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM doctors
       WHERE user_id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] GET /profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update doctor profile
router.put('/profile', async (req, res) => {
  try {
    const {
      specialty,
      qualification,
      consultation_fee,
      phone,
      experience,
      license_number,
      bio,
      approval_status,
      verification_documents,
      verification_notes,
    } = req.body;

    const result = await upsertDoctorProfile(req.user.id, {
      specialty,
      qualification,
      consultation_fee,
      phone,
      experience,
      license_number,
      bio,
      approval_status,
      verification_documents,
      verification_notes,
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] PUT /profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/verification/documents', async (req, res) => {
  upload.any()(req, res, async (uploadError) => {
    if (uploadError) {
      console.error('[DoctorService] POST /verification/documents upload error:', uploadError);
      return res.status(400).json({ error: uploadError.message || 'Failed to upload documents' });
    }

    try {
      const doctor = await getDoctorByUserId(req.user.id);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor profile not found' });
      }

      const metaEntries = parseDocumentMeta(req.body.meta);
      const uploadedDocs = (req.files || []).map((file, index) => {
        const meta = metaEntries.find((entry) => entry && entry.type && file.fieldname.includes(String(entry.type))) || metaEntries[index] || {};
        const type = typeof meta.type === 'string' ? meta.type : String(file.fieldname || 'medical_license').replace(/^document_/, '') || 'medical_license';
        const mimeType = file.mimetype || (typeof meta.mimeType === 'string' ? meta.mimeType : 'application/octet-stream');
        const name = typeof meta.name === 'string' ? meta.name : file.originalname;
        const url = `data:${mimeType};base64,${file.buffer.toString('base64')}`;

        return {
          type,
          name,
          url,
          mimeType,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };
      });

      const mergedDocuments = mergeDocuments(doctor.verification_documents, uploadedDocs);

      const result = await upsertDoctorProfile(req.user.id, {
        verification_documents: mergedDocuments,
        approval_status: doctor.approval_status === 'approved' ? doctor.approval_status : 'pending_verification',
        verification_notes: doctor.approval_status === 'approved' ? doctor.verification_notes : null,
        reviewed_by: null,
        reviewed_at: null,
      });

      return res.json({
        documents: result.rows[0]?.verification_documents || mergedDocuments,
        approval_status: result.rows[0]?.approval_status || 'pending_verification',
        verification_notes: result.rows[0]?.verification_notes || null,
      });
    } catch (error) {
      console.error('[DoctorService] POST /verification/documents error:', error);
      return res.status(500).json({ error: 'Failed to store verification documents' });
    }
  });
});

router.post('/verification/submit', async (req, res) => {
  try {
    const doctor = await getDoctorByUserId(req.user.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const documents = Array.isArray(req.body.verification_documents) ? req.body.verification_documents : doctor.verification_documents || [];
    const approvalStatus = typeof req.body.approval_status === 'string' && req.body.approval_status.trim() ? req.body.approval_status.trim() : 'pending_verification';
    const verificationNotes = typeof req.body.verification_notes === 'string' ? req.body.verification_notes.trim() : null;

    const result = await upsertDoctorProfile(req.user.id, {
      approval_status: approvalStatus,
      verification_documents: mergeDocuments(doctor.verification_documents, documents),
      verification_notes: verificationNotes,
      reviewed_by: null,
      reviewed_at: null,
    });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[DoctorService] POST /verification/submit error:', error);
    return res.status(500).json({ error: 'Failed to submit verification application' });
  }
});

module.exports = router;
