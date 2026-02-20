// Snippet for local SPA dev mode to prevent "unsupported MIME type" errors
// In production (PWA mode), Quasar's custom-service-worker.ts takes over.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
self.addEventListener('push', function (_) {
  // Silent fallback for local development
});
