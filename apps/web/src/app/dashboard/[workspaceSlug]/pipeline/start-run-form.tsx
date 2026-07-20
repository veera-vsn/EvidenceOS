"use client";

/**
 * StartRunForm — Client Component for selecting documents and kicking
 * off a new pipeline run.
 *
 * Uses checkboxes (one per uploaded document version) because this is a
 * multi-select operation. The form calls the startPipelineRun Server
 * Action directly and handles the error inline.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { DocumentRow, DocumentVersionRow } from "@/lib/supabase/database.types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

import { startPipelineRun } from "./actions";

export type SelectableDocument = DocumentRow & {
  latest_version: Pick<DocumentVersionRow, "id" | "upload_status" | "version_number"> | null;
};

interface StartRunFormProps {
  workspaceId: string;
  workspaceSlug: string;
  documents: SelectableDocument[];
}

export function StartRunForm({
  workspaceId,
  workspaceSlug,
  documents,
}: StartRunFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const uploadedDocs = documents.filter(
    (d) => d.latest_version?.upload_status === "uploaded",
  );

  function toggle(versionId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await startPipelineRun(
        workspaceId,
        workspaceSlug,
        Array.from(selected),
      );
      if (result.error) {
        setError(result.error);
      } else {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  if (uploadedDocs.length === 0) {
    return (
      <EmptyState
        icon="▷"
        title="No uploaded documents yet"
        description="Upload an ICT vendor contract first — it'll appear here once it's ready to process."
        action={{ label: "Upload a document", href: `/dashboard/${workspaceSlug}/documents` }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[13px] border border-border bg-surface p-5">
      {error && (
        <Alert variant="error" className="mb-3.5">
          {error}
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-fg">Start a new run</div>
          <div className="mt-0.5 text-[12.5px] text-fg-2">
            <strong className="font-semibold text-fg">{selected.size}</strong> of{" "}
            {uploadedDocs.length} uploaded document{uploadedDocs.length !== 1 ? "s" : ""}{" "}
            selected
          </div>
        </div>
        <Button type="submit" disabled={selected.size === 0 || isPending}>
          {isPending ? "Starting…" : "Start pipeline run →"}
        </Button>
      </div>

      <fieldset className="mt-3.5 flex flex-wrap gap-2">
        <legend className="sr-only">Select documents to process</legend>
        {uploadedDocs.map((doc) => {
          const vid = doc.latest_version!.id;
          const checked = selected.has(vid);
          return (
            <label
              key={doc.id}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] transition",
                checked
                  ? "border-accent bg-accent-soft text-fg"
                  : "border-border bg-surface-2 text-fg-2 hover:border-accent-line",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggle(vid)}
              />
              <span
                className={[
                  "flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[4px] border-[1.5px] text-[9px] text-accent-fg",
                  checked ? "border-accent bg-accent" : "border-border",
                ].join(" ")}
              >
                {checked ? "✓" : ""}
              </span>
              {doc.name}
            </label>
          );
        })}
      </fieldset>
    </form>
  );
}
