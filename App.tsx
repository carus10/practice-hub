import React, { useState, useEffect, useRef } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Dictionary } from './components/Dictionary';
import { Book, AppView, Highlight, DictionaryItem } from './types';

const STORAGE_KEY_BOOKS = 'murekkep_books';
const STORAGE_KEY_DICT = 'murekkep_dictionary';

// ─── SAFE localStorage helpers ───────────────────────────────────
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && raw !== undefined) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as T;
    }
  } catch (e) {
    console.error(`[PratikHub] localStorage parse error for "${key}":`, e);
  }
  return fallback;
}

function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`[PratikHub] localStorage write error for "${key}":`, e);
  }
}

// ─── MIGRATION: vocabulary → language, add missing fields ────────
function migrateBooks(books: Book[]): Book[] {
  return books.map(b => ({
    ...b,
    mode: (b.mode as string) === 'vocabulary' ? 'language' : b.mode,
  }));
}

function migrateDictionary(items: DictionaryItem[]): DictionaryItem[] {
  return items.map(item => ({
    ...item,
    exampleSentence: item.exampleSentence || '',
    notes: item.notes || '',
  }));
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LIBRARY);

  // ─── LAZY INITIALIZATION with migration ──
  const [books, setBooks] = useState<Book[]>(() => migrateBooks(loadFromStorage<Book[]>(STORAGE_KEY_BOOKS, [])));
  const [dictionary, setDictionary] = useState<DictionaryItem[]>(() => migrateDictionary(loadFromStorage<DictionaryItem[]>(STORAGE_KEY_DICT, [])));
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  // ─── MOUNT GUARD ──
  const isInitialized = useRef(false);
  useEffect(() => {
    isInitialized.current = true;
  }, []);

  // ─── SAFE SAVE EFFECTS ──
  useEffect(() => {
    if (!isInitialized.current) return;
    saveToStorage(STORAGE_KEY_BOOKS, books);
  }, [books]);

  useEffect(() => {
    if (!isInitialized.current) return;
    saveToStorage(STORAGE_KEY_DICT, dictionary);
  }, [dictionary]);

  const handleAddBook = (book: Book) => {
    setBooks(prev => [book, ...prev]);
  };

  const handleDeleteBook = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    if (activeBook?.id === id) {
      setActiveBook(null);
      setView(AppView.LIBRARY);
    }
  };

  const handleSelectBook = (book: Book) => {
    setActiveBook(book);
    setView(AppView.READER);
  };

  const handleUpdateProgress = (bookId: string, newIndex: number) => {
    setBooks(prev => prev.map(b => {
      if (b.id === bookId) {
        return { ...b, progressIndex: newIndex };
      }
      return b;
    }));
    
    if (activeBook && activeBook.id === bookId) {
        setActiveBook(prev => prev ? ({...prev, progressIndex: newIndex}) : null);
    }
  };

  const handleAddHighlight = (bookId: string, highlightInput: Omit<Highlight, 'color'> & { color: 'red' | 'blue' | 'green' | null }) => {
      setBooks(prev => prev.map(b => {
          if (b.id === bookId) {
              const currentHighlights = b.highlights || [];
              const { start, end, color } = highlightInput;
              
              let updatedHighlights = currentHighlights.flatMap(h => {
                  if (h.end <= start || h.start >= end) {
                      return [h];
                  }
                  const fragments: Highlight[] = [];
                  if (h.start < start) {
                      fragments.push({ ...h, end: start });
                  }
                  if (h.end > end) {
                      fragments.push({ ...h, start: end });
                  }
                  return fragments;
              });

              if (color) {
                  updatedHighlights.push({ start, end, color });
              }

              updatedHighlights.sort((a, b) => a.start - b.start);
              return { ...b, highlights: updatedHighlights };
          }
          return b;
      }));

      if (activeBook && activeBook.id === bookId) {
          setActiveBook(prevBook => {
              if (!prevBook) return null;
              const currentHighlights = prevBook.highlights || [];
              const { start, end, color } = highlightInput;

              let updatedHighlights = currentHighlights.flatMap(h => {
                  if (h.end <= start || h.start >= end) return [h];
                  const fragments: Highlight[] = [];
                  if (h.start < start) fragments.push({ ...h, end: start });
                  if (h.end > end) fragments.push({ ...h, start: end });
                  return fragments;
              });

              if (color) {
                  updatedHighlights.push({ start, end, color });
              }
              updatedHighlights.sort((a, b) => a.start - b.start);

              return { ...prevBook, highlights: updatedHighlights };
          });
      }
  };

  // ─── DICTIONARY HANDLERS (rich fields) ──
  const handleAddToDictionary = (word: string, definition: string, exampleSentence: string, notes: string) => {
      const newItem: DictionaryItem = {
          id: crypto.randomUUID(),
          word,
          definition,
          exampleSentence,
          notes,
          sourceBookId: activeBook?.id,
          createdAt: Date.now()
      };
      setDictionary(prev => [newItem, ...prev]);
  };

  const handleUpdateDictionaryItem = (updatedItem: DictionaryItem) => {
      setDictionary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  };

  const handleDeleteDictionaryItem = (id: string) => {
      setDictionary(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="font-sans text-ink antialiased bg-paper min-h-screen selection:bg-stone-200 selection:text-ink">
      {view === AppView.LIBRARY ? (
        <Library 
          books={books} 
          onAddBook={handleAddBook} 
          onSelectBook={handleSelectBook}
          onDeleteBook={handleDeleteBook}
          onOpenDictionary={() => setView(AppView.DICTIONARY)}
        />
      ) : view === AppView.DICTIONARY ? (
        <Dictionary 
            items={dictionary}
            books={books}
            onBack={() => setView(AppView.LIBRARY)}
            onUpdateItem={handleUpdateDictionaryItem}
            onDeleteItem={handleDeleteDictionaryItem}
        />
      ) : (
        activeBook && (
          <Reader 
            book={activeBook} 
            onBack={() => setView(AppView.LIBRARY)} 
            onUpdateProgress={handleUpdateProgress}
            onAddHighlight={handleAddHighlight}
            onAddToDictionary={handleAddToDictionary}
          />
        )
      )}
    </div>
  );
};

export default App;