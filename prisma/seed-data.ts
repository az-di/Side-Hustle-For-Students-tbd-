/**
 * Seed data for HUSTL.
 *
 * The tag list is the spec's launch list. `searchTerms` holds the name plus the
 * HIDDEN synonyms that make search feel smart ("photoshoot" -> Photography) —
 * they are matched against but never returned to a client, so the list cannot
 * be enumerated by probing the typeahead.
 */

export type SeedTag = {
  slug: string;
  name: string;
  kind: "SERVICE" | "COURSE";
  searchTerms: string[];
  sortOrder?: number;
};

export const SERVICE_TAGS: SeedTag[] = [
  {
    slug: "photography",
    name: "Photography",
    kind: "SERVICE",
    searchTerms: [
      "photography",
      "photoshoot",
      "photo shoot",
      "photographer",
      "headshots",
      "senior photos",
      "grad photos",
      "graduation photos",
      "portraits",
      "event photos",
      "photos",
      "pictures",
      "pics",
    ],
    sortOrder: 10,
  },
  {
    slug: "photo-editing",
    name: "Photo editing",
    kind: "SERVICE",
    searchTerms: ["photo editing", "retouching", "photoshop", "lightroom", "color grading photos", "edit my photos"],
    sortOrder: 20,
  },
  {
    slug: "videography",
    name: "Videography",
    kind: "SERVICE",
    searchTerms: ["videography", "videographer", "film", "filming", "video shoot", "event video", "recap video"],
    sortOrder: 30,
  },
  {
    slug: "video-editing",
    name: "Video editing",
    kind: "SERVICE",
    searchTerms: ["video editing", "video editor", "premiere", "final cut", "davinci", "reels", "tiktok edit", "youtube edit"],
    sortOrder: 40,
  },
  {
    slug: "animation",
    name: "Animation",
    kind: "SERVICE",
    searchTerms: ["animation", "animator", "motion graphics", "after effects", "2d animation", "explainer video"],
    sortOrder: 50,
  },
  {
    slug: "3d-modeling",
    name: "3D modeling",
    kind: "SERVICE",
    searchTerms: ["3d modeling", "3d model", "blender", "cad", "render", "rendering", "3d print model", "solidworks"],
    sortOrder: 60,
  },
  {
    slug: "graphic-design",
    name: "Graphic design",
    kind: "SERVICE",
    searchTerms: [
      "graphic design",
      "designer",
      "logo",
      "logo design",
      "poster",
      "flyer",
      "branding",
      "brand",
      "merch design",
      "sticker",
      "instagram graphics",
      "illustrator",
      "canva",
    ],
    sortOrder: 70,
  },
  {
    slug: "drawing-and-physical-art",
    name: "Drawing and physical art",
    kind: "SERVICE",
    searchTerms: ["drawing", "physical art", "illustration", "illustrator", "painting", "portrait drawing", "commission", "sketch"],
    sortOrder: 80,
  },
  {
    slug: "website-design",
    name: "Website design",
    kind: "SERVICE",
    searchTerms: ["website design", "web design", "website", "landing page", "portfolio site", "squarespace", "webflow", "figma"],
    sortOrder: 90,
  },
  {
    slug: "coding-project",
    name: "Coding project",
    kind: "SERVICE",
    searchTerms: ["coding project", "programming", "software", "app", "web app", "script", "automation", "data scraping", "developer"],
    sortOrder: 100,
  },
  {
    slug: "music-production",
    name: "Music production",
    kind: "SERVICE",
    searchTerms: ["music production", "producer", "beat", "beats", "mixing", "mastering", "recording", "audio engineer", "sound design"],
    sortOrder: 110,
  },
  {
    slug: "instrument-lessons",
    name: "Instrument lessons",
    kind: "SERVICE",
    searchTerms: ["instrument lessons", "music lessons", "guitar lessons", "piano lessons", "violin lessons", "drum lessons", "singing lessons", "vocal coach"],
    sortOrder: 120,
  },
  {
    slug: "live-music",
    name: "Live music",
    kind: "SERVICE",
    searchTerms: ["live music", "performance", "perform at event", "band", "dj", "acoustic set", "gig", "play at my event"],
    sortOrder: 130,
  },
  {
    slug: "cooking",
    name: "Cooking",
    kind: "SERVICE",
    searchTerms: ["cooking", "cook", "meal prep", "catering", "private chef", "home cooked", "dinner party"],
    sortOrder: 140,
  },
  {
    slug: "baking",
    name: "Baking",
    kind: "SERVICE",
    searchTerms: ["baking", "baker", "cake", "birthday cake", "cupcakes", "cookies", "pastries", "custom cake"],
    sortOrder: 150,
  },
];

