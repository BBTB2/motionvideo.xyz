import type { ReactNode } from "react";

import { LocalizedLink as Link } from "@/components/localized-link";
import { Badge } from "@/components/ui/badge";

/**
 * A card linking to one entry of a list page (blog posts, changelog releases,
 * templates): a 1200:630 cover banner on top, then tag pills, the title and
 * description, and a meta line (the date) at the bottom. Text sits on the
 * card, not over the image, so it stays readable.
 */
export const EntryCard = ({
  to,
  params,
  cover,
  tags,
  title,
  description,
  meta,
}: {
  /** App path of the entry's route, e.g. "/blog/$slug". */
  to: string;
  params?: Record<string, string>;
  cover: { poster: string; width: number; height: number } | undefined;
  /** Topic tags shown as pills at the top of the card. */
  tags?: readonly string[];
  title: string;
  description: ReactNode;
  meta: ReactNode;
}) => (
  <Link
    to={to}
    params={params}
    className="group bg-card shadow-outline hover:bg-muted/60 focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-xl transition-colors outline-none focus-visible:ring-2"
  >
    <span className="bg-muted aspect-[1200/630] w-full shrink-0 overflow-hidden">
      {cover && (
        <img
          src={cover.poster}
          alt=""
          width={cover.width}
          height={cover.height}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
        />
      )}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-2 p-4">
      {tags && tags.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </span>
      )}
      <span
        title={title}
        className="truncate text-lg leading-tight font-semibold tracking-tight"
      >
        {title}
      </span>
      <span className="text-muted-foreground line-clamp-2 text-sm text-pretty">
        {description}
      </span>
      <span className="text-muted-foreground mt-auto flex items-center gap-1.5 text-xs font-medium">
        {meta}
      </span>
    </span>
  </Link>
);
