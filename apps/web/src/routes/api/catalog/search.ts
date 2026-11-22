import { createFileRoute } from "@tanstack/react-router";

import { searchVideosResponse } from "@/server/catalog-search";

// Filtered, paginated gallery videos; see src/server/catalog-search.ts.
export const Route = createFileRoute("/api/catalog/search")({
  server: {
    handlers: {
      GET: ({ request }) => searchVideosResponse(request),
    },
  },
});
