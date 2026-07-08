/**
 * EduPulse API — Cloudflare Pages Functions entry point.
 *
 * Uses Hono (lightweight FastAPI-like framework) for routing.
 * Handles all /api/* endpoints.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { handle } from 'hono/cloudflare-pages';

import { AuthUser, UserRole, extractUserFromInitData, createAccessToken, getAuthUserFromRequest, requireAdmin, requireOwner } from './_utils/auth';
import { seedDemoData } from './_utils/seed';
import * as s from './_utils/services';

// ─── App Setup ─────────────────────────────────────────────────────────────

type Env = {
  Bindings: Record<string, string>;
};

const app = new Hono<Env>();

// CORS middleware
app.use('*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', version: '1.0.0', routers: ['auth', 'courses', 'students', 'attendance', 'payments', 'achievements', 'dashboard', 'lessons'] });
});

// ─── Auth Middleware ───────────────────────────────────────────────────────

async function authMiddleware(c: any, next: any) {
  const user = await getAuthUserFromRequest(c.req.raw);
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  c.set('user', user);
  await next();
}

async function adminMiddleware(c: any, next: any) {
  const user: AuthUser = c.get('user');
  if (!user || !user.isAdmin()) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  await next();
}

async function ownerMiddleware(c: any, next: any) {
  const user: AuthUser = c.get('user');
  if (!user) {
    throw new HTTPException(403, { message: 'Only owner can access' });
  }
  // Check Telegram ID against OWNER_TELEGRAM_ID env var
  const ownerId = parseInt(getEnv('OWNER_TELEGRAM_ID', '0'), 10);
  if (user.telegramId !== ownerId) {
    throw new HTTPException(403, { message: 'Only owner can access' });
  }
  await next();
}

// Helper to get env vars in Cloudflare Pages context
function getEnv(key: string, defaultValue: string = ''): string {
  return (typeof process !== 'undefined' && (process as any).env?.[key]) || defaultValue;
}

// ─── Auth Routes ───────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const initData = body.init_data;
  if (!initData) {
    throw new HTTPException(400, { message: 'init_data is required' });
  }

  const telegramUser = await extractUserFromInitData(initData);
  if (!telegramUser) {
    throw new HTTPException(401, { message: 'Invalid Telegram authentication data' });
  }

  const user = s.findOrCreateUser(telegramUser);
  if (!user) {
    throw new HTTPException(500, { message: 'Failed to create or retrieve user' });
  }

  let role = UserRole.USER;
  if (Object.values(UserRole).includes(user.role)) {
    role = user.role as UserRole;
  }

  const accessToken = await createAccessToken(parseInt(user.telegram_id || '0', 10), role);

  return c.json({
    access_token: accessToken,
    token_type: 'bearer',
    user: {
      id: String(user.id || ''),
      telegram_id: String(user.telegram_id || ''),
      first_name: user.first_name || '',
      last_name: user.last_name || null,
      username: user.username || null,
      photo_url: user.photo_url || null,
      role: role,
      is_active: user.is_active !== 'false',
    },
  });
});

app.get('/api/auth/me', authMiddleware, async (c) => {
  const user: AuthUser = c.get('user');
  const dbUser = s.getUserByTelegramId(user.telegramId);
  return c.json({
    id: dbUser?.id ? String(dbUser.id) : '',
    telegram_id: String(user.telegramId),
    first_name: dbUser?.first_name || '',
    last_name: dbUser?.last_name || null,
    username: dbUser?.username || null,
    photo_url: dbUser?.photo_url || null,
    role: user.role,
    is_active: dbUser?.is_active !== 'false',
  });
});

app.get('/api/auth/admin/users', authMiddleware, adminMiddleware, async (c) => {
  const users = s.listAllUsers();
  return c.json({ users });
});

app.put('/api/auth/admin/users/:telegramId/role', authMiddleware, adminMiddleware, async (c) => {
  const telegramId = parseInt(c.req.param('telegramId'), 10);
  const body = await c.req.json();
  const success = s.updateUserRole(telegramId, body.role);
  if (!success) {
    throw new HTTPException(404, { message: 'User not found' });
  }
  return c.json({ status: 'ok', telegram_id: telegramId, role: body.role });
});

// ─── Course Routes ─────────────────────────────────────────────────────────

app.get('/api/courses', authMiddleware, async (c) => {
  const courses = s.listCourses();
  return c.json({ courses });
});

app.get('/api/courses/:courseId', authMiddleware, async (c) => {
  const course = s.getCourse(c.req.param('courseId'));
  if (!course) throw new HTTPException(404, { message: 'Course not found' });
  return c.json(course);
});

app.post('/api/courses', authMiddleware, async (c) => {
  const body = await c.req.json();
  const user: AuthUser = c.get('user');
  body.teacher_id = user.telegramId;
  const result = s.createCourse(body);
  if (!result) throw new HTTPException(500, { message: 'Failed to create course' });
  return c.json(result, { status: 201 });
});

app.put('/api/courses/:courseId', authMiddleware, async (c) => {
  const body = await c.req.json();
  const success = s.updateCourse(c.req.param('courseId'), body);
  if (!success) throw new HTTPException(404, { message: 'Course not found' });
  return c.json({ status: 'ok' });
});

app.delete('/api/courses/:courseId', authMiddleware, async (c) => {
  const success = s.deleteCourse(c.req.param('courseId'));
  if (!success) throw new HTTPException(404, { message: 'Course not found' });
  return c.json({ status: 'ok' });
});

app.post('/api/courses/:courseId/enroll', authMiddleware, async (c) => {
  const body = await c.req.json();
  const success = s.enrollStudent(c.req.param('courseId'), body.student_id);
  if (!success) throw new HTTPException(404, { message: 'Course or student not found' });
  return c.json({ status: 'ok' });
});

app.delete('/api/courses/:courseId/enroll/:studentId', authMiddleware, async (c) => {
  const success = s.unenrollStudent(c.req.param('courseId'), c.req.param('studentId'));
  if (!success) throw new HTTPException(404, { message: 'Course or student not found' });
  return c.json({ status: 'ok' });
});

// ─── Student Routes ────────────────────────────────────────────────────────

app.get('/api/students', authMiddleware, async (c) => {
  const courseId = c.req.query('course_id');
  const search = c.req.query('search');
  let students;
  if (search) {
    students = s.searchStudents(search);
  } else {
    students = s.listStudents(courseId);
  }
  return c.json({ students });
});

app.get('/api/students/:studentId', authMiddleware, async (c) => {
  const student = s.getStudent(c.req.param('studentId'));
  if (!student) throw new HTTPException(404, { message: 'Student not found' });
  return c.json(student);
});

app.get('/api/students/:studentId/profile', authMiddleware, async (c) => {
  const profile = s.getStudentProfile(c.req.param('studentId'));
  if (!profile) throw new HTTPException(404, { message: 'Student not found' });
  return c.json(profile);
});

app.post('/api/students', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const result = s.createStudent(body);
  if (!result) throw new HTTPException(500, { message: 'Failed to create student' });
  return c.json(result, { status: 201 });
});

app.put('/api/students/:studentId', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const success = s.updateStudent(c.req.param('studentId'), body);
  if (!success) throw new HTTPException(404, { message: 'Student not found' });
  return c.json({ status: 'ok' });
});

app.delete('/api/students/:studentId', authMiddleware, adminMiddleware, async (c) => {
  const success = s.deleteStudent(c.req.param('studentId'));
  if (!success) throw new HTTPException(404, { message: 'Student not found' });
  return c.json({ status: 'ok' });
});

// ─── Attendance Routes ─────────────────────────────────────────────────────

app.get('/api/attendance/today', authMiddleware, async (c) => {
  const today = new Date().toISOString().split('T')[0];
  const records = s.listAttendance(undefined, today);
  return c.json({ attendance: records, date: today });
});

app.get('/api/attendance', authMiddleware, async (c) => {
  const courseId = c.req.query('course_id');
  const date = c.req.query('date');
  const records = s.listAttendance(courseId, date);
  return c.json({ attendance: records });
});

app.get('/api/attendance/student/:studentId', authMiddleware, async (c) => {
  const records = s.getStudentAttendance(c.req.param('studentId'));
  return c.json({ attendance: records });
});

app.post('/api/attendance', authMiddleware, async (c) => {
  const body = await c.req.json();
  const user: AuthUser = c.get('user');
  body.marked_by = user.telegramId;
  const result = s.markAttendance(body);
  if (!result) throw new HTTPException(500, { message: 'Failed to mark attendance' });
  return c.json(result, { status: 201 });
});

app.put('/api/attendance/:attendanceId', authMiddleware, async (c) => {
  const body = await c.req.json();
  const success = s.updateAttendance(c.req.param('attendanceId'), body);
  if (!success) throw new HTTPException(404, { message: 'Attendance not found' });
  return c.json({ status: 'ok' });
});

// ─── Payment Routes ────────────────────────────────────────────────────────

app.get('/api/payments', authMiddleware, async (c) => {
  const payments = s.listPayments();
  return c.json({ payments });
});

app.get('/api/payments/student/:studentId', authMiddleware, async (c) => {
  const payments = s.getStudentPayments(c.req.param('studentId'));
  return c.json({ payments });
});

app.post('/api/payments', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const result = s.createPayment(body);
  if (!result) throw new HTTPException(500, { message: 'Failed to create payment' });
  return c.json(result, { status: 201 });
});

app.put('/api/payments/:paymentId', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const success = s.updatePayment(c.req.param('paymentId'), body);
  if (!success) throw new HTTPException(404, { message: 'Payment not found' });
  return c.json({ status: 'ok' });
});

// ─── Achievement Routes ────────────────────────────────────────────────────

app.get('/api/achievements', authMiddleware, async (c) => {
  const studentId = c.req.query('student_id');
  const achievements = s.listAchievements(studentId);
  return c.json({ achievements });
});

app.post('/api/achievements', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json();
  const result = s.createAchievement(body);
  if (!result) throw new HTTPException(500, { message: 'Failed to create achievement' });
  return c.json(result, { status: 201 });
});

app.delete('/api/achievements/:achievementId', authMiddleware, adminMiddleware, async (c) => {
  const success = s.deleteAchievement(c.req.param('achievementId'));
  if (!success) throw new HTTPException(404, { message: 'Achievement not found' });
  return c.json({ status: 'ok' });
});

// ─── Lesson Routes ─────────────────────────────────────────────────────────

app.get('/api/lessons/today', authMiddleware, async (c) => {
  const courses = s.listCourses();
  const lessons = s.ensureTodayLessons(courses);
  const allStudents = s.listStudents();
  const today = new Date().toISOString().split('T')[0];
  const allAttendance = s.listAttendance(undefined, today);
  const enriched = lessons.map((l) => s.enrichLessonWithAttendance(l, allStudents, allAttendance));
  return c.json({ lessons: enriched });
});

app.get('/api/lessons', authMiddleware, async (c) => {
  const date = c.req.query('date');
  const courseId = c.req.query('course_id');
  const lessons = s.listLessons(date, courseId);
  const allStudents = s.listStudents();
  const allAttendance = s.listAttendance(undefined, date);
  const enriched = lessons.map((l) => s.enrichLessonWithAttendance(l, allStudents, allAttendance));
  return c.json({ lessons: enriched });
});

app.get('/api/lessons/:lessonId', authMiddleware, async (c) => {
  const lesson = s.getLesson(c.req.param('lessonId'));
  if (!lesson) throw new HTTPException(404, { message: 'Lesson not found' });
  const allStudents = s.listStudents();
  const allAttendance = s.listAttendance(undefined, lesson.date);
  const enriched = s.enrichLessonWithAttendance(lesson, allStudents, allAttendance);
  return c.json(enriched);
});

app.post('/api/lessons/ensure', authMiddleware, async (c) => {
  const body = await c.req.json();
  let lesson;
  if (body.course_id) {
    const course = s.getCourse(body.course_id);
    if (!course) throw new HTTPException(404, { message: 'Course not found' });
    lesson = s.ensureLessonForCourse(course, body.date);
  } else {
    lesson = s.createLesson(body);
  }
  if (!lesson) throw new HTTPException(500, { message: 'Failed to create lesson' });
  const allStudents = s.listStudents();
  const allAttendance = s.listAttendance(undefined, lesson.date);
  return c.json(s.enrichLessonWithAttendance(lesson, allStudents, allAttendance));
});

app.post('/api/lessons', authMiddleware, async (c) => {
  const body = await c.req.json();
  const result = s.createLesson(body);
  if (!result) throw new HTTPException(500, { message: 'Failed to create lesson' });
  const allStudents = s.listStudents();
  const allAttendance = s.listAttendance(undefined, result.date);
  return c.json(s.enrichLessonWithAttendance(result, allStudents, allAttendance), { status: 201 });
});

app.put('/api/lessons/:lessonId', authMiddleware, async (c) => {
  const body = await c.req.json();
  const success = s.updateLesson(c.req.param('lessonId'), body);
  if (!success) throw new HTTPException(404, { message: 'Lesson not found' });
  return c.json({ status: 'ok' });
});

app.delete('/api/lessons/:lessonId', authMiddleware, async (c) => {
  const success = s.deleteLesson(c.req.param('lessonId'));
  if (!success) throw new HTTPException(404, { message: 'Lesson not found' });
  return c.json({ status: 'ok' });
});

// ─── Inbox Route ───────────────────────────────────────────────────────────

app.get('/api/inbox', authMiddleware, async (c) => {
  const inbox = s.getInbox();
  return c.json(inbox);
});

// ─── Dashboard Route ───────────────────────────────────────────────────────

app.get('/api/dashboard', authMiddleware, async (c) => {
  const dashboard = s.getDashboard();
  return c.json(dashboard);
});

// ─── System Routes ─────────────────────────────────────────────────────────

app.get('/api/system/stats', authMiddleware, ownerMiddleware, async (c) => {
  const stats = s.getSystemStats();
  return c.json(stats);
});

// ─── Error Handler ─────────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ─── Seed demo data on startup (for in-memory mode) ──────────────────────
// This runs when the module is first loaded in the Workers runtime.

seedDemoData();

// ─── Export for Cloudflare Pages ──────────────────────────────────────────
export const onRequest = handle(app);
