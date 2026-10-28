CREATE TABLE projects (
  id integer PRIMARY KEY,
  name text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  founder text NOT NULL,
  location text NOT NULL,
  goal_cents integer NOT NULL CHECK (goal_cents > 0),
  pledged_cents integer NOT NULL DEFAULT 0 CHECK (pledged_cents >= 0),
  backers_count integer NOT NULL DEFAULT 0,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'funded', 'expired')),
  reward text NOT NULL,
  color text NOT NULL,
  embedding jsonb NOT NULL
);

CREATE TABLE backings (
  id uuid PRIMARY KEY,
  project_id integer NOT NULL REFERENCES projects(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX backings_project_id ON backings(project_id);

CREATE TABLE funding_requests (
  id uuid PRIMARY KEY,
  project_id integer NOT NULL UNIQUE REFERENCES projects(id),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued', 'awaiting_approval', 'approval_queued', 'completed', 'rejected', 'ineligible')),
  risk_score integer,
  grant_cents integer NOT NULL DEFAULT 0,
  decision text CHECK (decision IN ('approve', 'reject')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflow_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES funding_requests(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES funding_requests(id),
  kind text NOT NULL CHECK (kind IN ('check', 'decide')),
  published_at timestamptz
);
