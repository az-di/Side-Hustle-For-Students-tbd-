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
  {
    slug: "nails",
    name: "Nails",
    kind: "SERVICE",
    searchTerms: [
      "nails",
      "nail tech",
      "manicure",
      "pedicure",
      "gel nails",
      "acrylics",
      "nail set",
      "press ons",
      "nail art",
    ],
    sortOrder: 160,
  },
  {
    slug: "hair",
    name: "Hair",
    kind: "SERVICE",
    searchTerms: [
      "hair",
      "haircut",
      "blowout",
      "braids",
      "styling",
      "silk press",
      "trim",
      "blow dry",
      "hairstylist",
    ],
    sortOrder: 170,
  },
];

/**
 * A curated set of the courses students actually hire tutors for, rather than
 * the whole UW catalog — thousands of zero-seller tags would drown the service
 * tags in every search result. Grouped by subject; the seller tag
 * editor offers "add all MATH" style bulk selection over these groups.
 *
 * `course()` builds the standard search terms ("math 124", "math124") and
 * appends the extra synonyms given. Adding a course is one line; a scraper
 * against the public catalog can replace this list later (HANDOFF §11.9).
 */
function course(subject: string, number: string, synonyms: string[] = []): SeedTag {
  const code = `${subject} ${number}`;
  return {
    slug: `${subject.toLowerCase()}-${number.toLowerCase()}`,
    name: code,
    kind: "COURSE",
    searchTerms: [code.toLowerCase(), `${subject}${number}`.toLowerCase(), ...synonyms],
  };
}

