# Product Requirements Document (PRD)
# EvidenceOS
## AI-Powered DORA Register of Information (RoI) Evidence & Validation Copilot

**Version:** 2.0  
**Document Status:** Final MVP PRD  
**Target Launch:** Q1 2027  
**Founder Model:** Solo founder, engineering-led  
**Deployment Constraint:** EU-only hosting and data residency  
**Core Outcome:** Human-approved, submission-ready DORA Register of Information draft with evidence, validation, and explainable recommendations.[cite:53][cite:64][cite:1]

## 1. Executive Summary
EvidenceOS is a focused compliance product that helps EU financial entities prepare a DORA Register of Information (RoI) draft from fragmented contracts, spreadsheets, vendor inventories, and internal documents.[cite:53][cite:64] The MVP is intentionally narrow: it transforms raw evidence into structured, validated, explainable regulatory output through a single pipeline: upload, extract, normalize, validate, recommend, review, and export.[cite:60][cite:65]

This product is not a general GRC platform, not a broad AI regulatory suite, and not an autonomous filing system. Its value lies in evidence-centric workflow acceleration, deterministic validation, human-controlled recommendations, and strong auditability for a specific high-friction regulatory deliverable under DORA Article 28(3).[cite:53][cite:55][cite:64]

## 2. Product Philosophy
EvidenceOS is a **pipeline product**, not a feature collection. Every capability must move the customer one step closer to a regulator-ready, human-approved RoI draft.[cite:53][cite:60]

This philosophy is a scope-control mechanism and an engineering principle. If a feature does not improve ingestion quality, extraction accuracy, normalization trust, validation completeness, evidence traceability, reviewer efficiency, or export readiness, it is out of scope for the MVP.[cite:1][cite:6]

## 3. Product Principles
- Evidence before AI.
- Deterministic before probabilistic.
- Human before automation.
- Trust before speed.
- One workflow before many.
- Every recommendation must be explainable.
- Every exported field must be traceable.
- Never fabricate evidence.
- Never overwrite customer data automatically.[cite:53][cite:65][cite:6]

## 4. Vision
EvidenceOS helps financial institutions prepare a submission-ready DORA Register of Information by transforming fragmented contracts, spreadsheets, and vendor inventories into structured, validated, explainable regulatory evidence.[cite:53][cite:64]

The product does not replace compliance professionals. It accelerates their work while preserving human review, accountability, and auditability.[cite:53][cite:65]

## 5. Mission
Reduce DORA RoI preparation from weeks of manual work to a few hours through AI-assisted evidence extraction, normalization, validation, and explainable recommendations.[cite:56][cite:60]

## 6. Positioning
### We Are
- AI-powered DORA RoI evidence and validation copilot.
- Structured evidence pipeline for RoI preparation.
- Human-in-the-loop recommendation system.
- Submission-draft generation tool with validation and traceability.[cite:53][cite:64]

### We Are Not
- Full GRC platform.
- Broad regulatory operating system.
- Enterprise risk suite.
- Audit management platform.
- Horizontal AI governance suite.
- Autonomous filing agent.[cite:48][cite:1]

### Positioning Statement
EvidenceOS helps EU financial entities turn contracts and spreadsheets into a reviewable DORA RoI draft with evidence, validation, and explainable AI recommendations that remain under human control.[cite:53][cite:65]

## 7. Goals
- Reduce RoI preparation time by at least 80% for target customers using the MVP workflow.[cite:56][cite:60]
- Increase completeness and consistency of RoI draft preparation through validation and evidence linking.[cite:60][cite:67]
- Reduce dependency on manual spreadsheet reconciliation and external consultants for early draft preparation.[cite:56][cite:47]
- Improve audit traceability by linking outputs back to source evidence and review history.[cite:53][cite:65]
- Generate a submission-ready draft package that a compliance team can confidently review and finalize.[cite:53][cite:64][cite:65]

## 8. Non-Goals
- Not replacing legal advice.
- Not automatically filing regulatory submissions.
- Not replacing compliance officers.
- Not performing continuous monitoring.
- Not managing the full vendor lifecycle.
- Not solving all DORA workflows.
- Not becoming a broad compliance operating system in MVP.[cite:48][cite:53][cite:65]

