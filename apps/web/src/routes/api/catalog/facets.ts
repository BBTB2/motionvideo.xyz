import { createFileRoute } from "@tanstack/react-router";

import { facetsResponse } from "@/server/catalog-search";

// Every filter value with its count; see src/server/catalog-search.ts.
export const Route = createFileRoute("/api/catalog/facets")({
  server: {
    handlers: {
      GET: () => facetsResponse(),
    },
  },
});
