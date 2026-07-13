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
      next.has(versionId) ? next.delete(versionId) : next.add(versionId);
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
      <p className="text-sm text-foreground/50">
        No uploaded documents yet.{" "}
        <a
          href={`/dashboard/${workspaceSlug}/documents`}
          className="underline hover:text-foreground"
        >
          Upload documents first.
        </a>
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground/70 mb-1">
          Select documents to process
        </legend>
        {uploadedDocs.map((doc) => {
          const vid = doc.latest_version!.id;
          const checked = selected.has(vid);
          return (
            <label
              key={doc.id}
              className={[
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                checked
                  ? "border-foreground/30 bg-foreground/5"
                  : "border-foreground/10 hover:border-foreground/20",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="accent-foreground"
                checked={checked}
                onChange={() => toggle(vid)}
              />
              <span className="flex-1 font-medium truncate">{doc.name}</span>
              <span className="font-mono text-xs uppercase text-foreground/40">
                {doc.file_type} · v{doc.latest_version!.version_number}
              </span>
            </label>
          );
        })}
      </fieldset>

      <button
        type="submit"
        disabled={selected.size === 0 || isPending}
        className="self-start rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
      >
        {isPending
          ? "Starting…"
          : `Start pipeline run${selected.size > 0 ? ` (${selected.size})` : ""}`}
      </button>
    </form>
  );
}
