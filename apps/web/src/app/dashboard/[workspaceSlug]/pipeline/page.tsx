/**
 * `/dashboard/[workspaceSlug]/pipeline` — pipeline runs view.
 *
 * Three panels:
 *   1. Start a new run — select uploaded documents, click "Start".
 *   2. Run history — list of all pipeline_runs with stage status grid.
 *   3. Extracted fields — DORA RoI fields pulled from each document.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  DocumentRow,
  DocumentVersionRow,
  ExtractionResultRow,
  PipelineRunRow,
  PipelineRunDocumentRow,
  StageStatus,
} from "@/lib/supabase/database.types";

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
          extraction_results ( field_code, field_label, extracted_value, confidence )
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
          } | null;
        })[];
      })[]
    >();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-10">
      {/* Start new run */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-foreground/60">
            Select uploaded documents and start a processing run. Each run is
            independently tracked so you can compare extraction results across
            versions.
          </p>
        </div>
        <StartRunForm
          workspaceId={workspace.id}
          workspaceSlug={workspaceSlug}
          documents={selectableDocs}
        />
      </section>

      {/* Run history */}
      {(runs?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-foreground/70">Run history</h2>
          <ul className="flex flex-col gap-6">
            {runs!.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4"
              >
                {/* Run header */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-foreground/40">
                      {run.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-foreground/50">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                  <RunStatusBadge status={run.status} />
                </div>

                {/* Per-document stage grid */}
                {run.pipeline_run_documents.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-foreground/10">
                        <th className="pb-1 text-left font-medium text-foreground/50">
                          Document
                        </th>
                        {STAGES.map((s) => (
                          <th key={s.key} className="pb-1 text-center font-medium text-foreground/50">
                            {s.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {run.pipeline_run_documents.map((prd) => (
                        <tr
                          key={prd.document_version_id}
                          className="border-b border-foreground/5 last:border-0"
                        >
                          <td className="py-1.5 pr-4 text-foreground/80 truncate max-w-[160px]">
                            {prd.document_versions?.documents?.name ?? "—"}
                          </td>
                          {STAGES.map((s) => (
                            <td key={s.key} className="py-1.5 text-center">
                              <StagePip status={prd[s.key] as StageStatus} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Extracted DORA fields */}
                {run.pipeline_run_documents.map((prd) => {
                  const fields = (prd.document_versions?.extraction_results ?? []).filter(
                    (f) => f.extracted_value,
                  );
                  if (fields.length === 0) return null;
                  return (
                    <div key={prd.document_version_id} className="flex flex-col gap-2">
                      <p className="text-xs font-medium text-foreground/50">
                        Extracted fields —{" "}
                        <span className="text-foreground/70">
                          {prd.document_versions?.documents?.name}
                        </span>
                      </p>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {fields.map((f) => (
                          <div
                            key={f.field_code}
                            className="flex flex-col gap-0.5 rounded-lg border border-foreground/8 bg-foreground/[0.015] px-3 py-2"
                          >
                            <span className="font-mono text-[10px] text-foreground/35">
                              {f.field_code}
                            </span>
                            <span className="text-xs text-foreground/60">{f.field_label}</span>
                            <span className="text-xs font-medium text-foreground/90">
                              {f.extracted_value}
                            </span>
                            <ConfidencePip confidence={f.confidence ?? 0} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RunStatusBadge({ status }: { status: PipelineRunRow["status"] }) {
  const styles: Record<string, string> = {
    queued: "bg-foreground/10 text-foreground/60",
    running: "bg-warning/15 text-warning",
    completed: "bg-success/15 text-success",
    failed: "bg-danger/15 text-danger",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

function StagePip({ status }: { status: StageStatus }) {
  const icons: Record<StageStatus, string> = {
    pending: "○",
    running: "◑",
    completed: "●",
    failed: "✕",
    skipped: "—",
  };
  const colours: Record<StageStatus, string> = {
    pending: "text-foreground/25",
    running: "text-warning",
    completed: "text-success",
    failed: "text-danger",
    skipped: "text-foreground/25",
  };
  return (
    <span className={`text-sm ${colours[status]}`} title={status}>
      {icons[status]}
    </span>
  );
}

function ConfidencePip({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const colour =
    pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger";
  return (
    <span className={`text-[10px] ${colour}`}>
      {pct}% confidence
    </span>
  );
}
