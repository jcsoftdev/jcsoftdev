import { describe, expect, it, vi } from 'vitest';
import { sendMagicLink } from './email.js';

// Fake Resend client — mirrors the shape we use (emails.send)
function makeFakeResend(spy: ReturnType<typeof vi.fn>) {
  return {
    emails: {
      send: spy,
    },
  };
}

describe('sendMagicLink', () => {
  it('calls resend.emails.send with correct recipient and subject', async () => {
    const spy = vi.fn().mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const fakeResend = makeFakeResend(spy);

    await sendMagicLink(
      {
        email: 'admin@jcsoftdev.com',
        url: 'https://api.jcsoftdev.com/auth/magic-link/verify?token=abc123',
        fromEmail: 'noreply@jcsoftdev.com',
      },
      fakeResend as any
    );

    expect(spy).toHaveBeenCalledOnce();
    // biome-ignore lint/suspicious/noExplicitAny: spy mock call args
    const call = spy.mock.calls[0]?.[0] as any;
    expect(call.to).toBe('admin@jcsoftdev.com');
    expect(call.from).toBe('noreply@jcsoftdev.com');
    expect(call.subject).toBe('Your sign-in link for jcsoftdev');
  });

  it('includes the callback URL in both text and html body', async () => {
    const spy = vi.fn().mockResolvedValue({ data: { id: 'msg_124' }, error: null });
    const fakeResend = makeFakeResend(spy);
    const url = 'https://api.jcsoftdev.com/auth/magic-link/verify?token=tok_xyz';

    await sendMagicLink(
      {
        email: 'admin@jcsoftdev.com',
        url,
        fromEmail: 'noreply@jcsoftdev.com',
      },
      fakeResend as any
    );

    // biome-ignore lint/suspicious/noExplicitAny: spy mock call args
    const call = spy.mock.calls[0]?.[0] as any;
    expect(call.text).toContain(url);
    expect(call.html).toContain(url);
  });

  it('includes text and html fields in the payload', async () => {
    const spy = vi.fn().mockResolvedValue({ data: { id: 'msg_125' }, error: null });
    const fakeResend = makeFakeResend(spy);

    await sendMagicLink(
      {
        email: 'admin@jcsoftdev.com',
        url: 'https://api.jcsoftdev.com/auth/magic-link/verify?token=tok',
        fromEmail: 'noreply@jcsoftdev.com',
      },
      fakeResend as any
    );

    // biome-ignore lint/suspicious/noExplicitAny: spy mock call args
    const call = spy.mock.calls[0]?.[0] as any;
    expect(typeof call.text).toBe('string');
    expect(typeof call.html).toBe('string');
    expect(call.text.length).toBeGreaterThan(0);
    expect(call.html.length).toBeGreaterThan(0);
  });

  it('throws if resend returns an error', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Invalid API key', statusCode: 401 } });
    const fakeResend = makeFakeResend(spy);

    await expect(
      sendMagicLink(
        {
          email: 'admin@jcsoftdev.com',
          url: 'https://api.jcsoftdev.com/auth/magic-link/verify?token=tok',
          fromEmail: 'noreply@jcsoftdev.com',
        },
        fakeResend as any
      )
    ).rejects.toThrow(/Invalid API key/);
  });
});
