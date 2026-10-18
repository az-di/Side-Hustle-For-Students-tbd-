import { addSellerTagsAction } from "@/app/actions/marketplace.actions";
import { Button, TagChip } from "@/components/ui";

type Group = { subject: string; tags: { id: string; name: string; slug: string; kind: "COURSE" }[] };

/**
 * Courses by subject with "add all" per subject. Server component, plain
 * forms: a seller who tutors "all of intro CSE" clicks once rather than
 * searching twelve course codes.
 */
export function CoursePicker({ groups, heldTagIds }: { groups: Group[]; heldTagIds: Set<string> }) {
  return (
    <details className="rounded-card border border-line bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        Tutoring: add courses by subject
        <span className="ml-2 font-normal text-ink-soft">({groups.reduce((n, g) => n + g.tags.length, 0)} courses)</span>
      </summary>
      <div className="space-y-3 border-t border-line px-4 py-3">
        {groups.map((group) => {
          const missing = group.tags.filter((t) => !heldTagIds.has(t.id));
          return (
            <div key={group.subject} className="flex flex-wrap items-start gap-2">
              <div className="w-20 shrink-0 pt-0.5 text-sm font-semibold">{group.subject}</div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {group.tags.map((tag) =>
                  heldTagIds.has(tag.id) ? (
                    <span key={tag.id} className="opacity-50">
                      <TagChip name={tag.name} kind="COURSE" />
                    </span>
                  ) : (
                    <form key={tag.id} action={addSellerTagsAction}>
                      <input type="hidden" name="tagIds" value={tag.id} />
                      <button type="submit" className="hover:opacity-70" aria-label={`Add ${tag.name}`}>
                        <TagChip name={tag.name} kind="COURSE" />
                      </button>
                    </form>
                  ),
                )}
              </div>
              {missing.length > 1 ? (
                <form action={addSellerTagsAction}>
                  <input type="hidden" name="tagIds" value={missing.map((t) => t.id).join(",")} />
                  <Button type="submit" size="sm" variant="ghost">
                    Add all {group.subject}
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
        <p className="text-xs text-ink-soft">
          Not here? Type any course code into the search box above — and tell the team to add it.
        </p>
      </div>
    </details>
  );
}
