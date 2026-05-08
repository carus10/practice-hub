import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DictionaryItem } from '../types';
import { IconArrowLeft, IconCheck, IconX } from './Icons';
import { stemmer } from 'stemmer';

interface PracticeModeProps {
    items: DictionaryItem[];
    onUpdateItem: (item: DictionaryItem) => void;
    onExit: () => void;
}

type PracticeType = 'WORD_TO_MEANING' | 'MEANING_TO_WORD' | 'FILL_BLANK' | null;

export const PracticeMode: React.FC<PracticeModeProps> = ({ items, onUpdateItem, onExit }) => {
    const [mode, setMode] = useState<PracticeType>(null);
    const [queue, setQueue] = useState<DictionaryItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    const [inputValue, setInputValue] = useState('');
    const [backspaceCount, setBackspaceCount] = useState(0);
    
    // UI state
    const [feedback, setFeedback] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
    const [showAnswer, setShowAnswer] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial word selection algorithm
    const startPractice = (selectedMode: PracticeType) => {
        let practiceItems = [...items];
        
        // Filter for mode 3 (needs examples)
        if (selectedMode === 'FILL_BLANK') {
            practiceItems = practiceItems.filter(i => (i.exampleSentences && i.exampleSentences.length > 0) || i.exampleSentence);
        }

        if (practiceItems.length === 0) {
            alert('Bu mod için yeterli kelime yok.');
            return;
        }

        // Weight algorithm: Score (0-5)
        practiceItems.sort((a, b) => {
            const scoreA = a.difficultyScore || 0;
            const scoreB = b.difficultyScore || 0;
            // Add a little randomness so it's not strictly deterministic
            const weightA = scoreA * 2 + Math.random() * 5 - (a.lastPracticedAt ? (Date.now() - a.lastPracticedAt) / 86400000 : 0);
            const weightB = scoreB * 2 + Math.random() * 5 - (b.lastPracticedAt ? (Date.now() - b.lastPracticedAt) / 86400000 : 0);
            return weightB - weightA;
        });

        // Take top 20 words for a session, then shuffle them
        const sessionWords = practiceItems.slice(0, 20).sort(() => Math.random() - 0.5);

        setQueue(sessionWords);
        setCurrentIndex(0);
        setMode(selectedMode);
        resetTurn();
    };

    const resetTurn = () => {
        setInputValue('');
        setBackspaceCount(0);
        setFeedback('IDLE');
        setShowAnswer(false);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const [conjugatedMeaning, setConjugatedMeaning] = useState<string>('');

    const currentItem = queue[currentIndex];

    // Prepare question details securely (prevents Math.random from running on every keystroke)
    const currentQuestion = useMemo(() => {
        if (!currentItem || !mode) return { prompt: '', expected: '', extraInfo: '', replacedWord: '' };
        
        let prompt = '';
        let expected = '';
        let extraInfo = '';
        let replacedWord = '';

        if (mode === 'WORD_TO_MEANING') {
            prompt = currentItem.word;
            expected = currentItem.definition;
        } else if (mode === 'MEANING_TO_WORD') {
            prompt = currentItem.definition || 'Anlamı yok';
            expected = currentItem.word;
        } else if (mode === 'FILL_BLANK') {
            const ex = (currentItem.exampleSentences && currentItem.exampleSentences.length > 0) 
                ? currentItem.exampleSentences[Math.floor(Math.random() * currentItem.exampleSentences.length)] 
                : currentItem.exampleSentence || '';
            
            let word = currentItem.word;
            
            // 1. Try exact match
            const exactRegex = new RegExp(`\\b${word}\\b`, 'gi');
            const matchExact = ex.match(exactRegex);
            
            if (matchExact) {
                replacedWord = matchExact[0];
                prompt = ex.replace(exactRegex, '___');
            } else {
                // 2. Use NLP Porter Stemmer algorithm for precise grammatical matching
                const wordsInSentence = ex.match(/\b[a-zA-ZçğıöşüÇĞİÖŞÜ]+\b/g) || [];
                const targetStem = stemmer(word.toLowerCase());
                
                let bestMatch = '';
                
                for (const w of wordsInSentence) {
                    if (stemmer(w.toLowerCase()) === targetStem) {
                        bestMatch = w;
                        break;
                    }
                }
                
                if (bestMatch) {
                    replacedWord = bestMatch;
                    prompt = ex.replace(new RegExp(`\\b${bestMatch}\\b`, 'gi'), '___');
                } else {
                    prompt = ex;
                }
            }

            expected = currentItem.word;

            if (replacedWord && replacedWord.toLowerCase() !== word.toLowerCase()) {
                extraInfo = 'conjugation';
            }
        }
        
        return { prompt, expected, extraInfo, replacedWord };
    }, [currentItem, mode]);

    useEffect(() => {
        setConjugatedMeaning('');
        if (mode === 'FILL_BLANK' && currentQuestion.extraInfo === 'conjugation' && currentQuestion.replacedWord) {
            fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(currentQuestion.replacedWord)}&langpair=en|tr`)
                .then(res => res.json())
                .then(data => {
                    if (data.responseData?.translatedText) {
                        setConjugatedMeaning(data.responseData.translatedText.toLowerCase());
                    }
                })
                .catch(console.error);
        }
    }, [currentQuestion.replacedWord, currentQuestion.extraInfo, mode]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return; // Ignore if typing in input
            }
            if (e.key === 'Enter' && feedback !== 'IDLE') {
                e.preventDefault();
                nextWord();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [feedback, currentIndex, queue]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            setBackspaceCount(prev => prev + 1);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (feedback === 'IDLE') {
                checkAnswer();
            } else {
                nextWord();
            }
        }
    };

    const normalize = (str: string) => str.toLowerCase().replace(/[^a-zöçşığü]/gi, '').trim();

    const checkAnswer = () => {
        if (!inputValue.trim()) return;
        const expected = currentQuestion.expected;
        
        let isCorrect = false;
        const normalizedInput = normalize(inputValue);
        const normalizedExpected = normalize(expected);
        
        // Loose matching for WORD_TO_MEANING since definitions can be long
        if (mode === 'WORD_TO_MEANING') {
            if (normalizedExpected.includes(normalizedInput) && normalizedInput.length > 3) {
                isCorrect = true;
            } else if (normalizedInput === normalizedExpected) {
                isCorrect = true;
            } else {
                 const expectedWords = expected.toLowerCase().split(/[ ,.;]+/);
                 const inputWords = inputValue.toLowerCase().split(/[ ,.;]+/);
                 const matchCount = inputWords.filter(w => expectedWords.includes(w)).length;
                 if (matchCount > 0 && matchCount >= inputWords.length / 2) isCorrect = true;
            }
        } else {
            // For word matching, check exact match or if they typed the conjugated word
            const replacedWordNormalized = normalize(currentQuestion.replacedWord || '');
            isCorrect = normalizedInput === normalizedExpected || (replacedWordNormalized !== '' && normalizedInput === replacedWordNormalized);
        }

        let newScore = currentItem.difficultyScore || 0;
        
        if (isCorrect) {
            setFeedback('CORRECT');
            if (backspaceCount > 1) {
                newScore = Math.min(5, newScore + 1); // Struggled
            } else {
                newScore = Math.max(0, newScore - 1); // Perfect
            }
        } else {
            setFeedback('WRONG');
            setShowAnswer(true);
            newScore = Math.min(5, newScore + 2); // Failed
        }

        onUpdateItem({
            ...currentItem,
            difficultyScore: newScore,
            lastPracticedAt: Date.now()
        });
    };

    const nextWord = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
            resetTurn();
        } else {
            setMode(null); // Session end
        }
    };

    if (!mode) {
        return (
            <div className="max-w-3xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col min-h-[70vh]">
                <header className="flex items-center gap-4 mb-10 border-b border-stone-200 pb-6 mt-4">
                    <button onClick={onExit} className="p-2 rounded-full hover:bg-stone-200 transition-colors">
                        <IconArrowLeft />
                    </button>
                    <div>
                        <h2 className="text-3xl font-serif text-ink tracking-tight">Pratik Modu</h2>
                        <p className="text-stone-500 mt-1">Öğrenmek istediğiniz yeteneği seçin.</p>
                    </div>
                </header>

                <div className="grid md:grid-cols-3 gap-6 flex-1 items-start">
                    <button 
                        onClick={() => startPractice('WORD_TO_MEANING')}
                        className="group flex flex-col p-6 rounded-2xl border-2 border-stone-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left shadow-sm hover:shadow-md"
                    >
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">🇹🇷</div>
                        <h3 className="font-serif text-xl text-ink font-medium mb-2">Kelime → Anlam</h3>
                        <p className="text-sm text-stone-500 leading-relaxed">Kelimeyi görün ve Türkçe anlamını tahmin etmeye çalışın.</p>
                    </button>

                    <button 
                        onClick={() => startPractice('MEANING_TO_WORD')}
                        className="group flex flex-col p-6 rounded-2xl border-2 border-stone-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
                    >
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">🇬🇧</div>
                        <h3 className="font-serif text-xl text-ink font-medium mb-2">Anlam → Kelime</h3>
                        <p className="text-sm text-stone-500 leading-relaxed">Türkçe anlamı verilen kelimenin İngilizcesini hatırlayın.</p>
                    </button>

                    <button 
                        onClick={() => startPractice('FILL_BLANK')}
                        className="group flex flex-col p-6 rounded-2xl border-2 border-stone-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left shadow-sm hover:shadow-md"
                    >
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">🧩</div>
                        <h3 className="font-serif text-xl text-ink font-medium mb-2">Boşluk Doldurma</h3>
                        <p className="text-sm text-stone-500 leading-relaxed">Örnek cümleyi okuyun ve eksik olan kelimeyi bulun.</p>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6 min-h-[80vh] flex flex-col">
            <header className="flex justify-between items-center mb-12 mt-4">
                <button onClick={() => setMode(null)} className="flex items-center gap-2 text-stone-500 hover:text-ink transition-colors font-medium">
                    <IconArrowLeft /> Geri Dön
                </button>
                <div className="flex gap-1">
                    {queue.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === currentIndex ? 'bg-ink' : i < currentIndex ? 'bg-stone-300' : 'bg-stone-200'}`} />
                    ))}
                </div>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center mb-10 w-full animate-in fade-in slide-in-from-top-4">
                    <span className="text-xs uppercase tracking-widest font-bold text-stone-400 mb-4 block">
                        {mode === 'WORD_TO_MEANING' ? 'Bunun anlamı nedir?' : 
                         mode === 'MEANING_TO_WORD' ? 'Bu kelime nedir?' : 
                         'Boşluğa ne gelmeli?'}
                    </span>
                    <h2 className="text-4xl md:text-5xl font-serif text-ink leading-tight px-4">
                        {mode === 'FILL_BLANK' ? (
                            <span className="italic leading-relaxed">
                                "
                                {feedback !== 'IDLE' && currentQuestion.prompt.includes('___') ? (
                                    currentQuestion.prompt.split('___').map((part, index, arr) => (
                                        <React.Fragment key={index}>
                                            {part}
                                            {index < arr.length - 1 && (
                                                <span className={`font-bold border-b-[3px] px-1.5 py-0.5 mx-1 rounded-md transition-all duration-500 animate-in zoom-in-95 ${feedback === 'CORRECT' ? 'text-emerald-600 border-emerald-300 bg-emerald-50/80' : 'text-red-500 border-red-300 bg-red-50/80'}`}>
                                                    {currentQuestion.replacedWord}
                                                </span>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    currentQuestion.prompt
                                )}
                                "
                            </span>
                        ) : (
                            currentQuestion.prompt
                        )}
                    </h2>
                </div>

                <div className={`w-full max-w-md transition-all duration-300 ${feedback === 'WRONG' ? 'animate-[shake_0.4s_ease-in-out]' : ''} ${feedback === 'CORRECT' ? 'scale-105' : ''}`}>
                    <input 
                        ref={inputRef}
                        type="text"
                        className={`w-full text-center text-xl md:text-2xl p-4 md:p-5 rounded-2xl border-2 focus:outline-none transition-colors shadow-sm bg-white font-serif
                            ${feedback === 'IDLE' ? 'border-stone-300 focus:border-stone-500 text-ink' : 
                              feedback === 'CORRECT' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 
                              'border-red-500 bg-red-50 text-red-800'}`}
                        placeholder="Cevabınızı yazın..."
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        readOnly={feedback !== 'IDLE'}
                        autoFocus
                        spellCheck={false}
                        autoComplete="off"
                    />
                </div>

                {/* Feedback Area */}
                <div className="mt-6 min-h-[12rem] flex flex-col items-center justify-start w-full">
                    {feedback === 'CORRECT' && (
                        <div className="flex flex-col items-center animate-in zoom-in duration-300">
                            <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <span className="text-emerald-600 font-medium text-lg mb-1">Harika!</span>
                            {currentQuestion.extraInfo === 'conjugation' && conjugatedMeaning && (
                                <div className="text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg mb-2 text-center max-w-md flex flex-col gap-1 w-full border border-blue-100 shadow-sm">
                                    <span className="font-bold text-blue-800 border-b border-blue-200 pb-1 mb-1 text-[10px] uppercase tracking-widest">Cümledeki Çevirisi</span>
                                    <div className="flex justify-between items-center px-2">
                                        <span className="font-medium text-blue-700">{currentItem?.word}</span>
                                        <span className="text-blue-400 text-xs">→</span>
                                        <span>{currentItem?.definition}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-2">
                                        <span className="font-medium text-blue-700">{currentQuestion.replacedWord}</span>
                                        <span className="text-blue-400 text-xs">→</span>
                                        <span>{conjugatedMeaning}</span>
                                    </div>
                                </div>
                            )}
                            {currentQuestion.extraInfo === 'conjugation' && !conjugatedMeaning && (
                                <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg mb-2 text-center max-w-md">Çeviri yükleniyor...</span>
                            )}
                            <span className="text-sm text-stone-400 bg-stone-100 px-3 py-1 rounded-full">Devam etmek için Enter'a basın</span>
                        </div>
                    )}
                    
                    {feedback === 'WRONG' && (
                        <div className="flex flex-col items-center animate-in zoom-in duration-300 w-full max-w-md">
                            <div className="text-red-500 font-medium mb-3">Doğru cevap şöyle olmalıydı:</div>
                            <div className="bg-white border-2 border-red-100 p-4 rounded-xl w-full text-center shadow-sm">
                                <span className="font-serif text-2xl text-ink font-medium">{currentQuestion.expected}</span>
                            </div>
                            {currentQuestion.extraInfo === 'conjugation' && conjugatedMeaning && (
                                <div className="text-sm text-blue-600 bg-blue-50 px-4 py-2 rounded-lg mt-3 text-center w-full border border-blue-100 shadow-sm flex flex-col gap-1">
                                    <span className="font-bold text-blue-800 border-b border-blue-200 pb-1 mb-1 text-[10px] uppercase tracking-widest">Cümledeki Çevirisi</span>
                                    <div className="flex justify-between items-center px-2">
                                        <span className="font-medium text-blue-700">{currentItem?.word}</span>
                                        <span className="text-blue-400 text-xs">→</span>
                                        <span>{currentItem?.definition}</span>
                                    </div>
                                    <div className="flex justify-between items-center px-2">
                                        <span className="font-medium text-blue-700">{currentQuestion.replacedWord}</span>
                                        <span className="text-blue-400 text-xs">→</span>
                                        <span>{conjugatedMeaning}</span>
                                    </div>
                                </div>
                            )}
                            <span className="text-sm text-stone-400 mt-3 bg-stone-100 px-3 py-1 rounded-full">Devam etmek için Enter'a basın</span>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-10px); }
                    40%, 80% { transform: translateX(10px); }
                }
            `}</style>
        </div>
    );
};
