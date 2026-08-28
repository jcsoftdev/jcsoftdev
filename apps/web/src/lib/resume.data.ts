/**
 * The CV, as data.
 *
 * /resume used to render the portfolio payload the homepage already fetches,
 * which meant it could never drift from the Experience section — but it also
 * meant it could only ever show what that payload carries: company, role, dates
 * and a summary. The PDF handed to recruiters has a profile, a skills matrix,
 * core competencies, a tech stack and a bullet list per engagement, and an
 * education section. None of that has anywhere to live in the database.
 *
 * So this file is the CV document, transcribed from
 * `juan carlos valencia cv.pdf`, and /resume renders it directly. The homepage
 * still reads the database. They CAN now disagree — that is the deliberate
 * trade: the page you send someone should say exactly what the file you send
 * them says.
 *
 * Keep this file and the PDF in step. If the PDF is the artifact you edit, this
 * is what you update afterwards.
 *
 * Client and product names stay out, here as everywhere: engagements are named
 * by what they are.
 */

export interface ResumeProject {
  name: string;
  /** As printed in the PDF, e.g. "JAN 2026 — JUN 2026". */
  period: string;
  /** The tech line that sits under the project title. */
  stack: string;
  summary: string;
  bullets: string[];
  /** A project nested inside another, like the companion app under the CMS. */
  subsections?: ResumeProject[];
  /** The PDF labels some entries PROJECT rather than dating them. */
  label?: string;
}

export interface ResumeRole {
  company: string;
  role: string;
  period: string;
  summary?: string;
  /** Bullets belonging to the role itself rather than to one engagement. */
  bullets?: string[];
  stack?: string;
  projects?: ResumeProject[];
}

/**
 * Contact details that belong on the printed CV but not on the public page.
 *
 * Base64 rather than plain text, and decoded only when the browser enters print
 * mode. Two separate reasons:
 *
 *   - `display: none` would not help at all. The text still ships in the markup,
 *     which is exactly what an address harvester reads.
 *   - Encoding keeps the literal strings out of the served HTML, so a crawler
 *     grepping for an email pattern or a phone number finds nothing.
 *
 * Be clear about what this is: obfuscation, not protection. Anything the browser
 * can render, a determined scraper can extract — it only has to run the same
 * `atob` this page does. The point is to defeat the naive harvester that makes
 * up nearly all of the traffic, not to make the data unreachable.
 *
 * Order matters. These are prepended to the contact list, and the screen-only
 * rows drop out in print, so the printed grid reads exactly as the PDF does:
 * email beside phone, then linkedin beside github.
 *
 * Decode with `atob` to read or change these.
 */
export const PRINT_ONLY_CONTACT: { value: string; href: string; icon: string }[] = [
  // juancarlos.valencia.dev@gmail.com
  {
    value: 'anVhbmNhcmxvcy52YWxlbmNpYS5kZXZAZ21haWwuY29t',
    href: 'bWFpbHRvOmp1YW5jYXJsb3MudmFsZW5jaWEuZGV2QGdtYWlsLmNvbQ==',
    icon: '#i-mail',
  },
  // +51 900 209 147
  { value: 'KzUxIDkwMCAyMDkgMTQ3', href: 'dGVsOis1MTkwMDIwOTE0Nw==', icon: '#i-phone' },
];

export const PROFILE =
  'Full-Stack Developer with 8+ years of experience building complete web products, from the frontend to the infrastructure. Primarily working with TypeScript, React/Next.js, Node.js/NestJS, Go, and Python/Django REST Framework, building microservices and REST/gRPC APIs on PostgreSQL, with Docker, Terraform, and CI/CD pipelines on AWS and Azure. Experienced in building LLM-orchestrated (LangGraph) agentic features. Focused on maintainable code and production stability.';

