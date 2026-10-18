import { ButtonLink } from "@/components/ui";

const SLIPS = [
  {
    className: "print-photo",
    kind: "Photography",
    title: "Senior portraits in the cherry blossoms",
    meta: "The Quad, late April",
    price: "$40",
  },
  {
    className: "print-beauty",
    kind: "Nails",
    title: "Gel set for a formal",
    meta: "Dorm, the night before",
    price: "$25",
  },
  {
    className: "print-notes",
    kind: "Tutoring",
    title: "MATH 124 before the midterm",
    meta: "Odegaard, 2nd floor",
    price: "$15/hr",
  },
  {
    className: "print-bake",
    kind: "Baking",
    title: "Birthday cake for a dorm floor",
    meta: "Pickup on campus",
    price: "$20",
  },
];

export function LandingStudio() {
  return (
    <div className="landing-root">
      <section className="landing-mural px-5 pb-16 pt-10 sm:px-10 sm:pb-24 sm:pt-16">
        <div className="gold-wash" aria-hidden />
        <Petals />
        <Fountain />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="landing-copy max-w-xl">
            <p className="text-sm text-cherry">UW students only — @uw.edu on both sides.</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-6xl">
              Hire other UW students for creative work.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[#f0e6d8]/90 sm:text-lg">
              A campus marketplace. We are starting with creatives — photos, posters, video, music — plus
              tutoring, nails, hair, cooking, and baking. You pay them directly. Meet on campus if you want.
            </p>
            <div className="mt-7">
              <ButtonLink href="/login" size="lg">
                Sign in with your UW email
              </ButtonLink>
            </div>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-[#f0e6d8]/75">
              You can only leave a review after a job actually finishes. During beta, HUSTL does not take a
              cut.
            </p>
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-md grid-cols-2 gap-4 sm:max-w-none sm:gap-5">
            {SLIPS.map((slip) => (
              <article key={slip.title} className={`print ${slip.className}`}>
                <span className="print-tape" aria-hidden />
                <p className="font-mono text-[10px] uppercase tracking-wider text-verified">{slip.kind}</p>
                <p className="mt-3 font-display text-3xl font-bold leading-none tracking-tight text-brand-ink">
                  {slip.price}
                </p>
                <p className="mt-3 font-display text-base leading-tight">{slip.title}</p>
                <p className="mt-1.5 text-xs text-ink-soft">{slip.meta}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Petals() {
  const petals = [
    { left: "8%", delay: "0s", duration: "14s" },
    { left: "22%", delay: "3s", duration: "16s" },
    { left: "41%", delay: "1.2s", duration: "13s" },
    { left: "63%", delay: "5s", duration: "18s" },
    { left: "78%", delay: "2.4s", duration: "15s" },
    { left: "91%", delay: "6s", duration: "17s" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {petals.map((p) => (
        <span
          key={p.left}
          className="petal"
          style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
        />
      ))}
    </div>
  );
}

function Fountain() {
  return (
    <svg
      className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 opacity-25"
      viewBox="0 0 200 200"
      aria-hidden
    >
      <circle cx="100" cy="100" r="88" fill="none" stroke="#e8a0b4" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="62" fill="none" stroke="#d4a017" strokeWidth="1.2" />
      <circle cx="100" cy="100" r="36" fill="none" stroke="#f6efe4" strokeWidth="1.2" />
    </svg>
  );
}
