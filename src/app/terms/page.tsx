import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Terms · HUSTL" };

/**
 * Plain-language terms. DRAFT: written by the team, not reviewed by a lawyer.
 * The banner at the top says so and must stay until that read happens
 * (HANDOFF §11.12). Keep this page in sync with /welcome, which shows the
 * three points that matter most at sign-up.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Terms of use" subtitle="Last updated October 2026. Plain language on purpose." />

      <p className="rounded-card border border-warn/20 bg-warn-soft p-3 text-xs text-warn">
        <strong>Draft.</strong> These terms were written by the HUSTL team and have not yet been reviewed by a lawyer.
        They describe how the beta works today.
      </p>

      <Section title="What HUSTL is">
        HUSTL is a campus-only marketplace where UW students hire other UW students for creative work and tutoring.
        HUSTL connects people. It does not employ anyone, does not take part in the work, and during the beta does not
        hold or move money.
      </Section>

      <Section title="Who can use it">
        You need a current <code>@uw.edu</code> address and must be at least 18. One account per person. You are
        responsible for what happens under your account.
      </Section>

      <Section title="Payment">
        Buyers pay sellers directly (for example over Venmo) for the amount shown on the job page. HUSTL&rsquo;s 10%
        fee is waived during the beta; sellers never see a buyer&rsquo;s maximum budget. HUSTL is not a party to the
        payment and cannot refund, hold, or recover money. Agree on what is being delivered in messages before any
        money changes hands.
      </Section>

      <Section title="Who owns the work">
        Unless the buyer and seller agree otherwise in their messages before the job is marked complete, the default is:
        the seller keeps copyright in what they make, and once paid, the buyer receives a perpetual, non-exclusive
        licence to use it for the purpose described in the request. Sellers may show the work in their portfolio.
        For anything else &mdash; exclusivity, source files, resale &mdash; write it down in the thread.
      </Section>

      <Section title="Tutoring and academic integrity">
        Tutoring means helping someone learn. Completing graded work for someone else &mdash; essays, problem sets,
        assignments, exams, graded code &mdash; is an academic-integrity violation for both people and is not allowed
        here. Requests like that will be removed and accounts may be closed.
      </Section>

      <Section title="International students">
        Freelance work off campus is generally not permitted on an F-1 or J-1 visa. Check with UW International Student
        Services before taking paid work. HUSTL cannot advise on this.
      </Section>

      <Section title="Food">
        Cooking and baking tags exist, but selling home-prepared food may be restricted by Washington&rsquo;s cottage
        food rules and by UW housing policy. It is your responsibility to check before you sell.
      </Section>

      <Section title="Conduct, reports and blocking">
        Be honest, show up, and deliver what you agreed. Anyone can report a no-show, a scam, harassment or a
        request to do graded work, and anyone can block anyone. Reports are read by a person. Accounts that collect
        enough upheld reports are suspended automatically and may be closed. There is no formal appeal process in the
        beta; email the team.
      </Section>

      <Section title="Your content">
        You own what you upload. By uploading it you let HUSTL store and display it on your profile. Do not upload
        anything you do not have the right to share.
      </Section>

      <Section title="No warranty">
        HUSTL is provided as-is during the beta. We do not vet sellers beyond the UW email check, do not guarantee any
        job, and are not liable for what happens between users, in person or online. Meet in public places on campus.
      </Section>

      <Section title="Changes">
        We may change these terms; the date at the top moves when we do. Continuing to use HUSTL after a change means
        you accept it.
      </Section>

      <p className="text-xs text-ink-faint">
        See also the <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
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
