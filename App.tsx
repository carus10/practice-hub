import React, { useState, useEffect, useRef } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Dictionary } from './components/Dictionary';
import { StudyNotes } from './components/StudyNotes';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Book, AppView, Highlight, DictionaryItem, StudyGroup, StudyNoteEntry } from './types';

const STORAGE_KEY_BOOKS = 'murekkep_books';
const STORAGE_KEY_DICT = 'murekkep_dictionary';
const STORAGE_KEY_STUDY = 'murekkep_study_groups';

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

// ─── MIGRATION ────────────────────────────────────────────────────
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
    exampleSentences: item.exampleSentences || (item.exampleSentence ? [item.exampleSentence] : []),
    notes: item.notes || '',
    difficultyScore: item.difficultyScore ?? 0,
    lastPracticedAt: item.lastPracticedAt ?? 0,
  }));
}

const App: React.FC = () => {
  // Show WELCOME only on first visit per session
  const [view, setView] = useState<AppView>(() => {
    if (sessionStorage.getItem('pratik_hub_session') === 'active') {
      return AppView.LIBRARY;
    }
    return AppView.WELCOME;
  });

  useEffect(() => {
    sessionStorage.setItem('pratik_hub_session', 'active');
  }, []);

  // ─── DARK MODE ───
  const [isDark, setIsDark] = useState(() => localStorage.getItem('pratik_hub_theme') === 'dark');
  const [curtainVisible, setCurtainVisible] = useState(false);
  const [curtainColor, setCurtainColor] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setCurtainColor(next ? '#111111' : '#f7f5f0');
    setCurtainVisible(true);
    setTimeout(() => {
      setIsDark(next);
      localStorage.setItem('pratik_hub_theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
    }, 350);
    setTimeout(() => setCurtainVisible(false), 800);
  };

  // ─── LAZY INITIALIZATION with migration ──
  const [books, setBooks] = useState<Book[]>(() => migrateBooks(loadFromStorage<Book[]>(STORAGE_KEY_BOOKS, [])));
  const [dictionary, setDictionary] = useState<DictionaryItem[]>(() => migrateDictionary(loadFromStorage<DictionaryItem[]>(STORAGE_KEY_DICT, [])));
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>(() => loadFromStorage<StudyGroup[]>(STORAGE_KEY_STUDY, []));
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

  useEffect(() => {
    if (!isInitialized.current) return;
    saveToStorage(STORAGE_KEY_STUDY, studyGroups);
  }, [studyGroups]);

  // ─── BOOK HANDLERS ──
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
    const updatedBook = { ...book, lastAccessedAt: Date.now() };
    setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
    setActiveBook(updatedBook);
    setView(AppView.READER);
  };

  const handleUpdateProgress = (bookId: string, newIndex: number) => {
    setBooks(prev => prev.map(b => {
      if (b.id === bookId) {
        return { ...b, progressIndex: newIndex, lastAccessedAt: Date.now() };
      }
      return b;
    }));
    
    if (activeBook && activeBook.id === bookId) {
        setActiveBook(prev => prev ? ({...prev, progressIndex: newIndex, lastAccessedAt: Date.now()}) : null);
    }
  };

  const handleUpdateBook = (updatedBook: Book) => {
    setBooks(prev => prev.map(b => b.id === updatedBook.id ? updatedBook : b));
    if (activeBook && activeBook.id === updatedBook.id) {
      setActiveBook(updatedBook);
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

  // ─── DICTIONARY HANDLERS ──
  const handleAddToDictionary = (word: string, definition: string, exampleSentence: string, notes: string) => {
      const newItem: DictionaryItem = {
          id: crypto.randomUUID(),
          word,
          definition,
          exampleSentence, // legacy field
          exampleSentences: exampleSentence ? [exampleSentence] : [],
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

  // ─── STUDY GROUP HANDLERS ──
  const handleCreateStudyGroup = (bookId: string, name: string): string => {
      const newGroup: StudyGroup = {
          id: crypto.randomUUID(),
          name,
          bookId,
          entries: [],
          createdAt: Date.now()
      };
      setStudyGroups(prev => [...prev, newGroup]);
      return newGroup.id;
  };

  const handleAddToStudyGroup = (groupId: string, text: string) => {
      const newEntry: StudyNoteEntry = {
          id: crypto.randomUUID(),
          text,
          addedAt: Date.now()
      };
      setStudyGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, entries: [...g.entries, newEntry] } : g
      ));
  };

  const handleUpdateStudyGroup = (updatedGroup: StudyGroup) => {
      setStudyGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
  };

  const handleDeleteStudyGroup = (id: string) => {
      setStudyGroups(prev => prev.filter(g => g.id !== id));
  };

  const handleDeleteStudyEntry = (groupId: string, entryId: string) => {
      setStudyGroups(prev => prev.map(g =>
          g.id === groupId
              ? { ...g, entries: g.entries.filter(e => e.id !== entryId) }
              : g
      ));
  };

  return (
    <div className="font-sans text-ink antialiased bg-paper min-h-screen selection:bg-stone-200 selection:text-ink">
      {/* Theme Curtain */}
      {curtainVisible && (
        <div
          className="fixed inset-0 z-[9999] pointer-events-none"
          style={{ backgroundColor: curtainColor, animation: 'themeCurtain 0.8s ease-in-out forwards' }}
        />
      )}
      {view === AppView.WELCOME ? (
        <WelcomeScreen onEnter={() => setView(AppView.LIBRARY)} />
      ) : (
        <div key={view} className="page-transition">
          {view === AppView.LIBRARY ? (
            <Library 
              books={books} 
              onAddBook={handleAddBook} 
              onSelectBook={handleSelectBook}
              onDeleteBook={handleDeleteBook}
              onUpdateBook={handleUpdateBook}
              onOpenDictionary={() => setView(AppView.DICTIONARY)}
              onOpenStudyNotes={() => setView(AppView.STUDY_NOTES)}
              isDark={isDark}
              onToggleTheme={toggleTheme}
            />
          ) : view === AppView.DICTIONARY ? (
            <Dictionary 
                items={dictionary}
                books={books}
                onBack={() => setView(AppView.LIBRARY)}
                onUpdateItem={handleUpdateDictionaryItem}
                onDeleteItem={handleDeleteDictionaryItem}
            />
          ) : view === AppView.STUDY_NOTES ? (
            <StudyNotes
                groups={studyGroups}
                books={books}
                onBack={() => setView(AppView.LIBRARY)}
                onUpdateGroup={handleUpdateStudyGroup}
                onDeleteGroup={handleDeleteStudyGroup}
                onDeleteEntry={handleDeleteStudyEntry}
            />
          ) : (
            activeBook && (
              <Reader 
                book={activeBook} 
                dictionary={dictionary}
                onBack={() => setView(AppView.LIBRARY)} 
                onUpdateProgress={handleUpdateProgress}
                onAddHighlight={handleAddHighlight}
                onAddToDictionary={handleAddToDictionary}
                studyGroups={studyGroups.filter(g => g.bookId === activeBook.id)}
                onCreateStudyGroup={handleCreateStudyGroup}
                onAddToStudyGroup={handleAddToStudyGroup}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};

export default App;