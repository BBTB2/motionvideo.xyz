import type { OpenAPIV3_1 } from "fumadocs-openapi";

import { CACHE_CONTROL } from "@/constants/cache-control";
import { DEFAULT_LOCALE, localizedPath } from "@/constants/locales";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { absoluteUrl } from "@/constants/url";
import catalog from "@/data/motion-catalog.json";
import directories from "@/data/resource-directories.json";
import { DIRECTORY_FILTERS, DIRECTORY_SORTS } from "@/lib/directories";
import {
  EFFORTS,
  ITERATIONS,
  MOTION_CATEGORIES,
  MOTION_COLORS,
  MOTION_MODELS,
  MOTION_TYPES,
} from "@/lib/motion-catalog";
import { MOVE_FAMILIES } from "@/lib/move-families";
import { MOVES } from "@/lib/moves";
import { DIRECTORY_SECTIONS } from "@/server/catalog-search";

// Server only: the OpenAPI document of the public JSON endpoints
// (src/routes/api/catalog/*, src/routes/api/moves), served at /openapi.json
// and rendered as the API reference under /docs/api. Enums and the
// Cache-Control value come from the code the handlers use, and the examples
// are cut from the live data, so they can't drift. The query endpoints
// (search, video, facets, directory search) live in server/catalog-search.ts.
//
// /api/mcp/* is left out: those endpoints are the MCP server's backend. Their
// access tokens are audience-bound to the MCP server (MCP_RESOURCE), which
// forwards them; other clients use the MCP tools (docs/mcp) instead.

/** The file the API reference pages are generated from, for edit links. */
export const OPENAPI_SOURCE_PATH = "src/server/openapi.ts";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/**
 * A cached JSON read: optional `If-None-Match`, then 200 with the data (and
 * its ETag and Cache-Control) or an empty 304.
 */
const cachedGet = ({
  operationId,
  summary,
  description,
  tag,
  response,
}: {
  operationId: string;
  summary: string;
  description: string;
  tag: string;
  response: { description: string; schema: string; example: unknown };
}): OpenAPIV3_1.PathItemObject => ({
  get: {
    operationId,
    summary,
    description,
    tags: [tag],
    parameters: [{ $ref: "#/components/parameters/IfNoneMatch" }],
    responses: {
      "200": {
        description: response.description,
        headers: {
          ETag: { $ref: "#/components/headers/ETag" },
          "Cache-Control": { $ref: "#/components/headers/CacheControl" },
        },
        content: {
          "application/json": {
            schema: ref(response.schema),
            example: response.example,
          },
        },
      },
      "304": { $ref: "#/components/responses/NotModified" },
    },
  },
});

type ParameterSchema = NonNullable<OpenAPIV3_1.ParameterObject["schema"]>;

/** A list query parameter: comma-separated values or repeated keys. */
const listParam = (
  name: string,
  description: string,
  items: ParameterSchema
): OpenAPIV3_1.ParameterObject => ({
  name,
  in: "query",
  required: false,
  description,
  style: "form",
  explode: false,
  schema: { type: "array", items },
});

const queryParam = (
  name: string,
  description: string,
  schema: ParameterSchema,
  required = false
): OpenAPIV3_1.ParameterObject => ({
  name,
  in: "query",
  required,
  description,
  schema,
});

/** An uncached query: 200 with the result, or 400 for a bad parameter. */
const queryGet = ({
  operationId,
  summary,
  description,
  parameters,
  response,
  notFound,
}: {
  operationId: string;
  summary: string;
  description: string;
  parameters: OpenAPIV3_1.ParameterObject[];
  response: { description: string; schema: string };
  notFound?: { description: string; schema: string };
}): OpenAPIV3_1.PathItemObject => {
  const responses: NonNullable<
    NonNullable<OpenAPIV3_1.PathItemObject["get"]>["responses"]
  > = {
    "200": {
      description: response.description,
      headers: {
        "Cache-Control": { $ref: "#/components/headers/CacheControl" },
      },
      content: { "application/json": { schema: ref(response.schema) } },
    },
    "400": {
      description: "A parameter is unknown or has a value it can't take.",
      content: {
        "application/json": { schema: ref("InvalidParameter") },
      },
    },
  };
  if (notFound) {
    responses["404"] = {
      description: notFound.description,
      content: { "application/json": { schema: ref(notFound.schema) } },
    };
  }
  return {
    get: {
      operationId,
      summary,
      description,
      tags: ["Search"],
      parameters,
      responses,
    },
  };
};

