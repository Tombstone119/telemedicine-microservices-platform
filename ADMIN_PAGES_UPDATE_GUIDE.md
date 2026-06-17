# Admin Pages Update Guide - Correct API Endpoints

## ✅ COMPLETED FILES

### 1. **Patients.tsx** - UPDATED ✅
- Uses correct endpoint: `GET /api/patients/all`
- Features:
  - Client-side pagination (20 items per page)
  - Search filtering by name, email, phone
  - Simple patient listing with view details link
  - Uses actual database fields: id, name, email, phone, blood_type

---

## 🔄 REMAINING TASKS

### 2. **AdminDoctors.tsx** - NEEDS UPDATE
**Current Issues:**
- Uses wrong endpoint structure
- Expected pagination but API returns all doctors as array

**Fix Required:**
```typescript
// WRONG ❌
const { data } = await api.get('/admin/doctors', { params });

// CORRECT ✅
const { data } = await api.get('/doctors/admin');
// Response: Array<Doctor> directly, no pagination needed
```

**Implementation:**
- Fetch all doctors once with `GET /api/doctors/admin`
- Apply client-side filtering (search, status)
- Apply client-side pagination

---

### 3. **DoctorDetail.tsx** - NEEDS UPDATE
**Current Issues:**
- Uses wrong endpoints for approving/suspending doctors
- Expects separate endpoints that don't exist

**Available Actions:**
```typescript
// Approve/Verify doctor
await api.patch(`/doctors/admin/${doctorId}/verification`, { 
  status: 'approved' | 'rejected' | 'pending' | 'in_review'
});

// Suspend doctor
await api.post(`/doctors/admin/${doctorId}/suspend`);

// Activate doctor  
await api.post(`/doctors/admin/${doctorId}/activate`);
```

**Doctor Fields from API:**
- id, user_id, full_name, email, specialty
- qualification, consultation_fee, rating
- available, approval_status
- verification_notes, verification_documents
- reviewed_by, reviewed_at

---

### 4. **PatientDetail.tsx** - NEEDS UPDATE
**Current Issues:**
- Calls endpoints that don't exist
- Expects data structure that API doesn't provide

**Correct Endpoint:**
```typescript
// Get patient details
const { data } = await api.get(`/patients/${patientId}`);
// Returns: Patient object + medical_history array
```

**Available Patient Fields:**
- id, name, email, phone, blood_type
- created_at
- medical_history (array from join query)

---

## 📋 API REFERENCE

### Doctor Management
| Action | Endpoint | Method | Status |
|--------|----------|--------|--------|
| List all doctors | `/api/doctors/admin` | GET | ✅ Ready |
| Approve doctor | `/api/doctors/admin/:id/verification` | PATCH | ✅ Ready |
| Suspend doctor | `/api/doctors/admin/:id/suspend` | POST | ✅ Ready |
| Activate doctor | `/api/doctors/admin/:id/activate` | POST | ✅ Ready |

### Patient Management
| Action | Endpoint | Method | Status |
|--------|----------|--------|--------|
| List all patients | `/api/patients/all` | GET | ✅ Ready |
| Get patient | `/api/patients/:id` | GET | ✅ Ready |

---

## 🔧 KEY IMPLEMENTATION NOTES

1. **No server-side pagination**: Both APIs return arrays directly
   - Implement client-side pagination with `.slice()`
   
2. **Client-side filtering**: Filter before pagination
   - Search: filter by name, email, specialty/phone
   - Status: for doctors only (approval_status)

3. **Single fetch model**:
   - Load all data once on component mount
   - Apply filters/pagination in real-time without re-fetching

4. **Field mapping**:
   - Doctor: `full_name` (not `name`)
   - Patient: `name` (not `full_name`)

---

## ✨ Files Already Working

- ✅ **AdminPatientsPage.tsx** - Created with correct endpoints
- ✅ **Patients.tsx** - Updated with correct endpoints
- ✅ Database schema matches API responses
