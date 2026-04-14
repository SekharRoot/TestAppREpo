export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}

export interface Course {
  id: string;
  teacherId: string;
  title: string;
  code: string;
  description: string;
  semester: string;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  type: 'link' | 'file' | 'note';
  url?: string;
  content?: string;
  createdAt: string;
}
