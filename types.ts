
export interface LessonPart {
  title: string;
  content: string;
  keyTakeaways: string[];
}

export interface CourseContent {
  topic: string;
  summary: string;
  lessons: LessonPart[];
  groundingSources: { title: string; uri: string }[];
}

export type LearningDepth = 'express' | 'standard' | 'deep';
export type AppTheme = 'blue' | 'black' | 'orange' | 'green';

export interface AppState {
  isGenerating: boolean;
  course: CourseContent | null;
  completedLessons: number[];
  videoUrl: string | null;
  isVideoGenerating: boolean;
  isAudioGenerating: boolean;
  error: string | null;
  theme: AppTheme;
  isDarkMode: boolean;
}
