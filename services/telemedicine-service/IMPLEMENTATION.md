# Telemedicine Service - Video Consultation Implementation

## Overview
This document summarizes the comprehensive video consultation system implemented for the telemedicine platform's telemedicine-service.

## Architecture Overview

### Database Schema
Two main tables were created in PostgreSQL:

#### 1. **video_sessions** table
Stores complete video session information:
- Appointment linkage (appointment_id)
- Participants (doctor_id, patient_id)
- Session details (room_id, meeting_link, jitsi_token)
- Status tracking (created, started, ended, cancelled)
- Timing information (start_time, end_time, duration)

#### 2. **session_participants** table
Tracks participant activity:
- Session linkage (session_id)
- User information (user_id, user_type)
- Activity timestamps (joined_at, left_at)

### Video Integration
- **Jitsi Meet** integration for video conferencing
- Secure room generation with unique IDs
- JWT token authentication for room access
- Meeting link generation with embedded tokens

## Implemented Features

### 1. Session Management
- **Create** video sessions for accepted appointments
- **Start/End** sessions with automatic timing
- **Status tracking** through session lifecycle
- **Participant management** with join/leave tracking

### 2. Video Integration Component
- **Jitsi API integration** with configurable domain
- **Secure room generation** using cryptographic hashing
- **JWT token generation** for authenticated access
- **Meeting link creation** with embedded security tokens

### 3. Session Service
- **Appointment validation** before session creation
- **Authorization checks** for session access
- **Session lifecycle management** (create → start → end)
- **Cross-service communication** with appointment service

### 4. Security Component
- **JWT token validation** for all protected endpoints
- **Role-based access control** (doctor/patient)
- **Session-specific authorization** checks
- **Secure token generation** for video room access

### 5. Notification System
- **Email notifications** for session invitations
- **Session reminders** before consultation
- **Status updates** (started, ended)
- **Integration** with notification service

### 6. Event Publishing
- **SessionCreated**: When video session is created
- **SessionStarted**: When consultation begins
- **SessionEnded**: When consultation completes
- **ParticipantJoined/Left**: Real-time participant tracking

## API Endpoints (10 total)

### Session Management (8 endpoints)
- `POST /api/sessions/create` - Create video session for appointment
- `GET /api/sessions/appointment/{appointmentId}` - Get session by appointment
- `GET /api/sessions/{sessionId}` - Get session details
- `GET /api/sessions/{sessionId}/join` - Get join URL with token
- `POST /api/sessions/{sessionId}/start` - Start video session
- `POST /api/sessions/{sessionId}/end` - End video session
- `POST /api/sessions/{sessionId}/join` - Join as participant
- `POST /api/sessions/{sessionId}/leave` - Leave session

### Participants (2 endpoints)
- `GET /api/sessions/{sessionId}/participants` - Get session participants
- `POST /api/sessions/{sessionId}/join` - Join session

## Dependencies Added

```json
{
  "pg": "^8.11.0",        // PostgreSQL client
  "amqplib": "^0.10.3",   // RabbitMQ client for events
  "axios": "^1.6.0",      // HTTP client for service communication
  "joi": "^17.11.0"       // Input validation
}
```

## Key Implementation Details

### Video Integration Architecture
- **Jitsi Meet** as the video platform
- **Secure room IDs** generated from appointment data
- **JWT authentication** for room access control
- **Fallback support** for public Jitsi instances

### Security Implementation
- **Multi-layer authentication**: JWT + session validation
- **Role-based permissions**: Doctor and patient access control
- **Secure token generation**: Cryptographic room IDs and JWTs
- **Access validation**: Appointment-based authorization

### Event-Driven Architecture
- **RabbitMQ integration** for microservices communication
- **Asynchronous event publishing** for scalability
- **Structured event data** with comprehensive metadata
- **Error isolation** preventing event failures from breaking core functionality

### Cross-Service Communication
- **Appointment service integration** for validation
- **Notification service** for user communications
- **RESTful APIs** for service-to-service calls
- **Error handling** with graceful degradation

## File Structure

```
services/telemedicine-service/
├── src/
│   ├── index.js              # Main application entry point
│   ├── db.js                # PostgreSQL connection pool
│   ├── schema.js            # Database schema initialization
│   ├── routes.js            # Session controller API routes
│   ├── sessionService.js    # Business logic for sessions
│   ├── sessionRepository.js # Database operations for sessions
│   ├── videoIntegration.js  # Jitsi integration component
│   ├── securityService.js   # Security and authentication
│   ├── notificationService.js # Notification triggers
│   ├── eventPublisher.js    # Event publishing to RabbitMQ
│   └── validation.js        # Input validation schemas
├── package.json             # Dependencies
├── .env                     # Environment variables
├── .env.example            # Environment template
├── Dockerfile              # Container configuration
└── IMPLEMENTATION.md       # This documentation
```

## Environment Variables

```env
PORT=3004
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=postgresql://admin:secret@localhost:5432/healthcare
RABBITMQ_URL=amqp://guest:guest@localhost:5672
JITSI_APP_ID=your_jitsi_app_id_here
JITSI_APP_SECRET=your_jitsi_app_secret_here
JITSI_DOMAIN=meet.jit.si
APPOINTMENT_SERVICE_URL=http://localhost:3003
NOTIFICATION_SERVICE_URL=http://localhost:3006
```

## Security Features

### Authentication & Authorization
- JWT-based authentication on all protected endpoints
- Role-based access control (doctor, patient)
- Session-specific authorization checks
- Secure token generation for video rooms

### Data Protection
- Parameterized database queries preventing SQL injection
- Secure password/token generation using crypto
- Input validation with Joi schemas
- Error message sanitization

### Video Security
- Unique room IDs per appointment
- JWT tokens for room authentication
- Participant validation before joining
- Secure meeting link generation

This implementation provides a complete, secure, and scalable video consultation system that integrates seamlessly with the telemedicine microservices platform.