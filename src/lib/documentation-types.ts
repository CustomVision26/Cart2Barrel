export type DocumentationView = "quick" | "article";

export type DocumentationQuickReference = {
  summary: string;
  location: string;
  bullets: string[];
  requirements: string[];
  dos: string[];
  donts: string[];
};

export type DocumentationArticle = {
  overview: string[];
  walkthrough: string[];
  notes?: string[];
  requirements: string[];
  dos: string[];
  donts: string[];
};

export type DocumentationSection = {
  id: string;
  title: string;
  category: string;
  quickReference: DocumentationQuickReference;
  article: DocumentationArticle;
};

export function getDocumentationByCategory<T extends string>(
  categories: readonly T[],
  sections: DocumentationSection[],
): Record<T, DocumentationSection[]> {
  const grouped = {} as Record<T, DocumentationSection[]>;
  for (const category of categories) {
    grouped[category] = sections.filter((section) => section.category === category);
  }
  return grouped;
}
