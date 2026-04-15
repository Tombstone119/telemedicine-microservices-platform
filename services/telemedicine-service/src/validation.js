const Joi = require('joi');

const validationSchemas = {
  // Session creation
  createSessionSchema: Joi.object({
    appointment_id: Joi.number().integer().positive().required(),
    doctor_name: Joi.string().max(255).required(),
    patient_name: Joi.string().max(255).required()
  }).required(),

  // Session status update
  updateSessionStatusSchema: Joi.object({
    status: Joi.string().valid('started', 'ended', 'cancelled').required()
  }).required(),

  // Join session
  joinSessionSchema: Joi.object({
    user_type: Joi.string().valid('doctor', 'patient').required()
  }).required()
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