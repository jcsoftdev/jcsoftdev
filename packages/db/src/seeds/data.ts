/**
 * Seed data for jcsoftdev portfolio.
 *
 * Pure data export — no DB awareness, no side effects.
 * Consumed by run.ts (the seed runner) and covered by data.test.ts (shape validation).
 *
 * Data source: Juan Carlos Valencia CV (Authoritative Mapping, 2026-05-07).
 * All heroMediaId values are null — media pipeline is deferred.
 */
import type { NewExperience, NewProject } from '../schema/index.js';

export const seedExperiences: NewExperience[] = [
  {
    company: 'Pulzifi',
    role: 'Full-Stack Developer',
    summary:
      'Full-Stack Multi-Tenant SaaS for web monitoring with AI-powered insights. Designed and built end-to-end with Go + Hono + Next.js 16, schema-per-tenant Postgres, and a 17-module DDD architecture.',
    startedAt: '2026-01-01',
    endedAt: null,
    location: 'Lima, Peru',
    displayOrder: 1,
  },
  {
    company: 'Travitur',
    role: 'Software Developer (Backend + Mobile)',
    summary:
      'Built a NestJS 11 CMS backend with Google Drive integration AND a cross-platform Expo / React Native mobile app for iOS, Android, and Web. Role-based access control, hierarchical content, dynamic forms, offline PDF viewing.',
    startedAt: '2025-08-01',
    endedAt: '2026-01-01',
    location: 'Lima, Peru',
    displayOrder: 2,
  },
  {
    company: 'GlobalLogic',
    role: 'Senior Software Engineer',
    summary:
      'Designed enterprise microservices in Go and Node.js using hexagonal + DDD on Azure / AWS. Built a Go service deployed on AWS Lambda for parallel processing, plus React/Vue frontends. Enforced 80% test coverage gates.',
    startedAt: '2024-11-01',
    endedAt: '2025-08-01',
    location: 'Lima, Peru',
    displayOrder: 3,
  },
  {
    company: 'DD3',
    role: 'React + Node.js Developer (Fullstack)',
    summary:
      'Delivered SSR/SSG Next.js apps with NestJS backends. Cut response times 76% via Redis caching, deployed to AWS RDS + EC2 + CloudFront. 80% Jest + Cypress coverage.',
    startedAt: '2023-10-01',
    endedAt: '2024-11-01',
    location: 'Lima, Peru',
    displayOrder: 4,
  },
  {
    company: 'Globant',
    role: 'Fullstack Developer',
    summary:
      'Optimized landing-page performance and SEO using Next.js SSR + island architecture. Integrated Salesforce + Drupal via a Node.js middleware on EC2. Designed DynamoDB schemas with GSIs for global enterprise traffic.',
    startedAt: '2022-01-01',
    endedAt: '2023-10-01',
    location: 'Lima, Peru',
    displayOrder: 5,
  },
  {
    company: 'Globant',
    role: 'Frontend Developer',
    summary:
      'Built reusable React components for telecom landing pages. Implemented island architecture with selective hydration, custom GTM tracking, AWS Lambda geolocation logic, and WCAG-compliant interactions.',
    startedAt: '2021-06-01',
    endedAt: '2022-01-01',
    location: 'Lima, Peru',
    displayOrder: 6,
  },
  {
    company: 'IDW',
    role: 'Frontend Developer',
    summary:
      'Architected a React + TypeScript ecommerce frontend. Migrated the build from Webpack to Vite, optimized FCP, and deployed via AWS S3 + CloudFront with Lambda support tasks.',
    startedAt: '2020-09-01',
    endedAt: '2021-04-01',
    location: 'Lima, Peru',
    displayOrder: 7,
  },
  {
    company: 'Peru Software S.A.C',
    role: 'Full-stack Developer',
    summary:
      'Designed software architecture for real-time donation, pharmacy POS, and gas-delivery platforms. Built React + Node.js + MongoDB stacks with WebSockets, deployed on GCP Cloud Run with Cloud Build CI/CD.',
    startedAt: '2017-03-01',
    endedAt: '2020-09-01',
    location: 'Lima, Peru',
    displayOrder: 8,
  },
];

