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

import {
  initiateUpload,
  confirmUpload,
  failUpload,
  extensionToDocumentType,
} from "./actions";

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

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }

  async function uploadFile(entry: FileEntry) {
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
  }

  function enqueueFiles(files: File[]) {
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
  }

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
    [workspaceId, workspaceSlug],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) enqueueFiles(files);
      // Reset so the same file can be re-picked after a failure.
      e.target.value = "";
    },
    [workspaceId, workspaceSlug],
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
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
          isDragging
            ? "border-foreground/40 bg-foreground/5"
            : "border-foreground/15 hover:border-foreground/30 hover:bg-foreground/[0.02]",
        ].join(" ")}
      >
        <div className="text-2xl">↑</div>
        <p className="text-sm font-medium text-foreground/80">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-foreground/50">
          PDF · DOCX · XLSX · CSV — max 50 MB each
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
              className="flex items-center justify-between rounded-lg border border-foreground/10 px-3 py-2 text-sm"
            >
              <span className="truncate text-foreground/80 max-w-[60%]">
                {entry.file.name}
              </span>
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
    return <span className="text-foreground/40">Queued</span>;
  if (status === "uploading")
    return <span className="text-foreground/60 animate-pulse">Uploading…</span>;
  if (status === "done")
    return <span className="text-success font-medium">Uploaded</span>;
  return (
    <span className="text-danger" title={error}>
      Failed{error ? ` — ${error}` : ""}
    </span>
  );
}
