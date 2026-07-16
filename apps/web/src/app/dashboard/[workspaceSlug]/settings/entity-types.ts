/**
 * EBA's real "Type of entity" dropdown values for B_01.01 column 0040 —
 * a closed 22-value enum (workbook "List of possible values..." sheet
 * B0101), not free text. One source of truth used by both the form's
 * <select> options and the Server Action's server-side validation.
 */

export const ENTITY_TYPES = [
  "Credit institutions",
  "Investment firms",
  "Payment institution",
  "Electronic money institutions",
  "Account information service providers",
  "Insurance and reinsurance undertakings",
  "Insurance intermediaries, reinsurance intermediaries and ancillary insurance intermediaries",
  "Institutions for occupational retirement provision",
  "Credit rating agency",
  "Managers of alternative investment funds",
  "Asset management companies",
  "Trading venues",
  "Central counterparties (CCPs)",
  "Central security depository",
  "Trade repositories",
  "Data reporting service providers",
  "Crypto-asset service providers",
  "Issuers of asset-referenced tokens",
  "Crowdfunding service providers",
  "Securitisation repository",
  "Administrator of critical benchmarks",
  "Other financial entity",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
