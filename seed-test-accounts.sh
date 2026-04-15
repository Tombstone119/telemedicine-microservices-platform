#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"

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
  python3 - <<'PY' "$json" "$field"
import json
import sys

payload = sys.argv[1]
field = sys.argv[2]
try:
    data = json.loads(payload)
    value = data.get(field, "")
    if value is None:
        value = ""
    print(value)
except Exception:
    print("")
PY
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

  local payload
  payload=$(cat <<JSON
{"specialty":"${specialty}","qualification":"${qualification}","consultation_fee":${fee}}
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
  exists=$(python3 - <<'PY' "$RESPONSE_BODY" "$day_of_week" "$start_time" "$end_time"
import json
import sys

raw = sys.argv[1]
day = int(sys.argv[2])
start = sys.argv[3]
end = sys.argv[4]

try:
    items = json.loads(raw)
except Exception:
    items = []

found = False
for item in items:
    item_day = item.get('day_of_week')
    item_start = str(item.get('start_time', ''))[:5]
    item_end = str(item.get('end_time', ''))[:5]
    item_available = item.get('is_available', True)
    if item_day == day and item_start == start and item_end == end and item_available is not False:
        found = True
        break

print('1' if found else '0')
PY
)

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

main() {
  require_cmd curl
  require_cmd python3

  log "Seeding test users into ${BASE_URL}"

  patient1_token=$(register_or_login "patient1@test.com" "pass12345" "patient" "Nadeesha Perera")
  seed_patient_profile "$patient1_token" "Nadeesha Perera" "+94771230001" "1994-03-12" "female" "A+" "12 Temple Road, Colombo" "Kamal Perera" "+94770110001"

  patient2_token=$(register_or_login "patient2@test.com" "pass12345" "patient" "Kasun Silva")
  seed_patient_profile "$patient2_token" "Kasun Silva" "+94771230002" "1988-11-05" "male" "O+" "85 Kandy Road, Kandy" "Dinushi Silva" "+94770110002"

  doctor1_token=$(register_or_login "doctor1@test.com" "pass12345" "doctor" "Dr. Ayesha Fernando")
  seed_doctor_profile "$doctor1_token" "Dermatology" "MBBS, MD Dermatology" "4500"
  ensure_doctor_availability "$doctor1_token" 1 "09:00" "12:00"
  ensure_doctor_availability "$doctor1_token" 3 "14:00" "17:00"

  doctor2_token=$(register_or_login "doctor2@test.com" "pass12345" "doctor" "Dr. Nimal Perera")
  seed_doctor_profile "$doctor2_token" "General Medicine" "MBBS, MD Internal Medicine" "3500"
  ensure_doctor_availability "$doctor2_token" 2 "10:00" "13:00"
  ensure_doctor_availability "$doctor2_token" 4 "15:00" "18:00"

  log "Seed complete. Test credentials:"
  echo "  patient1@test.com / pass12345"
  echo "  patient2@test.com / pass12345"
  echo "  doctor1@test.com / pass12345"
  echo "  doctor2@test.com / pass12345"
}

main
