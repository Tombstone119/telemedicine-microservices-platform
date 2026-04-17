const ollamaClient = require('../clients/claudeClient');

const SPECIALTY_KEYWORDS = [
  { specialty: 'cardiology', keywords: ['chest pain', 'palpitations', 'shortness of breath', 'heart'] },
  { specialty: 'dermatology', keywords: ['rash', 'itching', 'skin', 'acne', 'eczema'] },
  { specialty: 'neurology', keywords: ['headache', 'migraine', 'seizure', 'numbness', 'dizziness'] },
  { specialty: 'gastroenterology', keywords: ['stomach', 'abdominal', 'nausea', 'vomit', 'diarrhea'] },
  { specialty: 'orthopedics', keywords: ['joint pain', 'knee', 'back pain', 'fracture', 'sprain'] },
  { specialty: 'pulmonology', keywords: ['cough', 'asthma', 'wheezing', 'breathing'] },
  { specialty: 'ent', keywords: ['ear pain', 'sore throat', 'sinus', 'hearing'] },
  { specialty: 'psychiatry', keywords: ['anxiety', 'depression', 'panic', 'insomnia'] },
  { specialty: 'gynecology', keywords: ['menstrual', 'pregnancy', 'pelvic pain'] },
  { specialty: 'general medicine', keywords: ['fever', 'fatigue', 'weakness', 'infection'] },
];

function inferSpecialtyFromText(text) {
  const content = (text || '').toLowerCase();
  for (const item of SPECIALTY_KEYWORDS) {
    if (item.keywords.some((keyword) => content.includes(keyword))) {
      return item.specialty;
    }
  }
  return 'general medicine';
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function buildConversationMessages({ message, conversationHistory = [], patientContext = {} }) {
  const systemPrompt = [
    'You are a clinical triage assistant for a telemedicine platform.',
    'Be careful, concise, and safety-focused. Do not provide a final diagnosis.',
    'Always include emergency advice when red-flag symptoms are possible.',
    'Output strict JSON only with keys:',
    'replyText, probableConditions, redFlags, triageLevel, recommendedSpecialty, followUpQuestions.',
    'triageLevel must be one of: low, medium, high, emergency.',
  ].join(' ');

  const formattedHistory = conversationHistory
    .filter((entry) => entry && entry.role && entry.content)
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content),
    }));

  const contextBlock = Object.keys(patientContext || {}).length
    ? `Patient context: ${JSON.stringify(patientContext)}`
    : 'Patient context: none';

  return [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    {
      role: 'user',
      content: `${contextBlock}\nCurrent symptoms: ${message}`,
    },
  ];
}

async function generateAnalysis({ message, conversationHistory = [], patientContext = {} }) {
  const messages = buildConversationMessages({ message, conversationHistory, patientContext });
  const llmRaw = await ollamaClient.chat(messages, { format: 'json', temperature: 0.2 });
  const parsed = safeJsonParse(llmRaw);

  const fallbackSpecialty = inferSpecialtyFromText(`${message} ${llmRaw}`);

  return {
    replyText: parsed?.replyText || llmRaw || 'I need a little more detail about your symptoms.',
    probableConditions: Array.isArray(parsed?.probableConditions) ? parsed.probableConditions : [],
    redFlags: Array.isArray(parsed?.redFlags) ? parsed.redFlags : [],
    triageLevel: parsed?.triageLevel || 'medium',
    recommendedSpecialty: parsed?.recommendedSpecialty || fallbackSpecialty,
    followUpQuestions: Array.isArray(parsed?.followUpQuestions) ? parsed.followUpQuestions : [],
    disclaimer: 'This AI output is informational only and not a medical diagnosis.',
  };
}

async function streamConversation({ message, conversationHistory = [], patientContext = {}, onToken }) {
  const systemPrompt = [
    'You are a clinical triage assistant for telemedicine.',
    'Respond naturally in plain text for a patient conversation.',
    'Never claim a final diagnosis and include a short safety note when needed.',
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
      .filter((entry) => entry && entry.role && entry.content)
      .map((entry) => ({ role: entry.role, content: String(entry.content) })),
    {
      role: 'user',
      content: `${Object.keys(patientContext || {}).length ? `Patient context: ${JSON.stringify(patientContext)}\n` : ''}${message}`,
    },
  ];

  const fullResponse = await ollamaClient.streamChat(messages, {
    temperature: 0.3,
    onToken,
  });

  const recommendedSpecialty = inferSpecialtyFromText(`${message} ${fullResponse}`);

  return {
    replyText: fullResponse,
    recommendedSpecialty,
    disclaimer: 'This AI output is informational only and not a medical diagnosis.',
  };
}

module.exports = {
  generateAnalysis,
  streamConversation,
};
