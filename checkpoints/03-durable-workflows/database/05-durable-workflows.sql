CREATE EXTENSION pg_durable WITH VERSION '0.2.9';

CREATE TABLE scheduled_work (
  name text PRIMARY KEY,
  workflow_instance_id text NOT NULL UNIQUE,
  last_success_at timestamptz
);

CREATE FUNCTION durable_ready() RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  engine_schema text := df.duroxide_schema();
  ready boolean;
BEGIN
  IF to_regclass(format('%I._worker_ready', engine_schema)) IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I._worker_ready WHERE schema_version >= 2)', engine_schema)
    INTO ready;
  RETURN ready;
END;
$$;

CREATE FUNCTION check_funding_eligibility(request_id uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  funding funding_requests%ROWTYPE;
  project projects%ROWTYPE;
  is_eligible boolean;
BEGIN
  SELECT * INTO STRICT funding FROM funding_requests WHERE id = request_id FOR UPDATE;
  IF funding.eligible IS NOT NULL THEN RETURN funding.eligible; END IF;
  SELECT * INTO STRICT project FROM projects WHERE id = funding.project_id;
  is_eligible := project.status <> 'expired' AND project.deadline > clock_timestamp()
    AND project.pledged_cents >= project.goal_cents * 0.2;
  UPDATE funding_requests SET eligible = is_eligible,
    status = CASE WHEN is_eligible THEN status ELSE 'ineligible' END,
    updated_at = now() WHERE id = request_id;
  INSERT INTO workflow_events (request_id, message) VALUES (request_id,
    CASE WHEN is_eligible THEN 'Eligibility checked: campaign has at least 20% support.'
    ELSE 'Eligibility failed: campaign ended or has less than 20% support.' END);
  RETURN is_eligible;
END;
$$;

CREATE FUNCTION calculate_funding_risk(request_id uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  funding funding_requests%ROWTYPE;
  score integer;
BEGIN
  SELECT * INTO STRICT funding FROM funding_requests WHERE id = request_id FOR UPDATE;
  IF funding.risk_score IS NOT NULL THEN RETURN funding.risk_score; END IF;
  IF funding.eligible IS NULL THEN RAISE EXCEPTION 'Eligibility has not been checked'; END IF;
  score := 15 + (funding.project_id * 17) % 61;
  UPDATE funding_requests SET risk_score = score,
    status = CASE WHEN funding.eligible THEN 'awaiting_approval' ELSE 'ineligible' END,
    updated_at = now() WHERE id = request_id;
  INSERT INTO workflow_events (request_id, message)
    VALUES (request_id, format('Deterministic fake risk score: %s/100. No external scoring service.', score));
  IF funding.eligible THEN
    INSERT INTO workflow_events (request_id, message)
      VALUES (request_id, 'Waiting for a human decision. Open the funding desk.');
  END IF;
  RETURN score;
END;
$$;

CREATE FUNCTION finish_funding(request_id uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  funding funding_requests%ROWTYPE;
  grant_amount integer := 0;
BEGIN
  SELECT * INTO STRICT funding FROM funding_requests WHERE id = request_id FOR UPDATE;
  IF funding.status IN ('completed', 'rejected') THEN RETURN funding.grant_cents; END IF;
  IF funding.status <> 'approval_queued' OR funding.decision IS NULL THEN
    RAISE EXCEPTION 'No committed human decision for request %', request_id;
  END IF;
  IF funding.decision = 'approve' THEN
    SELECT least(500000, round(goal_cents * 0.1)::integer) INTO STRICT grant_amount
      FROM projects WHERE id = funding.project_id;
  END IF;
  UPDATE funding_requests SET grant_cents = grant_amount,
    status = CASE WHEN funding.decision = 'approve' THEN 'completed' ELSE 'rejected' END,
    updated_at = now() WHERE id = request_id;
  INSERT INTO workflow_events (request_id, message) VALUES (request_id,
    CASE WHEN funding.decision = 'approve'
      THEN format('Approved. A simulated $%s grant was recorded. No money moved.',
        to_char(grant_amount / 100.0, 'FM999999990.00'))
      ELSE 'Request declined. No money moved.' END);
  RETURN grant_amount;
END;
$$;

CREATE FUNCTION start_funding_workflow(request_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT df.start(
    format('SELECT public.check_funding_eligibility(%L::uuid)', request_id)
    ~> format('SELECT public.calculate_funding_risk(%L::uuid)', request_id)
    ~> df.if(
      format('SELECT eligible FROM public.funding_requests WHERE id = %L::uuid', request_id),
      df.wait_for_signal('approval') ~> format('SELECT public.finish_funding(%L::uuid)', request_id),
      'SELECT true'
    ),
    'funding:' || request_id
  );
$$;

CREATE FUNCTION start_funding_decision_handoff(request_id uuid) RETURNS text LANGUAGE sql AS $$
  SELECT df.start(
    df.loop(
      format('SELECT df.signal(%L, %L, %L)', workflow_instance_id, 'approval',
        jsonb_build_object('decision', decision)::text) ~> df.sleep(1),
      format('SELECT status = ''approval_queued'' FROM public.funding_requests WHERE id = %L::uuid', request_id)
    ),
    'funding-decision:' || request_id
  ) FROM funding_requests WHERE id = request_id;
$$;

CREATE FUNCTION maintain_campaigns() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  expired integer;
BEGIN
  UPDATE projects SET status = 'expired'
    WHERE deadline <= clock_timestamp() AND pledged_cents < goal_cents AND status = 'active';
  GET DIAGNOSTICS expired = ROW_COUNT;
  DELETE FROM project_summary_cache WHERE expires_at <= clock_timestamp();
  IF expired > 0 THEN RAISE LOG 'pg_durable expired % campaigns', expired; END IF;
  RETURN expired;
END;
$$;

CREATE FUNCTION finish_maintenance(http_status integer) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  IF http_status IS NULL OR http_status < 200 OR http_status >= 300 THEN
    RAISE EXCEPTION 'Warehouse refresh activity returned HTTP %', http_status;
  END IF;
  UPDATE scheduled_work SET last_success_at = clock_timestamp() WHERE name = 'maintenance';
  RETURN true;
END;
$$;

CREATE FUNCTION start_maintenance_workflow() RETURNS text LANGUAGE sql AS $$
  SELECT df.start(
    df.loop(
      df.sleep(5)
      ~> 'SELECT public.maintain_campaigns()'
      ~> (df.http('http://api:3001/internal/analytics/refresh', 'POST', '{}',
        '{"Content-Type":"application/json","X-Kickstopper-Activity":"kickstopper-local-activity"}', 15) |=> 'warehouse')
      ~> 'SELECT public.finish_maintenance(($warehouse::jsonb->>''status'')::integer)',
      continue_on_failure => true
    ),
    'maintenance'
  );
$$;
