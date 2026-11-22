import { Badge } from "@/components/ui/badge";

/** A changelog entry's tags (CHANGELOG_TAGS) as outline badges. */
export const ChangelogTags = ({ tags }: { tags: readonly string[] }) =>
  tags.map((tag) => (
    <Badge key={tag} variant="outline">
      {tag}
    </Badge>
  ));
