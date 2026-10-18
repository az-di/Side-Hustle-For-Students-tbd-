import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Privacy · HUSTL" };

/**
 * What is stored and who sees it. DRAFT, like the terms: accurate to the code
 * as of October 2026, not reviewed by a lawyer.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Privacy" subtitle="What we store, who can see it, and how to make it stop." />

      <p className="rounded-card border border-warn/20 bg-warn-soft p-3 text-xs text-warn">
        <strong>Draft.</strong> Written by the HUSTL team to match what the app actually does. Not yet reviewed by a
        lawyer.
      </p>

      <Section title="What we store">
        Your UW email, display name, handle, and anything you add to your profile (bio, headline, prices, portfolio
        links and uploads). Requests, responses, jobs, reviews and messages you send. Reports you file and that are
        filed about you. Which tags you have requested under. Sign-in sessions and the one-time codes we email you
        (stored hashed). Email we send you and whether it was delivered.
      </Section>

      <Section title="Who sees what">
        Your profile, listings, portfolio, reviews and completed-job count are visible to signed-in UW students. Your
        email is never shown to other users. Your Venmo handle is shown only to the other person on an active job.
        Messages are visible only to the two people in the conversation. A buyer&rsquo;s maximum budget is never shown
        to sellers. Reports and your internal report standing are visible only to HUSTL admins; the person you report
        is not told who reported them.
      </Section>

      <Section title="Email">
        We email you a sign-in code when you ask for one, and notifications about requests, responses, jobs and
        reviews. Every notification email has a one-click unsubscribe link, and you can turn email off at{" "}
        <Link href="/settings/email" className="underline">Settings → Email</Link>. Sign-in codes are always sent.
      </Section>

      <Section title="Where it lives">
        On a server operated by the team, in a Postgres database, with uploads on the same server&rsquo;s disk. Email
        is delivered by Resend. We do not sell data and do not run third-party trackers or advertising.
      </Section>

      <Section title="Blocking and reports">
        Blocking someone hides you from each other across the app. Reporting someone sends what you wrote to an admin
        and may lead to their account being suspended. See the <Link href="/terms" className="underline">terms</Link>.
      </Section>

      <Section title="Deleting your account">
        There is no self-service delete in the beta. Email the team from your UW address and we will close the account
        and remove your profile, uploads and sign-in data. Messages, jobs and reviews that the other person is also
        party to are kept so their history stays intact.
      </Section>

      <Section title="Changes">
        We will update this page when the app changes what it stores. The date on the terms page moves with it.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="text-sm text-ink-soft">{children}</p>
    </Card>
  );
}
