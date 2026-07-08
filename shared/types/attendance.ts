export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'trial';

export interface Attendance {
  id: string;
  lesson_id?: string;
  date: string;
  course_id: string;
  student_id: string;
  status: AttendanceStatus;
  comment?: string;
  marked_by?: number;
  created_at: string;
}
