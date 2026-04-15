# Doctor Service API Documentation

## Overview
The Doctor Service manages doctor profiles, availability schedules, and leave management for the telemedicine platform.

## Base URL
```
http://localhost:3002/api
```

---

## Doctor Profile Endpoints

### List All Doctors
**GET** `/doctors`
- **Description**: Get list of active doctors with optional filters
- **Authentication**: Not required
- **Query Parameters**:
  - `specialty` (string, optional): Filter by medical specialty
  - `search` (string, optional): Search by name or email
  - `limit` (number, optional): Max results per page (default: 20, max: 100)
  - `offset` (number, optional): Pagination offset (default: 0)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "doctors": [
      {
        "id": 1,
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@hospital.com",
        "phone": "+1234567890",
        "specialty": "Cardiology",
        "bio": "Experienced cardiologist",
        "license_number": "LIC123456",
        "license_expiry": "2025-12-31",
        "experience_years": 10,
        "education": ["MD", "Board Certified"],
        "hospital_affiliation": "City Hospital",
        "consultation_fee": 150.00,
        "languages": ["English", "Spanish"],
        "avatar_url": "https://...",
        "is_active": true,
        "created_at": "2024-03-26T10:00:00Z",
        "updated_at": "2024-03-26T10:00:00Z"
      }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0,
    "pages": 3
  }
}
```

---

### Get Doctor Profile by ID
**GET** `/doctors/profile/:doctorId`
- **Description**: Get specific doctor's profile
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID

**Response (200)**:
```json
{
  "success": true,
  "data": { /* doctor object */ }
}
```

**Response (404)**:
```json
{ "error": "Doctor not found" }
```

---

### Get Current User's Doctor Profile
**GET** `/doctors/me`
- **Description**: Get authenticated doctor's own profile
- **Authentication**: Required (JWT token)
- **Headers**: `Authorization: Bearer <token>`

**Response (200)**:
```json
{
  "success": true,
  "data": { /* doctor object */ }
}
```

---

### Create Doctor Profile
**POST** `/doctors`
- **Description**: Create a new doctor profile (admin/doctor role required)
- **Authentication**: Required (JWT token, admin or doctor role)
- **Request Body**:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@hospital.com",
  "phone": "+1987654321",
  "specialty": "Neurology",
  "bio": "Specialized in neurological disorders",
  "license_number": "LIC987654",
  "license_expiry": "2026-12-31",
  "experience_years": 8,
  "education": ["MD", "Neurology Fellowship"],
  "hospital_affiliation": "Central Hospital",
  "consultation_fee": 200.00,
  "languages": ["English", "French"]
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Doctor profile created successfully",
  "data": { /* created doctor object */ }
}
```

**Response (409)**:
```json
{ "error": "Doctor with this email already exists" }
```

---

### Update Doctor Profile
**PUT** `/doctors/:doctorId`
- **Description**: Update doctor profile (doctor can update own, admin can update any)
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
- **Request Body** (all fields optional):
```json
{
  "phone": "+1111111111",
  "bio": "Updated bio",
  "consultation_fee": 175.00,
  "hospital_affiliation": "New Hospital",
  "avatar_url": "https://...",
  "languages": ["English", "Spanish", "French"]
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Doctor profile updated successfully",
  "data": { /* updated doctor object */ }
}
```

---

### Delete Doctor Profile
**DELETE** `/doctors/:doctorId`
- **Description**: Soft delete doctor profile (admin only)
- **Authentication**: Required (JWT token, admin role)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID

**Response (200)**:
```json
{
  "success": true,
  "message": "Doctor profile deleted successfully"
}
```

---

## Availability Endpoints

