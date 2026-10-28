CREATE EXTENSION dblink;
CREATE SCHEMA internal AUTHORIZATION api_owner;
CREATE SCHEMA api AUTHORIZATION api_owner;
GRANT USAGE ON SCHEMA public TO api_owner, analytics_executor, web_anon, web_user;
GRANT CREATE ON SCHEMA public TO api_owner;
GRANT USAGE ON SCHEMA api TO api_authenticator, web_anon, web_user;
GRANT USAGE ON SCHEMA internal TO web_anon, web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA api REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA internal REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER TABLE public.projects ADD COLUMN owner_id uuid NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.backings ADD COLUMN owner_id uuid NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.funding_requests ADD COLUMN owner_id uuid NOT NULL DEFAULT '11111111-1111-4111-8111-111111111111';

ALTER TABLE public.projects OWNER TO api_owner;
ALTER TABLE public.backings OWNER TO api_owner;
ALTER TABLE public.funding_requests OWNER TO api_owner;
ALTER TABLE public.workflow_events OWNER TO api_owner;
ALTER TABLE public.project_summary_cache OWNER TO api_owner;
ALTER TABLE public.scheduled_work OWNER TO api_owner;

DO $$
DECLARE routine regprocedure;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'project_summaries','invalidate_project_summaries','durable_ready',
      'check_funding_eligibility','calculate_funding_risk','finish_funding',
      'start_funding_workflow','start_funding_decision_handoff','maintain_campaigns',
      'finish_maintenance','start_maintenance_workflow')
  LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO api_owner', routine);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', routine);
  END LOOP;
END $$;

CREATE FUNCTION internal.actor() RETURNS uuid STABLE LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text := nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub';
BEGIN
  IF actor IS NULL OR actor !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE='A valid demo identity is required.';
  END IF;
  RETURN actor::uuid;
END $$;
GRANT EXECUTE ON FUNCTION internal.actor() TO web_user, api_owner;

CREATE FUNCTION internal.check_request() RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF current_user='web_user' THEN PERFORM internal.actor(); END IF;
END $$;
GRANT EXECUTE ON FUNCTION internal.check_request() TO web_anon, web_user;

CREATE FUNCTION internal.request_id() RETURNS uuid STABLE LANGUAGE plpgsql
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE key text := nullif(current_setting('request.headers',true),'')::jsonb->>'idempotency-key';
BEGIN
  IF key IS NULL OR key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='A UUID v4 idempotency key is required.';
  END IF;
  RETURN key::uuid;
END $$;
ALTER FUNCTION internal.request_id() OWNER TO api_owner;

ALTER TABLE public.funding_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_funding ON public.funding_requests FOR SELECT TO web_user
  USING (owner_id=internal.actor());
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_events ON public.workflow_events FOR SELECT TO web_user USING (
  EXISTS (SELECT 1 FROM public.funding_requests f WHERE f.id=request_id AND f.owner_id=internal.actor())
);
GRANT SELECT ON public.funding_requests, public.workflow_events TO web_user;
GRANT SELECT (id,name,tagline,description,category,founder,location,goal_cents,pledged_cents,
  backers_count,deadline,status,reward,color) ON public.projects TO web_anon,web_user;

CREATE FUNCTION internal.workflow_status(request_id uuid) RETURNS text STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp LANGUAGE plpgsql AS $$
DECLARE status text;
BEGIN
  SELECT i.status INTO status FROM public.funding_requests f
    JOIN df.instances i ON i.id=f.workflow_instance_id
    WHERE f.id=request_id AND f.owner_id=internal.actor();
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Funding request not found.'; END IF;
  RETURN status;
END $$;
ALTER FUNCTION internal.workflow_status(uuid) OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION internal.workflow_status(uuid) TO web_user;

CREATE VIEW api.projects WITH (security_invoker=true) AS
  SELECT id,name,tagline,description,category,founder,location,goal_cents,pledged_cents,
    backers_count,deadline,status,reward,color FROM public.projects;
CREATE VIEW api.funding WITH (security_invoker=true) AS
  SELECT f.id,f.project_id,f.workflow_instance_id,f.eligible,f.status,f.risk_score,f.grant_cents,
    f.decision,f.created_at,f.updated_at,p.name,p.color,internal.workflow_status(f.id) AS workflow_status
  FROM public.funding_requests f JOIN public.projects p ON p.id=f.project_id;
CREATE VIEW api.events WITH (security_invoker=true) AS
  SELECT id,request_id,message,created_at FROM public.workflow_events;
