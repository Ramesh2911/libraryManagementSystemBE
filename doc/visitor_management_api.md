# Visitor Management API Documentation

## 1. Scope

This document is based on the Flutter files in `lib.zip`:

- `lib/features/common/add_visitors/screens/add_visitor_screen.dart`
- `lib/features/common/add_visitors/provider/add_visitor_provider.dart`
- `lib/features/common/all_visitors/ui/all_visitors_screen.dart`
- `lib/features/common/all_visitors/provider/all_visitors_provider.dart`

The same visitor screens are used by **Owner** and **Coordinator**. Therefore, both roles use the same API routes. Do not create separate Owner and Coordinator visitor endpoints.

> **Contract status:** The API reference and Postman collection confirm the three routes below, but do not define request/response schemas or query parameters. The payloads in this document are proposed contracts mapped from the Flutter UI. Backend implementation and exact schema compatibility must be confirmed by the backend team.

---

## 2. Existing endpoints - reuse these only

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/visitors` | Load visitor list, status counts, and apply UI filters |
| `POST` | `/api/visitors` | Save a visitor from the Add Visitor form |
| `PATCH` | `/api/visitors/:id/status` | Update a visitor's check-in/check-out status |

No additional visitor endpoints are introduced.

### Common headers

```http
Authorization: Bearer {{token}}
x-tenant-id: {{tenant_id}}
Accept: application/json
Content-Type: application/json
```

The `Authorization` and `x-tenant-id` headers follow the existing Postman collection.

---

## 3. Visitor fields mapped from Flutter UI

### Add Visitor form

| UI label | JSON field | Type | Required by UI |
|---|---|---:|---|
| Full Name | `full_name` | string | Yes |
| Phone Number | `phone_number` | string | Yes |
| WhatsApp Number | `whatsapp_number` | string | Yes |
| Email Address | `email` | string | Yes |
| Purpose of Visit | `purpose` | string | Yes |
| Company/Organization | `company` | string | Yes |
| Number of Persons | `persons` | integer | Yes; minimum `1` |
| Date & Time of Visit | `visit_date_time` | datetime | Yes |
| Notes / Remarks | `notes` | string | No |

The purpose selector currently contains these exact options:

- `Study / Workspace Visit`
- `Meeting`
- `Enquiry`
- `Admission Enquiry`
- `Parent Visit`
- `Other`

The Flutter form validates Full Name, Phone Number, WhatsApp Number, Email Address, Purpose, Company/Organization, Number of Persons, and Date & Time as required. Notes / Remarks is optional.

Phone and WhatsApp values should be stored as strings so that `+` and country codes are preserved. The UI accepts 10-15 digits after removing non-digit characters.

### Visitor list card

The All Visitors screen displays:

- Full name
- Phone number
- Status (`Checked In` or `Checked Out`)
- Purpose
- Company/Organization
- Visit date and time
- Number of persons

The search provider matches name, phone, and company. The search field's hint mentions name or phone, but the actual provider also searches company.

---

## 4. Create visitor

**Existing route:** `POST /api/visitors`

Used by the Add Visitor screen's **Save Visitor** action.

### Request body

```json
{
  "full_name": "Rahul Sharma",
  "phone_number": "+91 98765 43210",
  "whatsapp_number": "+91 98765 43210",
  "email": "rahul.sharma@example.com",
  "purpose": "Study / Workspace Visit",
  "company": "Self / Student",
  "persons": 1,
  "visit_date_time": "2026-11-24T10:30:00+05:30",
  "notes": "Interested in a quiet study area."
}
```

### Field rules

| Field | Rule |
|---|---|
| `full_name` | Required, non-empty string |
| `phone_number` | Required; 10-15 digits after removing formatting characters |
| `whatsapp_number` | Required; 10-15 digits after removing formatting characters |
| `email` | Required, valid email address |
| `purpose` | Required; use one of the six UI options listed above |
| `company` | Required, non-empty string |
| `persons` | Required integer, minimum `1` |
| `visit_date_time` | Required ISO-8601 datetime; UI allows today through two years ahead |
| `notes` | Optional string |

### Success response - proposed

```json
{
  "success": true,
  "message": "Visitor saved successfully.",
  "data": {
    "id": "visitor_123",
    "full_name": "Rahul Sharma",
    "phone_number": "+91 98765 43210",
    "whatsapp_number": "+91 98765 43210",
    "email": "rahul.sharma@example.com",
    "purpose": "Study / Workspace Visit",
    "company": "Self / Student",
    "persons": 1,
    "visit_date_time": "2026-11-24T10:30:00+05:30",
    "notes": "Interested in a quiet study area.",
    "status": "checked_in"
  }
}
```

`id` is needed to identify the visitor for the existing status endpoint. `status` is represented in the list UI, but the Add Visitor form does not let the user choose it. The initial status (`checked_in` in this example) is a proposed backend default and must be confirmed; do not treat it as a confirmed rule from the Flutter code.

---

## 5. Get visitors

**Existing route:** `GET /api/visitors`

Used by the All Visitors screen for the visitor cards, status tabs, counts, search, and date-range filter.

### Query parameters

| Parameter | Type | Required | UI mapping |
|---|---|---:|---|
| `search` | string | No | Search name, phone, or company |
| `status` | string | No | `checked_in` or `checked_out`; omit for All |
| `from_date` | date | No | Selected date-range start |
| `to_date` | date | No | Selected date-range end |

Example:

```http
GET /api/visitors?search=rahul&status=checked_in&from_date=2026-11-01&to_date=2026-11-24
```

For the **All** filter, omit `status`. For the date filter, send both `from_date` and `to_date` when a date range is selected. The UI's end date is inclusive.

### Success response - proposed

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_count": 5,
      "checked_in_count": 2,
      "checked_out_count": 3
    },
    "visitors": [
      {
        "id": "visitor_123",
        "full_name": "Rahul Sharma",
        "phone_number": "+91 98765 43210",
        "purpose": "Study / Workspace Visit",
        "company": "Self / Student",
        "visit_date_time": "2026-11-24T10:30:00+05:30",
        "persons": 1,
        "status": "checked_in"
      },
      {
        "id": "visitor_124",
        "full_name": "Aanya Patel",
        "phone_number": "+91 91234 56789",
        "purpose": "Meeting",
        "company": "EdTech Solutions",
        "visit_date_time": "2026-11-24T11:15:00+05:30",
        "persons": 2,
        "status": "checked_out"
      }
    ]
  }
}
```

