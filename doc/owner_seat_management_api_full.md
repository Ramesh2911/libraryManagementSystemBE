# SmartLibrary --- Owner Seat Management API Documentation

**Version:** 1.1\
**Module:** Owner -> Seat Management\
**Audience:** Backend developers, Flutter developers, QA\
**API namespace:** Existing SmartLibrary API routes (`/api/...`)\
**Source UI:** `lib/features/common/seat_management/` and Owner Room
Setup files from the supplied `lib.zip`

------------------------------------------------------------------------

## 1. Purpose and scope

This document defines the API contract for the Owner's **Seat
Management** screen. It is intentionally limited to the functionality
present in the supplied Flutter UI and the existing API reference.

The Owner Seat Management screen currently supports:

1.  Loading every floor configured for the current tenant/hub (there is
    no fixed floor count).
2.  Showing seat totals and status counters for the selected room.
3.  Selecting a floor and dynamically loading only that floor's rooms.
4.  Selecting a room on that floor and dynamically loading that room's
    seat map.
5.  Showing the room type automatically from the selected room
    (read-only on this screen).
6.  Filtering seats by All, Vacant, Filled/Occupied, Pending/Reserved
    and Half Day.
7.  Displaying a seat grid with status colors.
8.  Selecting a seat and viewing its status, assigned student name and
    plan validity.

The Owner Room Setup screen separately configures each room's room type,
room number, total seat count and seat-number range. Seats are generated
from that room configuration. Seat Management does not currently contain
Add Seat, Delete Seat, Rename Seat or drag-and-drop layout controls.

**Important:** The provided `SeatManagementProvider` and `SeatModel` use
local demo data. The endpoints below define the backend contract needed
to replace that data. They do not indicate that a production backend is
already implemented.

------------------------------------------------------------------------

## 2. Duplicate-endpoint policy and reuse of existing APIs

The project already has a shared API reference and Postman collection.
This document does **not** create a second set of Floor, Room, Room
Type, Admission Availability, Student Transfer or Payment endpoints.

### 2.1 Existing endpoints reused by this module

  -----------------------------------------------------------------------
  Existing endpoint                   Reuse in Seat Management
  ----------------------------------- -----------------------------------
  `GET /api/floors`                   Load floor selector options

  `POST /api/floors`                  Create a floor from Business Setup,
                                      not from Seat Management

  `PATCH /api/floors/:id`             Update a floor from Business Setup

  `DELETE /api/floors/:id`            Delete a floor from Business Setup,
                                      subject to dependency checks

  `GET /api/reading-rooms`            Load rooms and room metadata

  `POST /api/reading-rooms`           Create a room from Room Setup

  `PATCH /api/reading-rooms/:id`      Update room configuration,
                                      including total seats and seat
                                      range

  `DELETE /api/reading-rooms/:id`     Delete a room from Room Setup,
                                      subject to dependency checks

  `GET /api/room-types`               Resolve room-type labels and
                                      configuration

  `GET /owner/admissions/seats` from  Date- and shift-specific
  Student API v1                      availability when making a new
                                      admission

  `POST /api/seats/:id/allocate`      Allocate a seat to a student

  `POST /api/seats/:id/transfer`      Transfer the current allocation to
                                      another seat

  `POST /api/seats/:id/vacate`        Vacate/release the current seat
                                      allocation

  `PATCH /api/seats/:id/status`       Change an administratively
                                      controlled seat status

  `GET /api/seats/:id/history`        View seat allocation/status history
  -----------------------------------------------------------------------

The `/api/seats/map` endpoint already exists in the API reference. This
document specifies its query parameters and response shape; it does not
add another map endpoint.

### 2.2 Avoid these duplicate implementations

-   Do not create a second `GET /owner/seats`, `GET /owner/seat-map` or
    `GET /api/owner/seats/map`. Use `GET /api/seats/map`.
-   Do not create new Floor or Room CRUD endpoints under `/api/seats`.
    Reuse `/api/floors` and `/api/reading-rooms`.
-   Do not create a second seat-transfer endpoint such as
    `/owner/students/{studentId}/seat-transfers`. Use the existing
    canonical `POST /api/seats/:id/transfer` for the seat operation. The
    student profile flow can call the same endpoint.
-   Do not use the New Admission availability endpoint as a replacement
    for the Seat Management map. Admission availability is
    date/shift-specific; the Seat Management map is a room overview with
    status, counters and selected-seat details.
-   Do not create a separate seat-allocation API under
    `/owner/admissions`. Reuse the existing admission creation flow and
    the canonical seat allocation operation according to the backend's
    transaction design.

### 2.3 Path and header compatibility

The older API reference and Postman collection use `/api/...` and the
`x-tenant-id` header. Keep those established route names for this
module.

``` http
Authorization: Bearer <ACCESS_TOKEN>
x-tenant-id: <TENANT_OR_HUB_ID>
Accept: application/json
Content-Type: application/json
```

