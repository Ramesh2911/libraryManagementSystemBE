# SmartLibrary
# Owner Dashboard - Backend API Documentation

**Document Type:** Backend Developer Specification  
**API Version:** v1  
**Platform:** Flutter Mobile Application  
**Architecture:** REST API + JSON  
**Authentication:** JWT Bearer Token

---

## 1. API Configuration

**Base URL**

`https://api.smartlibrary.app/v1`

**Common Headers**

```http
Authorization: Bearer <ACCESS_TOKEN>
X-Hub-Id: <ACTIVE_HUB_ID>
Content-Type: application/json
Accept: application/json
```

All APIs must verify the authenticated Owner and their hub ownership.

### Standard Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {},
  "timestamp": "2026-11-24T12:00:00Z"
}
```

### Standard Error Response

```json
{
  "success": false,
  "statusCode": 404,
  "error": "HUB_NOT_FOUND",
  "message": "Hub not found",
  "errors": [],
  "timestamp": "2026-11-24T12:00:00Z"
}
```

---

## 2. Hub Management API

### 2.1 Get All Owner Hubs

**Method:** GET

**Endpoint:**
`/owner/hubs`

**Purpose:** Retrieve all Reading Rooms belonging to the logged-in Owner.

**Response:**

```json
{
  "success": true,
  "data": {
    "activeHubId": "hub_001",
    "totalHubs": 2,
    "hubs": [
      {
        "id": "hub_001",
        "name": "Smart Study Hub",
        "code": "SSH-001",
        "isActive": true,
        "isPrimary": true,
        "location": "Pune",
        "totalSeats": 100,
        "occupiedSeats": 70,
        "activeStudents": 85
      },
      {
        "id": "hub_002",
        "name": "Study Point",
        "code": "STP-002",
        "isActive": true,
        "isPrimary": false,
        "location": "Mumbai",
        "totalSeats": 150,
        "occupiedSeats": 90,
        "activeStudents": 110
      }
    ]
  }
}
```

### 2.2 Switch Active Hub

**Method:** PUT

**Endpoint:**
`/owner/hubs/switch`

**Request Body:**

```json
{
  "hubId": "hub_002"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Hub switched successfully",
  "data": {
    "activeHubId": "hub_002",
    "activeHubName": "Study Point",
    "totalFloors": 3
  }
}
```

**Required Behaviour:**

When the Owner changes the hub:

- Update active hub context.
- Fetch all floors for the selected hub.
- Fetch configured room types.
- Refresh all seat metrics.
- Refresh Business Overview.
- Refresh Revenue Overview and chart.
- Refresh Quick Actions.
- Refresh Offer Banner.
- Refresh notification status if hub-specific.
- Clear previous hub-specific cached values.

No information from the previous hub should remain visible.

---

## 3. Complete Owner Dashboard API

### 3.1 Get Dashboard Data

**Method:** GET

**Endpoint:**

`/owner/dashboard`

**Headers:**

```http
Authorization: Bearer <TOKEN>
X-Hub-Id: hub_001
```

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| hubId | String | Active hub |
| floorId | String | Selected floor |
| zoneId | String | AC / Non-AC zone |
| revenuePeriod | String | Revenue timeframe |

Supported revenue periods:

- today
- this_week
- this_month
- last_month
- this_year

**Example Request:**

`GET /owner/dashboard?hubId=hub_001&floorId=floor_1&zoneId=ac_zone&revenuePeriod=this_month`

### 3.2 Dashboard Response

The response must contain the following sections:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard loaded successfully",
  "data": {
    "header": {
      "user": {},
      "activeHub": {}
    },
    "seatOverview": {
      "filterOptions": {},
      "selectedFloor": {},
      "selectedZone": {},
      "metrics": {}
    },
    "bannerOffer": {},
    "businessOverview": {
      "stats": []
    },
    "revenueOverview": {},
    "quickActions": [],
    "floatingAction": {}
  }
}
```

The following sections define the complete field requirements.

---

## 4. Dashboard Header

**Response Fields:**

```json
{
  "user": {
    "id": "owner_001",
    "fullName": "Owner Name",
    "role": "owner",
    "avatarUrl": null,
    "hasUnreadNotifications": true,
    "unreadNotificationsCount": 3
  },
  "activeHub": {
    "id": "hub_001",
    "name": "Smart Study Hub",
    "location": "Pune",
    "hasMultipleHubs": true,
    "totalHubsCount": 2
  }
}
```