/**
 * A curated set of the courses students actually hire tutors for, rather than
 * the whole UW catalog — thousands of zero-seller tags would drown the 15 real
 * service tags in every search result.
 */
export const COURSE_TAGS: SeedTag[] = [
  { slug: "math-124", name: "MATH 124", kind: "COURSE", searchTerms: ["math 124", "math124", "calc 1", "calculus 1", "calculus"] },
  { slug: "math-125", name: "MATH 125", kind: "COURSE", searchTerms: ["math 125", "math125", "calc 2", "calculus 2", "integrals"] },
  { slug: "math-126", name: "MATH 126", kind: "COURSE", searchTerms: ["math 126", "math126", "calc 3", "calculus 3", "multivariable"] },
  { slug: "math-208", name: "MATH 208", kind: "COURSE", searchTerms: ["math 208", "math208", "linear algebra", "matrices"] },
  { slug: "cse-121", name: "CSE 121", kind: "COURSE", searchTerms: ["cse 121", "cse121", "intro to programming", "intro cs", "java intro"] },
  { slug: "cse-122", name: "CSE 122", kind: "COURSE", searchTerms: ["cse 122", "cse122", "intro programming 2", "data structures intro"] },
  { slug: "cse-123", name: "CSE 123", kind: "COURSE", searchTerms: ["cse 123", "cse123", "intro programming 3"] },
  { slug: "cse-143", name: "CSE 143", kind: "COURSE", searchTerms: ["cse 143", "cse143", "computer programming 2", "recursion"] },
  { slug: "cse-311", name: "CSE 311", kind: "COURSE", searchTerms: ["cse 311", "cse311", "foundations of computing", "discrete math"] },
  { slug: "cse-332", name: "CSE 332", kind: "COURSE", searchTerms: ["cse 332", "cse332", "data structures", "data structures and parallelism"] },
  { slug: "chem-142", name: "CHEM 142", kind: "COURSE", searchTerms: ["chem 142", "chem142", "general chemistry", "gen chem"] },
  { slug: "chem-152", name: "CHEM 152", kind: "COURSE", searchTerms: ["chem 152", "chem152", "general chemistry 2"] },
  { slug: "phys-121", name: "PHYS 121", kind: "COURSE", searchTerms: ["phys 121", "phys121", "physics 121", "mechanics"] },
  { slug: "phys-122", name: "PHYS 122", kind: "COURSE", searchTerms: ["phys 122", "phys122", "physics 122", "electromagnetism", "e and m"] },
  { slug: "stat-311", name: "STAT 311", kind: "COURSE", searchTerms: ["stat 311", "stat311", "statistics", "elements of statistical methods"] },
  { slug: "econ-200", name: "ECON 200", kind: "COURSE", searchTerms: ["econ 200", "econ200", "microeconomics", "micro econ"] },
  { slug: "econ-201", name: "ECON 201", kind: "COURSE", searchTerms: ["econ 201", "econ201", "macroeconomics", "macro econ"] },
  { slug: "biol-180", name: "BIOL 180", kind: "COURSE", searchTerms: ["biol 180", "biol180", "intro biology", "bio 180"] },
  { slug: "amath-301", name: "AMATH 301", kind: "COURSE", searchTerms: ["amath 301", "amath301", "beginning scientific computing", "matlab"] },
  { slug: "engl-131", name: "ENGL 131", kind: "COURSE", searchTerms: ["engl 131", "engl131", "english 131", "composition", "essay help"] },
];

export const ALL_TAGS = [...SERVICE_TAGS, ...COURSE_TAGS];