If the backend gateway later standardizes on `/api/v1` and `X-Hub-Id`,
perform that as a platform-wide migration. Do not mix both conventions
within this module.

------------------------------------------------------------------------

## 3. Authentication, authorization and tenant scope

All endpoints in this document require an authenticated Owner session.

-   Verify the authenticated user's role is `owner`.
-   Verify the `x-tenant-id` belongs to that Owner.
-   Scope every floor, room, seat, allocation and history query to the
    authenticated tenant.
-   Never trust a tenant/owner ID in a JSON body as authorization.
-   A seat ID from another tenant must behave as not found.
-   Coordinators may use the shared Seat Management screen only through
    their separately configured permissions. This document defines Owner
    access; it does not grant coordinator access.

------------------------------------------------------------------------

## 4. UI data model and enums

### 4.1 Seat status

The current UI uses these statuses:

  -----------------------------------------------------------------------
  API value               UI label                Meaning
  ----------------------- ----------------------- -----------------------
  `vacant`                VACANT                  Seat has no active or
                                                  conflicting allocation

  `occupied`              OCCUPIED                Seat has a full-day or
                                                  otherwise non-shareable
                                                  active allocation

  `reserved`              RESERVED / Pending      Seat is held by a
                                                  pending
                                                  booking/admission
                                                  reservation

  `half_day`              HALF DAY                Seat has a half-day
                                                  allocation; the UI
                                                  currently groups these
                                                  seats under one status
  -----------------------------------------------------------------------

Do not expose `filled` as a separate stored status. The summary card
titled **Filled** maps to `occupied`.

### 4.2 Room type

Use the room-type values already configured by the Room Type module. The
supplied UI displays `AC`, `NON-AC` and `VIP`. The exact API codes
should match the existing `/api/room-types` records; examples below use
`ac`, `non_ac` and `vip`.

Room type is read-only in Seat Management. It is derived from the
selected room, not selected independently.

### 4.3 Seat identity and room setup

The Owner Room Setup model contains:

-   `roomType`
-   `roomNumber`
-   `totalSeats`
-   `seatFrom`
-   `seatTo`

The UI says seats in the configured range will be created for that room.
The backend should therefore generate or reconcile the room's seat
records when a room is created or its seat configuration is updated.

Recommended validation:

``` text
seatTo >= seatFrom
totalSeats == seatTo - seatFrom + 1
seat numbers are unique within a room
room number is unique within a floor (unless the product allows duplicates)
```

If the product intends `totalSeats` to be independent from the inclusive
range, confirm that rule before implementation. The supplied UI displays
both values, so the backend must validate their relationship
consistently.

### 4.4 Seat status is not seat configuration

A seat's operational status (`vacant`, `occupied`, `reserved`,
`half_day`) must not be confused with its configuration lifecycle.

A seat should also have an internal configuration state such as `active`
or `inactive`. Inactive seats are not shown in the normal seat grid. The
current UI does not expose a maintenance/blocked state, so do not add a
new visible status without a UI requirement.

------------------------------------------------------------------------

## 5. Seat Management screen --- map and summary

### 5.1 Get seat map for selected floor/room

`<badge color="success">`{=html}Existing endpoint --- specify/extend
contract`</badge>`{=html}

`GET /api/seats/map`

This endpoint supplies the full data required by the Seat Management
screen for one selected room.

**Query parameters**

  -----------------------------------------------------------------------------
  Parameter             Type                          Required Description
  --------------------- ---------------- --------------------- ----------------
  `floorId`             string                     Recommended Selected floor
                                                               ID

  `roomId`              string                             Yes Selected room ID

  `status`              string                              No `all`, `vacant`,
                                                               `occupied`,
                                                               `reserved`,
                                                               `half_day`

  `includeAllocation`   boolean                             No Default `true`;
                                                               include current
                                                               student and plan
                                                               validity

  `asOfDate`            date                                No Hub-local date
                                                               for evaluating
                                                               current status;
                                                               defaults to
                                                               today
  -----------------------------------------------------------------------------

The UI loads the map for the selected floor and room. The status filter
can be applied by the server using `status`, or locally using the
returned seat list. If the API filters on the server, the summary
counters must still represent **all active seats in the selected room**,
not just the filtered seats.

**Example**

``` http
GET /api/seats/map?floorId=floor_02&roomId=room_04&status=all&includeAllocation=true
```

