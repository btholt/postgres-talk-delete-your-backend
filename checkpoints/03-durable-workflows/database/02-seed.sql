-- Hand-authored six-dimensional demo vectors: mobility, food, automation, work, pets, finance.
-- Stable IDs and vectors are intentionally reusable in later independent checkpoints.
INSERT INTO projects
  (id, name, tagline, description, category, founder, location, goal_cents, pledged_cents, backers_count, deadline, reward, color, embedding)
VALUES
  (1, 'Honk', 'Uber for geese. Surge pricing. Naturally.',
   'Urban mobility has a last-mile problem. Geese have a people problem. We are bringing these two underserved markets together with an on-demand, goose-powered transport network. Every ride includes a complimentary disagreement. Our pilot fleet is currently occupying a Toronto parking lot.',
   'Transportation', 'Amelia Pond', 'Toronto, ON', 2500000, 1875000, 124, now() + interval '18 days',
   'A founding flock membership and one extremely conditional ride.', 'sage', '[0.94,0.02,0.08,0.08,0.82,0.04]'),
  (2, 'BreadOps', 'Kubernetes. For your sourdough starter.',
   'Your starter deserves production-grade infrastructure. BreadOps orchestrates fermentation across a highly available cluster of mason jars. Autoscale feeding, roll back a disappointing loaf, and finally put your sourdough on call. Gluten-free support is on the roadmap.',
   'Food & Drink', 'Oliver Crumb', 'Portland, OR', 1800000, 1422000, 86, now() + interval '12 days',
   'One enterprise mason jar and a lifetime of YAML.', 'peach', '[0.03,0.98,0.70,0.28,0.02,0.04]'),
  (3, 'Unsubscribed', 'One subscription. To cancel the others.',
   'Take back control of your recurring payments with a new recurring payment. Our concierge identifies subscriptions you forgot about, navigates the cancellation maze, and sends a monthly report of your savings. Cancelling Unsubscribed requires a brief phone call during a full moon.',
   'Technology', 'Nina Loop', 'Austin, TX', 3000000, 2640000, 211, now() + interval '24 days',
   'Three months of cancellations. Automatically renews.', 'lavender', '[0.04,0.02,0.80,0.30,0.03,0.99]'),
  (4, 'Stand-in', 'Your AI agent. Their AI agent. Great meeting.',
   'A meeting assistant that does not assist you in meetings. It attends instead. Stand-in sends an agent to speak to everyone else''s agents, generates action items for other agents, and schedules the follow-up. You get your Tuesday back. The agents get a sense of purpose.',
   'Technology', 'Miles Agenda', 'San Francisco, CA', 4000000, 3280000, 176, now() + interval '9 days',
   'A founding agent with an unnecessarily impressive job title.', 'blue', '[0.02,0.04,0.96,0.99,0.02,0.22]'),
  (5, 'Petflix', 'Prestige television. For your houseplant.',
   'Your monstera has been staring at the same wall for years. Petflix streams slow, emotionally nuanced programming designed for plants. Launch titles include Window, Window at Dusk, and the critically acclaimed Is That a Watering Can? No account sharing between pots.',
   'Design', 'Fern Wallace', 'Vancouver, BC', 1200000, 552000, 62, now() + interval '21 days',
   'A premium plant profile and one tiny remote.', 'yellow', '[0.04,0.18,0.21,0.08,0.90,0.12]'),
  (6, 'Reply All', 'An inbox that answers itself. To itself.',
   'We have built the first fully closed-loop email ecosystem. An agent writes your emails, another agent reads them, and a third asks if you saw the first email. Our beta customers have achieved inbox zero without achieving anything else.',
   'Technology', 'Ada Thread', 'New York, NY', 2200000, 1298000, 98, now() + interval '16 days',
   'A custom email signature and 10,000 warm regards.', 'pink', '[0.02,0.02,0.94,0.96,0.03,0.18]'),
  (7, 'Crumb & Go', 'The meal kit for feeding your starter.',
   'Farm-to-jar nutrition for the most demanding member of your household. Receive precisely portioned flour, filtered water, and a handwritten note of encouragement every week. Because keeping a sourdough starter alive should feel like a lifestyle.',
   'Food & Drink', 'Theo Rise', 'Brooklyn, NY', 1500000, 975000, 75, now() + interval '28 days',
   'A starter starter kit. Starter not included.', 'mint', '[0.06,0.97,0.30,0.04,0.18,0.08]'),
  (8, 'WalkBlock', 'A blockchain. For walking around the block.',
   'Proof of walk is the consensus mechanism the sidewalk has been waiting for. Log every lap, mint a non-fungible footprint, and earn a token whose utility is still being workshopped. Our step counter uses a distributed ledger for reasons our CTO will explain after the next funding round.',
   'Transportation', 'Max Ledger', 'Denver, CO', 2000000, 340000, 42, now() + interval '7 days',
   'A limited-edition left footprint. Gas fees not included.', 'sand', '[0.91,0.02,0.35,0.09,0.18,0.85]');

INSERT INTO backings (id, project_id, amount_cents, created_at)
SELECT
  md5('kickstopper-' || p.id || '-' || n)::uuid,
  p.id,
  p.pledged_cents / p.backers_count + CASE WHEN n <= p.pledged_cents % p.backers_count THEN 1 ELSE 0 END,
  date_trunc('day', now()) - make_interval(days => (n * 7 + p.id * 3) % 28) + interval '12 hours'
FROM projects p CROSS JOIN LATERAL generate_series(1, p.backers_count) n;