// ─────────────────────────────── demo people ───────────────────────────────

export type SeedPerson = {
  email: string;
  handle: string;
  displayName: string;
  bio?: string;
  venmoHandle?: string;
  /** Shown in the DEMO_MODE persona switcher. */
  demoRole?: string;
  /** Can open /admin/reports. */
  isAdmin?: boolean;
  seller?: {
    headline: string;
    about: string;
    fixedPriceCents?: number; // NET — what the seller takes home
    hourlyRateCents?: number; // NET
    portfolioLinks: string[];
    tagSlugs: string[];
    isAvailable?: boolean;
    listings: {
      title: string;
      description: string;
      fixedPriceCents?: number; // NET
      hourlyRateCents?: number; // NET
      turnaroundDays?: number;
      tagSlugs: string[];
    }[];
  };
};

export const PEOPLE: SeedPerson[] = [
  {
    email: "alex@uw.edu",
    handle: "alexkim",
    displayName: "Alex Kim",
    bio: "Events chair for the UW Climbing Club. Always need photos and posters.",
    venmoHandle: "@alex-kim-uw",
    demoRole: "Buyer — club events chair",
    isAdmin: true,
  },
  {
    email: "maya@uw.edu",
    handle: "mayachen",
    displayName: "Maya Chen",
    bio: "Senior in Photomedia. I shoot portraits, grad photos and club events around campus.",
    venmoHandle: "@maya-chen",
    demoRole: "Seller — photographer",
    seller: {
      headline: "Campus photographer — portraits, grad photos, events",
      about:
        "I have shot 40+ sessions around UW: grad photos at Drumheller, club events in the HUB, headshots for RSO officers. Turnaround is usually 3 days with lightly edited finals.",
      fixedPriceCents: 9_000,
      hourlyRateCents: 4_500,
      portfolioLinks: ["https://instagram.com/mayachen.photo", "https://mayachen.myportfolio.com"],
      tagSlugs: ["photography", "photo-editing"],
      listings: [
        {
          title: "Grad photo session (1 hour, 25 edited photos)",
          description:
            "One hour around campus — Drumheller, Suzzallo, the Quad if the cherries are out. You get 25 edited photos within 3 days, plus every raw frame if you want them.",
          fixedPriceCents: 9_000,
          turnaroundDays: 3,
          tagSlugs: ["photography"],
        },
        {
          title: "Club event coverage (hourly)",
          description:
            "Event photography for clubs and RSOs. I move around, get candids and a few posed group shots, and deliver a web-ready gallery in 48 hours.",
          hourlyRateCents: 4_500,
          turnaroundDays: 2,
          tagSlugs: ["photography"],
        },
      ],
    },
  },
  {
    email: "dev@uw.edu",
    handle: "devpatel",
    displayName: "Dev Patel",
    bio: "HCDE junior. 3D modeling, product renders and the occasional print-ready model.",
    venmoHandle: "@dev-patel-3d",
    demoRole: "Seller — 3D artist",
    seller: {
      headline: "3D modeling and product renders",
      about:
        "Blender and Fusion 360. I do product renders for capstone projects, print-ready models, and simple character work. Happy to iterate twice on any render.",
      fixedPriceCents: 7_500,
      hourlyRateCents: 3_500,
      portfolioLinks: ["https://devpatel.cargo.site"],
      tagSlugs: ["3d-modeling", "animation"],
      listings: [
        {
          title: "Product render for your capstone or pitch deck",
          description:
            "Send me a sketch or CAD file and I will model it and deliver three clean renders on a white or gradient background. Two rounds of changes included.",
          fixedPriceCents: 7_500,
          turnaroundDays: 4,
          tagSlugs: ["3d-modeling"],
        },
      ],
    },
  },
  {
    // A second photographer, so the demo can show several sellers responding to
    // one open request and the buyer picking between them.
    email: "kai@uw.edu",
    handle: "kaialvarez",
    displayName: "Kai Alvarez",
    bio: "Film photography mostly. I shoot events and portraits on 35mm and digital.",
    venmoHandle: "@kai-alvarez",
    demoRole: "Seller — photographer",
    seller: {
      headline: "Event and portrait photography, film or digital",
      about:
        "I shoot a lot of club events and portrait sessions. Film if you want something with character, digital if you need it fast. Usually 2 day turnaround on digital.",
      fixedPriceCents: 7_000,
      hourlyRateCents: 4_000,
      portfolioLinks: ["https://instagram.com/kaishoots35mm"],
      tagSlugs: ["photography", "photo-editing"],
      listings: [
        {
          title: "Portrait session (45 min, 15 edited photos)",
          description:
            "Forty-five minutes anywhere on campus. 15 edited photos back within 2 days. Film option available if you are not in a rush.",
          fixedPriceCents: 7_000,
          turnaroundDays: 2,
          tagSlugs: ["photography"],
        },
      ],
    },
  },
  {
    email: "priya@uw.edu",
    handle: "priyar",
    displayName: "Priya Raman",
    bio: "Design major. Logos, posters and merch for clubs on a student budget.",
    venmoHandle: "@priya-raman",
    seller: {
      headline: "Logos, posters and club merch design",
      about:
        "I design for six RSOs on campus. Fast turnaround on posters, and logo packages come with the source files so you are never stuck waiting on me later.",
      fixedPriceCents: 6_000,
      hourlyRateCents: 3_000,
      portfolioLinks: ["https://behance.net/priyaraman", "https://instagram.com/priya.designs"],
      tagSlugs: ["graphic-design", "drawing-and-physical-art"],
      listings: [
        {
          title: "Event poster (print + Instagram sizes)",
          description: "One poster, delivered in print size and as a square and story graphic for Instagram. 2 day turnaround.",
          fixedPriceCents: 3_500,
          turnaroundDays: 2,
          tagSlugs: ["graphic-design"],
        },
        {
          title: "Logo package for your club or small business",
          description:
            "Three logo directions, then refinement of the one you pick. You get SVG, PNG and a one-page usage guide.",
          fixedPriceCents: 12_000,
          turnaroundDays: 7,
          tagSlugs: ["graphic-design"],
        },
      ],
    },
  },
  {
    email: "jordan@uw.edu",
    handle: "jordanlee",
    displayName: "Jordan Lee",
    bio: "CS + Music. I edit video for student orgs and make beats at 2am.",
    venmoHandle: "@jordan-lee",
    seller: {
      headline: "Video editing and recap reels",
      about: "Premiere and DaVinci. Recap videos for events, reels for club Instagram accounts, and lecture-style edits.",
      hourlyRateCents: 3_000,
      portfolioLinks: ["https://youtube.com/@jordanleeedits"],
      tagSlugs: ["video-editing", "videography", "music-production"],
      listings: [
        {
          title: "60-second event recap reel",
          description: "Send me your footage and I will cut a 60 second recap with music and captions. One round of notes included.",
          fixedPriceCents: 5_000,
          turnaroundDays: 3,
          tagSlugs: ["video-editing"],
        },
      ],
    },
  },
  {
    email: "sam@uw.edu",
    handle: "samortiz",
    displayName: "Sam Ortiz",
    bio: "Informatics. I build small web apps and club websites.",
    venmoHandle: "@sam-ortiz",
    seller: {
      headline: "Club websites and small web apps",
      about: "Next.js and Squarespace, depending on what you actually need. I will tell you honestly which one is cheaper for you.",
      hourlyRateCents: 4_000,
      portfolioLinks: ["https://samortiz.dev"],
      tagSlugs: ["website-design", "coding-project"],
      listings: [
        {
          title: "One-page site for your club or event",
          description: "A single clean page with your info, schedule and signup form. Hosted free, yours to edit after.",
          fixedPriceCents: 15_000,
          turnaroundDays: 7,
          tagSlugs: ["website-design"],
        },
      ],
    },
  },
  {
    email: "nina@uw.edu",
    handle: "ninahaddad",
    displayName: "Nina Haddad",
    bio: "Math major, 3 years tutoring calculus. Patient with people who hate math.",
    venmoHandle: "@nina-haddad",
    seller: {
      headline: "Calculus and linear algebra tutoring",
      about:
        "I tutor MATH 124/125/126 and 208. We work through your actual homework and past exams rather than me lecturing at you.",
      hourlyRateCents: 3_000,
      portfolioLinks: [],
      tagSlugs: ["math-124", "math-125", "math-126", "math-208"],
      listings: [
        {
          title: "Calculus tutoring (hourly, in person or Zoom)",
          description:
            "MATH 124 through 126. Odegaard, a coffee shop, or Zoom. Bring your problem set. I do not do your homework for you, but you will leave able to do it.",
          hourlyRateCents: 3_000,
          tagSlugs: ["math-124", "math-125", "math-126"],
        },
      ],
    },
  },
  {
    email: "theo@uw.edu",
    handle: "theonguyen",
    displayName: "Theo Nguyen",
    bio: "CSE senior. I tutor intro CS and help people stop fearing recursion.",
    venmoHandle: "@theo-nguyen",
    seller: {
      headline: "CSE 121/122/123 and 143 tutoring",
      about:
        "Former TA for intro CS. I will not write your assignment — that is an academic integrity problem for both of us — but I am very good at finding the one idea you are missing.",
      hourlyRateCents: 3_500,
      portfolioLinks: [],
      tagSlugs: ["cse-121", "cse-122", "cse-123", "cse-143", "cse-311"],
      listings: [
        {
          title: "Intro CS tutoring (hourly)",
          description: "CSE 121/122/123/143. Debugging, concepts, exam prep. In person near campus or over Zoom.",
          hourlyRateCents: 3_500,
          tagSlugs: ["cse-121", "cse-122", "cse-143"],
        },
      ],
    },
  },
  {
    email: "rosa@uw.edu",
    handle: "rosamartinez",
    displayName: "Rosa Martinez",
    bio: "I bake birthday cakes out of my apartment kitchen. Currently taking a break during finals.",
    venmoHandle: "@rosa-martinez",
    seller: {
      headline: "Custom cakes and cookie boxes",
      about: "Birthday cakes, cookie boxes for events, and cupcakes by the dozen. Tell me the vibe and I will sketch it first.",
      fixedPriceCents: 4_000,
      portfolioLinks: ["https://instagram.com/rosabakesuw"],
      tagSlugs: ["baking", "cooking"],
      isAvailable: false, // paused: still listed, no new requests
      listings: [
        {
          title: "Custom birthday cake (6 inch)",
          description: "Six inch two-layer cake, your flavors, simple piped decoration. Pickup near U District.",
          fixedPriceCents: 4_000,
          turnaroundDays: 4,
          tagSlugs: ["baking"],
        },
      ],
    },
  },
  {
    email: "liam@uw.edu",
    handle: "liamoconnor",
    displayName: "Liam O'Connor",
    bio: "Jazz guitar in the music school. Available for events, and I teach beginners.",
    venmoHandle: "@liam-oconnor",
    seller: {
      headline: "Live acoustic sets and guitar lessons",
      about: "Solo jazz and acoustic sets for events, plus beginner guitar lessons. I bring my own amp.",
      hourlyRateCents: 5_000,
      portfolioLinks: ["https://soundcloud.com/liamoconnor"],
      tagSlugs: ["live-music", "instrument-lessons", "music-production"],
      listings: [
        {
          title: "Live acoustic set for your event (per hour)",
          description: "Background jazz or acoustic covers for receptions, galleries and club socials. I bring my own gear.",
          hourlyRateCents: 5_000,
          tagSlugs: ["live-music"],
        },
        {
          title: "Beginner guitar lessons",
          description: "Weekly half hour or hour lessons. You need a guitar; I will tell you which cheap one to buy if you do not have one.",
          hourlyRateCents: 3_000,
          tagSlugs: ["instrument-lessons"],
        },
      ],
    },
  },
  {
    email: "zoe@uw.edu",
    handle: "zoewilliams",
    displayName: "Zoe Williams",
    bio: "ASUW staffer. I hire people for events constantly.",
    venmoHandle: "@zoe-williams",
    demoRole: "Buyer — student government",
  },
];
