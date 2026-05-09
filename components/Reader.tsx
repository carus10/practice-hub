import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, CHARS_PER_PAGE, Highlight, StudyGroup, DictionaryItem } from '../types';
import { IconArrowLeft, IconDictionary, IconEraser, IconClipboard, IconPlus } from './Icons';

interface ReaderProps {
  book: Book;
  onBack: () => void;
  onUpdateProgress: (bookId: string, newIndex: number) => void;
  onAddHighlight: (bookId: string, highlight: Omit<Highlight, 'color'> & { color: 'red' | 'blue' | 'green' | null }) => void;
  onAddToDictionary: (word: string, definition: string, exampleSentence: string, notes: string) => void;
  studyGroups: StudyGroup[];
  onCreateStudyGroup: (bookId: string, name: string) => string;
  onAddToStudyGroup: (groupId: string, text: string) => void;
  dictionary: DictionaryItem[];
}

export const Reader: React.FC<ReaderProps> = ({ 
  book, onBack, onUpdateProgress, onAddHighlight, onAddToDictionary,
  studyGroups, onCreateStudyGroup, onAddToStudyGroup, dictionary
}) => {
  const [currentIndex, setCurrentIndex] = useState(book.progressIndex);
  const [pageStart, setPageStart] = useState(0);
  
  // Selection State
  const [selectionRange, setSelectionRange] = useState<{start: number, end: number, top: number, left: number} | null>(null);
  const [selectedText, setSelectedText] = useState('');
  
  // Dictionary Modal State
  const [showDictModal, setShowDictModal] = useState(false);
  const [dictDefinition, setDictDefinition] = useState('');
  const [dictExample, setDictExample] = useState('');
  const [dictNotes, setDictNotes] = useState('');

  // Word Info State
  const [showWordInfoModal, setShowWordInfoModal] = useState(false);
  const [isFetchingWord, setIsFetchingWord] = useState(false);
  const [wordInfo, setWordInfo] = useState<{word: string, definition: string, example: string, isLocal: boolean} | null>(null);
  const [wordInfoError, setWordInfoError] = useState<string | null>(null);

  // Study Group Modal State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupAddSuccess, setGroupAddSuccess] = useState(false);

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

    let startNode = range.startContainer;
    let endNode = range.endContainer;

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
            const s = Math.min(startIndex, endIndex);
            const e = Math.max(startIndex, endIndex);
            
            setSelectionRange({
                start: s,
                end: e + 1,
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
        window.getSelection()?.removeAllRanges();
    }
  };

  // ─── DICTIONARY ──
  const handleViewMeaning = async () => {
      const word = selectedText.toLowerCase().replace(/[^\w\s\ğ\ü\ş\i\ö\ç\I\İ\Ğ\Ü\Ş\Ö\Ç-]/gi, '').trim();
      if (!word) return;

      setShowWordInfoModal(true);
      setIsFetchingWord(true);
      setWordInfoError(null);
      setWordInfo(null);

      // Check local dictionary first
      const localItem = dictionary.find(item => item.word.toLowerCase() === word);
      if (localItem) {
          setWordInfo({
              word: localItem.word,
              definition: localItem.definition,
              example: localItem.exampleSentences?.[0] || localItem.exampleSentence || '',
              isLocal: true
          });
          setIsFetchingWord(false);
          return;
      }

      // Fetch from APIs
      try {
          let example = '';
          let definition = '';

          // 1. Fetch Example Sentence from dictionaryapi.dev
          try {
              const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
              if (dictRes.ok) {
                  const data = await dictRes.json();
                  // Try to find any definition that has an example
                  for (const meaning of data[0]?.meanings || []) {
                      for (const def of meaning.definitions || []) {
                          if (def.example) {
                              example = def.example;
                              break;
                          }
                      }
                      if (example) break;
                  }
                  // Fallback to english definition if translation fails later
                  if (!example && data[0]?.meanings?.[0]?.definitions?.[0]?.definition) {
                      // Optionally keep english definition if no example but we want to show something
                  }
              }
          } catch (e) {
              console.error("Dictionary API error:", e);
          }

          // 2. Fetch Turkish Translation from MyMemory API
          try {
              const transRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`);
              if (transRes.ok) {
                  const transData = await transRes.json();
                  if (transData.responseData?.translatedText) {
                      definition = transData.responseData.translatedText;
                  }
              }
          } catch (e) {
              console.error("Translation API error:", e);
          }

          if (!definition && !example) {
              throw new Error("Kelimenin anlamı veya örnek cümlesi bulunamadı.");
          }

          setWordInfo({
              word: word,
              definition: definition || 'Türkçe çeviri bulunamadı',
              example: example || '',
              isLocal: false
          });

      } catch (err: any) {
          setWordInfoError(err.message || "Bir hata oluştu.");
      } finally {
          setIsFetchingWord(false);
      }
  };

  const saveWordInfoToDictionary = () => {
      if (wordInfo) {
          onAddToDictionary(wordInfo.word, wordInfo.definition, wordInfo.example, '');
          closeWordInfoModal();
      }
  };

  const closeWordInfoModal = () => {
      setShowWordInfoModal(false);
      setWordInfo(null);
      setWordInfoError(null);
      setSelectionRange(null);
      window.getSelection()?.removeAllRanges();
  };

  const initAddToDictionary = () => {
    setShowDictModal(true);
  };

  const saveToDictionary = () => {
      onAddToDictionary(selectedText, dictDefinition, dictExample, dictNotes);
      closeDictModal();
  };

  const skipToDictionary = () => {
      onAddToDictionary(selectedText, '', '', '');
      closeDictModal();
  };

  const closeDictModal = () => {
      setShowDictModal(false);
      setDictDefinition('');
      setDictExample('');
      setDictNotes('');
      setSelectionRange(null);
      window.getSelection()?.removeAllRanges();
  };

  // ─── STUDY GROUP ──
  const initAddToGroup = () => {
    setShowGroupModal(true);
    setSelectedGroupId(null);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setGroupAddSuccess(false);
  };

  const handleGroupSave = () => {
    if (!selectedGroupId) return;
    onAddToStudyGroup(selectedGroupId, selectedText);
    setGroupAddSuccess(true);
    setTimeout(() => {
      closeGroupModal();
    }, 800);
  };

  const handleCreateAndAdd = () => {
    if (!newGroupName.trim()) return;
    const newId = onCreateStudyGroup(book.id, newGroupName.trim());
    onAddToStudyGroup(newId, selectedText);
    setGroupAddSuccess(true);
    setTimeout(() => {
      closeGroupModal();
    }, 800);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setSelectedGroupId(null);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setGroupAddSuccess(false);
    setSelectionRange(null);
    window.getSelection()?.removeAllRanges();
  };

  // Keyboard Handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showDictModal || showGroupModal || showWordInfoModal) return;

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
  }, [currentIndex, book.content, book.id, onUpdateProgress, showDictModal, showGroupModal, showWordInfoModal]);

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
             {book.mode === 'language' && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 rounded-full">Dil Öğrenme Modu</span>}
             {book.mode === 'study' && <span className="text-xs text-blue-600 bg-blue-50 px-2 rounded-full">Ders Çalışma Modu</span>}
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
            
            const highlight = book.highlights?.find(h => globalIndex >= h.start && globalIndex < h.end);

            let className = "transition-all duration-100 relative ";
            if (isTyped) {
              className += "text-ink opacity-100 ";
            } else if (isCurrent) {
              className += "reader-char-current text-stone-500 bg-stone-200 rounded-sm opacity-100 border-b-2 border-accent ";
            } else {
              className += "reader-char-untyped text-stone-400 opacity-100 ";
            }
            
            if (highlight) {
                if (highlight.color === 'red') className += " bg-red-100/50 box-decoration-clone decoration-red-400 underline decoration-2";
                if (highlight.color === 'blue') className += " bg-blue-100/50 box-decoration-clone decoration-blue-400 underline decoration-2";
                if (highlight.color === 'green') className += " bg-green-100/50 box-decoration-clone decoration-green-400 underline decoration-2";
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

      {/* ─── Floating Toolbar for Selection ─── */}
      {selectionRange && (book.mode === 'study' || book.mode === 'language') && (
        <div 
            className="reader-toolbar fixed bg-white shadow-xl rounded-xl p-2.5 border border-stone-200 z-50 flex gap-2 animate-in fade-in zoom-in duration-200"
            style={{ 
                top: Math.max(10, selectionRange.top - 60), 
                left: Math.max(10, selectionRange.left - (book.mode === 'study' ? 140 : 40)) 
            }}
        >
            {book.mode === 'study' && (
                <>
                    <button onClick={() => applyHighlight('green')} className="reader-hl-btn w-8 h-8 rounded-full bg-green-200 hover:bg-green-300 border border-green-400 transition-colors" title="Yeşil"></button>
                    <button onClick={() => applyHighlight('blue')} className="reader-hl-btn w-8 h-8 rounded-full bg-blue-200 hover:bg-blue-300 border border-blue-400 transition-colors" title="Mavi"></button>
                    <button onClick={() => applyHighlight('red')} className="reader-hl-btn w-8 h-8 rounded-full bg-red-200 hover:bg-red-300 border border-red-400 transition-colors" title="Kırmızı"></button>
                    <div className="reader-separator w-px bg-stone-200 mx-1"></div>
                    <button onClick={() => applyHighlight(null)} className="reader-eraser-btn w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-600 transition-colors" title="Temizle">
                      <IconEraser />
                    </button>
                    <div className="reader-separator w-px bg-stone-200 mx-1"></div>
                    <button 
                      onClick={initAddToGroup}
                      className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      title="Gruba Ekle"
                    >
                      <IconClipboard />
                      Gruba Ekle
                    </button>
                </>
            )}
            {book.mode === 'language' && (
                 <>
                     <button 
                        onClick={handleViewMeaning}
                        className="reader-btn-translate flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-200 text-sm font-medium transition-colors"
                     >
                        <IconDictionary />
                        Çevir / Anlamı
                     </button>
                     <div className="reader-separator w-px bg-stone-200 mx-1"></div>
                     <button 
                        onClick={initAddToDictionary}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                     >
                        Sözlüğe Ekle
                     </button>
                 </>
            )}
        </div>
      )}

      {/* ─── Study Group Add Modal ─── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-stone-200">
              <h3 className="text-xl font-serif text-ink">Gruba Ekle</h3>
              <p className="text-stone-500 text-sm mt-1">Seçili metni bir ders notu grubuna ekleyin.</p>
            </div>

            <div className="p-6">
              {/* Selected text preview */}
              <div className="mb-5">
                <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1.5">Seçili Metin</label>
                <div className="text-sm text-ink p-3 bg-stone-50 rounded-lg border border-stone-200 max-h-20 overflow-y-auto leading-relaxed">
                  "{selectedText}"
                </div>
              </div>

              {/* Success feedback */}
              {groupAddSuccess ? (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">✓</div>
                  <p className="text-emerald-600 font-medium">Gruba eklendi!</p>
                </div>
              ) : (
                <>
                  {/* Group list or create */}
                  {studyGroups.length === 0 && !isCreatingGroup ? (
                    <div className="text-center py-6 bg-amber-50 rounded-xl border border-amber-200 mb-4">
                      <p className="text-amber-700 font-medium text-sm mb-1">Henüz grup oluşturmadınız</p>
                      <p className="text-amber-600 text-xs">Lütfen aşağıdaki butonla yeni bir grup oluşturun.</p>
                    </div>
                  ) : !isCreatingGroup && (
                    <div className="mb-4">
                      <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-2">Grup Seçin</label>
                      <div className="max-h-40 overflow-y-auto space-y-1 border border-stone-200 rounded-lg p-1">
                        {studyGroups.map(g => (
                          <button
                            key={g.id}
                            onClick={() => setSelectedGroupId(g.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                              selectedGroupId === g.id
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            <span className="font-medium">{g.name}</span>
                            <span className="text-xs text-stone-400 ml-2">({g.entries.length} not)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Create new group inline */}
                  {isCreatingGroup ? (
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-4">
                      <label className="block text-xs text-blue-600 uppercase font-bold tracking-wider mb-2">Yeni Grup Oluştur</label>
                      <input
                        type="text"
                        autoFocus
                        className="w-full p-2.5 text-sm border border-blue-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:border-blue-500 mb-3"
                        placeholder="Grup adı (örn: Hücre Bölünmesi)"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setIsCreatingGroup(false); setNewGroupName(''); }}
                          className="px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100 rounded-lg"
                        >İptal</button>
                        <button
                          onClick={handleCreateAndAdd}
                          disabled={!newGroupName.trim()}
                          className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium"
                        >Oluştur & Ekle</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsCreatingGroup(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors text-sm font-medium mb-4"
                    >
                      <IconPlus />
                      Yeni Grup Oluştur
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!groupAddSuccess && (
              <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-between">
                <button onClick={closeGroupModal} className="px-4 py-2 text-stone-500 hover:bg-stone-200 rounded-lg font-medium transition-colors text-sm">
                  İptal
                </button>
                {!isCreatingGroup && studyGroups.length > 0 && (
                  <button
                    onClick={handleGroupSave}
                    disabled={!selectedGroupId}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium text-sm transition-colors"
                  >
                    Ekle
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── RICH Dictionary Add Modal ─── */}
      {showDictModal && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="modal-header-emerald bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b border-stone-200">
                      <h3 className="text-xl font-serif text-ink">Sözlüğe Ekle</h3>
                      <p className="modal-header-label text-stone-500 text-sm mt-1">Detayları şimdi ekleyebilir veya atlayarak sonra düzenleyebilirsiniz.</p>
                  </div>

                  <div className="p-6 space-y-5">
                      <div>
                          <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1.5">Kelime</label>
                          <div className="text-xl font-serif font-medium text-ink p-3 bg-stone-50 rounded-lg border border-stone-200">
                              {selectedText}
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1.5">
                              Anlam <span className="text-stone-400 normal-case font-normal">— opsiyonel</span>
                          </label>
                          <input 
                            type="text" 
                            className="w-full p-3 border border-stone-300 bg-white text-stone-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                            placeholder="Türkçe karşılığını girin..."
                            value={dictDefinition}
                            onChange={(e) => setDictDefinition(e.target.value)}
                            autoFocus
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1.5">
                              Örnek Cümle <span className="text-stone-400 normal-case font-normal">— opsiyonel</span>
                          </label>
                          <textarea 
                            className="w-full p-3 border border-stone-300 bg-white text-stone-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none h-20 leading-relaxed"
                            placeholder="Bu kelimeyi bir cümlede kullanın..."
                            value={dictExample}
                            onChange={(e) => setDictExample(e.target.value)}
                          />
                      </div>
                      <div>
                          <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1.5">
                              Açıklama / Not <span className="text-stone-400 normal-case font-normal">— opsiyonel</span>
                          </label>
                          <textarea 
                            className="w-full p-3 border border-stone-300 bg-white text-stone-900 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none h-16 leading-relaxed"
                            placeholder="Ek bilgi, gramer notu, vb..."
                            value={dictNotes}
                            onChange={(e) => setDictNotes(e.target.value)}
                          />
                      </div>
                  </div>

                  <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-between">
                      <button onClick={closeDictModal} className="px-4 py-2.5 text-stone-500 hover:bg-stone-200 rounded-lg font-medium transition-colors">İptal</button>
                      <div className="flex gap-2">
                          <button onClick={skipToDictionary} className="px-5 py-2.5 border border-stone-300 text-stone-600 hover:bg-white rounded-lg font-medium transition-colors">Atla</button>
                          <button onClick={saveToDictionary} className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg shadow-sm font-medium transition-colors">Kaydet</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ─── Word Info Modal (Dictionary API) ─── */}
      {showWordInfoModal && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="modal-header-emerald bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b border-stone-200 flex justify-between items-center">
                      <div>
                         <h3 className="text-xl font-serif text-ink">Kelime Çevirisi</h3>
                         {wordInfo?.isLocal && <span className="modal-header-label text-xs text-emerald-600 font-medium">Sözlüğünüzden (Çevrimdışı)</span>}
                         {!wordInfo?.isLocal && wordInfo && <span className="modal-header-label text-xs text-blue-600 font-medium">dictionaryapi.dev (Çevrimiçi)</span>}
                      </div>
                      <button onClick={closeWordInfoModal} className="modal-header-close text-stone-400 hover:text-stone-600 p-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                  </div>

                  <div className="p-6">
                      {isFetchingWord ? (
                          <div className="flex flex-col items-center justify-center py-8">
                              <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
                              <p className="text-stone-500 text-sm">Kelime aranıyor...</p>
                          </div>
                      ) : wordInfoError ? (
                          <div className="text-center py-8 bg-red-50 rounded-xl border border-red-100">
                              <p className="text-red-600 font-medium mb-2">{wordInfoError}</p>
                              <p className="text-sm text-red-400 mb-4">API sadece İngilizce kelimeleri destekler.</p>
                              <button onClick={initAddToDictionary} className="px-4 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-lg text-sm hover:bg-emerald-50">
                                 Manuel Olarak Sözlüğe Ekle
                              </button>
                          </div>
                      ) : wordInfo ? (
                          <div className="space-y-4">
                              <div>
                                  <h4 className="text-2xl font-serif text-ink font-bold">{wordInfo.word}</h4>
                              </div>
                              <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                  <span className="text-xs text-stone-400 uppercase font-bold tracking-wider block mb-1">Anlam</span>
                                  <p className="text-stone-800 text-sm">{wordInfo.definition}</p>
                              </div>
                              {wordInfo.example && (
                                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                      <span className="text-xs text-stone-400 uppercase font-bold tracking-wider block mb-1">Örnek Cümle</span>
                                      <p className="text-stone-600 italic text-sm">"{wordInfo.example}"</p>
                                  </div>
                              )}
                              {/* ─── Pronunciation Row ─── */}
                              <div className="flex items-center gap-3 pt-1">
                                  <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Telaffuz</span>
                                  <button
                                      onClick={() => {
                                          const utt = new SpeechSynthesisUtterance(wordInfo.word);
                                          utt.lang = 'en-US';
                                          window.speechSynthesis.cancel();
                                          window.speechSynthesis.speak(utt);
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-xs font-medium transition-colors"
                                      title="Web tarayıcısı ile seslet"
                                  >
                                      🔊 Seslet
                                  </button>
                                  <button
                                      onClick={() => window.open(`https://youglish.com/pronounce/${encodeURIComponent(wordInfo.word)}/english`, '_blank')}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-xs font-medium transition-colors"
                                      title="YouGlish'te gerçek kullanım videolarını gör"
                                  >
                                      🎬 YouGlish'te Gör
                                  </button>
                              </div>
                          </div>
                      ) : null}
                  </div>

                  {!isFetchingWord && !wordInfoError && wordInfo && (
                      <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
                          <button onClick={closeWordInfoModal} className="px-4 py-2 text-stone-500 hover:bg-stone-200 rounded-lg font-medium transition-colors text-sm">
                              Kapat
                          </button>
                          {wordInfo.isLocal ? (
                              <button disabled className="px-5 py-2 bg-stone-100 text-stone-400 rounded-lg font-medium text-sm flex items-center gap-2 cursor-default border border-stone-200">
                                  <IconDictionary />
                                  Sözlükte Mevcut ✓
                              </button>
                          ) : (
                              <button onClick={saveWordInfoToDictionary} className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm font-medium transition-colors text-sm flex items-center gap-2">
                                  <IconDictionary />
                                  Sözlüğe Kaydet
                              </button>
                          )}
                      </div>
                  )}
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