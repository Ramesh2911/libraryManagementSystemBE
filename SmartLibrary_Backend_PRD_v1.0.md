# PRODUCT REQUIREMENTS DOCUMENT 

Smart Library Management System — Backend Server Development _Multi-Library SaaS Platform with AI Assistant (SmartBrain)_ 

|**Field**|**Detail**|
|---|---|
|Document Type|Backend Server PRD (Engineering — Backend Only)|
|Owner / Developer|Debasis — Solo Backend Developer|
|Audience|Backend engineering (single source of truth for API, data, and server-side logic)|
|Source Reference|Smart Library Management System Proposal (Digontom Pvt. Ltd., client-provided)|
|Explicit Exclusions|UI/UX design, Flutter mobile app client code, React web dashboard and Super<br>Admin panel front-end implementation, commercial/pricing terms, cross-platform<br>packaging|
|Backend Stack|Node.js (Express), PostgreSQL (Row-Level Security for tenant isolation), Redis,<br>Firebase Push, WhatsApp Business API, SMS Gateway, Razorpay/UPI, external<br>LLM API (SmartBrain)|
|Key Architecture<br>Decisions|PostgreSQL (confirmed); SmartBrain via external LLM API with structured data as<br>context; multi-tenancy via shared DB + tenant_id + PostgreSQL Row-Level<br>Security|
|Document Status|Draft for backend scoping and sprint planning|



## 1. Document Purpose & Scope 

### 1.1 Purpose 

This document re-scopes the client-provided Smart Library Management System proposal into a backend-only engineering specification. It is the authoritative reference for what the server must expose, store, validate, and enforce for four consumers: the Owner web/mobile app, the Coordinator mobile app, the Student/Parent view app, and the separate Super Admin Panel — independent of how each renders it. 

All 29 feature modules from the source proposal are retained here as backend contracts — data model, APIs, business rules, and integrations. UI layout, navigation, and visual design are intentionally excluded. 

### 1.2 In Scope for Backend Development 

- Multi-tenant REST API (Node.js/Express) serving Owner, Coordinator, Student/Parent, and Super Admin clients from one codebase 

- PostgreSQL schema with Row-Level Security enforcing tenant isolation by tenant_id (Owner-level) 

- Authentication, 2FA, session/device management, and RBAC (Super Admin / Owner / Coordinator) 

- Multi-library, reading-room, and interactive seat management engine 

- Student admission, profile, and lifecycle management 

- Fee, deposit, and overdue management with immutable fee snapshots 

- Payment processing (cash/UPI/bank/QR) and refund handling 

- Reports and analytics generation (PDF/Excel export) 

- Coordinator management and permission-based access control 

- Notification engine: Push, WhatsApp, SMS, Email — trigger logic and delivery tracking 

- SmartBrain AI query interface: structured-data context assembly + external LLM API integration 

- Data safety: automated backup/restore, soft-delete, WAL-based recovery, audit trail 

- Subscription/billing system: Free Trial, Basic, Premium, Enterprise plans 

- Super Admin Panel backend: platform-wide subscription, revenue, health, and audit visibility 

- Owner real-time activity monitoring of Coordinator actions 

- Multi-language response support (content/label localization at the API layer) 

### 1.3 Out of Scope for This Document 

- UI/UX design, wireframes, design system, and all screen layouts 

- Flutter mobile app client code (Owner, Coordinator, Student/Parent) and app store submission 

- React.js web dashboard and Super Admin Panel front-end implementation — this document defines the APIs they consume 

- Cross-platform packaging (Windows/macOS/Tablet builds) — a client concern 

- Pricing, invoicing to the client, contractual/legal terms, go-to-market planning 

## 2. Backend System Summary 

The backend is a single multi-tenant Node.js/Express API service backed by PostgreSQL, serving as the sole source of truth for the Owner app, Coordinator app, Student/Parent view app, and a separately authenticated Super Admin Panel. Every tenant-scoped table carries a tenant_id (Owner) and is protected by PostgreSQL Row-Level Security, so a bug in one endpoint's business logic cannot leak cross-tenant data — isolation is enforced at the database layer, not only in application code. 

