import type { DocumentationSection } from "@/lib/documentation-types";
import type {
  DocumentationContentEntry,
  UiSurfaceDefinition,
} from "@/lib/documentation/ui-surface-types";

export class DocumentationSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentationSyncError";
  }
}

/** Fail fast when registry and content drift apart (run in CI via `npm run docs:validate`). */
export function assertDocumentationSync(
  surfaces: UiSurfaceDefinition[],
  contentById: Record<string, DocumentationContentEntry>,
  label: string,
): void {
  const surfaceIds = new Set(surfaces.map((surface) => surface.id));
  const contentIds = new Set(Object.keys(contentById));

  const missingContent = [...surfaceIds].filter((id) => !contentIds.has(id));
  if (missingContent.length > 0) {
    throw new DocumentationSyncError(
      `[${label}] Missing documentation content for UI surfaces: ${missingContent.join(", ")}. ` +
        "Add entries to the content record when you add nav links or pages.",
    );
  }

  const orphanContent = [...contentIds].filter((id) => !surfaceIds.has(id));
  if (orphanContent.length > 0) {
    throw new DocumentationSyncError(
      `[${label}] Documentation content without UI surface registry entry: ${orphanContent.join(", ")}. ` +
        "Remove stale content or add a surface definition in the registry.",
    );
  }

  for (const surface of surfaces) {
    if (!surface.route.trim()) {
      throw new DocumentationSyncError(
        `[${label}] Surface "${surface.id}" is missing a route.`,
      );
    }
    if (!surface.location.trim()) {
      throw new DocumentationSyncError(
        `[${label}] Surface "${surface.id}" is missing a location string.`,
      );
    }
  }
}

const SURFACE_ORDER = new Map<string, number>();

function indexSurfaces(surfaces: UiSurfaceDefinition[]): void {
  surfaces.forEach((surface, index) => {
    SURFACE_ORDER.set(surface.id, index);
  });
}

/** Merge registry metadata (title, category, location) into guide sections. */
export function buildDocumentationSections(
  surfaces: UiSurfaceDefinition[],
  contentById: Record<string, DocumentationContentEntry>,
): DocumentationSection[] {
  indexSurfaces(surfaces);

  return surfaces
    .map((surface) => {
      const content = contentById[surface.id];
      if (!content) return null;

      return {
        id: surface.id,
        title: surface.title,
        category: surface.category,
        quickReference: {
          summary: content.quickReference.summary,
          location: content.quickReference.location ?? surface.location,
          bullets: content.quickReference.bullets,
          requirements: content.quickReference.requirements,
          dos: content.quickReference.dos,
          donts: content.quickReference.donts,
        },
        article: content.article,
      } satisfies DocumentationSection;
    })
    .filter((section): section is DocumentationSection => section !== null)
    .sort(
      (a, b) =>
        (SURFACE_ORDER.get(a.id) ?? 0) - (SURFACE_ORDER.get(b.id) ?? 0),
    );
}

export function assertSidebarNavMatchesSurfaces(
  navLinks: { docId: string; href: string; label: string }[],
  surfaces: UiSurfaceDefinition[],
  label: string,
): void {
  for (const link of navLinks) {
    const surface = surfaces.find((item) => item.id === link.docId);
    if (!surface) {
      throw new DocumentationSyncError(
        `[${label}] Sidebar link docId "${link.docId}" has no UI surface registry entry.`,
      );
    }
    if (surface.route !== link.href) {
      throw new DocumentationSyncError(
        `[${label}] Sidebar href mismatch for "${link.docId}": nav uses "${link.href}" but registry has "${surface.route}".`,
      );
    }
    if (surface.navLabel && surface.navLabel !== link.label) {
      throw new DocumentationSyncError(
        `[${label}] Sidebar label mismatch for "${link.docId}": nav uses "${link.label}" but registry has "${surface.navLabel}".`,
      );
    }
  }
}
