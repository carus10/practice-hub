import React, { useState, useRef } from 'react';
import { Book, BookMode, ProcessingState } from '../types';
import { extractTextFromPdf } from '../services/geminiService';
import { IconPlus, IconBook, IconTrash, IconUpload, IconRepeat, IconDictionary, IconStudy, IconBrain } from './Icons';

interface LibraryProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onAddBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onOpenDictionary: () => void;
}

export const Library: React.FC<LibraryProps> = ({ books, onSelectBook, onAddBook, onDeleteBook, onOpenDictionary }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'paste' | 'pdf'>('paste');
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookContent, setNewBookContent] = useState('');
  const [selectedMode, setSelectedMode] = useState<BookMode>('normal');
  const [repeatCount, setRepeatCount] = useState<number>(1);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, message: '' });
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Lütfen geçerli bir PDF dosyası seçin.');
      return;
    }

    setProcessing({ isProcessing: true, message: 'Yapay zeka PDF içeriğini okuyor...' });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        try {
          const extractedText = await extractTextFromPdf(base64Data);
          setNewBookContent(extractedText);
          if (!newBookTitle) {
            setNewBookTitle(file.name.replace('.pdf', ''));
          }
          setProcessing({ isProcessing: false, message: '' });
        } catch (error) {
          setProcessing({ isProcessing: false, message: '' });
          alert('PDF okunamadı. Lütfen tekrar deneyin.');
        }
      };
    } catch (err) {
      setProcessing({ isProcessing: false, message: '' });
      console.error(err);
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
    };

    onAddBook(newBook);
    setIsModalOpen(false);
    
    // Reset form
    setNewBookTitle('');
    setNewBookContent('');
    setRepeatCount(1);
    setSelectedMode('normal');
  };

  const getModeLabel = (mode: BookMode) => {
    switch (mode) {
      case 'vocabulary': return 'Kelime Öğrenme';
      case 'study': return 'Ders Tekrar';
      default: return 'Normal';
    }
  };

  const getModeIcon = (mode: BookMode) => {
    switch (mode) {
      case 'vocabulary': return <IconBrain />;
      case 'study': return <IconStudy />;
      default: return <IconBook />;
    }
  };

  const getModeColor = (mode: BookMode) => {
    switch (mode) {
      case 'vocabulary': return 'bg-purple-100 text-purple-700';
      case 'study': return 'bg-blue-100 text-blue-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-screen">
      <header className="flex justify-between items-center mb-12 mt-6 border-b border-stone-300 pb-6">
        <div>
          <h1 className="text-4xl font-serif text-ink tracking-tight mb-2">Pratik Hub</h1>
          <p className="text-stone-500 font-sans text-sm">Minimalist Çalışma İstasyonu</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onOpenDictionary}
            className="flex items-center gap-2 bg-white border border-stone-300 text-stone-600 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-all shadow-sm"
          >
            <IconDictionary />
            <span className="hidden sm:inline">Sözlük</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-ink text-paper px-5 py-2.5 rounded-lg hover:bg-stone-700 transition-all shadow-sm"
          >
            <IconPlus />
            <span className="hidden sm:inline">Yeni Ekle</span>
            <span className="sm:hidden">Ekle</span>
          </button>
        </div>
      </header>

      {books.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="text-stone-300 mb-4 flex justify-center"><IconBook /></div>
          <h3 className="text-xl font-serif text-stone-600 mb-2">Kitaplığınız Boş</h3>
          <p className="text-stone-400 max-w-xs mx-auto">Sağ üstteki butona tıklayarak metin ekleyin. Kelime öğrenme veya ders tekrarı modlarını deneyin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <div
              key={book.id}
              className="group relative bg-white p-6 rounded-xl border border-stone-200 shadow-sm hover:shadow-md hover:border-stone-300 transition-all cursor-pointer flex flex-col justify-between h-56"
              onClick={() => onSelectBook(book)}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-1.5 rounded-md ${getModeColor(book.mode || 'normal')}`}>
                     {getModeIcon(book.mode || 'normal')}
                  </div>
                  <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                    {getModeLabel(book.mode || 'normal')}
                  </span>
                </div>
                <h3 className="font-serif text-xl text-ink mb-2 line-clamp-2 font-medium">{book.title}</h3>
                <p className="text-stone-400 text-xs font-sans">
                  {new Date(book.createdAt).toLocaleDateString('tr-TR')}
                </p>
              </div>
              
              <div className="mt-4">
                <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-stone-600 h-full rounded-full" 
                    style={{ width: `${Math.min(100, (book.progressIndex / book.content.length) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-stone-500">
                  <span>%{(Math.min(100, (book.progressIndex / book.content.length) * 100)).toFixed(0)} tamamlandı</span>
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
                      onClick={() => setSelectedMode('vocabulary')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${selectedMode === 'vocabulary' ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-stone-200 bg-stone-50 hover:bg-white'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-purple-700">
                        <IconBrain />
                        <span className="font-semibold text-sm">Kelime Öğrenme</span>
                      </div>
                      <p className="text-xs text-stone-500">Seçtiğiniz kelimeleri sözlüğe ekleyin.</p>
                    </button>

                    <button 
                      onClick={() => setSelectedMode('study')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${selectedMode === 'study' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-stone-200 bg-stone-50 hover:bg-white'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 text-blue-700">
                        <IconStudy />
                        <span className="font-semibold text-sm">Ders Tekrar</span>
                      </div>
                      <p className="text-xs text-stone-500">Önemli yerlerin altını renkli çizin.</p>
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

              {activeTab === 'paste' ? (
                <div>
                   <label className="block text-sm font-medium text-stone-600 mb-1">İçerik</label>
                   <textarea 
                    className="w-full p-3 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-stone-500 h-48 font-serif text-stone-700 leading-relaxed resize-none mb-4"
                    placeholder="İçeriği buraya yapıştırın..."
                    value={newBookContent}
                    onChange={(e) => setNewBookContent(e.target.value)}
                   ></textarea>
                   
                   <div className="flex items-center p-3 bg-stone-100 rounded-lg border border-stone-200">
                      <div className="p-2 bg-white rounded-md text-stone-500 mr-3">
                        <IconRepeat />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-ink mb-0.5">Ezber Modu (Tekrar Sayısı)</label>
                        <p className="text-xs text-stone-500">Metnin kaç kez arka arkaya yazılacağını belirleyin.</p>
                      </div>
                      <input 
                        type="number" 
                        min="1" 
                        max="5000"
                        value={repeatCount}
                        onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-24 p-2 rounded-lg border border-stone-300 bg-white text-center font-bold text-lg text-stone-800 focus:outline-none focus:border-stone-500 shadow-sm"
                      />
                   </div>
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
                      <p className="mt-1 text-stone-400 text-xs">Maksimum 5MB.</p>
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

            <div className="p-6 border-t border-stone-200 bg-white flex justify-end gap-3">
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