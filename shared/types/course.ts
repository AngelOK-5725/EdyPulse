export interface Course {
  id: string;
  title: string;
  description?: string;
  days: string[];
  time?: string;
  duration?: number;         // minutes, e.g. 60 or 90
  price: number;
  teacher_id?: number;
  color: string;
  student_ids: string[];
  location?: string;
  location_link?: string;
  is_active: boolean;
  created_at: string;

  // Tariff fields
  monthly_price?: number;
  lesson_price?: number;
  lessons_per_week?: number;
  payment_type?: 'monthly' | 'per_lesson' | 'mixed';
}
