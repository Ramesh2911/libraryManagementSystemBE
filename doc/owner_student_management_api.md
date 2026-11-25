# SmartLibrary - Owner Student Management API Documentation

**Version:** 1.0  
**Audience:** Backend developers, Flutter developers, QA  
**Module:** Owner -> Students, Add Student, New Admission, Student Profile, Student Requests & Queries  
**Base path:** `/api/v1`

---

## 1. Purpose and UI coverage

This specification defines the backend contract required by the existing Owner-side Student Management UI. It is based on the Flutter screens, providers and models in the supplied `lib.zip`.

The APIs cover:

1. All Students list, summary counters, search and combined filters.
2. Student profile - Overview, Payments and History tabs.
3. Add New Student form, mobile OTP verification, photo and document upload.
4. New Admission - floor, room, room type, seat availability, plan, time slot, dates and fee calculation.
5. Payment collection and payment confirmation.
6. Student Requests & Queries - seat booking, seat change, membership renewal and support issue review.
7. Student lifecycle actions, seat transfer and admission/payment history.

**Important implementation note:** The supplied Flutter providers currently contain demo/static data and TODO flows. The endpoints below are the proposed production API contract to replace those local implementations. They are not claims that a backend already exists.

### UI-derived behavior to preserve

- Student list supports independent student-status and payment-status filters. Both selected filters are applied together, then search is applied.
- Student status filters: `all`, `active`, `full_day`, `half_day`, `one_day_admission`, `old_student`, `left_student`.
- Payment filters: `all`, `paid`, `pending`, `overdue`, `overdue_1_7`, `overdue_8_15`, `overdue_16_plus`.
- Search UI searches student name and seat number. The API may also support phone and student code without changing the UI.
- Student summary counts must be calculated from the full hub dataset, not just the currently filtered page.
- Admission seat assignment must respect full-day and half-day occupancy rules.
- The admission UI supports plans: one day, monthly, quarterly, half-yearly, yearly and manual.
- The New Admission flow continues to payment after selecting a valid seat, plan, time slot and dates.
- Student Requests categories are seat booking, seat change, membership renewal and support issue; statuses are pending, approved and rejected. In the UI, an approved support issue is displayed as resolved.

---

## 2. Architecture and common standards

### 2.1 Authentication and hub scope

All Owner endpoints require a valid access token and Owner role.

```http
Authorization: Bearer <ACCESS_TOKEN>
Accept: application/json
Content-Type: application/json
X-Hub-Id: hub_8829a1b4
```

- `X-Hub-Id` is required for hub-specific student data.
- The authenticated Owner must own the requested hub.
- The backend must never trust a client-supplied `ownerId` to establish authorization.
- Every database query must be scoped by authenticated `owner_id` and `hub_id`.
- If the application supports multiple hubs, switching the active hub must refresh the list, counters, profile links and requests.

