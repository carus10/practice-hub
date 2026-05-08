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
}

export interface DictionaryItem {
  id: string;
  word: string;
  definition: string;
  exampleSentence: string;
  notes: string;
  sourceBookId?: string;
  createdAt: number;
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
  createdAt: number;
}

export enum AppView {
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