const COLOR_SLUGS = MOTION_COLORS.map((color) => color.slug);
const ALL_DIRECTORY_FILTERS = [
  ...new Set(Object.values(DIRECTORY_FILTERS).flat()),
];
const ALL_DIRECTORY_SORTS = [...new Set(Object.values(DIRECTORY_SORTS).flat())];
const VIDEO_FACETS = ["q", "category", "model", "color", "creator", "type"];

const limitParam = (fallback: number, max: number) =>
  queryParam(
    "limit",
    `Results per page, 1 to ${max}. Defaults to ${fallback}.`,
    {
      type: "integer",
      minimum: 1,
      maximum: max,
      default: fallback,
    }
  );

const offsetParam = queryParam(
  "offset",
  "Results to skip, for the next page. Defaults to 0.",
  { type: "integer", minimum: 0, default: 0 }
);

const resolutionSchema = (
  what: string,
  extra: Record<string, OpenAPIV3_1.SchemaObject> = {}
): OpenAPIV3_1.SchemaObject => ({
  type: "array",
  description: `How each requested ${what} was read, in request order.`,
  items: {
    type: "object",
    required: ["requested", "matched", ...Object.keys(extra)],
    properties: {
      requested: { type: "string", description: "As sent." },
      matched: {
        type: "array",
        description: `The catalog ${what}s it matched; empty when none, which matches no videos.`,
        items: { type: "string" },
      },
      ...extra,
    },
  },
});

const [toolEntry] = directories.tools.entries;
const skillEntry = directories.tools.entries.find(
  (entry) => entry.category === "Skills"
);
const [studioEntry] = directories.studios.entries;

