#!/usr/bin/env bash

# run with bash test-patient-service.sh

BASE_URL="http://localhost"

separator() {
  echo "------------------------------------------------------------"
}

pretty_print() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    python3 -m json.tool
  fi
}

echo "Logging in as patient@test.com..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@test.com","password":"pass123"}' | jq -r '.token')

echo "TOKEN: $TOKEN"
separator

echo "TEST 1: POST /api/patients/profile"
curl -s -X POST "$BASE_URL/api/patients/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Silva",
    "phone": "+94771234567",
    "date_of_birth": "1990-05-15",
    "gender": "male",
    "blood_type": "O+",
    "address": "123 Galle Road, Colombo 03",
    "emergency_contact_name": "Mary Silva",
    "emergency_contact_phone": "+94779876543"
  }' | pretty_print
separator

echo "TEST 2: GET /api/patients/profile"
curl -s -X GET "$BASE_URL/api/patients/profile" \
  -H "Authorization: Bearer $TOKEN" | pretty_print
separator

echo "TEST 3: PUT /api/patients/profile"
curl -s -X PUT "$BASE_URL/api/patients/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Silva Updated",
    "phone": "+94771234568",
    "blood_type": "A+",
    "address": "456 Union Place, Colombo 02"
  }' | pretty_print
separator

echo "TEST 4: PUT /api/patients/medical-history"
curl -s -X PUT "$BASE_URL/api/patients/medical-history" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allergies": ["Penicillin", "Peanuts"],
    "conditions": ["Mild hypertension"],
    "medications": ["Lisinopril 10mg daily"],
    "notes": "No previous surgeries"
  }' | pretty_print
separator

echo "TEST 5: GET /api/patients/medical-history"
curl -s -X GET "$BASE_URL/api/patients/medical-history" \
  -H "Authorization: Bearer $TOKEN" | pretty_print
separator

echo "TEST 6: GET /api/patients/reports (should return empty array initially)"
curl -s -X GET "$BASE_URL/api/patients/reports" \
  -H "Authorization: Bearer $TOKEN" | pretty_print
separator

echo "TEST 7: GET /api/patients/prescriptions (should return empty array initially)"
curl -s -X GET "$BASE_URL/api/patients/prescriptions" \
  -H "Authorization: Bearer $TOKEN" | pretty_print
separator
