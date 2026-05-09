/**
 * Email helpers — Phase 4
 *
 * Wraps Resend SDK for sending magic-link emails.
 * The Resend client is injected as a parameter so callers (and tests)
 * can swap it for a fake without mocking the module.
 */

/**
 * Minimal interface we need from the Resend SDK.
 * Using a structural type rather than the concrete Resend class keeps
 * this module testable without importing the real SDK in tests.
 */
export interface ResendEmailsClient {
  emails: {
    send(payload: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
}

export interface MagicLinkEmailInput {
  /** Recipient email address */
  email: string;
  /** Full signed callback URL — clicking this logs the user in */
  url: string;
  /** Sender email address (from RESEND_FROM_EMAIL env) */
  fromEmail: string;
}

/**
 * Send a magic-link sign-in email via Resend.
 *
 * @param input - Recipient, callback URL, and sender address
 * @param client - Resend client (injected for testability)
 *
 * @throws If Resend returns an error object
 */
export async function sendMagicLink(
  input: MagicLinkEmailInput,
  client: ResendEmailsClient
): Promise<void> {
  const { email, url, fromEmail } = input;

  const text = buildPlainText(url);
  const html = buildHtml(url);

  const { error } = await client.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your sign-in link for jcsoftdev',
    text,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function buildPlainText(url: string): string {
  return [
    'Sign in to jcsoftdev',
    '',
    'Click the link below to sign in. The link expires in 15 minutes and can only be used once.',
    '',
    url,
    '',
    "If you didn't request this link, you can safely ignore this email.",
  ].join('\n');
}

function buildHtml(url: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to jcsoftdev</title>
</head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <h1 style="font-size:20px;margin-bottom:8px;">Sign in to jcsoftdev</h1>
  <p style="margin-bottom:24px;color:#444;">
    Click the button below to sign in. The link expires in <strong>15 minutes</strong>
    and can only be used once.
  </p>
  <a href="${url}"
     style="display:inline-block;padding:12px 24px;background:#111;color:#fff;
            text-decoration:none;border-radius:4px;font-weight:600;">
    Sign in
  </a>
  <p style="margin-top:24px;font-size:13px;color:#888;">
    Or copy and paste this URL into your browser:<br />
    <a href="${url}" style="color:#555;word-break:break-all;">${url}</a>
  </p>
  <hr style="margin-top:32px;border:none;border-top:1px solid #eee;" />
  <p style="font-size:12px;color:#aaa;">
    If you didn't request this link, you can safely ignore this email.
  </p>
</body>
</html>`;
}
