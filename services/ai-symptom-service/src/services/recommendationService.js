const { pool } = require('../db/pool');

function normalizeSpecialty(input) {
  if (!input) return 'general medicine';
  const value = String(input).toLowerCase().trim();

  if (
    value.includes('primary care') ||
    value.includes('general practitioner') ||
    value.includes('urgent care') ||
    value.includes('family medicine')
  ) {
    return 'general medicine';
  }

  const aliases = {
    cardiologist: 'cardiology',
    neurologist: 'neurology',
    dermatologist: 'dermatology',
    ent: 'ent',
    'general practitioner': 'general medicine',
    gp: 'general medicine',
  };

  return aliases[value] || value;
}

function toTimeString(date) {
  return date.toISOString().slice(11, 16);
}

function getNextWeekSlots(weeklyAvailability) {
  const now = new Date();
  const currentDay = now.getDay();
  const normalized = Array.isArray(weeklyAvailability) ? weeklyAvailability : [];

  const slots = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    const day = (currentDay + offset) % 7;

    const daySlots = normalized.filter(
      (item) => Number(item.day_of_week) === day && item.is_available !== false
    );

    for (const daySlot of daySlots) {
      const start = daySlot.start_time?.slice(0, 5) || '09:00';
      const end = daySlot.end_time?.slice(0, 5) || '17:00';

      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      const slotStart = new Date(candidate);
      slotStart.setHours(startHour, startMin, 0, 0);

      const slotEnd = new Date(candidate);
      slotEnd.setHours(endHour, endMin, 0, 0);

      if (slotEnd <= now) continue;

      slots.push({
        date: candidate.toISOString().slice(0, 10),
        startTime: toTimeString(slotStart),
        endTime: toTimeString(slotEnd),
      });
    }
  }

  return slots.slice(0, 5);
}

function computeScore(doctor, requestedSpecialty, minFee, maxFee) {
  const specialty = (doctor.specialty || '').toLowerCase();
  const specialtyScore = specialty.includes(requestedSpecialty) ? 1 : 0.5;
  const rating = Number(doctor.rating || 0);
  const ratingScore = Math.max(0, Math.min(rating / 5, 1));

  let feeScore = 0.5;
  const fee = Number(doctor.consultation_fee || 0);
  if (Number.isFinite(fee) && Number.isFinite(minFee) && Number.isFinite(maxFee) && maxFee > minFee) {
    feeScore = 1 - (fee - minFee) / (maxFee - minFee);
  }

  const availabilityScore = Array.isArray(doctor.nextSlots) && doctor.nextSlots.length ? 1 : 0;

  return (
    specialtyScore * 0.55 +
    ratingScore * 0.25 +
    feeScore * 0.1 +
    availabilityScore * 0.1
  );
}

async function getTopDoctorRecommendations(inputSpecialty) {
  const requestedSpecialty = normalizeSpecialty(inputSpecialty);

  const query = `
    SELECT
      d.id,
      d.user_id,
      u.full_name,
      d.specialty,
      d.qualification,
      d.consultation_fee,
      d.rating,
      d.available,
      COALESCE(
        json_agg(
          json_build_object(
            'day_of_week', a.day_of_week,
            'start_time', a.start_time,
            'end_time', a.end_time,
            'is_available', a.is_available
          )
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'::json
      ) AS weekly_availability
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    LEFT JOIN availability a ON a.doctor_id = d.id
    WHERE d.available = TRUE
      AND ($1::text IS NULL OR LOWER(d.specialty) LIKE LOWER('%' || $1 || '%'))
    GROUP BY d.id, u.full_name
    ORDER BY d.rating DESC NULLS LAST, d.consultation_fee ASC NULLS LAST
    LIMIT 25;
  `;

  let result = await pool.query(query, [requestedSpecialty]);

  if (result.rows.length === 0 && requestedSpecialty !== 'general medicine') {
    result = await pool.query(query, ['general medicine']);
  }

  const doctors = result.rows.map((row) => ({
    ...row,
    nextSlots: getNextWeekSlots(row.weekly_availability),
  }));

  const fees = doctors
    .map((doctor) => Number(doctor.consultation_fee))
    .filter((fee) => Number.isFinite(fee));
  const minFee = fees.length ? Math.min(...fees) : 0;
  const maxFee = fees.length ? Math.max(...fees) : 0;

  const ranked = doctors
    .map((doctor) => {
      const score = computeScore(doctor, requestedSpecialty, minFee, maxFee);
      return {
        doctorId: doctor.id,
        userId: doctor.user_id,
        doctorName: doctor.full_name || `Doctor #${doctor.id}`,
        specialty: doctor.specialty,
        qualification: doctor.qualification,
        rating: Number(doctor.rating || 0),
        consultationFee: doctor.consultation_fee,
        available: doctor.available,
        nextSlots: doctor.nextSlots,
        score: Number(score.toFixed(4)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    requestedSpecialty,
    recommendations: ranked,
  };
}

module.exports = {
  getTopDoctorRecommendations,
};
