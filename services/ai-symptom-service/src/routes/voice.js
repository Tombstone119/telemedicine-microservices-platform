const multer = require('multer');

const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { ApiError } = require('../utils/errors');
const { verifyToken, requireRole } = require('../middleware/auth');
const whisperClient = require('../clients/whisperClient');
const ttsClient = require('../clients/ttsClient');
const { createRoomToken } = require('../clients/livekitClient');
const symptomEngine = require('../services/symptomEngine');
const recommendationService = require('../services/recommendationService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.use(verifyToken);
router.use(requireRole('patient', 'doctor', 'admin'));

router.post('/transcribe', upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'audio file is required (multipart/form-data, field name: audio)');
  }

  const transcript = await whisperClient.transcribe(req.file.buffer, req.file.mimetype);
  res.json({ transcript });
}));

router.post('/synthesize', asyncHandler(async (req, res) => {
  const { text, voice, audioFormat } = req.body;

  if (!text || typeof text !== 'string') {
    throw new ApiError(400, 'text is required');
  }

  const audio = await ttsClient.synthesize(text, { voice, audioFormat });
  res.json(audio);
}));

router.post('/session-token', asyncHandler(async (req, res) => {
  const { roomName, participantName } = req.body;

  if (!roomName || typeof roomName !== 'string') {
    throw new ApiError(400, 'roomName is required');
  }

  const identity = participantName || `user-${req.user.id}`;

  const session = createRoomToken(identity, roomName, {
    role: req.user.role,
    userId: req.user.id,
  });

  res.json(session);
}));

router.post('/conversation', upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'audio file is required (multipart/form-data, field name: audio)');
  }

  let conversationHistory = [];
  let patientContext = {};

  try {
    conversationHistory = req.body.conversationHistory
      ? JSON.parse(req.body.conversationHistory)
      : [];
    patientContext = req.body.patientContext
      ? JSON.parse(req.body.patientContext)
      : {};
  } catch (error) {
    throw new ApiError(400, 'conversationHistory/patientContext must be valid JSON strings');
  }

  const transcript = await whisperClient.transcribe(req.file.buffer, req.file.mimetype);

  const analysis = await symptomEngine.generateAnalysis({
    message: transcript,
    conversationHistory,
    patientContext,
  });

  const recommendations = await recommendationService.getTopDoctorRecommendations(
    analysis.recommendedSpecialty
  );

  const audio = await ttsClient.synthesize(analysis.replyText, {
    voice: req.body.voice,
    audioFormat: req.body.audioFormat,
  });

  res.json({
    transcript,
    analysis,
    recommendations,
    audio,
  });
}));

module.exports = router;
