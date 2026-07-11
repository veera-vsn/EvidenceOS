# EvidenceOS Domain Model
## Core Entities, Relationships, and Lifecycle Boundaries

**Version:** 1.0  
**Status:** Foundational Domain Model for Database, API, and UI Design  
**Aligned Documents:** EvidenceOS PRD v2, EvidenceOS SDD v1.[cite:6][cite:71]

## 1. Purpose
This document defines the core business entities of EvidenceOS, their relationships, lifecycle boundaries, and ownership rules. It is the conceptual foundation for the database schema, API design, UI state, validation engine, review flows, and export lineage.[cite:6][cite:35]

## 2. Domain Philosophy
The domain model is built around one principle: every entity exists to support the creation of a trusted, human-approved, submission-ready DORA RoI draft from fragmented evidence.[cite:53][cite:60]

The domain therefore prioritizes:
- evidence lineage.
- versioning.
- reviewability.
- traceability.
- tenant isolation.
- separation between raw source, interpreted candidate, normalized record, validation outcome, and approved export.[cite:53][cite:65]

## 3. Top-Level Domain Map
```text
Organization
  │
  ├── Workspace
  │     │
  │     ├── Document
  │     │     ├── DocumentVersion
  │     │     ├── ParsedArtifact
  │     │     └── EvidenceFragment
  │     │
  │     ├── PipelineRun
  │     │
  │     ├── ExtractedEntity
  │     │     ├── FieldCandidate
  │     │     └── ExtractionVersion
  │     │
  │     ├── Vendor
  │     │     ├── VendorAlias
  │     │     ├── Contract
  │     │     ├── BusinessFunctionLink
  │     │     └── Recommendation
  │     │
  │     ├── Contract
  │     │     ├── ClauseCandidate
  │     │     ├── ContractVersionState
  │     │     └── EvidenceLink
  │     │
  │     ├── ValidationResult
  │     ├── ReviewAction
  │     ├── Export
  │     └── AuditEvent
```
[cite:6][cite:71]

## 4. Entity Definitions
### 4.1 Organization
Represents a customer company or regulated entity boundary.

**Owns:**
- users through memberships.
- workspaces.
- documents.
- vendors.
- contracts.
- exports.
- audit history.[cite:1][cite:6]

**Key responsibilities:**
- tenancy boundary.
- billing boundary later.
- security and access scope.

### 4.2 Workspace
Represents an operational working area for a specific RoI preparation effort or environment.

**Why it exists:**
A single organization may eventually run multiple preparation cycles, teams, or reporting contexts. Workspace creates an operational scope beneath the tenant boundary.[cite:6]

**Owns or scopes:**
- uploaded documents.
- pipeline runs.
- extracted entities.
- review queues.
- exports.

### 4.3 User
Represents a human actor authenticated into the system.

**Roles in MVP may include:**
- admin.
- compliance reviewer.
- risk reviewer.
- auditor / read-only reviewer.

**Key behaviors:**
- upload documents.
- review recommendations.
- approve or reject changes.
- export artifacts.[cite:53][cite:65]

### 4.4 Membership
Represents the relationship between a user and an organization or workspace.

**Why it exists:**
Role and access should be modeled explicitly rather than inferred.[cite:6]

### 4.5 Document
Represents a logical uploaded file such as a contract, spreadsheet, or policy.

**Examples:**
- master services agreement.
- vendor inventory spreadsheet.
- procurement register export.
- policy attachment.

**Important rule:**
Document is the logical identity. Its contents over time are represented by `DocumentVersion`.[cite:49][cite:65]

### 4.6 DocumentVersion
Represents an immutable version of a document at a point in time.

**Key attributes:**
- version number.
- storage path.
- checksum.
- upload timestamp.
- uploader.
- parse status.
- OCR status.

**Why it matters:**
Auditors and reviewers need to know which exact file version produced which extraction, validation, recommendation, and export.[cite:53][cite:65]

### 4.7 ParsedArtifact
Represents a machine-readable output derived from a `DocumentVersion`.

**Examples:**
- OCR text.
- structured table extraction.
- parser JSON.
- page map.

**Purpose:**
Separate expensive parsing outputs from later extraction and reasoning stages.[cite:49]

### 4.8 EvidenceFragment
Represents a traceable source fragment derived from a document.

**Examples:**
- page 14 paragraph.
- sheet 2 row 28.
- clause text span.
- table cell range.

**Purpose:**
EvidenceFragment is the atomic trust unit that downstream entities and recommendations should reference.[cite:53][cite:65]

### 4.9 PipelineRun
Represents a coordinated processing attempt over one or more document versions.

