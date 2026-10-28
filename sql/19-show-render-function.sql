-- Checkpoint 06 | Read-only. Rehearsal/debug only: readable wrapper around the large React bundle.
SELECT pg_get_functiondef(
  'public.render_page(integer)'::regprocedure
) AS render_function;
