import { env, isProduction } from '../env.js';

const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

type Address = { email: string; name?: string };

/** Accepts either `someone@example.com` or `Name <someone@example.com>`. */
function parseAddress(value: string): Address {
  const match = /^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/.exec(value);
  if (!match) return { email: value.trim() };

  const name = match[1]?.replace(/^"|"$/g, '').trim();
  const email = match[2]!.trim();
  return name ? { email, name } : { email };
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  // Without a key, mail is logged rather than sent. That keeps local
  // development working and makes a misconfigured production box loud.
  if (!env.SENDGRID_API_KEY) {
    if (isProduction) {
      throw new Error('SENDGRID_API_KEY is not set but mail delivery was attempted');
    }
    console.log('\n--- mail (not sent, no SendGrid key) ---');
    console.log(`to: ${options.to}\nsubject: ${options.subject}\n\n${options.text}`);
    console.log('--- end mail ---\n');
    return;
  }

  const personalization: Record<string, unknown> = { to: [{ email: options.to }] };
  if (env.MAIL_BCC) {
    // SendGrid rejects a personalization where the same address appears twice.
    const bcc = parseAddress(env.MAIL_BCC).email;
    if (bcc.toLowerCase() !== options.to.toLowerCase()) {
      personalization.bcc = [{ email: bcc }];
    }
  }

  const content: Array<{ type: string; value: string }> = [
    { type: 'text/plain', value: options.text },
  ];
  if (options.html) content.push({ type: 'text/html', value: options.html });

  const response = await fetch(SENDGRID_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [personalization],
      from: parseAddress(env.MAIL_FROM),
      subject: options.subject,
      content,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    // SendGrid puts the actual reason in the body; a bare status is useless
    // when a sender identity is unverified, which is the usual first failure.
    const detail = await response.text().catch(() => '');
    throw new Error(`SendGrid rejected the message (${response.status}): ${detail.slice(0, 500)}`);
  }
}