### 2.1 Actors Modeled at the Backend 

|**Role**|**Backend Responsibility**|
|---|---|
|Super Admin (Developer)|Platform-wide, cross-tenant access via a separate auth realm; subscription/billing<br>oversight, platform health, audit|
|Owner|Full CRUD within own tenant: libraries, reading rooms, seats, students, fees,<br>coordinators, reports, settings|
|Coordinator|Scoped to reading room(s) assigned by Owner; permission-gated actions; every<br>write visible to Owner in real time|
|Student / Parent (view app)|Read-only scoped access to own profile, fee status, and alerts — no write access<br>to core records|



## 3. Backend Architecture & Tech Stack 

### 3.1 Technology Stack (Backend-Relevant) 

|**Layer**|**Technology**|**Backend Notes**|
|---|---|---|
|API Server|Node.js + Express.js|Modular domain routing (auth, library, seat, student, fee,<br>payment, reports, AI, admin)|
|Database|PostgreSQL|Row-Level Security policies per tenant_id; encrypted at<br>rest (AES-256 at the storage layer)|
|Cache / Session|Redis|Session store, OTP/2FA short-TTL codes, rate-limit<br>counters, seat-map cache for high-read dashboards|
|Auth|Custom JWT + 2FA (TOTP or<br>OTP)|Separate auth realm for Super Admin vs. tenant users<br>(Owner/Coordinator/Student)|
|AI Layer<br>(SmartBrain)|External LLM API<br>(OpenAI/Anthropic-class)|Backend assembles tenant-scoped structured context<br>(revenue, occupancy, overdue data) and sends it with the<br>query — never gives the LLM direct DB access|
|Notifications|Firebase Push, WhatsApp<br>Business API, SMS Gateway,<br>Email (SMTP/provider)|Backend owns trigger logic, templates, and delivery-<br>status tracking|
|Payments|Razorpay / UPI / QR|Server-side order creation, webhook verification, receipt<br>generation, refunds|
|Storage|AWS S3 / GCP Cloud Storage|Student photos, Aadhaar documents, PDF<br>receipts/reports, backup archives|
|Hosting|AWS / GCP|Backend deployment target; CDN for static/media assets|
|Backup &<br>Recovery|Automated DB snapshot +<br>WAL archiving|Point-in-time recovery; backup history tracked as its own<br>auditable record|



### 3.2 Service Boundaries 

Modular monolith at MVP scale — one deployable, domain-organized internally, structured so any module (e.g. Notification Engine or SmartBrain) can be extracted into an independent service later without a data-model rewrite: 

- Auth & User Management (incl. Super Admin realm) 

- Library / Reading Room / Seat Engine 

- Student & Admission Management 

- Fee & Payment Management 

- Reports & Analytics 

- SmartBrain AI Query Engine 

- Notification Engine 

- Coordinator & RBAC Management 

- Data Safety (Backup/Restore/Audit) 

- Subscription & Billing 

- Super Admin Platform Governance 

## 4. Multi-Tenancy & Data Isolation 

