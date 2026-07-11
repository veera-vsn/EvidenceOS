# System Design Document (SDD)
# EvidenceOS
## AI-Powered DORA Register of Information (RoI) Evidence & Validation Copilot

**Version:** 1.0  
**Status:** Implementation Design Baseline  
**Aligned PRD:** EvidenceOS PRD v2  
**Deployment:** EU-only  
**Architecture Style:** Modular monolith with asynchronous processing pipeline, designed to evolve into service-separated components if scale or compliance needs require it.[cite:6][cite:49][cite:53]

## 1. Purpose
This System Design Document translates the EvidenceOS PRD into an implementation-oriented architecture. It defines service boundaries, processing flow, storage model, versioning, trust controls, observability, security posture, and deployment topology required to build the MVP as a solo-founder-friendly but enterprise-conscious system.[cite:6][cite:71]

## 2. Design Objectives
- Build one end-to-end DORA RoI pipeline with minimal architectural waste.[cite:53][cite:60]
- Keep deterministic validation separate from AI reasoning.[cite:64][cite:67]
- Preserve evidence lineage from source document to exported draft output.[cite:53][cite:65]
- Maintain human control over all material decisions.[cite:65]
- Support versioning across documents, recommendations, reviews, and exports.[cite:53][cite:65]
- Favor a modular monolith to reduce solo-founder overhead while preserving clean internal boundaries for later API and service separation.[cite:6][cite:1]

## 3. Architectural Principles
- Evidence before AI.[cite:53][cite:65]
- Deterministic logic before probabilistic reasoning.[cite:64][cite:67]
- Human approval before automation.[cite:65]
- Append-only history where trust and auditability matter.[cite:53][cite:65]
- API-first internal design even if external APIs are delayed.[cite:6]
- Raw source preservation is mandatory.[cite:49][cite:53]
- Reprocessing must be possible without corrupting prior approved state.[cite:49][cite:65]

## 4. High-Level Architecture
```text
User
  │
  ▼
Next.js Frontend
  │
  ▼
FastAPI Application Layer
  │
  ├── Auth & Tenant Access Layer
  ├── Document Management Module
  ├── Pipeline Orchestrator
  ├── Review & Decision Module
  ├── Export Module
  └── Audit & Observability Module
  │
  ▼
Job Queue / Worker Layer
  │
  ├── OCR Worker
  ├── Extraction Worker
  ├── Normalization Worker
  ├── Validation Worker
  ├── Recommendation Worker
  └── Export Worker
  │
  ▼
PostgreSQL + JSONB + Vector Support
  │
  ├── Core Relational Data
  ├── Versioned Records
  ├── Audit Logs
  ├── Validation Results
  └── Evidence Links
  │
  ▼
Object Storage
  ├── Source Files
  ├── Derived Files
  └── Export Artifacts
```
[cite:6][cite:49]

## 5. System Context
EvidenceOS sits between customer-provided evidence inputs and a human-reviewed DORA RoI draft package. It is not a filing gateway and does not replace final regulatory submission processes.[cite:53][cite:65]

### External Dependencies
- OCR / document intelligence provider for scanned and complex documents.[cite:49]
- LLM provider for extraction reasoning and recommendation generation.[cite:49]
- Embedding provider or model for retrieval and evidence search.[cite:49]
- EU-hosted storage and data infrastructure.[cite:53]

## 6. Architectural Style
### 6.1 MVP Choice: Modular Monolith
The MVP should use a modular monolith rather than microservices. This reduces deployment complexity, coordination overhead, and debugging cost while still enabling strong codebase boundaries between ingestion, extraction, normalization, validation, recommendation, review, and export.[cite:6][cite:1]

### 6.2 Why not Microservices
Microservices would introduce queue coordination, schema synchronization, deployment fragmentation, and observability burden too early for a solo founder. The workload is pipeline-oriented rather than independently scaling across many product lines, so a modular monolith with async workers is the better fit.[cite:6][cite:49]

## 7. Major Components
### 7.1 Frontend
**Technology:** Next.js, TypeScript, Tailwind, shadcn/ui.[cite:1]

**Responsibilities:**
- Authentication and onboarding.
- Document upload experience.
- Pipeline progress visualization.
- Validation and recommendation review flows.
- Evidence inspection experience.
- Export center.
- Audit history and version viewing.[cite:6][cite:35]

### 7.2 Application API Layer
**Technology:** FastAPI.[cite:6][cite:49]

