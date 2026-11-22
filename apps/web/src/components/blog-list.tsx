import { useIntlayer, useLocale } from "react-intlayer";

import { CollectionIntro } from "@/components/collection-intro";
import {
  CategoryChip,
  CollectionToolbar,
} from "@/components/collection-toolbar";
import { EntryCard } from "@/components/entry-card";
import { FeedButtons } from "@/components/feed-buttons";
import { ListingGrid } from "@/components/listing-grid";
import { ROUTES } from "@/constants/routes";
import {
  BLOG_FEEDS,
  BLOG_POSTS,
  BLOG_TAGS,
  blogTagSlug,
  formatPostDate,
} from "@/lib/blog";
import type { VideoPick } from "@/lib/video-picks";

/**
 * The blog list: the intro tile first, a category pill toolbar above it, then
 * one card per post. `activeTag` (a display tag, or `undefined` for all posts)
 * is the category `/blog/category/$tag` selected.
 */
export const BlogList = ({
  covers,
  activeTag,
}: {
  covers: Record<string, VideoPick>;
  activeTag?: string;
}) => {
  const content = useIntlayer("blog");
  const sections = useIntlayer("site-footer");
  const { locale } = useLocale();

  const posts = activeTag
    ? BLOG_POSTS.filter((post) => post.data.tags.includes(activeTag))
    : BLOG_POSTS;

  const intro = (
    <CollectionIntro
      titleId="blog-intro-title"
      title={sections.blog.value}
      description={
        locale === "en"
          ? content.intro.value
          : `${content.intro.value} ${content.englishOnly.value}`
      }
      actions={<FeedButtons feeds={BLOG_FEEDS} />}
    />
  );

  return (
    <>
      <CollectionToolbar label={content.filterBy.value}>
        <div className="no-scrollbar scroll-fade-x flex gap-2 overflow-x-auto">
          <CategoryChip
            to={ROUTES.BLOG}
            active={!activeTag}
            label={content.all}
          />
          {BLOG_TAGS.map((tag) => (
            <CategoryChip
              key={tag}
              to={ROUTES.BLOG_CATEGORY}
              params={{ tag: blogTagSlug(tag) }}
              active={activeTag === tag}
              label={tag}
            />
          ))}
        </div>
      </CollectionToolbar>
      <ListingGrid ordered intro={intro}>
        {posts.map((post) => (
          <li key={post.url} className="h-full">
            <EntryCard
              to={ROUTES.BLOG_POST}
              params={{ slug: post.slugs.join("/") }}
              cover={covers[post.data.cover]}
              tags={post.data.tags}
              title={post.data.title}
              description={post.data.description}
              meta={
                <time dateTime={post.data.date}>
                  {formatPostDate(post.data.date, locale)}
                </time>
              }
            />
          </li>
        ))}
      </ListingGrid>
    </>
  );
};
