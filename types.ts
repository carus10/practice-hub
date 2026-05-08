export type BookMode = 'normal' | 'language' | 'study';

export interface Highlight {
  start: number;
  end: number;
  color: 'red' | 'blue' | 'green';
}

export interface Book {
  id: string;
  title: string;
  content: string;
  progressIndex: number;
  createdAt: number;
  mode: BookMode;
  highlights: Highlight[];
  coverImage?: string;
}

export interface DictionaryItem {
  id: string;
  word: string;
  definition: string;
  exampleSentence?: string; // Kept for backwards compatibility, but we use exampleSentences now
  exampleSentences?: string[];
  notes: string;
  sourceBookId?: string;
  createdAt: number;
  difficultyScore?: number;
  lastPracticedAt?: number;
}

// ─── Ders Notları Sistemi ───────────────────────────────────────
export interface StudyNoteEntry {
  id: string;
  text: string;
  addedAt: number;
}

export interface StudyGroup {
  id: string;
  name: string;
  bookId: string;
  entries: StudyNoteEntry[];
  progressIndex?: number;
  createdAt: number;
}

export enum AppView {
  WELCOME = 'WELCOME',
  LIBRARY = 'LIBRARY',
  READER = 'READER',
  DICTIONARY = 'DICTIONARY',
  STUDY_NOTES = 'STUDY_NOTES',
}

export interface ProcessingState {
  isProcessing: boolean;
  message: string;
}

export const CHARS_PER_PAGE = 400;