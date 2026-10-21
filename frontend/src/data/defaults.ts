import type { About, SelectableOptions } from "../api/types";

/** Form choices used until `GET /content` responds (or if it fails), so forms stay usable. */
export const defaultSelectableOptions: SelectableOptions = {
  contactMethods: ["Email", "Phone", "WhatsApp"],
  serviceTypes: ["High School", "University", "Exam Prep"],
  urgencyWindows: ["Within 2 weeks", "Within 1 month", "Within 3 months"],
  urgencyFlags: ["No", "Yes"],
  assessmentSubjects: ["Math", "Physics", "Both"],
  courseCategories: ["University Courses", "High School Courses", "Exam Prep"]
};

/** Shown until `GET /content` responds; the backend fills the same defaults until the tutor edits them. */
export const defaultAbout: About = {
  tutorName: "",
  headline: "Math & physics, finally making sense.",
  tagline: "One-to-one tutoring for University, IB, AP, SAT and A-Level students.",
  bio: "",
  email: "",
  phone: "",
  location: "",
  photoUrl: "",
  videoUrl: "",
  stats: [],
  highlights: []
};
