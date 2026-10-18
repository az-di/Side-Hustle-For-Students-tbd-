import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Welcome · HUSTL" };

/**
 * Shown once, right after a new account is created.
 *
 * The international-student notice is here deliberately: the spec's risk table
 * calls for it at seller sign-up, and this is the first screen a new seller
 * sees. Short, accurate, no legal advice.
 */
export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader
        title={`Welcome to HUSTL, ${viewer.displayName.split(" ")[0]}`}
        subtitle="You are verified as a UW student. Two ways to use this:"
      />

      <div className="space-y-3">
        <Card>
          <p className="font-medium">I need something made</p>
          <p className="mt-1 text-sm text-ink-soft">
            Post what you need with a budget. Students open to those tags are notified, several can respond, and you
            pick one.
          </p>
          <ButtonLink href="/requests/new" size="sm" className="mt-3">
            Post a request
          </ButtonLink>
        </Card>

        <Card>
          <p className="font-medium">I want to get hired</p>
          <p className="mt-1 text-sm text-ink-soft">
            Set your rate, pick the tags you can work in, and add a couple of portfolio links. You can pause any time
            — during finals, say — and keep your profile and reviews.
          </p>
          <ButtonLink href="/settings/seller" size="sm" variant="secondary" className="mt-3">
            Set up selling
          </ButtonLink>
        </Card>
      </div>

      <div className="mt-6 space-y-3 text-xs text-ink-soft">
        <p className="rounded-card border border-warn/20 bg-warn-soft p-3 text-warn">
          <strong>On an F-1 or J-1 visa?</strong> Freelance work off campus generally is not allowed on a student
          visa. Check with UW&rsquo;s International Student Services before taking paid work here. This is not legal
          advice.
        </p>
        <p>
          Tutoring means helping someone learn — not completing graded work for them. Doing someone&rsquo;s
          assignment is an academic integrity violation for both of you, and gets accounts closed.
        </p>
        <p>
          Payment happens directly between you, over Venmo. HUSTL does not hold money, and its 10% fee is waived
          during the beta.
        </p>
        <p>
          By continuing you agree to the{" "}
          <Link href="/terms" className="underline">
            terms
          </Link>{" "}
          (including the default ownership-of-work clause) and the{" "}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </div>

      <ButtonLink href="/" size="lg" className="mt-6 w-full">
        Start browsing
      </ButtonLink>
    </main>
  );
}
