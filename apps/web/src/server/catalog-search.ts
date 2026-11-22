import { getIntlayer } from "intlayer";
import { z } from "zod";

import { CACHE_CONTROL } from "@/constants/cache-control";
import { DEFAULT_LOCALE, localizedPath } from "@/constants/locales";
import { categoryPath, videoPath } from "@/constants/routes";
import { absoluteUrl } from "@/constants/url";
import catalog from "@/data/motion-catalog.json";
import {
  DIRECTORY_CATEGORIES,
  DIRECTORY_ENTRIES,
  DIRECTORY_FILTERS,
  DIRECTORY_SORTS,
  filterValuesOf,
  sortDirectoryEntries,
} from "@/lib/directories";
import type {
  DirectoryEntry,
  DirectoryKind,
  DirectorySort,
} from "@/lib/directories";
import {
  MOTION_CATEGORIES,
  MOTION_COLORS,
  MOTION_MODEL_FAMILY,
  MOTION_MODEL_NAMES,
  MOTION_MODELS,
  MOTION_TYPES,
  findMotionCategory,
  matchMotionVideos,
  motionModelSlug,
  similarMotionVideos,
  videoColorNames,
  videoMatchers,
} from "@/lib/motion-catalog";
import type {
  MotionCategory,
  MotionVideo,
  VideoCriteria,
} from "@/lib/motion-catalog";
import { MOVE_FAMILIES } from "@/lib/move-families";
import { MOVES } from "@/lib/moves";

// Server only: the query endpoints over the catalog data, for agents and
// integrations that ask questions instead of downloading everything:
// `/api/catalog/search`, `/api/catalog/videos/{slug}`, `/api/catalog/facets`
// and `/api/catalog/directories/search`. They run the same filters as the
// gallery and the directory pages (lib/motion-catalog, lib/directories), so
// an answer here matches what the site shows. Documented in openapi.ts.

const videos: MotionVideo[] = catalog.videos;

const pageUrl = (path: string) =>
  absoluteUrl(localizedPath(path, DEFAULT_LOCALE));

const json = <Body>(body: Body, status = 200) =>
  Response.json(body, {
    status,
    headers:
      status === 200 ? { "Cache-Control": CACHE_CONTROL.CATALOG } : undefined,
  });

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

/** A 400 naming the parameter, so callers (and agents) can fix the request. */
class InvalidParameterError extends Error {
  readonly parameter: string;
  readonly allowed?: readonly string[];

  constructor(parameter: string, message: string, allowed?: readonly string[]) {
    super(message);
    this.name = "InvalidParameterError";
    this.parameter = parameter;
    this.allowed = allowed;
  }
}

const invalidResponse = (error: InvalidParameterError) =>
  json(
    {
      allowed: error.allowed,
      error: "invalid_parameter",
      message: error.message,
      parameter: error.parameter,
    },
    400
  );

/** Every value of a list parameter: repeated keys and comma-separated. */
const listParam = (url: URL, name: string): string[] =>
  url.searchParams
    .getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const textParam = (url: URL, name: string): string | undefined =>
  url.searchParams.get(name)?.trim() || undefined;

const oneOf = <T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[]
): T | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const match = allowed.find((option) => option === value);
  if (!match) {
    throw new InvalidParameterError(
      name,
      `Unknown ${name} "${value}".`,
      allowed
    );
  }
  return match;
};

const allOf = <T extends string>(
  name: string,
  values: string[],
  allowed: readonly T[]
): T[] => values.flatMap((value) => oneOf(name, value, allowed) ?? []);

const intParam = (
  url: URL,
  name: string,
  { min, max, fallback }: { min: number; max: number; fallback: number }
): number => {
  const raw = textParam(url, name);
  if (raw === undefined) {
    return fallback;
  }
  const value = z.coerce.number().int().min(min).max(max).safeParse(raw);
  if (!value.success) {
    throw new InvalidParameterError(
      name,
      `${name} must be a whole number from ${min} to ${max}.`
    );
  }
  return value.data;
};

const rejectUnknown = (url: URL, known: readonly string[]) => {
  for (const name of url.searchParams.keys()) {
    if (!known.includes(name)) {
      throw new InvalidParameterError(
        name,
        `Unknown parameter "${name}".`,
        known
      );
    }
  }
};

