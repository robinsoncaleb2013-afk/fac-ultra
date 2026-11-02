/* Sending the sign-in email (WP-9). A "sender" is just a function, so the provider is a one-line choice:

     RESEND_API_KEY set  -> Resend (https://resend.com), over plain fetch. FAC_EMAIL_FROM is the From line.
     nothing set         -> the log sender: the link is printed in the server's console and nothing is emailed.

   Nothing is returned to the browser either way: the link only ever travels by email (or the server log). */

export type Mail = { to: string; link: string; minutes: number };
export type MailSender = (mail: Mail) => Promise<void>;

export const subject = "Your FAC Ultra sign-in link";

export function textBody(m: Mail): string {
  return [
    "Hello!",
    "",
    "Tap this link to sign in to FAC Ultra and keep your fish safe in the cloud:",
    m.link,
    "",
    `It works once, for ${m.minutes} minutes. If you did not ask for it, you can ignore this email.`,
  ].join("\n");
}

function htmlBody(m: Mail): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<p>Hello!</p><p>Tap the button to sign in to FAC Ultra and keep your fish safe in the cloud.</p>` +
    `<p><a href="${esc(m.link)}" style="background:#d9a441;color:#1a1208;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Sign in to FAC Ultra</a></p>` +
    `<p style="color:#666">It works once, for ${m.minutes} minutes. If you did not ask for it, you can ignore this email.</p>`;
}

/** Prints the link to the server log. Fine for a home server you are sitting at. */
export const logSender: MailSender = async (m) => {
  console.log(`[accounts] Sign-in link for ${m.to} (no email provider set, so nothing was emailed):\n  ${m.link}`);
};

export function resendSender(apiKey: string, from: string, doFetch: typeof fetch = fetch): MailSender {
  return async (m) => {
    const res = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject, text: textBody(m), html: htmlBody(m) }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  };
}

/** Pick the sender from the environment. */
export function senderFromEnv(env: Record<string, string | undefined>, doFetch: typeof fetch = fetch): MailSender {
  const key = env.RESEND_API_KEY?.trim();
  if (key) return resendSender(key, env.FAC_EMAIL_FROM?.trim() || "FAC Ultra <onboarding@resend.dev>", doFetch);
  return logSender;
}

export const emailProvider = (env: Record<string, string | undefined>): "resend" | "log" => (env.RESEND_API_KEY?.trim() ? "resend" : "log");
