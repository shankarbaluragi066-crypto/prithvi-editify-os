# Security Specification — Prithvi Editify Freelance CRM

## 1. Data Invariants

1. **Default-Deny Architecture**: All paths not explicitly matched are denied for both read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Role & Privilege Isolation**:
   - No client can self-assign `role: "admin"` in `/users/{userId}` on creation or update.
   - Admin access requires a verified email token matching the studio owner (`shankarbaluragi066@gmail.com` with `email_verified == true`) or a document in `/admins/{uid}` created by an existing admin.
3. **PII & Internal Notes Isolation**:
   - `/users/{userId}` can only be read by `request.auth.uid == userId` or Admin.
   - `/projectInternalNotes/{projectId}` and `/settings/private` are strictly restricted to Admin only.
   - `/inquiries/{inquiryId}` can be created by visitors (validated schema, forced `status == 'New'`), but can NEVER be read, listed, or modified by non-admins.
4. **Relational Ownership & Query Enforcement**:
   - Clients can only read `/projects`, `/invoices`, `/payments` where `resource.data.clientUserId == request.auth.uid`.
   - Clients can only read `/tasks`, `/files`, `/projectMessages` where `resource.data.clientUserId == request.auth.uid && resource.data.visibility == 'client'`.
   - Public visitors can only read `/services` and `/portfolio` where `resource.data.published == true`.
5. **Financial & Terminal State Integrity**:
   - Clients can NEVER create, update, or delete `/invoices` or `/payments`, nor modify invoice totals or payment statuses.
   - Projects in terminal status (`Completed` or `Cancelled`) cannot be modified by clients.

## 2. The "Dirty Dozen" Payloads

1. **Privilege Escalation (Role Spoofing on Create)**: Authenticated client attempts to create `/users/{uid}` with `{"role": "admin"}`.
2. **Privilege Escalation (Role Mutation on Update)**: Authenticated client attempts to update `/users/{uid}` changing `role` from `"client"` to `"admin"`.
3. **Email Spoofing Attack**: Unverified user (`email_verified: false`) with email `shankarbaluragi066@gmail.com` attempts to read `/inquiries` or `/settings/private`.
4. **Shadow Field Injection**: Authenticated user sends extra field `{"isVerifiedAdmin": true}` when updating `/users/{uid}`.
5. **Cross-Tenant Project Read/List**: Client A (`uid: "client_a"`) attempts to read or list `/projects` belonging to Client B (`clientUserId: "client_b"`).
6. **Internal Note Leakage**: Authenticated client attempts to `get` `/projectInternalNotes/{projectId}` for their own project.
7. **Internal Task / Deliverable Leakage**: Authenticated client attempts to read a `/tasks/{taskId}` document where `visibility == "internal"`.
8. **Invoice Total Tampering**: Authenticated client attempts to update `/invoices/{invoiceId}` to set `status: "Paid"` or `balanceDue: 0`.
9. **Inquiry Status Poisoning**: Unauthenticated visitor submits `/inquiries/{id}` with `status: "Converted"` or oversized 10,000-character description.
10. **Terminal State Bypass**: Authenticated client attempts to request revisions on a `/projects/{projectId}` document whose `status` is already `"Completed"`.
11. **ID Poisoning Attack**: Attacker attempts to create a document with a 500-character ID or special path characters.
12. **Timestamp Forgery**: Client attempts to create a `/projectMessages/{id}` record with a backdated `createdAt` timestamp not equal to `request.time`.
