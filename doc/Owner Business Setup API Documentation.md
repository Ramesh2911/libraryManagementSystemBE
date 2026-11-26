# SmartLibrary – Owner Business Setup API Documentation

## 1. Library Basic Details

### Existing API – Reuse / Extend

**GET** `/api/v1/libraries`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "library_id",
      "name": "Smart Library",
      "branch_name": "Main Branch",
      "owner_name": "Owner Name",
      "mobile": "9876543210",
      "email": "owner@example.com"
    }
  ]
}
```

### Proposed – Create Library

**POST** `/api/v1/libraries`

Response:
```json
{
  "success": true,
  "message": "Library created successfully",
  "data": {
    "id": "library_id",
    "name": "Smart Library",
    "branch_name": "Main Branch",
    "owner_name": "Owner Name",
    "mobile": "9876543210",
    "email": "owner@example.com"
  }
}
```

### Proposed – Update Library

**PATCH** `/api/v1/libraries/{libraryId}`

Response:
```json
{
  "success": true,
  "message": "Library updated successfully",
  "data": {
    "id": "library_id",
    "name": "Smart Library",
    "branch_name": "Main Branch",
    "owner_name": "Owner Name",
    "mobile": "9876543210",
    "email": "owner@example.com"
  }
}
```

---

## 2. Library Location

### Existing Library API – Extend if Required

**GET** `/api/v1/libraries/{libraryId}`

Response:
```json
{
  "success": true,
  "data": {
    "id": "library_id",
    "address": "123 Main Road",
    "area": "Salt Lake",
    "unit": "Unit 2",
    "city": "Kolkata",
    "state": "West Bengal",
    "pin_code": "700001",
    "latitude": 22.5726,
    "longitude": 88.3639
  }
}
```

**PATCH** `/api/v1/libraries/{libraryId}`

Response:
```json
{
  "success": true,
  "message": "Library location updated successfully",
  "data": {
    "id": "library_id",
    "address": "123 Main Road",
    "area": "Salt Lake",
    "unit": "Unit 2",
    "city": "Kolkata",
    "state": "West Bengal",
    "pin_code": "700001",
    "latitude": 22.5726,
    "longitude": 88.3639
  }
}
```

---

## 3. Operation & Timing

### Proposed – Get Operation Details

**GET** `/api/v1/libraries/{libraryId}/operation`

Response:
```json
{
  "success": true,
  "data": {
    "library_id": "library_id",
    "opening_time": "08:00",
    "closing_time": "22:00",
    "working_days": [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY"
    ],
    "time_slots": [
      {
        "id": "slot_1",
        "name": "Morning",
        "start_time": "08:00",
        "end_time": "14:00"
      },
      {
        "id": "slot_2",
        "name": "Evening",
        "start_time": "14:00",
        "end_time": "22:00"
      }
    ],
    "holidays": [
      {
        "id": "holiday_1",
        "name": "Public Holiday",
        "date": "2026-12-25"
      }
    ]
  }
}
```

### Proposed – Save / Update Operation Details

**PUT** `/api/v1/libraries/{libraryId}/operation`

Response:
```json
{
  "success": true,
  "message": "Operation details saved successfully",
  "data": {
    "library_id": "library_id",
    "opening_time": "08:00",
    "closing_time": "22:00",
    "working_days": [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY"
    ],
    "time_slots": [
      {
        "id": "slot_1",
        "name": "Morning",
        "start_time": "08:00",
        "end_time": "14:00"
      },
      {
        "id": "slot_2",
        "name": "Evening",
        "start_time": "14:00",
        "end_time": "22:00"
      }
    ],
    "holidays": []
  }
}
```

---

## 4. Floor Management

### Existing API – Reuse

**GET** `/api/v1/floors`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "floor_1",
      "library_id": "library_id",
      "name": "Ground Floor"
    },
    {
      "id": "floor_2",
      "library_id": "library_id",
      "name": "1st Floor"
    }
  ]
}
```

