const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

webpush.setVapidDetails(
  'mailto:marvinsinclair3@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let senderDeviceId;
  try {
    ({ senderDeviceId } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Bad request' };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .neq('device_id', senderDeviceId || '');

  if (error) {
    console.error('Supabase error', error);
    return { statusCode: 500, body: 'DB error' };
  }

  const payload = JSON.stringify({
    title: 'Notes',
    body: 'Note updated',
    icon: '/icons/notes-icon-192.png',
  });

  const results = await Promise.allSettled(
    subs.map((row) =>
      webpush.sendNotification(row.subscription, payload).catch((err) => {
        // Remove expired/invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          return supabase.from('push_subscriptions').delete().eq('id', row.id);
        }
        throw err;
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { statusCode: 200, body: JSON.stringify({ sent }) };
};