## 9. Problem Statement
Preparing a DORA Register of Information requires teams to gather and reconcile information spread across vendor inventories, contracts, spreadsheets, procurement records, risk documents, and internal documentation.[cite:53][cite:56] Teams must then identify vendors, normalize duplicates, review contractual content, determine operational importance, validate mandatory fields, and produce structured regulatory output under time pressure and scrutiny.[cite:54][cite:60][cite:65]

This process is slow, expensive, hard to audit, and prone to error. The pain is not only data collection; it is also evidence traceability, validation reliability, and explainable human review before submission.[cite:60][cite:65]

## 10. Product Promise
Upload existing documents and evidence. EvidenceOS prepares a submission-ready draft package containing a structured RoI, validation findings, supporting evidence, and AI recommendations that are never finalized without human approval.[cite:53][cite:64][cite:65]

## 11. Core Principles
- AI assists; humans decide.[cite:65]
- Every recommendation must include evidence, confidence, and explanation.[cite:53][cite:65]
- No AI decision becomes final without user approval.[cite:65]
- Every exported field should link back to evidence wherever possible.[cite:53][cite:60]
- EU data residency and auditability are mandatory for trust in this category.[cite:53][cite:65]

## 12. Regulatory Context
DORA requires financial entities to maintain and submit a register of contractual arrangements on ICT services under Article 28(3), and implementing standards specify templates, structure, and reporting expectations.[cite:64][cite:53] In 2026, supervisory and national guidance emphasized structured submission quality, xBRL OIM-CSV usage where applicable, completeness, relational consistency, and data quality, which means software value comes from evidence transformation and validation rather than document storage alone.[cite:53][cite:60][cite:65]

## 13. Target Customers
### Primary Customers
Mid-sized EU financial entities with material DORA reporting obligations and limited internal automation capacity.

Examples include:
- Payment Institutions.
- E-Money Institutions.
- Investment Firms.
- Fund Administrators.
- Credit Institutions.
- Insurance Firms.
- FinTechs.
- Crypto Asset Service Providers.[cite:53][cite:56]

### Ideal Company Size
- 50–1000 employees.
- Mature enough to feel DORA pressure.
- Small enough to suffer from manual evidence preparation and spreadsheet-heavy workflows.[cite:56][cite:47]

### Secondary Customers
- DORA consultancies.
- Compliance advisory firms.
- Potential future white-label channels after validation, but not MVP priority.[cite:47][cite:48]

## 14. Personas
### Compliance Officer
**Pain:** Evidence is fragmented across contracts and spreadsheets.  
**Needs:** A clear draft RoI, validation results, and evidence-backed recommendations.  
**Success:** Faster preparation with retained control.[cite:53][cite:56]

### Risk Manager
**Pain:** Operational importance and dependency judgments are inconsistent.  
**Needs:** Explainable recommendations supported by traceable evidence.  
**Success:** Defensible internal decisions.[cite:54][cite:65]

### Internal Auditor
**Pain:** Decisions are difficult to reconstruct later.  
**Needs:** Version history, evidence traceability, and review logs.  
**Success:** Reliable auditability.[cite:53][cite:65]

### External Reviewer or Advisor
**Pain:** Evidence is not centralized or reviewable.  
**Needs:** Structured proof, review state, and explainable outputs.  
**Success:** Faster inspection and less manual back-and-forth.[cite:53][cite:65]

## 15. North Star Metric
**Time from document upload to a human-approved, submission-ready Register of Information draft.** This metric aligns every product decision with the customer’s most important outcome.[cite:60][cite:65]

## 16. Success Criteria
The MVP is successful if:
- A compliance officer can upload relevant source documents without vendor assistance.[cite:1][cite:6]
- The system can extract, normalize, and validate RoI-relevant data with acceptable trust for real-world review.[cite:49][cite:60]
- A human reviewer can understand every material recommendation through evidence, explanation, and confidence.[cite:53][cite:65]
- A team can review and export a submission-ready draft package without rebuilding the workflow in spreadsheets.[cite:60][cite:65]
- At least three design partners can complete a meaningful pilot workflow using their own documents.[cite:47][cite:48]

