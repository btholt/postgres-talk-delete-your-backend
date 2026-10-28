import { pool, transaction } from './database.js';

export async function searchProjects(query) {
  const { rows } = await pool.query(`SELECT id FROM projects
    WHERE search_document @@ websearch_to_tsquery('english', $1)
    ORDER BY ts_rank(search_document, websearch_to_tsquery('english', $1)) DESC, id
    LIMIT 50`, [query]);
  return rows;
}

export async function similarProjects(vector, exclude) {
  const { rows } = await pool.query(`SELECT id, 1 - (embedding <=> $1::vector(6)) AS similarity
    FROM projects WHERE ($2::integer IS NULL OR id <> $2)
    ORDER BY embedding <=> $1::vector(6), id LIMIT 4`, [JSON.stringify(vector), exclude ?? null]);
  return rows;
}

export const analyticsQueries = {
  totals: `SELECT coalesce(sum(pledged_cents), 0)::double precision AS pledged_cents,
    coalesce(sum(backers_count), 0)::double precision AS backers,
    count(*)::double precision AS projects,
    count(*) FILTER (WHERE status='funded')::double precision AS funded,
    count(*) FILTER (WHERE status='expired')::double precision AS expired FROM projects`,
  daily: `SELECT (created_at AT TIME ZONE 'UTC')::date::text AS day,
    sum(amount_cents)::double precision AS amount_cents, count(*)::double precision AS backings
    FROM backings
    WHERE created_at >= (date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - interval '13 days') AT TIME ZONE 'UTC'
    GROUP BY day ORDER BY day`,
  categories: `SELECT category, sum(pledged_cents)::double precision AS pledged_cents
    FROM projects GROUP BY category ORDER BY pledged_cents DESC, category`,
};

export async function projectAnalytics() {
  return transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    // Keep DuckDB routing local to analytics, not funding/vector work on pooled connections.
    await client.query('SET LOCAL duckdb.force_execution = true');
    const totals = await client.query(analyticsQueries.totals);
    const daily = await client.query(analyticsQueries.daily);
    const categories = await client.query(analyticsQueries.categories);
    return { totals: totals.rows[0], daily: daily.rows, categories: categories.rows };
  });
}

export async function projectSummaries() {
  const { rows } = await pool.query('SELECT * FROM project_summaries()');
  return rows[0];
}