export const TECHNICAL_SKILLS: { label: string; value: string }[] = [
  { label: 'Languages', value: 'JavaScript, TypeScript, Go, Python, PHP' },
  {
    label: 'Frameworks',
    value:
      'React.js 16+, Next.js 12+, Vue.js, Redux, Zustand, Styled Components, SASS / CSS Modules, Tailwind CSS, Material-UI, Express.js, Nest.js, GraphQL (Apollo Client / Server), gRPC, Microservices, Hono, Radix UI, Shadcn UI, TanStack Query, SWR, TanStack Table, Socket.io, Zod / nestjs-zod, BullMQ, i18next, SvelteKit, Django REST Framework, LangChain / LangGraph',
  },
  {
    label: 'Databases',
    value:
      'MongoDB, MySQL, PostgreSQL, Redis, DynamoDB, Elasticsearch, Prisma, TypeORM, Databricks SQL',
  },
  {
    label: 'Cloud & DevOps',
    value:
      'Azure, AWS (Amplify, ECS/Fargate, Lambda, Bedrock, EC2, RDS, CloudFront, S3), GCP (Cloud Run, Cloud Build, Cloud Storage), Docker, Docker Compose, Terraform, Kubernetes, CI/CD (GitHub Actions, Azure DevOps, Cloud Build)',
  },
  {
    label: 'Other',
    value:
      'Linux/Unix, Async programming, RESTful API design, Performance optimization, Event-driven architecture, Architectures (Hexagonal, DDD, Microservices), Feature flags, Testing (Jest, Cypress, Playwright, TestContainers), Nx & Turborepo, Azure AD / MSAL SSO, Storybook, Docusaurus, Semantic Release, Agile/Scrum, Code reviews & mentoring',
  },
  { label: 'Expanding', value: 'FastAPI, pandas/data analysis' },
];

export const CORE_COMPETENCIES: string[] = [
  'System design & microservices architecture',
  'CI/CD pipelines (Docker, Terraform, GitHub Actions, Azure DevOps, GCP)',
  'Agile/Scrum methodologies',
  'AWS cloud services (Lambda, EC2, ECS/Fargate, Amplify, Bedrock, API Gateway, RDS, CloudFront, S3)',
  'LLM orchestration & agentic workflows (LangGraph, RAG)',
  'Linux/Unix environments',
  'SQL & relational databases (PostgreSQL, MySQL)',
  'RESTful API design (OpenAPI/Swagger)',
  'Node.js & async programming (event-driven architecture)',
  'Python & Django REST Framework (API development)',
];