## 17. Primary Success Question
**“Can this product help prepare a regulator-ready RoI draft without spending two weeks manually collecting, cleaning, and validating evidence?”**[cite:56][cite:60]

## 18. Scope Summary
The MVP supports one end-to-end workflow:

Upload  
↓  
Extract  
↓  
Normalize  
↓  
Validate  
↓  
Recommend  
↓  
Review  
↓  
Export

Nothing outside this pipeline should be added unless it directly improves this outcome.[cite:53][cite:60]

## 19. Business Requirements
### BR-1 Outcome Integrity
The system must help generate a submission-ready RoI draft package with evidence, validation, and review history under customer control.[cite:53][cite:64][cite:65]

### BR-2 Traceability
Every meaningful output should be linked to source evidence where possible.[cite:53][cite:65]

### BR-3 Explainability
Every recommendation must show evidence, reason, confidence, and reviewable actions.[cite:53][cite:65]

### BR-4 Human Oversight
No material AI-derived decision may silently become final without a human action or explicit approval flow.[cite:65]

### BR-5 Regulatory Focus
The MVP must remain dedicated to the DORA RoI workflow and avoid adjacent compliance expansion until this workflow proves trust and retention.[cite:48][cite:53]

## 20. Functional Requirements
### 20.1 Upload Stage
**Purpose:** Collect customer evidence securely and predictably.

**Requirements**
- FR-UP-1: Accept PDF uploads.
- FR-UP-2: Accept DOCX uploads.
- FR-UP-3: Accept XLSX uploads.
- FR-UP-4: Accept CSV uploads.
- FR-UP-5: Show upload progress.
- FR-UP-6: Store document metadata, uploader, timestamp, and organization scope.
- FR-UP-7: Prevent duplicate ingestion where checksum matches unless explicitly overridden.
- FR-UP-8: Route uploaded files into a processing queue.

**Acceptance Criteria**
- PDF, DOCX, XLSX, and CSV files upload successfully.
- Upload progress is visible to the user.
- Document metadata is persisted.
- A processing job is created for each accepted document.
- Duplicate detection flags repeated uploads with matching checksum.

### 20.2 Extraction Stage
**Purpose:** Convert raw documents into structured candidates.

**Requirements**
- FR-EX-1: Run OCR for scanned or image-based files.
- FR-EX-2: Extract vendors, contracts, services, dates, locations, termination language, audit rights, subcontractors, exit-related language, and renewal terms where present.
- FR-EX-3: Preserve raw text spans supporting each extracted field.
- FR-EX-4: Preserve page or row reference where possible.
- FR-EX-5: Attach confidence scores to extracted candidates.
- FR-EX-6: Flag low-confidence extraction results for review.

**Acceptance Criteria**
- Vendor name extraction works on representative contracts and spreadsheets.
- Each extracted field includes source context where available.
- Confidence score is stored for each extracted candidate.
- Raw extracted text is preserved for audit and review.
- Low-confidence items appear in review workflows.

### 20.3 Normalization Stage
**Purpose:** Resolve aliases and duplicate records into canonical entities.

**Requirements**
- FR-NO-1: Detect potential duplicate vendors.
- FR-NO-2: Detect aliases and naming variations.
- FR-NO-3: Suggest canonical records.
- FR-NO-4: Preserve alias history and raw forms.
- FR-NO-5: Require human approval for ambiguous merges.

**Acceptance Criteria**
- Duplicate vendor candidates are surfaced with merge confidence.
- Canonical record suggestions can be approved or rejected.
- Original aliases remain accessible after merge approval.
- No ambiguous merge is silently applied.

### 20.4 Validation Stage
**Purpose:** Enforce data quality and schema completeness.

**Requirements**
- FR-VA-1: Run mandatory field checks.
- FR-VA-2: Run format checks.
- FR-VA-3: Run relational integrity checks.
- FR-VA-4: Detect duplicate records and broken references.
- FR-VA-5: Group findings by severity.
- FR-VA-6: Show explanation and remediation guidance where feasible.

