import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { StudyGroup, Book, CHARS_PER_PAGE } from '../types';
import { IconArrowLeft, IconNotes, IconBook, IconTrash, IconPen, IconCheck, IconChevronDown, IconPlay, IconX } from './Icons';

interface StudyNotesProps {
  groups: StudyGroup[];
  books: Book[];
  onBack: () => void;
  onUpdateGroup: (group: StudyGroup) => void;
  onDeleteGroup: (id: string) => void;
  onDeleteEntry: (groupId: string, entryId: string) => void;
}

export const StudyNotes: React.FC<StudyNotesProps> = ({
  groups,
  books,
  onBack,
  onUpdateGroup,
  onDeleteGroup,
  onDeleteEntry,
}) => {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  // Drag & drop state
  const [dragEntryId, setDragEntryId] = useState<string | null>(null);
  const [dragOverEntryId, setDragOverEntryId] = useState<string | null>(null);

  // Entry editing state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryText, setEditEntryText] = useState('');

  // Practice mode state
  const [practiceGroup, setPracticeGroup] = useState<StudyGroup | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practicePageStart, setPracticePageStart] = useState(0);

  // ─── Books that have study groups ──
  const booksWithGroups = useMemo(() => {
    const bookIds = new Set(groups.map(g => g.bookId));
    return books.filter(b => bookIds.has(b.id));
  }, [groups, books]);

  // ─── Filtered & grouped by letter ──
  const filteredAndGrouped = useMemo(() => {
    let filtered = groups.filter(g => {
      const matchesSearch = searchTerm === '' || 
        g.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBook = selectedBookId === null || g.bookId === selectedBookId;
      return matchesSearch && matchesBook;
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    const letterGroups: Record<string, StudyGroup[]> = {};
    filtered.forEach(g => {
      const letter = g.name.charAt(0).toUpperCase();
      if (!letterGroups[letter]) letterGroups[letter] = [];
      letterGroups[letter].push(g);
    });

    const sortedKeys = Object.keys(letterGroups).sort((a, b) => a.localeCompare(b, 'tr'));
    return { letterGroups, sortedKeys, totalCount: filtered.length };
  }, [groups, searchTerm, selectedBookId]);

  // ─── Handlers ──
  const toggleExpand = (id: string) => {
    if (editingGroupId === id) return;
    setExpandedGroupId(prev => prev === id ? null : id);
    setEditingGroupId(null);
  };

  const startEditingGroup = (group: StudyGroup, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroupId(group.id);
    setExpandedGroupId(group.id);
    setEditGroupName(group.name);
  };

  const saveEditGroup = (group: StudyGroup) => {
    if (editGroupName.trim()) {
      onUpdateGroup({ ...group, name: editGroupName.trim() });
    }
    setEditingGroupId(null);
  };

  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      onDeleteGroup(groupToDelete);
      if (expandedGroupId === groupToDelete) setExpandedGroupId(null);
      setGroupToDelete(null);
    }
  };

  const getBookTitle = (bookId: string) => {
    const book = books.find(b => b.id === bookId);
    return book ? book.title : 'Silinmiş Kitap';
  };

  // ─── Drag & Drop reorder ──
  const handleDragStart = (entryId: string) => {
    setDragEntryId(entryId);
  };

  const handleDragOver = (e: React.DragEvent, entryId: string) => {
    e.preventDefault();
    setDragOverEntryId(entryId);
  };

  const handleDrop = (group: StudyGroup, targetEntryId: string) => {
    if (!dragEntryId || dragEntryId === targetEntryId) {
      setDragEntryId(null);
      setDragOverEntryId(null);
      return;
    }

    const entries = [...group.entries];
    const fromIndex = entries.findIndex(e => e.id === dragEntryId);
    const toIndex = entries.findIndex(e => e.id === targetEntryId);

    if (fromIndex === -1 || toIndex === -1) return;

    // SWAP: exchange positions
    const temp = entries[fromIndex];
    entries[fromIndex] = entries[toIndex];
    entries[toIndex] = temp;

    onUpdateGroup({ ...group, entries });
    setDragEntryId(null);
    setDragOverEntryId(null);
  };

  const handleDragEnd = () => {
    setDragEntryId(null);
    setDragOverEntryId(null);
  };

  // ─── Practice Mode ──
  const practiceContent = useMemo(() => {
    if (!practiceGroup) return '';
    return practiceGroup.entries.map(e => e.text).join(' ');
  }, [practiceGroup]);

  const startPractice = (group: StudyGroup) => {
    setPracticeGroup(group);
    setPracticeIndex(group.progressIndex || 0);
    setPracticePageStart(0); // Will be synced by useEffect
  };

  const closePractice = () => {
    if (practiceGroup) {
      onUpdateGroup({ ...practiceGroup, progressIndex: practiceIndex });
    }
    setPracticeGroup(null);
    setPracticeIndex(0);
    setPracticePageStart(0);
  };

  // Stable ref for onUpdateGroup to avoid infinite effect loop
  const onUpdateGroupRef = useRef(onUpdateGroup);
  useEffect(() => { onUpdateGroupRef.current = onUpdateGroup; }, [onUpdateGroup]);

  // Auto-save progress
  useEffect(() => {
    if (practiceGroup && practiceIndex !== practiceGroup.progressIndex) {
      const timeout = setTimeout(() => {
        onUpdateGroupRef.current({ ...practiceGroup, progressIndex: practiceIndex });
        setPracticeGroup(prev => prev ? { ...prev, progressIndex: practiceIndex } : null);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [practiceIndex, practiceGroup]);

  // Practice page sync
  useEffect(() => {
    if (!practiceGroup) return;
    const newPageStart = Math.floor(practiceIndex / CHARS_PER_PAGE) * CHARS_PER_PAGE;
    setPracticePageStart(newPageStart);
  }, [practiceIndex, practiceGroup]);

  // Practice keyboard handler
  const practiceCharRef = useRef<HTMLSpanElement>(null);

  const handlePracticeKeyDown = useCallback((e: KeyboardEvent) => {
    if (!practiceGroup) return;

    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.key === 'Backspace') {
      if (practiceIndex > 0) {
        setPracticeIndex(prev => prev - 1);
      }
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const expectedChar = practiceContent[practiceIndex];
      if (expectedChar && e.key === expectedChar) {
        setPracticeIndex(prev => prev + 1);
      } else if (expectedChar && expectedChar === '\n' && e.key === 'Enter') {
        setPracticeIndex(prev => prev + 1);
      }
    }
  }, [practiceIndex, practiceContent, practiceGroup]);

  useEffect(() => {
    if (!practiceGroup) return;
    window.addEventListener('keydown', handlePracticeKeyDown);
    return () => window.removeEventListener('keydown', handlePracticeKeyDown);
  }, [handlePracticeKeyDown, practiceGroup]);

  useEffect(() => {
    if (practiceCharRef.current) {
      practiceCharRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [practiceIndex]);

  const practiceTotalPages = practiceContent ? Math.ceil(practiceContent.length / CHARS_PER_PAGE) : 0;
  const practiceCurrentPage = practiceContent ? Math.floor(practiceIndex / CHARS_PER_PAGE) + 1 : 0;
  const practicePageContent = practiceContent.slice(practicePageStart, practicePageStart + CHARS_PER_PAGE);
  const practiceProgress = practiceContent ? Math.min(100, (practiceIndex / practiceContent.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
      {/* ─── HEADER ─── */}
      <header className="flex items-center gap-4 mb-8 mt-2 border-b border-stone-300 pb-6 shrink-0">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-stone-200 transition-colors">
          <IconArrowLeft />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-serif text-ink tracking-tight">Ders Notlarım</h1>
          <p className="text-stone-500 font-sans text-sm">{groups.length} Grup</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-8 flex-1">
        {/* ─── SIDEBAR ─── */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-1">
          <h3 className="font-serif text-lg text-ink font-medium mb-3 px-2">Kitaplar</h3>

          <button
            onClick={() => setSelectedBookId(null)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              selectedBookId === null
                ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <IconNotes />
            <span>Tüm Notlar</span>
            <span className="ml-auto text-xs px-2 py-0.5 bg-stone-100 rounded-full text-stone-500">{groups.length}</span>
          </button>

          <div className="h-px bg-stone-200 my-2 mx-2"></div>

          <div className="overflow-y-auto max-h-[50vh] flex flex-col gap-1">
            {booksWithGroups.length === 0 ? (
              <p className="text-xs text-stone-400 px-4 py-3 italic">
                Henüz grup oluşturulmuş kitap yok.
              </p>
            ) : (
              booksWithGroups.map(book => {
                const groupCount = groups.filter(g => g.bookId === book.id).length;
                return (
                  <button
                    key={book.id}
                    onClick={() => setSelectedBookId(book.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                      selectedBookId === book.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <IconBook />
                    <span className="truncate flex-1">{book.title}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 bg-stone-100 rounded-full text-stone-500 shrink-0">{groupCount}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <div className="flex-1 flex flex-col">
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Grup adı ara..."
              className="w-full p-3 rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-stone-900 placeholder:text-stone-400 transition-colors"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Info bar */}
          {selectedBookId && (
            <div className="mb-4 px-1">
              <p className="text-sm text-stone-500">
                <span className="font-medium text-ink">{getBookTitle(selectedBookId)}</span> kitabında {filteredAndGrouped.totalCount} grup
              </p>
            </div>
          )}

          {filteredAndGrouped.totalCount === 0 ? (
            <div className="text-center py-20 bg-stone-50 rounded-xl border border-stone-100 border-dashed">
              <div className="text-stone-300 mb-3 flex justify-center"><IconNotes /></div>
              <p className="text-stone-400">
                {searchTerm ? 'Aramanızla eşleşen grup bulunamadı.' : 'Henüz ders notu grubu yok.'}
              </p>
              <p className="text-stone-400 text-sm mt-1">
                Ders Çalışma modunda metin seçerek gruplara ekleyebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredAndGrouped.sortedKeys.map(letter => (
                <div key={letter}>
                  {/* Letter Header */}
                  <div className="flex items-center gap-3 mb-3 sticky top-0 bg-paper py-1 z-10">
                    <span className="text-2xl font-serif font-bold text-blue-600 w-8">{letter}</span>
                    <div className="flex-1 h-px bg-stone-200"></div>
                    <span className="text-xs text-stone-400">{filteredAndGrouped.letterGroups[letter].length}</span>
                  </div>

                  {/* Groups */}
                  <div className="space-y-1">
                    {filteredAndGrouped.letterGroups[letter].map(group => {
                      const isExpanded = expandedGroupId === group.id;
                      const isEditing = editingGroupId === group.id;

                      return (
                        <div
                          key={group.id}
                          className={`rounded-xl border transition-all duration-200 ${
                            isExpanded
                              ? 'bg-white border-stone-300 shadow-sm'
                              : 'bg-white border-stone-100 hover:border-stone-200 hover:shadow-sm'
                          }`}
                        >
                          {/* Group Row */}
                          <div
                            className="flex items-center gap-3 px-5 py-3.5 cursor-pointer group"
                            onClick={() => toggleExpand(group.id)}
                          >
                            <span className="text-stone-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                              <IconChevronDown />
                            </span>

                            {isEditing ? (
                              <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  autoFocus
                                  className="flex-1 p-1.5 text-sm border border-blue-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:border-blue-500"
                                  value={editGroupName}
                                  onChange={e => setEditGroupName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && saveEditGroup(group)}
                                />
                                <button onClick={() => saveEditGroup(group)} className="p-1 text-blue-600"><IconCheck /></button>
                              </div>
                            ) : (
                              <h3 className="font-serif text-lg text-ink font-medium flex-1">{group.name}</h3>
                            )}

                            {!isEditing && (
                              <span className="text-xs text-stone-400">{group.entries.length} not</span>
                            )}

                            {/* Action buttons */}
                            {!isEditing && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={e => startEditingGroup(group, e)}
                                  className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Yeniden Adlandır"
                                >
                                  <IconPen />
                                </button>
                                <button
                                  onClick={() => setGroupToDelete(group.id)}
                                  className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Sil"
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Expanded Content */}
                          {isExpanded && !isEditing && (
                            <div className="px-5 pb-4 pt-1 border-t border-stone-100 animate-in fade-in slide-in-from-top-1 duration-200">
                              {/* Source book */}
                              <div className="flex items-center gap-2 mb-3 pt-2">
                                <IconBook />
                                <span className="text-xs text-stone-400">{getBookTitle(group.bookId)}</span>
                              </div>

                              {/* Entries list */}
                              {group.entries.length === 0 ? (
                                <p className="text-sm text-stone-400 italic py-3">Bu grupta henüz not yok.</p>
                              ) : (
                                <div className="space-y-1.5 mb-4">
                                  {group.entries.map((entry, idx) => (
                                    <div
                                      key={entry.id}
                                      draggable={editingEntryId !== entry.id}
                                      onDragStart={() => handleDragStart(entry.id)}
                                      onDragOver={(e) => handleDragOver(e, entry.id)}
                                      onDrop={() => handleDrop(group, entry.id)}
                                      onDragEnd={handleDragEnd}
                                      className={`flex items-start gap-2 p-3 rounded-lg border transition-all ${
                                        editingEntryId === entry.id
                                          ? 'border-blue-300 bg-blue-50/50'
                                          : dragEntryId === entry.id
                                            ? 'opacity-40 border-blue-300 bg-blue-50 cursor-grab'
                                            : dragOverEntryId === entry.id
                                              ? 'border-blue-400 bg-blue-50 shadow-sm cursor-grab'
                                              : 'bg-stone-50 border-stone-100 hover:border-stone-200 cursor-grab active:cursor-grabbing'
                                      }`}
                                    >
                                      {/* Drag handle */}
                                      {editingEntryId !== entry.id && (
                                        <span className="text-stone-300 hover:text-stone-500 mt-0.5 shrink-0 select-none text-lg leading-none" title="Sürükle">⠇</span>
                                      )}
                                      <span className="text-xs text-stone-400 font-mono mt-0.5 shrink-0">{idx + 1}.</span>

                                      {editingEntryId === entry.id ? (
                                        /* ─── EDIT MODE ─── */
                                        <div className="flex-1 flex flex-col gap-2">
                                          <textarea
                                            autoFocus
                                            className="w-full p-2 text-sm border border-blue-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                                            rows={3}
                                            value={editEntryText}
                                            onChange={e => setEditEntryText(e.target.value)}
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button
                                              onClick={() => setEditingEntryId(null)}
                                              className="px-3 py-1 text-xs text-stone-500 hover:bg-stone-100 rounded-lg"
                                            >İptal</button>
                                            <button
                                              onClick={() => {
                                                if (editEntryText.trim()) {
                                                  const updatedEntries = group.entries.map(e =>
                                                    e.id === entry.id ? { ...e, text: editEntryText.trim() } : e
                                                  );
                                                  onUpdateGroup({ ...group, entries: updatedEntries });
                                                }
                                                setEditingEntryId(null);
                                              }}
                                              disabled={!editEntryText.trim()}
                                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1"
                                            >
                                              <IconCheck />
                                              Kaydet
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        /* ─── VIEW MODE ─── */
                                        <p className="text-sm text-stone-700 flex-1 leading-relaxed select-none">"{entry.text}"</p>
                                      )}

                                      {/* Action buttons */}
                                      {editingEntryId !== entry.id && (
                                        <div className="flex gap-0.5 shrink-0">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setEditingEntryId(entry.id); setEditEntryText(entry.text); }}
                                            className="p-1 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                            title="Düzenle"
                                          >
                                            <IconPen />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteEntry(group.id, entry.id); }}
                                            className="p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                                            title="Sil"
                                          >
                                            <IconTrash />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Practice button */}
                              {group.entries.length > 0 && (
                                <button
                                  onClick={() => startPractice(group)}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
                                >
                                  <IconPlay />
                                  Pratik Yap
                                </button>
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

      {/* ─── Delete Group Confirmation Modal ─── */}
      {groupToDelete && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-stone-200 p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-serif text-ink mb-2">Grubu Sil</h3>
            <p className="text-stone-500 text-sm mb-6">
              Bu grup ve içindeki tüm notlar kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setGroupToDelete(null)} className="px-4 py-2 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors font-medium text-sm">
                Vazgeç
              </button>
              <button onClick={confirmDeleteGroup} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium text-sm shadow-sm">
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Practice Mode Overlay ─── */}
      {practiceGroup && (
        <div className="fixed inset-0 bg-paper z-[200] flex flex-col">
          {/* Practice Top Bar */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-paper shrink-0">
            <button
              onClick={closePractice}
              className="flex items-center gap-2 text-stone-500 hover:text-ink transition-colors"
            >
              <IconArrowLeft />
              <span className="font-medium">Geri</span>
            </button>
            <div className="flex flex-col items-center">
              <h2 className="font-serif text-ink font-medium text-lg">{practiceGroup.name}</h2>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 rounded-full">Pratik Modu</span>
            </div>
            <div className="text-stone-400 font-mono text-sm">
              {practiceCurrentPage} / {practiceTotalPages}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-6 pt-2 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between text-xs text-stone-400 mb-1">
                <span>İlerleme</span>
                <span>%{practiceProgress.toFixed(0)}</span>
              </div>
              <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${practiceProgress}%` }}></div>
              </div>
            </div>
          </div>

          {/* Practice Typing Area */}
          <div className="flex-1 overflow-y-auto p-8 md:p-16 flex justify-center no-scrollbar">
            <div className="max-w-4xl w-full leading-relaxed tracking-wide font-serif text-2xl md:text-3xl pb-32">
              {practicePageContent.split('').map((char, idx) => {
                const globalIndex = practicePageStart + idx;
                const isTyped = globalIndex < practiceIndex;
                const isCurrent = globalIndex === practiceIndex;

                let className = "transition-all duration-100 relative cursor-pointer hover:bg-stone-200 hover:text-stone-700 rounded-sm ";
                if (isTyped) {
                  className += "text-ink opacity-100 ";
                } else if (isCurrent) {
                  className += "text-stone-500 bg-stone-200 opacity-100 border-b-2 border-blue-500 ";
                } else {
                  className += "text-stone-400 opacity-100 ";
                }

                return (
                  <span
                    key={globalIndex}
                    className={className}
                    ref={isCurrent ? practiceCharRef : null}
                    onClick={() => setPracticeIndex(globalIndex)}
                    title="Buradan başla"
                  >
                    {char}
                  </span>
                );
              })}

              {/* Completion message */}
              {practiceIndex >= practiceContent.length && practiceContent.length > 0 && (
                <div className="mt-12 text-center">
                  <div className="text-4xl mb-3">🎉</div>
                  <h3 className="text-2xl font-serif text-ink mb-2">Tebrikler!</h3>
                  <p className="text-stone-500">Bu grubun pratiğini tamamladınız.</p>
                  <button
                    onClick={closePractice}
                    className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm"
                  >
                    Geri Dön
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Practice Bottom Bar */}
          <div className="px-8 py-6 border-t border-stone-200 bg-stone-50 shrink-0">
            <div className="max-w-3xl mx-auto flex items-center gap-4">
              <span className="text-xs font-sans text-stone-400 uppercase tracking-wider w-16">Sayfa</span>
              <input
                type="range"
                min="1"
                max={practiceTotalPages || 1}
                value={practiceCurrentPage}
                onChange={e => {
                  const page = parseInt(e.target.value);
                  const newIndex = (page - 1) * CHARS_PER_PAGE;
                  setPracticeIndex(newIndex);
                }}
                className="flex-1 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all"
              />
              <span className="text-xs font-sans text-stone-600 font-bold w-8 text-right">{practiceCurrentPage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
