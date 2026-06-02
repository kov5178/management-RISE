// One-shot importer for data-export.json into the current Postgres DB.
// Run: cd /home/runner/workspace/lib/db && node ../../scripts/src/import-data.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require("/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DATA_PATH = path.join(ROOT, "data-export.json");

const { Client } = pg;

function ymd(year) {
  return `${year}-12-31`;
}

async function main() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const { data, meta } = JSON.parse(raw);
  console.log("Loaded:", meta.counts);

  const c = new Client();
  await c.connect();

  // Build lookups for results enrichment
  const indicatorById = new Map(data.indicators.map((i) => [i.id, i]));
  const taskById = new Map(data.tasks.map((t) => [t.id, t]));

  await c.query("BEGIN");
  try {
    // Wipe domain tables (keep users/sessions/settings/registration_requests/role_change_logs)
    await c.query(`
      TRUNCATE TABLE
        feedback_actions,
        reviews,
        evidence_download_logs,
        evidence_files,
        indicator_results,
        indicator_targets,
        indicators,
        tasks,
        projects
      RESTART IDENTITY CASCADE;
    `);

    // projects
    for (const p of data.projects) {
      await c.query(
        `INSERT INTO projects (id, name, description, start_year, end_year, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [p.id, p.name, p.description, p.startYear, p.endYear, p.status, p.createdAt, p.updatedAt],
      );
    }

    // tasks
    for (const t of data.tasks) {
      await c.query(
        `INSERT INTO tasks (id, project_id, name, description, manager_name, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [t.id, t.projectId, t.name, t.description, t.managerName, t.status, t.createdAt, t.updatedAt],
      );
    }

    // indicators (parent first ordering not strictly necessary; FK is self-table without DEFERRABLE)
    // Insert with parentId NULL first, then update parents to avoid FK ordering issues.
    for (const ind of data.indicators) {
      await c.query(
        `INSERT INTO indicators (id, task_id, parent_id, indicator_type, name, unit, formula, weight, description, created_at, updated_at)
         VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ind.id, ind.taskId, ind.indicatorType, ind.name, ind.unit, ind.formula, ind.weight, ind.description, ind.createdAt, ind.updatedAt],
      );
    }
    for (const ind of data.indicators) {
      if (ind.parentId != null) {
        await c.query(`UPDATE indicators SET parent_id=$1 WHERE id=$2`, [ind.parentId, ind.id]);
      }
    }

    // targets
    for (const t of data.targets) {
      await c.query(
        `INSERT INTO indicator_targets (id, indicator_id, year, target_value, note, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [t.id, t.indicatorId, t.year, t.targetValue, t.note, t.createdAt, t.updatedAt],
      );
    }

    // results — need to fill new required cols
    for (const r of data.results) {
      const ind = indicatorById.get(r.indicatorId);
      const task = ind ? taskById.get(ind.taskId) : null;
      const programName = task?.name || ind?.name || "기존 데이터";
      const resultDate = ymd(r.year);
      const actual = r.actualValue != null ? r.actualValue : (r.calculatedValue != null ? r.calculatedValue : 0);
      await c.query(
        `INSERT INTO indicator_results
          (id, indicator_id, year, program_name, result_date, actual_value, note,
           calculated_value, progress_rate, status, self_evaluation, submitted_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          r.id, r.indicatorId, r.year, programName, resultDate, actual, null,
          r.calculatedValue, r.progressRate, r.status, r.selfEvaluation, r.submittedAt, r.createdAt, r.updatedAt,
        ],
      );
    }

    // evidence
    for (const e of data.evidence) {
      await c.query(
        `INSERT INTO evidence_files (id, result_id, file_name, file_url, file_size, mime_type, uploaded_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [e.id, e.resultId, e.fileName, e.fileUrl, e.fileSize, e.mimeType, e.uploadedBy, e.createdAt],
      );
    }

    // reviews
    for (const r of data.reviews) {
      await c.query(
        `INSERT INTO reviews (id, result_id, reviewer_name, review_status, comment, reviewed_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.id, r.resultId, r.reviewerName, r.reviewStatus, r.comment, r.reviewedAt, r.createdAt],
      );
    }

    // feedback
    for (const f of data.feedback) {
      await c.query(
        `INSERT INTO feedback_actions
          (id, task_id, year, evaluation_content, improvement_plan, action_status, due_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [f.id, f.taskId, f.year, f.evaluationContent, f.improvementPlan, f.actionStatus, f.dueDate, f.createdAt, f.updatedAt],
      );
    }

    // Reset sequences to MAX(id)+1 for each table with serial PK
    const seqTables = [
      ["projects", "projects_id_seq"],
      ["tasks", "tasks_id_seq"],
      ["indicators", "indicators_id_seq"],
      ["indicator_targets", "indicator_targets_id_seq"],
      ["indicator_results", "indicator_results_id_seq"],
      ["evidence_files", "evidence_files_id_seq"],
      ["reviews", "reviews_id_seq"],
      ["feedback_actions", "feedback_actions_id_seq"],
    ];
    for (const [tbl, seq] of seqTables) {
      await c.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${tbl}), 1))`);
    }

    await c.query("COMMIT");
    console.log("✓ Import complete");

    // Quick counts
    for (const [tbl] of seqTables) {
      const r = await c.query(`SELECT COUNT(*)::int AS n FROM ${tbl}`);
      console.log(`  ${tbl}: ${r.rows[0].n}`);
    }
  } catch (err) {
    await c.query("ROLLBACK");
    console.error("✗ Import failed, rolled back:", err.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