### Existing / Proposed – Create Floor

**POST** `/api/v1/floors`

Response:
```json
{
  "success": true,
  "message": "Floor created successfully",
  "data": {
    "id": "floor_1",
    "library_id": "library_id",
    "name": "Ground Floor"
  }
}
```

### Existing / Proposed – Update Floor

**PATCH** `/api/v1/floors/{floorId}`

Response:
```json
{
  "success": true,
  "message": "Floor updated successfully",
  "data": {
    "id": "floor_1",
    "library_id": "library_id",
    "name": "Ground Floor"
  }
}
```

### Existing / Proposed – Delete Floor

**DELETE** `/api/v1/floors/{floorId}`

Response:
```json
{
  "success": true,
  "message": "Floor deleted successfully"
}
```

---

## 5. Room Management

### Existing API – Reuse

**GET** `/api/v1/reading-rooms`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "room_1",
      "library_id": "library_id",
      "floor_id": "floor_1",
      "room_number": "101",
      "room_type_id": "room_type_1",
      "room_type_name": "AC",
      "total_seats": 50
    },
    {
      "id": "room_2",
      "library_id": "library_id",
      "floor_id": "floor_1",
      "room_number": "102",
      "room_type_id": "room_type_2",
      "room_type_name": "NON-AC",
      "total_seats": 30
    }
  ]
}
```

### Existing / Proposed – Create Room

**POST** `/api/v1/reading-rooms`

Response:
```json
{
  "success": true,
  "message": "Room created successfully",
  "data": {
    "id": "room_1",
    "library_id": "library_id",
    "floor_id": "floor_1",
    "room_number": "101",
    "room_type_id": "room_type_1",
    "total_seats": 50
  }
}
```

### Existing / Proposed – Update Room

**PATCH** `/api/v1/reading-rooms/{roomId}`

Response:
```json
{
  "success": true,
  "message": "Room updated successfully",
  "data": {
    "id": "room_1",
    "library_id": "library_id",
    "floor_id": "floor_1",
    "room_number": "101",
    "room_type_id": "room_type_1",
    "total_seats": 60
  }
}
```

### Existing / Proposed – Delete Room

**DELETE** `/api/v1/reading-rooms/{roomId}`

Response:
```json
{
  "success": true,
  "message": "Room deleted successfully"
}
```

---

## 6. Room Type Management

### Existing API – Reuse

**GET** `/api/v1/room-types`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "room_type_1",
      "name": "AC"
    },
    {
      "id": "room_type_2",
      "name": "NON-AC"
    }
  ]
}
```

### Proposed – Create Custom Room Type

**POST** `/api/v1/room-types`

Response:
```json
{
  "success": true,
  "message": "Room type created successfully",
  "data": {
    "id": "room_type_3",
    "name": "Premium AC"
  }
}
```

### Proposed – Update Room Type

**PATCH** `/api/v1/room-types/{roomTypeId}`

Response:
```json
{
  "success": true,
  "message": "Room type updated successfully",
  "data": {
    "id": "room_type_3",
    "name": "Premium AC"
  }
}
```

### Proposed – Delete Room Type

**DELETE** `/api/v1/room-types/{roomTypeId}`

Response:
```json
{
  "success": true,
  "message": "Room type deleted successfully"
}
```

---

## 7. Room Type-wise Fees & Deposit

### Proposed – Get Room Type Pricing

