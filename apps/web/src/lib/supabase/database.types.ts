/**
 * Generated TypeScript types for the Supabase Postgres schema.
 *
 * DO NOT EDIT BY HAND. Regenerate via the Supabase MCP:
 *   generate_typescript_types(project_id="skqhmivmnrksypoxnoaq")
 *
 * Any change to `supabase/migrations/*.sql` should be followed by a
 * fresh regeneration and a commit that touches only this file.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      document_text: {
        Row: {
          content: string;
          document_version_id: string;
          extracted_at: string;
          extractor: string;
          id: string;
          word_count: number;
        };
        Insert: {
          content: string;
          document_version_id: string;
          extracted_at?: string;
          extractor: string;
          id?: string;
          word_count?: number;
        };
        Update: {
          content?: string;
          document_version_id?: string;
          extracted_at?: string;
          extractor?: string;
          id?: string;
          word_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_text_document_version_id_fkey";
            columns: ["document_version_id"];
            isOneToOne: true;
            referencedRelation: "document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      document_versions: {
        Row: {
          checksum: string | null;
          created_at: string;
          document_id: string;
          id: string;
          size_bytes: number | null;
          storage_path: string;
          upload_status: Database["public"]["Enums"]["upload_status"];
          uploaded_by: string;
          version_number: number;
        };
        Insert: {
          checksum?: string | null;
          created_at?: string;
          document_id: string;
          id?: string;
          size_bytes?: number | null;
          storage_path: string;
          upload_status?: Database["public"]["Enums"]["upload_status"];
          uploaded_by: string;
          version_number: number;
        };
        Update: {
          checksum?: string | null;
          created_at?: string;
          document_id?: string;
          id?: string;
          size_bytes?: number | null;
          storage_path?: string;
          upload_status?: Database["public"]["Enums"]["upload_status"];
          uploaded_by?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          created_by: string;
          file_type: Database["public"]["Enums"]["document_type"];
          id: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          file_type: Database["public"]["Enums"]["document_type"];
          id?: string;
          name: string;
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          file_type?: Database["public"]["Enums"]["document_type"];
          id?: string;
          name?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      extraction_results: {
        Row: {
          confidence: number | null;
          document_version_id: string;
          extracted_at: string;
          extracted_value: string | null;
          extraction_method: string;
          field_code: string;
          field_label: string;
          id: string;
        };
        Insert: {
          confidence?: number | null;
          document_version_id: string;
          extracted_at?: string;
          extracted_value?: string | null;
          extraction_method?: string;
          field_code: string;
          field_label: string;
          id?: string;
        };
        Update: {
          confidence?: number | null;
          document_version_id?: string;
          extracted_at?: string;
          extracted_value?: string | null;
          extraction_method?: string;
          field_code?: string;
          field_label?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extraction_results_document_version_id_fkey";
            columns: ["document_version_id"];
            isOneToOne: false;
            referencedRelation: "document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_run_documents: {
        Row: {
          created_at: string;
          document_version_id: string;
          extraction_status: Database["public"]["Enums"]["stage_status"];
          normalisation_status: Database["public"]["Enums"]["stage_status"];
          ocr_status: Database["public"]["Enums"]["stage_status"];
          pipeline_run_id: string;
          recommendation_status: Database["public"]["Enums"]["stage_status"];
          updated_at: string;
          validation_status: Database["public"]["Enums"]["stage_status"];
        };
        Insert: {
          created_at?: string;
          document_version_id: string;
          extraction_status?: Database["public"]["Enums"]["stage_status"];
          normalisation_status?: Database["public"]["Enums"]["stage_status"];
          ocr_status?: Database["public"]["Enums"]["stage_status"];
          pipeline_run_id: string;
          recommendation_status?: Database["public"]["Enums"]["stage_status"];
          updated_at?: string;
          validation_status?: Database["public"]["Enums"]["stage_status"];
        };
        Update: {
          created_at?: string;
          document_version_id?: string;
          extraction_status?: Database["public"]["Enums"]["stage_status"];
          normalisation_status?: Database["public"]["Enums"]["stage_status"];
          ocr_status?: Database["public"]["Enums"]["stage_status"];
          pipeline_run_id?: string;
          recommendation_status?: Database["public"]["Enums"]["stage_status"];
          updated_at?: string;
          validation_status?: Database["public"]["Enums"]["stage_status"];
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_run_documents_document_version_id_fkey";
            columns: ["document_version_id"];
            isOneToOne: false;
            referencedRelation: "document_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pipeline_run_documents_pipeline_run_id_fkey";
            columns: ["pipeline_run_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      pipeline_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["pipeline_run_status"];
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["pipeline_run_status"];
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["pipeline_run_status"];
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      validation_results: {
        Row: {
          document_version_id: string;
          field_code: string;
          id: string;
          message: string | null;
          rule_id: string;
          rule_label: string;
          status: string;
          validated_at: string;
        };
        Insert: {
          document_version_id: string;
          field_code: string;
          id?: string;
          message?: string | null;
          rule_id: string;
          rule_label: string;
          status: string;
          validated_at?: string;
        };
        Update: {
          document_version_id?: string;
          field_code?: string;
          id?: string;
          message?: string | null;
          rule_id?: string;
          rule_label?: string;
          status?: string;
          validated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_results_document_version_id_fkey";
            columns: ["document_version_id"];
            isOneToOne: false;
            referencedRelation: "document_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          joined_at: string;
          role: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          joined_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          joined_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_workspace_role: {
        Args: {
          required_role: Database["public"]["Enums"]["workspace_role"];
          target_workspace_id: string;
        };
        Returns: boolean;
      };
      is_workspace_member: {
        Args: { target_workspace_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      document_type: "pdf" | "docx" | "xlsx" | "csv";
      pipeline_run_status: "queued" | "running" | "completed" | "failed";
      stage_status: "pending" | "running" | "completed" | "failed" | "skipped";
      upload_status: "uploading" | "uploaded" | "failed";
      workspace_role: "owner" | "admin" | "reviewer" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---------------------------------------------------------------------------
// Convenience row-type aliases — import these in components instead of the
// verbose Database["public"]["Tables"]["foo"]["Row"] path.
// ---------------------------------------------------------------------------

export type WorkspaceRole   = Database["public"]["Enums"]["workspace_role"];
export type DocumentType    = Database["public"]["Enums"]["document_type"];
export type UploadStatus    = Database["public"]["Enums"]["upload_status"];
export type PipelineRunStatus = Database["public"]["Enums"]["pipeline_run_status"];
export type StageStatus     = Database["public"]["Enums"]["stage_status"];
// validation_results.status has no Postgres enum (checked via a CHECK
// constraint instead), so the allowed values are declared by hand here.
export type ValidationStatus = "pass" | "fail" | "warning" | "skipped";

export type WorkspaceRow          = Database["public"]["Tables"]["workspaces"]["Row"];
export type ProfileRow            = Database["public"]["Tables"]["profiles"]["Row"];
export type WorkspaceMemberRow    = Database["public"]["Tables"]["workspace_members"]["Row"];
export type DocumentRow           = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentVersionRow    = Database["public"]["Tables"]["document_versions"]["Row"];
export type PipelineRunRow        = Database["public"]["Tables"]["pipeline_runs"]["Row"];
export type PipelineRunDocumentRow = Database["public"]["Tables"]["pipeline_run_documents"]["Row"];
export type DocumentTextRow        = Database["public"]["Tables"]["document_text"]["Row"];
export type ExtractionResultRow    = Database["public"]["Tables"]["extraction_results"]["Row"];
export type ValidationResultRow    = Database["public"]["Tables"]["validation_results"]["Row"];
