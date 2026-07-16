/**
 * ESMA template grouping for the 13 DORA fields.
 *
 * Nothing in the schema encodes this grouping — extraction_results and
 * validation_results are flat, keyed only by field_code — so the review UI
 * needs its own mapping to section fields the way a compliance analyst
 * already thinks about them (by ESMA RT template), rather than as one flat
 * list of 13.
 */

export interface FieldGroup {
  code: "RT.02.01" | "RT.02.02" | "RT.05.01" | "RT.06.01" | "OTHER";
  label: string;
  prefix: string;
}

// A field code that doesn't match any real group's prefix — e.g. a stale
// code from a previous catalogue version still sitting on an old
// extraction_results row. Deliberately a distinct sentinel, not one of the
// four real codes above: reusing a real code here would silently merge
// orphaned fields into that group's count instead of surfacing them as
// the "Other" bucket they actually are.
export const OTHER_GROUP: FieldGroup = { code: "OTHER", label: "Other", prefix: "" };

// Real EBA DPM 4.0 table groupings, verified against EBA's own "Annotated
// Table Layout — DORA 4.0" reference — not RT.01.01/RT.03.01 as an earlier,
// incorrect version of this catalogue assumed. See
// Project_Docs/Learnings/Phase_4_Validation/CHALLENGES.md.
export const DORA_FIELD_GROUPS: FieldGroup[] = [
  { code: "RT.02.01", label: "Contractual arrangements — general", prefix: "b_02.01" },
  { code: "RT.02.02", label: "Contractual arrangements — specific", prefix: "b_02.02" },
  { code: "RT.05.01", label: "ICT third-party providers", prefix: "b_05.01" },
  { code: "RT.06.01", label: "Functions identification", prefix: "b_06.01" },
];

export function groupForFieldCode(fieldCode: string): FieldGroup {
  return DORA_FIELD_GROUPS.find((g) => fieldCode.startsWith(g.prefix)) ?? OTHER_GROUP;
}
