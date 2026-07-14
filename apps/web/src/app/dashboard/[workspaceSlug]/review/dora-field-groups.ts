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
  code: "RT.01.01" | "RT.02.01" | "RT.03.01";
  label: string;
  prefix: string;
}

export const DORA_FIELD_GROUPS: FieldGroup[] = [
  { code: "RT.01.01", label: "Contractual arrangements", prefix: "b_01.01" },
  { code: "RT.02.01", label: "ICT third-party providers", prefix: "b_02.01" },
  { code: "RT.03.01", label: "Outsourced functions", prefix: "b_03.01" },
];

export function groupForFieldCode(fieldCode: string): FieldGroup {
  return (
    DORA_FIELD_GROUPS.find((g) => fieldCode.startsWith(g.prefix)) ?? {
      code: "RT.01.01",
      label: "Other",
      prefix: "",
    }
  );
}
