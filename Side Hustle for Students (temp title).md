# **HUSTL**

## **Overview**

A campus-only marketplace where students hire other students for creative services. Work starts from either side. A seller publishes a service and buyers request it, or a buyer posts a request under a task tag and is notified when a matching seller is available. Launches at UW only. The pitch: cheaper and more trustworthy than Fiverr or Upwork, and more discoverable than group chats and Instagram.

## **Problem and motivation**

Student creatives have no reliable way to find clients on campus, and students who need creative work have no easy way to find them.

* **Sellers** want flexible income that fits around classes and builds a portfolio.  
* **Buyers** want small creative jobs done cheaply by someone they can trust.  
* **Today** this happens through word of mouth, group chats, and Instagram bios. Discovery is luck, prices are opaque, and there's no record of past work or reviews.

Why students choose this over Fiverr: lower pric1.es (student budgets on both sides), trust (a verified fellow student, not a stranger), and proximity (in-person delivery, meetups, campus-specific context).

## **Users**

| Role | Who | What they need |
| ----- | ----- | ----- |
| Seller | Students with a creative skill: design, photography, video, music, writing, tutoring (TBD) | A profile that shows off their work, control over pricing, and a steady trickle of jobs |
| Buyer | Students, clubs, and student orgs | Fast discovery, clear prices, proof of quality, and low risk of getting burned |

One account can act as both. Clubs and student orgs are likely the highest-value early buyers (event photos, posters, logos).

## **MVP scope**

The first version proves one loop: a buyer finds a seller, they agree on a job, it gets done, and the buyer leaves a review.

**In scope**

1. Sign-up restricted to verified UW email.  
2. **Task tags**: a fixed list maintained by the team. Every listing and every request carries one or more tags. The list is flat, with no categories, and users find tags by search. Each tag has a hidden list of synonyms so different wording still matches (e.g. "photoshoot" finds Photography, "logo" finds Graphic design). Launch list: Photography, Photo editing, Videography, Video editing, Animation, 3D modeling, Graphic design, Drawing and physical art, Website design, Coding project, Music production, Instrument lessons, Live music (performance at events), Cooking, Baking, and Tutoring with one tag for every UW course code (e.g. MATH 124).  
3. **Seller profile**: bio, tags, portfolio, reviews, and completed-job history. Portfolio items can be links or photos and videos hosted on the site.  
4. **Seller tags and listings**: a seller marks the tags they're open to doing and can publish a service under a tag (description, turnaround, examples). Buyers request it.  
5. **Pause**: a seller can mark themselves temporarily not working. They stay listed but receive no new requests until they resume.  
6. **Buyer requests**, in two kinds:  
   * **Open request**: posted under a tag and visible to every seller with that tag. Several sellers can respond. The buyer picks one, and the request closes for everyone else.  
   * **Direct request**: sent to one specific seller and visible only to them.  
7. Every request carries a **budget** and a **time limit** set by the buyer. It closes when the time limit passes.  
8. **In-app notifications** (web): a buyer is notified when a seller becomes open to a tag they requested. Sellers are notified of open requests in their tags and of direct requests.  
9. Search tags by name, with type-ahead matching course codes too. Filter sellers by rating.  
10. Job flow: request, accept or decline, both mark complete.  
11. Messaging between buyer and seller.  
12. **Reviews**: buyers review sellers, only after a completed job. Sellers do not review buyers.  
13. **Buyer accountability**: sellers can report buyers. Reports feed an internal rating that users don't see, and accounts with too many negative reports are closed.  
14. Reporting and blocking for all users.

**Out of scope for v1**

