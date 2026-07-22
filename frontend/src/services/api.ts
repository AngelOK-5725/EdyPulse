/**
 * API Service — единственная точка доступа к backend.
 * Все запросы направляются на Render FastAPI backend.
 * При переходе на PostgreSQL достаточно обновить только backend — фронт не меняется.
 */

// Production: VITE_API_URL is set via .env.production (Render backend)
// Development: falls back to '/api' (local backend or Cloudflare Functions)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let authToken = '';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

// --- Response types ---

export interface Course {
  id: string;
  title: string;
  description?: string;
  days: string;
  time?: string;
  price: string;
  teacher_id: string;
  color: string;
  student_ids: string;
  student_count?: number;  // Real student count from lesson attendance records
  location?: string;
  location_link?: string;
  is_active: string;
  created_at: string;
  monthly_price?: string;
  lesson_price?: string;
  lessons_per_week?: string;
  payment_type?: string;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  age?: string;
  birth_date?: string;
  parent_contact?: string;
  parent_name?: string;
  parent_relation?: string;
  phone?: string;
  telegram?: string;
  course_ids: string;
  start_date?: string;
  photo_url?: string;
  is_active: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  lesson_id?: string;
  date: string;
  course_id: string;
  student_id: string;
  status: string;
  comment: string;
  marked_by: string;
  created_at: string;
}

export interface Payment {
  id: string;
  student_id: string;
  course_id: string;
  amount: string;
  payment_date: string;
  payment_type: string;
  comment: string;
  created_at: string;
}

export interface Achievement {
  id: string;
  student_id: string;
  title: string;
  icon: string;
  description: string;
  achieved_at: string;
  created_at: string;
}

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
    history: AttendanceRecord[];
  };
}

export interface PaymentAlert {
  student_id: string;
  first_name: string;
  last_name: string;
  status: string;
  amount: string;
}

export interface LessonDashboardItem {
  id: string;
  course_id: string;
  date: string;
  time: string;
  start_time: string;
  end_time: string;
  title: string;
  status: string;
  homework: string;
  location: string;
  location_link: string;
  student_count: number;
  attendance_stats: {
    present: number;
    late: number;
    absent: number;
    trial: number;
    unmarked: number;
    total_marked: number;
  };
  unmarked_students: Array<{
    id: string;
    first_name: string;
    last_name: string;
  }>;
  color?: string;
}

export interface DashboardData {
  today: {
    date: string;
    lessons: LessonDashboardItem[];
    next_lesson: {
      id: string;
      course_id: string;
      title: string;
      time: string;
      color: string;
      location?: string;
      location_link?: string;
      status?: string;
    } | null;
    total_lessons: number;
    total_students: number;
    present: number;
    late: number;
    absent: number;
    unmarked: number;
    pending_payments: number;
    overdue_payments: number;
    payment_alerts: PaymentAlert[];
  };
  summary: {
    total_courses: number;
    total_students: number;
    total_payments: number;
  };
}

// --- Inbox types ---