GRANT SELECT ON api.projects TO web_anon,web_user;
GRANT SELECT ON api.funding,api.events TO web_user;

CREATE TABLE public.semantic_queries (id text PRIMARY KEY,label text NOT NULL,embedding public.vector(6) NOT NULL);
ALTER TABLE public.semantic_queries OWNER TO api_owner;
INSERT INTO public.semantic_queries VALUES
  ('meetings','Less busywork, fewer meetings','[0.02,0.04,0.96,0.99,0.02,0.22]'),
  ('bread','An unnecessarily technical loaf of bread','[0.03,0.98,0.6,0.16,0.08,0.04]'),
  ('geese','Getting around, with questionable animals','[0.94,0.02,0.08,0.08,0.82,0.04]'),
  ('subscriptions','Automating my financial regrets','[0.04,0.02,0.8,0.3,0.03,0.99]');
GRANT SELECT (id,label) ON public.semantic_queries TO web_anon,web_user;
CREATE VIEW api.semantic_queries WITH (security_invoker=true) AS SELECT id,label,
  CASE id WHEN 'meetings' THEN 1 WHEN 'bread' THEN 2 WHEN 'geese' THEN 3 ELSE 4 END AS ordinal FROM public.semantic_queries;
GRANT SELECT ON api.semantic_queries TO web_anon,web_user;

