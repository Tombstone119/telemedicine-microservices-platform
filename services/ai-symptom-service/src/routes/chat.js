const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/errors');
const { verifyToken, requireRole } = require('../middleware/auth');
const symptomEngine = require('../services/symptomEngine');
const recommendationService = require('../services/recommendationService');

router.use(verifyToken);
router.use(requireRole('patient', 'doctor', 'admin'));

router.post('/message', asyncHandler(async (req, res) => {
  const { message, conversationHistory = [], patientContext = {} } = req.body;

  if (!message || typeof message !== 'string') {
    throw new ApiError(400, 'message is required');
  }

  const analysis = await symptomEngine.generateAnalysis({
    message,
    conversationHistory,
    patientContext,
  });

  const recommendations = await recommendationService.getTopDoctorRecommendations(
    analysis.recommendedSpecialty
  );

  res.json({
    analysis,
    recommendations,
  });
}));

router.post('/stream', asyncHandler(async (req, res) => {
  const { message, conversationHistory = [], patientContext = {} } = req.body;

  if (!message || typeof message !== 'string') {
    throw new ApiError(400, 'message is required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const result = await symptomEngine.streamConversation({
      message,
      conversationHistory,
      patientContext,
      onToken: (token) => {
        res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
      },
    });

    const recommendations = await recommendationService.getTopDoctorRecommendations(
      result.recommendedSpecialty
    );

    res.write(`event: done\ndata: ${JSON.stringify({ result, recommendations })}\n\n`);
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
}));

module.exports = router;