**Response --- `200 OK`**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat map retrieved successfully",
  "data": {
    "floor": {
      "id": "floor_02",
      "name": "Floor 2",
      "displayOrder": 2
    },
    "room": {
      "id": "room_04",
      "number": "4",
      "roomType": {
        "id": "rtype_ac",
        "code": "ac",
        "label": "AC"
      },
      "totalSeats": 40,
      "seatFrom": 1,
      "seatTo": 40
    },
    "summary": {
      "all": 40,
      "vacant": 16,
      "occupied": 6,
      "reserved": 8,
      "halfDay": 10
    },
    "appliedFilter": "all",
    "seats": [
      {
        "id": "seat_004",
        "number": 4,
        "label": "4",
        "status": "vacant",
        "configurationStatus": "active",
        "allocation": null,
        "updatedAt": "2026-11-24T08:30:00Z"
      },
      {
        "id": "seat_015",
        "number": 15,
        "label": "15",
        "status": "half_day",
        "configurationStatus": "active",
        "allocation": {
          "id": "alloc_015",
          "student": {
            "id": "stu_1001",
            "name": "Amit Kulkarni"
          },
          "admissionId": "adm_1001",
          "plan": "monthly",
          "timeSlot": "half_day",
          "validFrom": "2026-11-01",
          "validUntil": "2026-11-30",
          "timing": {
            "start": "08:00",
            "end": "13:00"
          }
        },
        "updatedAt": "2026-11-24T08:30:00Z"
      },
      {
        "id": "seat_020",
        "number": 20,
        "label": "20",
        "status": "reserved",
        "configurationStatus": "active",
        "allocation": {
          "id": "reservation_020",
          "student": {
            "id": "stu_1008",
            "name": "Priya Das"
          },
          "admissionId": "adm_pending_020",
          "plan": "monthly",
          "timeSlot": "full_day",
          "validFrom": "2026-11-25",
          "validUntil": "2026-12-24",
          "reservationExpiresAt": "2026-11-24T11:00:00Z"
        },
        "updatedAt": "2026-11-24T08:45:00Z"
      }
    ],
    "selectedSeatId": null,
    "asOfDate": "2026-11-24"
  },
  "meta": {
    "requestId": "req_seat_map_001",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

**Response rules**

-   Return only active configured seats for the selected room.
-   Sort seats by numeric seat number ascending.
-   `summary.all` must equal the number of active configured seats.
-   Summary counts must add up to `summary.all`.
-   `allocation` is `null` for a vacant seat.
-   For a reserved seat, include the reservation expiry.
-   For a half-day seat, include the occupied time interval so the Owner
    can understand the remaining slot.
-   Do not return sensitive student fields such as mobile number, email,
    identity documents or payment data in the seat map.
-   If `status` is not `all`, filter the `seats` array but keep the
    summary counts unfiltered.
-   If `roomId` does not belong to `floorId` and tenant, return
    `404 ROOM_NOT_FOUND`.

### 5.2 Seat map refresh behavior

The Flutter provider should request the map:

-   When the screen opens.
-   When the selected floor changes and the selected room is resolved.
-   When the selected room changes.
-   After an allocation, transfer, vacate or administrative status
    change.
-   When the Owner taps a refresh action, if the UI later adds one.

The existing screen has no explicit refresh button. Refreshing after
mutations and when returning to the screen is sufficient for the current
UI.

### 5.3 Dynamic floor list and room list (multiple floors supported)

Do not hardcode a floor count or floor names in Flutter. The number of
floors is determined by the records returned for the authenticated
tenant/hub. If the owner has 1, 3, 5 or 20 configured floors, the same
screen and API flow must work without code changes.

Use the existing endpoints only:

``` http
GET /api/floors
GET /api/reading-rooms?floorId=<selectedFloorId>
GET /api/room-types
```

`GET /api/floors` is the source of truth for the floor dropdown. The API
reference confirms this route exists, but the supplied reference does
not define its response schema or pagination behavior. The following is
the required response contract for this screen; align the backend
implementation with the project-wide response envelope if one is already
standardized.

**Required floor response --- `200 OK`**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Floors retrieved successfully",
  "data": {
    "items": [
      {
        "id": "floor_01",
        "name": "Ground Floor",
        "displayOrder": 1,
        "isActive": true
      },
      {
        "id": "floor_02",
        "name": "First Floor",
        "displayOrder": 2,
        "isActive": true
      },
      {
        "id": "floor_03",
        "name": "Second Floor",
        "displayOrder": 3,
        "isActive": true
      }
    ],
    "total": 3
  },
  "meta": {
    "requestId": "req_floors_001",
    "timestamp": "2026-11-24T10:30:00Z"
  }
}
```

Rules for `GET /api/floors`:

-   Return all active floors belonging to the `x-tenant-id` in one
    response for this selector, unless the platform has mandatory
    pagination. If pagination is mandatory, return `total`, `page`,
    `limit` and `hasMore`, and Flutter must load every page before
    treating the list as complete.
-   Sort by `displayOrder` ascending, then by name.
-   `total` is the total number of active floors matching the tenant,
    not a hardcoded number.
-   Do not return floors belonging to another tenant.
-   An empty `items` array is valid when no floors are configured.
    Flutter should show an empty state and must not call the room or
    seat-map endpoint until a floor exists.
-   Do not add a new `/api/seat-management/floors` endpoint. Reuse
    `GET /api/floors`.

`GET /api/reading-rooms` must support the optional `floorId` query
parameter. This is an extension to the existing room-list endpoint, not
a new route.

**Request when a floor is selected**

``` http
GET /api/reading-rooms?floorId=floor_02
```

**Suggested room-list response data**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Rooms retrieved successfully",
  "data": {
    "items": [
      {
        "id": "room_04",
        "floorId": "floor_02",
        "number": "4",
        "roomTypeId": "rtype_ac",
        "roomTypeCode": "ac",
        "roomTypeLabel": "AC",
        "totalSeats": 40,
        "seatFrom": 1,
        "seatTo": 40,
        "activeSeatCount": 40
      }
    ],
    "total": 1
  }
}
```

