"use client";

import { useTransition } from "react";

import { deleteDocument } from "./actions";

interface DeleteDocumentButtonProps {
  documentId: string;
  workspaceSlug: string;
}

export function DeleteDocumentButton({
  documentId,
  workspaceSlug,
}: DeleteDocumentButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteDocument(documentId, workspaceSlug);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Delete document"
      className="rounded-md p-1.5 text-fg-3 transition-colors hover:bg-danger-soft hover:text-danger disabled:pointer-events-none disabled:opacity-40"
    >
      {isPending ? (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      )}
    </button>
  );
}
