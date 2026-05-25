import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");

const replacements = [
  [
    "rounded-lg border border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground",
    "rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground",
  ],
  [
    "rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground",
    "rounded-lg border border-border/80 bg-card px-4 py-6 text-center text-sm text-muted-foreground",
  ],
  [
    "rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground",
    "rounded-lg border border-border/80 bg-card px-4 py-3 text-sm text-muted-foreground",
  ],
  [
    "sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-sm",
    "sticky top-0 z-10 border-b border-border bg-muted",
  ],
  ["border-b border-border bg-muted/40", "border-b border-border bg-muted"],
  ["border-b border-border bg-muted/50", "border-b border-border bg-muted"],
  ["border-b border-border bg-muted/30", "border-b border-border bg-muted"],
  ["border-b border-border bg-muted/20", "border-b border-border bg-muted"],
  ["bg-muted/40 text-xs uppercase", "bg-muted text-xs uppercase"],
  ["bg-muted/40 text-[11px]", "bg-muted text-[11px]"],
  ["bg-muted/40 text-xs text-muted-foreground", "bg-muted text-xs text-muted-foreground"],
  [
    "space-y-3 rounded-lg border border-border bg-muted/10 p-4",
    "space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5",
  ],
  [
    "mb-4 space-y-3 rounded-lg border border-border bg-muted/10 p-4",
    "mb-4 space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5",
  ],
  [
    "rounded-lg border border-border bg-muted/20 p-4",
    "rounded-lg border border-border/80 bg-muted p-4",
  ],
  [
    "space-y-4 rounded-lg border border-border bg-muted/20 p-4",
    "space-y-4 rounded-lg border border-border/80 bg-muted p-4",
  ],
  [
    "rounded-md border border-border/60 bg-muted/20 p-3",
    "rounded-md border border-border/80 bg-muted p-3",
  ],
  [
    "rounded-lg border border-border bg-muted/20 p-3",
    "rounded-lg border border-border/80 bg-muted p-3",
  ],
  ["hover:bg-muted/80", "hover:bg-accent"],
  ["hover:bg-muted/60", "hover:bg-accent"],
  ["hover:bg-muted/50", "hover:bg-accent"],
  ["hover:bg-muted/45", "hover:bg-accent"],
  ["hover:bg-muted/40", "hover:bg-accent"],
  ["hover:bg-muted/35", "hover:bg-accent"],
  ["hover:bg-muted/30", "hover:bg-muted"],
  ["hover:bg-muted/25", "hover:bg-muted"],
  ["hover:bg-muted/20", "hover:bg-muted"],
  ["hover:bg-muted/15", "hover:bg-muted"],
  ["hover:bg-muted/10", "hover:bg-muted"],
  ["expanded && \"bg-muted/40\"", "expanded && \"bg-muted\""],
  ["expanded && \"bg-muted/25\"", "expanded && \"bg-accent\""],
  ["expanded && \"bg-muted/20\"", "expanded && \"bg-muted\""],
  ["<tr className=\"bg-muted/30\">", "<tr className=\"bg-muted\">"],
  ["<tr className=\"bg-muted/10\">", "<tr className=\"bg-secondary\">"],
  ["<tr className=\"bg-muted/15\">", "<tr className=\"bg-secondary\">"],
  ["<tr className=\"bg-muted/5\">", "<tr className=\"bg-muted\">"],
  ["className=\"bg-muted/30\"", "className=\"bg-muted\""],
  ["className=\"bg-muted/50\"", "className=\"bg-muted\""],
  ["className=\"bg-muted/40\"", "className=\"bg-muted\""],
  ["className=\"bg-muted/25\"", "className=\"bg-muted\""],
  ["className=\"bg-muted/20\"", "className=\"bg-muted\""],
  ["className=\"bg-muted/15\"", "className=\"bg-secondary\""],
  ["className=\"bg-muted/10\"", "className=\"bg-muted\""],
  ["odd:bg-muted/15", "odd:bg-secondary"],
  [
    "transition-colors hover:bg-muted/40",
    "transition-colors hover:bg-accent",
  ],
  [
    "bg-background transition-colors hover:bg-muted/40",
    "bg-card transition-colors hover:bg-accent",
  ],
  [
    "cursor-pointer transition-colors hover:bg-muted/30",
    "cursor-pointer transition-colors hover:bg-muted",
  ],
  [
    "cursor-pointer align-top hover:bg-muted/30",
    "cursor-pointer align-top hover:bg-muted",
  ],
  [
    "border-b border-border bg-muted/50 transition-colors hover:bg-muted/60",
    "border-b border-border bg-muted transition-colors hover:bg-accent",
  ],
  ["colSpan={4} className=\"bg-muted/15 p-0\"", "colSpan={4} className=\"bg-secondary p-0\""],
  ["colSpan={7} className=\"bg-muted/15 p-0\"", "colSpan={7} className=\"bg-secondary p-0\""],
  [
    "rounded-md border border-border bg-muted/10 p-2",
    "rounded-md border border-border bg-muted p-2",
  ],
  [
    "rounded-md border border-border bg-muted/10 p-3",
    "rounded-md border border-border bg-muted p-3",
  ],
  [
    "rounded-md border border-border bg-muted/15 p-3",
    "rounded-md border border-border/80 bg-muted p-3",
  ],
  [
    "rounded-lg border border-border bg-muted/10 p-3",
    "rounded-lg border border-border/80 bg-muted p-3",
  ],
  [
    "space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3",
    "space-y-2 rounded-lg border border-border/80 bg-muted p-3",
  ],
  [
    "border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px]",
    "border-b border-border/70 bg-muted px-3 py-2 text-[11px]",
  ],
  [
    "index % 2 === 0 ? \"bg-background/40\" : \"bg-muted/20\"",
    "index % 2 === 0 ? \"bg-card\" : \"bg-muted\"",
  ],
  [
    "rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2",
    "rounded-lg border border-border/70 bg-muted px-2.5 py-2",
  ],
  [
    "rounded-md border border-border/50 bg-background/40",
    "rounded-md border border-border/80 bg-card p-2",
  ],
  [
    "overflow-hidden rounded-lg border border-border bg-muted/10 shadow-sm",
    "overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-foreground/5",
  ],
  [
    "@/lib/dashboard-items-table-surfaces",
    "@/lib/app-table-surfaces",
  ],
  ["bg-muted/35", "bg-accent"],
  ["bg-muted/25", "bg-muted"],
  ["bg-muted/20", "bg-muted"],
  ["bg-muted/15", "bg-secondary"],
  ["bg-muted/10", "bg-muted"],
  ["bg-muted/30", "bg-muted"],
  ["bg-muted/40", "bg-muted"],
  ["bg-muted/50", "bg-muted"],
  ["bg-muted/70", "bg-muted"],
  ["bg-background/80", "bg-card"],
  ["bg-background/70", "bg-card"],
  ["bg-background/65", "bg-card"],
  ["bg-background/60", "bg-card"],
  ["bg-background/40", "bg-card"],
  [
    "divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/10",
    "divide-y divide-border/60 rounded-lg border border-border/70 bg-muted",
  ],
  [
    "border-b border-border bg-muted/10 px-4 py-3",
    "border-b border-border bg-muted px-4 py-3",
  ],
  [
    "border-b border-border bg-muted/15 px-4 py-3",
    "border-b border-border bg-secondary px-4 py-3",
  ],
  [
    "flex w-full items-center gap-2 border-b border-border bg-muted/25 px-3 py-3",
    "flex w-full items-center gap-2 border-b border-border bg-muted px-3 py-3",
  ],
  ["trackExpanded && \"bg-muted/20\"", "trackExpanded && \"bg-muted\""],
  [
    "rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm",
    "rounded-lg border border-border/80 bg-muted px-4 py-3 text-sm",
  ],
  [
    "rounded-md border border-border bg-muted/30 px-2.5 py-2 text-sm",
    "rounded-md border border-border/80 bg-muted px-2.5 py-2 text-sm",
  ],
  [
    "rounded-md border border-border bg-muted/30 p-3",
    "rounded-md border border-border/80 bg-muted p-3",
  ],
  [
    "rounded-lg border border-border bg-muted/30 p-3 text-sm",
    "rounded-lg border border-border/80 bg-muted p-3 text-sm",
  ],
  [
    "space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm",
    "space-y-3 rounded-lg border border-border/80 bg-muted p-3 text-sm",
  ],
  [
    "flex flex-col gap-4 rounded-lg border border-border bg-muted/20 p-4",
    "flex flex-col gap-4 rounded-lg border border-border/80 bg-muted p-4",
  ],
  [
    "flex flex-wrap items-center gap-3 bg-muted/25 px-3 py-3",
    "flex flex-wrap items-center gap-3 border-b border-border bg-muted px-3 py-3",
  ],
  [
    "rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6",
    "rounded-lg border border-dashed border-border/80 bg-muted px-4 py-6",
  ],
  [
    "space-y-4 rounded-xl border border-border/80 bg-muted/15 p-4",
    "space-y-4 rounded-xl border border-border/80 bg-secondary p-4",
  ],
  [
    'viewportClassName="rounded-lg border border-border"',
    'viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5"',
  ],
  [
    'viewportClassName="rounded-md border border-border"',
    'viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5"',
  ],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
  }
  return files;
}

let changedFiles = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    changedFiles += 1;
  }
}

console.log(`Updated ${changedFiles} files.`);
