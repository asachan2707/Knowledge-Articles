/**
 * In-memory mock for BullMQ queues.
 * Jobs are logged to console and executed synchronously after a short delay
 * — simulating the worker picking them up — so you can see the full flow
 * without Redis running.
 */

// Shared job log you can inspect at /api/admin/jobs in mock mode
export const jobLog = [];

function makeQueue(name) {
  return {
    name,
    async add(jobName, data, _opts = {}) {
      const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const entry = { id, queue: name, jobName, data, queuedAt: new Date().toISOString(), status: 'queued' };
      jobLog.push(entry);
      console.log(`[mock-queue] ${name} ← ${jobName}`, JSON.stringify(data).slice(0, 120));

      // Simulate async worker pickup after 200ms
      setTimeout(async () => {
        entry.status = 'processing';
        try {
          await mockProcess(name, jobName, data);
          entry.status = 'completed';
          console.log(`[mock-worker] ${name}/${jobName} ${id} ✓`);
        } catch (err) {
          entry.status = 'failed';
          entry.error  = err.message;
          console.error(`[mock-worker] ${name}/${jobName} ${id} ✗`, err.message);
        }
      }, 200);

      return { id };
    },
  };
}

async function mockProcess(queue, jobName, data) {
  if (queue.startsWith('email:')) {
    // Mock email send — just log it
    const to      = data.email;
    const subject = queue === 'email:waitlist-confirm' ? `You're #${data.position} on the waitlist!`
                  : queue === 'email:launch-notify'    ? `🚀 ${data.productName} just launched!`
                  : 'Your NovaSpark Pro slot is confirmed!';
    console.log(`[mock-email] → ${to} | ${subject}`);
    return;
  }
  console.warn(`[mock-worker] No handler for queue "${queue}"`);
}

export const waitlistConfirmQueue = makeQueue('email:waitlist-confirm');
export const launchNotifyQueue    = makeQueue('email:launch-notify');
export const orderConfirmQueue    = makeQueue('email:order-confirm');

export const queueConnection = { host: 'mock', port: 0 };
