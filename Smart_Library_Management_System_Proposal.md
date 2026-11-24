## **1. Executive Summary** 

Digontom Pvt. Ltd. is pleased to present this proposal for the design, development, and deployment of the Smart Library Management System — a complete, AI-assisted SaaS platform built for library and reading-room owners who manage seats, students, fees, and staff across one or more locations. 

The platform brings together multi-library management, an interactive seat and reading-room engine, end-to-end student and fee lifecycle management, automated WhatsApp/SMS communication, and a built-in AI assistant (SmartBrain) that gives owners instant answers on revenue, occupancy, and growth. A dedicated, separately secured Super Admin Panel gives Digontom full visibility and control over subscriptions, billing, and platform health across every customer instance. 

This document outlines the complete feature specification, technical approach, project timeline, and commercial terms for the engagement. 

## **3. Project Overview & Objectives** 

The Smart Library Management System is designed to let a library owner run every part of the business — seat allocation, admissions, fee collection, coordinator staff, and reporting — from a single dashboard, with an AI layer that surfaces insights automatically. 

### **Core Objectives** 

- **Centralised Control:** Manage unlimited libraries, reading rooms, and seats from one owner dashboard. 

- **Automated Operations:** Reduce manual follow-up through WhatsApp/SMS automation for fees, admissions, and overdue reminders. 

- **Financial Clarity:** Real-time revenue, pending-fee, and deposit tracking with exportable reports. 

- **Role Safety:** Strict RBAC so coordinators only see and act within their assigned reading room. 

- **Intelligent Assistance:** SmartBrain AI answers natural-language questions on occupancy, revenue, and growth. 

- **Platform Governance:** A separate Super Admin Panel to manage subscriptions, plans, and platform health across all customers. 

## **4. System Architecture** 

The platform follows a layered, API-first architecture: mobile and web clients (Owner, Coordinator, Student, and the separate Super Admin Panel) talk to a secure API gateway that enforces authentication, RBAC, and 2FA. Core 



<!-- Start of picture text -->
Smart Library Management System — System Architecture<br>Owner / Student / Super Admin<br>Coordinator owner wep Parent App Panel<br>Mobile App (View & Alerts) (Separate, Secure)<br>Secure API Gateway (Auth, RBAC, Rate Limiting, 2FA)<br>Auth & Library / Student & Fee & Reports & SmartBrain<br>User Mgmt Seat Engine Admission Payments Analytics Al Engine<br>Notification Engine Payment Gateways Backup & Recovery<br>Push * WhatsApp * SMS « Email UPI « Cards * Bank * QR Auto Backup * WAL Log<br>Encrypted Data Store (AES-256) — Multi-Library / Multi-Tenant Isolation, Audit Trail, Soft Delete<br><!-- End of picture text -->

Smart Library Management System — Proposal 

## **5. User Roles** 

### **Super Admin (Developer)** 

Digontom's internal role, operating from a separate secure panel outside the customer-facing app — manages subscriptions, billing, platform analytics, and system health across every library instance. 

### **Owner** 

Full access to their own library ecosystem — libraries, reading rooms, seats, students, fees, coordinators, reports, and settings. 

### **Coordinator** 

Limited, permission-based access scoped to the reading room(s) the Owner assigns — day-to-day admissions, seat allocation, and fee collection, with every action visible to the Owner in real time. 

## **6. Complete Feature Specification** 

The table below summarises all functional modules covered in this engagement. 

|**Module**|**Key Capabilities**|
|---|---|
|1. Authentication & Login|Login; Signup; Forgot Password; Change Password; OTP Verification; Mobile<br>Number Verification; Email Verification (Optional); Secure Login; Auto<br>Login; Logout|
|2. User Roles|Super Admin (Developer); Owner; Coordinator|
|3. Dashboard|Business Overview; Active Students; Vacant / Occupied / Pending Seats; Total<br>Revenue & Pending Fees; Seat Overview; Quick Analytics; Smart Alerts; AI<br>Assistant|
|4. Multi Library Management|Unlimited Library Support; Add / Edit / Delete Library; Library Logo, Address<br>& Contact Details; Library Analytics|
|5. Reading Room Management|Add / Edit / Delete Reading Room; AC / Non-AC / VIP Room; Silent Zone;<br>LibraryFloor; Room Capacity|
|6. Seat Management|Interactive & Visual Seat Layout; Seat Number & Allocation; Seat Transfer &<br>Blocking; Maintenance Seat; Seat History & Status|
|7. Student Management|New Admission & Edit Student; Student Profile & Photo; Aadhaar, Mobile,<br>Parent Number, Address, College; Emergency Contact; Seat Allocation &<br>Transfer; Student Status & Cancellation; Admission History|
|8. Search Module|Search by Name, Mobile, Seat, Library, Status|
|9. Finance Management|Monthly / Daily / Yearly Revenue; Pending Amount & Deposit Management;<br>Revenue Analytics & Growth Reports; Revenue Graphs|
|10. Fee Management|Monthly / Daily / Weekly Fee; Security Deposit; Late Fee, Due Date, Grace<br>Period; Fee Snapshot & History|
|11. Payment Management|Cash, UPI, Bank Transfer, QR Payment; Payment Receipt & History; Refund<br>Management|
|12. Reports|Daily / Weekly / Monthly / Yearly Report; Revenue, Student, Fee &<br>Occupancy Report; Export to PDF & Excel|
|13. Overdue Fee Management|Pending Students & Amount; Due Date & Overdue Days; Recovery Tracking|