### 2.2 Standard success response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Students retrieved successfully",
  "data": {},
  "meta": {
    "requestId": "req_01JABC123",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

### 2.3 Standard error response

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "mobile": ["A valid mobile number is required."]
    }
  },
  "meta": {
    "requestId": "req_01JABC123",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

### 2.4 Common conventions

| Item | Convention |
|---|---|
| IDs | Opaque strings, e.g. `stu_01J...`, `seat_...`, `adm_...` |
| Dates | ISO 8601; date-only fields use `YYYY-MM-DD` |
| Timestamps | UTC ISO 8601 with `Z`; display in hub timezone |
| Currency | Amounts are numeric decimal values; currency code is `INR` |
| Pagination | `page` starts at 1; `limit` defaults to 20, maximum 100 |
| Sorting | Explicit `sortBy` and `sortOrder`; default newest first |
| Enum values | `snake_case` values documented below |
| Mutations | Use `Idempotency-Key` for payment/admission creation and other retry-sensitive operations |
| Concurrency | Use `version` or `updatedAt` with `If-Match`/version checks for sensitive updates |

### 2.5 Common status enums

**Student lifecycle**

- `active`
- `old_student`
- `left_student`

`old_student` is a historical former/previous student record. `left_student` means the student has left the current reading room. Do not treat either as an active seat occupant.

**Payment status**

- `paid`
- `pending`
- `overdue`
- `partially_paid`
- `refunded`
- `failed`
- `expired`

**Study shift / time slot**

- `full_day`
- `half_day`

**Room type**

- `ac`
- `non_ac`
- `vip`

**Admission plan**

- `one_day`
- `monthly`
- `quarterly`
- `half_yearly`
- `yearly`
- `manual`

---

## 3. Owner - All Students screen

### 3.1 Get student list, summary counts and pagination

`GET /owner/students`

Returns the current hub's student list and unfiltered summary counters for the All Students screen.

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `studentStatus` | string | No | `all`, `active`, `full_day`, `half_day`, `one_day_admission`, `old_student`, `left_student` |
| `paymentStatus` | string | No | `all`, `paid`, `pending`, `overdue`, `overdue_1_7`, `overdue_8_15`, `overdue_16_plus` |
| `search` | string | No | Name, seat number; phone/student code may also be matched |
| `page` | integer | No | Default `1` |
| `limit` | integer | No | Default `20`, maximum `100` |
| `sortBy` | string | No | `name`, `admission_date`, `created_at`, `seat_number`, `due_date` |
| `sortOrder` | string | No | `asc` or `desc`; default `desc` |

**Filter semantics**

- Both `studentStatus` and `paymentStatus` are independent filters; when both are supplied, a student must satisfy both.
- Search is applied after filters.
- `overdue` means an overdue balance with `overdueDays > 0`.
- `overdue_1_7`: 1-7 whole calendar days overdue.
- `overdue_8_15`: 8-15 whole calendar days overdue.
- `overdue_16_plus`: 16 or more whole calendar days overdue.
- `one_day_admission` means an active admission whose admission date is the hub's current local date and which is not a historical record.
- Summary counts are calculated over all records in the hub, before search, pagination and selected filters.

**Example**

```http
GET /api/v1/owner/students?studentStatus=active&paymentStatus=overdue_1_7&search=amit&page=1&limit=20
```

**Response - `200 OK`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Students retrieved successfully",
  "data": {
    "summary": {
      "all": 128,
      "active": 96,
      "fullDay": 61,
      "halfDay": 35,
      "oneDayAdmission": 4,
      "oldStudent": 18,
      "leftStudent": 14,
      "paid": 72,
      "pending": 12,
      "overdue": 12,
      "overdue1To7": 5,
      "overdue8To15": 4,
      "overdue16Plus": 3
    },
    "appliedFilters": {
      "studentStatus": "active",
      "paymentStatus": "overdue_1_7",
      "search": "amit"
    },
    "students": [
      {
        "id": "stu_1001",
        "studentCode": "STU-2026-1001",
        "name": "Amit Kulkarni",
        "initials": "AK",
        "mobile": "+919876543210",
        "seat": {
          "id": "seat_004",
          "number": "4",
          "roomNumber": "1",
          "floorNumber": 2,
          "roomType": "ac"
        },
        "admissionDate": "2026-11-20",
        "membership": {
          "plan": "monthly",
          "shift": "half_day",
          "validFrom": "2026-11-20",
          "validUntil": "2026-12-19"
        },
        "payment": {
          "status": "overdue",
          "amountDue": 1500.00,
          "currency": "INR",
          "dueDate": "2026-11-20",
          "overdueDays": 4
        },
        "lifecycleStatus": "active",
        "isHistoricalRecord": false,
        "photoUrl": null,
        "createdAt": "2026-11-20T08:30:00Z",
        "updatedAt": "2026-11-24T08:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrevious": false
    }
  },
  "meta": {
    "requestId": "req_students_001",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

### 3.2 Search suggestions (optional)

`GET /owner/students/search-suggestions?q={query}`

Use only if the UI later adds autocomplete. The current UI can use the `search` parameter in `GET /owner/students`; this endpoint is not required for the existing screen.

### 3.3 Export student list

`GET /owner/students/export?format=csv`

Supported formats: `csv`, `xlsx`, `pdf`.

Optional filters use the same query parameters as the list endpoint. Export must include only the authenticated Owner's selected hub and matching filters.

Response: file stream with correct `Content-Type` and `Content-Disposition`. Log export user, hub, timestamp, format and applied filters.

---

## 4. Student Profile screen

The profile screen has three tabs: `overview`, `payments`, `history`.

### 4.1 Get complete student profile

`GET /owner/students/{studentId}`

**Response - `200 OK`**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student profile retrieved successfully",
  "data": {
    "id": "stu_1001",
    "studentCode": "STU-2026-1001",
    "personal": {
      "name": "Amit Kulkarni",
      "mobile": "+919876543210",
      "whatsapp": "+919876543210",
      "email": "amit@example.com",
      "gender": "male",
      "photoUrl": null,
      "aadhaarMasked": "XXXX-XXXX-1234",
      "collegeName": "ABC College",
      "course": "B.Com",
      "documents": [
        {
          "id": "doc_101",
          "type": "college_id",
          "fileName": "college-id.pdf",
          "fileUrl": "https://files.example.com/signed/doc_101",
          "verificationStatus": "verified"
        }
      ]
    },
    "admission": {
      "id": "adm_1001",
      "admissionDate": "2026-11-20",
      "lifecycleStatus": "active",
      "plan": "monthly",
      "planName": "Monthly AC",
      "shift": "half_day",
      "roomType": "ac",
      "floorNumber": 2,
      "roomNumber": "1",
      "seat": {
        "id": "seat_004",
        "number": "4"
      },
      "validFrom": "2026-11-20",
      "validUntil": "2026-12-19",
      "halfDayTiming": {
        "start": "12:00",
        "end": "17:00"
      }
    },
    "fees": {
      "planFee": 1500.00,
      "securityDeposit": 500.00,
      "totalAdmissionAmount": 2000.00,
      "totalPaid": 2000.00,
      "totalDue": 0.00,
      "currency": "INR",
      "paymentStatus": "paid",
      "nextDueDate": "2026-12-20"
    },
    "summary": {
      "totalPayments": 3,
      "totalAdmissions": 1,
      "totalSeatChanges": 0,
      "totalRequests": 1
    },
    "createdAt": "2026-11-20T08:30:00Z",
    "updatedAt": "2026-11-24T08:30:00Z"
  }
}
```

### 4.2 Profile payments tab

`GET /owner/students/{studentId}/payments?page=1&limit=20`

Returns payment history for the selected student.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student payments retrieved successfully",
  "data": {
    "summary": {
      "totalPaid": 4500.00,
      "totalDue": 1500.00,
      "currency": "INR"
    },
    "payments": [
      {
        "id": "pay_9001",
        "receiptNumber": "SL-REC-2026-00901",
        "admissionId": "adm_1001",
        "purpose": "admission",
        "method": "upi",
        "amount": 2000.00,
        "status": "paid",
        "transactionReference": "UPI123456789",
        "paidAt": "2026-11-20T08:45:00Z",
        "receiptUrl": "https://files.example.com/receipts/pay_9001"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 3,
      "totalPages": 1
    }
  }
}
```

### 4.3 Profile history tab

`GET /owner/students/{studentId}/history?page=1&limit=20`

Returns a chronological activity timeline: admissions, renewals, seat allocations/transfers, lifecycle changes, fee payments, refunds and owner/coordinator actions.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student history retrieved successfully",
  "data": {
    "events": [
      {
        "id": "evt_1001",
        "type": "admission_created",
        "title": "Student admitted",
        "description": "Monthly AC plan assigned to seat 4.",
        "actor": {
          "id": "usr_owner_01",
          "name": "Reading Room Owner",
          "role": "owner"
        },
        "occurredAt": "2026-11-20T08:30:00Z",
        "metadata": {
          "admissionId": "adm_1001",
          "seatNumber": "4"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 1,
      "totalPages": 1
    }
  }
}
```

### 4.4 Update student personal details

`PATCH /owner/students/{studentId}`

```json
{
  "name": "Amit Kulkarni",
  "mobile": "+919876543210",
  "whatsapp": "+919876543210",
  "email": "amit@example.com",
  "gender": "male",
  "collegeName": "ABC College",
  "course": "B.Com"
}
```

Only supplied fields are updated. Changing a mobile number must trigger the mobile verification workflow before the new number is treated as verified.

### 4.5 Transfer student to another seat

`POST /owner/students/{studentId}/seat-transfers`

```json
{
  "targetSeatId": "seat_021",
  "effectiveAt": "2026-11-25T00:00:00+05:30",
  "reason": "Student requested a quieter seat",
  "notes": "Approved by Owner"
}
```

Backend must validate target seat availability, room/hub ownership, applicable full-day/half-day rules and effective date. Preserve the old seat allocation in history; do not overwrite the audit trail.

### 4.6 Change student lifecycle status

`PATCH /owner/students/{studentId}/lifecycle`

```json
{
  "status": "left_student",
  "effectiveDate": "2026-11-24",
  "reason": "Membership discontinued"
}
```

Allowed statuses: `active`, `old_student`, `left_student`.

When a student leaves, close or release their active seat allocation according to the effective date and business rules. Do not delete payment/admission history.

### 4.7 Start fee collection from profile

Use the payment endpoints in Section 8. The profile UI should pass the student ID and outstanding amount; the backend must calculate the authoritative due amount rather than trusting a client-calculated total.

---

## 5. Add New Student screen

The Add New Student UI collects personal identity/contact information, verifies the mobile number using OTP, optionally adds a photo and supporting document, and saves the student registry profile.

### 5.1 Send mobile OTP

`POST /owner/students/mobile-verifications`

```json
{
  "mobile": "+919876543210",
  "purpose": "student_registration"
}
```

**Response**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OTP sent successfully",
  "data": {
    "verificationId": "mobv_1001",
    "maskedMobile": "+91******3210",
    "expiresInSeconds": 300,
    "resendAfterSeconds": 30
  }
}
```

Do not return the OTP in production. Rate-limit by account, mobile number and IP/device.

### 5.2 Verify mobile OTP

`POST /owner/students/mobile-verifications/{verificationId}/verify`

```json
{
  "otp": "123456"
}
```

**Response**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mobile number verified successfully",
  "data": {
    "verificationToken": "mvtoken_one_time_opaque",
    "mobile": "+919876543210",
    "verified": true,
    "verifiedAt": "2026-11-24T10:35:00Z"
  }
}
```

The `verificationToken` is short-lived and single-use for student creation. OTP expiry, attempt limits and resend limits must be enforced server-side.

### 5.3 Upload student photo or document

`POST /owner/students/uploads`

Content type: `multipart/form-data`.

| Field | Type | Required | Description |
|---|---|---:|---|
| `file` | File | Yes | Photo or document |
| `purpose` | string | Yes | `student_photo`, `college_id`, `id_proof` |
| `studentId` | string | No | Include only when uploading for an existing student |

**Response**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "file_1001",
    "purpose": "college_id",
    "fileName": "college-id.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 245120,
    "fileUrl": "https://files.example.com/signed/file_1001",
    "expiresAt": "2026-11-24T11:35:00Z"
  }
}
```

Use private object storage and short-lived signed URLs. Validate file type and size. Do not expose permanent public URLs for identity documents.

### 5.4 Create student registry profile

`POST /owner/students`

Headers:

```http
Idempotency-Key: <unique-client-generated-key>
```

**Request body**

```json
{
  "name": "Amit Kulkarni",
  "mobile": "+919876543210",
  "whatsapp": "+919876543210",
  "whatsappSameAsMobile": true,
  "email": "amit@example.com",
  "gender": "male",
  "mobileVerificationToken": "mvtoken_one_time_opaque",
  "photoFileId": "file_photo_01",
  "additionalInfo": {
    "collegeName": "ABC College",
    "course": "B.Com"
  },
  "documents": [
    {
      "fileId": "file_1001",
      "type": "college_id"
    },
    {
      "fileId": "file_1002",
      "type": "id_proof"
    }
  ]
}
```

Gender values: `male`, `female`, `other`. Document types: `college_id`, `id_proof`.

**Response - `201 Created`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Student profile created successfully",
  "data": {
    "student": {
      "id": "stu_1001",
      "studentCode": "STU-2026-1001",
      "name": "Amit Kulkarni",
      "mobile": "+919876543210",
      "mobileVerified": true,
      "whatsapp": "+919876543210",
      "email": "amit@example.com",
      "gender": "male",
      "lifecycleStatus": "active",
      "admissionStatus": "not_admitted",
      "createdAt": "2026-11-24T10:40:00Z"
    },
    "nextStep": {
      "label": "Continue to admission",
      "route": "new_admission"
    }
  }
}
```

A registry profile and an admission are separate concepts. Creating the profile must not allocate a seat or mark an admission as paid.

### 5.5 Get student form configuration (recommended)

`GET /owner/students/form-config`

Returns supported gender/document options, upload limits and whether mobile verification is mandatory. This avoids hardcoding backend-controlled form configuration.

---

## 6. New Admission - room, floor and seat selection

The New Admission screen displays the selected student's identity, lets the Owner choose a floor, room type, room and seat, selects a plan and time slot, chooses validity dates and shows fee calculation.

### 6.1 Get admission configuration

`GET /owner/admissions/configuration`

Returns floors, room types, configured rooms, active fee plans and admission rules for the current hub.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Admission configuration retrieved",
  "data": {
    "hubId": "hub_8829a1b4",
    "floors": [
      { "number": 1, "label": "Floor 1" },
      { "number": 2, "label": "Floor 2" }
    ],
    "roomTypes": ["ac", "non_ac", "vip"],
    "plans": [
      { "code": "one_day", "label": "One Day", "enabled": true },
      { "code": "monthly", "label": "Monthly", "enabled": true },
      { "code": "quarterly", "label": "Quarterly", "enabled": true },
      { "code": "half_yearly", "label": "Half Yearly", "enabled": true },
      { "code": "yearly", "label": "Yearly", "enabled": true },
      { "code": "manual", "label": "Manual", "enabled": true }
    ],
    "timeSlots": [
      { "code": "full_day", "label": "Full Day" },
      { "code": "half_day", "label": "Half Day" }
    ],
    "rules": {
      "allowHalfDay": true,
      "allowOneDay": true,
      "allowManualPlan": true,
      "requireSecurityDeposit": true
    }
  }
}
```

### 6.2 Get rooms by floor and room type

`GET /owner/admissions/rooms?floorNumber=2&roomType=ac`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Rooms retrieved successfully",
  "data": {
    "rooms": [
      {
        "id": "room_001",
        "number": "1",
        "floorNumber": 2,
        "roomType": "ac",
        "totalSeats": 30
      }
    ]
  }
}
```

### 6.3 Get seat availability for a room and date range

`GET /owner/admissions/seats?roomId=room_001&startDate=2026-11-25&endDate=2026-12-24&timeSlot=half_day`

`timeSlot` may be `full_day` or `half_day`. The backend returns seat status calculated for the requested date interval.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat availability retrieved",
  "data": {
    "roomId": "room_001",
    "startDate": "2026-11-25",
    "endDate": "2026-12-24",
    "timeSlot": "half_day",
    "seats": [
      {
        "id": "seat_004",
        "number": "4",
        "status": "available",
        "allocations": []
      },
      {
        "id": "seat_005",
        "number": "5",
        "status": "half_day",
        "allocations": [
          {
            "studentId": "stu_1002",
            "studentName": "Priya Das",
            "timeSlot": "half_day",
            "startTime": "08:00",
            "endTime": "12:00"
          }
        ],
        "availableSlot": {
          "startTime": "12:00",
          "endTime": "17:00"
        }
      },
      {
        "id": "seat_006",
        "number": "6",
        "status": "occupied",
        "allocations": [
          {
            "studentId": "stu_1003",
            "studentName": "Rahul Sen",
            "timeSlot": "full_day",
            "startTime": "08:00",
            "endTime": "20:00"
          }
        ]
      },
      {
        "id": "seat_007",
        "number": "7",
        "status": "reserved",
        "allocations": []
      }
    ]
  }
}
```

