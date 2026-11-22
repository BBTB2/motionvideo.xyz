import { createFileRoute } from "@tanstack/react-router";

import { videoDetailResponse } from "@/server/catalog-search";

// One gallery video with its prompt, neighbours and similar videos; see
// src/server/catalog-search.ts.
export const Route = createFileRoute("/api/catalog/videos/$slug")({
  server: {
    handlers: {
      GET: ({ params }) => videoDetailResponse(params.slug),
    },
  },
});
