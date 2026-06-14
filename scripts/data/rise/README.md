# RISE Excel data pack

Place the extracted CSV files from `rise_excel_data_pack.zip` in this directory before running the Replit import script.

Required files:

- `projects.csv`
- `tasks.csv`
- `indicators.csv`
- `indicator_targets.csv`
- `indicator_actuals.csv`

Run from the Replit shell:

```bash
pnpm --filter @workspace/scripts run import:rise-data-pack
```

The importer uses `indicators.csv` `indicator_id` as the stable source key and preserves `indicator_scope`, `source_scope_name`, `calculation_mode`, and `source_level_confidence` on the `indicators` table.