**Tracks:**
- start and end time.
- stage status.
- worker status.
- error state.
- rerun lineage.

**Why it exists:**
The product is pipeline-centric, so orchestration must be a first-class domain concept rather than hidden in logs.[cite:49][cite:6]

### 4.10 ExtractedEntity
Represents a raw or semi-structured domain object identified from evidence before normalization.

**Examples:**
- vendor candidate.
- contract candidate.
- location candidate.
- service candidate.

**Important distinction:**
ExtractedEntity is not yet a trusted business record. It is a candidate derived from source evidence.[cite:49][cite:53]

### 4.11 FieldCandidate
Represents a candidate field value attached to an extracted entity.

**Examples:**
- vendor name = “Microsoft Ireland Ltd”.
- termination period = “30 days”.
- audit rights = “present”.

**Attributes:**
- value.
- confidence.
- source fragment.
- extraction method.
- timestamp.

### 4.12 ExtractionVersion
Represents a versioned result set of extraction over one source state.

**Why it exists:**
If prompts, models, or parsing quality improve, extraction may be rerun without erasing history.[cite:49][cite:65]

### 4.13 Vendor
Represents the normalized vendor entity used in trusted business records and exports.

**Relationships:**
- has many aliases.
- may have many contracts.
- may map to many business functions.
- may have many recommendations and validations.

**Important rule:**
Vendor exists only after normalization and review reach an acceptable state.[cite:54][cite:1]

### 4.14 VendorAlias
Represents an alternate source name that maps to a canonical Vendor.

**Purpose:**
Preserve source fidelity while allowing normalized reporting.[cite:54][cite:1]

### 4.15 Contract
Represents a normalized contractual arrangement relevant to the RoI.

**Relationships:**
- belongs to a vendor.
- derived from one or more document versions.
- may contain clause candidates.
- may link to evidence fragments.
- may drive recommendations and validations.[cite:53][cite:64]

### 4.16 ClauseCandidate
Represents an extracted or inferred clause-level finding from a contract.

**Examples:**
- audit rights present.
- termination clause found.
- exit support clause missing.

**Why it matters:**
ClauseCandidate supports explainability for downstream recommendations.[cite:54][cite:65]

### 4.17 BusinessFunction
Represents a business or operational function referenced in relation to a vendor or service.

**Purpose:**
Supports operational-importance reasoning and RoI structuring.[cite:54][cite:65]

### 4.18 BusinessFunctionLink
Represents the association between vendor, contract, service, and business function.

**Why it exists:**
Associations are often many-to-many and evidence-dependent.[cite:53][cite:65]

### 4.19 ValidationResult
Represents one deterministic validation finding.

**Examples:**
- missing required field.
- invalid format.
- broken reference.
- duplicate record.

**Attributes:**
- rule id.
- severity.
- target entity.
- explanation.
- remediation suggestion.
- evidence or context reference.[cite:64][cite:67]

### 4.20 Recommendation
Represents one AI-assisted suggestion requiring human review.

**Examples:**
- likely critical vendor.
- possible missing vendor.
- likely missing contract clause.
- probable missing field.
- suggested entity merge.

**Required trust attributes:**
- confidence.
- explanation.
- evidence references.
- generation version.
- review state.[cite:53][cite:65]

### 4.21 RecommendationVersion
Represents a versioned snapshot of a recommendation if regenerated after upstream changes.

**Why it matters:**
A recommendation based on DocumentVersion 1 should not be conflated with one based on DocumentVersion 2.[cite:53][cite:65]

### 4.22 ReviewAction
Represents a human decision event.

**Examples:**
- approved recommendation.
- rejected merge.
- modified field value.
- accepted validation remediation.

**Attributes:**
- actor.
- timestamp.
- target entity.
- previous state.
- new state.
- rationale.

### 4.23 EvidenceLink
Represents the explicit relationship between a trusted record or recommendation and supporting evidence fragments.

**Examples:**
- Recommendation R123 links to page 14 paragraph 2 of Contract V2.
- Vendor field “registered address” links to spreadsheet row 28 and contract header clause.

**Purpose:**
EvidenceLink is the structural mechanism behind traceability.[cite:53][cite:65]

### 4.24 Export
Represents a versioned output package generated for customer review.

**Contains or references:**
- draft RoI file.
- validation report.
- evidence report.
- review summary.
- lineage metadata.[cite:53][cite:64][cite:65]

### 4.25 AuditEvent
Represents a system or user event retained for observability and auditability.

**Examples:**
- document uploaded.
- OCR failed.
- recommendation approved.
- export generated.

## 5. Domain Layers
### Layer A — Raw Source Layer
- Document
- DocumentVersion
- ParsedArtifact
- EvidenceFragment

