const botToken = requiredEnvironment("TELEGRAM_BOT_TOKEN");
const webhookSecret = requiredEnvironment("TELEGRAM_WEBHOOK_SECRET");
const publicApiUrl = requiredEnvironment("BETTER_AUTH_URL").replace(/\/$/, "");

if (!publicApiUrl.startsWith("https://")) {
  throw new Error("BETTER_AUTH_URL must use HTTPS when configuring the Telegram webhook");
}

const response = await fetch(
  `https://api.telegram.org/bot${botToken}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${publicApiUrl}/api/telegram/webhook`,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
    signal: AbortSignal.timeout(10_000),
  },
);

const result = await response.json();

if (!response.ok || result?.ok !== true) {
  throw new Error(
    `Telegram webhook configuration failed with status ${response.status}`,
  );
}

console.log(`Telegram webhook configured for ${publicApiUrl}/api/telegram/webhook`);

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

