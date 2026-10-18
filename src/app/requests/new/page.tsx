import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getListingById, getTagBySlug } from "@/modules/catalog/queries";
import { Card, PageHeader } from "@/components/ui";
import { RequestForm } from "./request-form";

export const metadata = { title: "Post a request · HUSTL" };

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; seller?: string; listing?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const { tag: tagSlug, seller: sellerHandle, listing: listingId } = await searchParams;

  const [tag, seller, listing] = await Promise.all([
    tagSlug ? getTagBySlug(tagSlug) : null,
    sellerHandle
      ? db.user.findUnique({
          where: { handle: sellerHandle },
          select: { id: true, displayName: true, sellerProfile: { select: { isAvailable: true } } },
        })
      : null,
    listingId ? getListingById(listingId) : null,
  ]);

  // A listing implies its tags and its seller.
  const initialTags = listing
    ? listing.tags.map((t) => t.tag)
    : tag
      ? [tag]
      : [];

  const target = listing
    ? { userId: listing.sellerUserId, displayName: listing.seller.displayName }
    : seller
      ? { userId: seller.id, displayName: seller.displayName }
      : null;

  if (target && target.userId === viewer.id) redirect("/requests/new");

  return (
    <main>
      <PageHeader
        title={target ? `Request from ${target.displayName}` : "Post an open request"}
        subtitle={
          target
            ? "Only they will see this."
            : "Every student open to these tags is notified. Several can respond, and you pick one."
        }
      />

      {listing ? (
        <Card className="mb-4 border-brand/30 bg-brand-soft">
          <p className="text-xs uppercase tracking-wide text-brand-ink">About this listing</p>
          <p className="mt-1 font-medium">{listing.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{listing.description}</p>
        </Card>
      ) : null}

      <Card>
        <RequestForm initialTags={initialTags} target={target} listingId={listing?.id} />
      </Card>
    </main>
  );
}