All header values must come from the authenticated Owner's account and selected hub.

---

## 5. Floor and Zone Filter API

### 5.1 Get Floors by Hub

**Method:** GET

**Endpoint:**

`/owner/hubs/{hubId}/floors`

**Response:**

```json
{
  "success": true,
  "data": {
    "floors": [
      {
        "id": "floor_1",
        "name": "Floor 1"
      },
      {
        "id": "floor_2",
        "name": "Floor 2"
      }
    ]
  }
}
```

### 5.2 Get Zones by Floor

**Method:** GET

**Endpoint:**

`/owner/hubs/{hubId}/floors/{floorId}/zones`

**Response:**

```json
{
  "success": true,
  "data": {
    "zones": [
      {
        "id": "ac_zone",
        "name": "AC Zone"
      },
      {
        "id": "non_ac_zone",
        "name": "Non AC Zone"
      }
    ]
  }
}
```

Only return zones configured for the selected floor.

---

## 6. Seat Overview API

### 6.1 Get Seat Metrics

**Method:** GET

**Endpoint:**

`/owner/dashboard/seats`

**Query Parameters:**

| Parameter | Required |
|---|---|
| hubId | Yes |
| floorId | No |
| zoneId | No |

Use `all` when all floors or zones are selected.

**Example:**

`GET /owner/dashboard/seats?hubId=hub_001&floorId=floor_1&zoneId=ac_zone`

**Response:**

```json
{
  "success": true,
  "data": {
    "hubId": "hub_001",
    "floorId": "floor_1",
    "zoneId": "ac_zone",
    "summary": {
      "totalSeats": 60,
      "filledSeats": 42,
      "vacantSeats": 14,
      "pendingSeats": 4
    },
    "percentages": {
      "filledPercentage": 70,
      "vacantPercentage": 23.33,
      "pendingPercentage": 6.67
    }
  }
}
```

**Calculation Rules:**

- Total Seats = All configured seats in the selected scope.
- Filled Seats = Seats with active confirmed allocations.
- Vacant Seats = Available seats.
- Pending Seats = Seats with pending booking or allocation requests.

The backend must define mutually exclusive seat statuses so that the counts reconcile correctly.

`Total Seats = Filled Seats + Vacant Seats + Pending Seats`

Changing Floor or Zone must refresh all four values and percentages.

---

## 7. Business Overview API

Business Overview must dynamically return all dashboard statistics.

**Method:** GET

**Endpoint:**

`/owner/dashboard/business-overview`

**Query Parameter:** `hubId`

**Response:**

```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "id": "delay_overdue",
        "title": "Delay / Overdue",
        "value": "28",
        "numericValue": 28,
        "targetRoute": "/owner/fee-reminders"
      },
      {
        "id": "total_students",
        "title": "Total Students",
        "value": "288",
        "numericValue": 288,
        "targetRoute": "/owner/students"
      },
      {
        "id": "overdue_amount",
        "title": "Overdue Amount",
        "value": "12850",
        "numericValue": 12850,
        "targetRoute": "/owner/advance-dues"
      },
      {
        "id": "today_collection",
        "title": "Today's Collection",
        "value": "18500",
        "numericValue": 18500,
        "targetRoute": "/owner/transactions"
      },
      {
        "id": "monthly_revenue",
        "title": "Monthly Revenue",
        "value": "112850",
        "numericValue": 112850,
        "targetRoute": "/owner/analytics"
      },
      {
        "id": "visit_today",
        "title": "Visit Today",
        "value": "32",
        "numericValue": 32,
        "targetRoute": "/add-visitor"
      }
    ]
  }
}
```

All statistics must be calculated using actual database records for the selected hub.

---

## 8. Revenue Overview API

### 8.1 Get Revenue by Period

**Method:** GET

**Endpoint:**

`/owner/dashboard/revenue`

**Query Parameters:**

| Parameter | Example |
|---|---|
| hubId | hub_001 |
| period | this_month |

Supported periods:

- today
- this_week
- this_month
- last_month
- this_year

**Response:**