**Seat status values**

- `available`: no conflicting active allocation.
- `occupied`: unavailable for the requested slot/date range.
- `reserved`: held by a pending booking or temporary reservation.
- `half_day`: one half-day slot is already occupied and another compatible slot may remain.

The UI must not infer availability from a seat number or cached list alone. The server is authoritative.

### 6.4 Get available fee plans and calculate admission fee

`POST /owner/admissions/fee-quote`

```json
{
  "roomType": "ac",
  "plan": "monthly",
  "timeSlot": "half_day",
  "startDate": "2026-11-25",
  "endDate": "2026-12-24",
  "halfDayTiming": {
    "start": "12:00",
    "end": "17:00"
  }
}
```

For a manual plan, include:

```json
{
  "roomType": "ac",
  "plan": "manual",
  "manualPlan": {
    "name": "Exam Special",
    "fee": 1800.00,
    "securityDeposit": 500.00
  },
  "timeSlot": "full_day",
  "startDate": "2026-11-25",
  "endDate": "2026-12-24"
}
```

**Response**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Admission fee calculated",
  "data": {
    "currency": "INR",
    "plan": "monthly",
    "planName": "Monthly AC",
    "timeSlot": "half_day",
    "startDate": "2026-11-25",
    "endDate": "2026-12-24",
    "planFee": 1500.00,
    "securityDeposit": 500.00,
    "discount": 0.00,
    "tax": 0.00,
    "totalDue": 2000.00,
    "quoteId": "quote_1001",
    "expiresAt": "2026-11-24T10:50:00Z"
  }
}
```

The server must calculate the final amount using configured hub pricing. Client-provided prices are informational only and must not be trusted.

### 6.5 Create admission draft / reserve seat

`POST /owner/admissions`

Headers:

```http
Idempotency-Key: <unique-client-generated-key>
```

**Request**

```json
{
  "studentId": "stu_1001",
  "seatId": "seat_004",
  "quoteId": "quote_1001",
  "plan": "monthly",
  "timeSlot": "half_day",
  "startDate": "2026-11-25",
  "endDate": "2026-12-24",
  "halfDayTiming": {
    "start": "12:00",
    "end": "17:00"
  },
  "notes": ""
}
```

**Response - `201 Created`**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Admission created and seat reserved",
  "data": {
    "admissionId": "adm_1001",
    "studentId": "stu_1001",
    "seat": {
      "id": "seat_004",
      "number": "4",
      "roomId": "room_001",
      "roomNumber": "1",
      "floorNumber": 2,
      "roomType": "ac"
    },
    "plan": "monthly",
    "timeSlot": "half_day",
    "startDate": "2026-11-25",
    "endDate": "2026-12-24",
    "fee": {
      "planFee": 1500.00,
      "securityDeposit": 500.00,
      "totalDue": 2000.00,
      "currency": "INR"
    },
    "status": "awaiting_payment",
    "reservationExpiresAt": "2026-11-24T11:00:00Z"
  }
}
```