**Responsibilities:**
- Expose business capabilities over internal and future external API contracts.
- Validate request context and tenant scope.
- Persist command-side operations.
- Trigger async jobs.
- Serve review, audit, and export queries.
- Enforce authorization and policy checks.[cite:6]

### 7.3 Pipeline Orchestrator
**Responsibilities:**
- Create and track pipeline runs per upload batch or reprocessing event.
- Manage stage dependencies.
- Trigger downstream jobs only when prior stage results are available.
- Store pipeline status per document, entity set, and workspace.
- Support partial reruns, such as re-running extraction or recommendations without rebuilding everything.[cite:49][cite:65]

### 7.4 Worker Layer
**Responsibilities:**
- Perform long-running asynchronous tasks.
- Separate compute-heavy document processing from synchronous API calls.
- Emit stage-level status, metrics, and failure events.[cite:49][cite:6]

### 7.5 Data Layer
**Technology:** PostgreSQL on Supabase, with JSONB and vector support.[cite:49][cite:6]

**Responsibilities:**
- Store normalized business entities.
- Store raw extraction outputs and evidence mappings.
- Maintain version history.
- Preserve audit logs and review state.
- Support search and retrieval.[cite:49][cite:53]

### 7.6 Storage Layer
**Technology:** Supabase Storage or EU-hosted equivalent.[cite:6][cite:53]

**Responsibilities:**
- Store original uploaded files.
- Store rendered or derived artifacts such as OCR outputs, structured extracts, and export packages.
- Preserve immutable access paths by version.[cite:49][cite:65]

## 8. End-to-End Pipeline
### 8.1 Upload
1. User uploads PDF, DOCX, XLSX, or CSV.
2. File metadata, checksum, organization scope, uploader, and timestamp are stored.
3. File is stored in object storage.
4. A `pipeline_run` and `document_version` record are created.
5. OCR / parsing job is enqueued as needed.[cite:49][cite:53]

### 8.2 OCR and Parsing
1. Worker inspects document type.
2. For scanned PDFs or images, OCR is executed.
3. For structured files, parser extracts sheet, row, column, and cell metadata.
4. Raw machine-readable content is persisted with provenance.
5. Failures emit retryable error states.[cite:49]

### 8.3 Extraction
1. Structured extraction prompt or rule set runs against parsed content.
2. Candidate fields and entities are generated.
3. Each candidate receives source references, raw spans, and confidence.
4. Results are written to `extracted_entities` and `entity_field_candidates` tables.[cite:49][cite:53]

### 8.4 Normalization
1. Candidate entities are compared using deterministic matching and fuzzy rules.
2. Canonical vendor and contract candidates are created.
3. Ambiguous merges become recommendations or review items.
4. Approved normalized records are linked back to all source aliases.[cite:54][cite:1]

### 8.5 Deterministic Validation
1. Validation engine runs required field checks.
2. It runs format, type, reference, and cross-record consistency checks.
3. Findings are stored with severity and remediation details.
4. Validation does not rely on LLM output for core rule compliance.[cite:64][cite:67]

### 8.6 AI Recommendation Layer
1. Recommendations consume structured records, evidence links, and validation state.
2. LLM reasoning is used only after extraction and deterministic validation have produced stable structured context.
3. Recommendation objects include reason, evidence, confidence, and proposed action.[cite:49][cite:65]

### 8.7 Human Review
1. Review queue surfaces unresolved validations and recommendations.
2. User inspects evidence and source references.
3. User approves, rejects, or modifies items.
4. Review action is versioned and audited.[cite:53][cite:65]

### 8.8 Export
1. Export worker builds a versioned draft output package.
2. Output includes structured RoI draft, validation report, evidence report, and review summary.
3. Export is tied to exact source, recommendation, and review versions.[cite:53][cite:64][cite:65]

## 9. Deterministic vs AI Boundary
This boundary is critical.

### Deterministic Layer
- File type detection.
- Metadata capture.
- Checksum duplicate detection.
- Mandatory field validation.
- Format validation.
- Referential integrity checks.
- Date and identifier rules.
- Export packaging rules.[cite:64][cite:67]

### AI-Assisted Layer
- Complex clause interpretation.
- Candidate field extraction from unstructured contract language.
- Missing-information suggestions.
- Ambiguous entity resolution suggestions.
- Operational-importance support recommendations.
- Natural-language explanations for recommendations.[cite:49][cite:54][cite:65]

### Rule
AI must not be the sole source of truth for structural compliance rules. Deterministic validation owns structural correctness; AI assists interpretation and prioritization.[cite:64][cite:67]

