# generate-cursor-rule

Use this command to **regenerate or align** Cart2Barrel Cursor rules (`.cursor/rules/*.mdc`) and conventions. When invoked:

1. Ensure project rules exist and match the stack below.
2. Prefer **shadcn/ui** for all UI; if the CLI is missing, initialize or add components with the commands in the **shadcn** section—do not hand-roll primitives that shadcn already provides.
3. **Never** write real database URLs, API keys, or Clerk secrets into rules, commands, or committed files—only `process.env` / `.env` placeholders.

---

## Stack summary (Cart2Barrel)

| Area | Convention |
|------|------------|
| UI | **shadcn/ui** for all interactive and layout UI |
| Typography | **Poppins** app-wide; no **Geist Mono** as the global/default font |
| Theme | **Dark mode by default** for the whole app |
| Auth | **Clerk only** for end-user authentication; sign-in / sign-up entry points built with **shadcn** and should open as **modals**, not only full-page flows unless Clerk configuration requires otherwise |
| Authorization | Users may **only** access data that belongs to them: server-side Clerk user id on every query/mutation for user-owned rows; never trust client-supplied user ids for ownership |
| Clerk | Appearance and embedded/hosted UI should **match dark mode** |
| Database | **PostgreSQL on Neon** + **Drizzle ORM** (`neon-http`); connection string **only** in `.env` as `DATABASE_URL` |
| Data loading | **Server Components** for retrieving data to render (Drizzle/`getDb()` via RSC or shared server helpers—not client as the primary read path) |
| Mutations | **Server Actions** only for **insert / update / delete** to the database |
| Validation | **Zod** at validation boundaries; Server Action payloads validated with Zod and typed (e.g. `z.infer<typeof schema>`)—**never** use **`FormData` as the TypeScript type** for the action argument |

**Database access:** All persistence **must** go through **Drizzle**—tables/columns defined in `src/db/schema.ts`, reads/writes via **`getDb()`** and Drizzle’s query API (`db.select`, `db.insert`, `db.update`, `db.delete`, `eq`, etc.) or relational helpers. **Do not** use the Neon/`pg` client for ad‑hoc SQL in app code, raw string SQL in server actions/API routes, or ORMs other than Drizzle. (Generated SQL from **`drizzle-kit`** migrations/push is fine.)

---

## shadcn/ui

If shadcn is not initialized:

```bash
npx shadcn@latest init
```

To add a component (example: Button):

```bash
npx shadcn@latest add button
```

Use the registry component names from the shadcn docs; compose UIs from installed components first.

---

## Follow-up chat prompts (copy when starting a focused task)

**Fonts (`src/app/layout.tsx`)**

- `@src/app/layout.tsx update the font for this project to poppins`
- `remove the Geist Mono font family and also make sure the poppins font is applied for the entire app`

**Dark mode**

- `make sure dark mode is displayed by default for the entire app`

**Clerk + UI**

- After Clerk is installed: `make sure that all clerk sign in and sign up button display as a modal` (use shadcn **Dialog** / **Drawer** or Clerk’s modal patterns as appropriate)

**Clerk appearance**

- `make sure Clerk displays in dark mode`

**Clerk + data isolation**

- *All auth is Clerk; enforce that users can only access their own data:* owner column from session, scope every Drizzle query by authenticated `userId`, verify resource id + owner on updates/deletes, 404 when not owned.

**RSC + Server Actions + Zod**

- *Align data flow:* reads in **Server Components**; all DB **writes** in **Server Actions**; validate with **Zod**; action args typed from Zod—**not** `FormData` as the parameter type (parse form fields into an object, then `schema.parse`).

**Drizzle + Neon**

- Sign up at Neon, create a project, copy the connection string into **local** `.env` only as `DATABASE_URL=` (never paste the real URL into rules, README, or chat logs you would commit).
- **Every** DB interaction in application code uses **Drizzle schema + queries** (`src/db/schema.ts`, `getDb()`, Drizzle builders). No parallel query layers.
- Example request to the agent: *Install Drizzle ORM; connect to Postgres on Neon using `DATABASE_URL` from `.env`. Follow Drizzle’s “Get Started with Drizzle and Neon” guide: `drizzle-orm` + `@neondatabase/serverless` + `dotenv`; dev deps `drizzle-kit` + `tsx`; `drizzle.config.ts`; `src/db/schema.ts`; `drizzle/` for migrations; use `drizzle-orm/neon-http` and `neon()` client; push with `npx drizzle-kit push` or generate/migrate as documented.*

Scripts:

```bash
npm i drizzle-orm @neondatabase/serverless dotenv
npm i -D drizzle-kit tsx
```

```bash
npx drizzle-kit push
# or: npx drizzle-kit generate && npx drizzle-kit migrate
```

```bash
npx tsx src/index.ts
```

This command will be available in chat with **/generate-cursor-rule**.
