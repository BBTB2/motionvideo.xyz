import { createFileRoute, notFound } from "@tanstack/react-router";

import { BlogList } from "@/components/blog-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ROUTES } from "@/constants/routes";
import catalog from "@/data/motion-catalog.json";
import { BLOG_FEEDS, BLOG_POSTS, blogTagSlug, findBlogTag } from "@/lib/blog";
import { pickVideos } from "@/lib/video-picks";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createMetadata } from "@/seo/metadata";

// A single topic's posts, e.g. `/blog/category/prompting`: the same list and
// pill toolbar as /blog, with the topic's pill active.
const BlogCategory = () => {
  const { tag, covers } = Route.useLoaderData();
  return (
    <>
      <SiteHeader />
      <BlogList covers={covers} activeTag={tag} />
      <SiteFooter />
    </>
  );
};

export const Route = createFileRoute("/{-$locale}/blog/category/$tag")({
  component: BlogCategory,
  loader: ({ params }) => {
    const tag = findBlogTag(params.tag);
    if (!tag) {
      throw notFound();
    }
    return {
      tag,
      covers: pickVideos(
        BLOG_POSTS.map((post) => post.data.cover),
        catalog.videos
      ),
    };
  },
  head: ({ params }) => {
    const tag = findBlogTag(params.tag);
    if (!tag) {
      return createMetadata({ title: "Category not found" });
    }
    return {
      ...createMetadata({
        title: tag,
        description: `Blog posts tagged ${tag}: prompt structure, rendering and launch films for motion graphics made with AI coding agents.`,
      }),
      links: BLOG_FEEDS.links,
      scripts: [
        breadcrumbJsonLd(
          [
            { page: "blog", path: ROUTES.BLOG },
            { name: tag, path: `/blog/category/${blogTagSlug(tag)}` },
          ],
          params.locale
        ),
      ],
    };
  },
});