export const EXPERIENCE: ResumeRole[] = [
  {
    company: 'GlobalLogic',
    role: 'Senior Software Engineer',
    period: 'OCT 2023 — JUN 2026',
    summary:
      'Delivered end-to-end web products across multiple client engagements and internal initiatives — full-stack architecture (TypeScript, React/Next.js, Node.js/NestJS, Go), microservices, REST/gRPC APIs, event-driven systems, and cloud platforms (AWS, Azure, GCP). Selected projects below.',
    projects: [
      {
        name: 'Multi-Tenant SaaS Web-Monitoring Platform with AI Insights',
        period: 'JAN 2026 — JUN 2026',
        stack:
          'Go 1.25 · Chi · gRPC · Node.js · TS · Bun · Hono · Next.js 16 · React 19 · Tailwind · Radix UI · Turborepo · PostgreSQL 17 · Redis · MinIO · Docker · AWS (Amplify, ECS Fargate Spot, Bedrock) · Django REST Framework · LangGraph · Patchright/Playwright · Bedrock (LLM+Vision) · Resend · OAuth 2.0 · JWT · SSE · BullMQ · Elasticsearch · TestContainers',
        summary:
          'Full-Stack multi-tenant SaaS platform for web monitoring with AI-generated insights — captures page snapshots, detects visual/content changes via pixel-diff & HTML analysis, generates AI insights via LLM, and delivers real-time notifications: multi-tenant isolation, OAuth, RBAC, and a hexagonal architecture with 17 DDD modules.',
        bullets: [
          'Designed and developed a full-stack multi-tenant SaaS monitoring platform with schema-per-tenant PostgreSQL isolation, subdomain-based tenant routing, and automatic tenant schema provisioning.',
          'Architected 17 hexagonal (DDD) modules following strict dependency rules (domain ← application ← infrastructure); Go services with Chi (REST) and gRPC for inter-service communication.',
          'Built the frontend in Next.js 16 (App Router) with React 19, Tailwind, Radix UI, and a Turborepo monorepo with 5 shared packages.',
          'Containerized all services with Docker and deployed to AWS — the Next.js frontend on AWS Amplify Hosting, and backend services (4) on Amazon ECS with Fargate Spot for cost-efficient serverless containers; local dev via Docker Compose (PostgreSQL, LocalStack, Air hot-reload).',
          'Built a browser automation scraper using Patchright with anti-detection, fingerprint injection, ad blocking, and concurrent page processing.',
          'Implemented background job processing with BullMQ and worker pools, scheduled checks (30s), and orchestration: snapshot → change detection → AI insight → alerts.',
          'Implemented Elasticsearch search and an AI insight pipeline orchestrated with LangGraph on Amazon Bedrock (text + vision/multimodal LLM) through a worker queue, generating tenant-specific suggestions exposed via a Django REST Framework API.',
          'Built a real-time SSE notification system, JWT (access+refresh), OAuth 2.0 (Google, GitHub), and a BFF handler for secure cross-subdomain cookie exchange.',
          'Designed optimized PostgreSQL schemas (indexes, schema-per-tenant isolation), a Resend transactional email system, and Slack/Teams/Discord webhook integrations.',
          'Leveraged AI tools (Claude Code, GitHub Copilot, Bedrock API) for insight generation, code review, and architectural decisions.',
        ],
      },
      {
        name: 'Content Management System with Google Drive Integration',
        period: 'AUG 2025 — JAN 2026',
        stack:
          'NestJS 11 · TypeScript · PostgreSQL · Prisma ORM · Passport JWT · Google Drive API · Swagger/OpenAPI · AWS (ECS Fargate Spot) · Docker',
        summary:
          'REST API backend for content management and form submissions with integrated Drive storage; modular NestJS with RBAC, hierarchical document organization, and dynamic form management supporting authenticated and anonymous submissions.',
        bullets: [
          'Architected a modular NestJS application with 10+ feature modules: authentication, user management, content management, dynamic forms, role management, and Google Drive integration.',
          'Implemented authentication and authorization using Passport JWT with RBAC; junction tables for fine-grained many-to-many permissions.',
          'Built a hierarchical CMS supporting unlimited nesting via self-referencing parent-child relationships, with bidirectional Google Drive sync via driveId references.',
          'Designed a dynamic forms system with configurable fields, validation rules, and multi-part file uploads via Multer (authenticated and anonymous submissions).',
          'Integrated Google Drive API v3 with service-account auth and streaming uploads/downloads; file metadata in PostgreSQL with files in Drive (hybrid storage).',
          'Used Prisma ORM for type-safe operations and migrations; applied global ValidationPipe with class-validator and DTOs; documented the API with Swagger/OpenAPI.',
          'Configured CI/CD deployment pipelines to Amazon ECS (Fargate Spot) with Docker and environment-based configuration.',
        ],
        subsections: [
          {
            label: 'COMPANION MOBILE APP',
            name: 'Cross-Platform Mobile App',
            period: '',
            stack:
              'React Native · Expo · TypeScript · Zustand · Axios · expo-router · react-native-pdf · Expo Secure Store · EAS',
            summary:
              'Cross-platform frontend (iOS, Android, Web) — hierarchical content navigation, offline PDF viewing, dynamic form rendering, and an admin panel with RBAC, secure token auth, and Zustand state.',
            bullets: [
              'Architected a cross-platform app with a unified TypeScript codebase; platform-specific builds via EAS (dev/preview/production).',
              'Implemented file-based routing with expo-router and a Guardian component enforcing auth and automatic session restoration.',
              'Developed a modular Zustand state architecture (six domain stores) decoupled from the API layer to prevent circular dependencies.',
              'Built token-based JWT auth with Expo Secure Store persistence and an advanced PDF viewer (react-native-pdf) with offline caching.',
              'Implemented a dynamic form system with a multi-step wizard, validation, and file uploads; built an admin panel with user CRUD and role management.',
            ],
          },
        ],
      },
      {
        name: 'Enterprise Microservices Platform',
        period: 'NOV 2024 — AUG 2025',
        stack:
          'Go · Node.js · TS · NestJS · React · Vue · MongoDB · Azure SQL · TypeORM · Redis · Elasticsearch · Kafka · Socket.io · Python (pandas) · AKS · Azure AD/MSAL · Service Bus · Azure DevOps · API Management · Key Vault · App Insights · Docker · AWS Lambda/API Gateway/CloudWatch · Apollo Server · Jest · TestContainers · Databricks SQL · Semantic Release',
        summary:
          'Highly scalable enterprise microservices platform on Azure (AKS) using hexagonal architecture and event-driven patterns (Service Bus, Kafka). Built Go and Node.js/NestJS services, cloud-native observability, React/Vue frontends, and enforced strong engineering practices across teams.',
        bullets: [
          'Participated in architectural design for a distributed microservices platform using hexagonal architecture and domain-driven boundaries.',
          'Optimized system speed with vectorized operations and database query tuning; implemented event-driven communication with Azure Service Bus and Kafka.',
          'Designed MongoDB schemas and modeled relational data on Azure SQL with TypeORM (indexes, repository patterns).',
          'Built a queue-based microservice for bulk CSV/Excel report generation with Python (pandas), streaming results to the frontend in chunks.',
          'Implemented Azure AD / MSAL SSO across multiple applications; added Elasticsearch search and a real-time Socket.io microservice.',
          'Built REST and GraphQL APIs with Apollo Server (resolvers, subscriptions), exposed services via gRPC with protobuf, and wrote Databricks SQL for reporting.',
          'Developed responsive frontends with React, Vue, and TypeScript, migrating one app to shadcn/ui.',
          'Ensured quality with Jest, TestContainers, SonarQube CI/CD gates (80%+ coverage), and Semantic Release.',
          'Developed a high-performance Go microservice (goroutines, channels) deployed on AWS Lambda, integrating API Gateway for external workflow triggers, CloudWatch for profiling and latency analysis, Provisioned Concurrency to minimize cold starts, and IAM roles for secure resource access.',
          'Conducted code reviews and provided technical guidance in Agile/Scrum across distributed teams.',
        ],
      },
      {
        name: 'Microfrontend Web Platform (Nx, SSR/SSG, AWS)',
        period: 'OCT 2023 — NOV 2024',
        stack:
          'React · Next.js · Node.js · Nest.js · Redis · PostgreSQL · Zustand · Nx · TanStack Query/Table · SWR · Zod/nestjs-zod · i18next · Storybook · Docusaurus · Jest · Cypress · AWS (S3, SQS, Lambda, RDS, EC2, CloudFront)',
        summary:
          'High-performance full-stack applications structured as microfrontends with Nx. Implemented SSR/SSG for SEO and Redis caching with advanced database optimizations, running production deployments on AWS.',
        bullets: [
          'Built full-stack applications integrating React/Next.js with Node/Nest.js; implemented SSR and SSG to improve SEO and reduce page load times to under 3 seconds.',
          'Structured the frontend into microfrontends with Nx, documented a component library in Storybook, and added i18next localization (English) for US clients.',
          'Replaced Redux with Zustand; managed server state with TanStack Query and SWR, built data grids with TanStack Table, and enforced schema validation with Zod / nestjs-zod.',
          'Implemented Redis caching, reducing response times by 76% (from 30s to 7s).',
          'Designed logic and API flows for an AI-powered chatbot integration; built an interactive map-based UI with custom visualizations.',
          'Designed and optimized PostgreSQL schemas (indexes, partitions, query tuning) for high-performance operations.',
          'Ran production deployments on Amazon RDS (RDS Proxy) and EC2; maintained Next.js apps via CloudFront; integrated S3, SQS, and Lambda.',
          'Maintained automated testing with Jest (unit) and Cypress (E2E), sustaining 80%+ coverage.',
        ],
      },
    ],
  },
  {
    company: 'Globant',
    role: 'Full-Stack Developer',
    period: 'JAN 2022 — OCT 2023',
    stack: 'React.js · Next.js · Redux · Node.js · Salesforce · Drupal · DynamoDB · AWS',
    summary:
      'Improved web performance and SEO, built interactive UI components, integrated multiple enterprise systems, and enhanced landing pages for a global brand.',
    bullets: [
      'Optimized landing page performance using Next.js SSR, lazy loading, and code splitting; improved SEO, organic traffic, and keyword rankings.',
      'Implemented hexagonal architecture in the frontend, supporting feature-based development.',
      'Built interactive and accessible UI components in React.js and reduced server requests using SSR/SSG.',
      'Integrated Salesforce and Drupal through a Node.js middleware deployed on Amazon EC2.',
      'Designed DynamoDB data models with partition keys and GSIs, with efficient query patterns (indexed pagination, batch operations).',
      'Managed operational visibility in CloudWatch with metric dashboards, throttling alarms, and log analysis.',
      'Maintained and enhanced landing pages with feature flags to roll out improvements progressively.',
    ],
  },
  {
    company: 'Globant',
    role: 'Frontend Developer',
    period: 'JUN 2021 — JAN 2022',
    stack: 'React.js · GTM · CSS/JS animations · Node.js with lambdas · AWS',
    summary:
      'Developed reusable components, optimized performance, implemented advanced tracking, enhanced accessibility, and integrated geolocation logic for large-scale telecom landing pages.',
    bullets: [
      'Developed reusable React components for multiple landing pages, with island architecture (SSR for most of the page, hydrating only interactive sections).',
      'Implemented Google Tag Manager with custom event tracking and built performant CSS/JavaScript animations.',
      'Improved accessibility following WCAG guidelines and collaborated closely with designers for responsive UI.',
      "Performed code reviews, debugging, and refactoring; built AWS Lambda functions to detect users' local ISP IP ranges via geolocation APIs.",
    ],
  },
  {
    company: 'IDW',
    role: 'Frontend Developer',
    period: 'SEP 2020 — APR 2021',
    stack:
      'React.js · TypeScript · Styled Components · Webpack · Vite · Redux · Context API · React Helmet · AWS (EC2, S3, CloudFront, Lambda)',
    summary:
      'Designed and implemented the frontend architecture for an e-commerce platform using React and TypeScript, improved initial rendering performance (FCP), migrated the build pipeline to Vite, and deployed frontend and backend services on AWS.',
    bullets: [
      'Designed the frontend architecture using React + TypeScript, defining folder structure, component patterns, linting rules, and typing conventions.',
      'Built responsive UI components with Styled Components and CSS-in-JS, ensuring consistent design tokens; managed global state combining Redux and Context API.',
      'Integrated TypeScript incrementally, replacing JS modules with typed interfaces and generics to catch runtime errors during development.',
      'Migrated the build system from Webpack to Vite (significantly reducing build/deploy times) by removing custom Webpack configurations, replacing loaders/plugins with Vite-native equivalents, and leveraging esbuild for instant transforms and fast HMR.',
      'Optimized SEO using React Helmet (titles, meta tags, Open Graph) and preloaded critical assets.',
      'Deployed backend services on AWS EC2 (PM2, security groups restricted to CloudFront) and built AWS Lambda functions for validation, transformation, and workflow automation.',
    ],
  },
  {
    company: 'Peru Software S.A.C',
    role: 'Full-Stack Developer',
    period: 'MAR 2017 — SEP 2020',
    stack:
      'Google Maps API · React.js · Node.js · MongoDB · WebSockets (Socket.io) · GCP (Cloud Run, Cloud Build, Cloud Storage)',
    summary:
      'Designed the software architecture for a real-time donation platform, implemented real-time updates over WebSockets and location-based features with Google Maps, optimized MongoDB, and deployed on GCP with automated builds and centralized monitoring.',
    bullets: [
      'Designed the overall software architecture (React frontend, Node.js backend, MongoDB, WebSockets) and implemented real-time donation tracking with Socket.io.',
      'Built location-based features with the Google Maps API: geocoding, distance calculations, and interactive map views.',
      'Optimized MongoDB with efficient document schemas, indexes for high-traffic queries, and refactored complex queries; developed structured logging and error-handling middleware.',
      'Designed REST APIs with Express (routing, validation, authentication, consistent response formats).',
      'Deployed containerized services on GCP Cloud Run with separate environments and autoscaling; used Cloud Build for CI/CD and Cloud Storage for assets.',
      'Centralized application logs with Cloud Logging and set up dashboards and alerts with Cloud Monitoring.',
    ],
    projects: [
      {
        label: 'PROJECT',
        name: 'Pharmacy POS & Inventory Control System',
        period: '',
        stack: 'Vue.js · Laravel · MySQL · PHP · JWT',
        summary:
          'Pharmacy sales and inventory system — relational schemas, service-oriented backend, MySQL optimization, authentication and reporting modules, deployed on shared hosting.',
        bullets: [
          'Designed normalized MySQL schemas with foreign keys and indexing strategies; implemented Service and Repository patterns in Laravel.',
          'Optimized MySQL with composite/covering indexes, eager loading (fixing N+1), and more efficient JOINs.',
          'Implemented JWT authentication and built financial reporting modules (daily sales, revenue breakdowns, inventory valuation).',
          'Integrated Vue.js components for inventory, sales, and dashboards; deployed on shared hosting (PHP config, .htaccess, SFTP).',
        ],
      },
      {
        label: 'PROJECT',
        name: 'Real-Time Gas Delivery Tracking Platform',
        period: '',
        stack: 'Vue.js · Laravel REST API · MySQL · QR Codes · Geolocation',
        summary:
          "QR-based gas delivery tracking for a national fuel distributor's subsidiary — secure Laravel REST APIs, real-time geolocation tracking, and a frontend tuned for low-connectivity zones.",
        bullets: [
          'Designed a QR-based delivery tracking workflow with unique QR codes per order; implemented the scanning/validation flow in Vue.js.',
          'Built secure, high-performance Laravel REST APIs with authentication, role-based middleware, throttling, and optimized queries.',
          'Integrated geolocation tracking (GPS coordinates in MySQL with timestamps) and optimized Vue.js performance for unstable networks.',
          'Built monitoring dashboards combining QR validation results and geolocation history for supervisors.',
        ],
      },
    ],
  },
];

export const EDUCATION = {
  degree: 'Systems Engineering',
  school: 'Universidad Nacional del Centro del Perú',
  detail:
    'Systems Engineering — foundations in software architecture, algorithms, databases, and distributed systems.',
};

export const CERTIFICATIONS: string[] = [
  'Platzi Courses (verified profile)',
  'Frontend Masters Training',
  'English — B2 (ICPNA)',
];