/** Runs a handler, answering a bad parameter with a 400. */
const withParams =
  (handler: (url: URL) => Response) =>
  (request: Request): Response => {
    try {
      return handler(new URL(request.url));
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        return invalidResponse(error);
      }
      throw error;
    }
  };

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

const modelKey = (value: string) =>
  motionModelSlug(value.trim().replace(/^claude\s+/iu, ""));

/**
 * The MOTION_MODELS a requested model names: an exact name (`Opus 5.5`), the
 * full name (`Claude Opus 5.5`), a family (`Gemini`) or a bare version
 * (`5.5`, every model with it).
 */
const resolveModel = (requested: string): string[] => {
  const key = modelKey(requested);
  return MOTION_MODELS.filter((model) => {
    const slug = motionModelSlug(model);
    return (
      slug === key ||
      modelKey(MOTION_MODEL_NAMES[model]) === key ||
      motionModelSlug(MOTION_MODEL_FAMILY[model]) === key ||
      (/^\d/u.test(key) && slug.endsWith(`-${key}`))
    );
  });
};

const creatorKey = (value: string) =>
  value.trim().replace(/^@/u, "").toLowerCase();

/** Handles a requested creator names (handle or display name), and near misses. */
const resolveCreator = (requested: string) => {
  const key = creatorKey(requested);
  const matched = new Set<string>();
  const similar = new Set<string>();
  for (const video of videos) {
    const handleKey = video.handle.toLowerCase();
    const nameKey = video.creatorName?.toLowerCase();
    if (handleKey === key || nameKey === key) {
      matched.add(video.handle);
    } else if (handleKey.includes(key) || nameKey?.includes(key)) {
      similar.add(video.handle);
    }
  }
  return {
    matched: [...matched],
    requested,
    similar: matched.size > 0 ? [] : [...similar].slice(0, 5),
  };
};

const toSummary = (video: MotionVideo) => ({
  avatar: video.avatar,
  colorNames: videoColorNames(video),
  contentTags: video.contentTags,
  creatorName: video.creatorName,
  date: video.date,
  description: video.description,
  effort: video.effort,
  handle: video.handle,
  height: video.height,
  iterations: video.iterations,
  model: video.model,
  pageUrl: pageUrl(videoPath(video.slug)),
  poster: video.poster,
  preview: video.preview,
  promptShared: video.promptShared,
  slug: video.slug,
  stack: video.stack,
  tags: video.tags,
  title: video.title,
  video: video.video,
  width: video.width,
});

const VIDEO_SEARCH_PARAMS = [
  "q",
  "category",
  "model",
  "color",
  "colorMatch",
  "creator",
  "type",
  "sort",
  "limit",
  "offset",
] as const;

const COLOR_SLUGS = MOTION_COLORS.map((color) => color.slug);

/** A list facet only when the parameter was given. */
const given = <T>(values: T[]): T[] | undefined =>
  values.length > 0 ? values : undefined;

export const searchVideosResponse = withParams((url) => {
  rejectUnknown(url, VIDEO_SEARCH_PARAMS);
  const models = listParam(url, "model").map((requested) => ({
    matched: resolveModel(requested),
    requested,
  }));
  const creators = listParam(url, "creator").map(resolveCreator);
  const colorSlugs = allOf("color", listParam(url, "color"), COLOR_SLUGS);
  const criteria: VideoCriteria = {
    categories: given(
      allOf("category", listParam(url, "category"), MOTION_CATEGORIES)
    ),
    colorMatch:
      oneOf("colorMatch", textParam(url, "colorMatch"), ["any", "all"]) ??
      "any",
    colors: given(
      MOTION_COLORS.filter((color) => colorSlugs.includes(color.slug)).map(
        (color) => color.hex
      )
    ),
    // A model or creator that resolved to nothing filters to nothing.
    creators:
      creators.length > 0
        ? creators.flatMap((entry) => entry.matched)
        : undefined,
    models:
      models.length > 0 ? models.flatMap((entry) => entry.matched) : undefined,
    q: textParam(url, "q"),
    type: oneOf("type", textParam(url, "type"), MOTION_TYPES),
  };
  const sort =
    oneOf("sort", textParam(url, "sort"), ["newest", "oldest"]) ?? "newest";
  const limit = intParam(url, "limit", { fallback: 12, max: 50, min: 1 });
  const offset = intParam(url, "offset", {
    fallback: 0,
    max: videos.length,
    min: 0,
  });

  const matches = matchMotionVideos(videos, criteria, sort);
  const matchers = videoMatchers(criteria);
  return json({
    limit,
    offset,
    // With no match and several facets: how many each matches alone.
    perFacet:
      matches.length === 0 && matchers.length > 1
        ? matchers.map(({ facet, test }) => ({
            facet,
            total: videos.filter(test).length,
          }))
        : undefined,
    resolved: { creators, models },
    total: matches.length,
    videos: matches.slice(offset, offset + limit).map(toSummary),
  });
});