* In-app payments (students pay each other directly, e.g. Venmo; revisit once there's traction)  
* Other campuses  
* Price bidding, where sellers compete on price for a request  
* Price negotiation tools (the budget is set on the request; any back-and-forth happens in messages)  
* Faculty and departments as buyers (students only for now)  
* Upload file-size limits  
* The exact report threshold and an appeals process for closed buyer accounts  
* Native mobile apps (start as a mobile-friendly web app)

  ## **Unique selling point and competition**

The edge is a campus-local, students-only marketplace. Big platforms can't offer that trust or proximity, and informal channels can't offer search, pricing, or reviews.

| Alternative | Strength | Where we win |
| ----- | ----- | ----- |
| Fiverr / Upwork | Huge supply, built-in payments and escrow | Lower prices, a verified peer, in-person work, no 20% platform fee |
| Instagram / group chats / word of mouth | Free, already where students are | Searchable, comparable prices, reviews and a work history |
| Handshake / campus job boards | Official, trusted | Built for one-off creative gigs, not jobs and internships |

The real competitor is the status quo: a group chat message saying "anyone know a photographer?"

## **Business model and pricing**

The launch is free for both sides, because liquidity matters more than revenue early on. The pricing model (fixed, hourly, or quoted) is still undecided.

Options for later:

* **Small transaction fee** (e.g. 5–10%) once in-app payments exist. This is far below Fiverr's but requires handling payments.  
* **Featured listings** where sellers pay to rank higher in a category.  
* **Org or university partnerships** where clubs or departments pay for priority access or sponsor the platform.

One risk: if the app doesn't handle payment, users can take jobs off-platform after the first contact. Reviews and work history are the main reason to stay.

## **Risks**

The original concern was that labor laws would block low prices. That's likely not the main risk. Minimum-wage rules mostly apply to employees, and sellers here are independent freelancers setting their own rates. The risks below matter more. Get a quick legal check before launch; this section is not legal advice.

| Risk | Why it matters | Mitigation |
| ----- | ----- | ----- |
| Cold start (chicken and egg) | No buyers without sellers, no sellers without buyers | Launch on one campus and a few categories; recruit 20–30 sellers by hand before opening to buyers |
| International students | Visa rules (e.g. F-1) generally bar off-campus freelance work | Show a notice at seller sign-up telling them to check with their international student office |
| Academic dishonesty | "Write my essay" or "do my homework" requests, including graded coding assignments and tutoring that turns into doing the work | Ban them in the terms, block them from categories, moderate reports |
| Trust and safety | Scams, no-shows, unsafe in-person meetups | .edu verification, reviews only after completion, reporting, meetup guidance |
| Payments | Disputes when students pay each other directly; handling money yourself brings legal obligations | Start off-platform; later use a provider like Stripe Connect instead of holding funds |
| Platform control | Too much control over how sellers work can make them look like employees | Sellers set prices, hours, and terms; the platform only connects |
| University policy | Some schools restrict commercial activity or use of their name and logo | Check the policy; avoid the official name and logo |
| Ownership of creative work | Who owns a logo or photo after the job | A default ownership clause in the terms, editable per job |
| Leakage | Users take repeat jobs off-platform | Make reviews and history worth staying for |

Cooking and baking need a separate check. Selling home-prepared food can fall under Washington's cottage food rules and UW housing policy, so confirm before enabling those tags.

## **Launch plan**

The launch starts narrow: UW only, three or four categories, and hand-recruited sellers. Dates are TBD.

1. **Validate.** Interview about 10 potential sellers and 10 buyers, including two or three club officers. Confirm they would pay, and how much.  
2. **Seed supply.** Recruit 20–30 sellers from art, design, film, and music programs and from existing Instagram creatives.  
3. **Build the MVP.** Implement the in-scope list above.  
4. **Soft launch.** Open to buyers through clubs, class group chats, and flyers. Collect feedback weekly.  
5. **Iterate.** Fix the drop-off points, add categories, then decide on in-app payments.

   ## **Success metrics**

The MVP works if jobs get completed and buyers come back. Targets are placeholders to set after validation.

* Active sellers with at least one listing  
* Requests sent per week, and the share accepted  
* Jobs completed per week (the north-star metric)  
* Share of completed jobs that get a review  
* Repeat buyers within 30 days

  ## **Open questions**

* Pricing model: fixed, hourly, or quoted (TBD)

Instructions for AI Agent: 

- Always delegate to subagents for specific subtasks when logically possible  
- Before continuing with the build, GRILL ME and ask me questions if there is anything unclear  
- Design the overall system before building specific subcomponents, ensure that code is portable and modularized in a clear and easy to maintain way.