**Important:** Seat reservation and payment must be transactional. Use a database lock/unique active-allocation constraint to prevent two owners/coordinators from assigning the same seat/time interval concurrently. A pending reservation must expire automatically if payment is not completed within the configured hold period.

### 6.6 Get admission details

`GET /owner/admissions/{admissionId}`

Returns the admission, student, seat, plan, validity dates, fee quote, payment state and reservation expiry. Used when resuming a payment flow.

---

## 7. Payment flow for new admission

The UI continues from New Admission to the payment screen, where it displays admission fee, deposit, total due and payment method.

### 7.1 Create payment intent / collect payment

`POST /owner/admissions/{admissionId}/payments`

Headers:

```http
Idempotency-Key: <unique-client-generated-key>
```

**Request**

```json
{
  "method": "upi",
  "amount": 2000.00,
  "notes": "New student admission"
}
```

Allowed methods should match the payment UI/configuration, for example: `cash`, `upi`, `card`, `net_banking`, `other`.

For online methods, the backend/payment gateway must create the payment intent and return the gateway order/session details. For cash/manual collection, the backend records the collection only after an authorized confirmation.

**Response**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Payment initiated",
  "data": {
    "paymentId": "pay_9001",
    "admissionId": "adm_1001",
    "amount": 2000.00,
    "currency": "INR",
    "method": "upi",
    "status": "pending",
    "gateway": {
      "provider": "configured_gateway",
      "orderId": "order_1001",
      "checkoutUrl": "https://payments.example.com/checkout/order_1001"
    },
    "createdAt": "2026-11-24T10:55:00Z"
  }
}
```

### 7.2 Confirm cash/manual payment

`POST /owner/payments/{paymentId}/confirm`

```json
{
  "method": "cash",
  "receivedAmount": 2000.00,
  "transactionReference": null,
  "receivedAt": "2026-11-24T10:56:00+05:30",
  "notes": "Cash received at counter"
}
```

The backend validates the outstanding amount, role permission, payment state and idempotency. Never allow a second confirmation to collect the same payment twice.

### 7.3 Verify online payment status

`GET /owner/payments/{paymentId}`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Payment status retrieved",
  "data": {
    "paymentId": "pay_9001",
    "status": "paid",
    "amount": 2000.00,
    "currency": "INR",
    "method": "upi",
    "transactionReference": "UPI123456789",
    "paidAt": "2026-11-24T11:00:00Z",
    "receiptNumber": "SL-REC-2026-00901",
    "receiptUrl": "https://files.example.com/receipts/pay_9001",
    "admissionStatus": "active"
  }
}
```

