# Healthcare Telemedicine Platform
SE3020 Distributed Systems – Assignment 1

## Local Development

### Prerequisites
Docker Desktop must be running.

### Start all services
```bash
docker compose up --build
```

### Access points
| Service | URL |
|---------|-----|
| API Gateway | http://localhost:80 |
| RabbitMQ UI | http://localhost:15672 (guest/guest) |
| Frontend | http://localhost:5173 |

## AI Symptom Service

The AI symptom service runs on port `3007` and is available behind gateway route `/api/ai-symptom/*`.

### Capabilities
- Chatbot interface with standard and streaming endpoints
- Voice pipeline (speech-to-text, AI analysis, text-to-speech)
- Doctor recommendation engine with PostgreSQL ranking

### Main Endpoints
- `POST /api/ai-symptom/chat/message`
- `POST /api/ai-symptom/chat/stream` (SSE)
- `POST /api/ai-symptom/voice/transcribe`
- `POST /api/ai-symptom/voice/synthesize`
- `POST /api/ai-symptom/voice/session-token`
- `POST /api/ai-symptom/voice/conversation`
- `POST /api/ai-symptom/recommendations/specialty`
- `POST /api/ai-symptom/recommendations/analyze`

All non-health endpoints require a valid Bearer JWT token.
