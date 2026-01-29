import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, CHARS_PER_PAGE, Highlight, DictionaryItem } from '../types';
import { IconArrowLeft, IconPen, IconDictionary, IconEraser } from './Icons';

interface ReaderProps {
  book: Book;
  onBack: () => void;
  onUpdateProgress: (bookId: string, newIndex: number) => void;
  onAddHighlight: (bookId: string, highlight: Omit<Highlight, 'color'> & { color: 'red' | 'blue' | 'green' | null }) => void;
  onAddToDictionary: (word: string, definition: string) => void;
}

export const Reader: React.FC<ReaderProps> = ({ book, onBack, onUpdateProgress, onAddHighlight, onAddToDictionary }) => {
  const [currentIndex, setCurrentIndex] = useState(book.progressIndex);
  const [pageStart, setPageStart] = useState(0);
  
  // Selection State
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number, top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');
  
  // Dictionary Modal State (within Reader)
  const [showDictModal, setShowDictModal] = useState(false);
  const [dictDefinition, setDictDefinition] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const activeCharRef = useRef<HTMLSpanElement>(null);

  // Sync state
  useEffect(() => {
    const newPageStart = Math.floor(currentIndex / CHARS_PER_PAGE) * CHARS_PER_PAGE;
    setPageStart(newPageStart);
  }, [currentIndex]);

  useEffect(() => {
    if (activeCharRef.current) {
      activeCharRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIndex]);

  const currentPageContent = book.content.slice(pageStart, pageStart + CHARS_PER_PAGE);

  // Handle Text Selection
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionRange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) {
        setSelectionRange(null);
        return;
    }

    // Attempt to find start and end indices relative to the page content
    // We rely on the fact that chars are wrapped in spans with data-index
    let startNode = range.startContainer;
    let endNode = range.endContainer;

    // Navigate up to the span if selection started inside the text node
    if (startNode.nodeType === 3 && startNode.parentElement?.tagName === 'SPAN') {
        startNode = startNode.parentElement;
    }
    if (endNode.nodeType === 3 && endNode.parentElement?.tagName === 'SPAN') {
        endNode = endNode.parentElement;
    }

    if (startNode instanceof HTMLElement && endNode instanceof HTMLElement) {
        const startIndex = parseInt(startNode.dataset.index || '-1');
        const endIndex = parseInt(endNode.dataset.index || '-1');

        if (startIndex !== -1 && endIndex !== -1) {
            const rect = range.getBoundingClientRect();
            // Normalize indices
            const s = Math.min(startIndex, endIndex);
            const e = Math.max(startIndex, endIndex);
            
            setSelectionRange({
                start: s,
                end: e + 1, // +1 because slice is exclusive
                top: rect.top,
                left: rect.left + (rect.width / 2)
            });
            setSelectedText(text);
        }
    }
  };

  const applyHighlight = (color: 'red' | 'blue' | 'green' | null) => {
    if (selectionRange) {
        onAddHighlight(book.id, {
            start: selectionRange.start,
            end: selectionRange.end,
            color
        });
        setSelectionRange(null);
        // Clear browser selection
        window.getSelection()?.removeAllRanges();
    }
  };

  const initAddToDictionary = () => {
    setShowDictModal(true);
  };

  const saveToDictionary = () => {
      onAddToDictionary(selectedText, dictDefinition);
      setShowDictModal(false);
      setDictDefinition('');
      setSelectionRange(null);
      window.getSelection()?.removeAllRanges();
  };

  // Keyboard Handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore typing if modal is open
    if (showDictModal) return;

    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.key === 'Backspace') {
      if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        setCurrentIndex(newIndex);
        onUpdateProgress(book.id, newIndex);
      }
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const expectedChar = book.content[currentIndex];
      if (expectedChar && e.key === expectedChar) {
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        onUpdateProgress(book.id, newIndex);
      } else if (expectedChar && expectedChar === '\n' && e.key === 'Enter') {
         const newIndex = currentIndex + 1;
         setCurrentIndex(newIndex);
         onUpdateProgress(book.id, newIndex);
      }
    }
  }, [currentIndex, book.content, book.id, onUpdateProgress, showDictModal]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const totalPages = Math.ceil(book.content.length / CHARS_PER_PAGE);
  const currentPageNumber = Math.floor(currentIndex / CHARS_PER_PAGE) + 1;

  const jumpToPage = (page: number) => {
    const newIndex = (page - 1) * CHARS_PER_PAGE;
    setCurrentIndex(newIndex);
    onUpdateProgress(book.id, newIndex);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden relative">
      {/* Top Bar */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-paper z-10 shrink-0">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-stone-500 hover:text-ink transition-colors"
        >
          <IconArrowLeft />
          <span className="font-medium">Kitaplık</span>
        </button>
        <div className="flex flex-col items-center">
             <h2 className="font-serif text-ink font-medium text-lg truncate max-w-md px-4">{book.title}</h2>
             {book.mode === 'vocabulary' && <span className="text-xs text-purple-600 bg-purple-50 px-2 rounded-full">Kelime Öğrenme Modu</span>}
             {book.mode === 'study' && <span className="text-xs text-blue-600 bg-blue-50 px-2 rounded-full">Ders Tekrar Modu</span>}
        </div>
        
        <div className="text-stone-400 font-mono text-sm shrink-0">
          {currentPageNumber} / {totalPages}
        </div>
      </div>

      {/* Typing Area */}
      <div 
        className="flex-1 overflow-y-auto p-8 md:p-16 outline-none cursor-text no-scrollbar flex justify-center" 
        ref={containerRef}
        onMouseUp={handleMouseUp}
      >
        <div className="max-w-4xl w-full leading-relaxed tracking-wide font-serif text-2xl md:text-3xl pb-32">
          {currentPageContent.split('').map((char, idx) => {
            const globalIndex = pageStart + idx;
            const isTyped = globalIndex < currentIndex;
            const isCurrent = globalIndex === currentIndex;
            
            // Check Highlights
            const highlight = book.highlights?.find(h => globalIndex >= h.start && globalIndex < h.end);

            let className = "transition-all duration-100 relative ";
            if (isTyped) {
              className += "text-ink opacity-100 ";
            } else if (isCurrent) {
              className += "text-stone-500 bg-stone-200 rounded-sm opacity-100 border-b-2 border-accent ";
            } else {
              className += "text-stone-400 opacity-100 ";
            }
            
            // Highlight Styles
            if (highlight) {
                if (highlight.color === 'red') className += " bg-red-100/50 box-decoration-clone";
                if (highlight.color === 'blue') className += " bg-blue-100/50 box-decoration-clone";
                if (highlight.color === 'green') className += " bg-green-100/50 box-decoration-clone";
                // Underline effect for better visibility
                if (highlight.color === 'red') className += " decoration-red-400 underline decoration-2";
                if (highlight.color === 'blue') className += " decoration-blue-400 underline decoration-2";
                if (highlight.color === 'green') className += " decoration-green-400 underline decoration-2";
            }

            return (
              <span 
                key={globalIndex} 
                data-index={globalIndex}
                className={className}
                ref={isCurrent ? activeCharRef : null}
              >
                {char}
              </span>
            );
          })}
        </div>
      </div>

      {/* Floating Toolbar for Selection */}
      {selectionRange && (book.mode === 'study' || book.mode === 'vocabulary') && (
        <div 
            className="fixed bg-white shadow-xl rounded-lg p-2 border border-stone-200 z-50 flex gap-2 animate-in fade-in zoom-in duration-200"
            style={{ 
                top: Math.max(10, selectionRange.top - 60), 
                left: Math.max(10, selectionRange.left - (book.mode === 'study' ? 100 : 40)) 
            }}
        >
            {book.mode === 'study' && (
                <>
                    <button onClick={() => applyHighlight('green')} className="w-8 h-8 rounded-full bg-green-200 hover:bg-green-300 border border-green-400" title="Yeşil"></button>
                    <button onClick={() => applyHighlight('blue')} className="w-8 h-8 rounded-full bg-blue-200 hover:bg-blue-300 border border-blue-400" title="Mavi"></button>
                    <button onClick={() => applyHighlight('red')} className="w-8 h-8 rounded-full bg-red-200 hover:bg-red-300 border border-red-400" title="Kırmızı"></button>
                    <div className="w-px bg-stone-200 mx-1"></div>
                    <button onClick={() => applyHighlight(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-600" title="Temizle">
                      <IconEraser />
                    </button>
                </>
            )}
            {book.mode === 'vocabulary' && (
                 <button 
                    onClick={initAddToDictionary}
                    className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium"
                 >
                    <IconDictionary />
                    Sözlüğe Ekle
                 </button>
            )}
        </div>
      )}

      {/* Dictionary Add Modal */}
      {showDictModal && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6">
                  <h3 className="text-xl font-serif text-ink mb-4">Sözlüğe Ekle</h3>
                  <div className="mb-4">
                      <label className="text-xs text-stone-500 uppercase font-bold">Kelime</label>
                      <p className="text-lg font-medium text-stone-900 p-3 bg-white border border-stone-300 rounded-lg shadow-sm">{selectedText}</p>
                  </div>
                  <div className="mb-6">
                      <label className="text-xs text-stone-500 uppercase font-bold mb-1 block">Anlamı (Opsiyonel)</label>
                      <input 
                        type="text" 
                        className="w-full p-3 border border-stone-300 bg-white text-stone-900 rounded-lg focus:outline-none focus:border-stone-500 focus:ring-1 focus:ring-stone-500"
                        placeholder="Türkçe karşılığını girin..."
                        value={dictDefinition}
                        onChange={(e) => setDictDefinition(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && saveToDictionary()}
                      />
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowDictModal(false)} className="px-4 py-2 text-stone-500 hover:bg-stone-100 rounded-lg font-medium">İptal</button>
                      <button onClick={saveToDictionary} className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg shadow-sm font-medium">Kaydet</button>
                  </div>
              </div>
          </div>
      )}

      {/* Bottom Navigation */}
      <div className="px-8 py-6 border-t border-stone-200 bg-stone-50 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <span className="text-xs font-sans text-stone-400 uppercase tracking-wider w-16">Sayfa</span>
          <input 
            type="range" 
            min="1" 
            max={totalPages || 1} 
            value={currentPageNumber} 
            onChange={(e) => jumpToPage(parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-600 hover:accent-ink transition-all"
          />
           <span className="text-xs font-sans text-stone-600 font-bold w-8 text-right">{currentPageNumber}</span>
        </div>
      </div>
    </div>
  );
};