import type { DocumentType } from "@/lib/supabase/database.types";

/** Map a file extension to the document_type enum value. */
export function extensionToDocumentType(filename: string): DocumentType | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, DocumentType> = {
    pdf: "pdf",
    docx: "docx",
    xlsx: "xlsx",
    csv: "csv",
  };
  return ext ? (map[ext] ?? null) : null;
}