Room-list rules:

-   When `floorId` is supplied, return only rooms belonging to that
    floor and current tenant.
-   When `floorId` is omitted, preserve the existing endpoint's general
    behavior for other callers; do not silently change unrelated
    screens.
-   Return an empty list if the selected floor has no rooms.
-   Validate that the selected floor belongs to the current tenant. An
    unknown or foreign-tenant floor returns `404 FLOOR_NOT_FOUND`.
-   Include the room type label in the room response when possible so
    the UI can display it without an extra lookup. `GET /api/room-types`
    remains available for other screens and for normalization; it is not
    a reason to create a duplicate route.

### 5.4 Required floor-change and room-change sequence

This is the required runtime behavior. Changing the floor must change
the room options and, after a room is selected, the seat grid and
counters.

**On screen open**

1.  Call `GET /api/floors`.
2.  Populate the floor dropdown from `data.items`; never generate
    `Floor 1`, `Floor 2`, etc. locally.
3.  If the list is empty, show the no-floors empty state and stop this
    loading sequence.
4.  Otherwise select the previously selected floor if it is still
    present; if not, select the first floor by `displayOrder`.
5.  Call `GET /api/reading-rooms?floorId=<selectedFloorId>`.
6.  If rooms exist, select the previously selected room only if it
    belongs to the selected floor; otherwise select the first room.
7.  Call
    `GET /api/seats/map?floorId=<selectedFloorId>&roomId=<selectedRoomId>`.
8.  Populate the room type, seat grid, summary counters and
    selected-seat panel from that response.

**When the owner changes the floor**

1.  Immediately set the selected floor ID to the new floor.
2.  Clear the old selected room, selected seat, old seat list and old
    room counters so data from the previous floor is not displayed under
    the new floor.
3.  Set loading state for rooms/map and call
    `GET /api/reading-rooms?floorId=<newFloorId>`.
4.  If the new floor has no rooms, show the no-rooms empty state, clear
    the seat grid and set room counters to zero. Do not call the map
    endpoint.
5.  Otherwise select the first room (or a previously remembered room
    only if it belongs to this floor), then call the existing
    `GET /api/seats/map` with both IDs.
6.  Replace the room type, seats and all five counters with the response
    for the newly selected room.

**When the owner changes the room**

1.  Clear the previously selected seat and old map data.
2.  Call
    `GET /api/seats/map?floorId=<currentFloorId>&roomId=<newRoomId>`.
3.  Replace the seat grid and all five counters with the returned
    room-scoped values.

**Required seat-map query parameters**

``` http
GET /api/seats/map?floorId=floor_02&roomId=room_04&status=all&includeAllocation=true
```

Both `floorId` and `roomId` are required for this screen. The backend
must verify that the room belongs to the supplied floor and tenant. The
route already exists; this document makes its filtering contract
explicit. It does not create a new seat-map route.

**Floor-change example**

-   Owner selects `floor_01`: Flutter loads rooms for `floor_01`, then
    the selected room's map.
-   Owner selects `floor_03`: Flutter loads rooms for `floor_03`, then
    that room's map.
-   The second response must contain only seats for the selected room on
    `floor_03`; no seats or counters from `floor_01` may remain visible.

**Race-condition protection**

If the owner changes floors quickly, an older rooms/map response may
arrive after a newer one. The Flutter provider must use request IDs,
cancellation, or a monotonically increasing request sequence. Apply a
response only if its floorId and roomId still match the current
selection. This prevents stale data from replacing the latest selection.

Suggested room response fields are shown above. The Floor selector
displays names from `GET /api/floors`; the Room selector displays rooms
returned for the selected floor. The Room Type field displays the
selected room's room type and remains read-only.

------------------------------------------------------------------------

## 6. Seat selection and details

### 6.1 Selecting a seat

Selecting a seat in the current UI is a client-side selection. It does
not change the seat's status or allocation.

The map response already includes the detail fields needed by the
selected-seat panel:

-   Seat number
-   Current status
-   Student name, if allocated
-   Plan validity, if allocated

No separate `GET /api/seats/:id` endpoint is required for the current
UI. Use the selected seat object from `GET /api/seats/map`.

### 6.2 Optional detail endpoint for future expansion

Only add this endpoint if the product later introduces a dedicated Seat
Details page with additional data not included in the map:

`GET /api/seats/:id`

It is **not required** for the current Seat Management screen and should
not be implemented merely to populate the existing selected-seat card.