```json
{
  "success": true,
  "data": {
    "period": "this_month",
    "currency": "INR",
    "totalRevenue": 68450,
    "previousPeriodRevenue": 59920,
    "growthPercentage": 14.2,
    "isGrowthPositive": true,
    "chart": {
      "points": [
        {
          "label": "Week 1",
          "amount": 18200,
          "date": "2026-11-01"
        },
        {
          "label": "Week 2",
          "amount": 31200,
          "date": "2026-11-09"
        },
        {
          "label": "Week 3",
          "amount": 42500,
          "date": "2026-11-17"
        },
        {
          "label": "Week 4",
          "amount": 68450,
          "date": "2026-11-23"
        }
      ]
    }
  }
}
```

When the Owner changes the revenue period:

- Update total revenue.
- Update growth percentage.
- Update comparison with previous period.
- Update chart points.
- Update chart labels.
- Update selected period label.

Revenue must be calculated using actual successful payment transactions, with refunds and reversals handled according to the accounting rules.

---

## 9. Promotional Offer Banner API

### 9.1 Get Active Offer

**Method:** GET

**Endpoint:**

`/owner/dashboard/offers/active`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "offer_001",
    "isVisible": true,
    "tag": "LIMITED TIME OFFER",
    "discountLabel": "69% OFF",
    "title": "Annual Plan",
    "description": "Special annual subscription offer",
    "currency": "INR",
    "originalPrice": 2399,
    "discountedPrice": 749,
    "billingCycle": "yearly",
    "actionLabel": "View Plans",
    "actionRoute": "/owner/subscription-plans",
    "expiresAt": "2026-12-31T23:59:59Z"
  }
}
```

The Owner Dashboard must display the offer according to backend configuration.

### 9.2 Offer Interaction

**Method:** POST

**Endpoint:**

`/owner/dashboard/offers/{offerId}/action`

**Request Body:**

```json
{
  "action": "clicked",
  "clientTimestamp": "2026-11-24T12:00:00Z"
}
```

Allowed actions:

- viewed
- clicked
- dismiss

**Response:**

```json
{
  "success": true,
  "message": "Offer interaction recorded",
  "data": {
    "offerId": "offer_001",
    "status": "clicked"
  }
}
```

Expired or inactive offers must not be displayed.

---

## 10. Quick Actions API

**Method:** GET

**Endpoint:**

`/owner/dashboard/quick-actions`

**Response:**

```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": "add_student",
        "label": "Add Students",
        "iconKey": "school",
        "targetRoute": "/owner-add-student",
        "badgeCount": null
      },
      {
        "id": "fee_collection",
        "label": "Fee Collection",
        "iconKey": "currency_rupee",
        "targetRoute": "/owner-fee-collection",
        "badgeCount": null
      },
      {
        "id": "overdue_list",
        "label": "Overdue List",
        "iconKey": "error",
        "targetRoute": "/owner/fee-reminders",
        "badgeCount": 28
      },
      {
        "id": "expenses",
        "label": "Expenses",
        "iconKey": "wallet",
        "targetRoute": "/owner/expenses",
        "badgeCount": null
      },
      {
        "id": "coordinators",
        "label": "Coordinators",
        "iconKey": "person",
        "targetRoute": "/manage-coordinators",
        "badgeCount": 3
      }
    ]
  }
}
```

The frontend will map `iconKey` to its local Flutter icons. Backend-provided routes must be validated against supported application routes.

---

## 11. Notification API

### 11.1 Get Unread Notification Count

**Method:** GET

**Endpoint:**

`/owner/notifications/unread-count`

**Response:**

```json
{
  "success": true,
  "data": {
    "unreadCount": 3,
    "hasUrgentAlerts": true,
    "latestAlerts": [
      {
        "id": "notif_001",
        "title": "Overdue Fee Alert",
        "message": "5 student payments are overdue",
        "category": "FEE_REMINDER",
        "createdAt": "2026-11-24T10:00:00Z"
      }
    ]
  }
}
```

### 11.2 Mark Notifications as Read

**Method:** PATCH

**Endpoint:**

`/owner/notifications/mark-read`

**Request Body:**

```json
{
  "markAll": true
}
```

**Response:**

```json
{
  "success": true,
  "message": "Notifications updated successfully"
}
```

---

## 12. Dashboard Field Mapping

| Dashboard Section | API Response Field |
|---|---|
| Owner Name | header.user.fullName |
| Profile Image | header.user.avatarUrl |
| Active Hub | header.activeHub.name |
| Hub Count | header.activeHub.totalHubsCount |
| Floor Dropdown | seatOverview.filterOptions.floors |
| Zone Dropdown | seatOverview.filterOptions.zones |
| Total Seats | seatOverview.metrics.totalSeats |
| Filled Seats | seatOverview.metrics.filledSeats |
| Vacant Seats | seatOverview.metrics.vacantSeats |
| Pending Seats | seatOverview.metrics.pendingSeats |
| Business Cards | businessOverview.stats |
| Revenue Amount | revenueOverview.totalRevenue |
| Revenue Chart | revenueOverview.chart.points |
| Offer Banner | bannerOffer |
| Quick Actions | quickActions |
| Notification Badge | header.user.unreadNotificationsCount |
| Floating Action | floatingAction |

Every displayed field must be connected to its corresponding API response value.

---

## 13. Flutter Integration Flow

The existing Flutter architecture should be preserved.

**State Management:** Provider  
**Navigation:** GetX  
**API Client:** Dio or HTTP

### Initial Dashboard Load

1. Authenticate Owner.
2. Call `GET /owner/hubs`.
3. Get the active hub ID.
4. Call `GET /owner/dashboard`.
5. Parse the response into Dashboard models.
6. Update Provider state.
7. Display all dashboard widgets.

### Hub Change Flow

1. Owner selects another hub.
2. Call `PUT /owner/hubs/switch`.
3. Update active hub ID.
4. Clear old hub-specific dashboard state.
5. Fetch the new hub dashboard.
6. Refresh all related widgets.

### Floor Change Flow

1. Owner selects a floor.
2. Fetch zones for that floor.
3. Reset the selected zone if it is not available on the new floor.
4. Call the Seat Overview API.
5. Update Total, Filled, Vacant and Pending Seats.

### Zone Change Flow

1. Owner selects AC or Non-AC.
2. Call the Seat Overview API with the selected zone.
3. Update all seat metrics and percentages.

### Revenue Filter Flow

1. Owner selects a revenue period.
2. Call Revenue API with the selected period.
3. Update revenue amount and graph.

---

## 14. Error Handling

| HTTP Status | Error Code | Expected Behaviour |
|---|---|---|
| 400 | INVALID_REQUEST | Show validation message |
| 401 | TOKEN_EXPIRED | Redirect to login |
| 403 | ROLE_NOT_AUTHORIZED | Deny access |
| 404 | HUB_NOT_FOUND | Reload hub list |
| 404 | NO_HUBS_CONFIGURED | Open onboarding |
| 422 | INVALID_FILTER_PARAMS | Reset invalid filter |
| 500 | INTERNAL_SERVER_ERROR | Show retry option |

Never show misleading or fabricated dashboard metrics when an API fails.

---

## 15. Backend Development Rules

1. All Owner dashboard values must come from actual database records.
2. Do not hardcode hub names, floors, zones or seat counts.
3. Every Owner must only access their own hubs.
4. Floors must depend on the selected hub.
5. Zones must depend on the selected floor.
6. Seat metrics must depend on the selected hub, floor and zone.
7. Revenue must depend on the selected hub and period.
8. Business Overview must use the correct hub-specific data.
9. Offer visibility and pricing must be controlled by backend configuration.
10. All monetary amounts must use numeric values and an explicit currency.
11. Use consistent API response structures.
12. Handle empty states correctly.
13. Validate all hub and filter identifiers on the server.
14. Do not allow data from different hubs to mix.
15. All sensitive APIs must enforce server-side authorization.
16. Use appropriate pagination for any future list-based dashboard data.
17. Use loading, error and empty states in Flutter.
18. Prevent older asynchronous responses from overwriting data for a newly selected hub.

---

## 16. Final Development Objective

The Owner Dashboard must be completely dynamic and API-driven.

When the Owner changes the Hub, the entire dashboard must update.

When the Owner changes the Floor, the floor-specific data must update.

When the Owner changes the AC/Non-AC Zone, all related seat metrics must update.

When the Owner changes the Revenue Period, the revenue amount and chart must update.

The Offer Banner, Business Overview, Quick Actions and Notifications must also receive their values from backend APIs.

**Important:** These sample JSON responses define the API contract, not production data. The backend developer must implement the endpoints using actual database queries and existing SmartLibrary business logic.

**Flutter implementation must preserve the existing UI, Provider state management and GetX navigation. Do not redesign existing screens or change unrelated business logic while integrating these APIs.**