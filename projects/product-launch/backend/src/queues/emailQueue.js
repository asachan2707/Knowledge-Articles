import 'dotenv/config';

const USE_MOCKS = process.env.USE_MOCKS === 'true';

let waitlistConfirmQueue, launchNotifyQueue, orderConfirmQueue, queueConnection;

if (USE_MOCKS) {
  const mock = await import('../mocks/queues.js');
  waitlistConfirmQueue = mock.waitlistConfirmQueue;
  launchNotifyQueue    = mock.launchNotifyQueue;
  orderConfirmQueue    = mock.orderConfirmQueue;
  queueConnection      = mock.queueConnection;
  console.log('[queue] Using in-memory mock queues (USE_MOCKS=true)');
} else {
  const { Queue } = await import('bullmq');

  queueConnection = {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
    port: Number(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port) || 6379,
  };

  waitlistConfirmQueue = new Queue('email:waitlist-confirm', { connection: queueConnection });
  launchNotifyQueue    = new Queue('email:launch-notify',    { connection: queueConnection });
  orderConfirmQueue    = new Queue('email:order-confirm',    { connection: queueConnection });
}

export { waitlistConfirmQueue, launchNotifyQueue, orderConfirmQueue, queueConnection };
