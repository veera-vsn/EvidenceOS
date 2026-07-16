/**
 * ESMA template grouping for the DORA fields.
 *
 * Nothing in the schema encodes this grouping — extraction_results and
 * validation_results are flat, keyed only by field_code — so the review UI
 * needs its own mapping to section fields the way a compliance analyst
 * already thinks about them (by ESMA RT template), rather than as one flat
 * list.
 *
 * Mirrors apps/api/app/pipeline/export.py's `_GROUP_LABELS` — the RT code
 * and prefix for each group are derived programmatically from this map's
 * keys rather than hand-duplicated, so adding a table (Full RoI Stage 2)
 * needs one new entry here, not a second hand-copied array kept in sync
 * with a closed union type as before.
 */

export interface FieldGroup {
  code: string; // "RT.02.01", or the OTHER_GROUP sentinel below
  label: string;
  prefix: string;
}

// A field code that doesn't match any real group's prefix — e.g. a stale
// code from a previous catalogue version still sitting on an old
// extraction_results row. Deliberately a distinct sentinel, not one of the
// real codes below: reusing a real code here would silently merge orphaned
// fields into that group's count instead of surfacing them as the "Other"
// bucket they actually are.
export const OTHER_GROUP: FieldGroup = { code: "OTHER", label: "Other", prefix: "" };

// Real EBA DPM 4.0 table groupings, verified against EBA's own "Data Model
// for DORA RoI" and "Annotated Table Layout — DORA 4.0" references — not
// RT.01.01/RT.03.01 as an earlier, incorrect version of this catalogue
// assumed. See Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md and
// Project_Docs/Learnings/Phase_9_Full_RoI_Stage1/.
const GROUP_LABELS: Record<string, string> = {
  "b_02.01": "Contractual arrangements — general",
  "b_02.02": "Contractual arrangements — specific",
  "b_05.01": "ICT third-party providers",
  "b_06.01": "Functions identification",
  // Full RoI Stage 2A (Project_Docs/Learnings/Phase_10_Full_RoI_Stage2A/).
  "b_05.02": "ICT service supply chains",
  "b_07.01": "Assessment of ICT services",
};

/** "b_02.01" -> "RT.02.01" */
function rtCodeForPrefix(prefix: string): string {
  return "RT." + prefix.slice(2);
}

export const DORA_FIELD_GROUPS: FieldGroup[] = Object.entries(GROUP_LABELS).map(
  ([prefix, label]) => ({ code: rtCodeForPrefix(prefix), label, prefix }),
);

export function groupForFieldCode(fieldCode: string): FieldGroup {
  return DORA_FIELD_GROUPS.find((g) => fieldCode.startsWith(g.prefix)) ?? OTHER_GROUP;
}
