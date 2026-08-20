# Day 6 Implementation Handoff — React Scaffold + Supabase Auth + Vercel Deploy

## Reproduction Instructions

### Expected repository state before applying Day 6 changes

Days 1–5 must already be fully implemented as documented in:

- `docs/day1_implementation.md` — monorepo scaffold, Supabase schema, RLS, frontend scaffold (Vite default `App.tsx` + `main.tsx` still in place, `src/lib/supabase.ts`, `src/lib/utils.ts`, `components.json`, path aliases wired)
- `docs/day2_implementation.md` — FastAPI core, Pydantic settings, auth middleware, tenant context, health and auth routes
- `docs/day3_implementation.md` — LLM manager, copilot pipeline, copilot route
- `docs/day4_implementation.md` — KPI service + route, data import route, schema discovery, prompt generator
- `docs/day5_implementation.md` — Railway deployment config, admin tenant routes

The frontend directory must be in the state where:

- `akara/frontend/src/App.tsx` contains the **Vite counter demo** (will be fully replaced)
- `akara/frontend/src/main.tsx` uses the Day 1 import style (`import { StrictMode } from 'react'`, `import { createRoot } from 'react-dom/client'`)
- `akara/frontend/src/components/ui/` exists but is **empty** — no shadcn components installed yet
- `akara/frontend/src/types/`, `src/contexts/`, `src/pages/`, `src/components/layout/` directories **do not exist**
- `akara/frontend/vercel.json` does **not** exist
- `akara/frontend/tsconfig.app.json` has `baseUrl` and `paths` but **no** `ignoreDeprecations` key

### What Day 6 adds

1. **`tsconfig.app.json`** — add `ignoreDeprecations: "6.0"` to silence TypeScript 6 deprecation of `baseUrl` (required for `pnpm build` to pass)
2. **shadcn/ui components** — `button`, `input`, `label`, `card`, `table`, `badge` installed into `src/components/ui/`
3. **`src/types/index.ts`** — `User` and `Tenant` TypeScript interfaces
4. **`src/contexts/AuthContext.tsx`** — Supabase Auth session, `/auth/me` profile fetch, `AuthProvider`, `useAuth` hook
5. **`src/components/ProtectedRoute.tsx`** — session guard with loading spinner
6. **`src/pages/LoginPage.tsx`** — shadcn Card-based login form
7. **`src/components/layout/AppShell.tsx`** — fixed sidebar with nav links and sign-out button
8. **`src/App.tsx`** — full rewrite replacing the Vite counter demo with the React Router tree
9. **`src/main.tsx`** — rewrite to use `import React from "react"` / `React.StrictMode`
10. **`vercel.json`** — SPA rewrite rule
11. **`src/pages/admin/TenantsPage.tsx`** — admin tenants table using TanStack Query

### Application order

Apply changes in this order (dependencies first):

1. `akara/frontend/tsconfig.app.json` (modify)
2. shadcn component files — `src/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `table.tsx`, `badge.tsx` (create, or reinstall via CLI)
3. `akara/frontend/src/types/index.ts` (create)
4. `akara/frontend/src/contexts/AuthContext.tsx` (create)
5. `akara/frontend/src/components/ProtectedRoute.tsx` (create)
6. `akara/frontend/src/pages/LoginPage.tsx` (create)
7. `akara/frontend/src/components/layout/AppShell.tsx` (create)
8. `akara/frontend/src/pages/admin/TenantsPage.tsx` (create)
9. `akara/frontend/src/App.tsx` (modify — full rewrite)
10. `akara/frontend/src/main.tsx` (modify)
11. `akara/frontend/vercel.json` (create)

### Commands after copying the code

```bash
cd akara/frontend

# Install shadcn components (if not copying manually)
pnpm dlx shadcn@latest add button input label card
pnpm dlx shadcn@latest add table badge

