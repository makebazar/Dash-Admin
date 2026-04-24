const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

async function run() {
  const token = process.env.MAX_BOT_TOKEN
  const secret = process.env.MAX_WEBHOOK_SECRET
  const baseUrl = process.env.DASHADMIN_SERVER_URL || 'https://www.mydashadmin.ru'
  if (!token) throw new Error('MAX_BOT_TOKEN missing')
  if (!secret) throw new Error('MAX_WEBHOOK_SECRET missing')

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/integrations/max/webhook`

  const res = await fetch('https://platform-api.max.ru/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      update_types: ['message_created', 'bot_started'],
      secret,
    }),
  })

  const json = await res.json().catch(() => null)
  console.log(JSON.stringify({ status: res.status, json, webhookUrl }, null, 2))
  if (!res.ok) process.exit(1)
}

run().catch((e) => {
  console.error(String(e && e.message ? e.message : e))
  process.exit(1)
})