CREATE FUNCTION api.project_summaries(q text DEFAULT '',category text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE summary record; result jsonb; query tsquery; term text:=btrim(coalesce(q,''));
  chosen_category text:=coalesce(category,'');
BEGIN
  IF length(term)>160 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Keep searches under 160 characters.'; END IF;
  SELECT * INTO summary FROM public.project_summaries();
  query:=websearch_to_tsquery('english',term);
  SELECT coalesce(jsonb_agg(s.value ORDER BY
    CASE WHEN term<>'' THEN ts_rank(p.search_document,query) ELSE 0 END DESC,p.id),'[]'::jsonb)
    INTO result FROM jsonb_array_elements(summary.projects) s(value)
    JOIN public.projects p ON p.id=(s.value->>'id')::integer
    WHERE (term='' OR p.search_document@@query) AND (chosen_category='' OR p.category=chosen_category);
  PERFORM set_config('response.headers',jsonb_build_array(jsonb_build_object('X-Cache',summary.cache))::text,true);
  RETURN jsonb_build_object('projects',result,'cache',summary.cache,'source',
    CASE WHEN term='' THEN 'Postgres + UNLOGGED cache' ELSE 'Postgres full-text search + UNLOGGED cache' END);
END $$;
ALTER FUNCTION api.project_summaries(text,text) OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.project_summaries(text,text) TO web_anon,web_user;

CREATE FUNCTION api.similar(query_id text DEFAULT NULL,project_id integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE needle public.vector(6); summary record; result jsonb;
BEGIN
  IF project_id IS NOT NULL THEN
    IF project_id<1 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Choose a valid project.'; END IF;
    SELECT embedding INTO needle FROM public.projects WHERE id=project_id;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Project not found.'; END IF;
  ELSE
    SELECT embedding INTO needle FROM public.semantic_queries WHERE id=query_id;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Choose one of the prepared idea matches. No live AI service is used.'; END IF;
  END IF;
  SELECT * INTO summary FROM public.project_summaries();
  SELECT coalesce(jsonb_agg(s.value||jsonb_build_object('similarity',n.similarity)
    ORDER BY n.distance,n.id),'[]'::jsonb) INTO result
  FROM (SELECT p.id,p.embedding<=>needle AS distance,1-(p.embedding<=>needle) AS similarity
    FROM public.projects p WHERE project_id IS NULL OR p.id<>project_id
    ORDER BY p.embedding<=>needle,p.id LIMIT 4) n
  JOIN jsonb_array_elements(summary.projects) s(value) ON (s.value->>'id')::integer=n.id;
  RETURN jsonb_build_object('projects',result,'source','Postgres + pgvector · prepared vectors, no inference');
END $$;
ALTER FUNCTION api.similar(text,integer) OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.similar(text,integer) TO web_anon,web_user;

CREATE FUNCTION api.back_project(project_id integer,amount_cents jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor uuid:=internal.actor(); key uuid:=internal.request_id(); amount numeric;
  project public.projects%ROWTYPE; backing public.backings%ROWTYPE;
BEGIN
  IF project_id IS NULL OR project_id<1 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Choose a valid project.'; END IF;
  IF jsonb_typeof(amount_cents) IS DISTINCT FROM 'number' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Back between $5 and $10,000, using whole cents.';
  END IF;
  amount:=amount_cents::text::numeric;
  IF amount<>trunc(amount) OR amount<500 OR amount>1000000 THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Back between $5 and $10,000, using whole cents.';
  END IF;
  SELECT * INTO backing FROM public.backings WHERE id=key;
  IF FOUND THEN
    IF backing.owner_id<>actor OR backing.project_id<>project_id OR backing.amount_cents<>amount THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='This idempotency key was already used for a different backing.';
    END IF;
  ELSE
    SELECT * INTO project FROM public.projects WHERE id=project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Project not found.'; END IF;
    IF project.status='expired' OR project.deadline<=clock_timestamp() THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='This campaign has ended.';
    END IF;
    INSERT INTO public.backings(id,project_id,amount_cents,owner_id)
      VALUES(key,project_id,amount::integer,actor) ON CONFLICT DO NOTHING RETURNING * INTO backing;
    IF FOUND THEN
      UPDATE public.projects SET pledged_cents=pledged_cents+amount::integer,backers_count=backers_count+1,
        status=CASE WHEN pledged_cents+amount>=goal_cents THEN 'funded' ELSE status END WHERE id=project_id;
    ELSE
      SELECT * INTO STRICT backing FROM public.backings WHERE id=key;
      IF backing.owner_id<>actor OR backing.project_id<>project_id OR backing.amount_cents<>amount THEN
        RAISE SQLSTATE 'PT409' USING MESSAGE='This idempotency key was already used for a different backing.';
      END IF;
    END IF;
  END IF;
  PERFORM set_config('response.status','201',true);
  RETURN jsonb_build_object('backing',to_jsonb(backing)-'owner_id',
    'message','You backed a questionable idea. No real money moved.');
END $$;
ALTER FUNCTION api.back_project(integer,jsonb) OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.back_project(integer,jsonb) TO web_user;

CREATE FUNCTION api.request_funding(project_id integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor uuid:=internal.actor(); key uuid:=internal.request_id(); project public.projects%ROWTYPE;
  funding public.funding_requests%ROWTYPE; instance text;
BEGIN
  IF project_id IS NULL OR project_id<1 THEN RAISE SQLSTATE 'PT400' USING MESSAGE='Choose a valid project.'; END IF;
  SELECT * INTO project FROM public.projects WHERE id=project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Project not found.'; END IF;
  IF project.owner_id<>actor THEN RAISE SQLSTATE 'PT403' USING MESSAGE='Only this demo project owner can request funding.'; END IF;
  SELECT * INTO funding FROM public.funding_requests f WHERE f.project_id=request_funding.project_id OR f.id=key;
  IF FOUND THEN
    IF funding.owner_id<>actor OR funding.project_id<>project_id THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE='This request key belongs to another project or owner.';
    END IF;
  ELSE
    instance:=public.start_funding_workflow(key);
    INSERT INTO public.funding_requests(id,project_id,workflow_instance_id,owner_id)
      VALUES(key,project_id,instance,actor) RETURNING * INTO funding;
    INSERT INTO public.workflow_events(request_id,message) VALUES(key,'Funding request saved. Waiting for pg_durable.');
  END IF;
  PERFORM set_config('response.status','202',true);
  RETURN to_jsonb(funding)-'owner_id';
END $$;
ALTER FUNCTION api.request_funding(integer) OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.request_funding(integer) TO web_user;

CREATE FUNCTION api.decide_funding(request_id uuid,decision text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor uuid:=internal.actor(); funding public.funding_requests%ROWTYPE; state text;
BEGIN
  IF decision IS NULL OR decision NOT IN ('approve','reject') THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Choose approve or reject.';
  END IF;
  SELECT * INTO funding FROM public.funding_requests f WHERE f.id=request_id AND f.owner_id=actor FOR UPDATE;
  IF NOT FOUND THEN RAISE SQLSTATE 'PT404' USING MESSAGE='Funding request not found.'; END IF;
  IF funding.decision IS DISTINCT FROM decision THEN
    SELECT status INTO state FROM df.instances WHERE id=funding.workflow_instance_id;
    IF state IN ('failed','cancelled') THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE=format('This durable workflow is %s. Inspect it before recording a decision.',state);
    END IF;
    IF funding.status<>'awaiting_approval' THEN RAISE SQLSTATE 'PT409' USING MESSAGE='This request is not waiting for a decision.'; END IF;
    UPDATE public.funding_requests SET status='approval_queued',decision=decide_funding.decision,
      updated_at=now() WHERE id=request_id RETURNING * INTO funding;
    INSERT INTO public.workflow_events(request_id,message)
      VALUES(request_id,format('Human decision recorded: %s. Waiting for pg_durable.',decision));
    PERFORM public.start_funding_decision_handoff(request_id);
  END IF;
  PERFORM set_config('response.status','202',true);
  RETURN to_jsonb(funding)-'owner_id';
END $$;
ALTER FUNCTION api.decide_funding(uuid,text) OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.decide_funding(uuid,text) TO web_user;

CREATE FUNCTION api.expire_demo() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=8 AND owner_id=internal.actor()) THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE='Only the demo owner can move this deadline.';
  END IF;
  UPDATE public.projects SET deadline=now() WHERE id=8 AND status='active';
  PERFORM set_config('response.status','202',true);
  RETURN jsonb_build_object('message','WalkBlock is now due. pg_durable maintenance will expire it on its next five-second tick.');
END $$;
ALTER FUNCTION api.expire_demo() OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.expire_demo() TO web_user;

GRANT SELECT (pledged_cents,backers_count,status,category) ON public.projects TO analytics_executor;
GRANT SELECT (amount_cents,created_at) ON public.backings TO analytics_executor;
CREATE FUNCTION api.analytics() RETURNS jsonb STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp LANGUAGE plpgsql AS $$
DECLARE totals jsonb; daily jsonb; categories jsonb;
BEGIN
  -- PostgREST's JSON wrapper is not DuckDB SQL. Run only the fixed aggregates on
  -- a read-only loopback backend; leave unsafe function execution disabled.
  PERFORM public.dblink_connect('analytics',format('host=/var/run/postgresql port=%s dbname=%I user=analytics_executor',current_setting('port'),current_database()));
  PERFORM public.dblink_exec('analytics','BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  SELECT to_jsonb(t) INTO totals FROM public.dblink('analytics',
    'SELECT coalesce(sum(pledged_cents),0)::double precision,coalesce(sum(backers_count),0)::double precision,count(*)::double precision,count(*) FILTER(WHERE status=''funded'')::double precision,count(*) FILTER(WHERE status=''expired'')::double precision FROM public.projects')
    AS t(pledged_cents double precision,backers double precision,projects double precision,funded double precision,expired double precision);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.day),'[]'::jsonb) INTO daily FROM public.dblink('analytics',
    'SELECT (created_at AT TIME ZONE ''UTC'')::date::text AS day,sum(amount_cents)::double precision,count(*)::double precision FROM public.backings WHERE created_at>=(date_trunc(''day'',CURRENT_TIMESTAMP AT TIME ZONE ''UTC'')-interval ''13 days'') AT TIME ZONE ''UTC'' GROUP BY day ORDER BY day')
    AS t(day text,amount_cents double precision,backings double precision);
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.pledged_cents DESC,t.category),'[]'::jsonb) INTO categories FROM public.dblink('analytics',
    'SELECT category,sum(pledged_cents)::double precision FROM public.projects GROUP BY category ORDER BY 2 DESC,1')
    AS t(category text,pledged_cents double precision);
  PERFORM public.dblink_exec('analytics','COMMIT');
  PERFORM public.dblink_disconnect('analytics');
  RETURN jsonb_build_object('totals',totals,'daily',daily,'categories',categories,
    'source','Postgres + pg_duckdb','refreshed_at',floor(extract(epoch FROM clock_timestamp())*1000),
    'refresh_interval_seconds',5);
EXCEPTION WHEN OTHERS THEN
  IF 'analytics'=ANY(public.dblink_get_connections()) THEN PERFORM public.dblink_disconnect('analytics'); END IF;
  RAISE;
END $$;
REVOKE ALL ON FUNCTION api.analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.analytics() TO web_user;

CREATE FUNCTION api.health() RETURNS jsonb STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.scheduled_work WHERE name='maintenance'
    AND last_success_at>clock_timestamp()-interval '30 seconds') THEN
    RAISE SQLSTATE 'PT503' USING MESSAGE='pg_durable maintenance has not completed a recent successful tick.';
  END IF;
  RETURN jsonb_build_object('status','ok','checkpoint','05-generated-api');
END $$;
ALTER FUNCTION api.health() OWNER TO api_owner;
GRANT EXECUTE ON FUNCTION api.health() TO web_anon,web_user;
