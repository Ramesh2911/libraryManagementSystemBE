# SmartLibrary - Owner Analytics API Documentation

**Version:** 1.0  
**Module:** Owner -> Analytics  
**Audience:** Backend developers, Flutter developers, QA  
**Source UI:** `lib/features/common/analytics/`  
**Status:** Proposed API contract derived from the supplied Flutter source and checked against the existing API reference, Postman collection, Owner Student API and Owner Seat Management API.

> **Implementation note:** The supplied AnalyticsProvider currently uses static/demo values and its download methods are TODOs. This document defines the API contract needed to replace those values. It does not claim that these analytics endpoints are already implemented.

---

## 1. Purpose and UI coverage

The Analytics screen is shared by Owner and Coordinator roles. This document specifies the **Owner view only**. The current screen includes:

1. Date-range selector and period selector.
2. Download actions: Excel, JSON and PDF.
3. Financial Overview: Income, Expenses and Net Profit.
4. Metric cards: Total Revenue, Total Students, Seat Occupancy and Collections.
5. Revenue trend chart.
6. Seat Analytics: occupied, vacant and pending seat counts, occupancy percentage and occupancy by floor.
7. Owner-only All Rooms Overview navigation.
8. Active Students card.
9. Daily Average Visits chart.
10. Collection progress: collected, pending and overdue amounts.
11. Overdue summary.
12. Generated business insights.

The analytics page is an aggregated read/reporting view. It must reuse the existing student, admission, payment, expense, attendance and seat data sources. It must not create a second student ledger, payment ledger, attendance system or seat-allocation system.

### 1.1 UI values and behavior found in source

The supplied provider currently contains illustrative values, including:

- Total Revenue: `INR68,450`, change `+14.2%`.
- Total Students: `288`, change `+8.4%`.
- Seat Occupancy: `70%`.
- Collections: `INR54,200`, `79%`.
- Financial overview sample values: Income `INR1,28,500`, Expenses `INR38,200`, Net Profit `INR90,300`.
- Weekly visits: Monday to Sunday, with an average derived from the seven daily values.
- Floor occupancy sample values: Floor 1 `70`, Floor 2 `82`, Floor 3 `58`.
- Seat sample values: Occupied `42`, Vacant `14`, Pending `4`.
- Insights are hardcoded strings.
- Date range and period selectors currently change local labels only; they do not reload data.
- Excel, JSON and PDF download methods are placeholders.

These values are examples only. The API must return actual data for the selected hub and date range.

---

## 2. Existing endpoint and duplicate policy

### 2.1 Existing routes that Analytics must reuse

The uploaded API reference/Postman collection and the earlier Owner API documents already define the following source operations:

| Existing endpoint | Analytics use |
|---|---|
| `GET /api/payments/ledger/:studentId` | Existing student payment ledger; do not create another student payment history API for analytics |
| `POST /api/payments/record` | Existing payment recording operation; analytics reads its resulting ledger entries |
| `POST /api/deposits` | Existing deposit recording; include in financial reporting only according to accounting policy |
| `POST /api/deposits/:id/refund` | Existing deposit refund; report refunds as reversals/outflows, not as new income |
| `GET /api/students` | Existing student records; analytics aggregates them rather than creating a second student-list API |
| `GET /api/floors` | Existing configured floors for floor-level grouping |
| `GET /api/reading-rooms` | Existing rooms for room/floor labels and room grouping |
| `GET /api/seats/map` | Existing seat map for live seat status; analytics should use the same seat/allocation source |
| `GET /api/attendance/:studentId` | Existing student attendance history; analytics aggregates attendance events |
| `POST /api/attendance/sync` | Existing attendance synchronization; analytics reads the resulting attendance records |

The Student Management API already defines student list/profile/payment/attendance-related business concepts. The Seat Management API already defines seat statuses and room/floor relationships. Reuse those canonical records and definitions.

### 2.2 Existing endpoints that must not be used for Owner Analytics

- `GET /api/admin/dashboard` and `GET /api/admin/revenue-analytics` are **Super Admin** endpoints. Do not call them from an Owner session and do not expose platform-wide data to an Owner.
- Do not create another `/owner/students/analytics`, `/owner/payments/analytics`, `/owner/seats/analytics`, `/owner/attendance/analytics` or `/owner/expenses/analytics` endpoint for each individual card.
- Do not create new payment collection, expense creation, student CRUD, attendance sync, floor/room CRUD or seat allocation endpoints in this document.
- Do not duplicate the Owner Dashboard's main dashboard endpoint. Analytics is a separate screen with a richer date-filtered reporting payload. If the product later chooses to unify Dashboard and Analytics aggregation, use one shared backend aggregation service and maintain compatible response projections.

