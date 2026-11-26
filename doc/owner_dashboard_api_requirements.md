# SmartLibrary -- Owner Dashboard API Requirements

**Purpose:** API requirements and example response bodies for completing
the current Owner Dashboard.

**Important:** This document is a proposed API contract based on the
Dashboard UI and API logs shared in the conversation. Only endpoints
explicitly marked as observed have been seen in the supplied logs.
Proposed endpoints and response bodies must be confirmed with the
backend developer and checked against the live Swagger documentation
before implementation.

## 1. Dashboard behavior and filters

The Dashboard has a selected Library and two seat filters:

-   **All Floors:** shows seats across every floor in the selected
    Library.
-   **All Room Types:** shows seats across all room types available in
    the selected Library.
-   Selecting a Floor filters the seat statistics to that Floor.
-   Selecting a Room Type filters the seat statistics to that Room Type.
-   Selecting both filters applies both filters together.
-   When the selected Library changes, reload its Floors and available
    Room Types, reset the previous Floor and Room Type selections, and
    reload the Dashboard data.

Example filter behavior:

  Floor        Room Type        Expected result
  ------------ ---------------- ----------------------------------------------------
  All Floors   All Room Types   All seats in the selected Library
  All Floors   AC               AC seats across all floors in the selected Library
  Floor 1      All Room Types   All room-type seats on Floor 1
  Floor 1      AC               AC seats on Floor 1

The Room Type list must contain only room types available/used in the
selected Library. If room types are tenant-wide in the backend, the
backend must filter them by the selected Library's actual room usage
rather than returning every tenant room type.

## 2. Current Owner and Library

### 2.1 Current Owner

**Observed endpoint**

``` http
GET /api/v1/auth/me
```

Observed response shape:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Current user",
  "data": {
    "sub": "11111111-1111-1111-1111-111111111111",
    "tenant_id": "11111111-1111-1111-1111-111111111111",
    "role": "OWNER"
  },
  "timestamp": "2026-11-26T04:01:16.578Z"
}
```

### 2.2 Libraries

**Observed endpoint**

``` http
GET /api/v1/libraries
```

Observed response shape (the supplied log showed a list of library
objects):

``` json
[
  {
    "library_id": "22222222-2222-2222-2222-222222222222",
    "tenant_id": "11111111-1111-1111-1111-111111111111",
    "name": "Test Library",
    "address": null,
    "logo_url": null,
    "contact": null,
    "status": "active",
    "createdAt": "2026-11-24T14:15:25.726Z",
    "updatedAt": "2026-11-24T14:15:25.726Z"
  }
]
```

Use the selected `library_id` for Library-scoped Dashboard requests.

## 3. Floor dropdown

**Observed endpoint**

``` http
GET /api/v1/floors?libraryId={libraryId}
```

The supplied logs showed HTTP 200, but the returned floor object had a
`library_id` different from the selected Library ID. Backend data
scoping should be checked.

Example response shape:

``` json
[
  {
    "floor_id": "floor-001",
    "tenant_id": "tenant-001",
    "library_id": "library-001",
    "name": "Ground Floor",
    "status": "active",
    "createdAt": "2026-11-24T14:42:51.642Z",
    "updatedAt": "2026-11-24T14:42:51.690Z"
  }
]
```

The `All Floors` option is a frontend filter option and does not need to
be returned as a database record.

## 4. Room Type dropdown

**Observed endpoint**

``` http
GET /api/v1/room-types
```

The supplied logs showed HTTP 200 and a list of room types. They do not
prove that the endpoint supports Library filtering.

**Proposed Library-filtered endpoint (confirm with backend):**

``` http
GET /api/v1/room-types?libraryId={libraryId}
```

Example response body:

``` json
[
  {
    "room_type_id": "room-type-001",
    "tenant_id": "tenant-001",
    "library_id": "library-001",
    "name": "AC",
    "description": null,
    "status": "active"
  },
  {
    "room_type_id": "room-type-002",
    "tenant_id": "tenant-001",
    "library_id": "library-001",
    "name": "Non-AC",
    "description": null,
    "status": "active"
  }
]
```

The `library_id` field above is illustrative. If the backend models
room-type availability through reading rooms rather than a direct
Library relationship, it may return the same filtered list without this
field. The required behavior is that only Room Types available in the
selected Library are returned.

## 5. Seat Statistics

**Required capability; endpoint not observed in supplied logs.**

Proposed endpoint:

``` http
GET /api/v1/seats/summary?libraryId={libraryId}&floorId={floorId}&roomTypeId={roomTypeId}
```

`floorId` and `roomTypeId` should be optional. If omitted, the summary
should cover all floors and room types in the selected Library.

Example response body:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat summary fetched successfully",
  "data": {
    "libraryId": "library-001",
    "filters": {
      "floorId": null,
      "roomTypeId": null
    },
    "totalSeats": 100,
    "filledSeats": 60,
    "vacantSeats": 30,
    "pendingSeats": 10
  },
  "timestamp": "2026-11-26T10:00:00.000Z"
}
```

