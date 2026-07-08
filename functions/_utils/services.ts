/**
 * All business logic services.
 * Ported from backend/app/services/*.py
 */

import { store } from './store';
import {
  COURSES_HEADERS, STUDENTS_HEADERS, ATTENDANCE_HEADERS,
  PAYMENTS_HEADERS, ACHIEVEMENTS_HEADERS, LESSONS_HEADERS, USERS_HEADERS,
} from './seed';
import type { Course, Student, Attendance, Payment, Lesson, EnrichedLesson } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseIds(idsStr: string | undefined): string[] {
  if (!idsStr) return [];
  return idsStr.split(',').map((x) => x.trim()).filter(Boolean);
}

function now(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getActive<T extends Record<string, any>>(items: T[]): T[] {
  return items.filter((i) => i.is_active !== 'false');
}

// ─── Course Service ──────────────────────────────────────────────────────

export function listCourses(): Course[] {
  try {
    return getActive(store.getAll('courses'));
  } catch {
    return [];
  }
}

export function getCourse(courseId: string): Course | null {
  try {
    return store.getById('courses', courseId);
  } catch {
    return null;
  }
}

export function createCourse(data: Record<string, any>): Course | null {
  try {
    const record = {
      id: data.id || '',
      title: data.title || '',
      description: data.description || '',
      days: data.days || '',
      time: data.time || '',
      price: String(data.price || 0),
      teacher_id: String(data.teacher_id || ''),
      color: data.color || '#6C5CE7',
      student_ids: data.student_ids || '',
      location: data.location || '',
      location_link: data.location_link || '',
      is_active: 'true',
      created_at: now(),
      monthly_price: data.monthly_price ? String(data.monthly_price) : '',
      lesson_price: data.lesson_price ? String(data.lesson_price) : '',
      lessons_per_week: data.lessons_per_week ? String(data.lessons_per_week) : '',
      payment_type: data.payment_type || 'monthly',
    };
    return store.create('courses', record, COURSES_HEADERS);
  } catch {
    return null;
  }
}

export function updateCourse(courseId: string, data: Record<string, any>): boolean {
  try {
    return store.update('courses', courseId, data);
  } catch {
    return false;
  }
}

export function deleteCourse(courseId: string): boolean {
  try {
    return store.delete('courses', courseId);
  } catch {
    return false;
  }
}

export function enrollStudent(courseId: string, studentId: string): boolean {
  const course = getCourse(courseId);
  const student = getStudent(studentId);
  if (!course || !student) return false;

  let courseOk = true;
  let studentOk = true;

  const currentStudentIds = parseIds(course.student_ids);
  if (!currentStudentIds.includes(studentId)) {
    currentStudentIds.push(studentId);
    courseOk = updateCourse(courseId, { student_ids: currentStudentIds.join(',') });
  }

  const currentCourseIds = parseIds(student.course_ids);
  if (!currentCourseIds.includes(courseId)) {
    currentCourseIds.push(courseId);
    studentOk = updateStudent(studentId, { course_ids: currentCourseIds.join(',') });
  }

  return courseOk && studentOk;
}

export function unenrollStudent(courseId: string, studentId: string): boolean {
  const course = getCourse(courseId);
  const student = getStudent(studentId);
  if (!course || !student) return false;

  let courseOk = true;
  let studentOk = true;

  const currentStudentIds = parseIds(course.student_ids);
  const idx = currentStudentIds.indexOf(studentId);
  if (idx !== -1) {
    currentStudentIds.splice(idx, 1);
    courseOk = updateCourse(courseId, { student_ids: currentStudentIds.join(',') });
  }

  const currentCourseIds = parseIds(student.course_ids);
  const idx2 = currentCourseIds.indexOf(courseId);
  if (idx2 !== -1) {
    currentCourseIds.splice(idx2, 1);
    studentOk = updateStudent(studentId, { course_ids: currentCourseIds.join(',') });
  }

  return courseOk && studentOk;
}

// ─── Student Service ─────────────────────────────────────────────────────

export function listStudents(courseId?: string): Student[] {
  try {
    const students = getActive(store.getAll('students'));
    if (courseId) {
      return students.filter((s) => parseIds(s.course_ids).includes(courseId));
    }
    return students;
  } catch {
    return [];
  }
}

export function getStudent(studentId: string): Student | null {
  try {
    return store.getById('students', studentId);
  } catch {
    return null;
  }
}

export function createStudent(data: Record<string, any>): Student | null {
  try {
    const record = {
      id: data.id || '',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      age: data.age ? String(data.age) : '',
      birth_date: data.birth_date || '',
      parent_contact: data.parent_contact || '',
      parent_name: data.parent_name || '',
      parent_relation: data.parent_relation || '',
      phone: data.phone || '',
      telegram: data.telegram || '',
      course_ids: normalizeCourseIds(data.course_ids || ''),
      start_date: data.start_date || '',
      photo_url: data.photo_url || '',
      is_active: 'true',
      created_at: now(),
    };
    return store.create('students', record, STUDENTS_HEADERS);
  } catch {
    return null;
  }
}

export function updateStudent(studentId: string, data: Record<string, any>): boolean {
  try {
    return store.update('students', studentId, data);
  } catch {
    return false;
  }
}

export function deleteStudent(studentId: string): boolean {
  try {
    return store.delete('students', studentId);
  } catch {
    return false;
  }
}

export function searchStudents(query: string): Student[] {
  try {
    const students = getActive(store.getAll('students'));
    if (!query) return students.slice(0, 20);
    const q = query.toLowerCase().trim();
    return students
      .filter((s) => {
        const first = (s.first_name || '').toLowerCase();
        const last = (s.last_name || '').toLowerCase();
        const full = `${first} ${last}`;
        return first.includes(q) || last.includes(q) || full.includes(q);
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

function normalizeCourseIds(courseIds: any): string {
  if (Array.isArray(courseIds)) {
    return courseIds.filter(Boolean).map((id) => String(id).trim()).join(',');
  }
  return String(courseIds || '');
}

// ─── Attendance Service ──────────────────────────────────────────────────

export function listAttendance(courseId?: string, date?: string): Attendance[] {
  try {
    let records = store.getAll('attendance');
    if (courseId) {
      records = records.filter((r) => r.course_id === courseId);
    }
    if (date) {
      records = records.filter((r) => r.date === date);
    }
    return records;
  } catch {
    return [];
  }
}

export function getStudentAttendance(studentId: string): Attendance[] {
  try {
    return store.find('attendance', { student_id: studentId });
  } catch {
    return [];
  }
}

export function markAttendance(data: Record<string, any>): Attendance | null {
  const studentId = data.student_id;
  const courseId = data.course_id;
  const date = data.date;
  const lessonId = data.lesson_id || '';

  if (!studentId) return null;
  if (!lessonId && !(courseId && date)) return null;

  try {
    // Upsert: check for existing record
    let existing: Attendance[] = [];
    if (lessonId) {
      existing = store.find('attendance', { student_id: studentId, lesson_id: lessonId });
    } else {
      existing = store.find('attendance', { student_id: studentId, course_id: courseId, date: date });
    }

    if (existing.length > 0) {
      const recordId = existing[0].id!;
      const updateData: Record<string, any> = {
        status: data.status || 'present',
        comment: data.comment || '',
        marked_by: String(data.marked_by || ''),
      };
      if (lessonId) updateData.lesson_id = lessonId;
      store.update('attendance', recordId, updateData);
      return store.getById('attendance', recordId);
    }

    // Create new
    const record = {
      id: data.id || '',
      lesson_id: lessonId,
      date: date || '',
      course_id: courseId || '',
      student_id: studentId,
      status: data.status || 'present',
      comment: data.comment || '',
      marked_by: String(data.marked_by || ''),
      created_at: now(),
    };
    return store.create('attendance', record, ATTENDANCE_HEADERS);
  } catch {
    return null;
  }
}

export function updateAttendance(attendanceId: string, data: Record<string, any>): boolean {
  try {
    return store.update('attendance', attendanceId, data);
  } catch {
    return false;
  }
}

export function listAttendanceByLesson(lessonId: string): Attendance[] {
  try {
    return store.find('attendance', { lesson_id: lessonId });
  } catch {
    return [];
  }
}

// ─── Payment Service ─────────────────────────────────────────────────────

export function listPayments(): Payment[] {
  try {
    const records = store.getAll('payments');
    records.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    return records;
  } catch {
    return [];
  }
}

export function getStudentPayments(studentId: string): Payment[] {
  try {
    const records = store.find('payments', { student_id: studentId });
    records.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    return records;
  } catch {
    return [];
  }
}

export function createPayment(data: Record<string, any>): Payment | null {
  try {
    const record = {
      id: data.id || '',
      student_id: data.student_id || '',
      course_id: data.course_id || '',
      amount: String(data.amount || 0),
      payment_date: data.payment_date || todayStr(),
      payment_type: data.payment_type || 'partial',
      comment: data.comment || '',
      created_at: now(),
    };
    return store.create('payments', record, PAYMENTS_HEADERS);
  } catch {
    return null;
  }
}

export function updatePayment(paymentId: string, data: Record<string, any>): boolean {
  try {
    return store.update('payments', paymentId, data);
  } catch {
    return false;
  }
}

// ─── Achievement Service ─────────────────────────────────────────────────

export function listAchievements(studentId?: string): any[] {
  try {
    const records = store.getAll('achievements');
    if (studentId) {
      return records.filter((a) => a.student_id === studentId);
    }
    return records;
  } catch {
    return [];
  }
}

export function createAchievement(data: Record<string, any>): any | null {
  try {
    const record = {
      id: data.id || '',
      student_id: data.student_id || '',
      title: data.title || '',
      icon: data.icon || '🏆',
      description: data.description || '',
      achieved_at: data.achieved_at || now(),
      created_at: now(),
    };
    return store.create('achievements', record, ACHIEVEMENTS_HEADERS);
  } catch {
    return null;
  }
}

export function deleteAchievement(achievementId: string): boolean {
  try {
    return store.delete('achievements', achievementId);
  } catch {
    return false;
  }
}

// ─── Lesson Service ──────────────────────────────────────────────────────

export function listLessons(date?: string, courseId?: string): Lesson[] {
  try {
    let lessons = getActive(store.getAll('lessons'));
    if (date) {
      lessons = lessons.filter((l) => l.date === date);
    }
    if (courseId) {
      lessons = lessons.filter((l) => l.course_id === courseId);
    }
    return lessons.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
  } catch {
    return [];
  }
}

export function getLesson(lessonId: string): Lesson | null {
  try {
    return store.getById('lessons', lessonId);
  } catch {
    return null;
  }
}

export function createLesson(data: Record<string, any>): Lesson | null {
  try {
    const record = {
      id: data.id || '',
      course_id: data.course_id || '',
      date: data.date || '',
      time: data.time || '',
      title: data.title || '',
      status: data.status || 'scheduled',
      rescheduled_to: data.rescheduled_to || '',
      homework: data.homework || '',
      location: data.location || '',
      location_link: data.location_link || '',
      note: data.note || '',
      is_active: 'true',
      created_at: now(),
    };
    return store.create('lessons', record, LESSONS_HEADERS);
  } catch {
    return null;
  }
}

export function updateLesson(lessonId: string, data: Record<string, any>): boolean {
  try {
    return store.update('lessons', lessonId, data);
  } catch {
    return false;
  }
}

export function deleteLesson(lessonId: string): boolean {
  try {
    return store.delete('lessons', lessonId);
  } catch {
    return false;
  }
}

export function ensureLessonForCourse(course: Course, targetDate: string): Lesson | null {
  try {
    const existing = store.find('lessons', { course_id: course.id!, date: targetDate });
    if (existing.length > 0) return existing[0];

    return createLesson({
      id: `lesson_${Date.now().toString(36)}`,
      course_id: course.id,
      date: targetDate,
      time: course.time,
      title: course.title,
      status: 'scheduled',
      location: course.location,
      location_link: course.location_link,
    });
  } catch {
    return null;
  }
}

export function ensureTodayLessons(courses: Course[]): Lesson[] {
  // NOTE: JS Date.getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
  // This is DIFFERENT from Python weekday() which has Monday=0
  const weekdayMap: Record<number, string> = {
    0: 'Вс', 1: 'Пн', 2: 'Вт', 3: 'Ср',
    4: 'Чт', 5: 'Пт', 6: 'Сб',
  };
  const todayWeekday = weekdayMap[new Date().getDay()];
  const today = todayStr();
  const lessons: Lesson[] = [];

  for (const course of courses) {
    if (!course.days) continue;
    const days = course.days.split(',').map((d) => d.trim());
    if (!days.includes(todayWeekday)) continue;

    const lesson = ensureLessonForCourse(course, today);
    if (lesson) lessons.push(lesson);
  }

  return lessons;
}

export function enrichLessonWithAttendance(
  lesson: Lesson,
  allStudents: Student[],
  attendanceRecords: Attendance[],
): EnrichedLesson {
  const courseId = lesson.course_id || '';
  const lessonId = lesson.id || '';
  const lessonDate = lesson.date || '';

  // Get course color
  const course = getCourse(courseId);
  const courseColor = course?.color || '#6C5CE7';

  // Students enrolled in the course
  const courseStudents = getCourseStudents(courseId, allStudents);

  // Attendance for this lesson
  const lessonAttendance = attendanceRecords.filter(
    (a) => a.lesson_id === lessonId || (a.course_id === courseId && a.date === lessonDate),
  );

  const attMap = new Map(lessonAttendance.map((a) => [a.student_id, a]));

  const present = courseStudents.filter((s) => attMap.get(s.id)?.status === 'present').length;
  const late = courseStudents.filter((s) => attMap.get(s.id)?.status === 'late').length;
  const absent = courseStudents.filter((s) => attMap.get(s.id)?.status === 'absent').length;
  const trial = courseStudents.filter((s) => attMap.get(s.id)?.status === 'trial').length;
  const unmarked = courseStudents.length - lessonAttendance.length;

  const unmarkedStudents = courseStudents
    .filter((s) => !attMap.has(s.id))
    .map((s) => ({ id: s.id, first_name: s.first_name, last_name: s.last_name }));

  return {
    ...lesson,
    color: courseColor,
    student_count: courseStudents.length,
    attendance_stats: { present, late, absent, trial, unmarked, total_marked: lessonAttendance.length },
    unmarked_students: unmarkedStudents,
  };
}

function getCourseStudents(courseId: string, allStudents: Student[]): Student[] {
  const course = getCourse(courseId);
  if (!course) return [];
  const enrolledIds = parseIds(course.student_ids);
  return allStudents.filter(
    (s) => s.id && enrolledIds.includes(s.id) && s.is_active !== 'false',
  );
}

// ─── User Service ────────────────────────────────────────────────────────

export function findOrCreateUser(telegramData: Record<string, any>): any | null {
  const telegramId = telegramData.telegram_id;
  if (!telegramId) return null;

  try {
    const existing = store.find('users', { telegram_id: String(telegramId) });
    if (existing.length > 0) return existing[0];

    // Check if this user is the system owner
    const ownerId = typeof process !== 'undefined' ? parseInt(String((process as any).env?.OWNER_TELEGRAM_ID || '0'), 10) : 0;
    const role = (ownerId > 0 && String(telegramId) === String(ownerId)) ? 'owner' : 'user';

    const newUser = {
      id: String(telegramId),
      telegram_id: String(telegramId),
      first_name: telegramData.first_name || '',
      last_name: telegramData.last_name || '',
      username: telegramData.username || '',
      photo_url: telegramData.photo_url || '',
      role: role,
      is_active: 'true',
      created_at: now(),
    };
    return store.create('users', newUser, USERS_HEADERS);
  } catch {
    return null;
  }
}

export function getUserByTelegramId(telegramId: number): any | null {
  try {
    const users = store.find('users', { telegram_id: String(telegramId) });
    return users.length > 0 ? users[0] : null;
  } catch {
    return null;
  }
}

export function listAllUsers(): any[] {
  try {
    return store.getAll('users');
  } catch {
    return [];
  }
}

export function updateUserRole(telegramId: number, newRole: string): boolean {
  try {
    return store.update('users', String(telegramId), { role: newRole }, 'telegram_id');
  } catch {
    return false;
  }
}

// ─── Student Profile Service ────────────────────────────────────────────

export function getStudentProfile(studentId: string): any | null {
  const student = getStudent(studentId);
  if (!student) return null;

  const enrolledCourseIds = parseIds(student.course_ids);
  const allCourses = listCourses();
  const enrolledCourses = allCourses.filter((c) => c.id && enrolledCourseIds.includes(c.id));

  const payments = getStudentPayments(studentId);
  const achievements = listAchievements(studentId);
  const attendanceRecords = getStudentAttendance(studentId);

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

  // Attendance stats
  const total = attendanceRecords.length;
  const present = attendanceRecords.filter((r) => r.status === 'present').length;
  const late = attendanceRecords.filter((r) => r.status === 'late').length;
  const absent = attendanceRecords.filter((r) => r.status === 'absent').length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const datedVisits = attendanceRecords
    .filter((r) => r.date && ['present', 'late'].includes(r.status || ''))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const lastVisit = datedVisits.length > 0 ? datedVisits[0].date : '';

  const uniqueDates = new Set(attendanceRecords.map((r) => r.date));
  const history = [...attendanceRecords].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    student,
    courses: enrolledCourses,
    payments,
    total_paid: totalPaid,
    achievements,
    attendance: {
      total_records: total,
      total_lessons: uniqueDates.size,
      present,
      late,
      absent,
      marked: total,
      unmarked: 0,
      attendance_rate: attendanceRate,
      last_visit: lastVisit,
      history,
    },
  };
}

// ─── Dashboard Service ───────────────────────────────────────────────────

export function getDashboard(): any {
  const today = todayStr();
  const courses = listCourses();
  const allStudents = listStudents();
  const allPayments = listPayments();

  const todayLessons = ensureTodayLessons(courses);
  const todayAttendance = listAttendance(undefined, today);

  const lessonsWithStats = todayLessons.map((l) =>
    enrichLessonWithAttendance(l, allStudents, todayAttendance),
  );

  // Next lesson
  const now = new Date();
  const currentTimeStr = now.toTimeString().slice(0, 5);

  let nextLesson: any = null;
  for (const lesson of todayLessons) {
    const lessonTime = lesson.time || '';
    if (lessonTime > currentTimeStr) {
      const course = courses.find((c) => c.id === lesson.course_id);
      nextLesson = {
        id: lesson.id,
        course_id: lesson.course_id,
        title: lesson.title,
        time: lessonTime,
        color: course?.color || '#6C5CE7',
        location: lesson.location || course?.location || '',
        location_link: lesson.location_link || course?.location_link || '',
      };
      break;
    }
  }

  if (!nextLesson && todayLessons.length > 0) {
    const last = todayLessons[todayLessons.length - 1];
    const course = courses.find((c) => c.id === last.course_id);
    const stats = lessonsWithStats.find((ls) => ls.id === last.id)?.attendance_stats;
    const unmarked = stats?.unmarked || 0;
    nextLesson = {
      id: last.id,
      course_id: last.course_id,
      title: last.title,
      time: last.time,
      color: course?.color || '#6C5CE7',
      location: last.location || course?.location || '',
      location_link: last.location_link || course?.location_link || '',
      status: unmarked > 0 ? 'current' : 'completed',
    };
  }

  // Global attendance
  const allTodayStudentIds = new Set<string>();
  for (const lesson of todayLessons) {
    const courseId = lesson.course_id || '';
    const course = getCourse(courseId);
    if (course) {
      const ids = parseIds(course.student_ids);
      ids.forEach((id) => allTodayStudentIds.add(id));
    }
  }

  const todayRecords = new Map(todayAttendance.map((a) => [a.student_id, a.status]));
  const globalPresent = [...allTodayStudentIds].filter((sid) => todayRecords.get(sid) === 'present').length;
  const globalLate = [...allTodayStudentIds].filter((sid) => todayRecords.get(sid) === 'late').length;
  const globalAbsent = [...allTodayStudentIds].filter((sid) => todayRecords.get(sid) === 'absent').length;
  const globalUnmarked = allTodayStudentIds.size - todayRecords.size;

  const uniqueStudents = new Set(allStudents.filter((s) => s.is_active !== 'false').map((s) => s.id));

  return {
    today: {
      date: today,
      lessons: lessonsWithStats,
      next_lesson: nextLesson,
      total_lessons: todayLessons.length,
      total_students: allTodayStudentIds.size,
      present: globalPresent,
      late: globalLate,
      absent: globalAbsent,
      unmarked: globalUnmarked,
      pending_payments: 0,
      overdue_payments: 0,
      payment_alerts: [],
    },
    summary: {
      total_courses: courses.length,
      total_students: uniqueStudents.size,
      total_payments: allPayments.length,
    },
  };
}

// ─── Inbox Service ───────────────────────────────────────────────────────

export function getInbox(): any {
  const today = todayStr();
  const nowTime = new Date().toTimeString().slice(0, 5);

  const courses = listCourses();
  const allStudents = listStudents();
  const allPayments = listPayments();
  const todayAttendance = listAttendance(undefined, today);
  const todayLessons = ensureTodayLessons(courses);

  // Pre-load all attendance grouped by student
  const allAttendance = listAttendance();
  const studentAttendanceMap = new Map<string, any[]>();
  for (const a of allAttendance) {
    const sid = a.student_id || '';
    if (!studentAttendanceMap.has(sid)) {
      studentAttendanceMap.set(sid, []);
    }
    studentAttendanceMap.get(sid)!.push(a);
  }

  const lessonItems: any[] = [];
  const paymentItems: any[] = [];
  const trialItems: any[] = [];
  const attentionItems: any[] = [];

  // ── 1. TODAY'S LESSONS ──
  for (const lesson of todayLessons) {
    const enriched = enrichLessonWithAttendance(lesson, allStudents, todayAttendance);
    const stats = enriched.attendance_stats || {};
    const unmarked = stats.unmarked || 0;
    const lessonTime = lesson.time || '';

    let priority = 'low';
    if (unmarked > 0) {
      priority = lessonTime && lessonTime <= nowTime ? 'high' : 'medium';
    }

    const trialCount = stats.trial || 0;
    const title = lesson.title || 'Занятие';
    const timeStr = lessonTime;

    const subtitleParts: string[] = [];
    if (unmarked > 0) subtitleParts.push(`${unmarked} не отмечены`);
    else subtitleParts.push('Все отмечены');
    if (trialCount > 0) subtitleParts.push(`🌟 ${trialCount} пробных`);
    const subtitle = subtitleParts.join(' · ');
    const actionLabel = unmarked > 0 ? `Отметить ${unmarked}` : 'Все отмечены ✓';

    lessonItems.push({
      id: `lesson_${lesson.id || ''}`,
      title: timeStr ? `${timeStr} ${title}` : title,
      subtitle,
      priority,
      action_label: actionLabel,
      action_url: `/lesson/${lesson.id || ''}`,
      lesson_id: lesson.id,
    });
  }

  // ── 2. TRIAL STUDENTS ──
  const trialIdsToday = new Set(
    todayAttendance.filter((a) => a.status === 'trial').map((a) => a.student_id),
  );
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

  for (const s of allStudents) {
    const sid = s.id || '';
    if (trialIdsToday.has(sid)) continue;
    const created = (s.created_at || '').split('T')[0];
    if (created && created >= threeDaysAgo) {
      const sAtt = studentAttendanceMap.get(sid) || [];
      if (sAtt.length === 0 || sAtt.every((a) => a.status === 'trial')) {
        const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
        trialItems.push({
          id: `trial_${sid}`,
          title: name || sid,
          subtitle: 'Новый ученик · пробное',
          priority: 'medium',
          action_label: 'Открыть карточку',
          action_url: `/student/${sid}`,
          student_id: sid,
        });
      }
    }
  }

  // ── 3. PAYMENT ISSUES ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  for (const s of allStudents) {
    const sid = s.id || '';
    const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
    if (s.is_active === 'false') continue;

    const studentPayments = allPayments.filter((p) => p.student_id === sid);

    if (studentPayments.length === 0) {
      paymentItems.push({
        id: `payment_no_${sid}`,
        title: name || sid,
        subtitle: 'Нет оплат · проверьте',
        priority: 'high',
        action_label: 'Добавить платеж',
        action_url: `/student/${sid}`,
        student_id: sid,
      });
      continue;
    }

    const sorted = [...studentPayments].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    const lastDate = sorted[0].payment_date || '';

    if (lastDate < thirtyDaysAgo) {
      paymentItems.push({
        id: `payment_overdue_${sid}`,
        title: name || sid,
        subtitle: `Просрочена · последний платёж ${lastDate}`,
        priority: 'high',
        action_label: 'Добавить платеж',
        action_url: `/student/${sid}`,
        student_id: sid,
      });
    } else if (lastDate < new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0]) {
      const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
      paymentItems.push({
        id: `payment_soon_${sid}`,
        title: name || sid,
        subtitle: `Скоро · ${daysSince} дней без оплаты`,
        priority: 'low',
        action_label: 'Проверить',
        action_url: `/student/${sid}`,
        student_id: sid,
      });
    }
  }

  // ── 4. LONG-ABSENT STUDENTS ──
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

  for (const s of allStudents) {
    const sid = s.id || '';
    const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
    if (s.is_active === 'false') continue;

    const sAtt = studentAttendanceMap.get(sid) || [];
    if (sAtt.length === 0) continue;

    const visits = sAtt.filter((a) => a.status === 'present' || a.status === 'late');
    if (visits.length === 0) continue;

    const lastVisit = visits.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0].date || '';
    if (lastVisit < fourteenDaysAgo) {
      const daysAbsent = Math.floor((Date.now() - new Date(lastVisit).getTime()) / 86400000);
      attentionItems.push({
        id: `absent_${sid}`,
        title: name || sid,
        subtitle: `Не был ${daysAbsent} дней · последний визит ${lastVisit}`,
        priority: 'medium',
        action_label: 'Связаться',
        action_url: `/student/${sid}`,
        student_id: sid,
      });
    }
  }

  // ── Sort within groups ──
  const priorityValue: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sortByPriority = (a: any, b: any) => (priorityValue[a.priority] || 99) - (priorityValue[b.priority] || 99);
  lessonItems.sort(sortByPriority);
  paymentItems.sort(sortByPriority);
  trialItems.sort(sortByPriority);
  attentionItems.sort(sortByPriority);

  // ── Build groups ──
  const groups: any[] = [];
  if (lessonItems.length > 0) {
    groups.push({ key: 'lessons', label: 'Занятия', icon: '📚', items: lessonItems });
  }
  if (paymentItems.length > 0) {
    groups.push({ key: 'payments', label: 'Оплаты', icon: '💰', items: paymentItems });
  }
  if (trialItems.length > 0) {
    groups.push({ key: 'trials', label: 'Пробные', icon: '🌟', items: trialItems });
  }
  if (attentionItems.length > 0) {
    groups.push({ key: 'attention', label: 'Требуют внимания', icon: '⚠', items: attentionItems });
  }
  groups.push({
    key: 'actions',
    label: 'Быстрые действия',
    icon: '⚡',
    items: [
      {
        id: 'action_new_student',
        title: '➕ Новый ученик',
        subtitle: 'Добавить и записать на курс',
        priority: 'low',
        action_label: 'Добавить',
        action_url: '/admin/students',
      },
      {
        id: 'action_new_lesson',
        title: '📅 Разовое занятие',
        subtitle: 'Отработка, открытый урок или праздник',
        priority: 'low',
        action_label: 'Создать',
        action_url: '/admin/courses',
      },
    ],
  });

  const allItems = [...lessonItems, ...paymentItems, ...trialItems, ...attentionItems];
  const highCount = allItems.filter((i) => i.priority === 'high').length;

  return {
    date: today,
    groups,
    stats: { total: allItems.length, high_priority: highCount },
  };
}

// ─── System Stats ────────────────────────────────────────────────────────

export function getSystemStats(): any {
  const courses = listCourses();
  const students = listStudents();
  const allAttendance = listAttendance();
  const payments = listPayments();
  const allUsers = listAllUsers();

  const totalUsers = allUsers.length;
  const active7d = allUsers.filter((u) => u.is_active !== 'false').length;
  const teachers = allUsers.filter((u) => ['admin', 'owner'].includes(u.role || '')).length;

  const lessonDates = new Set(allAttendance.filter((a) => a.date).map((a) => a.date));
  const totalLessons = lessonDates.size;

  const paidAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

  const recentUsers = [...allUsers]
    .filter((u) => u.created_at)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 10)
    .map((u) => ({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      role: u.role || 'user',
      created_at: u.created_at || '',
    }));

  return {
    users_total: totalUsers,
    users_active_7d: active7d,
    courses_total: courses.length,
    students_total: students.length,
    teachers_total: teachers,
    lessons_total: totalLessons,
    paid_amount: paidAmount,
    google_sheets: false,
    api_status: 'online',
    backend_status: 'online',
    recent_users: recentUsers,
  };
}