Payment success must be determined from a verified gateway callback/webhook or server-to-server verification, not from a client redirect alone.

### 7.4 Payment success / receipt details

`GET /owner/payments/{paymentId}/receipt`

Returns receipt metadata and a short-lived download URL or PDF stream.

After successful payment, the backend should atomically:
1. Mark the payment as `paid`.
2. Activate the admission.
3. Confirm the seat allocation.
4. Update student lifecycle/admission state.
5. Create a receipt number.
6. Write audit/history events.

---

## 8. Collect fee from an existing student

`POST /owner/students/{studentId}/payments`

Use this for the Student Profile -> Collect Fee action and other fee collection entry points.

**Request**

```json
{
  "amount": 1500.00,
  "method": "cash",
  "purpose": "membership_fee",
  "dueItemId": "due_1001",
  "transactionReference": null,
  "notes": "Monthly fee collected"
}
```

**Response**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Fee payment recorded successfully",
  "data": {
    "paymentId": "pay_9002",
    "studentId": "stu_1001",
    "amount": 1500.00,
    "currency": "INR",
    "method": "cash",
    "status": "paid",
    "receiptNumber": "SL-REC-2026-00902",
    "receiptUrl": "https://files.example.com/receipts/pay_9002",
    "remainingDue": 0.00,
    "paidAt": "2026-11-24T11:10:00Z"
  }
}
```

The backend must reject an amount greater than the permitted outstanding amount unless overpayment is an explicitly supported business rule. Partial payment behavior must be explicit and reflected as `partially_paid`.

---

## 9. Student Requests & Queries screen

The UI shows summary counters (`Pending`, `Approved`, `Rejected`), a search field and category filters:
- `All`
- `Seat Bookings`
- `Seat Changes`
- `Renewals`
- `Support`

### 9.1 List student requests

`GET /owner/student-requests`

**Query parameters**

| Parameter | Type | Description |
|---|---|---|
| `category` | string | `seat_booking`, `seat_change`, `membership_renewal`, `support_issue` |
| `status` | string | `pending`, `approved`, `rejected` |
| `search` | string | Student name, request ID, title or student code |
| `page` | integer | Default 1 |
| `limit` | integer | Default 20, max 100 |
| `sortOrder` | string | `asc` or `desc`; default `desc` |

**Response**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Student requests retrieved successfully",
  "data": {
    "summary": {
      "pending": 8,
      "approved": 21,
      "rejected": 3
    },
    "requests": [
      {
        "id": "REQ-1001",
        "student": {
          "id": "stu_1001",
          "studentCode": "STU-2026-1001",
          "name": "Aditya Sharma",
          "phone": "+919876543210"
        },
        "hub": {
          "id": "hub_8829a1b4",
          "name": "Knowledge Hub Reading Room"
        },
        "category": "seat_booking",
        "title": "New Seat Booking Request - Seat A3",
        "subtitle": "Monthly AC Plan - INR1,500/month",
        "description": "Student selected Seat A3. Waiting for admission approval.",
        "seat": {
          "id": "seat_A3",
          "label": "A3"
        },
        "amount": 1500.00,
        "currency": "INR",
        "status": "pending",
        "createdAt": "2026-11-23T10:30:00Z",
        "updatedAt": "2026-11-23T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 32,
      "totalPages": 2
    }
  }
}
```

