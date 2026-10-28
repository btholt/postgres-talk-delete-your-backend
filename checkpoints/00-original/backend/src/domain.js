export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function projectId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Choose a valid project.');
  return id;
}

export function backingAmount(value) {
  if (!Number.isSafeInteger(value) || value < 500 || value > 1000000) {
    throw new HttpError(400, 'Back between $5 and $10,000, using whole cents.');
  }
  return value;
}

export function requestId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, 'A UUID v4 idempotency key is required.');
  }
  return value;
}

export function assessFunding(project) {
  const eligible = project.status !== 'expired' && new Date(project.deadline) > new Date()
    && project.pledged_cents >= project.goal_cents * 0.2;
  const riskScore = 15 + (project.id * 17) % 61;
  return { eligible, riskScore, grantCents: Math.min(500000, Math.round(project.goal_cents * 0.1)) };
}

export const semanticQueries = [
  { id: 'meetings', label: 'Less busywork, fewer meetings', vector: [0.02, 0.04, 0.96, 0.99, 0.02, 0.22] },
  { id: 'bread', label: 'An unnecessarily technical loaf of bread', vector: [0.03, 0.98, 0.6, 0.16, 0.08, 0.04] },
  { id: 'geese', label: 'Getting around, with questionable animals', vector: [0.94, 0.02, 0.08, 0.08, 0.82, 0.04] },
  { id: 'subscriptions', label: 'Automating my financial regrets', vector: [0.04, 0.02, 0.8, 0.3, 0.03, 0.99] },
];