# Verify build passes with zero TypeScript errors
pnpm build
# Expected output: "✓ built in ~Xs" — no TS errors, exit code 0
```

> **Note:** When using `pnpm dlx shadcn@latest add`, the shadcn CLI may place files into a
> literal `@/components/ui/` directory instead of `src/components/ui/` if the pnpm cache
> directory is not writable. If that happens, move the files manually:
> ```bash
> cp akara/frontend/@/components/ui/* akara/frontend/src/components/ui/
> rm -rf "akara/frontend/@"
> ```
> This is why copying the component files manually (as documented below) is the safer approach.

### Vercel deploy (manual — requires Vercel CLI and account)

```bash
cd akara/frontend
npx vercel        # first deploy — follow prompts to link project
npx vercel --prod # production deploy after setting env vars in Vercel dashboard
```

Set the following in Vercel → Project → Settings → Environment Variables (all environments):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public, safe to expose) |
| `VITE_API_BASE_URL` | Railway backend URL e.g. `https://akara-backend-production.up.railway.app` |

After obtaining the Vercel URL, update Railway's `ALLOWED_ORIGINS_RAW` environment variable to include that domain and redeploy with `railway up`.

### Verification checklist

- [ ] `pnpm build` exits 0
- [ ] Vercel URL → redirects to `/login`
- [ ] Login form renders with shadcn Card styling
- [ ] Sign in with test Supabase user → lands on `/dashboard` (placeholder text visible)
- [ ] Sidebar shows all 6 nav links and logged-in email
- [ ] Sign out → redirects to `/login`
- [ ] Direct navigation to `/dashboard` while logged out → redirected to `/login`

---

## Environment Variables

### New frontend environment variables (Day 6)

All three variables are required at **Vite build time** (embedded by Vite as `import.meta.env.VITE_*`). They are also required at runtime.

| Variable | Purpose | Required | Format | Default | Used in |
|---|---|---|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the Railway backend. Appended with `/auth/me` to fetch the user profile after sign-in. | **Required** | HTTPS URL, no trailing slash — e.g. `https://akara-backend-production.up.railway.app` | None | `src/contexts/AuthContext.tsx`, `src/pages/admin/TenantsPage.tsx` |

> `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were introduced on Day 1 (`src/lib/supabase.ts`) and are unchanged. They are listed here for completeness because they must be set in the Vercel dashboard for the Day 6 deploy.

---

## Package Dependencies

### New packages added by shadcn on Day 6

The following packages were added to `akara/frontend/package.json` as direct dependencies by the `pnpm dlx shadcn@latest add` commands:

| Package | Version | Added/Updated | Why needed | Manifest |
|---|---|---|---|---|
| `@radix-ui/react-label` | `^2.1.12` | Added | Used by `src/components/ui/label.tsx` — accessible label primitive | `akara/frontend/package.json` → `dependencies` |
| `@radix-ui/react-slot` | `^1.3.0` | Added | Used by `src/components/ui/button.tsx` — allows Button to render as a child slot (asChild pattern) | `akara/frontend/package.json` → `dependencies` |
| `class-variance-authority` | `^0.7.1` | Added | Used by `button.tsx`, `label.tsx`, `badge.tsx` — builds typed CSS variant maps (`cva`) | `akara/frontend/package.json` → `dependencies` |

All other packages (`react`, `react-dom`, `react-router-dom`, `@supabase/supabase-js`, `@tanstack/react-query`, `lucide-react`, `clsx`, `tailwind-merge`) were already present from Days 1–2.

The updated `package.json` `dependencies` section after Day 6 (exact resolved versions):

```json
"dependencies": {
  "@radix-ui/react-label": "^2.1.12",
  "@radix-ui/react-slot": "^1.3.0",
  "@supabase/supabase-js": "^2.110.8",
  "@tailwindcss/vite": "^4.3.3",
  "@tanstack/react-query": "^5.101.4",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "lucide-react": "^1.25.0",
  "react": "^19.2.7",
  "react-dom": "^19.2.7",
  "react-router-dom": "^7.18.1",
  "tailwind-merge": "^3.6.0",
  "zustand": "^5.0.14"
}
```

---

# File: `akara/frontend/tsconfig.app.json`

**Status:** Modified

## Purpose

TypeScript 6 treats the `baseUrl` compiler option as deprecated and emits a build-blocking
error (`TS5101`) unless the `ignoreDeprecations` key is set to `"6.0"`. Without this
change, `pnpm build` (which runs `tsc -b && vite build`) exits with code 2 and nothing
in `akara/frontend/src/` can be compiled.

## Dependencies

- `typescript ~6.0.2` (already in `devDependencies` from Day 1)

## Implementation

### Original code (Day 1 — the section being modified)

```json
    /* Path aliases */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
