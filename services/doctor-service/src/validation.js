const Joi = require('joi');

const validationSchemas = {
  // Doctor profile creation
  createDoctorSchema: Joi.object({
    user_id: Joi.string().uuid().required(),
    first_name: Joi.string().max(255).required(),
    last_name: Joi.string().max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().max(20),
    specialty: Joi.string().max(255).required(),
    bio: Joi.string().allow(''),
    license_number: Joi.string().required(),
    license_expiry: Joi.date(),
    experience_years: Joi.number().integer().min(0).max(70),
    education: Joi.array().items(Joi.string()),
    hospital_affiliation: Joi.string().max(255),
    consultation_fee: Joi.number().positive(),
    languages: Joi.array().items(Joi.string()).default(['English'])
  }).required(),

  // Doctor profile update
  updateDoctorSchema: Joi.object({
    first_name: Joi.string().max(255),
    last_name: Joi.string().max(255),
    phone: Joi.string().max(20),
    specialty: Joi.string().max(255),
    bio: Joi.string().allow(''),
    license_expiry: Joi.date(),
    experience_years: Joi.number().integer().min(0).max(70),
    education: Joi.array().items(Joi.string()),
    hospital_affiliation: Joi.string().max(255),
    consultation_fee: Joi.number().positive(),
    languages: Joi.array().items(Joi.string()),
    avatar_url: Joi.string().uri(),
    is_active: Joi.boolean()
  }).required(),

  // Availability setting
  availabilitySchema: Joi.object({
    day_of_week: Joi.string().valid(
      'Monday', 'Tuesday', 'Wednesday', 'Thursday',
      'Friday', 'Saturday', 'Sunday'
    ).required(),
    start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
  }).required(),

  // Leave creation
  leaveSchema: Joi.object({
    leave_date: Joi.date().iso().required(),
    reason: Joi.string().max(255)
  }).required(),

  // List filters
  listFiltersSchema: Joi.object({
    specialty: Joi.string(),
    search: Joi.string().max(255),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const messages = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    return { valid: false, messages };
  }

  return { valid: true, value };
};

module.exports = {
  validationSchemas,
  validate
};
