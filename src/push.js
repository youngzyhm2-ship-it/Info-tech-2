const webpush = require('web-push');
const db = require('./db');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

const enabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (enabled) {
  webpush.setVapidDetails(
    'mailto:notifications@infotechzone.ng',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications are disabled.');
}

/** Sends a notification payload to every stored subscription. Removes any
 *  subscription the push service reports as gone (410) or not found (404) —
 *  that's the browser telling us it will never accept pushes there again. */
async function notifyAllSubscribers(payload) {
  if (!enabled) return { sent: 0, skipped: true };

  const subs = db.prepare('SELECT * FROM push_subscriptions').all();
  const body = JSON.stringify(payload);
  let sent = 0;

  await Promise.all(subs.map(async (sub) => {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(subscription, body);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
      } else {
        console.warn('push send failed', sub.id, err.statusCode, err.message);
      }
    }
  }));

  return { sent, skipped: false, total: subs.length };
}

module.exports = { enabled, notifyAllSubscribers, VAPID_PUBLIC_KEY };