const NEIGHBOUR_SORT = "newest" as const;

export const videoDetailResponse = (slug: string) => {
  const video = videos.find((entry) => entry.slug === slug);
  if (!video) {
    const duplicateOf = catalog.removed.find(
      (entry) => entry.slug === slug
    )?.duplicateOf;
    // Slugs are `<handle>-<hash>`: suggest that creator's videos.
    const creator = slug.includes("-")
      ? slug.slice(0, slug.lastIndexOf("-"))
      : slug;
    const suggestions = matchMotionVideos(
      videos,
      { q: creator },
      NEIGHBOUR_SORT
    )
      .slice(0, 5)
      .map((entry) => ({ slug: entry.slug, title: entry.title }));
    return json(
      {
        duplicateOf,
        error: "not_found",
        message: `No catalog video with slug "${slug}".`,
        suggestions,
      },
      404
    );
  }
  // The first content tag is the category page the video belongs to.
  const category = findMotionCategory(video.contentTags[0]);
  const inCategory = matchMotionVideos(
    videos,
    { categories: category ? [category] : undefined },
    NEIGHBOUR_SORT
  );
  const index = inCategory.findIndex((entry) => entry.slug === slug);
  return json({
    ...toSummary(video),
    category,
    categoryUrl: category ? pageUrl(categoryPath(category)) : undefined,
    colors: video.colors,
    neighbours: {
      next: inCategory[index + 1]?.slug,
      previous: index > 0 ? inCategory[index - 1]?.slug : undefined,
    },
    prompt: video.prompt,
    similar: similarMotionVideos(video, videos, 5).map((entry) => ({
      slug: entry.slug,
      title: entry.title,
    })),
    skillInstall: video.skillInstall,
    skillUrl: video.skillUrl,
    tweetUrl: video.tweetUrl,
  });
};

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

/** Public section names, as in the site's URLs. */
const SECTION_NAMES = ["tools", "skills", "creatives", "extras"] as const;

type Section = (typeof SECTION_NAMES)[number];

/** The DirectoryKind behind each section. */
const SECTIONS: Record<Section, DirectoryKind> = {
  creatives: "studio",
  extras: "extra",
  skills: "skill",
  tools: "tool",
};

const DIRECTORY_SEARCH_PARAMS = [
  "section",
  "q",
  "filter",
  "category",
  "sort",
  "limit",
  "offset",
] as const;

