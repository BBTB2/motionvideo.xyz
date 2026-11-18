import { createFileRoute } from "@tanstack/react-router";

import { searchDirectoryResponse } from "@/server/catalog-search";

// Filtered, paginated entries of one directory section; see
// src/server/catalog-search.ts. `directories_` keeps it out from under the
// `/api/catalog/directories` route.
export const Route = createFileRoute("/api/catalog/directories_/search")({
  server: {
    handlers: {
      GET: ({ request }) => searchDirectoryResponse(request),
    },
  },
});
