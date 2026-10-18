import { listTagsForAdmin } from "@/modules/admin/queries";
import { setTagActiveAction } from "@/app/actions/admin.actions";
import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { TagForm } from "./tag-form";

export const metadata = { title: "Tags · Admin · HUSTL" };

/**
 * Tag CRUD with synonym editing. Synonyms are the hidden half of
 * Tag.searchTerms; saving regenerates the whole array in one transaction
 * (modules/admin/mutations.ts#buildSearchTerms).
 */
export default async function AdminTagsPage() {
  const tags = await listTagsForAdmin();
  const services = tags.filter((t) => t.kind === "SERVICE");
  const courses = tags.filter((t) => t.kind === "COURSE");

  return (
    <main className="space-y-8">
      <PageHeader
        title="Tags"
        subtitle="Synonyms are matched by the typeahead but never shown to anyone. Deactivating a tag hides it from search and browse; sellers and requests keep it."
      />

      <Card>
        <p className="mb-3 text-sm font-medium">New tag</p>
        <TagForm />
      </Card>

      {[
        ["Services", services],
        ["Courses", courses],
      ].map(([label, group]) => (
        <section key={label as string}>
          <h2 className="mb-2 text-sm font-semibold">
            {label as string} ({(group as typeof tags).length})
          </h2>
          <ul className="space-y-3">
            {(group as typeof tags).map((tag) => (
              <li key={tag.id}>
                <Card className={tag.isActive ? undefined : "opacity-60"}>
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                      <span className="font-medium">{tag.name}</span>
                      <span className="text-xs text-ink-faint">/{tag.slug}</span>
                      {!tag.isActive ? <Badge tone="neutral">inactive</Badge> : null}
                      <span className="flex-1" />
                      <span className="text-xs text-ink-soft">
                        {tag.synonyms.length} synonym{tag.synonyms.length === 1 ? "" : "s"} · {tag.sellerCount} seller
                        {tag.sellerCount === 1 ? "" : "s"} · {tag.requestCount} request{tag.requestCount === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <div className="mt-4 space-y-3 border-t border-line pt-4">
                      <TagForm
                        tag={{
                          id: tag.id,
                          name: tag.name,
                          kind: tag.kind,
                          synonyms: tag.synonyms,
                          sortOrder: tag.sortOrder,
                        }}
                      />
                      <form action={setTagActiveAction}>
                        <input type="hidden" name="tagId" value={tag.id} />
                        <input type="hidden" name="isActive" value={tag.isActive ? "false" : "true"} />
                        <Button type="submit" size="sm" variant={tag.isActive ? "danger" : "secondary"}>
                          {tag.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </form>
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
