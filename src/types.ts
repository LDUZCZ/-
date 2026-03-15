export type Category = 'Work' | 'Study' | 'Exercise' | 'Other';

export interface FocusSession {
  id?: string;
  userId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  duration: number; // seconds
  category: Category;
  notes?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  totalFocusTime: number;
}
