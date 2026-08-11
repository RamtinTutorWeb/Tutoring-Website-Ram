import { createSeedData, defaultSelectableOptions } from "../data/seed";
import type { DB } from "../types";

const DB_KEY = "tutoring_mvp_db_v2";

export function loadDB(): DB {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const seed = createSeedData();
    localStorage.setItem(DB_KEY, JSON.stringify(seed));
    return seed;
  }
  const db = JSON.parse(raw) as DB;
  db.selectableOptions = {
    ...defaultSelectableOptions,
    ...(db.selectableOptions ?? {})
  };
  db.learnerCourses = db.learnerCourses ?? [];
  db.sessionSlots = db.sessionSlots ?? [];
  db.examPrepTracks = db.examPrepTracks ?? db.courses.filter((course) => course.category === "Exam Prep");
  db.reviews = (db.reviews ?? []).map((review) => ({
    ...review,
    status: review.status ?? "approved"
  }));
  db.sessionSettings = db.sessionSettings ?? {
    defaultDailySlots: 8,
    slotDurationMinutes: 60,
    dayStartHour: 8,
    dayEndHour: 20,
    sessionTypes: []
  };
  db.sessionSettings.defaultDailySlots = db.sessionSettings.defaultDailySlots ?? 8;
  db.sessionSettings.slotDurationMinutes = [60, 120, 180].includes(db.sessionSettings.slotDurationMinutes)
    ? db.sessionSettings.slotDurationMinutes
    : 60;
  db.sessionSettings.dayStartHour = db.sessionSettings.dayStartHour ?? 8;
  db.sessionSettings.dayEndHour = db.sessionSettings.dayEndHour ?? 20;
  db.sessionSettings.sessionTypes = db.sessionSettings.sessionTypes?.length
    ? db.sessionSettings.sessionTypes
    : [
        { id: "session-type-course-support", purpose: "Course Support", durationMinutes: 60 },
        { id: "session-type-exam-prep", purpose: "Exam Prep", durationMinutes: 120 },
        { id: "session-type-assessment-review", purpose: "Assessment Review", durationMinutes: 180 }
      ];
  db.sessionSettings.sessionTypes = db.sessionSettings.sessionTypes.map((type) => ({
    ...type,
    durationMinutes: [60, 120, 180].includes(type.durationMinutes) ? type.durationMinutes : 60
  }));
  return db;
}

export function saveDB(db: DB): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
