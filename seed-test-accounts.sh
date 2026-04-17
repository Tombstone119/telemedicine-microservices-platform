#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
MAX_WAIT="${MAX_WAIT:-120}"

log() {
  echo "[seed] $1" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed." >&2
    exit 1
  fi
}

extract_json_field() {
  local json="$1"
  local field="$2"
  echo "$json" | grep -o "\"${field}\":\"[^\"]*\"" | head -1 | cut -d'"' -f4 || true
}

extract_json_ids() {
  local json="$1"
  echo "$json" | grep -o '"id":[0-9]*' | cut -d':' -f2 || true
}

call_api() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local auth_header="${4:-}"

  local headers=(-H "Content-Type: application/json")
  if [[ -n "$auth_header" ]]; then
    headers+=(-H "Authorization: Bearer ${auth_header}")
  fi

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" "$url" "${headers[@]}" -d "$data" -w "\nHTTP_STATUS:%{http_code}"
  else
    curl -sS -X "$method" "$url" "${headers[@]}" -w "\nHTTP_STATUS:%{http_code}"
  fi
}

split_response() {
  local raw="$1"
  RESPONSE_BODY="${raw%$'\n'HTTP_STATUS:*}"
  RESPONSE_STATUS="${raw##*HTTP_STATUS:}"
}

# Wait for the gateway/API to be reachable before seeding
wait_for_api() {
  log "Waiting for API at ${BASE_URL} (up to ${MAX_WAIT}s)..."
  local elapsed=0
  until curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/auth/login" -H "Content-Type: application/json" -d '{}' 2>/dev/null | grep -qE "^[2-4]"; do
    if [[ $elapsed -ge $MAX_WAIT ]]; then
      echo "Timed out waiting for API to be ready." >&2
      exit 1
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  log "API is ready."
}

register_or_login() {
  local email="$1"
  local password="$2"
  local role="$3"
  local full_name="$4"

  local register_payload
  register_payload=$(cat <<JSON
{"email":"${email}","password":"${password}","role":"${role}","full_name":"${full_name}"}
JSON
)

  local register_raw
  register_raw=$(call_api "POST" "${BASE_URL}/api/auth/register" "$register_payload")
  split_response "$register_raw"

  if [[ "$RESPONSE_STATUS" == "201" ]]; then
    log "Registered ${role}: ${email}"
  elif [[ "$RESPONSE_STATUS" == "409" ]]; then
    log "Account already exists: ${email}"
  else
    echo "Register failed for ${email}. Status: ${RESPONSE_STATUS}" >&2
    echo "$RESPONSE_BODY" >&2
    exit 1
  fi

  local login_payload
  login_payload=$(cat <<JSON
{"email":"${email}","password":"${password}"}
JSON
)

  local login_raw
  login_raw=$(call_api "POST" "${BASE_URL}/api/auth/login" "$login_payload")
  split_response "$login_raw"

  if [[ "$RESPONSE_STATUS" != "200" ]]; then
    echo "Login failed for ${email}. Status: ${RESPONSE_STATUS}" >&2
    echo "$RESPONSE_BODY" >&2
    exit 1
  fi

  local token
  token=$(extract_json_field "$RESPONSE_BODY" "token")

  if [[ -z "$token" ]]; then
    echo "No token returned for ${email}" >&2
    echo "$RESPONSE_BODY" >&2
    exit 1
  fi

  echo "$token"
}

seed_patient_profile() {
  local token="$1"
  local name="$2"
  local phone="$3"
  local dob="$4"
  local gender="$5"
  local blood_type="$6"
  local address="$7"
  local em_name="$8"
  local em_phone="$9"

  local payload
  payload=$(cat <<JSON
{"name":"${name}","phone":"${phone}","date_of_birth":"${dob}","gender":"${gender}","blood_type":"${blood_type}","address":"${address}","emergency_contact_name":"${em_name}","emergency_contact_phone":"${em_phone}"}
JSON
)

  local create_raw
  create_raw=$(call_api "POST" "${BASE_URL}/api/patients/profile" "$payload" "$token")
  split_response "$create_raw"

  if [[ "$RESPONSE_STATUS" == "201" ]]; then
    log "Created patient profile: ${name}"
    return
  fi

  if [[ "$RESPONSE_STATUS" == "409" ]]; then
    local update_raw
    update_raw=$(call_api "PUT" "${BASE_URL}/api/patients/profile" "$payload" "$token")
    split_response "$update_raw"
    if [[ "$RESPONSE_STATUS" == "200" ]]; then
      log "Updated existing patient profile: ${name}"
      return
    fi
  fi

  echo "Patient profile seed failed for ${name}. Status: ${RESPONSE_STATUS}" >&2
  echo "$RESPONSE_BODY" >&2
  exit 1
}

