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
  db.sessionSettings = db.sessionSettings ?? {
    defaultDailySlots: 8,
    slotDurationMinutes: 90
  };
  return db;
}

export function saveDB(db: DB): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
