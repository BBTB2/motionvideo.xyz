import { bindings, defineConfig, exports, triggers } from "cf/config";

// Production stays on the custom domains; PR Previews use workers.dev.
const COMPATIBILITY_DATE = "2026-09-27";

// Pages with a prerendered file run the Worker first so it can apply the www
// and locale redirects and serve the HTML through ASSETS: every prefixed
// locale, plus the English (unprefixed) STATIC_PAGES in src/constants/routes.ts.
// Scripts, styles, and images skip the Worker; other unprefixed pages have no
// static file and reach the Worker anyway.
const RUN_WORKER_FIRST = [
  "/about",
  "/brand",
  "/contact",
  "/design",
  "/design/*",
  "/privacy",
  "/refunds",
  "/terms",
  "/subprocessors",
  "/security",
  "/dpa",
  "/es/*",
  "/fr/*",
  "/zh/*",
  "/ko/*",
  "/ja/*",
  "/de/*",
  "/pt/*",
  "/ru/*",
];

// Secrets are never read from files. Upload them with
// `cf deploy --secrets-file <PATH>` (or `cf workers versions create`), and keep
// local values in `.env`/`.dev.vars` for `cf dev`.
const secretBindings = {
  BETTER_AUTH_SECRET: bindings.secret(),
  RESEND_API_KEY: bindings.secret(),
  DODO_PAYMENTS_API_KEY: bindings.secret(),
  DODO_PAYMENTS_WEBHOOK_KEY: bindings.secret(),
  POSTHOG_PERSONAL_API_KEY: bindings.secret(),
  TURNSTILE_SECRET_KEY: bindings.secret(),
  GOOGLE_CLIENT_ID: bindings.secret(),
  GOOGLE_CLIENT_SECRET: bindings.secret(),
};

// Non-secret production config. `.env` overrides these locally with test-mode
// values. `pnpm dodo:setup --live` writes the live Dodo IDs below.
const productionVars = {
  BETTER_AUTH_URL: bindings.text("https://motionvideo.xyz"),
  EMAIL_FROM: bindings.text('"Aniket @ MotionVideo" <hello@motionvideo.xyz>'),
  ADMIN_EMAILS: bindings.text("hello@motionvideo.xyz,pawaraniket508@gmail.com"),
  DODO_PAYMENTS_ENVIRONMENT: bindings.text("live_mode"),
  // Retired Skill Bundle: no longer sold; identifies its buyers.
  DODO_PRODUCT_SKILL: bindings.text("pdt_0NpNXaPWFYUJrFMSsud2d"),
  DODO_PRODUCT_PRO_MONTHLY: bindings.text("pdt_0NqxC3Prxmo5J67rygxDm"),
  DODO_PRODUCT_PRO_ANNUAL: bindings.text("pdt_0NqxC3Ny6oY2uPK8FVRmU"),
  DODO_PRODUCT_PRO_LIFETIME: bindings.text("pdt_0NqxC3PnRgqnExqt1871K"),
  DODO_PRODUCT_BUSINESS_MONTHLY: bindings.text("pdt_0NqxC3O3Q1nZZij7E7RYl"),
  DODO_PRODUCT_BUSINESS_ANNUAL: bindings.text("pdt_0NqxC3OuI8rBu5pZtfJQl"),
  DODO_PRODUCT_SPONSOR_DIAMOND: bindings.text("pdt_0Npo4c9j85mW29bbQMSD7"),
  DODO_PRODUCT_SPONSOR_GOLD: bindings.text("pdt_0Npo4cAQwZQLYHuLF88ea"),
  DODO_PRODUCT_SPONSOR_SILVER: bindings.text("pdt_0Npo4c9E8HM1TdjRDi5Cb"),
  // One 30-day run per tier.
  DODO_PRODUCT_SPONSOR_DIAMOND_ONCE: bindings.text("pdt_0Npo4c6lVintrRL3ShTxk"),
  DODO_PRODUCT_SPONSOR_GOLD_ONCE: bindings.text("pdt_0Npo4c94JK06RZ0bZ4qa4"),
  DODO_PRODUCT_SPONSOR_SILVER_ONCE: bindings.text("pdt_0Npo4c5xgFw1edo98hW5G"),
  DODO_PRODUCT_JOB_STANDARD: bindings.text("pdt_0Npn9szB8Z5kqnx2MBPVg"),
  DODO_PRODUCT_JOB_FEATURED: bindings.text("pdt_0Npn9szIfRBwgezuI25bw"),
  // Uploads are linked from the bucket's public domain (cached at the edge,
  // no Worker request per view). Empty: served by the Worker at /uploads/.
  UPLOADS_PUBLIC_URL: bindings.text("https://assets.motionvideo.xyz"),
};

