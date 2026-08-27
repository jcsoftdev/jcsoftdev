/**
 * Seed data for jcsoftdev portfolio.
 *
 * Pure data export — no DB awareness, no side effects.
 * Consumed by run.ts (the seed runner) and covered by data.test.ts (shape validation).
 *
 * Data source: Juan Carlos Valencia CV (PDF, 2026-08-27).
 *
 * Structure mirrors the CV exactly: rows are EMPLOYERS, not engagements. The
 * work delivered inside a role is listed as project lines in the summary, so
 * /resume and the homepage render the same breakdown without a schema change.
 *
 * Client and product names are deliberately absent — engagements are described
 * by what they are, never by whose brand they carried.
 *
 * All heroMediaId values are null — media pipeline is deferred.
 */
import type { NewExperience, NewProject } from '../schema/index.js';

export const seedExperiences: NewExperience[] = [
  {
    company: 'GlobalLogic',
    role: 'Senior Software Engineer',
    summary:
      'Delivered end-to-end web products across multiple client engagements and internal initiatives — full-stack architecture (TypeScript, React/Next.js, Node.js/NestJS, Go), microservices, REST/gRPC APIs, event-driven systems, and cloud platforms (AWS, Azure, GCP).\n\n' +
      '- **Multi-tenant SaaS web-monitoring platform with AI insights** (2026) — schema-per-tenant Postgres, 17 hexagonal/DDD modules, Go + Chi + gRPC services, Next.js 16 frontend, LangGraph on Amazon Bedrock, ECS Fargate Spot.\n' +
      '- **Content management system with Google Drive integration** (2025–26) — modular NestJS 11 REST API with RBAC, hierarchical content, dynamic forms, hybrid Postgres + Drive storage, plus a companion Expo app for iOS, Android and Web.\n' +
      '- **Enterprise microservices platform** (2024–25) — hexagonal services on Azure AKS with Service Bus and Kafka, a Go service on AWS Lambda, React/Vue frontends, and 80%+ coverage gates in CI.\n' +
      '- **Microfrontend web platform** (2023–24) — Nx microfrontends with SSR/SSG for SEO, Redis caching that cut response times 76% (30s to 7s), and production deploys on AWS.',
    startedAt: '2023-10-01',
    endedAt: '2026-06-01',
    location: 'Lima, Peru',
    displayOrder: 1,
  },
  {
    company: 'Globant',
    role: 'Full-Stack Developer',
    summary:
      'Improved web performance and SEO, built interactive UI components, and integrated enterprise systems for a global brand.\n\n' +
      '- Optimized landing-page performance with Next.js SSR, lazy loading and code splitting; improved SEO, organic traffic and keyword rankings.\n' +
      '- Implemented hexagonal architecture in the frontend to support feature-based development.\n' +
      '- Integrated Salesforce and Drupal through a Node.js middleware deployed on Amazon EC2.\n' +
      '- Designed DynamoDB data models with partition keys and GSIs, with indexed pagination and batch operations.\n' +
      '- Rolled out improvements progressively behind feature flags, with CloudWatch dashboards and throttling alarms.',
    startedAt: '2022-01-01',
    endedAt: '2023-10-01',
    location: 'Lima, Peru',
    displayOrder: 2,
  },
  {
    company: 'Globant',
    role: 'Frontend Developer',
    summary:
      'Built reusable components, tracking and accessibility for large-scale telecom landing pages.\n\n' +
      '- Developed reusable React components with island architecture — SSR for most of the page, hydrating only interactive sections.\n' +
      '- Implemented Google Tag Manager with custom event tracking and performant CSS/JavaScript animations.\n' +
      '- Improved accessibility following WCAG guidelines, working closely with designers on responsive UI.\n' +
      "- Built AWS Lambda functions to detect users' local ISP IP ranges via geolocation APIs.",
    startedAt: '2021-06-01',
    endedAt: '2022-01-01',
    location: 'Lima, Peru',
    displayOrder: 3,
  },
  {
    company: 'IDW',
    role: 'Frontend Developer',
    summary:
      'Designed and implemented the frontend architecture for an e-commerce platform, and moved its build pipeline off Webpack.\n\n' +
      '- Defined the React + TypeScript architecture: folder structure, component patterns, linting rules and typing conventions.\n' +
      '- Built responsive UI with Styled Components and consistent design tokens; global state combining Redux and Context API.\n' +
      '- Migrated the build system from Webpack to Vite, replacing loaders/plugins with Vite-native equivalents and gaining instant transforms and fast HMR.\n' +
      '- Optimized SEO with React Helmet and preloaded critical assets; deployed on AWS EC2, S3, CloudFront and Lambda.',
    startedAt: '2020-09-01',
    endedAt: '2021-04-01',
    location: 'Lima, Peru',
    displayOrder: 4,
  },
  {
    company: 'Peru Software S.A.C',
    role: 'Full-Stack Developer',
    summary:
      'Designed the software architecture for a real-time donation platform and delivered two further production systems.\n\n' +
      '- Architected the React + Node.js + MongoDB + WebSockets stack and implemented real-time donation tracking with Socket.io.\n' +
      '- Built location-based features on the Google Maps API: geocoding, distance calculations and interactive map views.\n' +
      '- Optimized MongoDB with document schemas and indexes for high-traffic queries; structured logging and error-handling middleware.\n' +
      '- Deployed containerized services on GCP Cloud Run with Cloud Build CI/CD, Cloud Logging and Cloud Monitoring dashboards.\n' +
      '- Also delivered a pharmacy point-of-sale and inventory system and a QR-based real-time delivery tracking platform (Vue.js + Laravel + MySQL).',
    startedAt: '2017-03-01',
    endedAt: '2020-09-01',
    location: 'Lima, Peru',
    displayOrder: 5,
  },
];

