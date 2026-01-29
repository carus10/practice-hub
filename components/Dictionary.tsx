import React, { useState } from 'react';
import { DictionaryItem, DictionaryFolder } from '../types';
import { IconArrowLeft, IconTrash, IconPen, IconCheck, IconFolder, IconFolderOpen, IconPlus } from './Icons';

interface DictionaryProps {
  items: DictionaryItem[];
  folders: DictionaryFolder[];
  onUpdateItem: (item: DictionaryItem) => void;
  onDeleteItem: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onUpdateFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onBack: () => void;
}

export const Dictionary: React.FC<DictionaryProps> = ({ 
  items, 
  folders, 
  onUpdateItem, 
  onDeleteItem, 
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onBack 
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = All, 'uncategorized' = No Folder
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemValue, setEditItemValue] = useState('');
  
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderValue, setEditFolderValue] = useState('');
  
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for folder deletion modal
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // Filtering Logic
  const filteredItems = items.filter(item => {
    const matchesSearch = item.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.definition.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFolder = true;
    if (selectedFolderId === 'uncategorized') {
      matchesFolder = !item.folderId;
    } else if (selectedFolderId) {
      matchesFolder = item.folderId === selectedFolderId;
    }

    return matchesSearch && matchesFolder;
  });

  // Item Editing
  const startEditingItem = (item: DictionaryItem) => {
    setEditingItemId(item.id);
    setEditItemValue(item.definition);
  };

  const saveEditItem = (item: DictionaryItem) => {
    onUpdateItem({ ...item, definition: editItemValue });
    setEditingItemId(null);
  };

  // Folder Editing
  const startEditingFolder = (folder: DictionaryFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditFolderValue(folder.name);
  };

  const saveEditFolder = (id: string) => {
    if (editFolderValue.trim()) {
      onUpdateFolder(id, editFolderValue);
    }
    setEditingFolderId(null);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleMoveItem = (item: DictionaryItem, newFolderId: string) => {
      onUpdateItem({ ...item, folderId: newFolderId === 'uncategorized' ? undefined : newFolderId });
  };

  const confirmDeleteFolder = () => {
    if (folderToDelete) {
      onDeleteFolder(folderToDelete);
      if (selectedFolderId === folderToDelete) setSelectedFolderId(null);
      setFolderToDelete(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 min-h-screen flex flex-col">
      <header className="flex items-center gap-4 mb-8 mt-2 border-b border-stone-300 pb-6 shrink-0">
        <button 
          onClick={onBack}
          className="p-2 rounded-full hover:bg-stone-200 transition-colors"
        >
          <IconArrowLeft />
        </button>
        <div>
          <h1 className="text-3xl font-serif text-ink tracking-tight">Sözlüğüm</h1>
          <p className="text-stone-500 font-sans text-sm">{items.length} Kelime</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-8 flex-1">
        {/* Sidebar: Folders */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2">
            <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="font-serif text-lg text-ink font-medium">Klasörler</h3>
                <button 
                  onClick={() => setIsCreatingFolder(true)} 
                  className="p-1.5 hover:bg-stone-200 rounded text-stone-500"
                  title="Klasör Ekle"
                >
                    <IconPlus />
                </button>
            </div>

            {isCreatingFolder && (
                <div className="mb-2 p-2 bg-stone-100 rounded-lg animate-in fade-in zoom-in duration-200">
                    <input 
                        autoFocus
                        type="text" 
                        placeholder="Klasör Adı"
                        className="w-full p-2 text-sm rounded border border-stone-300 mb-2 focus:outline-none focus:border-ink bg-white text-stone-900"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsCreatingFolder(false)} className="text-xs text-stone-500 hover:text-stone-700">İptal</button>
                        <button onClick={handleCreateFolder} className="text-xs bg-ink text-paper px-2 py-1 rounded hover:bg-stone-700">Oluştur</button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setSelectedFolderId(null)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${selectedFolderId === null ? 'bg-stone-200 text-ink' : 'text-stone-600 hover:bg-stone-100'}`}
            >
                <IconFolderOpen />
                Tüm Kelimeler
            </button>
            
            <button
                onClick={() => setSelectedFolderId('uncategorized')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${selectedFolderId === 'uncategorized' ? 'bg-stone-200 text-ink' : 'text-stone-600 hover:bg-stone-100'}`}
            >
                <IconFolder />
                Kategorisiz
            </button>

            <div className="h-px bg-stone-200 my-1 mx-2"></div>

            <div className="overflow-y-auto max-h-[50vh] flex flex-col gap-1">
                {folders.map(folder => (
                    <div 
                        key={folder.id}
                        onClick={() => setSelectedFolderId(folder.id)}
                        className={`group flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${selectedFolderId === folder.id ? 'bg-stone-200 text-ink' : 'text-stone-600 hover:bg-stone-100'}`}
                    >
                         {editingFolderId === folder.id ? (
                             <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                 <input 
                                     type="text" 
                                     className="flex-1 p-1 text-sm bg-white text-stone-900 border border-stone-300 rounded focus:outline-none"
                                     value={editFolderValue}
                                     onChange={(e) => setEditFolderValue(e.target.value)}
                                     onKeyDown={(e) => e.key === 'Enter' && saveEditFolder(folder.id)}
                                     autoFocus
                                 />
                                 <button onClick={() => saveEditFolder(folder.id)} className="text-green-600"><IconCheck /></button>
                             </div>
                         ) : (
                             <>
                                <div className="flex items-center gap-3 truncate">
                                    <IconFolder />
                                    <span className="truncate">{folder.name}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => startEditingFolder(folder, e)} className="p-1 hover:text-ink hover:bg-white rounded"><IconPen /></button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFolderToDelete(folder.id);
                                        }} 
                                        className="p-1 hover:text-red-600 hover:bg-white rounded"
                                    ><IconTrash /></button>
                                </div>
                             </>
                         )}
                    </div>
                ))}
            </div>
        </aside>

        {/* Main Content: Word List */}
        <div className="flex-1 flex flex-col">
            <div className="mb-6">
                <input 
                type="text" 
                placeholder="Bu klasörde ara..." 
                className="w-full p-3 rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400 text-stone-900 placeholder:text-stone-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-stone-50 rounded-xl border border-stone-100 border-dashed">
                    <p className="text-stone-400">Bu görünümde kelime bulunamadı.</p>
                </div>
            ) : (
                <div className="grid gap-4 content-start">
                {filteredItems.map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-col gap-3 group hover:border-stone-300 transition-colors">
                        <div className="flex justify-between items-start">
                             <h3 className="font-serif text-xl text-ink font-medium">{item.word}</h3>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {editingItemId !== item.id && (
                                <button 
                                    onClick={() => startEditingItem(item)}
                                    className="p-1.5 text-stone-400 hover:text-ink hover:bg-stone-100 rounded transition-colors"
                                >
                                    <IconPen />
                                </button>
                                )}
                                <button 
                                onClick={() => onDeleteItem(item.id)}
                                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                <IconTrash />
                                </button>
                             </div>
                        </div>
                    
                        <div className="w-full">
                            {editingItemId === item.id ? (
                            <div className="flex gap-2 w-full">
                                <input 
                                type="text" 
                                className="flex-1 p-2 text-sm border border-stone-300 rounded focus:outline-none focus:border-stone-500 bg-white text-stone-900"
                                value={editItemValue}
                                onChange={(e) => setEditItemValue(e.target.value)}
                                placeholder="Anlamını girin..."
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && saveEditItem(item)}
                                />
                                <button 
                                onClick={() => saveEditItem(item)}
                                className="p-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                                >
                                <IconCheck />
                                </button>
                            </div>
                            ) : (
                            <p 
                                className={`text-sm cursor-pointer hover:text-ink transition-colors ${item.definition ? 'text-stone-600' : 'text-stone-400 italic'}`}
                                onClick={() => startEditingItem(item)}
                            >
                                {item.definition || 'Anlam eklemek için tıklayın...'}
                            </p>
                            )}
                        </div>

                        {/* Move to Folder Control */}
                        <div className="flex items-center justify-end mt-1 pt-2 border-t border-stone-100">
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-400">Klasör:</span>
                                <select 
                                    className="text-xs p-1 rounded bg-stone-50 border border-stone-200 text-stone-600 focus:outline-none focus:border-stone-400 cursor-pointer"
                                    value={item.folderId || 'uncategorized'}
                                    onChange={(e) => handleMoveItem(item, e.target.value)}
                                >
                                    <option value="uncategorized">Kategorisiz</option>
                                    {folders.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                             </div>
                        </div>
                    </div>
                ))}
                </div>
            )}
        </div>

        {/* Delete Folder Modal */}
        {folderToDelete && (
          <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-stone-200 p-6 animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-serif text-ink mb-2">Klasörü Sil</h3>
              <p className="text-stone-500 text-sm mb-6">
                Bu klasörü silmek istediğinize emin misiniz? İçindeki kelimeler silinmeyecek, sadece kategorisiz hale gelecektir.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setFolderToDelete(null)}
                  className="px-4 py-2 rounded-lg text-stone-500 hover:bg-stone-50 transition-colors font-medium text-sm"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={confirmDeleteFolder}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium text-sm shadow-sm"
                >
                  Evet, Sil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};