# 02 — Frontend scaffold walkthrough

Every file inside `apps/web/` explained. Read top-to-bottom.

---

## `package.json` — the manifest

```json
{
  "name": "web",
  "scripts": {
    "dev": "next dev",        // hot-reloading dev server on :3000
    "build": "next build",    // production build (SSR + static assets)
    "start": "next start",    // run the production build
    "lint": "eslint"          // Next's opinionated lint config
  },
  "dependencies": {
    "next": "16.2.10",        // App Router, Server Components
    "react": "19.2.4",        // Server Components require React 19
    "react-dom": "19.2.4"
  }
}
```

**What to notice:**
- No runtime dependencies beyond React + Next. That is intentional — we add libraries only when the code needs them, not preemptively.
- `next` version is 16.x (not the 14.x we said in the roadmap). `create-next-app@latest` moved on; that is fine, all the App Router concepts we planned still apply.

---

## `tsconfig.json` — TypeScript config

Key options and *why*:

| Option | Value | Why |
|---|---|---|
| `strict` | `true` | Turns on `strictNullChecks`, `noImplicitAny`, etc. Non-negotiable for regulated software |
| `moduleResolution` | `bundler` | Modern Node/Next resolution — supports package `exports`, `.tsx`, etc. |
| `isolatedModules` | `true` | Each file must be independently compilable — required by esbuild/SWC |
| `jsx` | `react-jsx` | React 17+ JSX transform (no `import React` needed) |
| `paths` | `{ "@/*": ["./src/*"] }` | Absolute imports — `@/lib/api` instead of `../../../lib/api` |
| `noEmit` | `true` | Next handles compilation; `tsc` is used only for type-checking in CI |

**Interview Q:** *"Why not looser TypeScript settings to move faster?"*
**A:** Every escape hatch (`any`, `!`, `as`) is a place where the type system stops helping. In a compliance product, "field is missing at runtime" is a customer incident. Strict mode makes the compiler catch these at PR time, not at 3 a.m.

---

## `next.config.ts`

Currently empty. Places we'll add config later:
- Image domains (Phase 5 — signed URLs from Supabase Storage).
- Rewrites (production API proxy).
- Experimental cache-components (evaluate when we hit request-caching problems).

---

## `postcss.config.mjs` — Tailwind v4 wiring

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

**What changed in Tailwind v4:**
- No more `tailwind.config.js`. All theme config lives inside `globals.css` under an `@theme` block.
- Single PostCSS plugin does everything (parsing, purging, variants).
- Zero-config auto-detection of used classes — no `content: [...]` list to maintain.

**Interview Q:** *"Why not styled-components / Emotion / vanilla CSS?"*
**A:** Utility CSS wins on three axes: (1) no CSS-in-JS runtime cost, (2) no naming problem — utilities are already named, (3) purged bundles are tiny. The DX cost is verbose class strings; the accessibility library `clsx` + shadcn's `cn()` helper reduce that.

---

## `eslint.config.mjs`

Uses ESLint 9's new "flat config" format. Extends Next's shared config, which enforces:
- No unused imports.
- No unused variables (with `_` prefix escape).
- Next.js-specific rules (no `<img>`, must use `next/image`).

---

## `src/app/layout.tsx` — the root layout

This is the outermost React tree. Every page renders inside `{children}`.

Key things:

```tsx
export const metadata: Metadata = {
  title: { default: "EvidenceOS ...", template: "%s · EvidenceOS" },
  ...
  robots: { index: false, follow: false },
};
```

- `metadata` is Next's file-based head management. No `<Head>` component to import.
- `title.template` means each child page can set `title: "Login"` and it becomes `Login · EvidenceOS` in the browser tab.
- `robots.index: false` — we do not want crawlers indexing the app before launch.

**Fonts:**

```tsx
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
```

- `next/font/google` self-hosts the font at build time (no runtime CDN request → no FOUT, no privacy leak to Google).
- We expose it as a CSS custom property, then reference it in `globals.css` under Tailwind's `--font-sans` token. This is why `font-sans` classes work in JSX.

---

## `src/app/globals.css` — Tailwind v4 theme

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --brand: #0f172a;
  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;
}

@theme inline {
  --color-background: var(--background);
  --color-brand: var(--brand);
  --color-success: var(--success);
  /* ... */
}
```

- `:root` — the raw CSS values, one per token.
- `@theme inline` — maps them into Tailwind's namespace so `bg-brand`, `text-success` become valid utilities.

**Why the two-layer indirection?** Because we want the raw variables (`:root`) to be overridable by media queries or class selectors (e.g. `.dark { --background: #000 }`) without touching Tailwind's mapping.

---

## `src/app/page.tsx` — the landing route

The whole file is an async Server Component:

```tsx
export default async function Home() {
  const health = await fetchBackendHealth();
  return <main>... {health.ok ? "reachable" : "unreachable"} ...</main>;
}
```

**Notice:**
- `async function` — Server Components can `await` directly. Client Components cannot.
- The fetch runs on the Node server before HTML is streamed to the browser. No JavaScript is required client-side just to display the pill.
- If the backend is down, `fetchBackendHealth` returns `{ ok: false, reason }` — the page still renders. This is the discriminated-union pattern.

**Interview Q:** *"Why fetch health on the landing page?"*
**A:** It is the smallest possible end-to-end proof that the two apps are wired together. When either changes and we run this locally, the pill immediately tells us if we broke the contract.

---

## `src/lib/env.ts` — typed environment access

We do not read `process.env` directly anywhere in the codebase. Instead:

```ts
export const env = {
  API_BASE_URL: optionalEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000"),
  APP_ENV: optionalEnv("NEXT_PUBLIC_APP_ENV", "local"),
  ...
};
```

**Three benefits:**
1. `env.API_BASE_URL` is typed `string`, never `string | undefined`.
2. Grep `env.` to find every env var the app depends on — no more spelunking.
3. `requireEnv()` throws at import time if a mandatory var is missing (fail-fast).

**Interview Q:** *"Why not `zod`?"*
**A:** Right now `env.ts` is 40 lines. Adding Zod is more package weight than validation gain. When we have 20+ vars with URL / number / list types, we will migrate. Do not add libraries preemptively.

---

## `src/lib/api.ts` — backend client

Small `fetch` wrapper. Two key patterns:

1. **Discriminated union return type** — `{ ok: true, ... } | { ok: false, reason: string }`. Callers *must* handle both branches or TypeScript complains.
2. **`cache: "no-store"`** — disable Next's fetch memoisation for health. A cached "healthy" pill is worse than none.

We will grow this file into a full API client as we add endpoints in Phase 1+.

---

## `.env.example`

The template file — copied to `.env.local` in local dev. Committed to git; the real `.env.local` is git-ignored.

**Rule of thumb for env vars:**
- Prefixed `NEXT_PUBLIC_*` → shipped to the browser bundle. Safe things only (URLs, feature flags, public keys).
- Everything else → server-only. Reading them from a Client Component gives `undefined`.

---

## `public/` — static assets

Currently empty (we deleted the default Vercel/Next logos). We will add a favicon and OG image in Phase 6.

---

## What to read next

- `03_backend_scaffold.md` — everything inside `apps/api/`.
- `CHALLENGES.md` — problems we hit and solved.
