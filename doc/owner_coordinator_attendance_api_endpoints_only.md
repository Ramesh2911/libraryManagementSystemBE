# SmartLibrary — Shared Owner & Coordinator Attendance API (Room-wise QR)

> Owner and Coordinator use the same endpoint paths. Backend permissions determine which Reading Rooms each user can access. Each Reading Room has a separate QR session.
>
> **Status:** The supplied API reference documents only `POST /api/attendance/sync` and `GET /api/attendance/:studentId`. The QR, register, and monthly-report contracts below are proposed and require backend confirmation.

## 1. Create a QR session for a Reading Room

**Method:** `POST`  
**Endpoint:** `/api/attendance/qr/session`

**Purpose:** Create/start a QR session for the selected Reading Room. Each room receives a distinct QR payload.

**Request body:**
```json
{
  "readingRoomId": "room_123",
  "validForSeconds": 60,
  "attendanceDate": "2026-11-24"
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "qr_sess_123",
    "readingRoomId": "room_123",
    "readingRoomName": "First Floor Reading Room",
    "qrPayload": "opaque-signed-session-token",
    "issuedAt": "2026-11-24T09:00:00+05:30",
    "expiresAt": "2026-11-24T09:01:00+05:30",
    "status": "active"
  }
}
```

## 2. Get the current QR session for a Reading Room

**Method:** `GET`  
**Endpoint:** `/api/attendance/qr/session?readingRoomId=room_123`

**Purpose:** Retrieve the current QR session when Owner or Coordinator opens/reopens the Attendance screen.

**Request body:** None.  
**Query parameters:**
- `readingRoomId` — required Reading Room ID.

**Success response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "qr_sess_123",
    "readingRoomId": "room_123",
    "readingRoomName": "First Floor Reading Room",
    "qrPayload": "opaque-signed-session-token",
    "issuedAt": "2026-11-24T09:00:00+05:30",
    "expiresAt": "2026-11-24T09:01:00+05:30",
    "status": "active"
  }
}
```

## 3. Stop a Reading Room QR session (Optional)

**Method:** `POST`  
**Endpoint:** `/api/attendance/qr/session/stop`

**Purpose:** Stop the active QR session for a Reading Room. Include this endpoint only if the app has a Stop QR action.

**Request body:**
```json
{
  "readingRoomId": "room_123",
  "sessionId": "qr_sess_123"
}
```

**Success response:**
```json
{
  "success": true,
  "message": "QR session stopped successfully",
  "data": {
    "sessionId": "qr_sess_123",
    "readingRoomId": "room_123",
    "status": "stopped",
    "stoppedAt": "2026-11-24T09:00:45+05:30"
  }
}
```

## 4. Student scans QR and checks in

**Method:** `POST`  
**Endpoint:** `/api/attendance/qr/check-in`

**Purpose:** Validate the scanned Reading Room QR and record the authenticated Student's attendance.

**Request body:**
```json
{
  "qrPayload": "opaque-signed-session-token",
  "deviceEventId": "unique-client-generated-event-id"
}
```

**Success response:**
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "attendanceId": "att_987",
    "studentId": "stu_123",
    "attendanceDate": "2026-11-24",
    "readingRoomId": "room_123",
    "readingRoomName": "First Floor Reading Room",
    "checkInAt": "2026-11-24T09:00:32+05:30",
    "status": "present",
    "source": "qr"
  }
}
```

**Duplicate check-in response:**
```json
{
  "success": false,
  "code": "ATTENDANCE_ALREADY_MARKED",
  "message": "Attendance has already been recorded for this period",
  "data": {
    "attendanceId": "att_987",
    "checkInAt": "2026-11-24T09:00:32+05:30",
    "status": "present"
  }
}
```

## 5. Get daily attendance register

**Method:** `GET`  
**Endpoint:** `/api/attendance`

**Purpose:** Get the daily attendance register and summary. Owner receives tenant-wide results; Coordinator receives only results for assigned/authorized Reading Rooms.

**Request body:** None.  
**Query parameters:**
- `date` — `YYYY-MM-DD`
- `readingRoomId` — optional Reading Room filter
- `status` — optional: `present`, `absent`, `late`, `half_day`, `leave`, `pending`
- `search` — optional Student name or admission number
- `floorId` — optional, if required by the UI
- `page` — page number
- `limit` — records per page
- `sort` — e.g. `checkInAt`
- `order` — `asc` or `desc`

**Success response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalStudents": 120,
      "present": 84,
      "absent": 20,
      "late": 6,
      "leave": 4,
      "pending": 6
    },
    "records": [
      {
        "attendanceId": "att_987",
        "student": {
          "id": "stu_123",
          "name": "Student Name",
          "admissionNumber": "SL-001"
        },
        "attendanceDate": "2026-11-24",
        "readingRoomId": "room_123",
        "readingRoomName": "First Floor Reading Room",
        "checkInAt": "2026-11-24T09:00:32+05:30",
        "status": "present",
        "source": "qr"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120,
      "totalPages": 6
    }
  }
}
```

## 6. Get Student attendance history

**Method:** `GET`  
**Endpoint:** `/api/attendance/:studentId`

**Purpose:** Get attendance history for a Student. This route is already documented in the supplied API reference; query parameters and response schema were not specified there.

**Request body:** None.  
**Suggested query parameters:** `from`, `to`, `month`, `status`, `page`, `limit`.

**Suggested success response:**
```json
{
  "success": true,
  "data": {
    "studentId": "stu_123",
    "records": [
      {
        "attendanceId": "att_987",
        "attendanceDate": "2026-11-24",
        "readingRoomId": "room_123",
        "readingRoomName": "First Floor Reading Room",
        "checkInAt": "2026-11-24T09:00:32+05:30",
        "status": "present",
        "source": "qr"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 22,
      "totalPages": 2
    }
  }
}
```

## 7. Get monthly attendance report

**Method:** `GET`  
**Endpoint:** `/api/attendance/report/monthly`

**Purpose:** Get the monthly attendance summary and Student-wise report. Owner can view tenant-wide data; Coordinator can view only authorized Reading Rooms.

**Request body:** None.  
**Query parameters:**
- `month` — required, `YYYY-MM`
- `readingRoomId` — optional Reading Room filter
- `studentId` — optional Student filter, if required by the UI

**Success response:**
```json
{
  "success": true,
  "data": {
    "month": "2026-11",
    "summary": {
      "workingDays": 25,
      "totalStudents": 120,
      "presentCount": 2100,
      "absentCount": 420,
      "lateCount": 80,
      "leaveCount": 40
    },
    "students": [
      {
        "studentId": "stu_123",
        "studentName": "Student Name",
        "presentDays": 22,
        "absentDays": 2,
        "lateDays": 1,
        "leaveDays": 0,
        "attendancePercentage": 88
      }
    ]
  }
}
```

## 8. Existing attendance sync endpoint

**Method:** `POST`  
**Endpoint:** `/api/attendance/sync`

**Purpose:** The route exists in the supplied API reference, but its purpose and request/response schema are not documented in the supplied materials. Confirm its intended use with the backend team before integrating it.

**Request body:** Not specified in the supplied API reference.  
**Response:** Not specified in the supplied API reference.

---

**Common headers (as used by the supplied Postman collection):**
```http
Authorization: Bearer <token>
x-tenant-id: <tenant_id>
```

**Access rule:** All Owner and Coordinator calls use the same endpoint paths. The backend must enforce tenant and Reading Room permissions; Coordinator access is limited to assigned/authorized rooms. Student identity for QR check-in must come from the authenticated Student session, not from a client-supplied `studentId`.
