-- Seed data for telemedicine platform
-- All accounts use password: Test@1234
-- Hash: $2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm

BEGIN;

-- ── Users ──────────────────────────────────────────────────────────────────
INSERT INTO users (email, password_hash, role, full_name) VALUES
  ('admin@healthcare.com',       '$2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm', 'admin',   'System Admin'),
  ('dr.silva@healthcare.com',    '$2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm', 'doctor',  'Dr. Kasun Silva'),
  ('dr.perera@healthcare.com',   '$2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm', 'doctor',  'Dr. Amara Perera'),
  ('dr.fernando@healthcare.com', '$2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm', 'doctor',  'Dr. Nimal Fernando'),
  ('patient1@mail.com',          '$2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm', 'patient', 'Saman Kumara'),
  ('patient2@mail.com',          '$2b$10$AWqhUhAOe6VtRcio5NiPIuVpIMdS8BKyyiWXbofCWy0DJkTylxiYm', 'patient', 'Dilani Rathnayake')
ON CONFLICT (email) DO NOTHING;

-- ── Doctor profiles ────────────────────────────────────────────────────────
INSERT INTO doctors (user_id, specialty, qualification, consultation_fee, experience, license_number, phone, bio, approval_status, available)
SELECT id, 'Cardiology', 'MBBS, MD (Cardiology)', 2500, 12, 'SLMC-10234', '+94711234567',
       'Senior cardiologist with 12 years of experience at Colombo National Hospital.', 'approved', true
FROM users WHERE email = 'dr.silva@healthcare.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO doctors (user_id, specialty, qualification, consultation_fee, experience, license_number, phone, bio, approval_status, available)
SELECT id, 'Pediatrics', 'MBBS, DCH', 1800, 8, 'SLMC-20891', '+94729876543',
       'Dedicated pediatrician specialising in child development and immunisation.', 'approved', true
FROM users WHERE email = 'dr.perera@healthcare.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO doctors (user_id, specialty, qualification, consultation_fee, experience, license_number, phone, bio, approval_status, available)
SELECT id, 'General Practice', 'MBBS', 1200, 5, 'SLMC-31102', '+94751112233',
       'General practitioner focused on preventive care and chronic disease management.', 'approved', true
FROM users WHERE email = 'dr.fernando@healthcare.com'
ON CONFLICT (user_id) DO NOTHING;

-- ── Availability Mon–Fri 09:00–17:00 ──────────────────────────────────────
INSERT INTO availability (doctor_id, day_of_week, start_time, end_time, is_available)
SELECT d.id, g.day, '09:00', '17:00', true
FROM doctors d
JOIN users u ON u.id = d.user_id
CROSS JOIN generate_series(1,5) g(day)
WHERE u.email IN ('dr.silva@healthcare.com','dr.perera@healthcare.com','dr.fernando@healthcare.com')
  AND NOT EXISTS (
    SELECT 1 FROM availability a WHERE a.doctor_id = d.id AND a.day_of_week = g.day
  );

-- ── Patient profiles ───────────────────────────────────────────────────────
INSERT INTO patients (user_id, name, email, phone, date_of_birth, gender, blood_type, address, emergency_contact_name, emergency_contact_phone)
SELECT id, 'Saman Kumara', 'patient1@mail.com', '+94701234567', '1990-03-15', 'male', 'O+',
       '45 Galle Road, Colombo 03', 'Nanda Kumara', '+94709876543'
FROM users WHERE email = 'patient1@mail.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO patients (user_id, name, email, phone, date_of_birth, gender, blood_type, address, emergency_contact_name, emergency_contact_phone)
SELECT id, 'Dilani Rathnayake', 'patient2@mail.com', '+94771122334', '1995-07-22', 'female', 'A+',
       '12 Kandy Road, Peradeniya', 'Rohan Rathnayake', '+94772233445'
FROM users WHERE email = 'patient2@mail.com'
ON CONFLICT (user_id) DO NOTHING;

-- ── Medical history ────────────────────────────────────────────────────────
INSERT INTO medical_history (patient_id, allergies, conditions, medications, notes)
SELECT p.id, ARRAY['Penicillin','Dust'], ARRAY['Hypertension'], ARRAY['Amlodipine 5mg'],
       'Patient monitors BP weekly.'
FROM patients p WHERE p.email = 'patient1@mail.com'
  AND NOT EXISTS (SELECT 1 FROM medical_history mh WHERE mh.patient_id = p.id);

INSERT INTO medical_history (patient_id, allergies, conditions, medications, notes)
SELECT p.id, ARRAY[]::text[], ARRAY['Asthma'], ARRAY['Salbutamol inhaler'],
       'Mild seasonal asthma, well controlled.'
FROM patients p WHERE p.email = 'patient2@mail.com'
  AND NOT EXISTS (SELECT 1 FROM medical_history mh WHERE mh.patient_id = p.id);

-- ── Sample appointments ────────────────────────────────────────────────────
-- appointment_time uses integer patient_id from users table (that is what the service stores)
INSERT INTO appointments (doctor_id, patient_id, appointment_time, status, payment_status)
SELECT d.id, u.id, '2026-04-20 10:00:00', 'confirmed', 'paid'
FROM doctors d JOIN users pu ON pu.id = d.user_id
CROSS JOIN users u
WHERE pu.email = 'dr.silva@healthcare.com' AND u.email = 'patient1@mail.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a WHERE a.doctor_id=d.id AND a.patient_id=u.id AND a.appointment_time='2026-04-20 10:00:00'
  );

INSERT INTO appointments (doctor_id, patient_id, appointment_time, status, payment_status)
SELECT d.id, u.id, '2026-04-22 14:00:00', 'scheduled', 'pending'
FROM doctors d JOIN users pu ON pu.id = d.user_id
CROSS JOIN users u
WHERE pu.email = 'dr.perera@healthcare.com' AND u.email = 'patient2@mail.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a WHERE a.doctor_id=d.id AND a.patient_id=u.id AND a.appointment_time='2026-04-22 14:00:00'
  );

INSERT INTO appointments (doctor_id, patient_id, appointment_time, status, payment_status)
SELECT d.id, u.id, '2026-04-18 11:00:00', 'completed', 'paid'
FROM doctors d JOIN users pu ON pu.id = d.user_id
CROSS JOIN users u
WHERE pu.email = 'dr.fernando@healthcare.com' AND u.email = 'patient1@mail.com'
  AND NOT EXISTS (
    SELECT 1 FROM appointments a WHERE a.doctor_id=d.id AND a.patient_id=u.id AND a.appointment_time='2026-04-18 11:00:00'
  );

COMMIT;

-- Verify
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'doctors', COUNT(*) FROM doctors
UNION ALL SELECT 'patients', COUNT(*) FROM patients
UNION ALL SELECT 'availability', COUNT(*) FROM availability
UNION ALL SELECT 'medical_history', COUNT(*) FROM medical_history
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments;