**Acceptance Criteria**
- Errors, warnings, and passes are grouped clearly.
- Each error links to affected field or record.
- Validation explanation is visible.
- Broken references and missing mandatory fields are surfaced consistently.

### 20.5 Recommendation Stage
**Purpose:** Support decisions without replacing them.

**Requirements**
- FR-RE-1: Generate explainable recommendations for importance classification support, missing clause detection, missing vendor detection, missing contract detection, and missing information signals.
- FR-RE-2: Store recommendations separately from normalized records.
- FR-RE-3: Show confidence, explanation, and evidence for every recommendation.
- FR-RE-4: Require user action before recommendation outcome affects export.

**Acceptance Criteria**
- Every recommendation includes evidence, confidence, and reason.
- Recommendations can be approved, rejected, or modified.
- Unreviewed recommendations are clearly marked.
- No recommendation becomes final automatically.

### 20.6 Review Stage
**Purpose:** Keep humans in control.

**Requirements**
- FR-RV-1: Provide a review queue for unresolved items.
- FR-RV-2: Show source evidence next to each item.
- FR-RV-3: Capture reviewer identity and timestamp.
- FR-RV-4: Record before and after values.
- FR-RV-5: Allow override reason capture.

**Acceptance Criteria**
- Reviewers can approve, reject, or modify items.
- Decision history is preserved.
- Evidence is accessible without leaving the review workflow.
- Override reasons are stored for material decisions.

### 20.7 Export Stage
**Purpose:** Produce customer-usable draft outputs.

**Requirements**
- FR-EP-1: Export a submission-ready draft RoI package.
- FR-EP-2: Export validation report.
- FR-EP-3: Export evidence report.
- FR-EP-4: Export review and audit history summary.

**Acceptance Criteria**
- Export package includes structured RoI draft and supporting artifacts.
- Exported validation report reflects latest review state.
- Export output is versioned.
- Product messaging and output labels make clear that the financial entity remains responsible for final submission.[cite:53][cite:65]

## 21. User Stories
- As a Compliance Officer, the user wants to upload vendor contracts and spreadsheets so that manual field entry is reduced.[cite:53][cite:56]
- As a Compliance Officer, the user wants a structured draft RoI so that preparation time is reduced.[cite:56][cite:60]
- As a Risk Manager, the user wants to inspect recommendation evidence so that classification decisions are defensible.[cite:54][cite:65]
- As an Auditor, the user wants to inspect review history and version lineage so that every output can be reconstructed later.[cite:53][cite:65]
- As a Reviewer, the user wants to approve or reject AI suggestions before export so that accountability remains human-owned.[cite:65]
- As an Administrator, the user wants organization-level data isolation so that sensitive evidence is protected.[cite:53][cite:1]

## 22. Non-Functional Requirements
### Security
- NFR-SE-1: EU data residency is mandatory.[cite:53][cite:65]
- NFR-SE-2: Encryption at rest is mandatory.[cite:53]
- NFR-SE-3: TLS in transit is mandatory.[cite:53]
- NFR-SE-4: Row-level security must isolate organization data.[cite:1][cite:6]
- NFR-SE-5: Audit logging is mandatory across upload, processing, review, and export.[cite:53][cite:65]

### Privacy
- NFR-PR-1: GDPR-aware handling is required because source files may contain personal and contractual data.[cite:53]
- NFR-PR-2: Retention and deletion behavior must be designed, even if admin controls ship later.[cite:53]

### Reliability
- NFR-RL-1: Processing jobs must be retryable.
- NFR-RL-2: Partial failure must not corrupt workspace state.
- NFR-RL-3: Failed jobs must surface actionable error states.[cite:49][cite:6]

### Performance
- NFR-PE-1: Typical submission package processing target should remain under 10 minutes within expected MVP bounds.[cite:49]
- NFR-PE-2: Review screens should remain responsive for realistic pilot datasets.[cite:6]

### Explainability
- NFR-EX-1: Every recommendation must expose evidence, reason, and confidence before approval.[cite:53][cite:65]