### 2.3 New endpoint proposed for this screen

One consolidated Owner-scoped read endpoint is proposed:

`GET /api/owner/analytics`

This is a new route because the existing API reference does not define an Owner Analytics aggregation endpoint. It supplies all current Analytics screen data in one response, avoiding one request per card/chart.

One report-export endpoint is also proposed:

`GET /api/owner/analytics/export`

It exports the same filtered analytics dataset. It is not a second analytics calculation system; it must call the same aggregation service and apply the same filters.

If the backend already has a generic report/export route not shown in the supplied reference, extend that route instead of creating this export route.

---

## 3. Authentication, hub scope and common conventions

Keep the existing API reference/Postman convention for this module:

```http
Authorization: Bearer <ACCESS_TOKEN>
x-tenant-id: <TENANT_OR_HUB_ID>
Accept: application/json
```

- Require a valid authenticated Owner session.
- Verify the `x-tenant-id` belongs to the authenticated Owner.
- Derive Owner identity from the access token; never trust a body-supplied `ownerId`.
- Scope every aggregation query by authenticated Owner and tenant/hub.
- Do not mix `/api/v1` + `X-Hub-Id` from the Student API draft with the existing `/api/...` + `x-tenant-id` convention used by the API reference and Seat Management document. A platform-wide migration can standardize this later.
- All date boundaries are interpreted in the hub's configured timezone. Return timestamps in ISO 8601 UTC and include the timezone used for date grouping.
- Currency values are numeric decimals with an explicit currency code. The current UI displays INR, but the backend must return the configured hub currency.
- Analytics is read-only except for report export. It must not mutate payments, students, admissions, seats or attendance.

