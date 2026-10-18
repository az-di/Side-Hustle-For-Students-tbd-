import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { env } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { listCourseTagsBySubject } from "@/modules/catalog/queries";
import { getSellerSettings } from "@/modules/identity/queries";
import { listPortfolio, mediaUsage } from "@/modules/media/queries";
import { MAX_PORTFOLIO_ITEMS, formatBytes } from "@/modules/media/state";
import { becomeSellerAction, setPausedAction } from "@/app/actions/marketplace.actions";
import { deletePortfolioItemAction } from "@/app/actions/media.actions";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { Badge, Button, ButtonLink, Card, Field, Input, PageHeader, TagChip } from "@/components/ui";
import { SellerProfileForm } from "./seller-profile-form";
import { SellerTagPicker } from "./seller-tag-picker";
import { ListingForm } from "./listing-form";
import { PortfolioUploader } from "./portfolio-uploader";
import { CoursePicker } from "./course-picker";

export const metadata = { title: "Selling · HUSTL" };

export default async function SellerSettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const me = await getSellerSettings(viewer.id);

  // Not a seller yet: one field, one button.
  if (!me.sellerProfile) {
    return (
      <main>
        <PageHeader
          title="Start selling"
          subtitle="Students can hire you for photos, design, video, music, tutoring and more."
        />
        <Card>
          <form action={becomeSellerAction} className="space-y-4">
            <Field
              label="One line about what you do"
              hint="You can add prices, tags and services next."
            >
              <Input name="headline" placeholder="Campus photographer — portraits, grad photos, events" required />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              Create my seller profile
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  const profile = me.sellerProfile;
  const [portfolio, usage, courseGroups] = await Promise.all([
    listPortfolio(viewer.id),
    mediaUsage(viewer.id),
    listCourseTagsBySubject(),
  ]);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Selling"
        subtitle={<span>Your profile at <ButtonLink href={`/sellers/${viewer.handle}`} variant="ghost" size="sm">@{viewer.handle}</ButtonLink></span>}
      />

      {/* Pause: still listed, no new requests. */}
      <Card className={profile.isAvailable ? undefined : "border-warn/30 bg-warn-soft"}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {profile.isAvailable ? "Taking work" : "Paused"}
              {!profile.isAvailable ? <Badge tone="warn" className="ml-2">no new requests</Badge> : null}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {profile.isAvailable
                ? "You appear in search and get notified about requests in your tags."
                : "You still appear in search with a Paused badge, but you receive no new requests."}
            </p>
          </div>
          <form action={setPausedAction}>
            <input type="hidden" name="paused" value={profile.isAvailable ? "true" : "false"} />
            <Button type="submit" variant="secondary" size="sm">
              {profile.isAvailable ? "Pause" : "Resume"}
            </Button>
          </form>
        </div>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Tags you are open to</h2>
        <p className="mb-3 text-xs text-ink-soft">
          You are notified when someone posts an open request with one of these. Tutoring uses course codes.
        </p>
        <SellerTagPicker current={me.sellerTags.map((st) => st.tag)} />
        <div className="mt-3">
          <CoursePicker groups={courseGroups} heldTagIds={new Set(me.sellerTags.map((st) => st.tag.id))} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Profile</h2>
        <Card>
          <SellerProfileForm
            initial={{
              displayName: me.displayName,
              bio: me.bio ?? "",
              headline: profile.headline ?? "",
              about: profile.about ?? "",
              venmoHandle: me.venmoHandle ?? "",
              fixed: profile.fixedPriceCents ? String(profile.fixedPriceCents / 100) : "",
              hourly: profile.hourlyRateCents ? String(profile.hourlyRateCents / 100) : "",
              portfolioLinks: profile.portfolioLinks.join("\n"),
            }}
          />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Portfolio ({portfolio.length}/{MAX_PORTFOLIO_ITEMS})
        </h2>
        <p className="mb-3 text-xs text-ink-soft">
          Photos, clips and PDFs shown on your profile. {formatBytes(usage.usedBytes)} of {formatBytes(usage.maxBytes)}{" "}
          used. Links go in the profile form above.
        </p>
        <div className="mb-3">
          <PortfolioGrid
            items={portfolio}
            actions={(item) => (
              <form action={deletePortfolioItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button type="submit" className="text-xs text-ink-faint hover:text-danger" aria-label="Delete">
                  Delete
                </button>
              </form>
            )}
          />
        </div>
        <Card>
          <PortfolioUploader maxFileLabel={formatBytes(env.MEDIA_MAX_FILE_BYTES)} />
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Services ({me.listings.length})</h2>
        {me.listings.length > 0 ? (
          <ul className="mb-3 space-y-2">
            {me.listings.map((listing) => (
              <li key={listing.id}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{listing.title}</p>
                    <div className="shrink-0 text-right text-sm">
                      {listing.fixedPriceCents ? <p className="font-semibold">{formatCents(listing.fixedPriceCents)}</p> : null}
                      {listing.hourlyRateCents ? (
                        <p className="text-ink-soft">{formatCents(listing.hourlyRateCents)}/hr</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {listing.tags.map((t) => (
                      <TagChip key={t.tag.id} name={t.tag.name} kind={t.tag.kind} />
                    ))}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <Card>
          <p className="mb-3 text-sm font-medium">Add a service</p>
          <ListingForm />
        </Card>
      </section>
    </main>
  );
}
