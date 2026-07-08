export type LessonStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';

export interface Lesson {
  id: string;
  course_id: string;        // ссылка на курс-шаблон
  date: string;             // 2026-07-08
  time: string;             // 17:00 (может отличаться от курса)
  title: string;            // может отличаться от курса
  status: LessonStatus;
  rescheduled_to: string;   // lesson_id, если перенесено
  homework: string;         // домашнее задание
  location: string;         // может отличаться от курса
  location_link: string;
  note: string;             // заметка преподавателя
  is_active: boolean;
  created_at: string;
}