The backend must define the exact meaning of `pendingSeats` and ensure
the counts are mutually consistent. The values above are sample data
only.

## 6. Limited Time Offer banner

**Required capability; endpoint not observed in supplied logs.**

Proposed endpoint:

``` http
GET /api/v1/offers/active
```

Example response body:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Active offers fetched successfully",
  "data": [
    {
      "offerId": "offer-001",
      "title": "LIMITED TIME OFFER",
      "description": "Annual Plan",
      "originalPrice": 2399,
      "discountedPrice": 749,
      "discountPercentage": 69,
      "startDate": "2026-11-01",
      "endDate": "2026-12-31",
      "isActive": true
    }
  ],
  "timestamp": "2026-11-26T10:00:00.000Z"
}
```

Confirm whether offers are global, tenant-specific, or Library-specific.

## 7. Business Overview cards

**Required capability; endpoint not observed in supplied logs.**

Recommended aggregated endpoint:

``` http
GET /api/v1/owner/dashboard/business-overview?libraryId={libraryId}
```

Example response body:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Business overview fetched successfully",
  "data": {
    "delayOverdue": {
      "count": 12
    },
    "totalStudents": {
      "count": 250
    },
    "overdueAmount": {
      "amount": 12500,
      "currency": "INR"
    },
    "todayCollection": {
      "amount": 4500,
      "currency": "INR"
    },
    "monthlyRevenue": {
      "amount": 68450,
      "currency": "INR"
    },
    "visitToday": {
      "count": 8
    }
  },
  "timestamp": "2026-11-26T10:00:00.000Z"
}
```

Dashboard mapping:

  Response field             Dashboard card
  -------------------------- --------------------
  `delayOverdue.count`       Delay / Overdue
  `totalStudents.count`      Total Students
  `overdueAmount.amount`     Overdue Amount
  `todayCollection.amount`   Today's Collection
  `monthlyRevenue.amount`    Monthly Revenue
  `visitToday.count`         Visit Today

Backend calculation definitions to confirm:

-   **Delay / Overdue:** number of students or fee records past their
    due date. Confirm which count the UI should display.
-   **Overdue Amount:** total outstanding amount past due.
-   **Today's Collection:** successful payments collected during the
    selected Library's local business day.
-   **Monthly Revenue:** successful/settled collections in the selected
    month. Define how refunds, reversals, discounts, and deposits are
    treated.
-   **Visit Today:** visitors matching today's date in the selected
    Library's timezone.

All values must be scoped to the authenticated Owner and selected
Library.

## 8. Revenue Overview chart

**Required capability; endpoint not observed in supplied logs.**

Proposed endpoint:

``` http
GET /api/v1/owner/dashboard/revenue?libraryId={libraryId}&period=this_month
```

Suggested supported periods: `this_month`, `last_month`, `this_year`.

Example response body:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Revenue data fetched successfully",
  "data": {
    "period": "this_month",
    "currency": "INR",
    "totalRevenue": 68450,
    "previousPeriodRevenue": 59900,
    "growthPercentage": 14.2,
    "chart": [
      {
        "date": "2026-11-01",
        "amount": 2500
      },
      {
        "date": "2026-11-05",
        "amount": 8500
      },
      {
        "date": "2026-11-10",
        "amount": 12000
      },
      {
        "date": "2026-11-15",
        "amount": 9500
      },
      {
        "date": "2026-11-20",
        "amount": 16000
      },
      {
        "date": "2026-11-26",
        "amount": 19950
      }
    ]
  },
  "timestamp": "2026-11-26T10:00:00.000Z"
}
```

The chart points and total above are illustrative. The backend should
return points at a consistent interval suitable for the selected period
and define how growth is calculated when the previous period has zero
revenue.

## 9. Visit Today

The supplied logs show this endpoint returning a summary and a visitor
list:

**Observed endpoint**

``` http
GET /api/v1/visitors
```

The later supplied request used:

``` http
GET /api/v1/visitors?from_date=2026-11-26&to_date=2026-11-26
```

Observed response shape:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": {
    "summary": {
      "total_count": 7,
      "checked_in_count": 1,
      "checked_out_count": 6
    },
    "visitors": []
  },
  "timestamp": "2026-11-26T04:14:46.146Z"
}
```

Use the appropriate date filter and Library scope if supported. The
supplied response shows `total_count: 7` while `visitors` is empty for
the date-filtered request; this may be an overall summary with a
filtered list, so confirm the intended semantics with the backend before
using `total_count` as today's visits.

