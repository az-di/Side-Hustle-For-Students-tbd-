-- Invariants the application must not be trusted with.
-- These are the "load-bearing" constraints from the plan: they are what stop a
-- bug in a server action from producing a non-UW account, a self-dealt job, a
-- budget-less request, or an out-of-range review.

-- The entire trust pitch: UW students only.
ALTER TABLE "User"
  ADD CONSTRAINT user_uw_email CHECK ("uwEmail" LIKE '%@uw.edu');

-- Nobody hires themselves (which would also mint fake completed-job counts).
ALTER TABLE "Job"
  ADD CONSTRAINT job_no_self CHECK ("buyerUserId" <> "sellerUserId");

-- DIRECT requests name a seller; OPEN requests must not.
ALTER TABLE "Request"
  ADD CONSTRAINT request_direct_target CHECK (
    ("kind" = 'DIRECT' AND "targetSellerUserId" IS NOT NULL) OR
    ("kind" = 'OPEN'   AND "targetSellerUserId" IS NULL)
  );

-- Every request carries a budget (the spec requires one, and the seller-facing
-- net figure is derived from it).
ALTER TABLE "Request"
  ADD CONSTRAINT request_has_budget CHECK (
    "grossFixedBudgetCents" IS NOT NULL OR "grossHourlyBudgetCents" IS NOT NULL
  );

-- Money is always a non-negative integer number of cents.
ALTER TABLE "Request"
  ADD CONSTRAINT request_budget_non_negative CHECK (
    COALESCE("grossFixedBudgetCents", 0) >= 0 AND COALESCE("grossHourlyBudgetCents", 0) >= 0
  );
ALTER TABLE "Request"
  ADD CONSTRAINT request_fee_bps_range CHECK ("feeBps" >= 0 AND "feeBps" < 10000);
ALTER TABLE "Job"
  ADD CONSTRAINT job_fee_bps_range CHECK ("feeBps" >= 0 AND "feeBps" < 10000);
ALTER TABLE "Listing"
  ADD CONSTRAINT listing_price_non_negative CHECK (
    COALESCE("fixedPriceCents", 0) >= 0 AND COALESCE("hourlyRateCents", 0) >= 0
  );

ALTER TABLE "Review"
  ADD CONSTRAINT review_rating_range CHECK ("rating" BETWEEN 1 AND 5);

-- Reviews only ever run buyer -> seller, never the reverse.
ALTER TABLE "Review"
  ADD CONSTRAINT review_no_self CHECK ("buyerUserId" <> "sellerUserId");

-- A message is either from a human or from the system, not neither.
ALTER TABLE "Message"
  ADD CONSTRAINT message_has_author CHECK (
    "senderUserId" IS NOT NULL OR "systemKind" IS NOT NULL
  );

-- Unread-notification badge: an index over only the unread rows, so the count
-- is O(unread) rather than O(all notifications this user ever received).
CREATE INDEX notification_unread
  ON "Notification"("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

-- Sweeps/filters touch only live rows.
CREATE INDEX request_expiry_due
  ON "Request"("expiresAt")
  WHERE "status" IN ('OPEN', 'PENDING_SELLER');

CREATE INDEX job_autocomplete_due
  ON "Job"("autoCompleteAt")
  WHERE "status" = 'AWAITING_CONFIRMATION';
