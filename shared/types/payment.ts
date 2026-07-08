export type PaymentTypeName = 'monthly' | 'single' | 'partial' | 'full';

export interface Payment {
  id: string;
  student_id: string;
  course_id: string;
  amount: string;
  payment_date: string;
  payment_type: PaymentTypeName;
  comment?: string;
  created_at: string;
}