seed_doctor_profile() {
  local token="$1"
  local specialty="$2"
  local qualification="$3"
  local fee="$4"
  local phone="$5"
  local experience="$6"
  local license="$7"
  local bio="$8"

  local payload
  payload=$(cat <<JSON
{"specialty":"${specialty}","qualification":"${qualification}","consultation_fee":${fee},"phone":"${phone}","experience":${experience},"license_number":"${license}","bio":"${bio}"}
JSON
)

  local raw
  raw=$(call_api "PUT" "${BASE_URL}/api/doctors/profile" "$payload" "$token")
  split_response "$raw"

  if [[ "$RESPONSE_STATUS" == "200" ]]; then
    log "Upserted doctor profile: ${specialty}"
    return
  fi

  echo "Doctor profile seed failed for ${specialty}. Status: ${RESPONSE_STATUS}" >&2
  echo "$RESPONSE_BODY" >&2
  exit 1
}

ensure_doctor_availability() {
  local token="$1"
  local day_of_week="$2"
  local start_time="$3"
  local end_time="$4"

  local current_raw
  current_raw=$(call_api "GET" "${BASE_URL}/api/doctors/availability" "" "$token")
  split_response "$current_raw"

  if [[ "$RESPONSE_STATUS" != "200" ]]; then
    echo "Doctor availability lookup failed. Status: ${RESPONSE_STATUS}" >&2
    echo "$RESPONSE_BODY" >&2
    exit 1
  fi

  local exists
  # Check if this day+time slot already exists in the response
  exists=$(echo "$RESPONSE_BODY" | grep -o "\"day_of_week\":${day_of_week}" | head -1 || true)
  # Verify start_time also matches to avoid false positives across days
  if [[ -n "$exists" ]] && echo "$RESPONSE_BODY" | grep -q "\"start_time\":\"${start_time}" 2>/dev/null; then
    exists="1"
  else
    exists="0"
  fi

  if [[ "$exists" == "1" ]]; then
    log "Doctor availability already exists: day ${day_of_week} ${start_time}-${end_time}"
    return
  fi

  local payload
  payload=$(cat <<JSON
{"day_of_week":${day_of_week},"start_time":"${start_time}","end_time":"${end_time}","is_available":true}
JSON
)

  local create_raw
  create_raw=$(call_api "POST" "${BASE_URL}/api/doctors/availability" "$payload" "$token")
  split_response "$create_raw"

  if [[ "$RESPONSE_STATUS" == "201" ]]; then
    log "Created doctor availability: day ${day_of_week} ${start_time}-${end_time}"
    return
  fi

  echo "Doctor availability seed failed. Status: ${RESPONSE_STATUS}" >&2
  echo "$RESPONSE_BODY" >&2
  exit 1
}

# Approve all pending doctors using admin token
approve_pending_doctors() {
  local admin_token="$1"

  local list_raw
  list_raw=$(call_api "GET" "${BASE_URL}/api/doctors/admin?approval_status=pending" "" "$admin_token")
  split_response "$list_raw"

  if [[ "$RESPONSE_STATUS" != "200" ]]; then
    log "Warning: could not fetch pending doctors. Status: ${RESPONSE_STATUS}"
    return
  fi

  local doctor_ids
  doctor_ids=$(extract_json_ids "$RESPONSE_BODY")

  if [[ -z "$doctor_ids" ]]; then
    log "No pending doctors to approve."
    return
  fi

  while IFS= read -r doctor_id; do
    [[ -z "$doctor_id" ]] && continue
    local approve_payload='{"status":"approved","notes":"Auto-approved by seed script"}'
    local approve_raw
    approve_raw=$(call_api "PATCH" "${BASE_URL}/api/doctors/admin/${doctor_id}/verification" "$approve_payload" "$admin_token")
    split_response "$approve_raw"
    if [[ "$RESPONSE_STATUS" == "200" ]]; then
      log "Approved doctor ID: ${doctor_id}"
    else
      log "Warning: could not approve doctor ID ${doctor_id}. Status: ${RESPONSE_STATUS}"
    fi
  done <<< "$doctor_ids"
}

