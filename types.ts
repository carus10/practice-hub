export type BookMode = 'normal' | 'vocabulary' | 'study';

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

export interface DictionaryFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface DictionaryItem {
  id: string;
  word: string;
  definition: string;
  sourceBookId?: string; // Optional: link back to where it was found
  folderId?: string;
  createdAt: number;
}

export enum AppView {
  LIBRARY = 'LIBRARY',
  READER = 'READER',
  DICTIONARY = 'DICTIONARY',
}

export interface ProcessingState {
  isProcessing: boolean;
  message: string;
}

export const CHARS_PER_PAGE = 400;