export interface InboxItem {
  id: string;
  title: string;
  subtitle: string;
  priority: 'high' | 'medium' | 'low';
  action_label: string;
  action_url: string;
  student_id?: string;
  lesson_id?: string;
  // Lesson-specific fields
  lesson_time?: string;
  student_count?: number;
  color?: string;
  time_until?: string;
  lesson_status?: 'upcoming' | 'current' | 'past';
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

// --- Request helpers ---

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    authHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const config: RequestInit = {
    method,
    headers: {
      ...authHeaders,
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// --- API object ---

export const api = {
  // Auth token management
  setToken: (token: string) => { authToken = token; },
  getToken: () => authToken,

  // Auth
  login: (initData: string) => {
    // Сбрасываем authToken перед логином, чтобы случайно не отправить
    // старый токен, восстановленный из localStorage.
    // Сам api.login() не защищён — он создаёт новый токен.
    const oldToken = authToken;
    authToken = '';
    return request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { init_data: initData },
    }).finally(() => {
      // Восстанавливаем токен на случай, если это не первый логин
      // (например, при retry после неудачной попытки).
      // Успешный логин сам вызовет api.setToken() и перезапишет.
      authToken = oldToken;
    });
  },
  getMe: () => request<LoginResponse['user']>('/auth/me'),

  // Health
  health: () => request<{ status: string; version: string }>('/health'),

  // Courses
  getCourses: () => request<{ courses: Course[] }>('/courses'),
  getCourse: (id: string) => request<Course>(`/courses/${id}`),
  createCourse: (data: Partial<Course>) => request<Course>('/courses', { method: 'POST', body: data }),
  updateCourse: (id: string, data: Partial<Course>) =>
    request<{ status: string }>(`/courses/${id}`, { method: 'PUT', body: data }),
  deleteCourse: (id: string) => request<{ status: string }>(`/courses/${id}`, { method: 'DELETE' }),

  // Students
  getStudents: (courseId?: string, search?: string) => {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request<{ students: Student[] }>(`/students${qs ? `?${qs}` : ''}`);
  },
  getStudent: (id: string) => request<Student>(`/students/${id}`),
  createStudent: (data: Partial<Student>) =>
    request<Student>('/students', { method: 'POST', body: data }),
  updateStudent: (id: string, data: Partial<Student>) =>
    request<{ status: string }>(`/students/${id}`, { method: 'PUT', body: data }),
  deleteStudent: (id: string) => request<{ status: string }>(`/students/${id}`, { method: 'DELETE' }),

  // Enrollment
  enrollStudent: (courseId: string, studentId: string) =>
    request<{ status: string }>(`/courses/${courseId}/enroll`, {
      method: 'POST',
      body: { student_id: studentId },
    }),
  unenrollStudent: (courseId: string, studentId: string) =>
    request<{ status: string }>(`/courses/${courseId}/enroll/${studentId}`, {
      method: 'DELETE',
    }),
  searchStudents: (query: string) =>
    request<{ students: Student[] }>(`/students?search=${encodeURIComponent(query)}`),

  // Attendance
  getAttendance: (courseId?: string, date?: string, lessonId?: string) => {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);
    if (date) params.set('date', date);
    if (lessonId) params.set('lesson_id', lessonId);
    const qs = params.toString();
    return request<{ attendance: AttendanceRecord[] }>(`/attendance${qs ? `?${qs}` : ''}`);
  },
  getStudentAttendance: (studentId: string) =>
    request<{ attendance: AttendanceRecord[] }>(`/attendance/student/${studentId}`),
  markAttendance: (data: Partial<AttendanceRecord>) =>
    request<AttendanceRecord>('/attendance', { method: 'POST', body: data }),
  updateAttendance: (id: string, data: Partial<AttendanceRecord>) =>
    request<{ status: string }>(`/attendance/${id}`, { method: 'PUT', body: data }),
  deleteAttendance: (id: string) =>
    request<{ status: string }>(`/attendance/${id}`, { method: 'DELETE' }),

  // Payments — journal-based
  getPayments: () =>
    request<{ payments: Payment[] }>('/payments'),
  getStudentPayments: (studentId: string) =>
    request<{ payments: Payment[] }>(`/payments/student/${studentId}`),

  createPayment: (data: {
    student_id: string;
    course_id: string;
    amount: number;
    payment_date?: string;
    payment_type?: string;
    comment?: string;
  }) => request<Payment>('/payments', { method: 'POST', body: data }),
  updatePayment: (id: string, data: Partial<Payment>) =>
    request<{ status: string }>(`/payments/${id}`, { method: 'PUT', body: data }),

  // Achievements
  getAchievements: (studentId?: string) =>
    request<{ achievements: Achievement[] }>(`/achievements${studentId ? `?student_id=${studentId}` : ''}`),
  createAchievement: (data: Partial<Achievement>) =>
    request<Achievement>('/achievements', { method: 'POST', body: data }),
  deleteAchievement: (id: string) =>
    request<{ status: string }>(`/achievements/${id}`, { method: 'DELETE' }),

  // Student Profile
  getStudentProfile: (id: string) => request<StudentProfile>(`/students/${id}/profile`),

  // Dashboard
  getDashboard: () => request<DashboardData>('/dashboard'),

  // Inbox — daily action stream
  getInbox: () => request<InboxData>('/inbox'),

  // Lessons (new lesson-centric API)
  getLesson: (id: string) => request<any>(`/lessons/${id}`),
  getTodayLessons: () => request<{ lessons: any[] }>('/lessons/today'),
  getLessons: (date?: string, courseId?: string) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (courseId) params.set('course_id', courseId);
    const qs = params.toString();
    return request<{ lessons: any[] }>(`/lessons${qs ? `?${qs}` : ''}`);
  },
  ensureLesson: (courseId: string, date: string) =>
    request<any>('/lessons/ensure', { method: 'POST', body: { course_id: courseId, date } }),
  createLesson: (data: any) => request<any>('/lessons', { method: 'POST', body: data }),
  updateLesson: (id: string, data: any) =>
    request<{ status: string }>(`/lessons/${id}`, { method: 'PUT', body: data }),
  deleteLesson: (id: string) =>
    request<{ status: string }>(`/lessons/${id}`, { method: 'DELETE' }),

  // Users (admin)
  listUsers: () => request<{ users: any[] }>('/auth/admin/users'),
  setUserRole: (telegramId: number, role: string) =>
    request<{ status: string }>(`/auth/admin/users/${telegramId}/role`, {
      method: 'PUT',
      body: { role },
    }),

  // System (owner only)
  getSystemStats: () => request<SystemStats>('/system/stats'),
};

export default api;
