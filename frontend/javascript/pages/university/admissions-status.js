// Closed admissions vocabulary prepared by backend/scripts/prepare_admissions_catalog.py.
// Research labels stay in publication_status/review_status for source details only.

export const publicationState = row => row?.normalized_status?.publication || "unknown";
export const reviewState = row => row?.normalized_status?.review || "not_recorded";

export const isEvidenceReviewed = row => ["verified", "verified_with_limits", "carried_forward"].includes(reviewState(row));
// A scope-limited review still counts as evidence, but keeps its visible limitation badge.
export const hasReviewWarning = row => !["verified", "carried_forward"].includes(reviewState(row));
export const isPublished = row => publicationState(row) === "published";
export const isReviewedPublished = row => isPublished(row) && isEvidenceReviewed(row);
export const reviewNeedsResolution = row => ["conflicting", "needs_resolution"].includes(reviewState(row));
export const needsResolution = row => reviewNeedsResolution(row) || publicationState(row) === "conflicting";

// Published values whose cycle or scope is unconfirmed remain usable as labelled references.
export const isPublishedReference = row => ["published", "published_with_limits"].includes(publicationState(row));

export const PUBLICATION_LABEL_KEYS = {
  published: "published",
  published_with_limits: "limited_publication",
  partially_published: "partly_published",
  not_yet_published: "not_published",
  not_found: "not_published",
  conflicting: "conflicting",
  historical: "historical",
  unknown: "unknown",
};

export const REVIEW_LABEL_KEYS = {
  verified: "review.verified",
  carried_forward: "review.carried_forward_review",
  verified_with_limits: "review.limited",
  partially_verified: "review.limited",
  conflicting: "review.conflicting",
  needs_resolution: "review.needs_resolution",
  superseded: "review.superseded",
  not_recorded: "needs_review",
};
