import { createFileRoute } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";
import { z } from "zod";

import { CollectionGrid } from "@/components/collection-grid";
import {
  CollectionIntro,
  SurpriseAndSubmit,
} from "@/components/collection-intro";
import {
  CategoryChip,
  CollectionToolbar,
} from "@/components/collection-toolbar";
import { LocalizedLink as Link } from "@/components/localized-link";
import { CreatorAvatar, MotionPreview } from "@/components/motion-video";
import { ROUTES } from "@/constants/routes";
import catalog from "@/data/motion-catalog.json";
import { useLocalizedNavigate } from "@/hooks/use-localized-navigate";
import { MOTION_CATEGORIES } from "@/lib/motion-catalog";
import type { MotionCategory, MotionVideo } from "@/lib/motion-catalog";
import type { MasonryItem } from "@/registry/components/virtual-masonry";
import { createMetadata } from "@/seo/metadata";

const videos: MotionVideo[] = catalog.videos;
const promptVideos = videos.filter((video) => video.prompt);
// Categories with at least one prompt, in gallery order.
const categories = MOTION_CATEGORIES.filter((category) =>
  promptVideos.some((video) => video.contentTags.includes(category))
);

/**
 * One prompt to customize, shown like a gallery card (the clip playing) but
 * opening the customizer: the creator's avatar always, the title and name
 * revealed on hover.
 */
const CustomizeCard = ({
  video,
  category,
}: {
  video: MotionVideo;
  category?: MotionCategory;
}) => (
  <Link
    to={ROUTES.CUSTOMIZE_PROMPT}
    params={{ slug: video.slug }}
    search={{ category }}
    className="group focus-visible:ring-ring relative block overflow-hidden rounded-xl outline-none focus-visible:ring-2"
  >
    <MotionPreview video={video} paused={false} />
    {/* Title revealed over a bottom gradient on hover, like the gallery card. */}
    <span className="pointer-events-none absolute inset-0 flex flex-col justify-end rounded-xl bg-linear-to-t from-black/70 via-transparent to-transparent p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
      <span className="h-7 truncate pr-2 pl-9 text-sm leading-7 font-medium tracking-tight text-white">
        {video.title}
      </span>
    </span>
    {/* The creator's avatar, always visible bottom-left. */}
    <span className="absolute bottom-2.5 left-2.5 size-7 overflow-hidden rounded-full">
      <CreatorAvatar src={video.avatar} size={28} className="size-full" />
    </span>
  </Link>
);

const CustomizeIndex = () => {
  const content = useIntlayer("customize-page");
  const gallery = useIntlayer("motion-gallery");
  const { category } = Route.useSearch();
  const navigate = useLocalizedNavigate();
  const shown = category
    ? promptVideos.filter((video) => video.contentTags.includes(category))
    : promptVideos;

  const surprise = () => {
    const video = shown[Math.floor(Math.random() * shown.length)];
    if (video) {
      void navigate({
        to: ROUTES.CUSTOMIZE_PROMPT,
        params: { slug: video.slug },
        search: { category },
      });
    }
  };

  const items: MasonryItem[] = [
    {
      key: "intro",
      node: (
        <CollectionIntro
          titleId="customize-intro-title"
          title={content.title}
          description={content.intro}
          actions={
            <SurpriseAndSubmit
              onSurprise={surprise}
              surpriseDisabled={shown.length === 0}
              surpriseLabel={gallery.surprise}
              submitLabel={gallery.submitVideo}
              submitSearch={{ kind: "video", category }}
            />
          }
        />
      ),
    },
    ...shown.map((video) => ({
      key: video.slug,
      aspectRatio: video.width / video.height,
      node: <CustomizeCard video={video} category={category} />,
    })),
  ];

  return (
    <>
      <CollectionToolbar label={content.filterCategory.value}>
        <div className="no-scrollbar scroll-fade-x -mx-1 -my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
          <CategoryChip
            active={!category}
            label={gallery.all}
            to={ROUTES.CUSTOMIZE}
            search={{ category: undefined }}
          />
          {categories.map((entry) => (
            <CategoryChip
              key={entry}
              active={category === entry}
              label={gallery.categories[entry]}
              to={ROUTES.CUSTOMIZE}
              search={{ category: entry }}
            />
          ))}
        </div>
      </CollectionToolbar>
      <CollectionGrid
        items={items}
        emptyState={
          shown.length === 0 ? (
            <p className="text-muted-foreground mt-6 text-sm">
              {content.noPrompts}
            </p>
          ) : undefined
        }
      />
    </>
  );
};

interface CustomizeSearch {
  category?: MotionCategory;
}

export const Route = createFileRoute("/{-$locale}/customize/")({
  component: CustomizeIndex,
  validateSearch: (search): CustomizeSearch => ({
    category: z.enum(MOTION_CATEGORIES).safeParse(search.category).data,
  }),
  head: () =>
    createMetadata({
      title: "Prompt customizer",
      description:
        "Make any motion video prompt from the gallery yours: add your subject, colors, size and typeface, and set creativity, pace and polish. Free, in the browser.",
    }),
});