## 10. Quick Actions

Quick Actions are create workflows. Use existing create endpoints where
available; do not create duplicate endpoints solely for the Dashboard.

  Dashboard action   Endpoint to verify
  ------------------ ---------------------------------------------
  Add Reading Room   `POST /api/v1/reading-rooms`
  Add Student        `POST /api/v1/students`
  Add Visitor        `POST /api/v1/visitors`
  Add Floor          Existing Floor create endpoint
  Add Room Type      Existing Room Type create endpoint
  Collect Fee        Existing payment/collection create endpoint

The supplied logs confirm `GET /api/v1/reading-rooms`,
`GET /api/v1/students`, and `GET /api/v1/visitors`; they do not
establish the create request/response contracts for all these actions.

Example Visitor create response (illustrative only):

``` json
{
  "success": true,
  "statusCode": 201,
  "message": "Visitor created successfully",
  "data": {
    "id": "visitor-001",
    "full_name": "Rahul Das",
    "phone_number": "9876543210",
    "purpose": "Meeting",
    "status": "checked_in"
  },
  "timestamp": "2026-11-26T10:00:00.000Z"
}
```

## 11. Notifications

**Required capability if the Dashboard bell displays backend
notifications; endpoint not observed in supplied logs.**

Proposed endpoint:

``` http
GET /api/v1/notifications
```

Example response body:

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications fetched successfully",
  "data": {
    "unreadCount": 2,
    "notifications": [
      {
        "id": "notification-001",
        "title": "Fee Payment Received",
        "message": "A student has completed a fee payment.",
        "type": "payment",
        "isRead": false,
        "createdAt": "2026-11-26T09:30:00.000Z"
      },
      {
        "id": "notification-002",
        "title": "New Student Registered",
        "message": "A new student registration was completed.",
        "type": "student",
        "isRead": false,
        "createdAt": "2026-11-26T09:15:00.000Z"
      }
    ]
  },
  "timestamp": "2026-11-26T10:00:00.000Z"
}
```

If users can mark notifications as read, confirm the existing update
endpoint and response contract.

## 12. Endpoints observed in the supplied Flutter logs

  -----------------------------------------------------------------------------
  Endpoint                      Observed result         Notes
  ----------------------------- ----------------------- -----------------------
  `GET /api/v1/auth/me`         HTTP 200                Current user role was
                                                        `OWNER`

  `GET /api/v1/libraries`       HTTP 200                Library array returned

  `GET /api/v1/floors`          HTTP 200                One returned Floor had
                                                        a `library_id`
                                                        different from the
                                                        selected Library ID;
                                                        investigate data
                                                        scoping

  `GET /api/v1/room-types`      HTTP 200                Room Type array
                                                        returned; Library
                                                        filtering not
                                                        established

  `GET /api/v1/reading-rooms`   HTTP 400 initially,     Initial request omitted
                                later HTTP 200          required `libraryId`;
                                                        later request returned
                                                        an empty array

  `GET /api/v1/students`        HTTP 200                Five student records
                                                        appeared in the
                                                        supplied response

  `GET /api/v1/visitors`        HTTP 200                Summary and visitor
                                                        list returned;
                                                        date-filtered list was
                                                        empty
  -----------------------------------------------------------------------------

## 13. Backend confirmation checklist

Please confirm these items before Flutter integration:

1.  Does an existing Seat Summary/Seat Map endpoint exist? If yes,
    provide its exact route, filters, and response.
2.  Can the Room Type endpoint return only Room Types available in a
    selected Library?
3.  Does the backend already provide overdue counts and overdue amounts?
4.  Which endpoint returns successful payment collections, and how are
    refunds/reversals handled?
5.  Is there an existing monthly revenue summary and chart endpoint?
6.  Is there an active offer endpoint?
7.  Is there a notification list/unread-count endpoint?
8.  Are all Dashboard metrics scoped by authenticated Owner and selected
    `libraryId`?
9.  What timezone is used for "Today" and monthly date boundaries?
10. Which proposed endpoints are already implemented, and which would
    require backend development?

## 14. Implementation guidance

-   Check the live Swagger documentation before adding any endpoint.
-   Reuse existing implemented endpoints; do not create duplicate
    routes.
-   Treat all endpoint paths and response bodies marked
    proposed/illustrative as examples, not verified backend contracts.
-   Keep the existing response shape for each endpoint. Some observed
    endpoints return a raw array, while others use the
    `{ success, statusCode, message, data, timestamp }` envelope.
-   Handle loading, empty, and error states for each Dashboard section.
-   Refetch Library-scoped data when the selected Library changes.
-   Refetch Seat Summary when Floor or Room Type changes.
-   Do not show hardcoded demo values as live Dashboard metrics.
