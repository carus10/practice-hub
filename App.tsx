import React, { useState, useEffect } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { Dictionary } from './components/Dictionary';
import { Book, AppView, Highlight, DictionaryItem, DictionaryFolder } from './types';

const STORAGE_KEY_BOOKS = 'murekkep_books';
const STORAGE_KEY_DICT = 'murekkep_dictionary';
const STORAGE_KEY_FOLDERS = 'murekkep_folders';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LIBRARY);
  const [books, setBooks] = useState<Book[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryItem[]>([]);
  const [folders, setFolders] = useState<DictionaryFolder[]>([]);
  const [activeBook, setActiveBook] = useState<Book | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    const storedBooks = localStorage.getItem(STORAGE_KEY_BOOKS);
    if (storedBooks) {
      try {
        setBooks(JSON.parse(storedBooks));
      } catch (e) {
        console.error("Failed to parse books", e);
      }
    }

    const storedDict = localStorage.getItem(STORAGE_KEY_DICT);
    if (storedDict) {
        try {
            setDictionary(JSON.parse(storedDict));
        } catch (e) {
            console.error("Failed to parse dictionary", e);
        }
    }

    const storedFolders = localStorage.getItem(STORAGE_KEY_FOLDERS);
    if (storedFolders) {
        try {
            setFolders(JSON.parse(storedFolders));
        } catch (e) {
            console.error("Failed to parse folders", e);
        }
    }
  }, []);

  // Save to local storage whenever books change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
  }, [books]);

  // Save Dictionary
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DICT, JSON.stringify(dictionary));
  }, [dictionary]);

  // Save Folders
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
  }, [folders]);

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
              
              // New Logic: Flatten and merge highlights
              // 1. Remove any part of existing highlights that overlaps with the new range
              let updatedHighlights = currentHighlights.flatMap(h => {
                  // No overlap
                  if (h.end <= start || h.start >= end) {
                      return [h];
                  }

                  const fragments: Highlight[] = [];

                  // Left remnant
                  if (h.start < start) {
                      fragments.push({ ...h, end: start });
                  }

                  // Right remnant
                  if (h.end > end) {
                      fragments.push({ ...h, start: end });
                  }

                  return fragments;
              });

              // 2. Add the new highlight (if color is not null/erased)
              if (color) {
                  updatedHighlights.push({ start, end, color });
              }

              // 3. Sort by start index
              updatedHighlights.sort((a, b) => a.start - b.start);

              return { ...b, highlights: updatedHighlights };
          }
          return b;
      }));

      // Also update active book state if necessary
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

  const handleAddToDictionary = (word: string, definition: string) => {
      const newItem: DictionaryItem = {
          id: crypto.randomUUID(),
          word,
          definition,
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

  // Folder Handlers
  const handleCreateFolder = (name: string) => {
    const newFolder: DictionaryFolder = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now()
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleUpdateFolder = (id: string, name: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
  };

  const handleDeleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    // When deleting a folder, move items back to Uncategorized (remove folderId)
    setDictionary(prev => prev.map(item => item.folderId === id ? { ...item, folderId: undefined } : item));
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
            folders={folders}
            onBack={() => setView(AppView.LIBRARY)}
            onUpdateItem={handleUpdateDictionaryItem}
            onDeleteItem={handleDeleteDictionaryItem}
            onCreateFolder={handleCreateFolder}
            onUpdateFolder={handleUpdateFolder}
            onDeleteFolder={handleDeleteFolder}
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