Summary counters must be based on all requests for the hub, not only the current filtered page.

### 9.2 Get request details

`GET /owner/student-requests/{requestId}`

Returns full request description, student contact, selected seat/plan, attachments, conversation/history, status changes and related admission/seat records.

### 9.3 Approve request

`POST /owner/student-requests/{requestId}/approve`

```json
{
  "notes": "Approved by Owner",
  "decision": {
    "seatId": "seat_A3",
    "plan": "monthly",
    "effectiveDate": "2026-11-25"
  }
}
```

For categories where no seat/plan decision is relevant, `decision` may be omitted. For a seat booking request, the server must re-check availability and either reserve the seat or return `409 SEAT_NO_LONGER_AVAILABLE`.

### 9.4 Reject request

`POST /owner/student-requests/{requestId}/reject`

```json
{
  "reason": "Requested seat is not available",
  "notes": "Please select another seat."
}
```

A rejection reason should be required for seat booking, seat change and renewal decisions. The reason should be visible in the student's request history.

### 9.5 Resolve support issue

The current UI uses the same approved state for a support issue and displays the label `RESOLVED`. For clearer backend semantics, support issues should use a dedicated resolve endpoint:

`POST /owner/student-requests/{requestId}/resolve`

```json
{
  "resolution": "Charging socket inspected and repaired.",
  "notes": "Issue resolved by maintenance team."
}
```

Response status: `resolved`. The API may map this to `approved` only for legacy compatibility, but new clients should use `resolved`.

### 9.6 Request status history

`GET /owner/student-requests/{requestId}/history`

Returns an append-only list of submitted, reviewed, approved/rejected/resolved events, actor and timestamp.

---