**GET** `/api/v1/libraries/{libraryId}/room-type-pricing`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "pricing_1",
      "library_id": "library_id",
      "room_type_id": "room_type_1",
      "room_type_name": "AC",
      "full_day": {
        "monthly_fee_per_seat": 1500,
        "security_deposit": 3000,
        "deposit_type": "REFUNDABLE",
        "advance_amount": 500
      },
      "half_day": {
        "enabled": true,
        "monthly_fee_per_seat": 900,
        "security_deposit": 1500,
        "deposit_type": "NON_REFUNDABLE",
        "advance_amount": 300
      }
    },
    {
      "id": "pricing_2",
      "library_id": "library_id",
      "room_type_id": "room_type_2",
      "room_type_name": "NON-AC",
      "full_day": {
        "monthly_fee_per_seat": 1000,
        "security_deposit": 2000,
        "deposit_type": "REFUNDABLE",
        "advance_amount": 300
      },
      "half_day": {
        "enabled": false
      }
    }
  ]
}
```

### Proposed – Save Room Type Pricing

**PUT** `/api/v1/libraries/{libraryId}/room-type-pricing`

Response:
```json
{
  "success": true,
  "message": "Room type pricing saved successfully",
  "data": [
    {
      "id": "pricing_1",
      "library_id": "library_id",
      "room_type_id": "room_type_1",
      "full_day": {
        "monthly_fee_per_seat": 1500,
        "security_deposit": 3000,
        "deposit_type": "REFUNDABLE",
        "advance_amount": 500
      },
      "half_day": {
        "enabled": true,
        "monthly_fee_per_seat": 900,
        "security_deposit": 1500,
        "deposit_type": "NON_REFUNDABLE",
        "advance_amount": 300
      }
    }
  ]
}
```

---

## 8. Business Setup Review

### Proposed – Get Complete Setup Summary

**GET** `/api/v1/libraries/{libraryId}/setup`

Response:
```json
{
  "success": true,
  "data": {
    "basic_details": {
      "library_id": "library_id",
      "name": "Smart Library",
      "branch_name": "Main Branch",
      "owner_name": "Owner Name",
      "mobile": "9876543210",
      "email": "owner@example.com"
    },
    "location": {
      "address": "123 Main Road",
      "area": "Salt Lake",
      "unit": "Unit 2",
      "city": "Kolkata",
      "state": "West Bengal",
      "pin_code": "700001",
      "latitude": 22.5726,
      "longitude": 88.3639
    },
    "operation": {
      "opening_time": "08:00",
      "closing_time": "22:00",
      "working_days": [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY"
      ],
      "time_slots": [],
      "holidays": []
    },
    "floors": [
      {
        "id": "floor_1",
        "name": "Ground Floor",
        "rooms": [
          {
            "id": "room_1",
            "room_number": "101",
            "room_type_id": "room_type_1",
            "room_type_name": "AC",
            "total_seats": 50
          }
        ]
      }
    ],
    "room_type_pricing": []
  }
}
```

---

## 9. Complete Business Setup

### Proposed – Complete Setup

**POST** `/api/v1/libraries/{libraryId}/setup/complete`

Response:
```json
{
  "success": true,
  "message": "Library setup completed successfully",
  "data": {
    "library_id": "library_id",
    "setup_status": "COMPLETED",
    "completed_at": "2026-11-26T10:30:00Z"
  }
}
```

---

## 10. Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "room_number",
      "message": "Room number already exists on this floor"
    }
  ]
}
```

## 11. Existing API Reuse Summary

| API | Action |
|---|---|
| `/api/v1/libraries` | Reuse and extend |
| `/api/v1/floors` | Reuse and verify CRUD support |
| `/api/v1/reading-rooms` | Reuse and verify CRUD support |
| `/api/v1/room-types` | Reuse and verify custom type support |
| `/api/v1/libraries/{libraryId}/operation` | Proposed |
| `/api/v1/libraries/{libraryId}/room-type-pricing` | Proposed |
| `/api/v1/libraries/{libraryId}/setup` | Proposed |
| `/api/v1/libraries/{libraryId}/setup/complete` | Proposed |

**Note:** All example IDs, values, and timestamps are illustrative. Confirm existing endpoint methods, request/response schemas, authentication requirements, and library scoping against the current backend Swagger/OpenAPI document before implementation.