## 23. Trust Layer
The trust layer is a first-class product capability and core moat. Every recommendation or AI-assisted output must retain the following attributes:
- Confidence.
- Reason.
- Evidence.
- Reviewer.
- Timestamp.
- Version.
- Source.
- Override history.[cite:53][cite:65]

This trust layer is what allows the product to function in regulated workflows. Without it, the product collapses into an untrusted black box.[cite:53][cite:65]

## 24. Confidence Thresholds
Confidence thresholds must shape triage behavior, not silent automation.

| Confidence Band | System Behavior |
|---|---|
| Greater than 95% | Mark as high-confidence candidate, still pending human review [cite:65] |
| 80%–95% | Highlight for prioritized review [cite:65] |
| Below 80% | Mandatory manual review required [cite:65] |

Important rule: even very high-confidence outputs remain reviewable and should not bypass accountability in MVP.[cite:65]

## 25. Versioning Requirements
Versioning is mandatory for evidence trust and auditability.

### The system must version:
- Document versions.
- Extracted entity versions.
- Recommendation versions.
- Review decision versions.
- Export versions.[cite:53][cite:65]

### Example
- Contract V1 uploaded.
- Contract V2 uploaded later.
- Prior evidence links remain historically visible.
- New recommendations are generated against the latest approved evidence state.
- Exports are tagged with exact source and review version lineage.[cite:53][cite:65]

## 26. Observability Requirements
Observability is required for production reliability and supportability.

### The system must track:
- Failed OCR jobs.
- Parser failures.
- Low-confidence extraction counts.
- Validation failure counts.
- Queue latency.
- Retry counts.
- Processing duration per stage.
- Export generation failures.
- Review backlog volume.[cite:49][cite:6]

### Why it matters
Without observability, production debugging becomes expensive and trust erodes quickly in regulated workflows.[cite:6][cite:49]

## 27. Risk Register
| Risk | Impact | Mitigation |
|---|---|---|
| OCR failure | Medium | Retry flow, alternative parser path, surfaced error state [cite:49] |
| Wrong vendor merge | High | Human approval, alias preservation, merge audit log [cite:54][cite:1] |
| Missing clause detection | High | Confidence exposure, evidence inspection, review queue [cite:65] |
| Unsupported or hallucinated extraction | Critical | Never generate unsupported values, preserve raw spans, require evidence [cite:53][cite:65] |
| Overclaiming filing readiness | High | Position exports as submission-ready draft package only [cite:53][cite:65] |
| Queue or processing bottleneck | Medium | Job retries, observability, bounded workload targets [cite:49][cite:6] |

## 28. End-to-End Product Pipeline
### Stage 1 — Upload
Collect customer evidence through a controlled intake experience.[cite:53]

### Stage 2 — Extraction
Convert raw files into structured candidates with provenance.[cite:49][cite:53]

### Stage 3 — Normalization
Resolve aliases, duplicates, and inconsistent naming patterns into canonical records.[cite:54][cite:1]

### Stage 4 — Validation
Check mandatory fields, relational integrity, formats, and record consistency.[cite:64][cite:67]

### Stage 5 — Recommendation
Suggest high-value next actions and decisions with evidence and confidence.[cite:53][cite:65]

### Stage 6 — Review
Keep human reviewers in control of all material outcomes.[cite:65]

### Stage 7 — Export
Produce the structured draft package for customer-controlled finalization.[cite:53][cite:64][cite:65]

## 29. System Architecture Overview
### Logical Flow
User  
↓  
Frontend  
↓  
API  
↓  
Queue  
↓  
OCR / Parsing  
↓  
Extraction  
↓  
Normalization  
↓  
Validation  
↓  
Evidence Store  
↓  
Recommendation Engine  
↓  
Review Queue  
↓  
Export Service[cite:49][cite:6]

### Architectural Intent
- Keep deterministic validation separate from probabilistic reasoning.
- Preserve raw source artifacts independently from normalized entities.
- Make recommendation generation downstream from evidence linking and validation whenever possible.
- Design for reprocessing and version lineage from the start.[cite:49][cite:6][cite:65]

