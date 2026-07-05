PRAGMA foreign_keys=ON;

CREATE TABLE demographics (
    id TEXT PRIMARY KEY,
    fname TEXT NOT NULL,
    lname TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ALIVE', 'DECEASED')),
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE TABLE life_insurance_agreement (
    id TEXT PRIMARY KEY,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    expiry_date TEXT,
    sent_date TEXT,
    pdf_link TEXT,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING', 'EXPIRED', 'ARCHIVED'))
);

CREATE TABLE member (
    id TEXT PRIMARY KEY,
    demographics_id TEXT NOT NULL REFERENCES demographics(id),
    agreement_id TEXT REFERENCES life_insurance_agreement(id),
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
);

CREATE TABLE dependent (
    id TEXT PRIMARY KEY,
    demographics_id TEXT NOT NULL REFERENCES demographics(id),
    member_id TEXT NOT NULL REFERENCES member(id),
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED'))
);

CREATE TABLE audit (
    id TEXT PRIMARY KEY,
    change TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    action TEXT,
    created TEXT NOT NULL,
    updated TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX idx_member_created ON member(created);
CREATE INDEX idx_audit_created ON audit(created);
