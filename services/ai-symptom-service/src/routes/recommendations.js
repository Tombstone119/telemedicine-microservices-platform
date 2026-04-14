const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/errors');
const { verifyToken, requireRole } = require('../middleware/auth');
const recommendationService = require('../services/recommendationService');
const symptomEngine = require('../services/symptomEngine');

router.use(verifyToken);
router.use(requireRole('patient', 'doctor', 'admin'));

router.post('/specialty', asyncHandler(async (req, res) => {
  const { specialty } = req.body;
  if (!specialty || typeof specialty !== 'string') {
    throw new ApiError(400, 'specialty is required');
  }

  const recommendations = await recommendationService.getTopDoctorRecommendations(specialty);
  res.json(recommendations);
}));

router.post('/analyze', asyncHandler(async (req, res) => {
  const { message, conversationHistory = [], patientContext = {} } = req.body;

  if (!message || typeof message !== 'string') {
    throw new ApiError(400, 'message is required');
  }

  const analysis = await symptomEngine.generateAnalysis({ message, conversationHistory, patientContext });
  const recommendations = await recommendationService.getTopDoctorRecommendations(
    analysis.recommendedSpecialty
  );

  res.json({ analysis, recommendations });
}));

module.exports = router;
