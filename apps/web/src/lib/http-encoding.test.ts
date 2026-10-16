import { describe, expect, it } from 'vitest';
import {
  isCompressible,
  pickEncoding,
  shouldCompress,
  withVaryAcceptEncoding,
} from './http-encoding';

describe('pickEncoding', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['identity', null],
    ['gzip, deflate, br, zstd', 'br'],
    ['gzip', 'gzip'],
    ['br;q=0, gzip', 'gzip'],
    ['br;q=0, gzip;q=0', null],
    ['*', 'br'],
    ['*;q=0', null],
    ['br;q=0, *', 'gzip'],
    ['GZIP;Q=0.5', 'gzip'],
  ])('%s -> %s', (header, expected) => {
    expect(pickEncoding(header)).toBe(expected);
  });
});

describe('isCompressible', () => {
  it.each([
    ['text/html', true],
    ['text/html; charset=utf-8', true],
    ['application/rss+xml', true],
    ['application/json', true],
    ['image/svg+xml', true],
    ['image/png', false],
    ['font/woff2', false],
    [null, false],
  ])('%s -> %s', (type, expected) => {
    expect(isCompressible(type)).toBe(expected);
  });
});

describe('withVaryAcceptEncoding', () => {
  it('adds, appends and does not duplicate', () => {
    expect(withVaryAcceptEncoding(null)).toBe('Accept-Encoding');
    expect(withVaryAcceptEncoding('Origin')).toBe('Origin, Accept-Encoding');
    expect(withVaryAcceptEncoding('origin, accept-encoding')).toBe('origin, accept-encoding');
    expect(withVaryAcceptEncoding('*')).toBe('*');
  });
});

describe('shouldCompress', () => {
  const req = (method = 'GET', ae = 'gzip, br') =>
    new Request('http://x/', { method, headers: { 'accept-encoding': ae } });
  const res = (status = 200, headers: Record<string, string> = { 'content-type': 'text/html' }) =>
    new Response(status === 204 || status === 304 ? null : 'body', { status, headers });

  it('compresses an html page for a client that accepts brotli', () => {
    expect(shouldCompress(req(), res())).toBe('br');
  });

  it('leaves HEAD, empty, already-encoded and binary responses alone', () => {
    expect(shouldCompress(req('HEAD'), res())).toBeNull();
    expect(shouldCompress(req(), res(304))).toBeNull();
    expect(
      shouldCompress(req(), res(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }))
    ).toBeNull();
    expect(shouldCompress(req(), res(200, { 'content-type': 'image/png' }))).toBeNull();
    expect(shouldCompress(req('GET', 'identity'), res())).toBeNull();
  });
});
