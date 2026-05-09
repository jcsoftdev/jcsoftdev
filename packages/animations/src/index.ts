// Lenis smooth scroll (mobile guard built-in — returns null on touch/SSR)
export type { LenisOptions } from './lenis.js';
export { initLenis } from './lenis.js';

// Reduced-motion utility (exported for advanced use — consumers can wrap custom factories)
export type { KillableTimeline, NoOpTimeline, TimelineFactory } from './reduced-motion.js';
export { createReducedMotionSafe } from './reduced-motion.js';

// Animation factories — ALL pre-wrapped with createReducedMotionSafe.
// Consumers CANNOT import the unwrapped raw factories from this barrel.
// Each factory returns a no-op when prefers-reduced-motion: reduce or in SSR.

import { createReducedMotionSafe } from './reduced-motion.js';
import { createCursorOrbTimeline as _createCursorOrbTimeline } from './timelines/cursorOrb.js';
import { createExperienceFadeUpTimeline as _createExperienceFadeUpTimeline } from './timelines/experienceFadeUp.js';
import { createGalleryScrubTimeline as _createGalleryScrubTimeline } from './timelines/galleryScrub.js';
import { createHeroFadeTimeline as _createHeroFadeTimeline } from './timelines/heroFade.js';
import { createProjectsStaggerTimeline as _createProjectsStaggerTimeline } from './timelines/projectsStagger.js';
import { createSectionRevealTimeline as _createSectionRevealTimeline } from './timelines/sectionReveal.js';

/**
 * Reduced-motion-safe cursor-orb animation factory.
 * Tracks cursor via pointermove + rAF lerp 0.08. No-ops on coarse-pointer.
 */
export const createCursorOrbTimeline = _createCursorOrbTimeline;

/**
 * Reduced-motion-safe hero fade timeline factory.
 * Selector: [data-hero-title], [data-hero-sub]
 */
export const createHeroFadeTimeline = createReducedMotionSafe(_createHeroFadeTimeline);

/**
 * Reduced-motion-safe experience cards fade-up timeline factory.
 * Selector: [data-portfolio-experience-card]
 */
export const createExperienceFadeUpTimeline = _createExperienceFadeUpTimeline;

/**
 * Reduced-motion-safe gallery scrub timeline factory (Phase 6 — ADR-22).
 * Creates ScrollTrigger pin + scrub per [data-gallery-section] in root.
 * Requires initLenis({ withScrollTriggerBridge: true }) to be active before calling.
 */
export const createGalleryScrubTimeline = _createGalleryScrubTimeline;

/**
 * Reduced-motion-safe projects stagger timeline factory.
 * Selector: [data-portfolio-project-card]
 */
export const createProjectsStaggerTimeline = _createProjectsStaggerTimeline;

/**
 * Reduced-motion-safe section reveal timeline factory (REQ-ANIM-2).
 * Animates [data-section-header] (fade-up 0.6s) and [data-section-content] (fade-up 0.5s)
 * on scroll entry via ScrollTrigger (start: 'top 80%', once: true).
 */
export const createSectionRevealTimeline = _createSectionRevealTimeline;