export const seedProjects: NewProject[] = [
  {
    slug: 'multi-tenant-monitoring-saas',
    name: 'Multi-Tenant Web-Monitoring SaaS with AI Insights',
    summary:
      'Multi-tenant SaaS that captures page snapshots, detects visual and content changes, generates AI insights, and delivers real-time notifications via SSE, email and Slack/Teams/Discord webhooks.',
    description:
      'Full-stack multi-tenant platform with schema-per-tenant Postgres isolation, subdomain-based tenant routing and automatic schema provisioning. 17 hexagonal (DDD) modules under strict dependency rules; Go services with Chi (REST) and gRPC for inter-service communication; Next.js 16 App Router frontend on React 19 in a Turborepo monorepo with 5 shared packages. Browser automation via Patchright with anti-detection and fingerprint injection; BullMQ worker pools running 30s scheduled checks through a snapshot → change detection → AI insight → alert pipeline. Elasticsearch search and a LangGraph insight pipeline on Amazon Bedrock (text + vision) exposed through a Django REST Framework API. JWT access/refresh, OAuth 2.0, and a BFF handler for secure cross-subdomain cookie exchange. Deployed on AWS — frontend on Amplify Hosting, four backend services on ECS with Fargate Spot.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 1,
    startedAt: '2026-01-01',
    endedAt: '2026-06-01',
    heroMediaId: null,
  },
  {
    slug: 'cms-google-drive-backend',
    name: 'Content Management System with Google Drive Integration',
    summary:
      'NestJS 11 REST API for content management and form submissions, with hierarchical documents, dynamic forms and Google Drive as the file store.',
    description:
      'Modular NestJS application with 10+ feature modules: authentication, user management, content management, dynamic forms, role management and Google Drive integration. Passport JWT with RBAC and junction tables for fine-grained many-to-many permissions. Hierarchical CMS supporting unlimited nesting via self-referencing parent-child relationships, kept in bidirectional sync with Drive through driveId references. Dynamic forms with configurable fields, validation rules and multi-part uploads via Multer, supporting authenticated and anonymous submissions. Google Drive API v3 with service-account auth and streaming uploads/downloads — metadata in Postgres, files in Drive. Prisma ORM for type-safe queries and migrations, global ValidationPipe with class-validator DTOs, Swagger/OpenAPI docs, and CI/CD to Amazon ECS on Fargate Spot.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 2,
    startedAt: '2025-08-01',
    endedAt: '2026-01-01',
    heroMediaId: null,
  },
  {
    slug: 'companion-mobile-app',
    name: 'Companion Cross-Platform Mobile App',
    summary:
      'Expo / React Native app for iOS, Android and Web — hierarchical content navigation, offline PDF viewing, dynamic form rendering and an admin panel with RBAC.',
    description:
      'Unified TypeScript codebase with platform-specific builds via EAS (dev/preview/production). File-based routing with expo-router and a Guardian component enforcing auth and automatic session restoration. Modular Zustand state architecture across six domain stores, deliberately decoupled from the API layer to prevent circular dependencies. Token-based JWT auth persisted in Expo Secure Store, and an advanced PDF viewer (react-native-pdf) with offline caching. Dynamic form system with a multi-step wizard, validation and file uploads, plus an admin panel with user CRUD and role management.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 3,
    startedAt: '2025-08-01',
    endedAt: '2026-01-01',
    heroMediaId: null,
  },
  {
    slug: 'enterprise-microservices-platform',
    name: 'Enterprise Microservices Platform',
    summary:
      'Highly scalable enterprise platform on Azure AKS using hexagonal architecture and event-driven patterns over Service Bus and Kafka, with Go and Node.js/NestJS services.',
    description:
      'Participated in the architectural design of a distributed microservices platform with hexagonal architecture and domain-driven boundaries. Event-driven communication over Azure Service Bus and Kafka; MongoDB schemas alongside relational data on Azure SQL with TypeORM. Queue-based microservice for bulk CSV/Excel report generation in Python (pandas), streaming results to the frontend in chunks. Azure AD / MSAL SSO across multiple applications, Elasticsearch search, and a real-time Socket.io microservice. REST and GraphQL APIs with Apollo Server (resolvers, subscriptions), gRPC with protobuf, and Databricks SQL for reporting. React, Vue and TypeScript frontends — one migrated to shadcn/ui. Quality enforced with Jest, TestContainers, SonarQube CI/CD gates at 80%+ coverage and Semantic Release. A high-performance Go microservice (goroutines, channels) ran on AWS Lambda behind API Gateway, with Provisioned Concurrency to minimize cold starts and CloudWatch for latency profiling.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 4,
    startedAt: '2024-11-01',
    endedAt: '2025-08-01',
    heroMediaId: null,
  },
  {
    slug: 'microfrontend-web-platform',
    name: 'Microfrontend Web Platform (Nx, SSR/SSG, AWS)',
    summary:
      'High-performance full-stack applications structured as Nx microfrontends, with SSR/SSG for SEO and Redis caching that cut response times by 76%.',
    description:
      'Built full-stack applications integrating React/Next.js with Node/NestJS, using SSR and SSG to improve SEO and bring page load times under 3 seconds. Structured the frontend into Nx microfrontends, documented a component library in Storybook, and added i18next localization for US clients. Replaced Redux with Zustand, managed server state with TanStack Query and SWR, built data grids with TanStack Table, and enforced schema validation with Zod / nestjs-zod. Redis caching cut response times 76% — from 30s to 7s. Designed and optimized Postgres schemas (indexes, partitions, query tuning), ran production deployments on Amazon RDS (RDS Proxy) and EC2, served Next.js apps through CloudFront, and integrated S3, SQS and Lambda. Automated testing with Jest and Cypress sustained 80%+ coverage.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: 5,
    startedAt: '2023-10-01',
    endedAt: '2024-11-01',
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
    slug: 'pharmacy-pos-inventory',
    name: 'Pharmacy Point-of-Sale & Inventory Control',
    summary:
      'Vue.js + Laravel pharmacy sales and inventory system with a normalized MySQL schema, JWT auth and financial reporting.',
    description:
      'Designed normalized MySQL schemas with foreign keys and indexing strategies, and implemented the Service and Repository patterns in Laravel. Optimized MySQL with composite/covering indexes, eager loading to fix N+1 queries, and more efficient JOINs. JWT authentication and financial reporting modules covering daily sales, revenue breakdowns and inventory valuation. Vue.js components for inventory, sales and dashboards, deployed on shared hosting.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: null,
    startedAt: '2017-03-01',
    endedAt: '2020-09-01',
    heroMediaId: null,
  },
  {
    slug: 'gas-delivery-tracking',
    name: 'Real-Time Gas Delivery Tracking Platform',
    summary:
      'QR-based delivery tracking for a national fuel distributor — secure Laravel REST APIs, real-time geolocation, and a Vue.js frontend tuned for low-connectivity zones.',
    description:
      'Designed a QR-based delivery tracking workflow with unique codes per order and implemented the scanning/validation flow in Vue.js. Built secure, high-performance Laravel REST APIs with authentication, role-based middleware, throttling and optimized queries. Integrated geolocation tracking (GPS coordinates in MySQL with timestamps) and tuned Vue.js performance for unstable networks. Monitoring dashboards combined QR validation results with geolocation history for supervisors.',
    repoUrl: null,
    liveUrl: null,
    featuredOrder: null,
    startedAt: '2017-03-01',
    endedAt: '2020-09-01',
    heroMediaId: null,
  },
];
