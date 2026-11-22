import { createFileRoute } from "@tanstack/react-router";
import { useIntlayer } from "react-intlayer";

import { CollectionIntro } from "@/components/collection-intro";
import { EntryCard } from "@/components/entry-card";
import { ListingGrid } from "@/components/listing-grid";
import { LocalizedLink as Link } from "@/components/localized-link";
import { ROUTES } from "@/constants/routes";
import { PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import { buttonVariants } from "@/registry/ui/button";
import { breadcrumbJsonLd } from "@/seo/json-ld";
import { createMetadata } from "@/seo/metadata";
import { getTemplateCovers } from "@/server/template-functions";

// Laid out like /blog and /changelog: the intro tile first, then a grid of
// cards (cover, field count, name, summary).
const Templates = () => {
  const content = useIntlayer("templates-page");
  const sections = useIntlayer("site-header");
  const locked = useIntlayer("locked-prompt");
  const { covers } = Route.useLoaderData();
  return (
    <ListingGrid
      intro={
        <CollectionIntro
          titleId="templates-intro-title"
          title={sections.templates.value}
          description={content.intro}
          actions={
            <>
              <Link
                to={ROUTES.PRO}
                data-track="templates_unlock"
                data-track-template="list"
                className={buttonVariants({ variant: "gradient", size: "lg" })}
              >
                {locked.unlock}
              </Link>
              {/* ROUTES.DOCS_TEMPLATES, through the docs' catch-all route. */}
              <Link
                to={ROUTES.DOCS_PAGE}
                params={{ _splat: "templates" }}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                {content.howToUse}
              </Link>
            </>
          }
        />
      }
    >
      {PROMPT_TEMPLATES.map((template) => (
        <li key={template.id} className="h-full">
          <EntryCard
            to={ROUTES.TEMPLATE}
            params={{ templateId: template.id }}
            cover={covers[template.id]}
            title={template.name}
            description={template.summary}
            meta={
              <span>
                {template.fields.length} {content.fieldCount}
              </span>
            }
          />
        </li>
      ))}
    </ListingGrid>
  );
};

export const Route = createFileRoute("/{-$locale}/templates/")({
  component: Templates,
  loader: async () => ({ covers: await getTemplateCovers() }),
  head: ({ params }) => ({
    ...createMetadata({
      title: "Prompt templates",
      description:
        "Tested prompt structures for AI motion videos, with every part you would change as a field. The full prompts and the customizer are in MotionVideo Pro.",
    }),
    scripts: [
      breadcrumbJsonLd(
        { name: "Templates", path: ROUTES.TEMPLATES },
        params.locale
      ),
    ],
  }),
});