// Shared staging resources, never production bindings or live payments.
const previewVars = {
  BETTER_AUTH_URL: bindings.text(
    "https://feat-motionvideo-v2-motionvideo.pawaraniket508.workers.dev"
  ),
  EMAIL_FROM: bindings.text('"MotionVideo Preview" <hello@motionvideo.xyz>'),
  ADMIN_EMAILS: bindings.text("hello@motionvideo.xyz,pawaraniket508@gmail.com"),
  DODO_PAYMENTS_ENVIRONMENT: bindings.text("test_mode"),
  DODO_PRODUCT_SKILL: bindings.text("pdt_0NpNXXE9rdItzg65RmPaw"),
  DODO_PRODUCT_PRO_MONTHLY: bindings.text(""),
  DODO_PRODUCT_PRO_ANNUAL: bindings.text(""),
  DODO_PRODUCT_PRO_LIFETIME: bindings.text(""),
  DODO_PRODUCT_BUSINESS_MONTHLY: bindings.text(""),
  DODO_PRODUCT_BUSINESS_ANNUAL: bindings.text(""),
  DODO_PRODUCT_SPONSOR_DIAMOND: bindings.text("pdt_0Npnyoo6FbtrcV9op2rYL"),
  DODO_PRODUCT_SPONSOR_GOLD: bindings.text("pdt_0NpnyontPpuk06PKMlstF"),
  DODO_PRODUCT_SPONSOR_SILVER: bindings.text("pdt_0Npnyom7sPqPQTNFXp8mS"),
  DODO_PRODUCT_SPONSOR_DIAMOND_ONCE: bindings.text("pdt_0NpnyokyqhN3yRV1bOw7C"),
  DODO_PRODUCT_SPONSOR_GOLD_ONCE: bindings.text("pdt_0Npnyom7rBHT1iGGFGJpX"),
  DODO_PRODUCT_SPONSOR_SILVER_ONCE: bindings.text("pdt_0Npnyojv6m33RUQt1kpdl"),
  DODO_PRODUCT_JOB_STANDARD: bindings.text("pdt_0Npm8wZZC70CtLPJI3lSL"),
  DODO_PRODUCT_JOB_FEATURED: bindings.text("pdt_0Npm8wx91Hhgl33rDpqUH"),
  UPLOADS_PUBLIC_URL: bindings.text(""),
};

const previewEnv = (workerName: string) => ({
  ...previewVars,
  ...secretBindings,
  DB: bindings.d1({
    name: "motionvideo-preview",
    id: "f29e4238-a5d6-43ae-8f5d-63dcc9694bea",
  }),
  UPLOADS: bindings.r2({
    name: "motionvideo-assets-preview",
  }),
  // Live presence (online count and cursors): one Durable Object instance
  // holds every visitor's WebSocket (src/server/presence.ts).
  PRESENCE: bindings.durableObject({
    worker: workerName,
    exportName: "Presence",
  }),
  // Same limiters as production; declared so the binding types stay required.
  CONTACT_LIMITER: bindings.rateLimit({
    namespace: "1002",
    simple: { limit: 3, period: 60 },
  }),
  UPLOAD_LIMITER: bindings.rateLimit({
    namespace: "1004",
    simple: { limit: 10, period: 60 },
  }),
  ASSETS: bindings.assets(),
});

const productionWorker = {
  name: "motionvideo",
  compatibilityDate: COMPATIBILITY_DATE,
  compatibilityFlags: ["nodejs_compat"],
  entrypoint: "src/server.ts",
  // Production stays on the custom domains; PR Previews use workers.dev.
  domains: ["motionvideo.xyz", "www.motionvideo.xyz"],
  workersDev: false,
  previewUrls: true,
  observability: {
    enabled: true,
  },
  assets: {
    runWorkerFirst: RUN_WORKER_FIRST,
  },
  // Daily at 03:00 UTC: deletes expired sessions and sign-in codes
  // (src/server/cleanup.ts). Runs inside this Worker; no build or CI job.
  triggers: [triggers.scheduled({ schedule: "0 3 * * *" })],
  env: {
    ...productionVars,
    ...secretBindings,
    DB: bindings.d1({
      name: "motionvideo",
      id: "c44471e8-d7d2-4005-8f95-1e12f0ee0ae8",
    }),
    UPLOADS: bindings.r2({
      name: "motionvideo-assets",
    }),
    PRESENCE: bindings.durableObject({
      worker: "motionvideo",
      exportName: "Presence",
    }),
    // Contact form: 3 messages per minute per IP.
    CONTACT_LIMITER: bindings.rateLimit({
      namespace: "1001",
      simple: { limit: 3, period: 60 },
    }),
    // Image uploads: 10 per minute per IP (storage and R2 writes).
    UPLOAD_LIMITER: bindings.rateLimit({
      namespace: "1003",
      simple: { limit: 10, period: 60 },
    }),
    ASSETS: bindings.assets(),
  },
  exports: {
    Presence: exports.durableObject({ storage: "sqlite" }),
  },
};

const previewWorker = (name: string) => ({
  name,
  compatibilityDate: COMPATIBILITY_DATE,
  compatibilityFlags: ["nodejs_compat"],
  entrypoint: "src/server.ts",
  workersDev: false,
  previewUrls: true,
  observability: {
    enabled: true,
  },
  assets: {
    runWorkerFirst: RUN_WORKER_FIRST,
  },
  // Previews do not support triggers, so the cleanup cron only runs in
  // production.
  env: previewEnv(name),
  exports: {
    Presence: exports.durableObject({ storage: "sqlite" }),
  },
});

export default defineConfig((ctx) => ({
  // Workers Builds preview deployments (PR branches) use the shared staging
  // resources without the production custom domains. Production builds and
  // deploys use `productionWorker`; D1 migrations select their database by ID.
  worker: ctx.isPreview ? previewWorker("motionvideo") : productionWorker,
}));
