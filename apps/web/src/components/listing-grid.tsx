import type { ReactNode } from "react";

/** Collection-width listings with an intro tile and equal-height card rows. */
export const ListingGrid = ({
  intro,
  children,
  ordered = false,
}: {
  intro: ReactNode;
  children: ReactNode;
  ordered?: boolean;
}) => {
  const List = ordered ? "ol" : "ul";
  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-[1800px] px-4 pt-6 pb-16 sm:px-6"
    >
      <List className="grid grid-cols-1 gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
        <li className="flex flex-col justify-end sm:[&>section]:h-full">
          {intro}
        </li>
        {children}
      </List>
    </main>
  );
};