The summary counts correspond to the three UI filter labels:

- `total_count` -> All
- `checked_in_count` -> Checked In
- `checked_out_count` -> Checked Out

**Count behavior to confirm:** The current Flutter demo calculates counts from its complete in-memory visitor list, independently of the selected status/search/date filters. To preserve that behavior, return summary counts for the unfiltered visitor set and apply the query filters only to `visitors`.

The list card does not display email, WhatsApp number, or notes. Those fields are collected by the Add Visitor form and should be stored, but they are not needed in this list response unless another screen requires them.

---

## 6. Update visitor status

**Existing route:** `PATCH /api/visitors/:id/status`

The API reference and Postman collection already contain this route. The All Visitors UI displays the two statuses and filters by them, but the current visitor card has no Check In / Check Out action. Therefore, this route is documented for the existing API contract, but **the current Flutter screen does not call it**.

### Path parameter

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Visitor ID |

### Request body - proposed

```json
{
  "status": "checked_out"
}
```

Allowed values based on the Flutter enum:

- `checked_in`
- `checked_out`

### Success response - proposed

```json
{
  "success": true,
  "message": "Visitor status updated successfully.",
  "data": {
    "id": "visitor_123",
    "status": "checked_out"
  }
}
```

Do not add another check-in endpoint or check-out endpoint. If the UI later adds explicit status actions, both actions should use this same route.

---

## 7. Status mapping

Flutter enum:

```dart
enum VisitorStatus { checkedIn, checkedOut }
```

Recommended JSON mapping:

| Flutter value | API value | UI label |
|---|---|---|
| `checkedIn` | `checked_in` | Checked In |
| `checkedOut` | `checked_out` | Checked Out |

The UI filter enum also contains `all`. This is a list filter, not a visitor status value; represent it by omitting the `status` query parameter.

---

## 8. Call and WhatsApp actions

The visitor card has **Call** and **WhatsApp** buttons.

- Call opens the device phone dialer using the visitor's phone number (`tel:`).
- WhatsApp opens `wa.me` using the visitor's WhatsApp number and a prefilled follow-up message.

These actions are handled by the Flutter app through external URL launch. They do **not** require additional backend endpoints.

---

## 9. Duplicate endpoint check

| Requirement | Reused endpoint/action | New endpoint? |
|---|---|---:|
| Add visitor | `POST /api/visitors` | No |
| Load visitor list | `GET /api/visitors` | No |
| Search visitors | `GET /api/visitors?search=...` | No |
| Filter by status | `GET /api/visitors?status=...` | No |
| Filter by date range | `GET /api/visitors?from_date=...&to_date=...` | No |
| Update check-in/check-out status | `PATCH /api/visitors/:id/status` | No |
| Call visitor | Flutter `tel:` launch | No |
| WhatsApp visitor | Flutter `wa.me` launch | No |
| Owner vs Coordinator | Same three shared routes | No role-specific routes |

### Explicitly do not create

- `/api/owner/visitors`
- `/api/coordinator/visitors`
- `/api/visitors/check-in`
- `/api/visitors/check-out`
- `/api/visitors/search`
- `/api/visitors/filter`

All of these would duplicate the existing visitor routes or actions.

---

## 10. Implementation notes / items to confirm

1. The route names and methods are confirmed by `api_reference.md` and `smart-library-postman.json`; request/response schemas and query parameters are not defined there.
2. The initial visitor status after creation is not set in the Add Visitor form/provider. Confirm whether the backend should default it to `checked_in` or use another initial state.
3. The current All Visitors UI has no status-update button. The existing `PATCH` route should not be wired to an invented UI action.
4. The current demo list stores a formatted `dateTime` string. For API communication, use an ISO-8601 datetime and format it in Flutter for display.
5. Owner and Coordinator screens share the same visitor form/provider and list/provider. Access control should be handled through the authenticated user/tenant context, not by duplicating routes.
6. Do not add pagination fields or unrelated visitor attributes unless the UI is updated to use them.