## 30. AI Pipeline
Documents  
↓  
OCR  
↓  
Entity Extraction  
↓  
Normalization  
↓  
Evidence Linking  
↓  
Rule Validation  
↓  
LLM Reasoning  
↓  
Recommendations  
↓  
Human Review  
↓  
Submission-ready Draft Export[cite:49][cite:53][cite:65]

The sequencing matters. Validation and evidence linkage should precede higher-level reasoning so that AI operates on structured and grounded inputs rather than raw text alone.[cite:49][cite:65]

## 31. AI Agents
### Ingestion Agent
Reads uploaded files, classifies type, stores metadata, and routes work into queues.[cite:49][cite:6]

### Extraction Agent
Extracts vendors, contracts, clauses, and field candidates with provenance.[cite:49][cite:53]

### Normalization Agent
Resolves aliases and duplicate entities while preserving lineage.[cite:54][cite:1]

### Validation Agent
Runs deterministic rules for structure, completeness, and consistency.[cite:64][cite:67]

### Evidence Agent
Links records and recommendations to source evidence, page references, and raw spans.[cite:53][cite:65]

### Recommendation Agent
Generates explainable suggestions for importance support, clause gaps, missing vendors, missing contracts, and missing information.[cite:54][cite:65]

### Export Agent
Produces versioned draft RoI outputs, validation reports, evidence reports, and audit summaries.[cite:53][cite:64]

## 32. Explainability Standard
Every recommendation must answer:
- What is being recommended?
- Why is it being recommended?
- Where is the supporting evidence?
- How confident is the system?
- What can the human reviewer do next?[cite:53][cite:65]

### Example Review Card
| Field | Example |
|---|---|
| Recommendation | Critical vendor suggestion |
| Entity | AWS |
| Reason | Supports payment and operational infrastructure |
| Evidence | Contract page reference, vendor inventory row, internal business function mapping |
| Confidence | 92% |
| Actions | Approve, reject, modify |

## 33. User Journey
1. User signs in or is invited to a workspace.
2. User uploads contracts, spreadsheets, and supporting documents.
3. System classifies and processes files.
4. Structured candidates are extracted.
5. Duplicate and alias normalization suggestions are surfaced.
6. Validation runs across structured records.
7. AI recommendations are created on top of evidence and validation state.
8. Human reviewers approve, reject, or modify outcomes.
9. System exports a submission-ready draft package with evidence and audit artifacts.[cite:53][cite:60][cite:65]

## 34. UX Requirements
### Core Screens
- Login and onboarding.
- Workspace dashboard.
- Document repository.
- Extraction review screen.
- Normalization review screen.
- Validation report screen.
- Recommendation review queue.
- Evidence inspection panel.
- Export center.
- Audit history and version view.[cite:1][cite:6]

### UX Principles
- Pipeline-first navigation.
- Clear progress state by stage.
- Review by severity and confidence.
- Evidence visible near the decision point.
- Minimal reviewer friction.[cite:53][cite:65]

## 35. Data Model Overview
### Core Entities
- organizations
- users
- workspace_memberships
- documents
- document_versions
- extracted_entities
- vendors
- vendor_aliases
- contracts
- business_functions
- evidence_links
- recommendations
- recommendation_versions
- validation_errors
- review_actions
- audit_logs
- reports
- exports[cite:1][cite:6]

### Data Model Principles
- Preserve raw source and normalized layers separately.
- Keep recommendation state independent from approved entity state.
- Favor append-only audit and version history.
- Use JSONB where early schema flexibility is needed.[cite:6][cite:49]

## 36. Technology Stack
### Frontend
- Next.js.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.[cite:1]

### Backend
- FastAPI.
- Python.
- Background jobs via Celery or equivalent queue infrastructure.[cite:6][cite:49]

### Database
- PostgreSQL via Supabase.
- JSONB for semi-structured metadata.
- Full-text search and vector retrieval support.[cite:49][cite:6]

### Storage
- Supabase Storage.[cite:6]

