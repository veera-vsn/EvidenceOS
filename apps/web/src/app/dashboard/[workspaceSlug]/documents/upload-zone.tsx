"use client";

/**
 * UploadZone — drag-and-drop + click-to-browse file upload component.
 *
 * Architecture: two-step protocol.
 *   1. Server Action `initiateUpload` creates the DB rows and returns the
 *      Storage path.
 *   2. Browser uploads directly to Supabase Storage using the anon-key
 *      client (Storage RLS validates workspace membership from the JWT).
 *   3. Server Action `confirmUpload` marks the version 'uploaded'.
 *
 * No external drag-and-drop library — native HTML events keep the bundle
 * small and avoid a dependency we would have to maintain.
 */

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { DocumentType } from "@/lib/supabase/database.types";

import { extensionToDocumentType } from "./document-utils";
import { initiateUpload, confirmUpload, failUpload } from "./actions";

type FileStatus = "queued" | "uploading" | "done" | "failed";

interface FileEntry {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv"];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

interface UploadZoneProps {
  workspaceId: string;
  workspaceSlug: string;
}

export function UploadZone({ workspaceId, workspaceSlug }: UploadZoneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }, []);

  const uploadFile = useCallback(async (entry: FileEntry) => {
    const fileType = extensionToDocumentType(entry.file.name);
    if (!fileType) {
      updateEntry(entry.id, {
        status: "failed",
        error: "Unsupported file type.",
      });
      return;
    }

    updateEntry(entry.id, { status: "uploading" });

    // Step 1: create DB rows.
    const result = await initiateUpload(
      workspaceId,
      entry.file.name,
      fileType as DocumentType,
    );

    if ("error" in result) {
      updateEntry(entry.id, { status: "failed", error: result.error });
      return;
    }

    const { versionId, storagePath } = result;

    // Step 2: upload directly to Supabase Storage.
    const supabase = createClient();
    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, entry.file, { upsert: false });

    if (storageError) {
      await failUpload(versionId);
      updateEntry(entry.id, {
        status: "failed",
        error: storageError.message,
      });
      return;
    }

    // Step 3: confirm in the DB.
    const { error: confirmError } = await confirmUpload(
      versionId,
      entry.file.size,
      workspaceSlug,
    );

    if (confirmError) {
      updateEntry(entry.id, { status: "failed", error: confirmError });
      return;
    }

    updateEntry(entry.id, { status: "done" });
  }, [workspaceId, workspaceSlug, updateEntry]);

  const enqueueFiles = useCallback((files: File[]) => {
    const newEntries: FileEntry[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "queued",
    }));
    setEntries((prev) => [...prev, ...newEntries]);

    // Upload sequentially — avoids saturating the connection and makes
    // per-file progress easy to reason about.
    newEntries.reduce(
      (chain, entry) => chain.then(() => uploadFile(entry)),
      Promise.resolve(),
    ).then(() => router.refresh());
  }, [uploadFile, router]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_EXTENSIONS.some((ext) =>
          f.name.toLowerCase().endsWith(ext),
        ),
      );
      if (files.length) enqueueFiles(files);
    },
    [enqueueFiles],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) enqueueFiles(files);
      // Reset so the same file can be re-picked after a failure.
      e.target.value = "";
    },
    [enqueueFiles],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Drop target */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          // role="button" must activate on both Enter and Space per the
          // WAI-ARIA button convention; Space alone previously just
          // scrolled the page instead (Project_Docs/AUDIT_2026-07-18.md,
          // Accessibility Audit).
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed px-6 py-[30px] text-center transition",
          isDragging
            ? "border-accent bg-accent-soft"
            : "border-border bg-surface-2 hover:border-accent-line",
        ].join(" ")}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-accent-soft text-xl text-accent">
          ↥
        </span>
        <p className="text-[15px] font-semibold text-fg">
          Drop contracts to upload, or <span className="text-accent">browse files</span>
        </p>
        <p className="font-mono text-[12.5px] text-fg-3">
          PDF · DOCX · XLSX · CSV — up to 50 MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={onInputChange}
        />
      </div>

      {/* Per-file status rows */}
      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded-[10px] border border-border bg-surface px-3.5 py-3 text-sm"
            >
              <span className="max-w-[60%] truncate text-fg-2">{entry.file.name}</span>
              <StatusBadge status={entry.status} error={entry.error} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: FileStatus;
  error?: string;
}) {
  if (status === "queued")
    return <span className="font-mono text-xs text-fg-3">Queued</span>;
  if (status === "uploading")
    return <span className="animate-pulse font-mono text-xs text-accent">Uploading…</span>;
  if (status === "done")
    return <span className="font-mono text-xs font-medium text-success">Uploaded</span>;
  return (
    <span className="font-mono text-xs text-danger" title={error}>
      Failed{error ? ` — ${error}` : ""}
    </span>
  );
}
