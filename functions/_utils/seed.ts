/**
 * Demo data seeder — creates sample data for development/testing.
 * Mirrors the Python _seed_demo_data() from backend/app/main.py
 */

import { store } from './store';

const COURSES_HEADERS = [
  'id', 'title', 'description', 'days', 'time',
  'price', 'teacher_id', 'color', 'student_ids',
  'location', 'location_link',
  'is_active', 'created_at',
  'monthly_price', 'lesson_price', 'lessons_per_week', 'payment_type',
];

const STUDENTS_HEADERS = [
  'id', 'first_name', 'last_name', 'age', 'birth_date',
  'parent_contact', 'parent_name', 'parent_relation', 'phone', 'telegram',
  'course_ids', 'start_date', 'photo_url', 'is_active', 'created_at',
];

const ATTENDANCE_HEADERS = [
  'id', 'lesson_id', 'date', 'course_id', 'student_id',
  'status', 'comment', 'marked_by', 'created_at',
];

const PAYMENTS_HEADERS = [
  'id', 'student_id', 'course_id', 'amount',
  'payment_date', 'payment_type',
  'comment', 'created_at',
];

const ACHIEVEMENTS_HEADERS = [
  'id', 'student_id', 'title', 'icon',
  'description', 'achieved_at', 'created_at',
];

const LESSONS_HEADERS = [
  'id', 'course_id', 'date', 'time', 'title',
  'status', 'rescheduled_to', 'homework', 'location', 'location_link',
  'note', 'is_active', 'created_at',
];

const USERS_HEADERS = [
  'id', 'telegram_id', 'first_name', 'last_name',
  'username', 'photo_url', 'role', 'is_active', 'created_at',
];

