/**
 * `/dashboard/[workspaceSlug]/pipeline` — pipeline runs view.
 *
 * Three panels:
 *   1. Start a new run — select uploaded documents, click "Start".
 *   2. Run history — list of all pipeline_runs with stage status grid.
 *      Runs collapse by default (native <details>, no client JS) except
 *      the most recent one, which stays open.
 *   3. Extracted fields — DORA RoI fields pulled from each document.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/document-encryption";
import type {
  DocumentRow,
  DocumentVersionRow,
  ExtractionResultRow,
  PipelineRunRow,
  PipelineRunDocumentRow,
  StageStatus,
  ValidationResultRow,
} from "@/lib/supabase/database.types";

import { ConfidencePip, ValidationBadges } from "../_components/field-badges";
import { StartRunForm, type SelectableDocument } from "./start-run-form";

interface PipelinePageProps {
  params: Promise<{ workspaceSlug: string }>;
}

const STAGES: { key: keyof PipelineRunDocumentRow; label: string }[] = [
  { key: "ocr_status", label: "OCR" },
  { key: "extraction_status", label: "Extract" },
  { key: "normalisation_status", label: "Normalise" },
  { key: "validation_status", label: "Validate" },
  { key: "recommendation_status", label: "Recommend" },
];

const RUN_STATUS_STYLES: Record<string, string> = {
  queued: "text-fg-2",
  running: "text-accent",
  completed: "text-success",
  failed: "text-danger",
};

export default async function PipelinePage({ params }: PipelinePageProps) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect("/dashboard");

  // Fetch all documents with latest version for the "start run" form.
  const { data: rawDocs } = await supabase
    .from("documents")
    .select("id, name, file_type, created_at, workspace_id, created_by, updated_at, document_versions(id, upload_status, version_number)")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .returns<(DocumentRow & { document_versions: DocumentVersionRow[] })[]>();

  const selectableDocs: SelectableDocument[] = (rawDocs ?? []).map((doc) => {
    const sorted = [...(doc.document_versions ?? [])].sort(
      (a, b) => b.version_number - a.version_number,
    );
    return { ...doc, latest_version: sorted[0] ?? null };
  });

  // Fetch pipeline runs with document rows + extraction results.
  const { data: runs } = await supabase
    .from("pipeline_runs")
    .select(`
      id, status, created_at, started_at, completed_at, created_by, updated_at, workspace_id,
      pipeline_run_documents (
        document_version_id,
        ocr_status, extraction_status, normalisation_status,
        validation_status, recommendation_status,
        document_versions (
          documents ( name, file_type ),
          extraction_results ( field_code, field_label, extracted_value, confidence ),
          validation_results ( field_code, rule_id, rule_label, status, message )
        )
      )
    `)
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .returns<
      (PipelineRunRow & {
        pipeline_run_documents: (PipelineRunDocumentRow & {
          document_versions: {
            documents: { name: string; file_type: string } | null;
            extraction_results: Pick<ExtractionResultRow, "field_code" | "field_label" | "extracted_value" | "confidence">[];
            validation_results: Pick<ValidationResultRow, "field_code" | "rule_id" | "rule_label" | "status" | "message">[];
          } | null;
        })[];
      })[]
    >();

  // extraction_results.extracted_value is encrypted at rest (see
  // app/core/encryption.py) -- decrypt before render.
  for (const run of runs ?? []) {
    for (const prd of run.pipeline_run_documents ?? []) {
      const results = prd.document_versions?.extraction_results;
      if (!results) continue;
      for (const f of results) {
        f.extracted_value = decryptText(f.extracted_value);
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-6 pb-20 sm:px-10 sm:py-[34px]">
      <div className="mb-6">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
          Processing
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-fg">
          Pipeline
        </h1>
      </div>

      <StartRunForm
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        documents={selectableDocs}
      />

      {(runs?.length ?? 0) > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-[11.5px] text-fg-2">
            <span className="font-mono text-[10.5px] tracking-[0.1em] text-fg-3 uppercase">
              Run history
            </span>
            <LegendItem colour="bg-success" label="completed" />
            <LegendItem colour="bg-accent" label="running" />
            <LegendItem colour="border border-border" label="pending" />
            <LegendItem colour="bg-danger" label="failed" />
            <LegendItem colour="bg-border" label="skipped" />
          </div>

          <div className="flex flex-col gap-2.5">
            {runs!.map((run, i) => (
              <details
                key={run.id}
                open={i === 0}
                className={`overflow-hidden rounded-[13px] border bg-surface ${
                  run.status === "running" ? "border-accent-line" : "border-border"
                }`}
              >
                <summary
                  className={`flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:px-5 sm:py-4 ${
                    run.status === "running" ? "bg-accent-soft" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${RUN_STATUS_STYLES[run.status] ?? ""}`}>
                      <span className={`h-2 w-2 rounded-full ${runDotColour(run.status)}`} />
                      {run.status}
                    </span>
                    <span className="font-mono text-[12.5px] text-fg">run_{run.id.slice(0, 6)}</span>
                    <span className="font-mono text-xs text-fg-3">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                  <span className="text-xs text-fg-2">
                    {run.pipeline_run_documents.length} document
                    {run.pipeline_run_documents.length !== 1 ? "s" : ""}
                  </span>
                </summary>

                <div className="border-t border-border-2 px-4 sm:px-5">
                  {/* stage grid */}
                  <div className="overflow-x-auto">
                    <table className="mt-1.5 w-full min-w-[420px] text-xs">
                      <thead>
                        <tr className="border-b border-border-2 font-mono text-[10px] tracking-wide text-fg-3 uppercase">
                          <th className="pb-2 pt-2 text-left font-medium">Document</th>
                          {STAGES.map((s) => (
                            <th key={s.key} className="w-[68px] pb-2 pt-2 text-center font-medium">
                              {s.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {run.pipeline_run_documents.map((prd) => (
                          <tr key={prd.document_version_id} className="border-b border-border-2 last:border-0">
                            <td className="max-w-[220px] truncate py-2.5 pr-4 text-[13px] font-medium text-fg">
                              {prd.document_versions?.documents?.name ?? "—"}
                            </td>
                            {STAGES.map((s) => (
                              <td key={s.key} className="py-2.5 text-center">
                                <StagePip status={prd[s.key] as StageStatus} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* extracted fields */}
                  {run.pipeline_run_documents.map((prd) => {
                    const fields = prd.document_versions?.extraction_results ?? [];
                    if (fields.length === 0) return null;
                    return (
                      <div key={prd.document_version_id} className="py-4">
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-[12.5px] font-semibold text-fg">
                            {prd.document_versions?.documents?.name}
                          </span>
                          <span className="font-mono text-[11px] text-fg-3">
                            · {fields.length} extracted fields
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {fields.map((f) => (
                            <div
                              key={f.field_code}
                              className="rounded-[9px] border border-border bg-surface-2 px-3 py-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10.5px] text-fg-3">{f.field_code}</span>
                              </div>
                              <div className="mt-1 text-[11.5px] leading-tight text-fg-2">{f.field_label}</div>
                              {f.extracted_value ? (
                                <>
                                  <div className="mt-1 truncate text-[13px] font-medium text-fg">
                                    {f.extracted_value}
                                  </div>
                                  <ConfidencePip confidence={f.confidence ?? 0} />
                                </>
                              ) : (
                                <span className="mt-1 block text-[13px] italic text-fg-3">Not extracted</span>
                              )}
                              <ValidationBadges
                                results={(prd.document_versions?.validation_results ?? []).filter(
                                  (v) => v.field_code === f.field_code,
                                )}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LegendItem({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-[11px] w-[11px] rounded-[3px] ${colour}`} />
      {label}
    </span>
  );
}

function runDotColour(status: string): string {
  const map: Record<string, string> = {
    queued: "bg-fg-3",
    running: "bg-accent",
    completed: "bg-success",
    failed: "bg-danger",
  };
  return map[status] ?? "bg-fg-3";
}

function StagePip({ status }: { status: StageStatus }) {
  const glyphs: Record<StageStatus, string> = {
    pending: "",
    running: "●",
    completed: "✓",
    failed: "✕",
    skipped: "–",
  };
  const styles: Record<StageStatus, string> = {
    pending: "border-[1.5px] border-border text-transparent",
    running: "bg-accent text-accent-fg",
    completed: "bg-success text-white",
    failed: "bg-danger text-white",
    skipped: "bg-border text-fg-3",
  };
  return (
    <span
      title={status}
      className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[11px] font-bold ${styles[status]}`}
    >
      {glyphs[status]}
    </span>
  );
}
