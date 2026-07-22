export interface Group {
  id: string;
  course_id: string;
  name: string;
  days: string[];           // ['Пн', 'Ср']
  start_time: string;       // '17:00'
  end_time: string;         // '18:30'
  location: string;
  location_link: string;
  teacher: string;
  student_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupCreate {
  course_id: string;
  name: string;
  days?: string[];
  start_time?: string;
  end_time?: string;
  location?: string;
  location_link?: string;
  teacher?: string;
}

export interface GroupUpdate {
  name?: string;
  days?: string[];
  start_time?: string;
  end_time?: string;
  location?: string;
  location_link?: string;
  teacher?: string;
  is_active?: boolean;
}
