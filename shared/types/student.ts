export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  age?: number;
  birth_date?: string;
  parent_contact?: string;
  phone?: string;
  telegram?: string;
  course_ids: string[];
  start_date?: string;
  photo_url?: string;
  is_active: boolean;
  created_at: string;
}