------------------------------------------------------------------------

## 7. Seat allocation and lifecycle actions

The following operations are already listed in the existing API
reference. Their contracts are specified here so the Owner Seat
Management module can integrate consistently. Do not create additional
routes with the same purpose.

### 7.1 Allocate a seat

`<badge color="success">`{=html}Existing endpoint`</badge>`{=html}

`POST /api/seats/:id/allocate`

Use when an Owner manually assigns a vacant seat to a student, if that
action is exposed by the Owner UI or an authorized workflow.

**Request**

``` json
{
  "studentId": "stu_1001",
  "admissionId": "adm_1001",
  "timeSlot": "full_day",
  "validFrom": "2026-11-25",
  "validUntil": "2026-12-24",
  "timing": {
    "start": "08:00",
    "end": "20:00"
  },
  "notes": "Owner assigned seat"
}
```

**Response --- `201 Created`**

``` json
{
  "success": true,
  "statusCode": 201,
  "message": "Seat allocated successfully",
  "data": {
    "allocationId": "alloc_1001",
    "seatId": "seat_004",
    "seatNumber": 4,
    "studentId": "stu_1001",
    "admissionId": "adm_1001",
    "status": "occupied",
    "timeSlot": "full_day",
    "validFrom": "2026-11-25",
    "validUntil": "2026-12-24",
    "createdAt": "2026-11-24T10:40:00Z"
  }
}
```

The backend must validate the student, admission, seat, room and tenant
relationships. If the admission creation endpoint already creates the
allocation atomically, the Flutter New Admission flow must not call this
endpoint a second time. This endpoint is for a separate manual
allocation workflow only.

### 7.2 Transfer an allocation to another seat

`<badge color="success">`{=html}Existing endpoint --- canonical transfer
operation`</badge>`{=html}

`POST /api/seats/:id/transfer`

Here `:id` is the **currently allocated seat ID**.

**Request**

``` json
{
  "targetSeatId": "seat_021",
  "effectiveAt": "2026-11-25T00:00:00+05:30",
  "reason": "Student requested another seat",
  "notes": "Approved by Owner"
}
```

**Response**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat transferred successfully",
  "data": {
    "transferId": "transfer_1001",
    "studentId": "stu_1001",
    "previousSeat": {
      "id": "seat_004",
      "number": 4,
      "status": "vacant"
    },
    "newSeat": {
      "id": "seat_021",
      "number": 21,
      "status": "occupied"
    },
    "effectiveAt": "2026-11-25T00:00:00+05:30",
    "transferredAt": "2026-11-24T10:45:00Z"
  }
}
```

Rules:

-   Re-check target seat availability inside the same database
    transaction.
-   Validate compatible time slots and date ranges.
-   Preserve the previous allocation and create a transfer history
    record.
-   Do not update only the seat number on the student record.
-   If the target seat is unavailable, return `409 SEAT_NOT_AVAILABLE`.

**Duplicate note:** This is the canonical operation for seat transfers.
Any transfer action opened from Student Profile must call this same
endpoint. Do not separately implement the student-centric transfer
endpoint described in the earlier Student API draft.

### 7.3 Vacate a seat

`<badge color="success">`{=html}Existing endpoint`</badge>`{=html}

`POST /api/seats/:id/vacate`

Use when the Owner releases an active allocation. It should not delete
the student or admission history.

**Request**

``` json
{
  "effectiveAt": "2026-11-24T18:00:00+05:30",
  "reason": "Membership ended",
  "notes": "Seat released by Owner"
}
```

**Response**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat vacated successfully",
  "data": {
    "seatId": "seat_004",
    "seatNumber": 4,
    "previousStatus": "occupied",
    "currentStatus": "vacant",
    "releasedAt": "2026-11-24T12:30:00Z",
    "allocationId": "alloc_1001"
  }
}
```

Rules:

-   Close the active allocation using the supplied effective time.
-   Keep the allocation record in history.
-   Recalculate seat status from remaining allocations/reservations.
-   Do not mark the student as deleted.
-   If a student leaves, the student lifecycle/admission close flow
    should call this operation or perform the same release transaction
    internally. Do not release the same allocation twice.

### 7.4 Change administrative seat status

`<badge color="success">`{=html}Existing endpoint`</badge>`{=html}

`PATCH /api/seats/:id/status`

This operation is for administrative status changes only. It must not be
used to manually mark a seat occupied when no valid student allocation
exists.

**Request**

``` json
{
  "configurationStatus": "inactive",
  "reason": "Seat is under repair",
  "notes": "Temporarily removed from availability"
}
```

Allowed `configurationStatus` values:

-   `active`
-   `inactive`