### 3.1 Standard success response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Owner analytics retrieved successfully",
  "data": {},
  "meta": {
    "requestId": "req_analytics_001",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

### 3.2 Standard error response

```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "INVALID_ANALYTICS_DATE_RANGE",
    "message": "The selected date range is invalid."
  },
  "meta": {
    "requestId": "req_analytics_002",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

---

## 4. Analytics filter model

The top filter row contains a date-range selector and a period selector. The date range is the authoritative range. The period is a convenient preset and must resolve to concrete dates.

### 4.1 Query parameters

| Parameter | Type | Required | Description |
|---|---|---:|---|
| `fromDate` | `YYYY-MM-DD` | Yes, unless `period` resolves it | Inclusive start date in hub timezone |
| `toDate` | `YYYY-MM-DD` | Yes, unless `period` resolves it | Inclusive end date in hub timezone |
| `period` | string | No | `this_month`, `last_month`, `this_year`, `last_7_days`, `last_30_days`, `custom` |
| `compare` | boolean | No | Return comparison with previous equivalent period; default `true` |
| `floorId` | string | No | Optional floor filter for seat analytics; `all` or omitted means all floors |
| `roomId` | string | No | Optional room filter; must belong to selected tenant and optional floor |
| `includeInsights` | boolean | No | Default `true`; include generated insights |
| `includeDailySeries` | boolean | No | Default `true`; include daily visit and revenue series |

Examples:

```http
GET /api/owner/analytics?period=this_month
GET /api/owner/analytics?period=last_month
GET /api/owner/analytics?fromDate=2026-10-01&toDate=2026-10-31&period=custom
GET /api/owner/analytics?period=this_month&floorId=floor_02&compare=true
```

### 4.2 Preset resolution

- `this_month`: first day of current hub-local month through today.
- `last_month`: first through last day of the previous hub-local month.
- `this_year`: first day of current hub-local calendar year through today.
- `last_7_days`: today and previous six hub-local calendar dates.
- `last_30_days`: today and previous 29 hub-local calendar dates.
- `custom`: requires `fromDate` and `toDate`.
- If both `period` and explicit dates are supplied, explicit dates are authoritative and the response should report the resolved range.
- `fromDate` must be on or before `toDate`.
- The backend should enforce a configurable maximum range (recommended 24 months) to prevent unbounded analytics queries.

The UI currently has sample date choices and a `selectedPeriod` label. Replace display-label-only state with stable values and concrete dates. The date selector must not silently change a label without reloading analytics.

---

## 5. Main Owner Analytics endpoint

### 5.1 Retrieve analytics overview

**New endpoint**

```http
GET /api/owner/analytics?period=this_month&compare=true&includeInsights=true&includeDailySeries=true
```

This endpoint returns the complete data model required by the current Analytics screen.

### 5.2 Response structure

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Owner analytics retrieved successfully",
  "data": {
    "scope": {
      "tenantId": "tenant_001",
      "hubName": "Smart Study Hub",
      "timezone": "Asia/Kolkata",
      "currency": "INR"
    },
    "filters": {
      "period": "this_month",
      "fromDate": "2026-11-01",
      "toDate": "2026-11-24",
      "compare": true,
      "floorId": null,
      "roomId": null
    },
    "comparison": {
      "fromDate": "2026-10-01",
      "toDate": "2026-10-24",
      "label": "Previous equivalent period"
    },
    "financialOverview": {
      "income": 128500.00,
      "expenses": 38200.00,
      "netProfit": 90300.00,
      "currency": "INR",
      "comparison": {
        "incomeChangePercent": 14.2,
        "expensesChangePercent": 4.8,
        "netProfitChangePercent": 18.6
      }
    },
    "metrics": {
      "totalRevenue": {
        "amount": 68450.00,
        "currency": "INR",
        "changePercent": 14.2,
        "trend": "up"
      },
      "totalStudents": {
        "count": 288,
        "changePercent": 8.4,
        "trend": "up"
      },
      "seatOccupancy": {
        "percentage": 70.0,
        "occupiedSeats": 42,
        "totalActiveSeats": 60,
        "changePercent": 2.5,
        "trend": "up"
      },
      "collections": {
        "collected": 54200.00,
        "expected": 65550.00,
        "collectionPercent": 82.7,
        "currency": "INR",
        "changePercent": 7.1,
        "trend": "up"
      }
    },
    "revenueTrend": {
      "total": 68450.00,
      "currency": "INR",
      "points": [
        { "date": "2026-11-01", "label": "1", "amount": 3200.00 },
        { "date": "2026-11-05", "label": "5", "amount": 4100.00 },
        { "date": "2026-11-10", "label": "10", "amount": 3700.00 },
        { "date": "2026-11-15", "label": "15", "amount": 6900.00 },
        { "date": "2026-11-20", "label": "20", "amount": 6100.00 },
        { "date": "2026-11-25", "label": "25", "amount": 0.00 },
        { "date": "2026-11-30", "label": "30", "amount": 0.00 }
      ],
      "comparisonTotal": 59950.00,
      "changePercent": 14.2
    },
    "seatAnalytics": {
      "occupancyPercent": 70.0,
      "occupied": 42,
      "vacant": 14,
      "pending": 4,
      "halfDay": 0,
      "totalActiveSeats": 60,
      "occupancyByFloor": [
        {
          "floorId": "floor_01",
          "floorName": "Floor 1",
          "occupancyPercent": 70.0,
          "occupiedSeats": 14,
          "totalActiveSeats": 20
        },
        {
          "floorId": "floor_02",
          "floorName": "Floor 2",
          "occupancyPercent": 82.0,
          "occupiedSeats": 18,
          "totalActiveSeats": 22
        }
      ]
    },
    "activeStudents": {
      "total": 288,
      "newInRange": 24,
      "renewedInRange": 31,
      "leftInRange": 6,
      "fullDay": 190,
      "halfDay": 98,
      "previousTotal": 266,
      "changePercent": 8.4
    },
    "dailyVisits": {
      "averagePerDay": 29,
      "totalVisits": 203,
      "points": [
        { "date": "2026-11-16", "day": "Mon", "visits": 24 },
        { "date": "2026-11-17", "day": "Tue", "visits": 28 },
        { "date": "2026-11-18", "day": "Wed", "visits": 32 },
        { "date": "2026-11-19", "day": "Thu", "visits": 22 },
        { "date": "2026-11-20", "day": "Fri", "visits": 35 },
        { "date": "2026-11-21", "day": "Sat", "visits": 42 },
        { "date": "2026-11-22", "day": "Sun", "visits": 20 }
      ],
      "highestDay": {
        "date": "2026-11-21",
        "day": "Saturday",
        "visits": 42
      },
      "lowestDay": {
        "date": "2026-11-22",
        "day": "Sunday",
        "visits": 20
      }
    },
    "collectionSummary": {
      "collected": 54200.00,
      "pending": 8500.00,
      "overdue": 12850.00,
      "expected": 65550.00,
      "collectionPercent": 82.7,
      "currency": "INR"
    },
    "overdueSummary": {
      "totalAmount": 12850.00,
      "studentCount": 12,
      "buckets": {
        "days1To7": { "studentCount": 5, "amount": 4200.00 },
        "days8To15": { "studentCount": 4, "amount": 3850.00 },
        "days16Plus": { "studentCount": 3, "amount": 4800.00 }
      },
      "oldestOverdueDate": "2026-10-28"
    },
    "insights": [
      {
        "id": "ins_001",
        "type": "revenue_growth",
        "title": "Revenue Growth",
        "description": "Revenue increased by 14.2% compared with the previous period.",
        "severity": "positive",
        "metric": {
          "value": 14.2,
          "unit": "percent"
        }
      },
      {
        "id": "ins_002",
        "type": "student_growth",
        "title": "Student Growth",
        "description": "24 new students joined during the selected period.",
        "severity": "positive",
        "metric": {
          "value": 24,
          "unit": "students"
        }
      },
      {
        "id": "ins_003",
        "type": "seat_utilization",
        "title": "Seat Utilization",
        "description": "Floor 2 currently has the highest occupancy.",
        "severity": "info",
        "metric": {
          "value": 82.0,
          "unit": "percent",
          "floorId": "floor_02"
        }
      }
    ],
    "generatedAt": "2026-11-24T10:30:00Z"
  },
  "meta": {
    "requestId": "req_analytics_001",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

The sample values above are illustrative and intentionally resemble the current UI's example values. Backend responses must be calculated from real tenant records.

---

## 6. Financial Overview

The first analytics section displays three cards:

- **Income**
- **Expenses**
- **Net Profit**

### 6.1 Calculation rules

These values must be calculated by the backend using the canonical financial records.

Recommended accounting definitions:

- `income`: recognized operating income within the selected period. Include successfully collected membership/admission fees and other configured operating income.
- `expenses`: expenses recorded/recognized in the selected period from the existing expense records.
- `netProfit`: `income - expenses`.
- Refunds and reversals reduce the relevant income/collection totals according to accounting policy.
- Security deposits should not automatically be treated as revenue. They are liabilities until legitimately recognized as income under the hub's accounting policy.
- Pending and overdue amounts are receivables, not collected income.
- Do not count a payment twice because it appears in both an admission/payment record and a student payment ledger.
- The API must return a consistent currency and period basis for all three values.

No new expense CRUD endpoint is introduced here. If the existing API reference does not yet contain an expense-list/report read route, the aggregation service may read the existing expense store internally. Add a public expense endpoint only in the dedicated Expenses API specification if the Expenses UI requires it.

### 6.2 Financial response fields

| Field | Type | Description |
|---|---|---|
| `income` | number | Recognized income for range |
| `expenses` | number | Recorded expenses for range |
| `netProfit` | number | Income minus expenses |
| `currency` | string | ISO currency code |
| `comparison.*ChangePercent` | number/null | Change versus previous equivalent range |

If the previous period value is zero, return `null` for percentage change and provide a `comparisonStatus` such as `no_previous_data`; do not return infinity or an invented percentage.

---

## 7. Metric cards

### 7.1 Total Revenue

The UI shows amount and percentage change.

- Use actual successful/settled revenue transactions in the selected date range.
- Exclude pending/failed payment intents.
- Apply refund/reversal rules.
- Return the previous-period comparison percentage.

### 7.2 Total Students

Return the active student count as of the end of the selected range, plus the change compared with the equivalent previous period. Do not sum student admissions as if each admission were a distinct person.

Recommended supporting fields:

- `count`
- `newInRange`
- `renewedInRange`
- `leftInRange`
- `previousTotal`
- `changePercent`

The exact definition of `totalStudents` should be consistent with the Owner Student Management lifecycle statuses. Historical `old_student` records and `left_student` records must not be counted as active students.

### 7.3 Seat Occupancy

Use the canonical seat/allocation records from Seat Management.

- `occupiedSeats`: active seats with a conflicting active allocation under the same rules as the Seat Management map.
- `totalActiveSeats`: active configured seats across the selected hub or selected floor/room filter.
- `percentage`: `occupiedSeats / totalActiveSeats * 100`.
- `reserved` and `half_day` must be returned separately in `seatAnalytics`; do not silently count pending reservations as occupied.
- The exact UI percentage policy must be agreed: if half-day allocations count as occupied capacity, return a separate occupied-capacity numerator or clearly define the percentage formula.

### 7.4 Collections

The UI shows collected amount and collection percentage.

- `collected`: successfully collected amount during the selected range.
- `expected`: amount due/expected for the same reporting cohort and period, based on the fee schedule.
- `collectionPercent`: `collected / expected * 100`, with zero-safe handling.
- Return `changePercent` compared with the previous equivalent range.

Collection percentage should not be computed by dividing collected amount by collected + overdue + pending unless those fields are from the same due cohort and same accounting basis.

---

## 8. Revenue Trend chart

The Revenue card draws a line chart with date labels and a selected-period total.

### 8.1 Data contract

`revenueTrend.points` is an ordered series of date buckets. The server should return enough points for the selected period:

- For a range up to 31 days, daily points are preferred.
- For a range longer than 31 days, use weekly or monthly buckets and include `bucketType`.
- Include zero-value buckets so the chart does not imply missing dates are missing records.
- Each point must have a date/bucket start, display label and numeric amount.
- The UI must not assume a fixed seven-point array.

Suggested addition:

```json
{
  "bucketType": "day",
  "points": [
    {
      "bucketStart": "2026-11-01",
      "bucketEnd": "2026-11-01",
      "label": "1",
      "amount": 3200.00
    }
  ]
}
```

Do not create a separate revenue chart endpoint. It is part of `GET /api/owner/analytics`.

---

## 9. Seat Analytics

The Seat Analytics card contains:

1. Occupancy donut/percentage.
2. Occupied seat count.
3. Vacant seat count.
4. Pending/reserved seat count.
5. Occupancy by floor bars.
6. Owner action `View All Rooms` navigating to the existing All Reading Rooms screen.

### 9.1 Aggregation rules

- Use active configured seats only.
- Use the same operational status meanings as the Seat Management API: `vacant`, `occupied`, `reserved`, `half_day`.
- The Analytics `pending` count maps to `reserved` in the canonical Seat Management status model.
- Return `halfDay` as a separate field even if the current card does not display it in the legend.
- `occupancyByFloor` must be derived from actual floors and seats. Do not hardcode Floor 1, Floor 2, Floor 3.
- If `floorId` is supplied, return only that floor's metrics. If `roomId` is supplied, verify it belongs to the selected tenant and optional floor.
- A floor with no active seats should have `totalActiveSeats: 0` and `occupancyPercent: null`, not `0%` if the denominator is undefined.

### 9.2 Existing routes to reuse

- `GET /api/floors`
- `GET /api/reading-rooms`
- `GET /api/seats/map`

The Analytics endpoint may aggregate directly from the same database/service layer. Flutter does not need to call all three endpoints just to render the analytics card if the consolidated analytics response already includes the floor breakdown. The `View All Rooms` action continues to navigate to the existing Owner All Reading Rooms screen; it is not a new API.

---

## 10. Active Students card

The current screen includes a separate Active Students card. The precise widget content should be bound to the `activeStudents` object returned by the consolidated endpoint.

Required fields:

| Field | Description |
|---|---|
| `total` | Active student count as of `toDate` |
| `newInRange` | New student registrations/admissions in selected range; product must choose one canonical definition |
| `renewedInRange` | Membership renewals completed in selected range |
| `leftInRange` | Students whose lifecycle changed to left during range |
| `fullDay` | Active full-day students |
| `halfDay` | Active half-day students |
| `previousTotal` | Active count at equivalent previous-period end |
| `changePercent` | Percentage change versus previous period |

Important: Student registry creation and admission creation are separate concepts in the Student API. The product must decide whether the UI's "new students" means newly registered profiles or newly admitted active students. For an occupancy/business metric, newly admitted active students is usually the more meaningful value. The response should expose both if the UI later needs both definitions.

No new student-list endpoint is required.

---

## 11. Daily Average Visits chart

The card displays:

- Average visits per day.
- A bar chart by weekday.
- Highest visit day.
- Lowest visit day.

### 11.1 Required response

`dailyVisits.points` should contain actual attendance/visit counts for each date bucket. For a seven-day view, return seven daily records; for longer ranges, the API may return a daily series or an aggregated weekday series, but must identify the bucket type.

- Count attendance check-ins/visits, not unique students, unless the UI explicitly changes to unique daily visitors.
- Prevent duplicate attendance events using the attendance event's stable ID/idempotency rules.
- Use hub-local calendar dates.
- Average = total visits divided by the number of included calendar days, unless the product explicitly defines operating days only. Return the denominator as `daysIncluded`.
- If the hub was closed on a day, define whether that day is excluded or counted as zero and keep the policy consistent.
- The existing `GET /api/attendance/:studentId` remains a student-specific history route. It is not suitable for fetching every student's history from Flutter. Aggregate attendance inside the Owner analytics service using the canonical attendance store.

Suggested response fields:

```json
{
  "averagePerDay": 29,
  "totalVisits": 203,
  "daysIncluded": 7,
  "bucketType": "day",
  "points": [
    { "date": "2026-11-16", "day": "Mon", "visits": 24 },
    { "date": "2026-11-17", "day": "Tue", "visits": 28 }
  ],
  "highestDay": {
    "date": "2026-11-21",
    "day": "Saturday",
    "visits": 42
  },
  "lowestDay": {
    "date": "2026-11-22",
    "day": "Sunday",
    "visits": 20
  }
}
```

---

## 12. Collection Summary card

The card displays:

- Collected amount.
- Collection percentage/progress bar.
- Pending amount.
- Overdue amount.
- `View Fee Details` action.

### 12.1 Data source and rules

Use the canonical fee due/payment records created by the existing admission, renewal and payment workflows.

- `collected`: settled successful payments applied to due items within the selected reporting basis.
- `pending`: due amount not yet paid and not yet overdue.
- `overdue`: unpaid due amount past its due date as of `toDate` (or current date if the product chooses current-state semantics; the API must state which).
- `expected`: total amount expected for the cohort.
- `collectionPercent`: collected divided by expected.
- A partial payment reduces the outstanding balance and must not be counted as fully paid.
- Do not add a duplicate fee collection endpoint.

### 12.2 View Fee Details

The current card's `View Fee Details` tap handler is a placeholder. When wired, it should navigate to the existing fee/payment details or collection screen and use existing APIs. Do not create a new analytics-specific fee details endpoint solely for navigation.

---

## 13. Overdue Summary card

The overdue card must show an aggregated overdue balance and affected student count. The current screen uses the overdue card widget; bind it to `overdueSummary`.

Required fields:

- `totalAmount`
- `studentCount`
- `buckets.days1To7`
- `buckets.days8To15`
- `buckets.days16Plus`
- `oldestOverdueDate`

Use the same overdue-day bucket definitions as the Owner Student Management API:

- `days1To7`: 1-7 whole calendar days overdue.
- `days8To15`: 8-15 whole calendar days overdue.
- `days16Plus`: 16 or more whole calendar days overdue.

A student with multiple overdue dues should be counted once in `studentCount`; amounts should sum all eligible outstanding overdue dues. Do not create a duplicate overdue-list endpoint. If the Owner opens an overdue student list, reuse the existing Owner Student list filters/payment-status behavior.

---

## 14. Insights

The current UI shows insight tiles such as:

- Revenue Growth.
- Student Growth.
- Seat Utilization.

The API should return generated insights only from computed metrics. Do not return arbitrary executable actions or client routes.

### 14.1 Insight schema

| Field | Description |
|---|---|
| `id` | Stable insight identifier |
| `type` | `revenue_growth`, `student_growth`, `seat_utilization`, `collection_risk`, `overdue_risk`, etc. |
| `title` | Short display heading |
| `description` | Human-readable summary |
| `severity` | `positive`, `info`, `warning`, `critical` |
| `metric` | Optional numeric value/unit and relevant entity ID |

Rules:

- Insights must be scoped to the selected tenant and date range.
- Only include insights supported by sufficient data.
- If there is no prior-period data, do not claim a growth percentage.
- Do not generate a "highest occupancy floor" insight if no floor has active seats.
- The UI chooses icons/colors based on `type`/`severity`; the API must not return Flutter `IconData` or color hex values.
- The insight descriptions should be concise and safe to display without further formatting.

No separate `/insights` endpoint is required for the current screen.

---

## 15. Download / export report

The filter row exposes three download formats:

- Excel File
- JSON File
- PDF File

The current `downloadReport()` methods are placeholders. The export must use the same date range, floor/room filters and calculation rules as `GET /api/owner/analytics`.

### 15.1 Export endpoint

**New endpoint proposed**

```http
GET /api/owner/analytics/export?period=this_month&format=xlsx
```

Supported `format` values:

- `xlsx` (UI label: Excel File)
- `json`
- `pdf`

Accept the same filter query parameters as `GET /api/owner/analytics`.

### 15.2 Response

For `xlsx` and `pdf`, return a file stream with the correct headers:

```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="owner-analytics-2026-11.xlsx"
```

For PDF:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="owner-analytics-2026-11.pdf"
```

For JSON, return the same analytics response object with an export-friendly filename or stream.

### 15.3 Export contents

The report should include:

1. Hub name, timezone, selected date range and generated timestamp.
2. Financial Overview.
3. Metric cards.
4. Revenue trend series.
5. Seat Analytics and occupancy by floor.
6. Active Students.
7. Daily Visits.
8. Collection Summary.
9. Overdue Summary.
10. Insights.

Export must be tenant-scoped and logged with actor, tenant, format, date range, applied filters and timestamp. Do not include student mobile numbers, identity documents or unrelated personal data in analytics exports.

If a generic report export endpoint is added elsewhere in the API, extend it to support an `owner_analytics` report type rather than adding a competing export route.

---

## 16. Data definitions and aggregation consistency

All cards must be calculated from the same reporting snapshot or consistent database transaction/snapshot time. Include `generatedAt` in the response.

### 16.1 Revenue vs income vs collection

These terms are not interchangeable:

- **Revenue/income:** amount recognized as operating income under accounting policy.
- **Collection:** money actually received/settled.
- **Expected:** amount due for the selected cohort/period.
- **Pending:** due but not yet overdue.
- **Overdue:** due date passed and outstanding balance remains.
- **Net profit:** recognized income less recognized expenses.

The UI currently displays all of these, so backend definitions must be documented and stable.

### 16.2 Payment and deposit treatment

- Use existing payment records and payment ledger as the source of truth.
- Do not count a pending gateway intent as collected.
- Do not count a failed or cancelled payment.
- Refunds reduce the original payment's net collected/revenue values according to accounting policy.
- Security deposits must be tracked separately from operating revenue unless a configured rule recognizes them.
- A payment may be allocated to one or more dues; do not count the same transaction once per due row if the analytics is reporting transaction totals.

### 16.3 Student counts

- Use canonical student IDs to count people, not admissions.
- Count active students according to the lifecycle definition in the Owner Student Management API.
- Distinguish profile registrations from successful admissions.
- Former/left students are not active occupants.

### 16.4 Seat counts

- Use active configured seats only.
- Use the canonical seat statuses from Seat Management.
- Do not infer seats from `totalSeats` if generated seat records are missing or inactive; reconcile room configuration and seat records.
- Floor grouping must use the actual `floorId` relationship.

### 16.5 Attendance

- Count valid attendance/visit events.
- Exclude duplicate sync submissions.
- Group dates in hub timezone.
- Do not use student-specific attendance API calls in a loop from Flutter.

---

## 17. Error codes

| HTTP | Error code | Meaning / client behavior |
|---:|---|---|
| 400 | `INVALID_ANALYTICS_PERIOD` | Unsupported period preset |
| 400 | `INVALID_ANALYTICS_FORMAT` | Unsupported export format |
| 401 | `TOKEN_EXPIRED` | Refresh/clear session using existing auth flow |
| 403 | `ROLE_NOT_AUTHORIZED` | Non-owner or missing analytics permission |
| 404 | `TENANT_NOT_FOUND` | Tenant does not belong to authenticated Owner |
| 404 | `FLOOR_NOT_FOUND` | Selected floor does not belong to tenant |
| 404 | `ROOM_NOT_FOUND` | Selected room does not belong to tenant/floor |
| 422 | `INVALID_ANALYTICS_DATE_RANGE` | Missing or invalid date range |
| 422 | `ANALYTICS_RANGE_TOO_LARGE` | Requested range exceeds configured limit |
| 429 | `RATE_LIMITED` | Respect `Retry-After` |
| 500 | `INTERNAL_ERROR` | Show retry state; retain selected filters |

---

## 18. Performance, caching and consistency

- The consolidated analytics endpoint should use database aggregation/materialized views where appropriate, not fetch all records into application memory.
- Index tenant ID, transaction date, due date, student ID, seat/room/floor IDs and attendance timestamp fields used in filters.
- Cache only by tenant, date range, filters and data version; never share cache entries across tenants.
- Invalidate or refresh relevant cached analytics after successful payment, refund, expense, admission, lifecycle change, seat allocation/transfer/vacate, room/floor configuration or attendance sync.
- If a response is served from cache, include `generatedAt` and optionally `dataFreshUntil`.
- Consider a short refresh interval for live seat occupancy; historical financial metrics may be cached longer.
- Flutter should show loading, empty and error states and should not continue displaying previous-hub data after a hub switch.
- Protect against stale responses when the user changes the date range quickly.

---

## 19. Flutter integration mapping

Suggested service:

`OwnerAnalyticsApi`

Methods:

```dart
getAnalytics({
  required DateTime fromDate,
  required DateTime toDate,
  String? period,
  String? floorId,
  String? roomId,
  bool compare = true,
});

downloadAnalytics({
  required String format, // xlsx, json, pdf
  required DateTime fromDate,
  required DateTime toDate,
  String? floorId,
  String? roomId,
});
```

Suggested Provider mapping:

| Existing source | Required integration |
|---|---|
| `AnalyticsProvider.selectedPeriod` | Store stable preset code, not only display label |
| `AnalyticsProvider.selectedDateRange` | Store actual `fromDate`/`toDate`; format label for UI |
| `AnalyticsProvider.metrics` | Map `data.metrics` |
| `AnalyticsProvider.revenuePoints` | Map `data.revenueTrend.points` |
| `AnalyticsProvider.revenueDays` | Map revenue point labels |
| `AnalyticsProvider.floorOccupancy` | Map `data.seatAnalytics.occupancyByFloor` |
| `AnalyticsProvider.weeklyVisits` | Map `data.dailyVisits.points` |
| `AnalyticsProvider.weekDays` | Map daily visit labels |
| `AnalyticsProvider.averageDailyVisits` | Map `data.dailyVisits.averagePerDay` |
| Financial Overview widget | Map `data.financialOverview` |
| Revenue card | Map `data.revenueTrend` |
| Seat card | Map `data.seatAnalytics` |
| Active Students card | Map `data.activeStudents` |
| Daily Visits card | Map `data.dailyVisits` |
| Collection card | Map `data.collectionSummary` |
| Overdue card | Map `data.overdueSummary` |
| Insights widget | Map `data.insights` |
| `downloadReport()` | Call export endpoint and save/share returned file |

### 19.1 Loading and refresh behavior

Call `GET /api/owner/analytics`:

- When Analytics screen opens.
- When date range changes.
- When period preset changes.
- When the selected floor/room filter changes, if those filters are exposed on Analytics.
- When the active hub changes.
- When the Owner returns to Analytics after a relevant mutation, subject to cache policy.
- On manual refresh if a refresh action is later added.

Clear old chart/card data or mark it as stale while a new filter request is loading. Do not show one period's values under another period's selected label.

### 19.2 Role handling

`AnalyticsScreen` is shared and receives `UserRole`. This document defines Owner authorization and Owner data scope only. The Owner request must never be allowed to read Super Admin platform-wide aggregates. Coordinator access and data restrictions should be specified separately and enforced server-side.

---

## 20. Endpoint summary - Owner Analytics

| Method | Endpoint | Status | Purpose |
|---|---|---|---|
| GET | `/api/owner/analytics` | **New** | Consolidated, filtered analytics data for all current cards/charts/insights |
| GET | `/api/owner/analytics/export` | **New** (or extend existing generic export) | Export the same analytics dataset as XLSX, JSON or PDF |

Existing source endpoints reused internally or by their existing screens:

| Method | Endpoint | Status | Analytics relationship |
|---|---|---|---|
| GET | `/api/payments/ledger/:studentId` | Existing | Canonical student payment ledger |
| POST | `/api/payments/record` | Existing | Canonical payment recording |
| POST | `/api/deposits` | Existing | Deposit records, accounting treatment applies |
| POST | `/api/deposits/:id/refund` | Existing | Deposit refund/reversal |
| GET | `/api/students` | Existing | Canonical student records |
| GET | `/api/floors` | Existing | Floor identities |
| GET | `/api/reading-rooms` | Existing | Room/floor relationships |
| GET | `/api/seats/map` | Existing | Canonical seat statuses and allocations |
| GET | `/api/attendance/:studentId` | Existing | Student-specific attendance history |
| POST | `/api/attendance/sync` | Existing | Canonical attendance ingestion |

No new endpoint is proposed for each chart or card.

---

## 21. Product/backend decisions to confirm

1. Is `Total Revenue` intended to mean recognized income or cash collected? The UI currently has both Revenue and Collections.
2. Are security deposits excluded from income and net profit until forfeited/recognized?
3. Which existing Expenses data store/API is authoritative, and what date field determines expense reporting?
4. Does `Total Students` mean active students at the end of the selected range, or all registered profiles?
5. Does "new students" mean new profiles or successfully admitted students?
6. Should seat occupancy percentage count half-day seats as occupied capacity, and how should a partially available half-day seat affect the ratio?
7. Should pending collection include only not-yet-due balances, with overdue shown separately?
8. Should overdue values be historical as of `toDate` or current outstanding overdue balances at request time?
9. Should Daily Average Visits divide by all calendar days or only operating days?
10. Which date presets should be visible in the UI? The provider currently uses `This Month`, while the revenue chart also contains its own period control.
11. Is floor/room filtering intended for the full analytics screen or only the seat analytics card?
12. Is a generic report-export endpoint already planned elsewhere? If yes, extend it instead of creating a second export mechanism.
13. Should Coordinator analytics use the same response with restricted data, or a separate permission-filtered projection?

**Implementation objective:** Deliver one secure, tenant-scoped Owner Analytics aggregation endpoint and one consistent export path, with all values calculated from the existing canonical student, payment, expense, attendance and seat records. Keep the current Flutter screen layout, remove demo values, preserve filter behavior, and do not duplicate APIs already defined by Student Management, Seat Management, Payments, Attendance, Expenses or Super Admin.
