const tourSeenKey = "unisearch_universities_tour_seen_v1";
const profileStorageKey = "unisearch_profile";

const personas = {
  ruStemGrant: {
    profile: {
      name: "Aruzhan Dev",
      budget: 26000,
      gpa: 96,
      major: "Computer Science",
      interests: "Хочу AI research кампус в США, gamedev и ui/ux.",
      studyMode: "On-campus",
      fundingType: "grant",
      exams: [{ exam: "SAT", score: 1490 }],
      languages: [{ code: "en", kind: "exam", exam: "IELTS", score: 7.5 }],
    },
  },
  enResearch: {
    profile: {
      name: "Maya Research",
      budget: 52000,
      gpa: 98,
      major: "Engineering",
      interests: "Robotics, machine vision, embedded systems, and applied AI labs.",
      studyMode: "On-campus",
      fundingType: "any",
      exams: [{ exam: "ACT", score: 34 }],
      languages: [{ code: "en", kind: "native" }],
    },
  },
};

async function seedProfile(page, profile) {
  await page.addInitScript(
    ({ tourKey, storageKey, value }) => {
      localStorage.setItem(tourKey, "1");
      localStorage.setItem(storageKey, JSON.stringify(value));
    },
    {
      tourKey: tourSeenKey,
      storageKey: profileStorageKey,
      value: profile || {},
    }
  );
}

async function markTourAsSeen(page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "1");
  }, tourSeenKey);
}

module.exports = {
  personas,
  seedProfile,
  markTourAsSeen,
};