## 10. Student admission and membership management

### 10.1 List admissions for a student

`GET /owner/students/{studentId}/admissions`

Returns current and previous admissions, including plan, shift, seat, validity and status.

### 10.2 Renew membership

`POST /owner/students/{studentId}/admissions/renew`

```json
{
  "plan": "monthly",
  "timeSlot": "full_day",
  "startDate": "2026-12-20",
  "endDate": "2027-01-19",
  "quoteId": "quote_renew_01",
  "keepCurrentSeat": true
}
```

Response should create a pending renewal/admission payment and preserve the previous membership record. Activate the renewed period only after the configured payment rule is satisfied.

### 10.3 End/mark admission as left

`POST /owner/students/{studentId}/admissions/{admissionId}/close`

```json
{
  "effectiveDate": "2026-11-24",
  "reason": "Student discontinued membership",
  "releaseSeat": true
}
```

The API must preserve historical admission and payment data.

---

## 11. Validation and business rules

### 11.1 Student registry

- Name is required.
- Mobile is required and must be normalized to E.164 format.
- Mobile verification is required before final save if configured as mandatory.
- WhatsApp can equal mobile when `whatsappSameAsMobile=true`; otherwise validate separately.
- Email is optional but must be valid when supplied.
- Gender must be one of `male`, `female`, `other`.
- Documents must reference files uploaded by the same authenticated Owner/hub workflow.
- Aadhaar or other identity numbers must be masked in list/profile responses and encrypted at rest if stored.

### 11.2 Seat allocation

- Seat must belong to the active hub.
- Seat must belong to the selected room and floor.
- Full-day allocation conflicts with any overlapping allocation.
- Half-day allocation may coexist only when configured time windows do not overlap.
- Pending reservations block conflicting assignments until expiry.
- The server must revalidate availability when creating the admission, even if the UI previously fetched available seats.

### 11.3 Dates and time

- `endDate` must be on or after `startDate`.
- Date comparisons and one-day admission logic use the hub's configured timezone.
- Half-day start must be earlier than half-day end.
- Validity date calculation for monthly/quarterly/yearly plans must follow one documented server-side policy; do not independently calculate it in Flutter.

### 11.4 Fees and payments

- Backend fee quote is authoritative.
- Store amounts as decimal-safe values (e.g. integer paise internally where appropriate).
- Payment state transitions must be validated and immutable except through authorized refund/correction workflows.
- Use idempotency keys to avoid duplicate admissions or collections on retry.
- Never activate an online-paid admission based only on a client success screen.

### 11.5 Lifecycle and history

- Do not hard-delete students with admissions or payment history.
- Use lifecycle status and soft deletion where appropriate.
- Every seat transfer, lifecycle change, payment, refund and request decision must create an audit/history event.

---

## 12. Error codes and expected client behavior

| HTTP | Error code | Client behavior |
|---:|---|---|
| 400 | `INVALID_FILTER` | Reset invalid filter and show validation message |
| 401 | `TOKEN_EXPIRED` | Clear session and redirect to login |
| 403 | `ROLE_NOT_AUTHORIZED` | Deny Owner-only operation |
| 404 | `STUDENT_NOT_FOUND` | Show student not found; refresh list |
| 404 | `HUB_NOT_FOUND` | Re-fetch Owner hubs and select a valid hub |
| 409 | `MOBILE_ALREADY_REGISTERED` | Show mobile conflict and offer existing profile lookup |
| 409 | `SEAT_NO_LONGER_AVAILABLE` | Refresh seat map and ask Owner to choose another seat |
| 409 | `ADMISSION_ALREADY_ACTIVE` | Show existing active admission |
| 409 | `DUPLICATE_PAYMENT` | Fetch existing payment; do not retry collection blindly |
| 410 | `OTP_EXPIRED` | Allow OTP resend |
| 422 | `VALIDATION_ERROR` | Map field errors to form controls |
| 422 | `OTP_INVALID` | Show invalid OTP and remaining attempt count |
| 422 | `QUOTE_EXPIRED` | Request a fresh fee quote |
| 422 | `INVALID_DATE_RANGE` | Ask user to correct dates |
| 422 | `PAYMENT_AMOUNT_EXCEEDS_DUE` | Refresh due amount and recalculate |
| 429 | `RATE_LIMITED` | Respect `Retry-After` and disable repeated requests |
| 500 | `INTERNAL_ERROR` | Show retry message; do not lose form draft |

Example conflict response:

```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "SEAT_NO_LONGER_AVAILABLE",
    "message": "This seat was assigned by another user. Please refresh seat availability."
  },
  "meta": {
    "requestId": "req_conflict_001",
    "timestamp": "2026-11-24T11:00:00Z"
  }
}
```

---

