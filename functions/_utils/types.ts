/**
 * Shared type definitions for EduPulse Functions
 * Mirrors the Python Pydantic models and shared/types/*.ts
 */

// ─── Enums ────────────────────────────────────────────────────────────────

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  TESTER = 'tester',
  USER = 'user',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late',
  EXCUSED = 'excused',
  TRIAL = 'trial',
}

export enum PaymentType {
  MONTHLY = 'monthly',
  SINGLE = 'single',
  PARTIAL = 'partial',
  FULL = 'full',
}

export enum LessonStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

// ─── Core Models ──────────────────────────────────────────────────────────

export interface User {
  id?: string;
  telegram_id?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  role?: string;
  is_active?: string;
  created_at?: string;
}

export interface Course {
  id?: string;
  title?: string;
  description?: string;
  days?: string;
  time?: string;
  price?: string;
  teacher_id?: string;
  color?: string;
  student_ids?: string;
  location?: string;
  location_link?: string;
  is_active?: string;
  created_at?: string;
  monthly_price?: string;
  lesson_price?: string;
  lessons_per_week?: string;
  payment_type?: string;
}

export interface Student {
  id?: string;
  first_name?: string;
  last_name?: string;
  age?: string;
  birth_date?: string;
  parent_contact?: string;
  parent_name?: string;
  parent_relation?: string;
  phone?: string;
  telegram?: string;
  course_ids?: string;
  start_date?: string;
  photo_url?: string;
  is_active?: string;
  created_at?: string;
}

export interface Attendance {
  id?: string;
  lesson_id?: string;
  date?: string;
  course_id?: string;
  student_id?: string;
  status?: string;
  comment?: string;
  marked_by?: string;
  created_at?: string;
}

export interface Payment {
  id?: string;
  student_id?: string;
  course_id?: string;
  amount?: string;
  payment_date?: string;
  payment_type?: string;
  comment?: string;
  created_at?: string;
}

export interface Achievement {
  id?: string;
  student_id?: string;
  title?: string;
  icon?: string;
  description?: string;
  achieved_at?: string;
  created_at?: string;
}

export interface Lesson {
  id?: string;
  course_id?: string;
  date?: string;
  time?: string;
  title?: string;
  status?: string;
  rescheduled_to?: string;
  homework?: string;
  location?: string;
  location_link?: string;
  note?: string;
  is_active?: string;
  created_at?: string;
}

// ─── API Response Types ───────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    telegram_id: string;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    role: string;
    is_active: boolean;
  };
}

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  trial: number;
  unmarked: number;
  total_marked: number;
}

export interface EnrichedLesson extends Lesson {
  color?: string;
  student_count?: number;
  attendance_stats?: AttendanceStats;
  unmarked_students?: Array<{ id?: string; first_name?: string; last_name?: string }>;
}

export interface StudentProfile {
  student: Student;
  courses: Course[];
  payments: Payment[];
  total_paid: number;
  achievements: Achievement[];
  attendance: {
    total_records: number;
    total_lessons: number;
    present: number;
    late: number;
    absent: number;
    marked: number;
    unmarked: number;
    attendance_rate: number;
    last_visit: string;
    history: Attendance[];
  };
}

// ─── Inbox Types ──────────────────────────────────────────────────────────

export interface InboxItem {
  id: string;
  title: string;
  subtitle: string;
  priority: 'high' | 'medium' | 'low';
  action_label: string;
  action_url: string;
  student_id?: string;
  lesson_id?: string;
}

export interface InboxGroup {
  key: string;
  label: string;
  icon: string;
  items: InboxItem[];
}

export interface InboxData {
  date: string;
  groups: InboxGroup[];
  stats: {
    total: number;
    high_priority: number;
  };
}

// ─── Dashboard Types ──────────────────────────────────────────────────────

export interface NextLesson {
  id?: string;
  course_id?: string;
  title?: string;
  time?: string;
  color?: string;
  location?: string;
  location_link?: string;
  status?: string;
}

export interface DashboardData {
  today: {
    date: string;
    lessons: EnrichedLesson[];
    next_lesson: NextLesson | null;
    total_lessons: number;
    total_students: number;
    present: number;
    late: number;
    absent: number;
    unmarked: number;
    pending_payments: number;
    overdue_payments: number;
    payment_alerts: any[];
  };
  summary: {
    total_courses: number;
    total_students: number;
    total_payments: number;
  };
}

// ─── System Types ─────────────────────────────────────────────────────────

export interface SystemStats {
  users_total: number;
  users_active_7d: number;
  courses_total: number;
  students_total: number;
  teachers_total: number;
  lessons_total: number;
  paid_amount: number;
  google_sheets: boolean;
  api_status: string;
  backend_status: string;
  recent_users: Array<{
    first_name: string;
    last_name: string;
    role: string;
    created_at: string;
  }>;
}