export const seedProjects: NewProject[] = [
  {
    slug: 'pulzifi',
    name: 'Pulzifi',
    summary:
      'Multi-tenant SaaS that captures page snapshots, detects visual + content changes, and delivers AI-powered insights via SSE, email, and Slack/Teams/Discord webhooks.',
    description:
      'Designed and built a comprehensive web monitoring platform with schema-per-tenant Postgres, Hono RPC backend, Next.js 16 frontend, and a Patchright-based scraper. The platform features 17 hexagonal/DDD modules, OAuth + JWT auth, real-time SSE notifications, and an LLM-powered insight pipeline using OpenRouter.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 1,
    startedAt: '2026-01-01',
    endedAt: null,
    heroMediaId: null,
  },
  {
    slug: 'travitur-backend',
    name: 'Travitur CMS Backend',
    summary:
      'NestJS 11 REST API for content management with Google Drive integration. Modular architecture with role-based access control and hierarchical document organization.',
    description:
      'Architected a modular NestJS application with 10+ feature modules: authentication, RBAC, content management with unlimited nesting depth, dynamic forms with multi-part file uploads, and bidirectional Google Drive sync via service account auth.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 2,
    startedAt: '2025-08-01',
    endedAt: '2026-01-01',
    heroMediaId: null,
  },
  {
    slug: 'travitur-mobile',
    name: 'Travitur Mobile App',
    summary:
      'Cross-platform Expo / React Native app for iOS, Android, and Web with offline PDF viewing, dynamic forms, and an admin panel.',
    description:
      'Built a unified TypeScript Expo app using expo-router with grouped routes, six Zustand stores, expo-secure-store for token persistence, and react-native-pdf with offline caching. Includes a full admin panel for user/role/permission management.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 3,
    startedAt: '2025-08-01',
    endedAt: '2026-01-01',
    heroMediaId: null,
  },
  {
    slug: 'jcsoftdev-portfolio',
    name: 'jcsoftdev Portfolio',
    summary:
      'This site! Astro 5 + Hono + React 19 monorepo with Drizzle, Valkey, MinIO, and a data-driven GSAP portfolio.',
    description:
      'Personal portfolio + engineering blog. Astro SSR public site, Hono RPC API on Bun, React 19 admin SPA with TanStack Router. Powered by Drizzle ORM on Postgres, Valkey caching, isomorphic-dompurify-sanitized MDX, and reduced-motion-safe GSAP timelines.',
    repoUrl: null,
    liveUrl: 'https://jcsoftdev.com',
    featuredOrder: null,
    startedAt: '2026-05-01',
    endedAt: null,
    heroMediaId: null,
  },
  {
    slug: 'peru-software-pos',
    name: 'Pharmacy Point-of-Sale',
    summary:
      'Vue.js + Laravel pharmacy sales and inventory system with normalized MySQL schema and JWT auth.',
    description:
      'Built a Vue.js + Laravel system using the Service + Repository patterns. Optimized MySQL with composite indexes, eager loading for N+1 queries, and JWT-secured REST APIs. Includes financial reporting, inventory dashboards, and shared-hosting deployment.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: null,
    startedAt: '2017-03-01',
    endedAt: '2020-09-01',
    heroMediaId: null,
  },
  {
    slug: 'peru-software-gas',
    name: 'Real-Time Gas Delivery Tracking',
    summary:
      'QR-based delivery tracking platform for a Primax subsidiary. Vue.js + Laravel + MySQL with real-time geolocation.',
    description:
      'Designed a QR-based delivery workflow with Laravel REST APIs, role-based middleware, and request throttling. Vue.js frontend with QR scanning, GPS tracking, lazy loading, and retry logic for unstable mobile networks.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: null,
    startedAt: '2017-03-01',
    endedAt: '2020-09-01',
    heroMediaId: null,
  },
];