Confirmed model: a single shared PostgreSQL database with a tenant_id column (the Owner's account ID) on every tenantscoped table, enforced via PostgreSQL Row-Level Security (RLS) policies — not just an application-layer WHERE clause. 

- Every tenant-scoped table has RLS enabled with a policy restricting rows to current_setting('app.tenant_id') 

- The API layer sets app.tenant_id at the start of each authenticated request (from the verified JWT), inside the same transaction that runs the query — a request can never accidentally omit the filter 

- Super Admin queries run under a separate role/policy that bypasses tenant RLS for legitimate cross-tenant platform administration, with every such bypass access logged to the audit trail 

- Coordinator access is a second, narrower filter within the same tenant: reading_room_id membership, evaluated in addition to (not instead of) tenant_id RLS 

- New libraries/reading rooms for an existing Owner require zero schema change — purely new rows under the existing tenant_id 

## 5. Authentication, Authorization & RBAC 

### 5.1 Authentication 

- Signup/Login via mobile number + OTP (primary), with email verification optional 

- Two-Factor Authentication (2FA) required for Owner and Super Admin roles at minimum; TOTP or OTP-based 

- Password reset via OTP verification; Coordinator password resets are Owner-initiated or self-service with OTP 

- Access token (JWT, short TTL) + refresh token (rotated on use, stored hashed) for all tenant-side roles 

- Super Admin authenticates through a fully separate auth realm/endpoint set — never shares a login surface or token namespace with tenant users 

- Login history and device/session management: every login records device fingerprint, IP, and timestamp; Owner/Super Admin can view and revoke active sessions 

### 5.2 RBAC Enforcement Model 

|**Role**|**Scope Dimension**|**Example Enforcement**|
|---|---|---|
|Super Admin|Cross-tenant (global)|Subscription/billing/platform-health endpoints only;<br>no direct student/fee data editing|
|Owner|tenant_id (own account)|Full CRUD on own libraries, reading rooms, seats,<br>students, fees, coordinators, settings|
|Coordinator|tenant_id + assigned<br>reading_room_id(s)|Admissions, seat allocation, and fee collection limited<br>to assigned reading room(s); permission flags<br>(view/edit) set by Owner per feature area|
|Student / Parent|own student_id record only|Read-only: own profile, fee status/history, alerts|



### 5.3 Owner-Defined Coordinator Permissions 

Coordinator permissions are not a fixed role but a per-feature permission set an Owner configures (e.g. can-collect-fee, canallocate-seat, can-cancel-admission). The backend must store and enforce this as a structured permissions object per Coordinator, checked on every relevant write endpoint — not hardcoded per role. 

## 6. Data Model & Core Tables 

PostgreSQL tables anchoring schema design. All tables marked "tenant-scoped" carry tenant_id and are RLS-protected; Super Admin tables are global. 

### 6.1 Core Tables 

|**Table**|**Key Fields**|**Notes**|
|---|---|---|
|owners|tenant_id (PK), name, contact,<br>subscription_plan_id, 2fa_enabled|Root tenant record|
|libraries|tenant_id, library_id, name, address, logo_url,<br>contact|Unlimited libraries per Owner|
|reading_rooms|tenant_id, room_id, library_id, type (AC/Non-<br>AC/VIP), is_silent_zone, floor, capacity|Coordinator scoping unit|
|seats|tenant_id, seat_id, room_id, seat_number, status<br>(vacant/occupied/pending/maintenance),<br>current_student_id|Interactive seat-map source of truth|
|seat_history|tenant_id, seat_id, student_id, action<br>(allocate/transfer/block/vacate), actor_id,<br>timestamp|Append-only, feeds seat history<br>view|
|students|tenant_id, student_id, name, photo_url,<br>aadhaar_ref, mobile, parent_mobile, address,<br>college, emergency_contact, status|aadhaar_ref stored as encrypted<br>reference, not raw|
|admissions|tenant_id, student_id, admission_date, seat_id,<br>plan, status, cancellation_reason|Admission history + cancellation<br>audit|
|fees|tenant_id, student_id, fee_type<br>(monthly/daily/weekly), amount, due_date,<br>grace_period, late_fee_rule|Defines the fee schedule per student|
|fee_snapshots|tenant_id, fee_id, student_id, amount_due,<br>amount_paid, period, generated_at|Immutable — one snapshot per<br>billing period, never edited after<br>creation (No-Deletion Policy)|
|payments|tenant_id, student_id, amount, method<br>(cash/upi/bank/qr), status, receipt_url, refund_ref|Refunds are compensating records,<br>not edits|
|overdue_tracking|tenant_id, student_id, fee_snapshot_id,<br>overdue_days, recovery_status|Derived/maintained by scheduled<br>job|
|coordinators|tenant_id, coordinator_id, name, mobile,<br>assigned_room_ids[], permissions (jsonb), status|permissions is a structured, Owner-<br>editable object|
|activity_logs|tenant_id, actor_id, role, device, action,<br>reading_room_id, timestamp|Append-only; powers both Owner<br>Activity Monitoring and Activity<br>Logs module|
|notifications_log|tenant_id, channel, template_id, trigger_event,|Append-only, per Notification|



|**Table**|**Key Fields**|**Notes**|
|---|---|---|
||recipient_ref, delivery_status|Engine|
|subscriptions|tenant_id, plan (trial/basic/premium/enterprise),<br>status, renewal_date, billing_ref|Drives Owner-side feature gating|
|ai_query_logs|tenant_id, actor_id, query_text,<br>context_summary, response_summary,<br>timestamp|Audit trail for every SmartBrain<br>query|
|backup_history|backup_id, tenant_id (nullable = platform-wide),<br>status, initiated_by, restored_at|Supports Data Safety module's<br>backup/restore history|
|super_admin_users|admin_id, name, role, 2fa_enabled|Separate table, separate auth realm<br>— never joined against tenant RLS|



### 6.2 Relationships & Constraints to Enforce 

- students.seat_id references seats; a seat can hold at most one active student at a time (enforced via unique partial index on seats where status = 'occupied') 

- fee_snapshots are insert-only from the application's perspective — no UPDATE/DELETE grant on that table for the API role, only INSERT and SELECT 

- payments.student_id and fees.student_id both require tenant_id to match the referencing student's tenant_id (composite FK or trigger-enforced) 

- coordinators.assigned_room_ids must all belong to the same tenant_id as the coordinator record 

## 7. API Modules 

Grouped by domain, mapped from the 29 feature modules in the source proposal. Each is the backend contract regardless of which client (Owner app, Coordinator app, Student app, Super Admin panel) consumes it. 

### 7.1 Auth & User Management 

- POST /auth/signup, POST /auth/login, POST /auth/otp/request, POST /auth/otp/verify 

- POST /auth/forgot-password, POST /auth/change-password, POST /auth/2fa/setup, POST /auth/2fa/verify 

- POST /auth/refresh, POST /auth/logout, GET /auth/sessions, DELETE /auth/sessions/:id (device/session management) 

### 7.2 Library, Reading Room & Seat Engine 

- Library CRUD: POST/GET/PATCH/DELETE /libraries (soft-delete only — see Section 9) 

- Reading Room CRUD scoped to library, with type/silent-zone/floor/capacity fields 

- Seat CRUD, GET /seats/map (interactive layout data), POST /seats/:id/allocate, /transfer, /block, /maintenance 

- GET /seats/:id/history 

### 7.3 Student & Admission Management 

- POST /students (new admission), PATCH /students/:id, GET /students/:id, POST /students/:id/photo 

- POST /students/:id/cancel (status change + reason, never a hard delete) 

- GET /students/:id/admission-history 

- GET /search/students — by name, mobile, seat, library, status 

### 7.4 Fee, Payment & Overdue Management 

- POST /fees (define schedule), GET /students/:id/fees, POST /fees/:id/generate-snapshot (scheduled + on-demand) 

- POST /payments (cash/UPI/bank/QR), GET /payments/:id/receipt (PDF), POST /payments/:id/refund 

- GET /overdue — pending students/amount, due dates, overdue-days, recovery status 

### 7.5 Reports & Analytics 

- GET /reports/{revenue|student|fee|occupancy}?period=daily|weekly|monthly|yearly 

- GET /reports/export?format=pdf|excel 

- GET /dashboard/overview (active students, seat status breakdown, revenue & pending fees, quick analytics, smart alerts) 

### 7.6 Coordinator Management & RBAC 

- POST /coordinators, PATCH /coordinators/:id/permissions, PATCH /coordinators/:id/status 

- POST /coordinators/:id/reset-password (OTP-verified) 

### 7.7 Notifications (Push, WhatsApp, SMS, Email) 

- Internal trigger service consuming domain events: admission, fee-payment-confirmation, fee-due, fee-overdue, seattransfer, cancellation 

- Admin-configurable templates: GET/POST/PATCH /admin/notification-templates 

- GET /notifications (in-app), PATCH /notifications/:id/read 

- GET /admin/notifications-log (delivery status per channel) 

### 7.8 SmartBrain AI Query Engine 

- POST /ai/query — accepts natural-language question, backend assembles tenant-scoped structured context (revenue, occupancy, overdue), sends to external LLM API, returns grounded answer 

- GET /ai/query-history (per Owner) 

- Context assembly is server-side only — the LLM never receives direct DB credentials or unscoped data 

### 7.9 Data Safety (Backup/Restore/Audit) 

- POST /admin/backup/trigger, GET /admin/backup/history, POST /admin/backup/:id/restore 

- GET /admin/audit-logs, GET /activity-logs (Owner-facing, tenant-scoped) 

### 7.10 Owner Activity Monitoring 

- Real-time event stream/webhook (WebSocket or push) to Owner on every Coordinator action: student added/updated/deleted, transfer, fee/deposit collected, seat changed/vacated, login/logout 

### 7.11 Subscription & Billing 

- GET /subscription, POST /subscription/upgrade, /downgrade, /renew 

- Webhook: /webhooks/payment-gateway for subscription billing events 

- Feature-gating middleware reads subscription.plan to enable/disable endpoints (e.g. library-count limits per plan) 

### 7.12 Settings 

- GET/PATCH /settings/{library|reading-room|seat|fee|student|coordinator|permissions|payment|reports|notification| language|ai|backup|security|appearance|subscription|business-config} 

- Each settings namespace is a scoped, versioned config object per tenant 

### 7.13 Super Admin Panel APIs (Separate Auth Realm) 

- GET /admin/dashboard, /admin/subscriptions, /admin/revenue-analytics, /admin/owners 

- GET /admin/library-analytics, /admin/support-tickets, /admin/payments, /admin/trials 

- GET /admin/app-usage, /admin/city-analytics, /admin/app-version, POST /admin/notifications/broadcast 

- GET /admin/server-status, /admin/db-health, /admin/maintenance-mode (toggle), /admin/api-monitoring, /admin/audit-logs, /admin/reports/export 

## 8. Key Business Logic & Rule Enforcement 

### 8.1 No-Deletion Policy & Fee Snapshots 

- Hard DELETE is disabled at the application layer for students, fees, payments, and admissions — all removals are status changes (soft delete) with a reason and actor recorded 

- A fee_snapshot, once generated for a billing period, is immutable; corrections are new compensating entries (e.g. an adjustment record), never an UPDATE — this is what makes the financial history trustworthy for reports and disputes 

### 8.2 Room Isolation & Permission-Based Access 

- A Coordinator's queries are always filtered by their assigned_room_ids in addition to tenant_id — enforced at the query layer, so a missed check on one endpoint cannot expose another reading room's students 

- Feature-level permissions (can-collect-fee, can-allocate-seat, etc.) are checked per endpoint against the Coordinator's permissions object, not inferred from role alone 

### 8.3 Seat Allocation Integrity 

- Seat allocation is a transactional operation: check seat.status = 'vacant' and set to 'occupied' with the student reference atomically, preventing two coordinators from double-booking the same seat under concurrent requests 

- Seat transfer writes a seat_history record and updates both the vacated and newly-occupied seat status in the same transaction 

### 8.4 Overdue Fee Lifecycle 

- A scheduled job evaluates fee_snapshots past due_date + grace_period and writes/updates overdue_tracking records 

- Overdue status changes trigger the Notification Engine (WhatsApp/SMS/push overdue reminder) automatically — not manually initiated per case 

### 8.5 Subscription Plan Enforcement 

- Plan limits (e.g. number of libraries, reading rooms, or Coordinators allowed under Free Trial/Basic/Premium) are enforced at the write endpoint — creating a library beyond the plan's limit is rejected server-side with a clear upgrade-required error, not just hidden in the UI 

- Trial expiry and plan-renewal reminders are scheduled-job driven, feeding the Notification Engine 

### 8.6 Owner Real-Time Activity Monitoring 

Every Coordinator write (student CRUD, seat change, fee/deposit collection, login/logout) is both persisted to activity_logs and pushed to the Owner in real time (WebSocket channel or push notification) — this is a backend delivery guarantee, not a client polling convenience. 

## 9. SmartBrain AI — Backend Integration Design 

Confirmed approach: SmartBrain calls an external LLM API (OpenAI/Anthropic-class), with the backend responsible for assembling a tenant-scoped, structured data context and sending it alongside the natural-language query. The backend never grants the LLM provider direct database access. 

- Request flow: POST /ai/query → backend authenticates + resolves tenant_id → backend runs a small set of predefined aggregation queries relevant to the question's detected intent (revenue, occupancy, overdue, growth) → structured context (JSON) is sent to the LLM API with the user's question → response is returned to the client and logged to ai_query_logs 

- Intent detection can start rule-based/keyword-matched (revenue, seat availability, overdue, growth categories from the proposal) before investing in a more general query planner — keeps the LLM's role bounded to natural-language synthesis over data the backend already trusts 

- Every query and the context sent is logged (ai_query_logs) for audit and cost tracking, since LLM API calls are billed per request 

- Rate limiting on /ai/query per tenant to control LLM API cost exposure 

- No student PII (Aadhaar, exact address, mobile) is included in the LLM context unless the question explicitly requires a specific, permission-checked record lookup — aggregate/business metrics are the default context payload 

## 10. Third-Party Integrations (Backend Responsibilities) 

|**Integration**|**Backend Responsibility**|
|---|---|
|Razorpay / UPI / QR|Order creation, webhook signature verification, payment status reconciliation,<br>refund processing|
|WhatsApp Business API|Template registration, trigger-based sends (admission, fee, overdue, seat transfer,<br>cancellation, receipt sharing), delivery-status webhook ingestion|
|SMS Gateway|OTP delivery, admission/fee/due/overdue SMS, delivery-status tracking|
|Firebase Push|Push + in-app notification dispatch, device token management|
|External LLM API|SmartBrain query context assembly and response relay (Section 9)|
|Cloud Storage (S3/GCS)|Student photos, Aadhaar document references (encrypted), PDF receipts/reports,<br>backup archives|
|Email Provider|Optional email verification, report delivery, transactional email|



## 11. Security & Compliance Requirements 

- Every protected route requires a valid access token + role + tenant/room-scope check; no endpoint trusts a clientdeclared role or tenant_id 

- PostgreSQL Row-Level Security as the enforced tenant boundary (Section 4) — not merely an application-level convention 

- AES-256 encryption at rest for the database; sensitive fields (Aadhaar reference, payment details) encrypted at the column level, not just disk-level 

- Two-Factor Authentication (2FA) for Owner and Super Admin; OTP verification for Coordinator password resets 

- Soft-delete + Write-Ahead-Log-based recovery — no endpoint issues a hard DELETE on financial or student records 

- Full audit trail: activity_logs and ai_query_logs are append-only with no application-level UPDATE/DELETE grants 

- Rate limiting on OTP, login, and /ai/query endpoints (Redis-backed) 

- Super Admin auth realm fully separate from tenant auth — no shared session/token namespace, minimizing blast radius of a tenant-side credential compromise 

- Input validation on every write endpoint — schema-validated request bodies 

## 12. Non-Functional Requirements (Backend Scope) 

|**Category**|**Backend Requirement**|
|---|---|
|Multi-Tenancy Scale|Shared DB + RLS designed to support many Owners/libraries without per-tenant<br>infrastructure; seat/room counts unbounded per Owner|



|**Category**|**Backend Requirement**|
|---|---|
|Performance|Dashboard and seat-map endpoints are high-read — cache via Redis; seat allocation must<br>be transactionally safe under concurrent Coordinator writes|
|Availability|Separate staging/production environments; automated backups with periodic restore<br>verification (not just backup-taken confirmation)|
|Auditability|Append-only activity and AI query logs sufficient for dispute resolution and Super<br>Admin oversight|
|Data Safety|WAL-based point-in-time recovery; backup history itself is an auditable record, not just a<br>cron log|
|Localization|Response payloads for label/content strings structured to support English, Hindi, Marathi,<br>Kannada, Telugu, Tamil, Gujarati, Bengali, Punjabi from the API layer — actual<br>translation content management is a client/content concern|
|Cross-Platform<br>Access|Single REST API contract consumable identically by Android, iOS, tablet, and web<br>clients — no platform-specific backend branching|



## 13. Suggested Backend Build Sequence 

The source proposal does not specify a phased timeline, so this sequencing is a recommendation based on dependency order — earlier modules unblock later ones. Confirm/adjust before sprint planning. 

|**Stage**|**Modules**|**Rationale**|
|---|---|---|
|1. Foundation|Auth & 2FA, multi-tenant schema + RLS,<br>Owner/Coordinator/Student roles, Super<br>Admin auth realm|Nothing else can be built or tested safely without<br>tenant isolation and auth in place|
|2. Core Domain|Library, Reading Room, Seat Engine,<br>Student & Admission Management|The operational core every other module reads<br>from or writes to|
|3. Financial Core|Fee Management, Payment Management,<br>Fee Snapshots, Overdue Tracking|Depends on Student/Seat being stable; introduces<br>the immutability rules|
|4. Operations<br>Layer|Coordinator Management & RBAC<br>permissions, Owner Activity Monitoring,<br>Activity Logs|Depends on core domain + financial writes<br>existing to monitor|
|5. Engagement<br>Layer|Notification Engine<br>(Push/WhatsApp/SMS/Email), Reports &<br>Analytics, Search|Consumes events from Stages 2–4|
|6. Platform<br>Layer|Subscription & Billing, Settings, Data<br>Safety (Backup/Restore)|Cross-cutting; billing enforcement needs core<br>domain limits to gate against|
|7. Intelligence<br>Layer|SmartBrain AI Query Engine|Depends on Reports/Analytics aggregations<br>existing as its context source|
|8. Governance<br>Layer|Super Admin Panel APIs (subscriptions,<br>platform health, audit, city-wise analytics)|Depends on Subscription/Billing and Activity<br>Logs existing platform-wide|



## 14. Assumptions, Constraints & Dependencies (Backend-Relevant) 

- Backend is the single source of truth for Owner, Coordinator, Student/Parent, and Super Admin clients — no client implements business logic independently 

- PostgreSQL is the committed database choice (per clarification); MySQL is not designed for in this document 

- SmartBrain integrates via an external LLM API; no self-hosted model infrastructure is scoped here 

- Multi-tenancy is shared-database with tenant_id + Row-Level Security; per-tenant database/schema provisioning is out of scope 

- Cloud infrastructure procurement and third-party account provisioning (payment gateway, WhatsApp Business API, SMS gateway, LLM API keys) are client/ops dependencies that block the corresponding integration work 

- Translation content for the 9 supported languages is a content/client responsibility — the backend's obligation is a localization-ready response structure 

- Any backend capability not explicitly defined in this document is a Change Request requiring its own effort/impact estimate before development begins 

## 15. References 

Source: Smart Library Management System Proposal (Digontom Pvt. Ltd., client-provided). This document is a backendonly derivative scoped for engineering use by the backend developer; UI/UX, mobile client, and commercial sections of the source proposal remain governed by the original document for the frontend teams. 