### Processing
- Azure Document Intelligence or equivalent OCR.
- LlamaParse fallback for difficult layouts.[cite:49]

### AI Layer
- GPT-5 or equivalent reasoning model.
- Embeddings for retrieval.
- LangGraph for workflow orchestration.[cite:49]

### Deployment
- Vercel frontend.
- Supabase data layer.
- EU-hosted infrastructure only.[cite:53]

### Explicit Constraint
Neo4j is out of scope for MVP and should be reconsidered only if PostgreSQL proves insufficient for evidence traversal in later phases.[cite:6][cite:49]

## 37. Security Model
- EU-only hosting.
- Encryption at rest.
- TLS in transit.
- Detailed audit logs.
- Row-level security.
- MFA support where feasible in MVP.
- SSO later, not required for MVP.
- Least-privilege internal service roles.[cite:53][cite:1]

## 38. Deliberate Exclusions
### Not in MVP
- Incident reporting.
- Continuous monitoring.
- Third-party risk management.
- Vendor health scores.
- SharePoint integration.
- Jira integration.
- Slack integration.
- ServiceNow integration.
- White-label mode.
- AI Act support.
- NIS2 support.
- ISO 27001 workflows.
- SOC 2 workflows.
- KPI-heavy generic dashboards.
- Mobile app.
- Broad connector marketplace.[cite:48][cite:6]

### Rationale
These items increase integration burden, dilute the DORA RoI pipeline, or move the product toward a broad compliance suite too early.[cite:48][cite:6]

## 39. Success Metrics
### Technical
| Metric | Target |
|---|---:|
| Extraction accuracy | 95% |
| Vendor matching accuracy | 95% |
| Validation accuracy | 99% |
| Clause detection accuracy | 90% |
| Average processing time | <10 minutes per submission |
| Human acceptance rate for AI recommendations | 85% |

These metrics support product trust, reviewer efficiency, and workflow viability.[cite:49][cite:65]

### Business
| Metric | Target |
|---|---:|
| Customer discovery interviews | 15 |
| Design partners | 3 |
| Paying customers | 5 |
| ARR | €50K |
| Customer workspaces | 100 |

These targets provide a realistic early proof point for a narrow enterprise workflow product.[cite:47][cite:48]

## 40. Roadmap
### Phase 1 — MVP
RoI evidence and validation copilot focused only on the upload-to-export workflow.[cite:53][cite:60]

### Phase 2
- Third-party risk management support.
- Vendor inventory management.
- Contract lifecycle assistance.
- Evidence reuse across adjacent workflows.[cite:48][cite:54]

### Phase 3
- DORA incident reporting support.
- Exit planning workflows.
- Operational resilience documentation support.[cite:48]

### Phase 4
Expand the evidence engine to support:
- NIS2.
- EU AI Act.
- ISO 27001.
- SOC 2.
- PCI DSS.

Only after the DORA RoI workflow is demonstrably trusted and retained.[cite:48][cite:47]

## 41. Companion Documents Required
To move from PRD to implementation, the following documents should accompany this PRD:
- System Design Document (SDD): services, queues, database boundaries, deployment.[cite:6]
- Technical Design Document (TDD): OCR pipeline, agent orchestration, validation engine, reasoning workflows.[cite:49][cite:6]
- Database Schema Specification: tables, constraints, indexes, versioning.[cite:6]
- API Specification: endpoints, payloads, auth, errors.[cite:6]
- UX Specification: wireframes, flows, states, review interactions.[cite:35][cite:71]
- Engineering Roadmap: milestone-based implementation sequence for 4–6 months.[cite:70][cite:6]

## 42. Final Assessment
EvidenceOS should win by doing one regulated workflow exceptionally well: preparing a human-approved, evidence-backed, validation-aware DORA Register of Information draft. If customers trust this workflow, adjacent capabilities such as TPRM, incident reporting, and broader regulatory evidence management become logical extensions rather than premature distractions.[cite:53][cite:60][cite:65]

The disciplined MVP is therefore not “another compliance platform.” It is a trusted evidence and validation copilot for a single high-value regulatory deliverable.[cite:48][cite:6]
