export type UserRole = 'owner' | 'admin' | 'tester' | 'user';

export interface User {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}
