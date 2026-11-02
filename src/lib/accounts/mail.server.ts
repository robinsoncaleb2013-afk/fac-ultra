/* Sending the sign-in email (WP-9). A "sender" is just a function, so the provider is a one-line choice:

     RESEND_API_KEY set  -> Resend (https://resend.com), over plain fetch. FAC_EMAIL_FROM is the From line.
     nothing set         -> the log sender: the link is printed in the server's console and nothing is emailed.

   Nothing is returned to the browser either way: the link only ever travels by email (or the server log). */

export type Mail = {
  to: string;
  link: string;
  minutes: number;
  /** WP-10: "invite" is a friend invite from another player (the link adds them as a request, it signs nobody in). */
  kind?: "invite";
  /** The inviting player's display name (invites only). */
  from?: string;
};
export type MailSender = (mail: Mail) => Promise<void>;

export const subject = "Your FAC Ultra sign-in link";

export const subjectFor = (m: Mail) => (m.kind === "invite" ? `${m.from || "A friend"} invited you to fish together on FAC Ultra` : subject);

export function textBody(m: Mail): string {
  if (m.kind === "invite") {
    return [
      "Hello!",
      "",
      `${m.from || "A friend"} would like to be your fishing friend on FAC Ultra, a painted fishing game.`,
      "Open this link to see the request. You choose whether to accept:",
      m.link,
      "",
      `The link works for ${Math.round(m.minutes / 60 / 24)} days. If you do not know who this is, you can ignore this email and nothing will happen.`,
    ].join("\n");
  }
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
  if (m.kind === "invite") {
    return `<p>Hello!</p><p>${esc(m.from || "A friend")} would like to be your fishing friend on FAC Ultra, a painted fishing game.</p>` +
      `<p><a href="${esc(m.link)}" style="background:#d9a441;color:#1a1208;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">See the request</a></p>` +
      `<p style="color:#666">You choose whether to accept. If you do not know who this is, ignore this email and nothing will happen.</p>`;
  }
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
      body: JSON.stringify({ from, to: [m.to], subject: subjectFor(m), text: textBody(m), html: htmlBody(m) }),
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