### Get Doctor Availability Schedule
**GET** `/doctors/:doctorId/availability`
- **Description**: Get doctor's weekly availability schedule
- **Authentication**: Not required
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "doctor_id": "1",
    "schedule": [
      {
        "id": 1,
        "doctor_id": 1,
        "day_of_week": "Monday",
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "is_available": true,
        "created_at": "2024-03-26T10:00:00Z",
        "updated_at": "2024-03-26T10:00:00Z"
      },
      {
        "id": 2,
        "doctor_id": 1,
        "day_of_week": "Tuesday",
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "is_available": true,
        "created_at": "2024-03-26T10:00:00Z",
        "updated_at": "2024-03-26T10:00:00Z"
      }
    ]
  }
}
```

---

### Set Doctor Availability
**POST** `/doctors/:doctorId/availability`
- **Description**: Set or update availability for a specific day
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
- **Request Body**:
```json
{
  "day_of_week": "Monday",
  "start_time": "09:00",
  "end_time": "17:00"
}
```

**Valid Days**: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
**Time Format**: HH:MM (24-hour format)

**Response (201)**:
```json
{
  "success": true,
  "message": "Availability updated successfully",
  "data": {
    "id": 1,
    "doctor_id": 1,
    "day_of_week": "Monday",
    "start_time": "09:00:00",
    "end_time": "17:00:00",
    "is_available": true,
    "created_at": "2024-03-26T10:00:00Z",
    "updated_at": "2024-03-26T10:00:00Z"
  }
}
```

---

### Mark Day as Unavailable
**POST** `/doctors/:doctorId/availability/unavailable`
- **Description**: Mark an entire day as unavailable (e.g., no consultations)
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
- **Request Body**:
```json
{
  "day_of_week": "Sunday"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Day marked as unavailable",
  "data": { /* availability object */ }
}
```

---

### Delete Availability for a Day
**DELETE** `/doctors/:doctorId/availability/:dayOfWeek`
- **Description**: Remove availability entry for a specific day
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
  - `dayOfWeek` (string, path): Day of week (Monday-Sunday)

**Response (200)**:
```json
{
  "success": true,
  "message": "Availability removed successfully"
}
```

---

## Leave Management Endpoints

### Get Doctor's Leaves
**GET** `/doctors/:doctorId/leaves`
- **Description**: Get doctor's leave dates
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
- **Query Parameters**:
  - `from_date` (date, optional): Start date (YYYY-MM-DD)
  - `to_date` (date, optional): End date (YYYY-MM-DD)

**Response (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "doctor_id": 1,
      "leave_date": "2024-04-15",
      "reason": "Annual leave",
      "created_at": "2024-03-26T10:00:00Z"
    },
    {
      "id": 2,
      "doctor_id": 1,
      "leave_date": "2024-04-16",
      "reason": "Annual leave",
      "created_at": "2024-03-26T10:00:00Z"
    }
  ]
}
```

---

### Add Leave
**POST** `/doctors/:doctorId/leaves`
- **Description**: Add a leave date for the doctor
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
- **Request Body**:
```json
{
  "leave_date": "2024-04-20",
  "reason": "Medical appointment"
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Leave added successfully",
  "data": {
    "id": 3,
    "doctor_id": 1,
    "leave_date": "2024-04-20",
    "reason": "Medical appointment",
    "created_at": "2024-03-26T10:00:00Z"
  }
}
```

---

### Delete Leave
**DELETE** `/doctors/:doctorId/leaves/:leaveDate`
- **Description**: Remove a leave date
- **Authentication**: Required (JWT token)
- **Parameters**:
  - `doctorId` (integer, path): Doctor ID
  - `leaveDate` (string, path): Leave date (YYYY-MM-DD)

**Response (200)**:
```json
{
  "success": true,
  "message": "Leave removed successfully"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "errors": [
    {
      "field": "email",
      "message": "\"email\" must be a valid email"
    }
  ]
}
```

### 401 Unauthorized
```json
{ "error": "No token provided" }
```

### 403 Forbidden
```json
{ "error": "Unauthorized to update this profile" }
```

### 404 Not Found
```json
{ "error": "Doctor not found" }
```

### 500 Internal Server Error
```json
{ "error": "Failed to create doctor profile" }
```

---

## Authentication Headers
All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

## Token Payload
The JWT token should contain:
```json
{
  "sub": "user-id-uuid",
  "id": "user-id-uuid",
  "role": "doctor|admin",
  "email": "user@example.com"
}
```

---

## Notes
- All timestamps are in ISO 8601 format (UTC)
- Doctor can only modify their own profile and availability (except admins)
- Soft deletes preserve data integrity
- Availability times are in 24-hour format (00:00-23:59)
- Leave dates are de-duplicated by doctor_id and leave_date combination
