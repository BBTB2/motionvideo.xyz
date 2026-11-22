import { createFileRoute } from "@tanstack/react-router";

import { BlogList } from "@/components/blog-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ROUTES } from "@/constants/routes";
import catalog from "@/data/motion-catalog.json";
import { BLOG_FEEDS, BLOG_POSTS } from "@/lib/blog";
import { pickVideos } from "@/lib/video-picks";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createMetadata } from "@/seo/metadata";

// Every post: the intro block in the first cell, a category pill toolbar
// above it, then one card per post.
const Blog = () => {
  const { covers } = Route.useLoaderData();
  return (
    <>
      <SiteHeader />
      <BlogList covers={covers} />
      <SiteFooter />
    </>
  );
};

export const Route = createFileRoute("/{-$locale}/blog/")({
  component: Blog,
  // Only the cover posters' fields, not the catalog.
  loader: () => ({
    covers: pickVideos(
      BLOG_POSTS.map((post) => post.data.cover),
      catalog.videos
    ),
  }),
  head: ({ params }) => ({
    ...createMetadata({
      description:
        "Notes on making motion graphics with AI coding agents: prompt structure, rendering, launch films, and what the prompts in the gallery have in common.",
      title: "Blog",
    }),
    links: BLOG_FEEDS.links,
    scripts: [
      breadcrumbJsonLd({ page: "blog", path: ROUTES.BLOG }, params.locale),
    ],
  }),
});