export const COURSE_TAGS: SeedTag[] = [
  // Math
  course("MATH", "120", ["precalculus", "precalc"]),
  course("MATH", "124", ["calc 1", "calculus 1", "calculus", "derivatives"]),
  course("MATH", "125", ["calc 2", "calculus 2", "integrals"]),
  course("MATH", "126", ["calc 3", "calculus 3", "multivariable"]),
  course("MATH", "207", ["differential equations", "diff eq", "ode"]),
  course("MATH", "208", ["linear algebra", "matrices"]),
  course("MATH", "224", ["advanced multivariable", "vector calculus"]),
  course("MATH", "300", ["intro to proofs", "proof writing"]),
  course("MATH", "307", ["intro differential equations"]),
  course("MATH", "308", ["matrix algebra"]),
  course("MATH", "309", ["linear analysis"]),
  course("MATH", "324", ["advanced multivariable calculus 2"]),
  course("MATH", "394", ["probability 1"]),
  // Computer science
  course("CSE", "121", ["intro to programming", "intro cs", "java intro"]),
  course("CSE", "122", ["intro programming 2", "data structures intro"]),
  course("CSE", "123", ["intro programming 3"]),
  course("CSE", "142", ["computer programming 1", "java"]),
  course("CSE", "143", ["computer programming 2", "recursion"]),
  course("CSE", "154", ["web programming", "html css javascript"]),
  course("CSE", "160", ["data programming", "python intro"]),
  course("CSE", "163", ["intermediate data programming", "pandas"]),
  course("CSE", "311", ["foundations of computing", "discrete math"]),
  course("CSE", "312", ["foundations of computing 2", "probability for cs"]),
  course("CSE", "331", ["software design", "software design and implementation"]),
  course("CSE", "332", ["data structures", "data structures and parallelism"]),
  course("CSE", "333", ["systems programming", "c and c++"]),
  course("CSE", "341", ["programming languages"]),
  course("CSE", "344", ["databases", "sql", "data management"]),
  course("CSE", "351", ["hardware software interface", "assembly"]),
  course("CSE", "373", ["data structures and algorithms", "non majors data structures"]),
  course("CSE", "374", ["intermediate programming", "c programming"]),
  course("CSE", "391", ["unix tools", "command line"]),
  course("CSE", "414", ["intro to data management", "sql"]),
  course("CSE", "446", ["machine learning"]),
  course("CSE", "473", ["artificial intelligence", "ai"]),
  // Applied math and statistics
  course("AMATH", "301", ["beginning scientific computing", "matlab"]),
  course("AMATH", "351", ["ode", "differential equations applied"]),
  course("AMATH", "352", ["applied linear algebra", "numerical analysis"]),
  course("STAT", "220", ["basic statistics", "stats"]),
  course("STAT", "311", ["statistics", "elements of statistical methods"]),
  course("STAT", "390", ["probability and statistics for engineers"]),
  course("STAT", "391", ["quantitative intro to probability"]),
  // Chemistry
  course("CHEM", "142", ["general chemistry", "gen chem"]),
  course("CHEM", "152", ["general chemistry 2"]),
  course("CHEM", "162", ["general chemistry 3"]),
  course("CHEM", "223", ["organic chemistry 1", "orgo", "ochem"]),
  course("CHEM", "237", ["organic chemistry", "orgo 1"]),
  course("CHEM", "238", ["organic chemistry 2", "orgo 2"]),
  course("CHEM", "239", ["organic chemistry 3", "orgo 3"]),
  // Physics
  course("PHYS", "114", ["general physics", "algebra based physics"]),
  course("PHYS", "115", ["general physics 2"]),
  course("PHYS", "116", ["general physics 3"]),
  course("PHYS", "121", ["physics 121", "mechanics"]),
  course("PHYS", "122", ["physics 122", "electromagnetism", "e and m"]),
  course("PHYS", "123", ["physics 123", "waves", "optics"]),
  // Biology and health
  course("BIOL", "180", ["intro biology", "bio 180"]),
  course("BIOL", "200", ["intro biology 2", "cell biology"]),
  course("BIOL", "220", ["intro biology 3", "physiology"]),
  course("BIOC", "405", ["biochemistry", "biochem"]),
  course("BIOC", "406", ["biochemistry 2"]),
  course("BIOSTAT", "310", ["biostatistics"]),
  // Economics and business
  course("ECON", "200", ["microeconomics", "micro econ"]),
  course("ECON", "201", ["macroeconomics", "macro econ"]),
  course("ECON", "300", ["intermediate micro"]),
  course("ECON", "301", ["intermediate macro"]),
  course("ECON", "311", ["economic statistics", "econometrics intro"]),
  course("ACCTG", "215", ["intro to accounting", "financial accounting"]),
  course("ACCTG", "225", ["managerial accounting"]),
  course("FIN", "350", ["business finance", "corporate finance"]),
  course("MKTG", "301", ["marketing"]),
  // Informatics, HCDE, engineering
  course("INFO", "200", ["intellectual foundations of informatics"]),
  course("INFO", "201", ["foundational skills for data science", "r programming"]),
  course("INFO", "300", ["research methods informatics"]),
  course("INFO", "340", ["client side development", "react"]),
  course("HCDE", "210", ["explorations in hcde", "user centered design"]),
  course("EE", "215", ["circuits", "fundamentals of electrical engineering"]),
  course("EE", "235", ["signals", "continuous time linear systems"]),
  course("MSE", "170", ["materials science"]),
  course("ME", "230", ["kinematics and dynamics"]),
  course("CEE", "220", ["statics", "mechanics of materials"]),
  course("AA", "210", ["engineering statics"]),
  // Psychology, writing, languages, humanities
  course("PSYCH", "101", ["intro psychology", "psych 101"]),
  course("PSYCH", "202", ["biopsychology"]),
  course("PSYCH", "209", ["fundamentals of psychological research"]),
  course("ENGL", "131", ["english 131", "composition", "essay help"]),
  course("ENGL", "182", ["composition multimodal"]),
  course("PHIL", "120", ["intro logic", "logic"]),
  course("LING", "200", ["intro linguistics"]),
  course("SPAN", "101", ["spanish 1", "beginning spanish"]),
  course("SPAN", "102", ["spanish 2"]),
  course("SPAN", "103", ["spanish 3"]),
  course("JAPAN", "111", ["japanese 1", "beginning japanese"]),
  course("CHIN", "101", ["chinese 1", "beginning chinese"]),
  course("KOREAN", "101", ["korean 1", "beginning korean"]),
  course("FRENCH", "101", ["french 1", "beginning french"]),
  course("POL S", "201", ["intro political theory"]),
  course("HSTAA", "101", ["survey of us history", "american history"]),
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
      fixedPriceCents: 4_500,
      hourlyRateCents: 4_500,
      portfolioLinks: ["https://instagram.com/mayachen.photo", "https://mayachen.myportfolio.com"],
      tagSlugs: ["photography", "photo-editing"],
      listings: [
        {
          title: "Grad photo session (1 hour, 25 edited photos)",
          description:
            "One hour around campus — Drumheller, Suzzallo, the Quad if the cherries are out. You get 25 edited photos within 3 days, plus every raw frame if you want them.",
          fixedPriceCents: 4_500,
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
      fixedPriceCents: 4_000,
      hourlyRateCents: 4_000,
      portfolioLinks: ["https://instagram.com/kaishoots35mm"],
      tagSlugs: ["photography", "photo-editing"],
      listings: [
        {
          title: "Portrait session (about an hour, 15 edited photos)",
          description:
            "About an hour anywhere on campus — shoot plus a first pass of edits. 15 edited photos back within 2 days. Film option available if you are not in a rush.",
          fixedPriceCents: 4_000,
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
