/** Jamaica — civil parishes commonly used on local addresses */
export const JAMAICA_PARISHES = [
  "Clarendon",
  "Hanover",
  "Kingston",
  "Manchester",
  "Portland",
  "St. Andrew",
  "St. Ann",
  "St. Catherine",
  "St. Elizabeth",
  "St. James",
  "St. Mary",
  "St. Thomas",
  "Trelawny",
  "Westmoreland",
] as const;

export type JamaicaParish = (typeof JAMAICA_PARISHES)[number];
