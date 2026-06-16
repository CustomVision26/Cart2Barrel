export const HOW_IT_WORKS_ROUTES = {
  overview: "/how-it-works",
  userGuide: "/how-it-works?tab=user-guide",
} as const;

export type HowItWorksTab = "overview" | "user-guide";

export function parseHowItWorksTab(tab: string | string[] | undefined): HowItWorksTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === "user-guide" ? "user-guide" : "overview";
}
