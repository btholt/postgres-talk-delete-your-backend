import amqp from 'amqplib';
import { createServer } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { pool, transaction, recordEvent } from './database.js';
import { assessFunding } from './domain.js';

const queueName = 'kickstopper.funding';
const connection = await amqp.connect(process.env.AMQP_URL);
connection.on('error', error => console.error('RabbitMQ connection error:', error));
connection.on('close', () => { console.error('RabbitMQ connection closed; restarting worker.'); process.exit(1); });
const publisher = await connection.createConfirmChannel();
const consumer = await connection.createChannel();
for (const channel of [publisher, consumer]) {
  channel.on('error', error => { console.error('RabbitMQ channel failed:', error); process.exit(1); });
}
await publisher.assertQueue(queueName, { durable: true });
await consumer.prefetch(1);

await consumer.consume(queueName, async message => {
  if (!message) return;
  try {
    const job = JSON.parse(message.content.toString());
    await transaction(async client => {
      const { rows } = await client.query('SELECT * FROM funding_requests WHERE id=$1 FOR UPDATE', [job.requestId]);
      const funding = rows[0];
      if (!funding) throw new Error(`Missing funding request ${job.requestId}`);
      if (job.kind === 'check' && funding.status === 'queued') {
        const project = await client.query('SELECT * FROM projects WHERE id=$1', [funding.project_id]);
        const assessment = assessFunding(project.rows[0]);
        await recordEvent(client, funding.id, assessment.eligible ? 'Eligibility checked: campaign has at least 20% support.' : 'Eligibility failed: campaign ended or has less than 20% support.');
        await recordEvent(client, funding.id, `Deterministic fake risk score: ${assessment.riskScore}/100. No external scoring service.`);
        await client.query('UPDATE funding_requests SET status=$2, risk_score=$3, updated_at=now() WHERE id=$1', [
          funding.id, assessment.eligible ? 'awaiting_approval' : 'ineligible', assessment.riskScore,
        ]);
        if (assessment.eligible) await recordEvent(client, funding.id, 'Waiting for a human decision. Open the funding desk.');
      } else if (job.kind === 'decide' && funding.status === 'approval_queued') {
        const project = await client.query('SELECT * FROM projects WHERE id=$1', [funding.project_id]);
        const grant = funding.decision === 'approve' ? assessFunding(project.rows[0]).grantCents : 0;
        await client.query('UPDATE funding_requests SET status=$2, grant_cents=$3, updated_at=now() WHERE id=$1', [
          funding.id, funding.decision === 'approve' ? 'completed' : 'rejected', grant,
        ]);
        await recordEvent(client, funding.id, grant ? `Approved. A simulated $${(grant / 100).toFixed(2)} grant was recorded. No money moved.` : 'Request declined. No money moved.');
      }
    });
    consumer.ack(message);
  } catch (error) {
    console.error('Funding job failed; RabbitMQ will redeliver:', error);
    consumer.nack(message, false, true);
  }
});

let lastPublishTick = Date.now();
createServer(async (_request, response) => {
  const healthy = Date.now() - lastPublishTick < 30000;
  response.writeHead(healthy ? 200 : 503).end(healthy ? 'ok' : 'outbox publisher stalled');
}).listen(3002);

console.log('Funding worker consuming RabbitMQ; publishing transactional outbox every second.');
while (true) {
  const { rows } = await pool.query('SELECT id, request_id, kind FROM outbox WHERE published_at IS NULL ORDER BY id LIMIT 50');
  for (const job of rows) {
    publisher.sendToQueue(queueName, Buffer.from(JSON.stringify({ requestId: job.request_id, kind: job.kind })), { persistent: true });
    await publisher.waitForConfirms();
    await pool.query('UPDATE outbox SET published_at=now() WHERE id=$1', [job.id]);
  }
  lastPublishTick = Date.now();
  await setTimeout(1000);
}
