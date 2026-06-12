# AGENTS.md

## Repository Baseline

- Use pnpm only. Do not use npm or yarn.
- Use Node.js 24.
- Frontend: `artifacts/rise`
- API server: `artifacts/api-server`
- Database: `lib/db`

## Development Rules

- Do not change feature code for documentation-only baseline work.
- After changing the DB schema, verify API spec, Zod schema, and generated client code stay aligned.
- Do not immediately delete existing tables. Preserve backward compatibility when evolving the schema.
- Run DB push only in an environment where `DATABASE_URL` is provided.

## Validation Commands

```bash
pnpm run typecheck
pnpm run build
```

## Database Commands

```bash
pnpm --filter @workspace/db run push
```

Only run DB push when `DATABASE_URL` is configured for the target environment.