const matchesText = (entry: DirectoryEntry, words: string[]) => {
  const text = [
    entry.name,
    entry.description,
    entry.category,
    ...(entry.renderers ?? []),
    ...(entry.specialties ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return words.every((word) => text.includes(word));
};

export const searchDirectoryResponse = withParams((url) => {
  rejectUnknown(url, DIRECTORY_SEARCH_PARAMS);
  const section = oneOf("section", textParam(url, "section"), SECTION_NAMES);
  if (!section) {
    throw new InvalidParameterError(
      "section",
      "section is required.",
      SECTION_NAMES
    );
  }
  const kind = SECTIONS[section];
  const filters = allOf(
    "filter",
    listParam(url, "filter"),
    DIRECTORY_FILTERS[kind]
  );
  const knownCategories = DIRECTORY_CATEGORIES[kind].map(
    (category) => category.id
  );
  const categories = listParam(url, "category").map((requested) => {
    const match = knownCategories.find(
      (category) => category.toLowerCase() === requested.toLowerCase()
    );
    if (!match) {
      throw new InvalidParameterError(
        "category",
        `Unknown ${section} category "${requested}".`,
        knownCategories
      );
    }
    return match;
  });
  const sort = oneOf<DirectorySort>(
    "sort",
    textParam(url, "sort"),
    DIRECTORY_SORTS[kind]
  );
  const words =
    textParam(url, "q")?.toLowerCase().split(/\s+/u).filter(Boolean) ?? [];
  const limit = intParam(url, "limit", { fallback: 24, max: 100, min: 1 });
  const offset = intParam(url, "offset", {
    fallback: 0,
    max: DIRECTORY_ENTRIES[kind].length,
    min: 0,
  });

  const matches = sortDirectoryEntries(
    DIRECTORY_ENTRIES[kind].filter(
      (entry) =>
        (filters.length === 0 ||
          filterValuesOf(kind, entry).some((value) =>
            filters.some((filter) => filter === value)
          )) &&
        (categories.length === 0 || categories.includes(entry.category)) &&
        matchesText(entry, words)
    ),
    sort
  );
  return json({
    entries: matches.slice(offset, offset + limit),
    limit,
    offset,
    section,
    total: matches.length,
  });
});

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

const countBy = <T>(items: T[], key: (item: T) => readonly string[]) => {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const value of key(item)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
};

const buildFacets = () => {
  const meta = getIntlayer("gallery-meta", DEFAULT_LOCALE).categories;
  const categoryCounts = countBy(videos, (video) => video.contentTags);
  const modelCounts = countBy(videos, (video) =>
    video.model ? [video.model] : []
  );
  const typeCounts = countBy(videos, (video) => video.tags);
  const colorCounts = countBy(videos, videoColorNames);
  const familyCounts = countBy(MOVES, (move) => [move.family]);
  return {
    directories: SECTION_NAMES.map((section) => {
      const kind = SECTIONS[section];
      const entries = DIRECTORY_ENTRIES[kind];
      const filterCounts = countBy(entries, (entry) =>
        filterValuesOf(kind, entry)
      );
      const categoryCountsInSection = countBy(entries, (entry) => [
        entry.category,
      ]);
      return {
        categories: DIRECTORY_CATEGORIES[kind].map((category) => ({
          count: categoryCountsInSection.get(category.id) ?? 0,
          id: category.id,
        })),
        filters: DIRECTORY_FILTERS[kind].map((id) => ({
          count: filterCounts.get(id) ?? 0,
          id,
        })),
        section,
        sorts: [...DIRECTORY_SORTS[kind]],
        total: entries.length,
      };
    }),
    moves: {
      families: MOVE_FAMILIES.map((id) => ({
        count: familyCounts.get(id) ?? 0,
        id,
      })),
      total: MOVES.length,
    },
    videos: {
      categories: MOTION_CATEGORIES.map((id: MotionCategory) => ({
        count: categoryCounts.get(id) ?? 0,
        description: String(meta[id].description),
        id,
        title: String(meta[id].title),
        url: pageUrl(categoryPath(id)),
      })),
      colors: MOTION_COLORS.map((color) => ({
        count: colorCounts.get(color.slug) ?? 0,
        hex: color.hex,
        id: color.slug,
      })),
      creators: new Set(videos.map((video) => video.handle)).size,
      models: MOTION_MODELS.map((model) => ({
        count: modelCounts.get(model) ?? 0,
        family: MOTION_MODEL_FAMILY[model],
        fullName: MOTION_MODEL_NAMES[model],
        id: model,
      })),
      sorts: ["newest", "oldest"],
      total: videos.length,
      types: MOTION_TYPES.map((id) => ({ count: typeCounts.get(id) ?? 0, id })),
    },
  };
};

/** Built once per isolate: the data is bundled, so it can't change. */
let facets: object | undefined;

export const facetsResponse = () => {
  facets ??= buildFacets();
  return json(facets);
};

export { SECTION_NAMES as DIRECTORY_SECTIONS };