**Response**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat configuration status updated",
  "data": {
    "seatId": "seat_004",
    "configurationStatus": "inactive",
    "operationalStatus": "vacant",
    "updatedAt": "2026-11-24T12:00:00Z"
  }
}
```

The supplied UI does not currently expose a blocked/maintenance status.
The endpoint is retained because it already exists in the API reference,
but the UI should call it only if a future Owner action is added.

Do not allow an occupied or reserved seat to become inactive unless the
backend has a defined safe transition (e.g. first transfer/vacate/cancel
the allocation).

### 7.5 Seat history

`<badge color="success">`{=html}Existing endpoint`</badge>`{=html}

`GET /api/seats/:id/history`

Returns the seat's historical allocations, transfers, releases and
administrative status changes.

**Query parameters**

  Parameter    Type      Description
  ------------ --------- -------------------------
  `page`       integer   Default 1
  `limit`      integer   Default 20, maximum 100
  `fromDate`   date      Optional start date
  `toDate`     date      Optional end date

**Response**

``` json
{
  "success": true,
  "statusCode": 200,
  "message": "Seat history retrieved successfully",
  "data": {
    "seatId": "seat_004",
    "seatNumber": 4,
    "events": [
      {
        "id": "seat_evt_001",
        "type": "allocated",
        "student": {
          "id": "stu_1001",
          "name": "Amit Kulkarni"
        },
        "timeSlot": "full_day",
        "validFrom": "2026-10-01",
        "validUntil": "2026-10-31",
        "actor": {
          "id": "owner_001",
          "name": "Reading Room Owner",
          "role": "owner"
        },
        "occurredAt": "2026-10-01T08:00:00Z"
      },
      {
        "id": "seat_evt_002",
        "type": "vacated",
        "student": {
          "id": "stu_1001",
          "name": "Amit Kulkarni"
        },
        "reason": "Membership ended",
        "actor": {
          "id": "owner_001",
          "name": "Reading Room Owner",
          "role": "owner"
        },
        "occurredAt": "2026-10-31T13:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 2,
      "totalPages": 1
    }
  }
}
```

The current UI does not have a history button or history panel. This
endpoint is part of the existing API reference and can support future
history UI and audit needs; it is not required to render the current
screen.

------------------------------------------------------------------------

## 8. Relationship with Student Management APIs

To prevent two APIs from controlling the same seat allocation, use the
following ownership rules:

  ---------------------------------------------------------------------------------
  User flow                           API to call
  ----------------------------------- ---------------------------------------------
  Open Owner Seat Management screen   `GET /api/seats/map`

  Change selected floor               Existing
                                      `GET /api/reading-rooms?floorId=...`, then
                                      existing
                                      `GET /api/seats/map?floorId=...&roomId=...`

  Change selected room                Existing `GET /api/reading-rooms` with
                                      `floorId`, then `GET /api/seats/map`

  View selected seat details          Use the selected seat object from map
                                      response

  New Student -> New Admission seat    Existing `GET /owner/admissions/seats` from
  picker                              Student API v1

  Complete New Admission and reserve  Existing `POST /owner/admissions` from
  seat                                Student API v1; it owns admission creation
                                      and reservation

  Manual allocation outside New       Existing `POST /api/seats/:id/allocate`
  Admission                           

  Student Profile -> Change Seat       Existing `POST /api/seats/:id/transfer`

  Student leaves / allocation ends    Existing `POST /api/seats/:id/vacate`, or
                                      call it internally in the admission-close
                                      transaction

  View seat history                   Existing `GET /api/seats/:id/history`
  ---------------------------------------------------------------------------------

**Important integration rule:** The Student API's
`GET /owner/admissions/seats` is for a specific date range and time
slot. The Seat Management map is for the currently selected room and its
status overview. They may share the same underlying allocation
service/database query, but they must not become two separate
seat-allocation systems.

------------------------------------------------------------------------

## 9. Summary counter calculation

The current UI shows five cards:

  -----------------------------------------------------------------------
  UI card                 API field               Calculation
  ----------------------- ----------------------- -----------------------
  All Seats               `summary.all`           Count of active
                                                  configured seats in
                                                  selected room

  Vacant                  `summary.vacant`        Active seats with no
                                                  conflicting allocation

  Filled                  `summary.occupied`      Seats occupied for the
                                                  full requested/current
                                                  operating period

  Pending                 `summary.reserved`      Seats held by pending
                                                  reservation

  Half Day                `summary.halfDay`       Seats with a half-day
                                                  allocation
  -----------------------------------------------------------------------

For the current screen, the five counts must describe the selected room,
not the entire hub. When the Owner changes floor or room, return the
counts for the newly selected room.

If the UI later needs hub-wide totals, that is a separate analytics
requirement and should reuse the dashboard/analytics aggregation rather
than changing the meaning of these room-level counters.

------------------------------------------------------------------------

## 10. Seat availability and half-day rules

The seat map must use the same allocation rules as New Admission.

1.  A full-day allocation conflicts with every overlapping allocation on
    the same seat.
2.  Two half-day allocations may share a seat only if the configured
    time intervals do not overlap and the hub permits sharing.
3.  A half-day allocation and a full-day allocation cannot overlap.
4.  A pending reservation blocks conflicting allocations until it
    expires or is cancelled.
5.  Expired reservations must stop blocking availability.
6.  A seat may be `half_day` in the map even if one compatible half-day
    slot remains available. The map response must include the allocation
    timing so the UI/backend can distinguish this from a fully
    unavailable seat.
7.  The New Admission availability endpoint remains authoritative for a
    requested date range and shift.
8.  Seat status must be derived from allocation/reservation records. Do
    not rely on a manually maintained status field as the only source of
    truth.

If the hub has configurable shifts, use its saved time-slot definitions.
Do not hardcode `08:00-13:00` and `13:00-20:00` unless those are the
actual configured values.

------------------------------------------------------------------------

## 11. Error responses

Use the common error envelope already defined by the project API
standard.

  ------------------------------------------------------------------------------------
                          HTTP Error code                     When
  ---------------------------- ------------------------------ ------------------------
                           400 `INVALID_SEAT_FILTER`          Unsupported status
                                                              filter

                           401 `TOKEN_EXPIRED`                Missing/expired access
                                                              token

                           403 `ROLE_NOT_AUTHORIZED`          User is not allowed to
                                                              manage Owner seats

                           404 `FLOOR_NOT_FOUND`              Floor is outside current
                                                              tenant or does not exist

                           404 `ROOM_NOT_FOUND`               Room does not exist or
                                                              does not belong to
                                                              selected floor

                           404 `SEAT_NOT_FOUND`               Seat is outside current
                                                              tenant or does not exist

                           404 `STUDENT_NOT_FOUND`            Student does not exist
                                                              in current tenant

                           409 `SEAT_NOT_AVAILABLE`           Target seat has a
                                                              conflicting
                                                              allocation/reservation

                           409 `SEAT_ALREADY_ALLOCATED`       Duplicate/conflicting
                                                              allocation attempt

                           409 `SEAT_HAS_ACTIVE_ALLOCATION`   Attempt to
                                                              deactivate/delete an
                                                              allocated seat

                           409 `ROOM_HAS_ACTIVE_SEATS`        Attempt to delete a room
                                                              with active seat
                                                              allocations

                           409 `INVALID_SEAT_RANGE`           Seat range overlaps or
                                                              conflicts with room
                                                              configuration

                           422 `INVALID_TIME_SLOT`            Invalid or overlapping
                                                              shift timing

                           422 `INVALID_VALIDITY_RANGE`       End date is before start
                                                              date

                           422 `INVALID_SEAT_TRANSITION`      Requested status
                                                              transition is not
                                                              allowed

                           429 `RATE_LIMITED`                 Too many requests

                           500 `INTERNAL_ERROR`               Unexpected server error
  ------------------------------------------------------------------------------------

Example conflict response:

``` json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "SEAT_NOT_AVAILABLE",
    "message": "This seat is no longer available. Refresh the seat map and select another seat."
  },
  "meta": {
    "requestId": "req_seat_conflict_001",
    "timestamp": "2026-11-24T10:50:00Z"
  }
}
```

------------------------------------------------------------------------

## 12. Flutter integration mapping

Suggested service boundary:

`OwnerSeatManagementApi`

Methods should map to existing endpoints:

``` dart
getFloors()
getRooms({required String floorId})
getSeatMap({
  required String roomId,
  String? floorId,
  SeatFilter? filter,
})
allocateSeat(...)
transferSeat(...)
vacateSeat(...)
updateSeatConfigurationStatus(...)
getSeatHistory(...)
```

Do not create a second service that independently allocates seats from
the Student Management module. Both Student Profile and Seat Management
should call the same seat allocation service/endpoint.

Suggested Provider mapping:

  --------------------------------------------------------------------------------------------------
  Existing Flutter code                         API integration
  --------------------------------------------- ----------------------------------------------------
  `SeatManagementProvider.floors`               Populate dynamically from `GET /api/floors`; do not
                                                hardcode floor names/count

  `SeatManagementProvider.roomsByFloor`         Populate from
                                                `GET /api/reading-rooms?floorId=<selectedFloorId>`
                                                each time the floor changes

  `SeatManagementProvider.roomTypeByFloor`      Room type data returned by `GET /api/reading-rooms`
                                                / `/api/room-types`

  `SeatManagementProvider._initializeSeats()`   Remove demo generation; populate from
                                                `GET /api/seats/map`

  `SeatManagementProvider.filteredSeats`        Filter map results by `vacant`, `occupied`,
                                                `reserved`, `half_day`

  `SeatManagementProvider.allSeatsCount`        `summary.all`

  `SeatManagementProvider.vacantCount`          `summary.vacant`

  `SeatManagementProvider.filledCount`          `summary.occupied`

  `SeatManagementProvider.reservedCount`        `summary.reserved`

  `SeatManagementProvider.halfDayCount`         `summary.halfDay`

  `SeatManagementProvider.selectedSeatModel`    Selected item from API map response
  --------------------------------------------------------------------------------------------------

Use the existing Owner color (`AppTheme.primaryPurple`) in the Owner UI.
Do not send a color value to the backend; color is a Flutter
presentation concern.

When changing the selected floor or room, clear the previous selected
seat and old room data, then load the new floor's rooms and the selected
room's map in sequence. Reset the status filter to `all`. Keep a request
sequence/cancellation strategy so a slow response for an old floor or
room cannot overwrite the currently selected floor/room data. If no
floors or no rooms exist, show the corresponding empty state instead of
a fabricated floor/room or stale seat grid.

------------------------------------------------------------------------

## 13. Transaction, concurrency and audit requirements

1.  Seat allocation, transfer, vacate and reservation confirmation must
    be transactional.
2.  Prevent double allocation with database-level constraints/locking,
    not only Flutter-side checks.
3.  Check tenant ownership for source seat, target seat, room, floor,
    student and admission.
4.  Preserve allocation history. Never overwrite an old allocation when
    transferring or vacating.
5.  A transfer must release the old seat and allocate the new seat
    atomically.
6.  A vacate operation must be idempotent or return a clear `409` if
    already released; it must never create duplicate release history.
7.  Use an idempotency key for retry-sensitive allocation actions.
8.  Record actor ID, role, tenant ID, timestamp, reason and affected
    seat IDs for each mutation.
9.  Seat map responses should be consistent snapshots. If a mutation
    happens during a map request, the next refresh must return the new
    state.
10. Do not hard-delete a seat with allocation history. Mark it inactive
    after validating that it has no active/future allocations.

------------------------------------------------------------------------

## 14. Endpoint inventory --- no new duplicate routes

The following is the complete endpoint inventory used by this Seat
Management module. Routes marked **existing** are already present in the
supplied API reference or Student API document.

  -------------------------------------------------------------------------------------------------------------
  Method            Endpoint                                           Status in project Purpose
  ----------------- -------------------------------------------------- ----------------- ----------------------
  GET               `/api/floors`                                      Existing          Return all tenant
                                                                                         floors dynamically,
                                                                                         including `total` and
                                                                                         ordered `items`

  GET               `/api/reading-rooms?floorId=:floorId`              Existing route;   Return only rooms for
                                                                       query contract    the selected floor
                                                                       required          

  GET               `/api/room-types`                                  Existing          Room type
                                                                                         labels/configuration

  GET               `/api/seats/map?floorId=:floorId&roomId=:roomId`   Existing route;   Return only selected
                                                                       query contract    room seat grid,
                                                                       required          selected-seat data and
                                                                                         room counters

  POST              `/api/seats/:id/allocate`                          Existing          Manual allocation,
                                                                                         only outside admission
                                                                                         creation flow

  POST              `/api/seats/:id/transfer`                          Existing          Canonical seat
                                                                                         transfer

  POST              `/api/seats/:id/vacate`                            Existing          Release current
                                                                                         allocation

  PATCH             `/api/seats/:id/status`                            Existing          Administrative
                                                                                         active/inactive
                                                                                         configuration

  GET               `/api/seats/:id/history`                           Existing          Seat history/audit

  GET               `/owner/admissions/seats`                          Existing in       Date/shift-specific
                                                                       Student API v1    admission availability

  POST              `/owner/admissions`                                Existing in       Admission creation and
                                                                       Student API v1    seat reservation
  -------------------------------------------------------------------------------------------------------------

No new route is required to display the current Owner Seat Management
screen. The required changes are query/response contract support on the
existing room-list and seat-map routes, plus a complete dynamic response
from the existing floor-list route.

------------------------------------------------------------------------

## 15. Product decisions to confirm

The supplied code establishes the current screen layout and seat
statuses, but these details need confirmation before backend
implementation:

1.  Whether `totalSeats` must always equal the inclusive
    `seatFrom`--`seatTo` range.
2.  Whether seat numbers are unique per room or across the entire floor.
3.  Whether a seat with one half-day allocation should always display
    `half_day`, even when the other shift is still free. The current UI
    suggests yes.
4.  Exact configured half-day time intervals and whether two half-day
    students can share one seat.
5.  Whether pending reservations are visible to the Owner as `reserved`
    and how long they remain active.
6.  Whether Owner Seat Management will later add a Maintenance/Blocked
    action. It is not present in the supplied screen.
7.  Whether the Owner should be able to manually allocate, transfer and
    vacate directly from this screen. The current selected-seat card
    only displays student name and plan validity; it does not show
    action buttons.

**Implementation target:** Support any number of tenant-configured
floors through `GET /api/floors`; load rooms by the selected floor
through `GET /api/reading-rooms?floorId=...`; and load that room's seat
map through `GET /api/seats/map?floorId=...&roomId=...`. Changing the
floor must replace the room options, seat grid, room type and all
summary counters. Keep one shared seat-allocation data source, one
canonical set of seat operation endpoints, and no duplicate Student
Management, Admission, Floor or Room APIs.
