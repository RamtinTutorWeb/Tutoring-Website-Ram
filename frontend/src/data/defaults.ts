import type { SelectableOptions, SitePages } from "../api/types";

/** Form choices used until `GET /content` responds (or if it fails), so forms stay usable. */
export const defaultSelectableOptions: SelectableOptions = {
  contactMethods: ["Email", "Phone", "WhatsApp"],
  serviceTypes: ["High School", "University", "Exam Prep"],
  urgencyWindows: ["Within 2 weeks", "Within 1 month", "Within 3 months"],
  urgencyFlags: ["No", "Yes"],
  assessmentSubjects: ["Math", "Physics", "Both"],
  courseCategories: ["University Courses", "High School Courses", "Exam Prep"]
};

/** Page copy shown until `GET /content` responds. Mirrors DEFAULT_PAGES in backend/src/lib/content.ts. */
export const defaultPages: SitePages = {
  home: {
    kicker: "Math and Physics Tutoring",
    title: "Ace math and physics with expert tutoring",
    subtitle: "Personalized support for University, IB, AP, SAT, and A-Level students.",
    teachingTitle: "Teaching style",
    teachingText:
      "Concept-first teaching with targeted practice. We break topics into manageable steps, " +
      "identify gaps quickly, and build confidence through structured solving strategies.",
    videoUrl: ""
  },
  about: { title: "About me", intro: "", photoUrl: "", sections: [] },
  examPrep: {
    intro: "Dedicated tracks for exam strategy, topic targeting, timed practice, and mock sessions.",
    timelinesTitle: "However close your exam is",
    timelinesText: ""
  },
  policy: { intro: "", sections: [] },
  contact: {
    intro: "Tell me what you need help with. Once your request is accepted you will get a link to book a session.",
    email: "",
    phone: ""
  },
  booking: { calendlyUrl: "", intro: "Pick a time that works for you." }
};
