/**
 * Email worker — runs as a separate process.
 * Start with: npm run worker
 *
 * In production this fleet scales independently from the API servers.
 * Rate-limited to stay within SMTP provider limits.
 */
import 'dotenv/config';
import { Worker } from 'bullmq';
import { queueConnection } from '../queues/emailQueue.js';

// ── Mock email sender (replace with nodemailer + real SMTP in production) ──
async function sendEmail({ to, subject, html }) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 80 + Math.random() * 120));
  console.log(`[email] → ${to} | ${subject}`);
  // In production:
  // await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
}

// ── Template builders ──────────────────────────────────────────────────────
function waitlistConfirmHtml({ name, position }) {
  return `<h2>You're on the list, ${name}!</h2>
<p>You're <strong>#${position}</strong> on the waitlist for NovaSpark Pro.</p>
<p>We'll email you the moment we launch — and early-access slots go to the list first.</p>`;
}

function launchNotifyHtml({ name, productName }) {
  return `<h2>🚀 ${productName} is LIVE, ${name}!</h2>
<p>The wait is over. Click below to grab your early-access slot before they're gone.</p>
<p><a href="http://localhost:5173" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px;">Claim my slot →</a></p>`;
}

function orderConfirmHtml({ name, reservationId }) {
  return `<h2>Your slot is confirmed, ${name}!</h2>
<p>Reservation ID: <code>${reservationId}</code></p>
<p>You're locked in. We'll be in touch with next steps.</p>`;
}

// ── Workers ────────────────────────────────────────────────────────────────
const waitlistWorker = new Worker('email:waitlist-confirm', async (job) => {
  const { name, email, position } = job.data;
  await sendEmail({
    to:      email,
    subject: `You're #${position} on the waitlist!`,
    html:    waitlistConfirmHtml({ name, position }),
  });
}, {
  connection: queueConnection,
  concurrency: 10,
  limiter: { max: 50, duration: 1000 },
});

const launchWorker = new Worker('email:launch-notify', async (job) => {
  const { name, email, productName } = job.data;
  await sendEmail({
    to:      email,
    subject: `🚀 ${productName} just launched — your early access is waiting`,
    html:    launchNotifyHtml({ name, productName }),
  });
}, {
  connection: queueConnection,
  concurrency: 20,       // blast the list fast on launch
  limiter: { max: 100, duration: 1000 },
});

const orderWorker = new Worker('email:order-confirm', async (job) => {
  const { name, email, reservationId } = job.data;
  await sendEmail({
    to:      email,
    subject: 'Your NovaSpark Pro slot is confirmed!',
    html:    orderConfirmHtml({ name, reservationId }),
  });
}, {
  connection: queueConnection,
  concurrency: 10,
  limiter: { max: 50, duration: 1000 },
});

// ── Error handling ─────────────────────────────────────────────────────────
for (const [name, worker] of [
  ['waitlist', waitlistWorker],
  ['launch',   launchWorker],
  ['order',    orderWorker],
]) {
  worker.on('completed', (job) =>
    console.log(`[${name}] job ${job.id} completed`)
  );
  worker.on('failed', (job, err) =>
    console.error(`[${name}] job ${job?.id} failed:`, err.message)
  );
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown() {
  console.log('[worker] Shutting down...');
  await Promise.all([
    waitlistWorker.close(),
    launchWorker.close(),
    orderWorker.close(),
  ]);
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

console.log('[worker] Email worker fleet started. Waiting for jobs...');
