export interface Teacher {
  id: string;
  name: string;
  color: string;
  honorPerSession: number;
  isOwner: boolean;
  createdAt: string;
}

export type BillingType = 'per-session' | 'package';

export type StudentGroup = 'pribadi' | 'wenwen_aizhongwen' | 'xuyuan';

export const STUDENT_GROUPS: { value: StudentGroup; label: string }[] = [
  { value: 'pribadi',           label: 'Pribadi' },
  { value: 'wenwen_aizhongwen', label: 'WenWen_AiZhongWen' },
  { value: 'xuyuan',            label: 'XuYuan' },
];

export interface Student {
  id: string;
  teacherId: string;
  name: string;
  billingType: BillingType;
  ratePerSession: number;
  group: StudentGroup;
  xuYuanType?: 'private' | 'semi-group';
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export type PackagePricingType = 'per-session' | 'per-package';

export interface SessionPackage {
  id: string;
  studentId: string;
  teacherId: string;
  totalSessions: number;
  pricingType: PackagePricingType;
  pricePerSession: number;  // selalu diisi; kalau per-package = Math.round(packagePrice / totalSessions)
  packagePrice?: number;    // diisi kalau pricingType === 'per-package'
  startDate: string;
  notes?: string;
  createdAt: string;
}

export interface LessonSession {
  id: string;
  studentId: string;
  teacherId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: 'scheduled' | 'completed';
  notes?: string;
  worksheetPages?: number;
  rateSnapshot?: number; // ratePerSession murid saat sesi selesai (postpaid only)
  createdAt: string;
}

export interface Worksheet {
  id: string;
  studentId: string;
  date: string;
  pages: number;
  createdAt: string;
}

export interface AppData {
  teachers: Teacher[];
  students: Student[];
  packages: SessionPackage[];
  sessions: LessonSession[];
  worksheets: Worksheet[];
}
