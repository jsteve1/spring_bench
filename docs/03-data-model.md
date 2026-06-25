# 03 — Data Model: Life Insurance Policy Manager

The microservice simulates a **Life Insurance Policy Manager**. The same schema is used by every
matrix runtime. Persistence is embedded SQLite (file-based WAL) — see `docs/04 §3`.

---

## 1. Entity Relationships

```
┌───────────────────────┐        ┌────────────────────────┐
│     Demographics      │        │ LifeInsuranceAgreement │
└───────────┬───────────┘        └───────────┬────────────┘
            │ 1                               │ 1
            │                                 │
            │ 1                               │ 0..1
┌───────────┴───────────┐                     │
│        Member         │◄────────────────────┘
└───────────┬───────────┘
            │ 1
            │
            │ 0..*
┌───────────┴───────────┐        ┌────────────────────────┐
│      Dependent        │        │         Audit          │
└───────────────────────┘        └────────────────────────┘
```

- A `Member` **must** have a `Demographics` profile (1—1) and **may** be tied to one
  `LifeInsuranceAgreement` (0..1).
- A `Member` can have multiple `Dependent` records (1—0..*).
- A `Dependent` has its own `Demographics` profile (1—1).
- **Every state mutation (create/update/delete/status change) writes one row into `Audit`.**

---

## 2. Conventions

- All `id` columns are **UUIDv4** stored as `TEXT`.
- All entities carry `created`, `updated` (timestamps, Not Null) and `updated_by` (String, Not Null).
- Timestamps stored as ISO-8601 `TEXT` or epoch-millis `INTEGER` (pick one, be consistent).
- Enums stored as `TEXT` with a `CHECK` constraint; foreign keys declared with
  `PRAGMA foreign_keys=ON`.

---

## 3. Tables

### 3.1 LifeInsuranceAgreement
| Field | Type | Constraints | Description |
| :-- | :-- | :-- | :-- |
| id | UUIDv4 | PK | Unique identifier |
| created | Timestamp | Not Null | Creation date |
| updated | Timestamp | Not Null | Last modification date |
| updated_by | String | Not Null | User identifier |
| expiry_date | Timestamp | Nullable | Expiration threshold |
| sent_date | Timestamp | Nullable | Document dispatch date |
| pdf_link | String | Nullable | Pointer to cloud storage |
| status | Enum | Not Null | `ACTIVE, INACTIVE, PENDING, EXPIRED, ARCHIVED` |

### 3.2 Member
| Field | Type | Constraints | Description |
| :-- | :-- | :-- | :-- |
| id | UUIDv4 | PK | Unique identifier |
| demographics_id | UUIDv4 | FK → Demographics, Not Null | Required profile |
| agreement_id | UUIDv4 | FK → LifeInsuranceAgreement, Nullable | Optional policy |
| created | Timestamp | Not Null | |
| updated | Timestamp | Not Null | |
| updated_by | String | Not Null | |
| status | Enum | Not Null | `ACTIVE, INACTIVE, ARCHIVED` |

### 3.3 Dependent
| Field | Type | Constraints | Description |
| :-- | :-- | :-- | :-- |
| id | UUIDv4 | PK | Unique identifier |
| demographics_id | UUIDv4 | FK → Demographics, Not Null | Required profile |
| member_id | UUIDv4 | FK → Member, Not Null | Owning member *(implied by 1—0..* relationship)* |
| created | Timestamp | Not Null | |
| updated | Timestamp | Not Null | |
| updated_by | String | Not Null | |
| status | Enum | Not Null | `ACTIVE, INACTIVE, ARCHIVED` |

> `member_id` is added to realize the Member 1—0..* Dependent relationship from the ERD; the
> original table list omitted it but the relationship requires it.

### 3.4 Demographics
| Field | Type | Constraints | Description |
| :-- | :-- | :-- | :-- |
| id | UUIDv4 | PK | Unique identifier |
| fname | String | Not Null | First name |
| lname | String | Not Null | Last name |
| email | String | Not Null | Contact email |
| phone_number | String | Not Null | Phone number |
| status | Enum | Not Null | `ALIVE, DECEASED` |
| created | Timestamp | Not Null | |
| updated | Timestamp | Not Null | |
| updated_by | String | Not Null | |

### 3.5 Audit
| Field | Type | Constraints | Description |
| :-- | :-- | :-- | :-- |
| id | UUIDv4 | PK | Unique identifier |
| change | String | Not Null | Human-readable description of the event |
| created | Timestamp | Not Null | |
| updated | Timestamp | Not Null | |
| updated_by | String | Not Null | |

> Recommended (optional) `Audit` additions for traceability: `entity_type`, `entity_id`, `action`
> (`CREATE/UPDATE/DELETE/STATUS_CHANGE`). Keep `change` as the required free-text field.

---

## 4. Enum Reference
| Entity | Enum values |
| :-- | :-- |
| LifeInsuranceAgreement.status | `ACTIVE, INACTIVE, PENDING, EXPIRED, ARCHIVED` |
| Member.status / Dependent.status | `ACTIVE, INACTIVE, ARCHIVED` |
| Demographics.status | `ALIVE, DECEASED` |
