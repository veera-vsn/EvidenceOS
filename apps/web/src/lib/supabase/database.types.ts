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
      workspace_role: "owner" | "admin" | "reviewer" | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type WorkspaceRole = Database["public"]["Enums"]["workspace_role"];
export type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type WorkspaceMemberRow =
  Database["public"]["Tables"]["workspace_members"]["Row"];