main() {
  require_cmd curl

  wait_for_api

  log "Seeding test accounts into ${BASE_URL}"

  # ── Admin ──────────────────────────────────────────────────────────────────
  admin_token=$(register_or_login "admin@healthcare.com" "Admin@1234" "admin" "System Admin")

  # ── Patients ───────────────────────────────────────────────────────────────
  patient1_token=$(register_or_login "patient1@test.com" "pass12345" "patient" "Nadeesha Perera")
  seed_patient_profile "$patient1_token" "Nadeesha Perera" "+94771230001" "1994-03-12" "female" "A+" "12 Temple Road, Colombo" "Kamal Perera" "+94770110001"

  patient2_token=$(register_or_login "patient2@test.com" "pass12345" "patient" "Kasun Silva")
  seed_patient_profile "$patient2_token" "Kasun Silva" "+94771230002" "1988-11-05" "male" "O+" "85 Kandy Road, Kandy" "Dinushi Silva" "+94770110002"

  patient3_token=$(register_or_login "patient3@test.com" "pass12345" "patient" "Amali Jayawardena")
  seed_patient_profile "$patient3_token" "Amali Jayawardena" "+94771230003" "2000-07-22" "female" "B+" "34 Galle Road, Matara" "Ruwan Jayawardena" "+94770110003"

  # ── Doctors: register + profile ────────────────────────────────────────────
  doctor1_token=$(register_or_login "doctor1@test.com" "pass12345" "doctor" "Dr. Ayesha Fernando")
  seed_doctor_profile "$doctor1_token" "Dermatology" "MBBS, MD Dermatology" "4500" "+94771110001" "8" "LIC-DERM-001" "Specialist in skin disorders and cosmetic dermatology."

  doctor2_token=$(register_or_login "doctor2@test.com" "pass12345" "doctor" "Dr. Nimal Perera")
  seed_doctor_profile "$doctor2_token" "General Medicine" "MBBS, MD Internal Medicine" "3500" "+94771110002" "12" "LIC-GEN-002" "Experienced general practitioner with focus on preventive care."

  doctor3_token=$(register_or_login "doctor3@test.com" "pass12345" "doctor" "Dr. Chamari Wijesinghe")
  seed_doctor_profile "$doctor3_token" "Pediatrics" "MBBS, MD Pediatrics" "5000" "+94771110003" "10" "LIC-PED-003" "Child health specialist with expertise in newborn and adolescent care."

  # ── Approve all pending doctors (must happen before availability) ──────────
  approve_pending_doctors "$admin_token"

  # ── Doctors: availability (only works after approval) ─────────────────────
  ensure_doctor_availability "$doctor1_token" 1 "09:00" "12:00"
  ensure_doctor_availability "$doctor1_token" 3 "14:00" "17:00"
  ensure_doctor_availability "$doctor1_token" 5 "09:00" "12:00"

  ensure_doctor_availability "$doctor2_token" 2 "10:00" "13:00"
  ensure_doctor_availability "$doctor2_token" 4 "15:00" "18:00"

  ensure_doctor_availability "$doctor3_token" 1 "13:00" "17:00"
  ensure_doctor_availability "$doctor3_token" 3 "09:00" "12:00"
  ensure_doctor_availability "$doctor3_token" 5 "13:00" "16:00"

  log "──────────────────────────────────────────"
  log "Seed complete. Test credentials:"
  log ""
  log "  ADMIN"
  log "    admin@healthcare.com   / Admin@1234"
  log ""
  log "  PATIENTS"
  log "    patient1@test.com      / pass12345"
  log "    patient2@test.com      / pass12345"
  log "    patient3@test.com      / pass12345"
  log ""
  log "  DOCTORS"
  log "    doctor1@test.com       / pass12345  (Dermatology)"
  log "    doctor2@test.com       / pass12345  (General Medicine)"
  log "    doctor3@test.com       / pass12345  (Pediatrics)"
  log "──────────────────────────────────────────"
}

main
