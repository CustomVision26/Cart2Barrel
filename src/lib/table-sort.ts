export type SortDir = "asc" | "desc";

export function nextSortState<T extends string>(
  currentKey: T,
  currentDir: SortDir,
  clickedKey: T
): { key: T; dir: SortDir } {
  if (currentKey === clickedKey) {
    return { key: clickedKey, dir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { key: clickedKey, dir: "asc" };
}

export function compareLocale(
  a: string,
  b: string,
  dir: SortDir
): number {
  const c = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? c : -c;
}

export function compareNum(a: number, b: number, dir: SortDir): number {
  return dir === "asc" ? a - b : b - a;
}
