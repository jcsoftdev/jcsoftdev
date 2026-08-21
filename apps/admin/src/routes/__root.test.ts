/**
 * Tests for the route-change a11y title mapping used by the root route's
 * announcer hook (document.title + focus management on SPA navigation).
 */
import { describe, expect, it } from 'vitest';
import { titleForPath } from './__root.js';

describe('titleForPath', () => {
  it('returns the base title for the root path', () => {
    expect(titleForPath('/')).toBe('jcsoftdev Admin');
  });

  it('returns the base title for an empty path', () => {
    expect(titleForPath('')).toBe('jcsoftdev Admin');
  });

  it('labels the login callback route distinctly from login', () => {
    expect(titleForPath('/login/callback')).toBe('Verifying login | jcsoftdev Admin');
    expect(titleForPath('/login')).toBe('Sign in | jcsoftdev Admin');
  });

  it('labels the dashboard route', () => {
    expect(titleForPath('/dashboard')).toBe('Dashboard | jcsoftdev Admin');
  });

  it('labels nested resource routes by their top-level segment', () => {
    expect(titleForPath('/projects/123/edit')).toBe('Projects | jcsoftdev Admin');
    expect(titleForPath('/experiences/new')).toBe('Experiences | jcsoftdev Admin');
    expect(titleForPath('/posts')).toBe('Posts | jcsoftdev Admin');
  });

  it('falls back to the base title for unknown paths', () => {
    expect(titleForPath('/unknown-route')).toBe('jcsoftdev Admin');
  });
});
