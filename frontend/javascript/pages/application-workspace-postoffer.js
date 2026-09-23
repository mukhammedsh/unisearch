const POST_OFFER_GUIDES = {
  "mit-usa-cambridge": {
    visaDocumentType: "i20",
    visaUrl: "https://iso.mit.edu/getting-started/requesting-an-i-20-or-ds-2019/",
  },
  "stanford-university-usa-ca": {
    visaDocumentType: "i20",
    visaUrl: "https://bechtel.stanford.edu/navigate-international-life/visas/f-1-and-j-1-student-visas/applying-visa-document-newly-admitted",
  },
  "harvard-usa-cambridge": {
    visaDocumentType: "i20",
    visaUrl: "https://www.hio.harvard.edu/visas-immigration/student",
  },
  "university-of-oxford-uk-oxford": {
    visaDocumentType: "cas",
    visaUrl: "https://www.ox.ac.uk/students/visa/before/cas",
  },
  "imperial-college-london-uk": {
    visaDocumentType: "cas",
    visaUrl: "https://www.imperial.ac.uk/study/fees-and-funding/student-visa-money/",
  },
};

function safeUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function buildPostOfferTasks(university) {
  const guide = POST_OFFER_GUIDES[university?.id];
  if (!guide) return [];
  const id = university.id;
  const financeUrl = safeUrl(university?.finance?.source_url || university?.finance?.sourceUrl);
  return [
    {
      id: `${id}:post-offer:confirm-cost`,
      titleKey: "application_workspace.post_offer_confirm_cost",
      titleFallback: "Confirm your official total cost and payment schedule",
      detailKey: "application_workspace.post_offer_confirm_cost_detail",
      detailFallback: "Use the university's official fee statement for your program and cycle. Any amount not published here remains unknown; this plan does not calculate a net price.",
      sourceUrl: financeUrl,
      sourceLabelKey: "application_workspace.post_offer_fee_source",
      sourceLabelFallback: "Official fees and funding information",
    },
    {
      id: `${id}:post-offer:confirm-award`,
      titleKey: "application_workspace.post_offer_confirm_award",
      titleFallback: "Confirm each awarded aid amount and its conditions",
      detailKey: "application_workspace.post_offer_confirm_award_detail",
      detailFallback: "Check your official award or aid letter. Potential awards are not confirmed funds and are not subtracted from published costs.",
      sourceUrl: financeUrl,
      sourceLabelKey: "application_workspace.post_offer_award_source",
      sourceLabelFallback: "Official fees and funding information",
    },
    {
      id: `${id}:post-offer:request-visa-document`,
      titleKey: "application_workspace.post_offer_request_visa_document",
      titleFallback: "Check how to request your university visa document",
      detailKey: guide.visaDocumentType === "cas"
        ? "application_workspace.post_offer_cas_detail"
        : "application_workspace.post_offer_i20_detail",
      detailFallback: guide.visaDocumentType === "cas"
        ? "After you accept an offer, follow the university's instructions for requesting a CAS. The university determines the required documents and process."
        : "After you accept an offer, follow the university's instructions for requesting an I-20 or DS-2019. The university determines the required documents and process.",
      sourceUrl: guide.visaUrl,
      sourceLabelKey: "application_workspace.post_offer_visa_source",
      sourceLabelFallback: "Official visa document instructions",
    },
    {
      id: `${id}:post-offer:confirm-proof-of-funds`,
      titleKey: "application_workspace.post_offer_confirm_funds",
      titleFallback: "Review official proof-of-funds requirements",
      detailKey: "application_workspace.post_offer_confirm_funds_detail",
      detailFallback: "Check the university's current instructions for the evidence and amounts it requires. This plan does not determine visa eligibility or processing time.",
      sourceUrl: guide.visaUrl,
      sourceLabelKey: "application_workspace.post_offer_funds_source",
      sourceLabelFallback: "Official proof-of-funds and visa guidance",
    },
  ];
}

export function postOfferGuideFor(universityId) {
  const guide = POST_OFFER_GUIDES[universityId];
  return guide ? { ...guide } : null;
}
