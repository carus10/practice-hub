import React, { useState, useRef, useEffect } from 'react';
import { Book, BookMode, ProcessingState } from '../types';
import { extractTextFromPdf, extractCoverFromPdf } from '../services/pdfService';
import { IconPlus, IconBook, IconTrash, IconUpload, IconRepeat, IconDictionary, IconStudy, IconLanguage, IconNotes } from './Icons';

interface LibraryProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onAddBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onUpdateBook: (book: Book) => void;
  onOpenDictionary: () => void;
  onOpenStudyNotes: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Library: React.FC<LibraryProps> = ({ books, onSelectBook, onAddBook, onDeleteBook, onUpdateBook, onOpenDictionary, onOpenStudyNotes, isDark, onToggleTheme }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'pdf'>('paste');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookContent, setNewBookContent] = useState('');
  const [selectedMode, setSelectedMode] = useState<BookMode>('normal');
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, message: '' });
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const [newBookCover, setNewBookCover] = useState<string | undefined>(undefined);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, bookId: string } | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  
  // New features state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | BookMode>('all');
  const [greeting, setGreeting] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    
    // Greeting logic
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Günaydın');
    else if (hour < 18) setGreeting('İyi Günler');
    else setGreeting('İyi Akşamlar');
    
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, bookId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      bookId
    });
  };

  const handleEditCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBookId) return;
    
    if (!file.type.startsWith('image/')) {
       alert('Lütfen geçerli bir resim dosyası seçin.');
       return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const scale = Math.min(1.0, 400 / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const coverData = canvas.toDataURL('image/jpeg', 0.8);
            
            const book = books.find(b => b.id === editingBookId);
            if (book) {
                onUpdateBook({ ...book, coverImage: coverData });
            }
            setEditingBookId(null);
        };
        if (typeof event.target?.result === 'string') {
            img.src = event.target.result;
        }
    };
    reader.readAsDataURL(file);
  };

  const getMeshGradient = (id: string) => {
    const gradients = [
      'bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500',
      'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600',
      'bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500',
      'bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600',
      'bg-gradient-to-br from-stone-400 via-stone-500 to-stone-700',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
       alert('Lütfen geçerli bir resim dosyası seçin.');
       return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            const scale = Math.min(1.0, 400 / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            setNewBookCover(canvas.toDataURL('image/jpeg', 0.8));
        };
        if (typeof event.target?.result === 'string') {
            img.src = event.target.result;
        }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Lütfen geçerli bir PDF dosyası seçin.');
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      alert('Dosya boyutu 30MB\'dan büyük olamaz.');
      return;
    }

    setProcessing({ isProcessing: true, message: 'PDF analiz ediliyor, lütfen bekleyin...' });

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Extract cover in parallel
      const arrayBufferCopy = arrayBuffer.slice(0);
      extractCoverFromPdf(arrayBufferCopy).then(cover => {
          if (cover) setNewBookCover(cover);
      }).catch(err => console.error("Cover extraction failed:", err));

      const extractedText = await extractTextFromPdf(arrayBuffer);
      setNewBookContent(extractedText);
      if (!newBookTitle) {
        setNewBookTitle(file.name.replace(/\.pdf$/i, ''));
      }
      setProcessing({ isProcessing: false, message: '' });
    } catch (error: unknown) {
      setProcessing({ isProcessing: false, message: '' });
      const msg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      alert(`PDF okunamadı: ${msg}`);
      console.error(error);
    }
  };

  const handleSave = () => {
    if (!newBookTitle.trim() || !newBookContent.trim()) return;

    let finalContent = newBookContent.replace(/\s+/g, ' ').trim();

    // Apply repetition logic if count is greater than 1
    if (repeatCount > 1) {
      finalContent = Array(repeatCount).fill(finalContent).join(' ');
    }

    const newBook: Book = {
      id: crypto.randomUUID(),
      title: newBookTitle,
      content: finalContent,
      progressIndex: 0,
      createdAt: Date.now(),
      mode: selectedMode,
      highlights: [],
      coverImage: newBookCover,
    };

    onAddBook(newBook);
    setIsModalOpen(false);
    
    // Reset form
    setNewBookTitle('');
    setNewBookContent('');
    setNewBookCover(undefined);
    setRepeatCount(1);
    setSelectedMode('normal');
  };

  const getModeLabel = (mode: BookMode) => {
    switch (mode) {
      case 'language': return 'Dil Öğrenme';
      case 'study': return 'Ders Çalışma';
      default: return 'Normal';
    }
  };

  const getModeIcon = (mode: BookMode) => {
    switch (mode) {
      case 'language': return <IconLanguage />;
      case 'study': return <IconStudy />;
      default: return <IconBook />;
    }
  };

  const getModeColor = (mode: BookMode) => {
    switch (mode) {
      case 'language': return 'bg-emerald-100 text-emerald-700';
      case 'study': return 'bg-blue-100 text-blue-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  const totalBooks = books.length;
  const averageProgress = totalBooks > 0 
    ? Math.round(books.reduce((acc, book) => acc + Math.min(100, (book.progressIndex / Math.max(1, book.content.length)) * 100), 0) / totalBooks) 
    : 0;
  const latestBook = books.length > 0 ? [...books].sort((a, b) => (b.lastAccessedAt || b.createdAt) - (a.lastAccessedAt || a.createdAt))[0] : null;

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || book.mode === filterMode;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex h-screen bg-[#faf9f6] overflow-hidden font-sans selection:bg-accent/30 relative">
      {/* Background Subtle Dot Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `radial-gradient(var(--dot-color) 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>
      
      {/* LEFT SIDEBAR */}
      <aside className="relative z-10 w-64 bg-white/80 backdrop-blur-xl border-r border-stone-200/70 flex flex-col justify-between py-8 px-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div>
          <div className="mb-10 pl-2">
            <h1 className="text-3xl font-serif text-ink tracking-tight flex items-center gap-2">
              <span className="font-medium">Pratik</span><span className="font-light italic text-accent">Hub</span>
            </h1>
            <p className="text-stone-400 font-sans text-[10px] uppercase tracking-widest mt-2">Çalışma İstasyonu</p>
          </div>
          
          <div className="mb-10 pl-2">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">{greeting},</p>
            <p className="text-lg text-ink font-light mt-1">Odaklanma vakti.</p>
          </div>

          <nav className="space-y-2">
             <button onClick={onOpenDictionary} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-600 rounded-xl hover:bg-stone-50 hover:shadow-sm hover:text-ink transition-all border border-transparent hover:border-stone-200 group">
               <span className="text-stone-400 group-hover:text-ink transition-colors"><IconDictionary /></span>
               Sözlük
             </button>
             <button onClick={onOpenStudyNotes} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-600 rounded-xl hover:bg-stone-50 hover:shadow-sm hover:text-ink transition-all border border-transparent hover:border-stone-200 group">
               <span className="text-stone-400 group-hover:text-ink transition-colors"><IconNotes /></span>
               Ders Notları
             </button>
          </nav>
        </div>

        <div className="space-y-3">
          {/* Theme Toggle (Liquid Glass) */}
          <div className={`relative flex items-center justify-between px-3 py-2.5 rounded-2xl transition-colors duration-500 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] backdrop-blur-md border ${isDark ? 'bg-white/10 border-white/10' : 'bg-black/5 border-black/5'}`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
            <span className="text-sm relative z-10 opacity-70">☀️</span>
            <button
              onClick={onToggleTheme}
              className={`relative w-14 h-7 rounded-full transition-all duration-500 shadow-inner overflow-hidden border ${isDark ? 'bg-indigo-500/30 border-indigo-400/30' : 'bg-white/40 border-white/60'}`}
              style={{ backdropFilter: 'blur(8px)' }}
            >
              <div className={`absolute top-0.5 bottom-0.5 w-6 rounded-full shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-all duration-500 flex items-center justify-center border ${isDark ? 'translate-x-[26px] bg-gradient-to-br from-indigo-200 to-white border-white/50' : 'translate-x-0.5 bg-gradient-to-br from-white to-stone-100 border-white'}`}
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
              </div>
            </button>
            <span className="text-sm relative z-10 opacity-70">🌙</span>
          </div>

          <button onClick={() => setIsModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-ink text-paper px-4 py-3.5 rounded-xl hover:bg-stone-800 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.15)] font-medium text-sm group active:scale-95">
            <IconPlus /> <span>Yeni İçerik Ekle</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 flex-1 overflow-y-auto px-8 md:px-12 py-10 custom-scrollbar">
        
        {/* Top Header: Search */}
        <header className="flex justify-between items-center mb-10">
           <div className="relative w-full max-w-md animate-in slide-in-from-top-4 fade-in duration-500">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             </span>
             <input 
               type="text" 
               placeholder="Kitaplıktan eser ismi ara..." 
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
               className="w-full pl-11 pr-4 py-3 bg-white/70 backdrop-blur-md border border-stone-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 shadow-sm text-sm text-ink placeholder-stone-400 transition-all"
             />
           </div>
        </header>

        {/* Dashboard Stats Row */}
        {books.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 animate-in slide-in-from-bottom-4 fade-in duration-700">
            {/* Stat 1 */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex items-center gap-5">
               <div className="w-14 h-14 rounded-2xl bg-orange-50/80 flex items-center justify-center text-accent/80 border border-orange-100"><IconBook /></div>
               <div>
                  <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest mb-1">Toplam Materyal</p>
                  <p className="text-3xl font-serif text-ink leading-none">{totalBooks}</p>
               </div>
            </div>
            {/* Stat 2 */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex items-center gap-5">
               <div className="w-14 h-14 rounded-2xl bg-emerald-50/80 flex items-center justify-center text-emerald-600/80 border border-emerald-100">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
               </div>
               <div>
                  <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest mb-1">Ortalama İlerleme</p>
                  <p className="text-3xl font-serif text-ink leading-none">%{averageProgress}</p>
               </div>
            </div>
            {/* Stat 3: Kaldığın Yerden */}
            {latestBook && (
              <div 
                className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex items-center gap-5 hover:border-accent/30 hover:shadow-lg transition-all cursor-pointer group active:scale-[0.98]" 
                onClick={() => onSelectBook(latestBook)}
              >
                 <div className="w-14 h-14 rounded-2xl bg-blue-50/80 flex items-center justify-center text-blue-600/80 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-widest mb-1">Kaldığın Yerden</p>
                    <p className="text-lg font-serif text-ink truncate font-medium">{latestBook.title}</p>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        {books.length > 0 && (
          <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 no-scrollbar animate-in fade-in duration-1000 delay-150">
             <button onClick={() => setFilterMode('all')} className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all ${filterMode === 'all' ? 'bg-ink text-white shadow-md' : 'bg-white/70 backdrop-blur-sm text-stone-500 border border-stone-200/60 hover:bg-white hover:text-ink hover:border-stone-300'}`}>TÜMÜ</button>
             <button onClick={() => setFilterMode('normal')} className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${filterMode === 'normal' ? 'bg-stone-600 text-white shadow-md' : 'bg-white/70 backdrop-blur-sm text-stone-500 border border-stone-200/60 hover:bg-white hover:text-ink hover:border-stone-300'}`}>Normal</button>
             <button onClick={() => setFilterMode('study')} className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${filterMode === 'study' ? 'bg-blue-600 text-white shadow-md' : 'bg-white/70 backdrop-blur-sm text-stone-500 border border-stone-200/60 hover:bg-white hover:text-ink hover:border-stone-300'}`}>Ders Çalışma</button>
             <button onClick={() => setFilterMode('language')} className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-2 ${filterMode === 'language' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/70 backdrop-blur-sm text-stone-500 border border-stone-200/60 hover:bg-white hover:text-ink hover:border-stone-300'}`}>Dil Öğrenme</button>
          </div>
        )}

        {/* Content Area */}
        {books.length === 0 ? (
          <div className="text-center py-32 bg-white/50 backdrop-blur-sm rounded-3xl border border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 rounded-full bg-stone-100/80 flex items-center justify-center text-stone-300 mb-6 border border-white shadow-inner">
               <IconBook />
            </div>
            <h3 className="text-2xl font-serif text-ink mb-3">Kitaplığınız Bomboş</h3>
            <p className="text-stone-500 max-w-sm mx-auto text-sm leading-relaxed mb-8">Sol menüdeki "Yeni İçerik Ekle" butonuna tıklayarak hemen pratik yapmaya veya ders çalışmaya başlayın.</p>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-ink text-paper px-6 py-3 rounded-xl hover:bg-stone-800 transition-all shadow-md font-medium text-sm">
              <IconPlus /> <span>İlk Metni Ekle</span>
            </button>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-20">
             <p className="text-stone-500">Aramanıza uygun sonuç bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-300">
            {filteredBooks.map((book) => (
            <div
              key={book.id}
              className="group relative bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-[22rem]"
              onClick={() => onSelectBook(book)}
              onContextMenu={(e) => handleContextMenu(e, book.id)}
            >
               {/* Cover Area */}
               <div className="relative h-[65%] w-full bg-stone-100 overflow-hidden">
                 {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                 ) : (
                    <div className={`w-full h-full flex flex-col items-center justify-center p-4 text-center ${getMeshGradient(book.id)} group-hover:scale-105 transition-transform duration-500`}>
                       <span className="text-white/80 drop-shadow-sm text-4xl mb-3">{getModeIcon(book.mode || 'normal')}</span>
                       <h3 className="font-serif text-lg text-white drop-shadow-md line-clamp-3 font-semibold leading-snug">{book.title}</h3>
                    </div>
                 )}
                 
                 {/* Mode Badge Overlay */}
                 <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 backdrop-blur-sm shadow-sm border border-black/5">
                    <span className={`scale-75 origin-center ${getModeColor(book.mode || 'normal')}`}>{getModeIcon(book.mode || 'normal')}</span>
                    <span className="text-[9px] font-bold text-stone-700 tracking-wider uppercase">{getModeLabel(book.mode || 'normal')}</span>
                 </div>
               </div>
               
               {/* Bottom Info Area */}
               <div className="p-4 flex-1 flex flex-col justify-between bg-white relative z-10 border-t border-stone-100">
                  <div>
                    {book.coverImage && (
                       <h3 className="font-serif text-[15px] leading-tight text-ink line-clamp-2 font-medium mb-1">{book.title}</h3>
                    )}
                    <p className="text-stone-400 text-[11px] font-sans">
                      {new Date(book.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  
                  <div className="mt-2">
                    <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-stone-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (book.progressIndex / book.content.length) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-stone-400 font-medium">
                      <span>İlerleme</span>
                      <span>%{(Math.min(100, (book.progressIndex / book.content.length) * 100)).toFixed(0)}</span>
                    </div>
                  </div>
               </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBookToDelete(book.id);
                }}
                className="absolute top-4 right-4 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md p-2 z-20 opacity-0 group-hover:opacity-100 transition-all"
                title="Sil"
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      )}
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[1000] bg-white border border-stone-200 shadow-xl rounded-lg py-1 w-48 animate-in fade-in zoom-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => {
              setEditingBookId(contextMenu.bookId);
              editCoverInputRef.current?.click();
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 flex items-center gap-2"
          >
            <IconUpload /> Kapak Değiştir
          </button>
          <button 
            onClick={() => {
              setBookToDelete(contextMenu.bookId);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-stone-100"
          >
            <IconTrash /> Sil
          </button>
        </div>
      )}

      <input 
        type="file" 
        ref={editCoverInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleEditCoverUpload} 
      />

      {/* New Book Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-paper w-full max-w-2xl rounded-2xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-white">
              <h2 className="text-2xl font-serif text-ink">Kitaplığa Ekle</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600 text-2xl">&times;</button>
            </div>
            
            <div className="flex border-b border-stone-200 bg-stone-50">
              <button 
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'paste' ? 'bg-paper text-ink border-b-2 border-ink' : 'text-stone-400 hover:text-stone-600'}`}
              >
                Metin Yapıştır
              </button>
              <button 
                onClick={() => setActiveTab('pdf')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'pdf' ? 'bg-paper text-ink border-b-2 border-ink' : 'text-stone-400 hover:text-stone-600'}`}
              >
                PDF Yükle (AI)
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-6">
                 <label className="block text-sm font-medium text-stone-600 mb-2">Çalışma Modu</label>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button 
                      onClick={() => setSelectedMode('normal')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${selectedMode === 'normal' ? 'border-ink bg-white ring-1 ring-ink' : 'border-stone-200 bg-stone-50 hover:bg-white'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <IconBook />
                        <span className="font-semibold text-sm">Normal</span>
                      </div>
                      <p className="text-xs text-stone-500">Sadece yazma pratiği yapın.</p>
                    </button>
                    
                    <button 
                      onClick={() => setSelectedMode('language')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${selectedMode === 'language' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-stone-200 bg-stone-50 hover:bg-white'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-emerald-700">
                        <IconLanguage />
                        <span className="font-semibold text-sm">Dil Öğrenme</span>
                      </div>
                      <p className="text-xs text-stone-500">Kelimeleri anlam, örnek cümle ve notlarla sözlüğe ekleyin.</p>
                    </button>

                    <button 
                      onClick={() => setSelectedMode('study')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${selectedMode === 'study' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-stone-200 bg-stone-50 hover:bg-white'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-blue-700">
                        <IconStudy />
                        <span className="font-semibold text-sm">Ders Çalışma</span>
                      </div>
                      <p className="text-xs text-stone-500">Altını çizin, gruplara ayırın, ders notları oluşturun.</p>
                    </button>
                 </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-600 mb-1">Başlık</label>
                <input 
                  type="text" 
                  className="w-full p-3 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-stone-500 transition-colors"
                  placeholder="Örn: Biyoloji Notları"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-600 mb-2">Kapak Görseli (İsteğe Bağlı)</label>
                <div className="flex items-center gap-4">
                   {newBookCover ? (
                      <div className="relative w-16 h-24 rounded-md overflow-hidden shadow-sm border border-stone-200 group">
                         <img src={newBookCover} alt="Kapak" className="w-full h-full object-cover" />
                         <button onClick={() => setNewBookCover(undefined)} className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-xl">&times;</span>
                         </button>
                      </div>
                   ) : (
                      <div 
                         onClick={() => coverInputRef.current?.click()}
                         className="w-16 h-24 rounded-md border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-stone-400 hover:text-stone-600 hover:border-stone-400 cursor-pointer transition-colors bg-stone-50"
                      >
                         <IconPlus />
                         <span className="text-[10px] mt-1">Kapak</span>
                      </div>
                   )}
                   <div className="flex-1 text-sm text-stone-500 bg-stone-50 p-3 rounded-lg border border-stone-100">
                     Özel bir kapak fotoğrafı yükleyebilirsiniz. PDF yüklediğinizde sistem otomatik olarak 1. sayfayı kapağa çevirir.
                   </div>
                   <input 
                     type="file" 
                     ref={coverInputRef} 
                     className="hidden" 
                     accept="image/*" 
                     onChange={handleCoverUpload}
                   />
                </div>
              </div>

              {activeTab === 'paste' ? (
                <div>
                   <label className="block text-sm font-medium text-stone-600 mb-1">İçerik</label>
                   <textarea 
                    className="w-full p-3 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-stone-500 h-48 font-serif text-stone-700 leading-relaxed resize-none"
                    placeholder="İçeriği buraya yapıştırın..."
                    value={newBookContent}
                    onChange={(e) => setNewBookContent(e.target.value)}
                   ></textarea>
                </div>
              ) : (
                <div className="h-48 border-2 border-dashed border-stone-300 rounded-xl flex flex-col items-center justify-center bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer relative" onClick={() => !processing.isProcessing && fileInputRef.current?.click()}>
                  {processing.isProcessing ? (
                    <div className="text-center px-6">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-stone-800 mx-auto mb-4"></div>
                      <p className="text-stone-600 font-medium animate-pulse">{processing.message}</p>
                    </div>
                  ) : newBookContent ? (
                    <div className="text-center px-6">
                      <div className="bg-green-100 text-green-700 p-3 rounded-full inline-block mb-2">✓</div>
                      <p className="text-stone-800 font-medium">Metin başarıyla çıkarıldı!</p>
                      <p className="text-stone-500 text-sm mt-1 line-clamp-2 opacity-60">"{newBookContent.substring(0, 80)}..."</p>
                      <button 
                        className="mt-4 text-sm text-stone-500 underline hover:text-stone-800"
                        onClick={(e) => {
                            e.stopPropagation();
                            setNewBookContent('');
                        }}
                      >
                        Sıfırla
                      </button>
                    </div>
                  ) : (
                    <>
                      <IconUpload />
                      <p className="mt-3 text-stone-600 font-medium">PDF Seçmek için Tıklayın</p>
                      <p className="mt-1 text-stone-400 text-xs">Maksimum 30MB · Yapay zeka kullanılmaz</p>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="application/pdf" 
                    onChange={handleFileChange}
                    disabled={processing.isProcessing}
                  />
                </div>
              )}
            </div>

            {/* Ezber Modu — always visible footer section */}
            <div className="px-6 py-3 border-t border-stone-200 bg-stone-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-md text-stone-500 border border-stone-200">
                  <IconRepeat />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-ink">Ezber Modu (Tekrar Sayısı)</label>
                  <p className="text-xs text-stone-500">Metnin kaç kez arka arkaya yazılacağını belirleyin.</p>
                </div>
                <input 
                  type="number" 
                  min="1" 
                  max="5000"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 p-2 rounded-lg border border-stone-300 bg-white text-center font-bold text-lg text-stone-800 focus:outline-none focus:border-stone-500 shadow-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-stone-200 bg-white flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleSave}
                disabled={!newBookTitle || !newBookContent || processing.isProcessing}
                className="px-5 py-2.5 rounded-lg bg-ink text-paper hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {repeatCount > 1 ? `Oluştur (${repeatCount} Tekrar)` : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {bookToDelete && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-stone-200 p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-serif text-ink mb-2">Silmek istiyor musunuz?</h3>
            <p className="text-stone-500 text-sm mb-6">
              Bu kitap kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors font-medium text-sm"
              >
                Vazgeç
              </button>
              <button 
                onClick={() => {
                  if (bookToDelete) onDeleteBook(bookToDelete);
                  setBookToDelete(null);
                }}
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