This layer preserves source truth and must remain immutable wherever possible.[cite:49][cite:53]

### Layer B — Candidate Interpretation Layer
- ExtractedEntity
- FieldCandidate
- ExtractionVersion
- ClauseCandidate

This layer contains machine-derived interpretations that are not yet fully trusted.[cite:49][cite:65]

### Layer C — Trusted Business Record Layer
- Vendor
- VendorAlias
- Contract
- BusinessFunction
- BusinessFunctionLink

This layer contains normalized, reviewed, operationally meaningful records.[cite:54][cite:1]

### Layer D — Control and Quality Layer
- ValidationResult
- Recommendation
- RecommendationVersion
- ReviewAction
- EvidenceLink

This layer governs trust, explainability, and human oversight.[cite:53][cite:65]

### Layer E — Delivery Layer
- Export
- AuditEvent
- PipelineRun

This layer supports output generation, operational visibility, and auditability.[cite:49][cite:65]

## 6. Key Relationship Rules
- One Organization has many Workspaces.[cite:6]
- One Workspace has many Documents and PipelineRuns.[cite:6]
- One Document has many DocumentVersions.[cite:53][cite:65]
- One DocumentVersion may produce many ParsedArtifacts and EvidenceFragments.[cite:49]
- One ExtractionVersion may create many ExtractedEntities and FieldCandidates.[cite:49]
- Many VendorAliases map to one Vendor.[cite:54][cite:1]
- One Vendor may have many Contracts.[cite:53]
- One Contract may have many ClauseCandidates and EvidenceLinks.[cite:54][cite:65]
- One Recommendation may reference many EvidenceLinks.[cite:53][cite:65]
- One ReviewAction applies to one target entity at a time but an entity may have many ReviewActions over time.[cite:53][cite:65]
- One Export references one approved state snapshot across multiple entities and versions.[cite:53][cite:65]

## 7. Lifecycle Boundaries
### Document Lifecycle
uploaded → versioned → parsed → extracted → referenced in evidence → retained for history.[cite:49][cite:53]

### Vendor Lifecycle
candidate extracted → normalized suggestion → reviewed → canonical vendor → reused in export.[cite:54][cite:1]

### Recommendation Lifecycle
generated → pending review → approved / rejected / modified → versioned if regenerated.[cite:53][cite:65]

### Export Lifecycle
requested → generated → stored as immutable snapshot → superseded by later export if new approved state exists.[cite:53][cite:65]

## 8. Trust Model
Every trusted output in the domain should answer:
- what produced it?
- which source evidence supports it?
- which version set was used?
- who reviewed it?
- what changed over time?

These questions map directly to:
- EvidenceFragment.
- EvidenceLink.
- Versioned entities.
- ReviewAction.
- AuditEvent.[cite:53][cite:65]

## 9. Domain Constraints
- No recommendation may exist without confidence and explanation.[cite:65]
- No trusted export may exist without a source version snapshot.[cite:53][cite:65]
- No destructive overwrite of DocumentVersion is allowed.[cite:53][cite:65]
- No silent normalization merge should occur when ambiguity exceeds acceptable threshold.[cite:54][cite:1]
- No exported field should be treated as trustworthy if it lacks traceable origin where the product could reasonably preserve one.[cite:53][cite:65]

## 10. Domain Implications for Database Design
This model implies:
- strong version tables.
- many-to-many evidence mapping tables.
- review event tables rather than single mutable review columns.
- a clear split between candidate data and approved data.
- snapshot-friendly export lineage.[cite:6][cite:71]

## 11. Domain Implications for API Design
The API should expose separate resources for:
- documents and versions.
- pipeline runs.
- extracted candidates.
- normalized records.
- validations.
- recommendations.
- review actions.
- exports.[cite:6]

This reduces ambiguity and preserves the workflow semantics visible in the product.[cite:6][cite:35]

## 12. Domain Implications for UI
The UI should reflect domain layers, not generic CRUD screens.

Examples:
- Document Repository maps to Document and DocumentVersion.
- Review Queue maps to Recommendation, ValidationResult, and ReviewAction.
- Evidence Panel maps to EvidenceFragment and EvidenceLink.
- Export Center maps to Export and version lineage.[cite:35][cite:71]

## 13. Summary
The EvidenceOS domain model is built around evidence, interpretation, trust, and controlled output. Its central distinction is between raw source data, machine-derived candidates, reviewed business records, and immutable export snapshots. That structure is what makes the product auditable, explainable, and architecturally stable enough for a regulated B2B workflow.[cite:53][cite:65][cite:6]
