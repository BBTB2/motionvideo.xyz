import { createFileRoute } from "@tanstack/react-router";
import { getIntlayer } from "intlayer";
import { useIntlayer, useLocale } from "react-intlayer";

import { CollectionIntro } from "@/components/collection-intro";
import {
  CategoryChip,
  CollectionToolbar,
} from "@/components/collection-toolbar";
import { EntryCard } from "@/components/entry-card";
import { FeedButtons } from "@/components/feed-buttons";
import { ListingGrid } from "@/components/listing-grid";
import { DEFAULT_LOCALE, isLocale } from "@/constants/locales";
import { ROUTES } from "@/constants/routes";
import catalog from "@/data/motion-catalog.json";
import {
  CHANGELOG_ENTRIES,
  CHANGELOG_FEEDS,
  CHANGELOG_TAGS,
  formatChangelogDate,
} from "@/lib/changelog";
import { pickVideos } from "@/lib/video-picks";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createMetadata } from "@/seo/metadata";
import { getLandingData } from "@/server/functions";

interface ChangelogSearch {
  tag?: (typeof CHANGELOG_TAGS)[number];
}

// Equal-height collection cards keep the cover, summary and date together, with
// a product pill toolbar that filters in place via the `tag` search param.
const Changelog = () => {
  const content = useIntlayer("changelog");
  const sections = useIntlayer("site-footer");
  const { locale } = useLocale();
  const { covers } = Route.useLoaderData();
  const { tag } = Route.useSearch();

  const entries = tag
    ? CHANGELOG_ENTRIES.filter((entry) => entry.data.tags.includes(tag))
    : CHANGELOG_ENTRIES;

  return (
    <>
      <CollectionToolbar label={content.filterBy.value}>
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            to={ROUTES.CHANGELOG}
            search={{ tag: undefined }}
            active={!tag}
            label={content.all}
          />
          {CHANGELOG_TAGS.map((product) => (
            <CategoryChip
              key={product}
              to={ROUTES.CHANGELOG}
              search={{ tag: product }}
              active={tag === product}
              label={product}
            />
          ))}
        </div>
      </CollectionToolbar>
      <ListingGrid
        ordered
        intro={
          <CollectionIntro
            titleId="changelog-intro-title"
            title={sections.changelog.value}
            description={
              locale === DEFAULT_LOCALE
                ? content.intro
                : `${content.intro.value} ${content.englishOnly.value}`
            }
            actions={<FeedButtons feeds={CHANGELOG_FEEDS} />}
          />
        }
      >
        {entries.map((entry) => (
          <li key={entry.url} className="h-full">
            <EntryCard
              to={ROUTES.CHANGELOG_ENTRY}
              params={{ slug: entry.slugs.join("/") }}
              cover={covers[entry.data.cover]}
              tags={entry.data.tags}
              title={entry.data.title}
              description={entry.data.description}
              meta={
                <time dateTime={entry.data.date}>
                  {formatChangelogDate(entry.data.date, locale)}
                </time>
              }
            />
          </li>
        ))}
      </ListingGrid>
    </>
  );
};

export const Route = createFileRoute("/{-$locale}/_pages/changelog/")({
  component: Changelog,
  // Only the cover posters' fields, not the catalog.
  loader: async () => ({
    ...(await getLandingData()),
    covers: pickVideos(
      CHANGELOG_ENTRIES.map((entry) => entry.data.cover),
      catalog.videos
    ),
  }),
  validateSearch: (search): ChangelogSearch => ({
    tag: CHANGELOG_TAGS.find((entry) => entry === search.tag),
  }),
  head: ({ params }) => {
    const content = getIntlayer(
      "changelog",
      isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    );
    const sections = getIntlayer(
      "site-footer",
      isLocale(params.locale) ? params.locale : DEFAULT_LOCALE
    );
    return {
      ...createMetadata({
        description: content.intro,
        title: sections.changelog,
      }),
      links: CHANGELOG_FEEDS.links,
      scripts: [
        breadcrumbJsonLd(
          { page: "changelog", path: ROUTES.CHANGELOG },
          params.locale
        ),
      ],
    };
  },
});