## 10. Internal Module Design
### 10.1 Auth and Tenant Access Module
- Handles authentication.
- Maps users to organizations and workspaces.
- Enforces row-level and service-layer authorization.
- Supports future SSO extension.[cite:1][cite:6]

### 10.2 Document Module
- Stores document records and versions.
- Tracks file status across pipeline stages.
- Manages document tagging and provenance.[cite:49]

### 10.3 Extraction Module
- Stores parser outputs.
- Manages extraction templates and prompts.
- Tracks confidence and source span quality.[cite:49]

### 10.4 Normalization Module
- Maintains canonical entities and alias graphs in relational form.
- Tracks merge proposals and approval state.[cite:54][cite:1]

### 10.5 Validation Module
- Executes deterministic rule sets.
- Stores errors, warnings, and passes.
- Supports template-aware validation configuration.[cite:64][cite:67]

### 10.6 Recommendation Module
- Produces recommendation versions.
- Stores rationale and evidence references.
- Supports confidence-band triage.[cite:65]

### 10.7 Review Module
- Manages review queue state.
- Captures user decisions.
- Tracks override rationale and final approved values.[cite:53][cite:65]

### 10.8 Export Module
- Generates draft output files.
- Produces evidence and validation reports.
- Stores export lineage and artifact references.[cite:53][cite:64]

### 10.9 Audit and Observability Module
- Stores immutable or append-only event trails where possible.
- Emits operational metrics.
- Supports debugging and support workflows.[cite:49][cite:65]

## 11. Job Queue Design
### 11.1 Why Queueing is Required
OCR, parsing, extraction, and export are long-running and potentially bursty. Queueing prevents API timeout, smooths workload spikes, and supports retries and monitoring.[cite:49][cite:6]

### 11.2 Job Types
- `document.parse`
- `document.ocr`
- `entity.extract`
- `entity.normalize`
- `validation.run`
- `recommendation.generate`
- `export.generate`
- `pipeline.retry_stage`

### 11.3 Job States
- queued
- running
- succeeded
- failed
- retrying
- canceled

### 11.4 Retry Policy
- Retry on transient provider failures.
- No blind infinite retries.
- Retry counts and failure reason must be stored.[cite:49]

## 12. Data Flow Model
### 12.1 Command Flow
User actions create commands through the API layer. Commands mutate persisted state or enqueue jobs.

Examples:
- Upload document.
- Approve recommendation.
- Re-run extraction.
- Generate export.

### 12.2 Query Flow
Read models assemble data for frontend views.

Examples:
- Review queue view.
- Validation summary.
- Vendor detail page.
- Export history page.[cite:6]

## 13. Storage Design
### 13.1 PostgreSQL
Use PostgreSQL as the primary system of record.

Store in relational form:
- organizations
- users
- workspaces
- documents
- document_versions
- vendors
- contracts
- business_functions
- validations
- recommendations
- reviews
- exports
- audit logs[cite:6][cite:49]

Use JSONB for:
- raw parser metadata.
- semi-structured extraction payloads.
- model response metadata.
- rule execution metadata.

### 13.2 Object Storage
Use object storage for:
- original documents.
- OCR text files.
- parsed representations.
- rendered evidence snippets if needed.
- export bundles.[cite:49]

### 13.3 Vector Storage
Store embeddings for:
- evidence retrieval.
- supporting explanation context.
- semantic lookup of source passages.[cite:49]

## 14. Versioning Strategy
Versioning is first-class.

### Versioned Objects
- Documents.
- Extracted entities.
- Normalized entities where approved state changes.
- Recommendations.
- Review decisions.
- Exports.[cite:53][cite:65]

### Rules
- New uploads create new document versions, not destructive replacements.
- Recommendations are tied to the version set that generated them.
- Exports are immutable snapshots.
- Review actions reference both prior and resulting state.[cite:53][cite:65]

## 15. Trust Layer Design
Every recommendation and material derived value must retain:
- confidence.
- evidence reference.
- reasoning summary.
- generation timestamp.
- model or rule provenance.
- reviewer identity.
- review decision.
- override history.[cite:53][cite:65]

This should be implemented as structured fields rather than buried in unstructured logs.[cite:65]

## 16. Confidence Threshold Design
Use confidence for triage, never for silent finalization.

| Confidence Band | Behavior |
|---|---|
| >95% | Standard review queue, high-confidence badge [cite:65] |
| 80–95% | Highlight for reviewer attention [cite:65] |
| <80% | Mandatory manual verification [cite:65] |

## 17. API-First Philosophy
All business capabilities should be implemented as backend services with stable contracts, even if only the web application uses them initially. This allows future external APIs, integrations, and enterprise workflow extensions without rewriting the domain logic.[cite:6]

