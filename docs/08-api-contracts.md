# 08 — API Contracts (JSON DTOs, Errors, Pagination, Validation)

The wire contract for the microservice. It **must be byte-identical across the legacy and modern
shells** (`docs/02`, `docs/04`). Endpoints are listed in `docs/04 §2`; this doc defines the
payloads, status codes, validation, and error shape so any agent builds the same thing on both
shells without guessing.

Conventions: JSON over HTTP; `Content-Type: application/json`; UTF-8; timestamps are ISO-8601 UTC
strings (e.g. `2026-06-25T20:14:00Z`); IDs are UUIDv4 strings. All responses include an
`X-Request-Id` header for traceability.

---

## 1. Resource Representations (response DTOs)

### 1.1 Demographics
```json
{
  "id": "f1c2...uuid",
  "fname": "Jane",
  "lname": "Doe",
  "email": "jane.doe@example.com",
  "phoneNumber": "+1-555-0100",
  "status": "ALIVE",
  "created": "2026-06-25T20:14:00Z",
  "updated": "2026-06-25T20:14:00Z",
  "updatedBy": "system"
}
```

### 1.2 LifeInsuranceAgreement
```json
{
  "id": "a9b8...uuid",
  "status": "PENDING",
  "expiryDate": "2030-01-01T00:00:00Z",
  "sentDate": null,
  "pdfLink": null,
  "created": "2026-06-25T20:14:00Z",
  "updated": "2026-06-25T20:14:00Z",
  "updatedBy": "system"
}
```

### 1.3 Dependent
```json
{
  "id": "d3e4...uuid",
  "memberId": "m5f6...uuid",
  "demographics": { "...": "Demographics object" },
  "status": "ACTIVE",
  "created": "2026-06-25T20:14:00Z",
  "updated": "2026-06-25T20:14:00Z",
  "updatedBy": "system"
}
```

### 1.4 Member (aggregate response)
```json
{
  "id": "m5f6...uuid",
  "demographics": { "...": "Demographics object" },
  "agreement": { "...": "LifeInsuranceAgreement object or null" },
  "dependents": [ { "...": "Dependent object" } ],
  "status": "ACTIVE",
  "created": "2026-06-25T20:14:00Z",
  "updated": "2026-06-25T20:14:00Z",
  "updatedBy": "system"
}
```

### 1.5 AuditEntry
```json
{
  "id": "u7a8...uuid",
  "change": "Member m5f6 status ACTIVE -> ARCHIVED",
  "entityType": "MEMBER",
  "entityId": "m5f6...uuid",
  "action": "STATUS_CHANGE",
  "created": "2026-06-25T20:14:00Z",
  "updated": "2026-06-25T20:14:00Z",
  "updatedBy": "system"
}
```
`entityType`, `entityId`, `action` are recommended extensions (`docs/03 §3.5`); `change` is the
required free-text field.

---

## 2. Request DTOs

`updatedBy` is taken from the authenticated principal when security is enabled (`docs/10`); in
open benchmark mode it defaults to `"system"` or may be supplied via the `X-User` header. Clients
never send `id`, `created`, or `updated` — the server owns them.

### 2.1 Create Member — `POST /members`
```json
{
  "demographics": {
    "fname": "Jane",
    "lname": "Doe",
    "email": "jane.doe@example.com",
    "phoneNumber": "+1-555-0100",
    "status": "ALIVE"
  },
  "agreementId": null
}
```

### 2.2 Update Member — `PUT /members/{id}`
```json
{ "status": "INACTIVE", "agreementId": "a9b8...uuid" }
```
Partial update: only present fields change. `status` must be a valid `Member` enum value.

### 2.3 Add Dependent — `POST /members/{id}/dependents`
```json
{ "demographics": { "fname": "Tim", "lname": "Doe", "email": "tim@example.com", "phoneNumber": "+1-555-0101", "status": "ALIVE" } }
```

### 2.4 Create / Update Agreement — `POST /agreements`, `PUT /agreements/{id}`
```json
{ "status": "ACTIVE", "expiryDate": "2030-01-01T00:00:00Z", "sentDate": null, "pdfLink": "https://..." }
```

### 2.5 Attach / detach Agreement — `POST /members/{id}/agreement`
```json
{ "agreementId": "a9b8...uuid" }   // null detaches
```

---

## 3. Pagination Envelope

List endpoints (`/members`, `/audit`) accept `?page=<0-based>&size=<1..200>&sort=<field>,<asc|desc>`
and return:
```json
{
  "content": [ { "...": "items" } ],
  "page": 0,
  "size": 20,
  "totalElements": 137,
  "totalPages": 7,
  "sort": "created,desc"
}
```
Defaults: `page=0`, `size=20`, `sort=created,desc`. `size` is capped at 200.

---

## 4. Error Envelope (RFC 7807 Problem Details)

All non-2xx responses use `application/problem+json`:
```json
{
  "type": "https://bench.local/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "detail": "email must be a valid address",
  "instance": "/members",
  "requestId": "0f9a...",
  "errors": [
    { "field": "demographics.email", "message": "must be a valid email" }
  ]
}
```
`errors[]` is present only for validation failures. Never leak stack traces or SQL.

---

## 5. Status Codes & Validation

| Scenario | Code |
| :-- | :-- |
| Resource created | 201 + `Location` header |
| Read / update / list success | 200 |
| Soft delete success | 200 (returns the archived resource) |
| Malformed body / failed validation | 400 |
| Auth required / failed (secured mode) | 401 / 403 |
| Unknown id | 404 |
| Enum/state transition not allowed | 409 |
| Unhandled server error | 500 (generic Problem Details, details logged not returned) |

Validation rules (enforced identically on both shells):
- `fname`, `lname`: non-blank, ≤ 100 chars.
- `email`: non-blank, valid email, ≤ 254 chars.
- `phoneNumber`: non-blank, ≤ 32 chars.
- All `status` fields: must match the entity's enum (`docs/03 §4`).
- `demographics` required on member/dependent creation.
- `agreementId`, `expiryDate`, `sentDate`, `pdfLink`: nullable.

Validation approach: Jakarta Bean Validation on the modern shell, `javax.validation` on the legacy
shell — annotations live on the **shell DTOs**, not in the shared core (keeps the core namespace-free,
`docs/02`). The validation *rules* above are the contract both shells must satisfy.

---

## 6. Special Endpoints

- `GET /health` — body defined in `docs/04 §2.1`. Returns 200 when UP.
- `POST /seed?count=N` — creates N members (+ demographics; a fraction with agreements/dependents).
  Returns `{ "created": N, "elapsedMs": 1234 }`. Disabled in standalone/secured mode unless
  explicitly enabled.
- `GET /events` — SSE; `Content-Type: text/event-stream`. Event payload:
  ```
  event: heartbeat
  data: {"ts":"2026-06-25T20:14:00Z","activeThreads":42,"virtual":true}

  event: audit
  data: { "...": "AuditEntry object" }
  ```

---

## 7. API Documentation
Expose **OpenAPI 3** + Swagger UI on both shells (springdoc-openapi). The generated spec is the
machine-checkable proof that the two shells are contract-identical — diff the two `/v3/api-docs`
outputs in CI.
