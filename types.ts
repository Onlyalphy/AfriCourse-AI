
export interface LessonPart {
  title: string;
  content: string;
  keyTakeaways: string[];
  sources: { title: string; url: string }[];
  expandedContent?: string;
}

export interface CourseContent {
  topic: string;
  summary: string;
  lessons: LessonPart[];
  groundingSources: { title: string; uri: string }[];
}

export interface CertifiedPathway {
  title: string;
  duration: string;
  roadmap: { year: number; semesters: string[] }[];
}

export type LearningDepth = 'express' | 'standard' | 'deep' | 'certified';
export type AppTheme = 'blue' | 'black' | 'orange' | 'green';
export type VideoOrientation = '16:9' | '9:16';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AppState {
  isGenerating: boolean;
  course: CourseContent | null;
  certifiedPathway: CertifiedPathway | null;
  completedLessons: number[];
  videoUrl: string | null;
  isVideoGenerating: boolean;
  isAudioGenerating: boolean;
  isAnalyzingVideo: boolean;
  videoAnalysis: string | null;
  error: string | null;
  theme: AppTheme;
  isDarkMode: boolean;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  videoOrientation: VideoOrientation;
  isExpandingLesson: number | null;
}