Smart Library Management System — Proposal 

|**Module**|**Key Capabilities**|
|---|---|
|14. Cancellation History|Student Name, Cancelled By, Date, Reason; Audit History|
|15. Coordinator Management|Add / Edit / Remove Coordinator; OTP Verification & Password Reset;<br>Permission Management; Active / Inactive Status|
|16. Role-Based Access<br>Control (RBAC)|Owner — Full Access; Coordinator — Limited Access, restricted to assigned<br>Reading Room; Feature access governed by Owner-defined permissions|
|17. Notifications|Push & In-App Notification; Fee Reminder, Admission Alert, Payment Alert,<br>Overdue Alert|
|18. WhatsApp Automation|Admission & Fee Payment Confirmation; Fee Due / Overdue Reminder; Seat<br>Transfer & Cancellation Message; PDF Receipt Sharing|
|19. SMS Automation|OTP, Admission SMS, Fee Payment SMS; Due Reminder & Overdue<br>Reminder|
|20. SmartBrain AI|AI Chat Assistant; Revenue Report & Seat Availability via Chat; Business<br>Insights & Monthly Growth; Overdue Analysis; Natural Language Queries|
|21. Data Safety|Backup, Restore & Auto Backup; Backup History & Recovery; System Status|
|22. Security|AES-256 Encryption; Soft Delete & WAL Log; Two-Factor Authentication<br>(2FA); Login History & Device Management; Session Management|
|23. Settings|Library, Reading Room, Seat, Fee, Student & Coordinator Settings; User<br>Permissions & Payment Settings; Reports, Notification & Language Settings;<br>AI, Backup & Security Settings; Appearance, Subscription & Billing; Help &<br>Support, About Application; Business Configuration|
|24. Multi-Language Support|English, Hindi, Marathi, Kannada, Telugu, Tamil, Gujarati, Bengali, Punjabi|
|25. Cross-Platform Support|Android, iOS, Tablet, Windows, macOS, Web Browser; Responsive UI &<br>Cloud Sync|
|26. Owner Activity<br>Monitoring|Real-time Owner notification for every Coordinator action: Student Added /<br>Updated / Deleted, Transfer, Fee & Deposit Collected, Seat Changed / Vacated,<br>Login / Logout|
|27. ActivityLogs|Date, Time, User, Role, Device, Action, ReadingRoom|
|28. Subscription System|Free Trial, Basic, Premium & Enterprise Plan; Plan Upgrade / Downgrade,<br>Renewal & Billing|
|29. Business Rules|No Deletion Policy & Fee Snapshot; Room Isolation & Permission-Based<br>Access; OTP Verification & Audit Trail|



### **Super Admin / Developer Panel (Separate, Secure Application)** 

This is a standalone panel outside the customer-facing app, used exclusively by Digontom to operate and monitor the platform: 

- Dashboard & Subscription Management 

- Revenue Analytics & Owner Management 

- Library Analytics & Customer Support 

- Payment Management & Trial Management 

- App Usage Analytics & City-wise Analytics 

- Notifications & App Version Control 


Smart Library Management System — Proposal 

- Maintenance Mode, Server Status & Database Health 

- API Monitoring, Audit Logs & Reports/Export 


Smart Library Management System — Proposal 

## **7. Technology Stack** 

|**Layer**|**Technology**|
|---|---|
|Mobile Apps (Owner,<br>Coordinator, Student)|Flutter (Android & iOS, single codebase)|
|Web Dashboard & Super<br>Admin Panel|React.js|
|Backend & APIs|Node.js(Express), REST APIs|
|Database|MySQL / PostgreSQL with encrypted storage|
|AI Layer (SmartBrain)|LLM-based natural-language query engine|
|Notifications|Firebase Push, WhatsApp Business API, SMS Gateway|
|Payments|Razorpay/ UPI / QR integration|
|Hosting & Storage|Cloud hosting (AWS/GCP) with auto-backup & CDN|



### **Multi-Language Support** 

English, Hindi, Marathi, Kannada, Telugu, Tamil, Gujarati, Bengali, and Punjabi. 

### **Cross-Platform Support** 

Android, iOS, Tablet, Windows, macOS, and Web Browser — all with a responsive UI and cloud sync, so an Owner's data stays consistent across every device. 

## **8. Security & Data Safety** 

- **Encryption:** AES-256 encryption for data at rest, with soft-delete and Write-Ahead-Log (WAL) protection against accidental loss. 

- **Access Control:** Two-Factor Authentication (2FA), OTP verification, login history, device and session management. 

- **Backup & Recovery:** Automated backups with full backup history and one-click restore. 

- **Governance:** Full audit trail, activity logs (date, time, user, role, device, action, reading room), and a strict nodeletion policy backed by fee snapshots for financial integrity. 