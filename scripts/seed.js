/**
 * Seed script — inserts sample users, doctors, patients, availability, and appointments.
 * Run from repo root: node scripts/seed.js
 * Requires postgres to be reachable on localhost:5432 (i.e. Docker Compose running).
 *
 * All seeded accounts use password: Test@1234
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'admin',
  password: 'secret',
  database: 'healthcare',
});

const PASSWORD = 'Test@1234';

async function hash(pw) {
  return bcrypt.hash(pw, 10);
}

async function seed() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  try {
    await client.query('BEGIN');

    // ── Users ──────────────────────────────────────────────────────────────
    const users = [
      { email: 'admin@healthcare.com',    role: 'admin',   full_name: 'System Admin' },
      { email: 'dr.silva@healthcare.com', role: 'doctor',  full_name: 'Dr. Kasun Silva' },
      { email: 'dr.perera@healthcare.com',role: 'doctor',  full_name: 'Dr. Amara Perera' },
      { email: 'dr.fernando@healthcare.com', role: 'doctor', full_name: 'Dr. Nimal Fernando' },
      { email: 'patient1@mail.com',       role: 'patient', full_name: 'Saman Kumara' },
      { email: 'patient2@mail.com',       role: 'patient', full_name: 'Dilani Rathnayake' },
    ];

    const userIds = {};
    for (const u of users) {
      const ph = await hash(PASSWORD);
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (existing.rows.length > 0) {
        userIds[u.email] = existing.rows[0].id;
        console.log(`  skip user (exists): ${u.email}`);
        continue;
      }
      const res = await client.query(
        `INSERT INTO users (email, password_hash, role, full_name) VALUES ($1,$2,$3,$4) RETURNING id`,
        [u.email, ph, u.role, u.full_name]
      );
      userIds[u.email] = res.rows[0].id;
      console.log(`  inserted user: ${u.email} (id=${res.rows[0].id})`);
    }

    // ── Doctor profiles ────────────────────────────────────────────────────
    const doctors = [
      {
        email: 'dr.silva@healthcare.com',
        specialty: 'Cardiology',
        qualification: 'MBBS, MD (Cardiology)',
        consultation_fee: 2500,
        experience: 12,
        license_number: 'SLMC-10234',
        phone: '+94711234567',
        bio: 'Senior cardiologist with 12 years of experience at Colombo National Hospital.',
        approval_status: 'approved',
      },
      {
        email: 'dr.perera@healthcare.com',
        specialty: 'Pediatrics',
        qualification: 'MBBS, DCH',
        consultation_fee: 1800,
        experience: 8,
        license_number: 'SLMC-20891',
        phone: '+94729876543',
        bio: 'Dedicated pediatrician specialising in child development and immunisation.',
        approval_status: 'approved',
      },
      {
        email: 'dr.fernando@healthcare.com',
        specialty: 'General Practice',
        qualification: 'MBBS',
        consultation_fee: 1200,
        experience: 5,
        license_number: 'SLMC-31102',
        phone: '+94751112233',
        bio: 'General practitioner focused on preventive care and chronic disease management.',
        approval_status: 'approved',
      },
    ];

    const doctorIds = {};
    for (const d of doctors) {
      const uid = userIds[d.email];
      const existing = await client.query('SELECT id FROM doctors WHERE user_id = $1', [uid]);
      if (existing.rows.length > 0) {
        doctorIds[d.email] = existing.rows[0].id;
        console.log(`  skip doctor (exists): ${d.email}`);
        continue;
      }
      const res = await client.query(
        `INSERT INTO doctors
           (user_id, specialty, qualification, consultation_fee, experience,
            license_number, phone, bio, approval_status, available)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING id`,
        [uid, d.specialty, d.qualification, d.consultation_fee, d.experience,
         d.license_number, d.phone, d.bio, d.approval_status]
      );
      doctorIds[d.email] = res.rows[0].id;
      console.log(`  inserted doctor: ${d.email} (doctor_id=${res.rows[0].id})`);
    }

    // ── Availability (Mon-Fri 09:00-17:00) ────────────────────────────────
    for (const email of Object.keys(doctorIds)) {
      const did = doctorIds[email];
      const existingSlots = await client.query('SELECT id FROM availability WHERE doctor_id = $1 LIMIT 1', [did]);
      if (existingSlots.rows.length > 0) {
        console.log(`  skip availability (exists): doctor_id=${did}`);
        continue;
      }
      for (let day = 1; day <= 5; day++) {
        await client.query(
          `INSERT INTO availability (doctor_id, day_of_week, start_time, end_time, is_available)
           VALUES ($1,$2,'09:00','17:00',true)`,
          [did, day]
        );
      }
      console.log(`  inserted availability for doctor_id=${did}`);
    }

    // ── Patient profiles ───────────────────────────────────────────────────
    const patientProfiles = [
      {
        email: 'patient1@mail.com',
        name: 'Saman Kumara',
        phone: '+94701234567',
        date_of_birth: '1990-03-15',
        gender: 'male',
        blood_type: 'O+',
        address: '45 Galle Road, Colombo 03',
        emergency_contact_name: 'Nanda Kumara',
        emergency_contact_phone: '+94709876543',
      },
      {
        email: 'patient2@mail.com',
        name: 'Dilani Rathnayake',
        phone: '+94771122334',
        date_of_birth: '1995-07-22',
        gender: 'female',
        blood_type: 'A+',
        address: '12 Kandy Road, Peradeniya',
        emergency_contact_name: 'Rohan Rathnayake',
        emergency_contact_phone: '+94772233445',
      },
    ];

    const patientIds = {};
    for (const p of patientProfiles) {
      const uid = userIds[p.email];
      const existing = await client.query('SELECT id FROM patients WHERE user_id = $1', [uid]);
      if (existing.rows.length > 0) {
        patientIds[p.email] = existing.rows[0].id;
        console.log(`  skip patient (exists): ${p.email}`);
        continue;
      }
      const res = await client.query(
        `INSERT INTO patients
           (user_id, name, email, phone, date_of_birth, gender, blood_type,
            address, emergency_contact_name, emergency_contact_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [uid, p.name, p.email, p.phone, p.date_of_birth, p.gender, p.blood_type,
         p.address, p.emergency_contact_name, p.emergency_contact_phone]
      );
      patientIds[p.email] = res.rows[0].id;
      console.log(`  inserted patient: ${p.email} (patient_id=${res.rows[0].id})`);
    }

    // ── Medical history ────────────────────────────────────────────────────
    const histories = [
      {
        email: 'patient1@mail.com',
        allergies: ['Penicillin', 'Dust'],
        conditions: ['Hypertension'],
        medications: ['Amlodipine 5mg'],
        notes: 'Patient monitors BP weekly.',
      },
      {
        email: 'patient2@mail.com',
        allergies: [],
        conditions: ['Asthma'],
        medications: ['Salbutamol inhaler'],
        notes: 'Mild seasonal asthma, well controlled.',
      },
    ];

    for (const h of histories) {
      const pid = patientIds[h.email];
      if (!pid) continue;
      const existing = await client.query('SELECT id FROM medical_history WHERE patient_id = $1', [pid]);
      if (existing.rows.length > 0) {
        console.log(`  skip medical_history (exists): patient_id=${pid}`);
        continue;
      }
      await client.query(
        `INSERT INTO medical_history (patient_id, allergies, conditions, medications, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [pid, h.allergies, h.conditions, h.medications, h.notes]
      );
      console.log(`  inserted medical_history for patient_id=${pid}`);
    }

    // ── Sample appointments ────────────────────────────────────────────────
    const appointments = [
      {
        doctor_email: 'dr.silva@healthcare.com',
        patient_user_id_from: 'patient1@mail.com',
        appointment_time: '2026-04-20 10:00:00',
        status: 'confirmed',
        payment_status: 'paid',
      },
      {
        doctor_email: 'dr.perera@healthcare.com',
        patient_user_id_from: 'patient2@mail.com',
        appointment_time: '2026-04-22 14:00:00',
        status: 'scheduled',
        payment_status: 'pending',
      },
      {
        doctor_email: 'dr.fernando@healthcare.com',
        patient_user_id_from: 'patient1@mail.com',
        appointment_time: '2026-04-18 11:00:00',
        status: 'completed',
        payment_status: 'paid',
      },
    ];

    for (const a of appointments) {
      const did = doctorIds[a.doctor_email];
      const patUid = userIds[a.patient_user_id_from];
      if (!did || !patUid) continue;
      const existing = await client.query(
        'SELECT id FROM appointments WHERE doctor_id=$1 AND patient_id=$2 AND appointment_time=$3',
        [did, patUid, a.appointment_time]
      );
      if (existing.rows.length > 0) {
        console.log(`  skip appointment (exists): doctor_id=${did}`);
        continue;
      }
      await client.query(
        `INSERT INTO appointments (doctor_id, patient_id, appointment_time, status, payment_status)
         VALUES ($1,$2,$3,$4,$5)`,
        [did, patUid, a.appointment_time, a.status, a.payment_status]
      );
      console.log(`  inserted appointment: ${a.doctor_email} ← ${a.patient_user_id_from} @ ${a.appointment_time}`);
    }

    await client.query('COMMIT');
    console.log('\nSeed complete.');
    console.log('─────────────────────────────────────────');
    console.log('Login credentials (password: Test@1234)');
    console.log('  admin@healthcare.com        → admin');
    console.log('  dr.silva@healthcare.com     → doctor (Cardiology)');
    console.log('  dr.perera@healthcare.com    → doctor (Pediatrics)');
    console.log('  dr.fernando@healthcare.com  → doctor (General Practice)');
    console.log('  patient1@mail.com           → patient');
    console.log('  patient2@mail.com           → patient');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