export function seedDemoData(): void {
  const now = new Date().toISOString();

  // Clear existing data
  store.clear();

  // ── Courses ─────────────────────────────────────────────────────────────
  const courses = [
    {
      id: 'course_1', title: 'Робототехника Junior',
      description: 'Основы робототехники для начинающих',
      days: 'Пн,Ср', time: '17:00', price: '40000',
      teacher_id: '0', color: '#6C5CE7',
      student_ids: 'student_1,student_2',
      is_active: 'true', created_at: now,
      monthly_price: '40000', lesson_price: '5000',
      lessons_per_week: '2', payment_type: 'monthly',
    },
    {
      id: 'course_2', title: 'Scratch',
      description: 'Визуальное программирование',
      days: 'Вт,Чт', time: '18:30', price: '25000',
      teacher_id: '0', color: '#00B894',
      student_ids: 'student_3',
      is_active: 'true', created_at: now,
      monthly_price: '25000', lesson_price: '3500',
      lessons_per_week: '2', payment_type: 'monthly',
    },
    {
      id: 'course_3', title: 'Python',
      description: 'Программирование на Python',
      days: 'Пн,Ср,Пт', time: '19:00', price: '8000',
      teacher_id: '0', color: '#FD79A8',
      student_ids: 'student_1,student_3',
      is_active: 'true', created_at: now,
      monthly_price: '35000', lesson_price: '8000',
      lessons_per_week: '3', payment_type: 'monthly',
    },
  ];
  for (const c of courses) {
    store.create('courses', c, COURSES_HEADERS);
  }

  // ── Students ────────────────────────────────────────────────────────────
  const students = [
    {
      id: 'student_1', first_name: 'Иван', last_name: 'Петров',
      age: '10', birth_date: '2015-03-15',
      parent_contact: '+7 999 111-11-11', parent_name: 'Ольга Петрова', parent_relation: 'Мама',
      phone: '', telegram: '@ivan_p',
      course_ids: 'course_1,course_3', start_date: '2025-01-15',
      photo_url: '', is_active: 'true', created_at: now,
    },
    {
      id: 'student_2', first_name: 'Анна', last_name: 'Смирнова',
      age: '9', birth_date: '2016-07-22',
      parent_contact: '+7 999 222-22-22', parent_name: 'Ирина Смирнова', parent_relation: 'Мама',
      phone: '', telegram: '@anna_s',
      course_ids: 'course_1', start_date: '2025-01-15',
      photo_url: '', is_active: 'true', created_at: now,
    },
    {
      id: 'student_3', first_name: 'Михаил', last_name: 'Кузнецов',
      age: '11', birth_date: '2014-01-10',
      parent_contact: '+7 999 333-33-33', parent_name: 'Сергей Кузнецов', parent_relation: 'Папа',
      phone: '', telegram: '@misha_k',
      course_ids: 'course_2,course_3', start_date: '2025-01-20',
      photo_url: '', is_active: 'true', created_at: now,
    },
    {
      id: 'student_4', first_name: 'Екатерина', last_name: 'Волкова',
      age: '12', birth_date: '2013-05-18',
      parent_contact: '+7 999 444-44-44', parent_name: 'Наталья Волкова', parent_relation: 'Бабушка',
      phone: '', telegram: '@katya_v',
      course_ids: 'course_2', start_date: '2025-02-01',
      photo_url: '', is_active: 'true', created_at: now,
    },
  ];
  for (const s of students) {
    store.create('students', s, STUDENTS_HEADERS);
  }

  // ── Attendance ──────────────────────────────────────────────────────────
  const today = now.split('T')[0];
  const attendance = [
    {
      id: 'att_1', lesson_id: '', date: today, course_id: 'course_1',
      student_id: 'student_1', status: 'present',
      comment: '', marked_by: '0', created_at: now,
    },
    {
      id: 'att_2', lesson_id: '', date: today, course_id: 'course_1',
      student_id: 'student_2', status: 'absent',
      comment: 'Болеет', marked_by: '0', created_at: now,
    },
    {
      id: 'att_3', lesson_id: '', date: today, course_id: 'course_3',
      student_id: 'student_1', status: 'present',
      comment: '', marked_by: '0', created_at: now,
    },
  ];
  for (const a of attendance) {
    store.create('attendance', a, ATTENDANCE_HEADERS);
  }

  // ── Payments ────────────────────────────────────────────────────────────
  const payments = [
    {
      id: 'pay_1', student_id: 'student_1', course_id: 'course_1',
      amount: '40000', payment_date: '2026-06-01',
      payment_type: 'monthly',
      comment: 'Оплата за июнь', created_at: now,
    },
    {
      id: 'pay_2', student_id: 'student_1', course_id: 'course_1',
      amount: '20000', payment_date: '2026-07-01',
      payment_type: 'partial',
      comment: 'Частичная оплата за июль', created_at: now,
    },
    {
      id: 'pay_3', student_id: 'student_2', course_id: 'course_1',
      amount: '40000', payment_date: '2026-07-05',
      payment_type: 'monthly',
      comment: 'Оплата за июль', created_at: now,
    },
    {
      id: 'pay_4', student_id: 'student_3', course_id: 'course_2',
      amount: '25000', payment_date: '2026-06-10',
      payment_type: 'monthly',
      comment: '', created_at: now,
    },
  ];
  for (const p of payments) {
    store.create('payments', p, PAYMENTS_HEADERS);
  }

  // ── Achievements ────────────────────────────────────────────────────────
  const achievements = [
    {
      id: 'ach_1', student_id: 'student_1',
      title: 'Отличник недели', icon: '🌟',
      description: '100% посещаемость за неделю',
      achieved_at: now, created_at: now,
    },
    {
      id: 'ach_2', student_id: 'student_3',
      title: 'Лучший проект', icon: '🏆',
      description: 'Лучший проект по Scratch',
      achieved_at: now, created_at: now,
    },
  ];
  for (const a of achievements) {
    store.create('achievements', a, ACHIEVEMENTS_HEADERS);
  }
}

export {
  COURSES_HEADERS,
  STUDENTS_HEADERS,
  ATTENDANCE_HEADERS,
  PAYMENTS_HEADERS,
  ACHIEVEMENTS_HEADERS,
  LESSONS_HEADERS,
  USERS_HEADERS,
};
