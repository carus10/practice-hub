import React, { useState, useMemo } from 'react';
import { DictionaryItem, Book } from '../types';
import { IconArrowLeft, IconTrash, IconPen, IconCheck, IconDictionary, IconChevronDown, IconChevronRight, IconBook, IconX } from './Icons';
import { PracticeMode } from './PracticeMode';

interface DictionaryProps {
  items: DictionaryItem[];
  books: Book[];
  onUpdateItem: (item: DictionaryItem) => void;
  onDeleteItem: (id: string) => void;
  onBack: () => void;
}

export const Dictionary: React.FC<DictionaryProps> = ({ 
  items, 
  books,
  onUpdateItem, 
  onDeleteItem, 
  onBack 
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null); // null = All
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  
  // Edit state fields
  const [editDefinition, setEditDefinition] = useState('');
  const [editExamples, setEditExamples] = useState<string[]>([]);
  const [editNotes, setEditNotes] = useState('');

  // Quick Add Example state
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddItemId, setQuickAddItemId] = useState<string | null>(null);

  // Item to delete modal
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // ─── BOOKS THAT HAVE WORDS ─────────────────────────────────────
  const booksWithWords = useMemo(() => {
    const bookIds = new Set(items.map(i => i.sourceBookId).filter(Boolean));
    return books.filter(b => bookIds.has(b.id));
  }, [items, books]);

  // ─── FILTERED & SORTED ITEMS ──────────────────────────────────
  const filteredAndGrouped = useMemo(() => {
    // Step 1: Filter
    let filtered = items.filter(item => {
      const matchesSearch = searchTerm === '' || 
        item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.definition.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBook = selectedBookId === null || item.sourceBookId === selectedBookId;

      return matchesSearch && matchesBook;
    });

    // Step 2: Sort alphabetically
    filtered.sort((a, b) => a.word.localeCompare(b.word, 'tr'));

    // Step 3: Group by first letter
    const groups: Record<string, DictionaryItem[]> = {};
    filtered.forEach(item => {
      const letter = item.word.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(item);
    });

    // Step 4: Sort group keys
    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'tr'));
    
    return { groups, sortedKeys, totalCount: filtered.length };
  }, [items, searchTerm, selectedBookId]);

  // ─── HANDLERS ─────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    if (editingItemId === id) return; // don't collapse while editing
    setExpandedItemId(prev => prev === id ? null : id);
    setEditingItemId(null); // close any open edit
  };

  const startEditing = (item: DictionaryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItemId(item.id);
    setExpandedItemId(item.id);
    setEditDefinition(item.definition || '');
    setEditExamples([...(item.exampleSentences || (item.exampleSentence ? [item.exampleSentence] : []))]);
    setEditNotes(item.notes || '');
    setQuickAddItemId(null);
  };

  const saveEdit = (item: DictionaryItem) => {
    const validExamples = editExamples.filter(e => e.trim() !== '');
    onUpdateItem({
      ...item,
      definition: editDefinition,
      exampleSentence: validExamples[0] || '',
      exampleSentences: validExamples,
      notes: editNotes,
    });
    setEditingItemId(null);
  };

  const handleQuickAdd = (item: DictionaryItem) => {
    if (!quickAddText.trim()) return;
    const currentExamples = item.exampleSentences || (item.exampleSentence ? [item.exampleSentence] : []);
    const newExamples = [...currentExamples, quickAddText.trim()];
    
    onUpdateItem({
        ...item,
        exampleSentence: newExamples[0] || '',
        exampleSentences: newExamples
    });
    setQuickAddText('');
    setQuickAddItemId(null);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      onDeleteItem(itemToDelete);
      if (expandedItemId === itemToDelete) setExpandedItemId(null);
      if (editingItemId === itemToDelete) setEditingItemId(null);
      setItemToDelete(null);
    }
  };

  const getBookTitle = (bookId?: string) => {
    if (!bookId) return 'Bilinmiyor';
    const book = books.find(b => b.id === bookId);
    return book ? book.title : 'Silinmiş Kitap';
  };

  if (isPracticing) {
      return <PracticeMode items={items} onUpdateItem={onUpdateItem} onExit={() => setIsPracticing(false)} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 mb-8 mt-2 border-b border-stone-300 pb-6 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 rounded-full hover:bg-stone-200 transition-colors"
        >
          <IconArrowLeft />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-serif text-ink tracking-tight">Sözlüğüm</h1>
          <p className="text-stone-500 font-sans text-sm">{items.length} Kelime</p>
        </div>
        
        {items.length > 0 && (
            <button 
              onClick={() => setIsPracticing(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all font-medium text-sm group"
            >
              <span className="text-xl group-hover:animate-spin">✨</span>
              Pratik Yap
            </button>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-8 flex-1">
        {/* ─── SIDEBAR: Book-based notebooks ─── */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-1">
            <h3 className="font-serif text-lg text-ink font-medium mb-3 px-2">Kelime Defterleri</h3>

            <button
                onClick={() => setSelectedBookId(null)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  selectedBookId === null 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' 
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
            >
                <IconDictionary />
                <span>Tüm Kelimeler</span>
                <span className="ml-auto text-xs px-2 py-0.5 bg-stone-100 rounded-full text-stone-500">{items.length}</span>
            </button>

            <div className="h-px bg-stone-200 my-2 mx-2"></div>

            <div className="overflow-y-auto max-h-[50vh] flex flex-col gap-1">
                {booksWithWords.length === 0 ? (
                    <p className="text-xs text-stone-400 px-4 py-3 italic">
                        Henüz kelime eklenmiş kitap yok.
                    </p>
                ) : (
                    booksWithWords.map(book => {
                        const wordCount = items.filter(i => i.sourceBookId === book.id).length;
                        return (
                            <button
                                key={book.id}
                                onClick={() => setSelectedBookId(book.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                                  selectedBookId === book.id 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' 
                                    : 'text-stone-600 hover:bg-stone-100'
                                }`}
                            >
                                <IconBook />
                                <span className="truncate flex-1">{book.title}</span>
                                <span className="ml-auto text-xs px-2 py-0.5 bg-stone-100 rounded-full text-stone-500 shrink-0">
                                    {wordCount}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
        </aside>

        {/* ─── MAIN CONTENT: Alphabetical word list ─── */}
        <div className="flex-1 flex flex-col">
            {/* Search */}
            <div className="mb-6">
                <input 
                  type="text" 
                  placeholder="Kelime ara..." 
                  className="w-full p-3 rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 text-stone-900 placeholder:text-stone-400 transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Word count info */}
            {selectedBookId && (
                <div className="mb-4 px-1">
                    <p className="text-sm text-stone-500">
                        <span className="font-medium text-ink">{getBookTitle(selectedBookId)}</span> defterinde {filteredAndGrouped.totalCount} kelime
                    </p>
                </div>
            )}

            {filteredAndGrouped.totalCount === 0 ? (
                <div className="text-center py-20 bg-stone-50 rounded-xl border border-stone-100 border-dashed">
                    <div className="text-stone-300 mb-3 flex justify-center"><IconDictionary /></div>
                    <p className="text-stone-400">
                        {searchTerm ? 'Aramanızla eşleşen kelime bulunamadı.' : 'Bu defterde henüz kelime yok.'}
                    </p>
                    <p className="text-stone-400 text-sm mt-1">
                        Dil Öğrenme modunda bir metni açıp kelime seçerek ekleyebilirsiniz.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredAndGrouped.sortedKeys.map(letter => (
                        <div key={letter}>
                            {/* Letter Header */}
                            <div className="flex items-center gap-3 mb-3 sticky top-0 bg-paper py-1 z-10">
                                <span className="text-2xl font-serif font-bold text-emerald-600 w-8">{letter}</span>
                                <div className="flex-1 h-px bg-stone-200"></div>
                                <span className="text-xs text-stone-400">{filteredAndGrouped.groups[letter].length}</span>
                            </div>

                            {/* Words in this letter group */}
                            <div className="space-y-1">
                                {filteredAndGrouped.groups[letter].map(item => {
                                    const isExpanded = expandedItemId === item.id;
                                    const isEditing = editingItemId === item.id;

                                    return (
                                        <div 
                                            key={item.id} 
                                            className={`rounded-xl border transition-all duration-200 ${
                                              isExpanded 
                                                ? 'bg-white border-stone-300 shadow-sm' 
                                                : 'bg-white border-stone-100 hover:border-stone-200 hover:shadow-sm'
                                            }`}
                                        >
                                            {/* Word Row (Clickable) */}
                                            <div 
                                                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group"
                                                onClick={() => toggleExpand(item.id)}
                                            >
                                                <span className="text-stone-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                                    <IconChevronDown />
                                                </span>
                                                <h3 className="font-serif text-lg text-ink font-medium flex-1">{item.word}</h3>
                                                {item.definition && !isExpanded && (
                                                    <span className="text-sm text-stone-400 truncate max-w-[200px] hidden sm:inline">
                                                        {item.definition}
                                                    </span>
                                                )}
                                                {/* Action buttons on hover */}
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        onClick={(e) => startEditing(item, e)}
                                                        className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                        title="Düzenle"
                                                    >
                                                        <IconPen />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); }}
                                                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Sil"
                                                    >
                                                        <IconTrash />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="px-5 pb-4 pt-1 border-t border-stone-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    {isEditing ? (
                                                        /* ─── EDIT MODE ─── */
                                                        <div className="space-y-4 pt-3">
                                                            <div>
                                                                <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1">Anlam</label>
                                                                <input 
                                                                    type="text"
                                                                    className="w-full p-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 bg-white text-stone-900"
                                                                    value={editDefinition}
                                                                    onChange={(e) => setEditDefinition(e.target.value)}
                                                                    placeholder="Anlamını girin..."
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div>
                                                                <div className="flex justify-between items-end mb-1">
                                                                    <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider">Örnek Cümleler</label>
                                                                    <button 
                                                                        onClick={() => setEditExamples([...editExamples, ''])}
                                                                        className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                                                                    >
                                                                        + Yeni Ekle
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {editExamples.map((ex, idx) => (
                                                                        <div key={idx} className="flex gap-2">
                                                                            <textarea 
                                                                                className="flex-1 p-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 bg-white text-stone-900 resize-none h-12"
                                                                                value={ex}
                                                                                onChange={(e) => {
                                                                                    const newExs = [...editExamples];
                                                                                    newExs[idx] = e.target.value;
                                                                                    setEditExamples(newExs);
                                                                                }}
                                                                                placeholder="Bir örnek cümle yazın..."
                                                                            />
                                                                            <button 
                                                                                onClick={() => setEditExamples(editExamples.filter((_, i) => i !== idx))}
                                                                                className="p-2 text-stone-400 hover:text-red-500 rounded-lg shrink-0"
                                                                            >
                                                                                <IconTrash />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {editExamples.length === 0 && (
                                                                        <p className="text-sm text-stone-400 italic">Örnek cümle yok. Eklemek için "+ Yeni Ekle"ye tıklayın.</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-stone-500 uppercase font-bold tracking-wider mb-1">Açıklama / Not</label>
                                                                <textarea 
                                                                    className="w-full p-2.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 bg-white text-stone-900 resize-none h-14"
                                                                    value={editNotes}
                                                                    onChange={(e) => setEditNotes(e.target.value)}
                                                                    placeholder="Ek açıklama, gramer notu..."
                                                                />
                                                            </div>
                                                            <div className="flex justify-end gap-2 pt-1">
                                                                <button 
                                                                    onClick={cancelEdit} 
                                                                    className="px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
                                                                >
                                                                    İptal
                                                                </button>
                                                                <button 
                                                                    onClick={() => saveEdit(item)} 
                                                                    className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                                                >
                                                                    <IconCheck />
                                                                    Kaydet
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* ─── VIEW MODE ─── */
                                                        <div className="space-y-3 pt-3">
                                                            {/* Anlam */}
                                                            <div>
                                                                <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Anlam</span>
                                                                <p className={`text-sm mt-0.5 ${item.definition ? 'text-stone-700' : 'text-stone-400 italic'}`}>
                                                                    {item.definition || 'Henüz anlam eklenmedi'}
                                                                </p>
                                                            </div>
                                                            
                                                            {/* Örnek Cümleler */}
                                                            <div>
                                                                <span className="text-xs text-stone-400 uppercase font-bold tracking-wider mb-2 block">Örnek Cümleler</span>
                                                                {item.exampleSentences && item.exampleSentences.length > 0 ? (
                                                                    <div className="space-y-2 mt-1">
                                                                        {item.exampleSentences.map((ex, i) => (
                                                                            <p key={i} className="text-sm text-stone-700 italic border-l-2 border-emerald-200 pl-3">
                                                                                "{ex}"
                                                                            </p>
                                                                        ))}
                                                                    </div>
                                                                ) : item.exampleSentence ? (
                                                                     <div className="space-y-2 mt-1">
                                                                        <p className="text-sm text-stone-700 italic border-l-2 border-emerald-200 pl-3">
                                                                            "{item.exampleSentence}"
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-stone-400 italic">
                                                                        Henüz örnek cümle eklenmedi
                                                                    </p>
                                                                )}
                                                                
                                                                {/* Quick Add Inline */}
                                                                <div className="mt-3">
                                                                    {quickAddItemId === item.id ? (
                                                                        <div className="flex gap-2 items-start mt-2">
                                                                            <textarea
                                                                                className="flex-1 p-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-500 resize-none h-12 bg-white"
                                                                                placeholder="Yeni örnek cümle yazın..."
                                                                                value={quickAddText}
                                                                                onChange={(e) => setQuickAddText(e.target.value)}
                                                                                autoFocus
                                                                            />
                                                                            <div className="flex flex-col gap-1 shrink-0">
                                                                                <button onClick={() => handleQuickAdd(item)} className="p-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded">
                                                                                    <IconCheck />
                                                                                </button>
                                                                                <button onClick={() => { setQuickAddItemId(null); setQuickAddText(''); }} className="p-1 bg-stone-100 text-stone-500 hover:bg-stone-200 rounded">
                                                                                    <IconX />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <button 
                                                                            onClick={() => { setQuickAddItemId(item.id); setQuickAddText(''); }}
                                                                            className="text-xs text-emerald-600 font-medium hover:text-emerald-700 inline-flex items-center gap-1 mt-1"
                                                                        >
                                                                            + Yeni Örnek Cümle Ekle
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Açıklama (sadece varsa göster) */}
                                                            {item.notes ? (
                                                                <div>
                                                                    <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Açıklama</span>
                                                                    <p className="text-sm mt-0.5 text-stone-600">{item.notes}</p>
                                                                </div>
                                                            ) : null}

                                                            {/* Kaynak kitap */}
                                                            {item.sourceBookId && (
                                                                <div className="pt-2 border-t border-stone-100 flex items-center gap-2">
                                                                    <IconBook />
                                                                    <span className="text-xs text-stone-400">{getBookTitle(item.sourceBookId)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* ─── Delete Confirmation Modal ─── */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-stone-200 p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-serif text-ink mb-2">Kelimeyi Sil</h3>
            <p className="text-stone-500 text-sm mb-6">
              Bu kelime sözlükten kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors font-medium text-sm"
              >
                Vazgeç
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};