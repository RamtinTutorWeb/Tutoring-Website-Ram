import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { ensureProfile, ownerFilter, requireAdmin, requireAuth, viewerOf } from '../middleware/auth.js';
import { COURSE_STATUSES } from '../types.js';
import { loadSettingsContent } from './content.js';
import { uuidParam } from './params.js';

const createSchema = z.object({
  courseId: z.string().trim().min(1).max(100),
  studentId: z.string().trim().min(1).max(100).optional(),
});
const statusSchema = z.object({ status: z.enum(COURSE_STATUSES) });

export const learnerCoursesRouter = Router();

learnerCoursesRouter.get('/learner-courses', requireAuth, async (req, res) => {
  res.json(await db.listLearnerCourses(ownerFilter(viewerOf(req))));
});

/** Students register themselves; `studentId` is honored only for admins (assigning a course). */
learnerCoursesRouter.post('/learner-courses', requireAuth, async (req, res) => {
  const { courseId, studentId: requested } = createSchema.parse(req.body ?? {});
  const content = await loadSettingsContent();
  if (![...content.courses, ...content.examPrepTracks].some((c) => c.id === courseId)) {
    throw badRequest('Unknown courseId');
  }
  const viewer = viewerOf(req);
  let studentId = viewer.userId;
  if (viewer.role === 'admin' && requested && requested !== viewer.userId) {
    if (!(await db.getProfile(requested))) throw notFound('Student');
    studentId = requested;
  } else {
    await ensureProfile(viewer);
  }
  res.status(201).json(await db.createLearnerCourse(studentId, courseId));
});

learnerCoursesRouter.patch('/learner-courses/:id', ...requireAdmin, async (req, res) => {
  const id = uuidParam(req, 'Learner course');
  const { status } = statusSchema.parse(req.body ?? {});
  const updated = await db.setLearnerCourseStatus(id, status);
  if (!updated) throw notFound('Learner course');
  res.json(updated);
});

/** Admins remove any record; students drop their own. */
learnerCoursesRouter.delete('/learner-courses/:id', requireAuth, async (req, res) => {
  const id = uuidParam(req, 'Learner course');
  const viewer = viewerOf(req);
  const record = await db.getLearnerCourse(id);
  if (!record || (viewer.role !== 'admin' && record.studentId !== viewer.userId)) throw notFound('Learner course');
  await db.deleteLearnerCourse(id);
  res.status(204).end();
});
