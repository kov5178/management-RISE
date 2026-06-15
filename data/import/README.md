# RISE data import

Place the RISE CSV files in this directory for Replit database import.

Required file order:

1. `projects.csv`
2. `tasks.csv`
3. `indicators.csv`
4. `indicator_components.csv`
5. `indicator_targets.csv`
6. `indicator_actuals.csv`
7. `formula_links_2025_l.csv`

The same source files are currently preserved under `scripts/data/rise/`. For Replit import runs, copy or upload the CSV files into this `data/import/` directory before running:

```bash
pnpm --filter @workspace/scripts run import:rise-data-pack
```

Run DB import only in an environment with `DATABASE_URL` configured.