export const openApiDocument: OpenAPIV3_1.Document = {
  openapi: "3.1.0",
  info: {
    title: `${SITE.NAME} public API`,
    version: "1.0.0",
    description:
      "Read-only JSON of the gallery catalog, the directories and the public part of every move. No key or sign-in.",
  },
  servers: [{ url: SITE.URL }],
  // Every endpoint is public.
  security: [],
  externalDocs: {
    description: "API reference",
    url: absoluteUrl(localizedPath(ROUTES.DOCS_API, DEFAULT_LOCALE)),
  },
  tags: [
    {
      name: "Catalog",
      description: "The gallery videos and the resource directories.",
    },
    { name: "Moves", description: "The motion design moves library." },
    {
      name: "Search",
      description:
        "Ask instead of downloading: filtered, paginated videos and directory entries, one video in full, and every filter value with its count. Same filters as the site.",
    },
  ],
  paths: {
    "/api/catalog": cachedGet({
      operationId: "get-catalog",
      summary: "Get the catalog",
      description:
        "Every gallery video with its prompt or skill, creator, model, stack, effort, colours and media URLs, plus the videos removed as duplicates.",
      tag: "Catalog",
      response: {
        description: "The motion video catalog.",
        schema: "MotionCatalog",
        example: {
          importedAt: catalog.importedAt,
          videos: catalog.videos.slice(0, 1),
          removed: catalog.removed.slice(0, 1),
        },
      },
    }),
    "/api/catalog/directories": cachedGet({
      operationId: "get-directories",
      summary: "Get the directories",
      description:
        "The tools, skills, extras (articles and resources) and creatives (studios and designers) directories.",
      tag: "Catalog",
      response: {
        description: "The resource directories.",
        schema: "Directories",
        example: {
          importedAt: directories.importedAt,
          tools: { entries: [toolEntry, skillEntry].filter(Boolean) },
          studios: { entries: [studioEntry] },
        },
      },
    }),
    "/api/moves": cachedGet({
      operationId: "get-moves",
      summary: "Get the moves",
      description:
        "The public part of every move: name, family, summary, explanation, good-for tags, gallery examples and related moves. Prompts are part of Pro and not included.",
      tag: "Moves",
      response: {
        description: "Every move, without its prompt.",
        schema: "Moves",
        example: { moves: MOVES.slice(0, 1) },
      },
    }),
    "/api/catalog/search": queryGet({
      operationId: "search-videos",
      summary: "Search the videos",
      description:
        "Gallery videos matching every facet given. Several values in one facet are alternatives (`color=red,orange` is red or orange); different facets all apply. The answer says how each model and creator was read, and, when nothing matches several facets, how many videos each matches alone.",
      parameters: [
        queryParam(
          "q",
          "Keywords; every word must appear in the title, the creator's handle, the prompt or the categories.",
          { type: "string" }
        ),
        listParam("category", "Gallery categories, any of them.", {
          type: "string",
          enum: [...MOTION_CATEGORIES],
        }),
        listParam(
          "model",
          "Models, any of them: a name (`Opus 5.5`), a full name (`Claude Opus 5.5`), a family (`Gemini`) or a bare version (`5.5`, every model with it).",
          { type: "string" }
        ),
        listParam(
          "color",
          "Named colours the video contains, matched like the `/color/{color}` pages.",
          { type: "string", enum: COLOR_SLUGS }
        ),
        queryParam(
          "colorMatch",
          "With several colours: `any` (default) or `all` of them.",
          { type: "string", enum: ["any", "all"], default: "any" }
        ),
        listParam(
          "creator",
          "Creators, any of them: X handles (with or without `@`) or display names, ignoring case.",
          { type: "string" }
        ),
        queryParam("type", "Only videos sharing a prompt, or a skill.", {
          type: "string",
          enum: [...MOTION_TYPES],
        }),
        queryParam("sort", "By post date. Defaults to `newest`.", {
          type: "string",
          enum: ["newest", "oldest"],
          default: "newest",
        }),
        limitParam(12, 50),
        offsetParam,
      ],
      response: {
        description: "The matching videos, without prompts.",
        schema: "VideoSearchResult",
      },
    }),
    "/api/catalog/videos/{slug}": queryGet({
      operationId: "get-video",
      summary: "Get a video",
      description:
        "One gallery video with its prompt or skill, its category, the videos before and after it in that category, and the five most similar videos.",
      parameters: [
        {
          name: "slug",
          in: "path",
          required: true,
          description: "The video's slug.",
          schema: { type: "string" },
        },
      ],
      response: { description: "The video.", schema: "VideoDetail" },
      notFound: {
        description:
          "No video with that slug. Names the video it duplicated when it was removed as a duplicate, and suggests the creator's other videos.",
        schema: "VideoNotFound",
      },
    }),
    "/api/catalog/facets": queryGet({
      operationId: "get-facets",
      summary: "Get the filters",
      description:
        "Every value the search endpoints filter by, with how many videos or entries carry it: video categories (with titles and descriptions), models, colours and types; each directory section's filters, categories and sorts; and the move families.",
      parameters: [],
      response: { description: "The filter values.", schema: "Facets" },
    }),
    "/api/catalog/directories/search": queryGet({
      operationId: "search-directory",
      summary: "Search a directory",
      description:
        "Entries of one directory section matching every facet given: tools (filter by pricing), skills (by renderer), creatives (studios and designers, by specialty) or extras (articles and resources, by resource type).",
      parameters: [
        queryParam(
          "section",
          "The directory section, as in the site's URLs.",
          { type: "string", enum: [...DIRECTORY_SECTIONS] },
          true
        ),
        queryParam(
          "q",
          "Keywords; every word must appear in the name, description, category, renderers or specialties.",
          { type: "string" }
        ),
        listParam(
          "filter",
          "The section's facet, any of them: pricing for tools, renderer for skills, specialty for creatives, resource type for extras (see `get-facets`).",
          { type: "string", enum: ALL_DIRECTORY_FILTERS }
        ),
        listParam(
          "category",
          "The section's categories, any of them, ignoring case (see `get-facets`).",
          { type: "string" }
        ),
        queryParam(
          "sort",
          "One of the section's sorts (see `get-facets`); without one, the site's curated order.",
          { type: "string", enum: ALL_DIRECTORY_SORTS }
        ),
        limitParam(24, 100),
        offsetParam,
      ],
      response: {
        description: "The matching entries.",
        schema: "DirectorySearchResult",
      },
    }),
  },
  components: {
    parameters: {
      IfNoneMatch: {
        name: "If-None-Match",
        in: "header",
        required: false,
        description:
          "The `ETag` of an earlier response. If it is still current, the response is a `304` with no body. Send the value exactly as received (one quoted value): lists, weak `W/` validators and `*` always get a full response.",
        schema: { type: "string" },
      },
    },
    headers: {
      ETag: {
        description:
          "Quoted SHA-256 hex digest of the response body. Changes whenever the data does.",
        schema: { type: "string" },
      },
      CacheControl: {
        description:
          "Browsers reuse a response for 5 minutes and shared caches for an hour, then may serve it stale for up to a day while they revalidate.",
        schema: { type: "string", enum: [CACHE_CONTROL.CATALOG] },
      },
    },
    responses: {
      NotModified: {
        description:
          "Not modified: `If-None-Match` matched the current `ETag`. No body; reuse the copy you have.",
        headers: { ETag: { $ref: "#/components/headers/ETag" } },
      },
    },
    schemas: {
      MotionCatalog: {
        type: "object",
        required: ["importedAt", "videos", "removed"],
        properties: {
          importedAt: {
            type: "string",
            format: "date-time",
            description: "When the catalog was last imported.",
          },
          videos: {
            type: "array",
            description: "Every gallery video, in catalog order.",
            items: ref("MotionVideo"),
          },
          removed: {
            type: "array",
            description:
              "Videos removed as duplicates. Their old page URLs redirect to the video they duplicated.",
            items: ref("RemovedVideo"),
          },
        },
      },
      MotionVideo: {
        type: "object",
        required: [
          "slug",
          "title",
          "date",
          "tags",
          "contentTags",
          "promptShared",
          "handle",
          "avatar",
          "poster",
          "preview",
          "video",
          "width",
          "height",
        ],
        properties: {
          slug: {
            type: "string",
            description:
              "Stable ID: the creator's handle and a short hash. The video's page is `/videos/{slug}` in English and `/{locale}/videos/{slug}` in other languages, e.g. `/fr/videos/{slug}`.",
          },
          title: { type: "string" },
          date: {
            type: "string",
            format: "date",
            description: "When the creator posted it (YYYY-MM-DD).",
          },
          tags: {
            type: "array",
            description:
              "What it shares to remake it: a prompt, a skill, or both.",
            items: { type: "string", enum: [...MOTION_TYPES] },
          },
          contentTags: {
            type: "array",
            description: "Gallery categories, at least one.",
            items: { type: "string", enum: [...MOTION_CATEGORIES] },
          },
          promptShared: {
            type: "boolean",
            description: "Whether the creator shared the prompt.",
          },
          handle: {
            type: "string",
            description: "The creator's X handle, without `@`.",
          },
          creatorName: {
            type: "string",
            description: "The creator's display name on X, when known.",
          },
          avatar: {
            type: "string",
            format: "uri",
            description: "The creator's avatar (WebP).",
          },
          poster: {
            type: "string",
            format: "uri",
            description: "Poster image (WebP).",
          },
          blur: {
            type: "string",
            description:
              "A tiny version of the poster as a `data:` URI, to show while media loads.",
          },
          preview: {
            type: "string",
            format: "uri",
            description: "Small looping preview (MP4).",
          },
          video: {
            type: "string",
            format: "uri",
            description: "The full video (MP4).",
          },
          width: { type: "integer", description: "Video width in pixels." },
          height: { type: "integer", description: "Video height in pixels." },
          prompt: {
            type: "string",
            description: "The prompt the creator used, when shared.",
          },
          skillUrl: {
            type: "string",
            format: "uri",
            description: "The agent skill the video was made with.",
          },
          skillInstall: {
            type: "string",
            description:
              "The command that installs the skill, e.g. `npx skills add …`.",
          },
          tweetUrl: {
            type: "string",
            format: "uri",
            description: "The source post on X.",
          },
          description: { type: "string" },
          model: {
            type: "string",
            enum: [...MOTION_MODELS],
            description:
              "The model it was made with, as the creator reported it.",
          },
          stack: {
            type: "string",
            description:
              "What rendered it, as the creator reported it, e.g. `Remotion` or `HTML + Playwright`.",
          },
          effort: {
            type: "string",
            enum: [...EFFORTS],
            description: "The reasoning effort the model ran at.",
          },
          iterations: {
            type: "string",
            enum: [...ITERATIONS],
            description: "How many rounds of feedback it took.",
          },
          colors: {
            type: "array",
            description:
              "Dominant colours as hex without `#`, the largest share of the frame first.",
            items: { type: "string", pattern: "^[0-9a-f]{6}$" },
          },
        },
      },
      RemovedVideo: {
        type: "object",
        required: ["slug", "duplicateOf", "tweetUrl"],
        properties: {
          slug: { type: "string", description: "The removed video's slug." },
          duplicateOf: {
            type: "string",
            description:
              "Slug of the video it duplicated (which may itself be removed later).",
          },
          tweetUrl: { type: "string", format: "uri" },
        },
      },
      Directories: {
        type: "object",
        required: ["importedAt", "tools", "studios"],
        properties: {
          importedAt: {
            type: "string",
            format: "date-time",
            description: "When the directories were last imported.",
          },
          tools: {
            type: "object",
            description:
              "Tools, plus skills (category `Skills`), web articles (`Articles`) and resources (`Resources`); the site lists the last three under Skills and Extras.",
            required: ["entries"],
            properties: {
              entries: { type: "array", items: ref("DirectoryEntry") },
            },
          },
          studios: {
            type: "object",
            description:
              "Studios (category `Studio`) and designers (`Designers`), listed on the site as Creatives.",
            required: ["entries"],
            properties: {
              entries: { type: "array", items: ref("DirectoryEntry") },
            },
          },
        },
      },
      DirectoryEntry: {
        type: "object",
        required: [
          "id",
          "name",
          "description",
          "category",
          "url",
          "cover",
          "addedAt",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          category: {
            type: "string",
            description: "e.g. `Editor`, `AI`, `Skills`, `Studio`.",
          },
          url: { type: "string", format: "uri" },
          cover: {
            type: ["string", "null"],
            format: "uri",
            description: "Cover image (WebP), or `null` without one.",
          },
          addedAt: {
            type: "string",
            format: "date",
            description: "When the entry joined the directory (YYYY-MM-DD).",
          },
          pricing: {
            type: "string",
            enum: [...DIRECTORY_FILTERS.tool],
            description: "Tools only.",
          },
          stars: {
            type: "integer",
            description: "Skills only: GitHub stars.",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Skills only: the repository's last push.",
          },
          renderers: {
            type: "array",
            description:
              "Skills only: what renders the video, most central first.",
            items: { type: "string", enum: [...DIRECTORY_FILTERS.skill] },
          },
          specialties: {
            type: "array",
            description:
              "Studios and designers only: what they're known for, strongest first.",
            items: { type: "string", enum: [...DIRECTORY_FILTERS.studio] },
          },
          resourceType: {
            type: "string",
            enum: [...DIRECTORY_FILTERS.extra],
            description: "Resources only.",
          },
          publishedAt: {
            type: "string",
            format: "date-time",
            description: "Articles only: when it was published.",
          },
        },
      },
      VideoSummary: {
        type: "object",
        required: [
          "slug",
          "title",
          "date",
          "tags",
          "contentTags",
          "promptShared",
          "handle",
          "avatar",
          "poster",
          "preview",
          "video",
          "width",
          "height",
          "colorNames",
          "pageUrl",
        ],
        description:
          "A gallery video without its prompt; the fields are those of `MotionVideo`, plus `colorNames` and `pageUrl`.",
        properties: {
          slug: { type: "string" },
          title: { type: "string" },
          date: { type: "string", format: "date" },
          tags: {
            type: "array",
            items: { type: "string", enum: [...MOTION_TYPES] },
          },
          contentTags: {
            type: "array",
            items: { type: "string", enum: [...MOTION_CATEGORIES] },
          },
          promptShared: { type: "boolean" },
          handle: { type: "string" },
          creatorName: { type: "string" },
          avatar: { type: "string", format: "uri" },
          poster: { type: "string", format: "uri" },
          preview: { type: "string", format: "uri" },
          video: { type: "string", format: "uri" },
          width: { type: "integer" },
          height: { type: "integer" },
          description: { type: "string" },
          model: { type: "string", enum: [...MOTION_MODELS] },
          stack: { type: "string" },
          effort: { type: "string", enum: [...EFFORTS] },
          iterations: { type: "string", enum: [...ITERATIONS] },
          colorNames: {
            type: "array",
            description: "Named colours the video contains.",
            items: { type: "string", enum: COLOR_SLUGS },
          },
          pageUrl: {
            type: "string",
            format: "uri",
            description: "The video's page in English.",
          },
        },
      },
      VideoSearchResult: {
        type: "object",
        required: ["total", "limit", "offset", "videos", "resolved"],
        properties: {
          total: {
            type: "integer",
            description: "Matches before paging.",
          },
          limit: { type: "integer" },
          offset: { type: "integer" },
          videos: { type: "array", items: ref("VideoSummary") },
          resolved: {
            type: "object",
            required: ["models", "creators"],
            properties: {
              models: resolutionSchema("model"),
              creators: resolutionSchema("creator", {
                similar: {
                  type: "array",
                  description:
                    "With no match: up to five handles containing what was sent.",
                  items: { type: "string" },
                },
              }),
            },
          },
          perFacet: {
            type: "array",
            description:
              "Only with no match and several facets: how many videos each facet matches alone.",
            items: {
              type: "object",
              required: ["facet", "total"],
              properties: {
                facet: { type: "string", enum: VIDEO_FACETS },
                total: { type: "integer" },
              },
            },
          },
        },
      },
      VideoDetail: {
        description:
          "A `VideoSummary` plus the prompt, skill, source post, hex colours, category, neighbours and similar videos.",
        allOf: [
          ref("VideoSummary"),
          {
            type: "object",
            required: ["neighbours", "similar"],
            properties: {
              prompt: { type: "string" },
              skillUrl: { type: "string", format: "uri" },
              skillInstall: { type: "string" },
              tweetUrl: { type: "string", format: "uri" },
              colors: {
                type: "array",
                items: { type: "string", pattern: "^[0-9a-f]{6}$" },
              },
              category: {
                type: "string",
                enum: [...MOTION_CATEGORIES],
                description: "The category page the video belongs to.",
              },
              categoryUrl: { type: "string", format: "uri" },
              neighbours: {
                type: "object",
                description:
                  "Slugs of the videos before and after it in its category, newest first.",
                properties: {
                  previous: { type: "string" },
                  next: { type: "string" },
                },
              },
              similar: {
                type: "array",
                description: "The five most similar videos, best first.",
                items: ref("VideoRef"),
              },
            },
          },
        ],
      },
      VideoRef: {
        type: "object",
        required: ["slug", "title"],
        properties: {
          slug: { type: "string" },
          title: { type: "string" },
        },
      },
      VideoNotFound: {
        type: "object",
        required: ["error", "message", "suggestions"],
        properties: {
          error: { type: "string", enum: ["not_found"] },
          message: { type: "string" },
          duplicateOf: {
            type: "string",
            description:
              "When the slug was removed as a duplicate: the video it duplicated.",
          },
          suggestions: {
            type: "array",
            description: "Up to five videos by the same creator.",
            items: ref("VideoRef"),
          },
        },
      },
      FacetCount: {
        type: "object",
        required: ["id", "count"],
        properties: {
          id: { type: "string" },
          count: { type: "integer" },
        },
      },
      Facets: {
        type: "object",
        required: ["videos", "directories", "moves"],
        properties: {
          videos: {
            type: "object",
            required: [
              "total",
              "creators",
              "categories",
              "models",
              "colors",
              "types",
              "sorts",
            ],
            properties: {
              total: { type: "integer" },
              creators: {
                type: "integer",
                description: "How many creators have videos.",
              },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "count", "title", "description", "url"],
                  properties: {
                    id: { type: "string", enum: [...MOTION_CATEGORIES] },
                    count: { type: "integer" },
                    title: { type: "string" },
                    description: { type: "string" },
                    url: { type: "string", format: "uri" },
                  },
                },
              },
              models: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "count", "fullName", "family"],
                  properties: {
                    id: { type: "string", enum: [...MOTION_MODELS] },
                    count: { type: "integer" },
                    fullName: { type: "string" },
                    family: { type: "string" },
                  },
                },
              },
              colors: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "count", "hex"],
                  properties: {
                    id: { type: "string", enum: COLOR_SLUGS },
                    count: { type: "integer" },
                    hex: { type: "string", pattern: "^[0-9a-f]{6}$" },
                  },
                },
              },
              types: { type: "array", items: ref("FacetCount") },
              sorts: {
                type: "array",
                items: { type: "string", enum: ["newest", "oldest"] },
              },
            },
          },
          directories: {
            type: "array",
            items: {
              type: "object",
              required: ["section", "total", "filters", "categories", "sorts"],
              properties: {
                section: { type: "string", enum: [...DIRECTORY_SECTIONS] },
                total: { type: "integer" },
                filters: { type: "array", items: ref("FacetCount") },
                categories: { type: "array", items: ref("FacetCount") },
                sorts: {
                  type: "array",
                  items: { type: "string", enum: ALL_DIRECTORY_SORTS },
                },
              },
            },
          },
          moves: {
            type: "object",
            required: ["total", "families"],
            properties: {
              total: { type: "integer" },
              families: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "count"],
                  properties: {
                    id: { type: "string", enum: [...MOVE_FAMILIES] },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      DirectorySearchResult: {
        type: "object",
        required: ["section", "total", "limit", "offset", "entries"],
        properties: {
          section: { type: "string", enum: [...DIRECTORY_SECTIONS] },
          total: { type: "integer", description: "Matches before paging." },
          limit: { type: "integer" },
          offset: { type: "integer" },
          entries: { type: "array", items: ref("DirectoryEntry") },
        },
      },
      InvalidParameter: {
        type: "object",
        required: ["error", "parameter", "message"],
        properties: {
          error: { type: "string", enum: ["invalid_parameter"] },
          parameter: { type: "string" },
          message: { type: "string" },
          allowed: {
            type: "array",
            description:
              "The values the parameter can take, when it has a fixed set.",
            items: { type: "string" },
          },
        },
      },
      Moves: {
        type: "object",
        required: ["moves"],
        properties: {
          moves: { type: "array", items: ref("Move") },
        },
      },
      Move: {
        type: "object",
        required: [
          "slug",
          "name",
          "family",
          "aka",
          "summary",
          "body",
          "goodFor",
          "examples",
          "related",
        ],
        properties: {
          slug: {
            type: "string",
            description:
              "Stable ID. The move's page is `/moves/{family}/{slug}` under a locale.",
          },
          name: { type: "string" },
          family: { type: "string", enum: [...MOVE_FAMILIES] },
          aka: {
            type: "array",
            description: "Other names people search for.",
            items: { type: "string" },
          },
          summary: {
            type: "string",
            description: "One sentence: what it looks like.",
          },
          body: {
            type: "string",
            description:
              "Markdown: how it reads, when it works, common mistakes.",
          },
          goodFor: {
            type: "array",
            description: "Short tags, e.g. `logo stings`.",
            items: { type: "string" },
          },
          examples: {
            type: "array",
            description: "Slugs of catalog videos that show the move.",
            items: { type: "string" },
          },
          related: {
            type: "array",
            description: "Slugs of related moves.",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

/**
 * The API reference pages: one per operation, named after its operationId
 * (fumadocs-openapi's default, see docs-source.ts). Every operation is a GET.
 */
export const API_REFERENCE_PATHS = Object.values(
  openApiDocument.paths ?? {}
).flatMap((item) =>
  item?.get?.operationId ? [`${ROUTES.DOCS_API}/${item.get.operationId}`] : []
);