```

### Replacement code (Day 6)

```json
    /* Path aliases */
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
```

### Complete file after Day 6

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,

    /* Path aliases */
    "ignoreDeprecations": "6.0",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

## Placement

The `"ignoreDeprecations": "6.0"` line is added immediately before `"baseUrl"` inside
the `"compilerOptions"` object, under the `/* Path aliases */` comment.

## Explanation

TypeScript 6 deprecated `baseUrl` in favour of package-relative imports and emits
`TS5101` to signal the pending removal in TypeScript 7. Setting `ignoreDeprecations`
to `"6.0"` tells TypeScript to suppress all deprecation warnings introduced in that
release, allowing the existing `@/*` path alias configuration to continue working
without change.

## Related Changes

- All Day 6 frontend source files rely on the `@/*` alias resolving to `./src/*`.
  Without this fix none of them would compile.

---

# File: `akara/frontend/src/components/ui/button.tsx`

**Status:** Created (generated by `pnpm dlx shadcn@latest add button`)

## Purpose

Provides a typed, variant-aware `<Button>` component used in `LoginPage.tsx`,
`AppShell.tsx`, and `TenantsPage.tsx`. Wraps a native `<button>` (or arbitrary child
via the `asChild` prop) with `cva`-managed Tailwind class variants.

## Dependencies

- `react` — `React.forwardRef`, `React.ButtonHTMLAttributes` (existed)
- `@radix-ui/react-slot` ^1.3.0 — `Slot` primitive (added Day 6)
- `class-variance-authority` ^0.7.1 — `cva`, `VariantProps` (added Day 6)
- `@/lib/utils` — `cn()` helper (existed from Day 1)

## Implementation

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

## Placement

New file at `akara/frontend/src/components/ui/button.tsx`. The `src/components/ui/`
directory already existed (created empty on Day 1). This is the first file placed
inside it.

## Explanation

`buttonVariants` is a `cva` call that maps `variant` and `size` props to Tailwind
class strings. The `Button` component is a `forwardRef` wrapper that renders either
a plain `<button>` or a Radix `<Slot>` (useful for composing with `<Link>` etc.).
Exports both `Button` and `buttonVariants` — the latter is used externally when
custom components need the same class logic.

## Related Changes

- Imported by `AppShell.tsx`, `LoginPage.tsx`, `TenantsPage.tsx` (all Day 6)

---

# File: `akara/frontend/src/components/ui/input.tsx`

**Status:** Created (generated by `pnpm dlx shadcn@latest add input`)

## Purpose

Provides a styled `<Input>` component used in `LoginPage.tsx` for the email and
password fields.

## Dependencies

- `react` — `React.forwardRef`, `React.ComponentProps` (existed)
- `@/lib/utils` — `cn()` (existed)

## Implementation

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
```

## Placement

New file at `akara/frontend/src/components/ui/input.tsx`.

## Explanation

A thin `forwardRef` wrapper around `<input>` that applies shadcn design-token classes.
Accepts all standard HTML input props via `React.ComponentProps<"input">`, making
TypeScript inference of the `onChange` handler's event type automatic.

## Related Changes

- Imported by `LoginPage.tsx` (Day 6)

---

# File: `akara/frontend/src/components/ui/label.tsx`

**Status:** Created (generated by `pnpm dlx shadcn@latest add label`)

## Purpose

Provides an accessible `<Label>` component built on Radix UI's label primitive, used
in `LoginPage.tsx`.

## Dependencies

- `react` — namespace import (existed)
- `@radix-ui/react-label` ^2.1.12 — `LabelPrimitive` (added Day 6)
- `class-variance-authority` ^0.7.1 — `cva`, `VariantProps` (added Day 6)
- `@/lib/utils` — `cn()` (existed)

## Implementation

```typescript
import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

## Placement

New file at `akara/frontend/src/components/ui/label.tsx`.

## Explanation

Wraps Radix `LabelPrimitive.Root` to provide accessible `htmlFor` linking and
disability-state styling. The `cva` call only defines base classes (no variants
needed for a label).

## Related Changes

- Imported by `LoginPage.tsx` (Day 6)

---

# File: `akara/frontend/src/components/ui/card.tsx`

**Status:** Created (generated by `pnpm dlx shadcn@latest add card`)

## Purpose

Provides the `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and
`CardFooter` components used to build the login form container in `LoginPage.tsx`.

## Dependencies

- `react` — namespace import (existed)
- `@/lib/utils` — `cn()` (existed)

## Implementation

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

## Placement

New file at `akara/frontend/src/components/ui/card.tsx`.

## Explanation

Six `forwardRef` components that compose a card layout. Only `Card`, `CardHeader`,
`CardTitle`, `CardDescription`, and `CardContent` are used in `LoginPage.tsx`.
`CardFooter` is generated by shadcn and exported for future use.

## Related Changes

- Imported by `LoginPage.tsx` (Day 6)

---

# File: `akara/frontend/src/components/ui/table.tsx`

**Status:** Created (generated by `pnpm dlx shadcn@latest add table`)

## Purpose

Provides the `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`,
`TableHead`, `TableCell`, and `TableCaption` components used by `TenantsPage.tsx`.

## Dependencies

- `react` — namespace import (existed)
- `@/lib/utils` — `cn()` (existed)

## Implementation

```typescript
import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

## Placement

New file at `akara/frontend/src/components/ui/table.tsx`.

## Explanation

Eight `forwardRef` components wrapping the native HTML table elements with shadcn
design tokens. `Table` wraps `<table>` in a `<div className="relative w-full overflow-auto">`
for horizontal scroll on small viewports.

## Related Changes

- Imported by `TenantsPage.tsx` (Day 6)

---

# File: `akara/frontend/src/components/ui/badge.tsx`

**Status:** Created (generated by `pnpm dlx shadcn@latest add badge`)

## Purpose

Provides a `<Badge>` component for displaying status chips (Active / Inactive) in
`TenantsPage.tsx`.

## Dependencies

- `react` — namespace import (existed)
- `class-variance-authority` ^0.7.1 — `cva`, `VariantProps` (added Day 6)
- `@/lib/utils` — `cn()` (existed)

## Implementation

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

## Placement

New file at `akara/frontend/src/components/ui/badge.tsx`.

## Explanation

A non-`forwardRef` functional component (unlike the other shadcn components). Renders
a `<div>` with variant-driven pill styling. Variants: `default` (primary colour),
`secondary`, `destructive`, `outline`. `TenantsPage.tsx` uses `default` for active
tenants and `secondary` for inactive ones.

## Related Changes

- Imported by `TenantsPage.tsx` (Day 6)

---

# File: `akara/frontend/src/types/index.ts`

**Status:** Created

## Purpose

Centralises frontend TypeScript types. `User` represents an authenticated AKARA user
as returned by the `/auth/me` backend endpoint (with camelCase field names). `Tenant`
represents a tenant record. These types are shared across `AuthContext.tsx` and any
future page that needs to reference the current user or tenant.

## Dependencies

No external packages. No other internal files are required.

## Implementation

```typescript
export interface User {
  id: string;
  email: string;
  tenantId: string;
  role: "admin" | "user";
  displayName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  isActive: boolean;
}
```

## Placement

New file. Create directory `akara/frontend/src/types/` and place `index.ts` inside it.

## Explanation

`User.role` is a discriminated union `"admin" | "user"` matching the values stored
in the `profiles` table `role` column (Day 1 schema). `User.displayName` is optional —
the `/auth/me` endpoint does not return it yet; the field is reserved for future use.
`Tenant.config` uses `Record<string, unknown>` to accommodate the arbitrary JSON config
blob stored in the `tenants` table.

## Related Changes

- `src/contexts/AuthContext.tsx` — imports `User` (Day 6)

---

# File: `akara/frontend/src/contexts/AuthContext.tsx`

**Status:** Created

## Purpose

Provides app-wide Supabase Auth state via React Context. Solves the problem of:
1. Keeping the Supabase session in sync with the UI across tab focus and token refresh
2. Enriching the raw Supabase `Session` with tenant-level data (`tenant_id`, `role`)
   fetched from the backend's `/auth/me` endpoint
3. Exposing `signIn` and `signOut` helpers so pages do not import `supabase` directly

## Dependencies

- `react` — `createContext`, `useContext`, `useEffect`, `useState`, `ReactNode` (existed)
- `@supabase/supabase-js` — `Session`, `User as SupabaseUser` types (existed)
- `@/lib/supabase` — `supabase` client instance (existed from Day 1)
- `@/types` — `User` interface (Day 6, created above)
- `VITE_API_BASE_URL` — environment variable (new, Day 6)

## Implementation

```typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(
    _supabaseUser: SupabaseUser,
    accessToken: string
  ) {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/auth/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error("Profile fetch failed");
      const data = await res.json();
      setUser({
        id: data.user_id,
        email: data.email,
        tenantId: data.tenant_id,
        role: data.role,
      });
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token).finally(() =>
          setLoading(false)
        );
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

## Placement

New file. Create directory `akara/frontend/src/contexts/` and place
`AuthContext.tsx` inside it.

## Explanation

**`AuthProvider`** initialises two pieces of state: the raw Supabase `Session` object
and the enriched `User` profile. On mount, `getSession()` retrieves any persisted
session from local storage. If a session exists, `fetchProfile()` calls
`GET /auth/me` with the JWT, converts the snake_case response to the camelCase `User`
shape, and sets `user`. `loading` remains `true` until this is resolved, preventing
protected routes from rendering before auth state is known.

**`onAuthStateChange`** subscribes to Supabase's session bus — handles sign-in,
sign-out, and token refresh events. Returns a cleanup function that unsubscribes on
unmount.

**`fetchProfile`** takes `_supabaseUser` (prefixed `_` because it is not used in the
current implementation — the access token alone is sufficient to identify the user on
the backend). The parameter is kept in the signature for forward compatibility.

**`signIn`** delegates to `supabase.auth.signInWithPassword` and re-throws any error
so `LoginPage.tsx` can display it.

**`signOut`** calls `supabase.auth.signOut()` then clears the local `user` state
immediately (the `onAuthStateChange` handler will also fire but the explicit clear
ensures the UI reacts instantly).

**`useAuth`** throws if called outside an `AuthProvider` tree — provides a clear
error message instead of a silent `undefined` crash.

**Import note:** `ReactNode` is imported with the inline `type` modifier
(`type ReactNode`) because `verbatimModuleSyntax: true` in `tsconfig.app.json`
requires all type-only imports to be annotated as such. Similarly, `Session` and
`SupabaseUser` use `import type`. The `_supabaseUser` prefix suppresses the
`noUnusedParameters` TypeScript error.

## Related Changes

- `src/components/ProtectedRoute.tsx` — imports `useAuth` (Day 6)
- `src/pages/LoginPage.tsx` — imports `useAuth` (Day 6)
- `src/components/layout/AppShell.tsx` — imports `useAuth` (Day 6)
- `src/pages/admin/TenantsPage.tsx` — imports `useAuth` (Day 6)
- `src/App.tsx` — imports `AuthProvider` (Day 6)
- `backend/app/api/routes/auth.py` — `GET /auth/me` endpoint called by `fetchProfile` (existed from Day 2)

---

# File: `akara/frontend/src/components/ProtectedRoute.tsx`

**Status:** Created

## Purpose

Guards all routes inside the authenticated shell. Unauthenticated users are
redirected to `/login`; while the session state is loading, a full-screen spinner
is shown to prevent a flash of the login page.

## Dependencies

- `react-router-dom` — `Navigate`, `Outlet` (existed)
- `@/contexts/AuthContext` — `useAuth` (Day 6)

## Implementation

```typescript
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return session ? <Outlet /> : <Navigate to="/login" replace />;
}
```

## Placement

New file. Create directory `akara/frontend/src/components/` (already exists from
Day 1 scaffold) and place `ProtectedRoute.tsx` directly inside it (not in a
subdirectory).

## Explanation

`ProtectedRoute` is used as a layout route in React Router v7. When no `element`
prop is passed to a parent `<Route>`, `<Outlet />` renders the matched child route.
The `replace` prop on `<Navigate>` replaces the history entry so the browser back
button does not return to the protected page after sign-out.

The spinner uses only Tailwind utility classes — no additional packages.

## Related Changes

- `src/App.tsx` — renders `<ProtectedRoute />` as a layout route wrapping all
  authenticated pages (Day 6)

---

# File: `akara/frontend/src/pages/LoginPage.tsx`

**Status:** Created

## Purpose

The sign-in page rendered at `/login`. Provides an email + password form styled with
shadcn Card components. On successful sign-in, redirects to `/dashboard`. Displays
inline error messages on failure.

## Dependencies

- `react` — `useState` (existed); `FormEvent` imported as `type` (existed)
- `react-router-dom` — `useNavigate` (existed)
- `@/contexts/AuthContext` — `useAuth` (Day 6)
- `@/components/ui/button` — `Button` (Day 6)
- `@/components/ui/input` — `Input` (Day 6)
- `@/components/ui/label` — `Label` (Day 6)
- `@/components/ui/card` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle` (Day 6)

## Implementation

```typescript
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            AKARA
          </CardTitle>
          <CardDescription>
            Sign in to your analytics dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Placement

New file. Create directory `akara/frontend/src/pages/` and place `LoginPage.tsx`
inside it.

## Explanation

`handleSubmit` calls `signIn` from `AuthContext`. The `signIn` function throws on
failure (Supabase SDK throws on invalid credentials), so the `catch` block catches
`AuthApiError` from `@supabase/supabase-js` as a plain `Error` instance. The
`err instanceof Error` check provides a safe fallback message.

`FormEvent` is imported as a type (`import type { FormEvent }`) because
`verbatimModuleSyntax: true` requires all type-only imports to be annotated.

After successful sign-in, `navigate("/dashboard")` triggers a client-side navigation.
The `AuthContext` `onAuthStateChange` listener fires simultaneously, sets the session,
and the `ProtectedRoute` will render the dashboard instead of redirecting.

## Related Changes

- `src/App.tsx` — renders `<LoginPage />` at `/login` (Day 6)
- `src/contexts/AuthContext.tsx` — provides `signIn` (Day 6)

---

# File: `akara/frontend/src/components/layout/AppShell.tsx`

**Status:** Created

## Purpose

The main application chrome: a fixed 256 px sidebar with brand header, 6 navigation
links, and a sign-out button. Child pages render via React Router's `<Outlet />`.
Solves the problem of providing consistent navigation across all authenticated pages
without duplicating markup.

## Dependencies

- `react-router-dom` — `Link`, `useLocation`, `Outlet` (existed)
- `@/contexts/AuthContext` — `useAuth` (Day 6)
- `@/components/ui/button` — `Button` (Day 6)
- `lucide-react` — `LayoutDashboard`, `MessageSquare`, `Upload`, `BarChart2`, `Settings`, `LogOut`, `TrendingUp` (existed)
- `@/lib/utils` — `cn()` (existed)

## Implementation

```typescript
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  Settings,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/copilot", label: "Copilot", icon: MessageSquare },
  { to: "/data", label: "Data", icon: Upload },
  { to: "/reports", label: "Reports", icon: BarChart2 },
  { to: "/simulator", label: "Simulator", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-xl font-bold text-slate-900">AKARA</span>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {user?.email}
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                location.pathname.startsWith(to)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-slate-600"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

## Placement

New file. Create directory `akara/frontend/src/components/layout/` and place
`AppShell.tsx` inside it.

## Explanation

`NAV_ITEMS` is a module-level constant array. The `icon` field holds a Lucide icon
component directly (not a string). When destructured as `icon: Icon`, TypeScript
infers its type as a React component and `<Icon className="h-4 w-4" />` renders
correctly.

Active link detection uses `location.pathname.startsWith(to)` rather than strict
equality so that `/dashboard/anything` also highlights the Dashboard link.

`user?.email` uses optional chaining because `user` can briefly be `null` while the
`/auth/me` fetch completes after a Supabase session is restored from local storage.

`signOut` is called directly as the `onClick` handler — no arrow wrapper is needed
because it accepts no arguments.

## Related Changes

- `src/App.tsx` — renders `<AppShell />` as the inner layout route wrapping all
  authenticated pages (Day 6)
- `src/contexts/AuthContext.tsx` — provides `user` and `signOut` (Day 6)

---

# File: `akara/frontend/src/pages/admin/TenantsPage.tsx`

**Status:** Created

## Purpose

Admin-only page that lists all tenants by calling the `GET /admin/tenants` endpoint
(introduced in Day 5). Demonstrates TanStack Query integration and uses all three
Track 2 shadcn components (`Table`, `Badge`).

## Dependencies

- `@tanstack/react-query` — `useQuery` (existed)
- `@/contexts/AuthContext` — `useAuth` (Day 6)
- `@/components/ui/button` — `Button` (Day 6)
- `@/components/ui/table` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` (Day 6)
- `@/components/ui/badge` — `Badge` (Day 6)
- `VITE_API_BASE_URL` — environment variable (new, Day 6)
- `backend/app/api/routes/admin/tenants.py` — `GET /admin/tenants` endpoint (existed from Day 5)

## Implementation

```typescript
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

async function fetchTenants(token: string): Promise<Tenant[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/admin/tenants`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch tenants");
  return res.json();
}

export function TenantsPage() {
  const { session } = useAuth();
  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => fetchTenants(session!.access_token),
    enabled: !!session,
  });

  if (isLoading) return <div className="p-8">Loading tenants...</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Tenants</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(tenants || []).map((t) => (
            <TableRow key={t.id}>
              <TableCell>{t.name}</TableCell>
              <TableCell className="font-mono text-sm">{t.slug}</TableCell>
              <TableCell>
                <Badge variant={t.is_active ? "default" : "secondary"}>
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="outline" size="sm">
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

## Placement

New file. Create directory `akara/frontend/src/pages/admin/` and place
`TenantsPage.tsx` inside it.

## Explanation

The local `Tenant` interface uses `is_active` (snake_case) because that is the exact
field name returned by the `GET /admin/tenants` backend response — distinct from the
camelCase `isActive` in `src/types/index.ts` which represents the frontend app model.

`session!.access_token` uses the non-null assertion because the query is only enabled
when `!!session` is truthy (`enabled: !!session`), so TanStack Query will never call
`fetchTenants` when session is null. The assertion avoids a TypeScript error without
adding a redundant null check.

The `Manage` button is a placeholder for future tenant management functionality.

## Related Changes

- `src/App.tsx` — **not yet** wired into the router on Day 6. `TenantsPage` is created
  but not added to any route. It is ready to be imported and routed on a future day.
- `backend/app/api/routes/admin/tenants.py` — `GET /admin/tenants` (Day 5)
- `src/contexts/AuthContext.tsx` — provides `session` (Day 6)

---

# File: `akara/frontend/src/App.tsx`

**Status:** Modified — **full replacement** of the Vite counter demo

## Purpose

Replaces the Vite placeholder with the production React Router tree. Wires
`QueryClientProvider`, `AuthProvider`, `BrowserRouter`, and all routes together.
`ProtectedRoute` wraps all authenticated paths; `AppShell` provides the sidebar
layout; placeholder page components stand in for pages built on Days 7–10.

## Dependencies

- `react-router-dom` — `BrowserRouter`, `Routes`, `Route`, `Navigate` (existed)
- `@tanstack/react-query` — `QueryClient`, `QueryClientProvider` (existed)
- `@/contexts/AuthContext` — `AuthProvider` (Day 6)
- `@/components/ProtectedRoute` — `ProtectedRoute` (Day 6)
- `@/components/layout/AppShell` — `AppShell` (Day 6)
- `@/pages/LoginPage` — `LoginPage` (Day 6)

## Implementation

### Original file (Day 1 — being replaced)

The original `src/App.tsx` was the unmodified Vite counter demo boilerplate. It
imported `App.css`, `reactLogo`, `viteLogo`, and contained a counter using `useState`.
It is fully discarded. No code from it is carried forward.

### Replacement file (Day 6 — complete contents)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";

// Placeholder pages (built Days 7–10)
const Dashboard = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Dashboard — coming Day 7</h1>
  </div>
);
const Copilot = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Copilot — coming Day 8</h1>
  </div>
);
const Data = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Data — coming Day 9</h1>
  </div>
);
const Reports = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Reports — coming Day 10</h1>
  </div>
);
const Simulator = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Simulator — coming Day 10</h1>
  </div>
);
const SettingsPage = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Settings — coming Day 9</h1>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/copilot" element={<Copilot />} />
                <Route path="/data" element={<Data />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## Placement

`akara/frontend/src/App.tsx` — overwrite the entire existing file. No lines from
the original Vite counter demo are preserved.

## Explanation

**Provider nesting order matters:**
1. `QueryClientProvider` — outermost, provides TanStack Query to everything below
2. `AuthProvider` — next, can use `useQuery` internally if needed later
3. `BrowserRouter` — must wrap all `<Routes>` / `useNavigate` / `useLocation` calls

**Route hierarchy:**
- `/login` — public, renders `LoginPage` directly
- `<ProtectedRoute />` — layout route with no path; renders spinner or redirects to `/login`
  - `<AppShell />` — inner layout route; renders sidebar + `<Outlet />`
    - `/dashboard`, `/copilot`, `/data`, `/reports`, `/simulator`, `/settings` — leaf routes with placeholder components
- `path="*"` — catch-all; redirects any unknown path to `/dashboard` (which will then redirect to `/login` if unauthenticated)

**`queryClient` is instantiated once at module level** — outside the component function
— so it is not re-created on every render.

**`staleTime: 1000 * 60 * 5`** — queries are considered fresh for 5 minutes,
preventing redundant refetches on route changes.

**`App.css` import removed:** The original Vite App.tsx imported `./App.css`. The new
file does not. `src/App.css` still exists on disk (it was noted in Day 1 docs as
"will be deleted on Day 6"), but it is no longer imported and has no effect on the
build. It can be deleted manually if desired.

## Related Changes

- `src/main.tsx` — imports and renders `App` (Day 6, modified below)
- All Day 6 files referenced via imports above

---

# File: `akara/frontend/src/main.tsx`

**Status:** Modified

## Purpose

Updates the app entry point from the Day 1 Vite default import style to the
`import React from "react"` / `React.StrictMode` style. This ensures `React` is
in scope as a namespace object, which is required for `React.StrictMode` to
resolve correctly under the TypeScript 6 + `verbatimModuleSyntax: true` rules.

## Dependencies

- `react` — default import `React` (existed, import style changed)
- `react-dom/client` — `ReactDOM` default import (existed, import style changed)
- `./App.tsx` — `App` default export (existed, now points to Day 6 rewrite)
- `./index.css` — unchanged (Day 1)

## Implementation

### Original file (Day 1)

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### Replacement file (Day 6 — complete contents)

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Placement

`akara/frontend/src/main.tsx` — overwrite the entire existing file.

## Explanation

The Day 1 version used named exports (`StrictMode`, `createRoot`). The Day 6
version uses default namespace imports (`React`, `ReactDOM`) so that
`React.StrictMode` is referenced as a property of the `React` namespace object —
a value usage that TypeScript accepts under `verbatimModuleSyntax: true` without
requiring an `import type`. Both approaches produce identical runtime behaviour;
the change is purely a TypeScript compatibility adjustment.

The `import "./index.css"` line is moved to after the component imports (style only,
no functional difference).

## Related Changes

- `src/App.tsx` — the imported `App` component is the Day 6 rewrite (Day 6)

---

# File: `akara/frontend/vercel.json`

**Status:** Created

## Purpose

Tells Vercel's edge network to serve `index.html` for every URL path, enabling
client-side routing via React Router. Without this rule, a direct navigation to
`/dashboard` would return a 404 because there is no `dashboard.html` file — Vercel
would not know to let the SPA handle the route.

## Dependencies

No package dependencies. Consumed by the Vercel deployment pipeline.

## Implementation

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Placement

New file at `akara/frontend/vercel.json` — at the root of the `frontend` package,
alongside `package.json` and `vite.config.ts`. **Not** inside `src/`.

## Explanation

The `rewrites` array uses Vercel's rewrite syntax. `source: "/(.*)"` matches all
paths (the capture group is required to avoid matching only the root). `destination:
"/index.html"` serves the Vite-built SPA entry point for every request. Vercel
processes rewrites after checking for static assets, so files in `dist/assets/` are
still served correctly.

## Related Changes

- `akara/frontend/src/App.tsx` — the React Router `<BrowserRouter>` relies on this
  rule for direct URL navigation (Day 6)

---

## Note on `akara/frontend/src/App.css`

`src/App.css` was referenced in the Day 1 handoff as a file that "will be deleted on
Day 6". In practice, the file was **not deleted** during Day 6 — it remains on disk
but is **no longer imported** by the rewritten `src/App.tsx`. This means the file has
no effect on the build or runtime. It can be deleted without consequence. If strict
fidelity to the Day 1 note is desired:

```bash
rm akara/frontend/src/App.css
```

This deletion is safe and does not require any other code change.

---

## Build Verification

After applying all Day 6 changes, run:

```bash
cd akara/frontend
pnpm build
```

Expected output:

```
$ tsc -b && vite build
vite v8.x.x building client environment for production...
✓ N modules transformed.
dist/index.html        ~0.45 kB │ gzip:   ~0.29 kB
dist/assets/index-*.css   ~17 kB │ gzip:   ~4 kB
dist/assets/index-*.js  ~504 kB │ gzip: ~147 kB

✓ built in ~Xs
```

Exit code must be 0. The chunk size warning (`Some chunks are larger than 500 kB`)
is informational only and does not affect the build result.