## 13. Recommended endpoint summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/owner/students` | Student list, filters, search, summary counts |
| GET | `/owner/students/export` | Export filtered student list |
| GET | `/owner/students/{studentId}` | Student profile overview |
| PATCH | `/owner/students/{studentId}` | Edit personal details |
| GET | `/owner/students/{studentId}/payments` | Profile payment tab |
| GET | `/owner/students/{studentId}/history` | Profile history tab |
| POST | `/owner/students/{studentId}/seat-transfers` | Transfer seat |
| PATCH | `/owner/students/{studentId}/lifecycle` | Change active/old/left status |
| POST | `/owner/students/mobile-verifications` | Send OTP |
| POST | `/owner/students/mobile-verifications/{verificationId}/verify` | Verify OTP |
| POST | `/owner/students/uploads` | Upload photo/document |
| POST | `/owner/students` | Create student registry profile |
| GET | `/owner/admissions/configuration` | Floors, room types, plans and rules |
| GET | `/owner/admissions/rooms` | Rooms by floor/type |
| GET | `/owner/admissions/seats` | Seat availability |
| POST | `/owner/admissions/fee-quote` | Calculate admission fees |
| POST | `/owner/admissions` | Create admission and reserve seat |
| GET | `/owner/admissions/{admissionId}` | Admission detail |
| POST | `/owner/admissions/{admissionId}/payments` | Initiate admission payment |
| POST | `/owner/payments/{paymentId}/confirm` | Confirm cash/manual payment |
| GET | `/owner/payments/{paymentId}` | Verify payment status |
| GET | `/owner/payments/{paymentId}/receipt` | Receipt |
| POST | `/owner/students/{studentId}/payments` | Collect existing student fee |
| GET | `/owner/student-requests` | Requests list, filters and counters |
| GET | `/owner/student-requests/{requestId}` | Request detail |
| POST | `/owner/student-requests/{requestId}/approve` | Approve request |
| POST | `/owner/student-requests/{requestId}/reject` | Reject request |
| POST | `/owner/student-requests/{requestId}/resolve` | Resolve support issue |
| GET | `/owner/student-requests/{requestId}/history` | Request timeline |
| GET | `/owner/students/{studentId}/admissions` | Student admission history |
| POST | `/owner/students/{studentId}/admissions/renew` | Renew membership |
| POST | `/owner/students/{studentId}/admissions/{admissionId}/close` | Close admission |

---

## 14. Flutter integration notes

Suggested service boundaries:

- `OwnerStudentsApi`: list, profile, update, lifecycle, export.
- `StudentRegistrationApi`: send OTP, verify OTP, upload files, create student.
- `OwnerAdmissionsApi`: configuration, rooms, seats, fee quote, create admission.
- `OwnerPaymentsApi`: initiate, confirm, verify and receipt.
- `OwnerStudentRequestsApi`: list, detail, approve, reject, resolve and history.

Suggested Provider mapping:

| Existing Flutter area | API integration |
|---|---|
| `StudentsProvider` | `GET /owner/students`; map filters/search/page and summary |
| `StudentProfileProvider` | Profile, payments, history and seat transfer APIs |
| `AddStudentProvider` | OTP, upload and create student APIs |
| `NewAdmissionProvider` | Configuration, room/seat availability, fee quote and admission creation |
| `CollectPaymentProvider` | Admission payment intent/confirmation |
| `StudentRequestsProvider` | Requests list, summary, search, category filters and decisions |

Do not store the entire student list as permanent local demo data after API integration. Keep server pagination and summary counts authoritative. Cancel or ignore stale list requests when the active hub or filters change.

---

## 15. Security, privacy and audit requirements

1. Enforce Owner role and hub ownership on every endpoint server-side.
2. Never accept `ownerId` from request body as an authorization source.
3. Prevent cross-hub and cross-owner student/profile/document access.
4. Store identity documents privately; use short-lived signed URLs.
5. Mask sensitive identity values in API responses and logs.
6. OTP must be short-lived, one-time, rate-limited and never logged in plaintext.
7. Payment confirmation must be verified server-side.
8. Seat allocation and admission creation must be atomic.
9. Log student creation, profile edits, admission, seat transfer, lifecycle changes, fee collection, refund and request decisions.
10. Keep a history trail; do not overwrite previous seat, admission or payment records.
11. Apply permission checks for coordinator actions separately. This document defines Owner access; coordinator permissions must be checked against the configured role permissions.
12. Use HTTPS for all requests and encrypt sensitive data at rest.

---

## 16. Items requiring product/backend confirmation

The supplied UI establishes the screen flows and displayed fields, but it does not define all business rules. Confirm these before implementation:

- Whether student mobile numbers must be globally unique or unique only within a hub.
- Whether one student profile may be shared across multiple hubs owned by the same Owner.
- Exact half-day time-slot configuration and whether two half-day students can share one seat.
- Whether seat reservation expires after a fixed number of minutes and the required duration.
- Exact pricing, tax, deposit, discount and refund rules for each plan.
- Whether manual plan creation is available to all Owners or restricted by configuration.
- Whether payment supports partial payments and overpayments.
- Whether a student may have multiple simultaneous active admissions.
- Whether support issue `resolved` should remain a separate status or map to the current UI's `approved` status.
- Which file types and maximum file sizes are permitted for student photo, College ID and ID Proof.
- Whether coordinators can perform each Owner action and which permission keys control them.

**Developer objective:** Implement a secure, hub-scoped Owner Student Management API that supports the existing Flutter UI end-to-end, preserves the current student filters and admission/seat rules, and maintains reliable payment, history and audit records.
