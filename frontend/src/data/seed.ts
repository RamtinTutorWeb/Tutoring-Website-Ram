import type { DB, SelectableOptions } from "../types";
import { uid } from "../lib/id";

export const defaultSelectableOptions: SelectableOptions = {
  contactMethods: ["Email", "Phone", "WhatsApp"],
  serviceTypes: ["High School", "University", "Exam Prep"],
  urgencyWindows: ["Within 2 weeks", "Within 1 month", "Within 3 months"],
  urgencyFlags: ["No", "Yes"],
  assessmentSubjects: ["Math", "Physics", "Both"],
  courseCategories: ["University Courses", "High School Courses", "Exam Prep"]
};

export function createSeedData(): DB {
  const calculusCourseId = uid();
  const algebraCourseId = uid();
  const satCourseId = uid();

  return {
    users: [
      { id: "u1", name: "Admin User", email: "admin@site.com", password: "admin123", role: "admin" },
      { id: "u2", name: "Instructor User", email: "instructor@site.com", password: "tutor123", role: "tutor" },
      { id: "u3", name: "Student User", email: "student@site.com", password: "student123", role: "student" }
    ],
    currentUserId: null,
    selectableOptions: defaultSelectableOptions,
    reviews: [
      { id: uid(), name: "L.M.", rating: 5, text: "Clear explanations and strong structure.", status: "approved" },
      { id: uid(), name: "A.K.", rating: 5, text: "Helped me improve quickly before exams.", status: "approved" }
    ],
    faq: [
      {
        id: uid(),
        question: "How are sessions structured?",
        answer: "Sessions include concept review, guided practice, and action points for the next week."
      },
      {
        id: uid(),
        question: "Do you support exam preparation?",
        answer: "Yes. IB/AP/SAT/A-Levels tracks are available with timed strategy training."
      }
    ],
    courses: [
      {
        id: calculusCourseId,
        title: "Calculus I",
        category: "University Courses",
        description: "Limits, derivatives, optimization, and integration basics with applied problem solving."
      },
      {
        id: algebraCourseId,
        title: "High School Algebra",
        category: "High School Courses",
        description: "Linear equations, functions, systems, polynomials, and graph interpretation."
      }
    ],
    examPrepTracks: [
      {
        id: satCourseId,
        title: "SAT Math Prep",
        category: "Exam Prep",
        description: "Data analysis, algebra, geometry essentials, and timing tactics for SAT sections."
      }
    ],
    learnerCourses: [
      {
        id: uid(),
        userId: "u3",
        courseId: calculusCourseId,
        status: "in-progress",
        registeredAt: new Date().toISOString()
      },
      {
        id: uid(),
        userId: "u3",
        courseId: algebraCourseId,
        status: "passed",
        registeredAt: new Date().toISOString()
      }
    ],
    sessionSlots: [
      {
        id: uid(),
        tutorId: "u2",
        date: new Date().toISOString().slice(0, 10),
        startTime: "17:00",
        endTime: "18:00",
        purpose: "Course Support",
        status: "available",
        notes: "Online session"
      },
      {
        id: uid(),
        tutorId: "u2",
        date: new Date().toISOString().slice(0, 10),
        startTime: "18:30",
        endTime: "19:30",
        purpose: "Calculus Review",
        status: "reserved",
        learnerName: "Student User",
        notes: "Calculus review"
      }
    ],
    sessionSettings: {
      defaultDailySlots: 8,
      slotDurationMinutes: 60,
      dayStartHour: 8,
      dayEndHour: 20,
      sessionTypes: [
        { id: uid(), purpose: "Course Support", durationMinutes: 60 },
        { id: uid(), purpose: "Exam Prep", durationMinutes: 120 },
        { id: uid(), purpose: "Assessment Review", durationMinutes: 180 }
      ]
    },
    requests: [],
    questionnaires: [],
    tests: []
  };
}