### API Design Principles
- Resource-oriented endpoints.
- Async-job-aware responses for long-running tasks.
- Explicit tenant context.
- Version-safe read models.
- Structured error responses.
- Idempotency where document uploads or re-runs may repeat.[cite:6]

## 18. Security Design
### 18.1 Tenant Isolation
- Organization data must be isolated using row-level security and service-layer checks.[cite:1][cite:6]

### 18.2 Encryption
- TLS in transit.
- Encryption at rest for database and object storage.[cite:53]

### 18.3 Least Privilege
- Workers receive scoped credentials.
- Export and storage access are limited by tenant and artifact scope.[cite:53]

### 18.4 Auditability
- Every upload, extraction run, validation run, recommendation decision, and export event must be auditable.[cite:53][cite:65]

## 19. Observability Design
### Metrics to Track
- upload success rate.
- OCR failure rate.
- extraction confidence distribution.
- normalization ambiguity rate.
- validation failure count by rule.
- recommendation acceptance rate.
- queue latency.
- stage duration.
- export success rate.
- review backlog size.[cite:49][cite:65]

### Logs to Track
- provider errors.
- parser exceptions.
- prompt execution metadata.
- job retries.
- authorization failures.
- export generation failures.[cite:49][cite:6]

### Traces to Consider
- end-to-end pipeline run trace.
- document-level stage trace.
- export lineage trace.[cite:49]

## 20. Failure Handling
### Failure Types
- OCR provider unavailable.
- malformed file.
- extraction parse failure.
- normalization ambiguity overflow.
- validation rule engine error.
- recommendation generation timeout.
- export formatting failure.[cite:49][cite:64]

### Recovery Principles
- Fail visibly.
- Preserve partial state safely.
- Retry transient failures.
- Never produce silent corrupted outputs.
- Require user re-review if upstream evidence changed materially before export.[cite:49][cite:65]

## 21. Deployment Topology
### MVP Topology
- Vercel-hosted Next.js frontend.
- FastAPI backend deployed in EU region.
- Supabase EU-hosted PostgreSQL and storage.
- Worker runtime in EU-hosted container environment.
- Optional managed Redis or queue broker in EU region if required by worker framework.[cite:53][cite:6]

### Environment Separation
- local
- development
- staging
- production

### Why This Topology
It minimizes ops burden while preserving EU residency, async processing, and clear environment boundaries suitable for enterprise pilots.[cite:53][cite:6]

## 22. Scalability Strategy
### MVP Expectations
The MVP should optimize for reliability and clarity, not hyperscale. Expected workloads are bounded by pilot customers and batch-style submission preparation.[cite:47][cite:48]

### Scale Path
- Separate workers from API if job load increases.
- Introduce dedicated job broker tuning.
- Partition large audit or event tables.
- Move heavy retrieval workloads to dedicated search infrastructure only when PostgreSQL becomes insufficient.[cite:6][cite:49]

## 23. Engineering Folder Boundaries
A suggested code structure:

```text
/apps
  /web
  /api
/workers
  /ocr
  /extraction
  /normalization
  /validation
  /recommendation
  /export
/packages
  /domain
  /application
  /infrastructure
  /contracts
  /observability
  /ui
```
[cite:6][cite:71]

## 24. Implementation Order
1. Auth and tenant model.
2. Document upload and storage.
3. Pipeline run model and queue infrastructure.
4. OCR / parsing pipeline.
5. Extraction persistence.
6. Normalization logic.
7. Deterministic validation engine.
8. Recommendation generation.
9. Review queue and evidence view.
10. Export engine.
11. Audit and observability hardening.[cite:70][cite:6]

## 25. Open Technical Questions
- Which OCR provider gives the best EU-hosted trade-off for cost and contract quality?[cite:49]
- How should document chunking and extraction prompts vary by file type?[cite:49]
- What is the minimal relational schema for RoI template coverage without overfitting too early?[cite:64][cite:67]
- When does vector retrieval become necessary versus simple full-text and reference linking?[cite:49]
- Which stages should be fully rerunnable independently without invalidating approved review state?[cite:65]

## 26. Summary
EvidenceOS should be built as a modular monolith with strong internal boundaries, asynchronous pipeline workers, first-class versioning, deterministic validation, AI-assisted recommendations, and human-controlled review. This architecture keeps the MVP disciplined enough for a solo founder while preserving the trust, traceability, and extensibility expected in regulated B2B software.[cite:6][cite:53][cite:65]
