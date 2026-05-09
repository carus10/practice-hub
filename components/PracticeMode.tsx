import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DictionaryItem } from '../types';
import { IconArrowLeft, IconCheck, IconX } from './Icons';
import { stemmer } from 'stemmer';

interface PracticeModeProps {
    items: DictionaryItem[];
    onUpdateItem: (item: DictionaryItem) => void;
    onExit: () => void;
}

type PracticeType = 'WORD_TO_MEANING' | 'MEANING_TO_WORD' | 'FILL_BLANK' | 'PRONUNCIATION_CHALLENGE' | null;

export const PracticeMode: React.FC<PracticeModeProps> = ({ items, onUpdateItem, onExit }) => {
    const [mode, setMode] = useState<PracticeType>(null);
    const [queue, setQueue] = useState<DictionaryItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    
    const [inputValue, setInputValue] = useState('');
    const [backspaceCount, setBackspaceCount] = useState(0);
    
    // UI state
    const [feedback, setFeedback] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
    const [showAnswer, setShowAnswer] = useState(false);

    // Pronunciation Challenge specific state
    const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
    const [hintCount, setHintCount] = useState(0);
    const [listenCount, setListenCount] = useState(0);
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

        // Weight algorithm: Score (0-10)
        practiceItems.sort((a, b) => {
            const scoreA = a.difficultyScore || 0;
            const scoreB = b.difficultyScore || 0;
            
            // Zaman faktörü: Pratik yapılmayan her gün için ağırlık artar. Hiç yapılmadıysa 10 günlük avantaj.
            const daysSinceA = a.lastPracticedAt ? (Date.now() - a.lastPracticedAt) / 86400000 : 10;
            const daysSinceB = b.lastPracticedAt ? (Date.now() - b.lastPracticedAt) / 86400000 : 10;

            const weightA = scoreA * 2 + Math.random() * 5 + daysSinceA;
            const weightB = scoreB * 2 + Math.random() * 5 + daysSinceB;
            
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
        setRevealedIndices([]);
        setHintCount(0);
        setListenCount(0);
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
        } else if (mode === 'PRONUNCIATION_CHALLENGE') {
            expected = currentItem.word;
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
            if (mode === 'PRONUNCIATION_CHALLENGE') {
                // listenCount: 1 = perfect(-1), 2 = neutral(0), 3+ = +1
                const listenPenalty = listenCount <= 1 ? -1 : listenCount <= 2 ? 0 : 1;
                // hintCount: 0=0, 1=+1, 2=+2, 3+=+3
                const hintPenalty = Math.min(hintCount, 3);
                newScore = Math.max(0, Math.min(10, newScore + listenPenalty + hintPenalty));
            } else {
                if (backspaceCount > 1) {
                    newScore = Math.min(10, newScore + 2);
                } else {
                    newScore = Math.max(0, newScore - 1);
                }
            }
        } else {
            setFeedback('WRONG');
            setShowAnswer(true);
            newScore = Math.min(10, newScore + 4);
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

    // ─── Pronunciation helpers ───
    const speakWord = () => {
        if (!currentItem) return;
        const utt = new SpeechSynthesisUtterance(currentItem.word);
        utt.lang = 'en-US';
        utt.rate = 0.85;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utt);
        setListenCount(prev => prev + 1);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const revealHint = () => {
        if (!currentItem) return;
        const word = currentItem.word;
        const letterIndices = word.split('').map((ch, i) => i).filter(i => /[a-zA-Z]/.test(word[i]));
        const unrevealed = letterIndices.filter(i => !revealedIndices.includes(i));
        if (unrevealed.length === 0) return;
        const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        setRevealedIndices(prev => [...prev, pick]);
        setHintCount(prev => prev + 1);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    if (!mode) {
        return (
            <div className="max-w-5xl mx-auto p-8 animate-in fade-in zoom-in-95 duration-700 flex flex-col min-h-[80vh] relative selection:bg-accent/30">
                {/* Decorative background blurs just for this screen */}
                <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-200/20 rounded-full blur-[80px] -z-10"></div>
                <div className="absolute bottom-0 right-0 w-72 h-72 bg-blue-200/20 rounded-full blur-[80px] -z-10"></div>

                <header className="flex flex-col items-center text-center mb-16 mt-8 relative z-10 w-full">
                    <button onClick={onExit} className="absolute left-0 top-0 p-3 rounded-xl hover:bg-white/80 hover:shadow-sm transition-all border border-transparent hover:border-stone-200 flex items-center gap-2 text-stone-500 hover:text-ink bg-white/40 backdrop-blur-md">
                        <IconArrowLeft /> <span className="text-sm font-medium">Geri Dön</span>
                    </button>
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-white to-stone-50 shadow-md border border-white mb-6 transform rotate-3">
                        <span className="text-3xl transform -rotate-3">🎯</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-serif text-ink tracking-tight mb-4">Pratik Modu</h2>
                    <p className="text-stone-500 text-lg max-w-md mx-auto leading-relaxed">Öğrenmek ve test etmek istediğiniz yeteneği seçerek antrenmana başlayın.</p>
                </header>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 flex-1 items-stretch relative z-10">
                    {/* Card 1 */}
                    <button 
                        onClick={() => startPractice('WORD_TO_MEANING')}
                        className="group flex flex-col p-8 rounded-[2rem] bg-white/70 backdrop-blur-xl border border-white hover:border-emerald-200/50 hover:bg-white/90 transition-all duration-500 text-left shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(16,185,129,0.1)] hover:-translate-y-2 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-bl-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 -z-10"></div>
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-[1.2rem] flex items-center justify-center mb-8 text-2xl shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-500 rotate-[-2deg] group-hover:rotate-0">🇹🇷</div>
                        <h3 className="font-serif text-2xl text-ink font-medium mb-3">Kelime → Anlam</h3>
                        <p className="text-sm text-stone-500 leading-relaxed font-medium">İngilizce kelimeyi görün ve Türkçe anlamını tahmin etmeye çalışın.</p>
                    </button>

                    {/* Card 2 */}
                    <button 
                        onClick={() => startPractice('MEANING_TO_WORD')}
                        className="group flex flex-col p-8 rounded-[2rem] bg-white/70 backdrop-blur-xl border border-white hover:border-blue-200/50 hover:bg-white/90 transition-all duration-500 text-left shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(59,130,246,0.1)] hover:-translate-y-2 relative overflow-hidden delay-75"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-100/50 to-transparent rounded-bl-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 -z-10"></div>
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-[1.2rem] flex items-center justify-center mb-8 text-2xl shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-500 rotate-2 group-hover:rotate-0">🇬🇧</div>
                        <h3 className="font-serif text-2xl text-ink font-medium mb-3">Anlam → Kelime</h3>
                        <p className="text-sm text-stone-500 leading-relaxed font-medium">Türkçe anlamı verilen kelimenin İngilizcesini hatırlayın ve yazın.</p>
                    </button>

                    {/* Card 3 */}
                    <button 
                        onClick={() => startPractice('FILL_BLANK')}
                        className="group flex flex-col p-8 rounded-[2rem] bg-white/70 backdrop-blur-xl border border-white hover:border-amber-200/50 hover:bg-white/90 transition-all duration-500 text-left shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(245,158,11,0.1)] hover:-translate-y-2 relative overflow-hidden delay-150"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-100/50 to-transparent rounded-bl-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 -z-10"></div>
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-[1.2rem] flex items-center justify-center mb-8 text-2xl shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform duration-500 rotate-[-2deg] group-hover:rotate-0">🧩</div>
                        <h3 className="font-serif text-2xl text-ink font-medium mb-3">Boşluk Doldurma</h3>
                        <p className="text-sm text-stone-500 leading-relaxed font-medium">Örnek cümleyi okuyun ve eksik olan bağlamdaki kelimeyi bulun.</p>
                    </button>

                    {/* Card 4 — Pronunciation Challenge */}
                    <button 
                        onClick={() => startPractice('PRONUNCIATION_CHALLENGE')}
                        className="group flex flex-col p-8 rounded-[2rem] bg-white/70 backdrop-blur-xl border border-white hover:border-violet-200/50 hover:bg-white/90 transition-all duration-500 text-left shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(139,92,246,0.1)] hover:-translate-y-2 relative overflow-hidden delay-200"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-violet-100/50 to-transparent rounded-bl-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 -z-10"></div>
                        <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-violet-600 text-white rounded-[1.2rem] flex items-center justify-center mb-8 text-2xl shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-500 rotate-2 group-hover:rotate-0">🎧</div>
                        <h3 className="font-serif text-2xl text-ink font-medium mb-3">Ses → Kelime</h3>
                        <p className="text-sm text-stone-500 leading-relaxed font-medium">Kelimenin sesini dinle ve harfleri tahmin ederek kelimeyi bul.</p>
                    </button>
                </div>
            </div>
        );
    }

    // ─── PRONUNCIATION CHALLENGE GAME SCREEN ───
    if (mode === 'PRONUNCIATION_CHALLENGE' && currentItem) {
        const word = currentItem.word;
        const letterIndices = word.split('').map((_, i) => i).filter(i => /[a-zA-Z]/.test(word[i]));
        const allRevealed = letterIndices.every(i => revealedIndices.includes(i));
        const isDone = feedback !== 'IDLE';

        return (
            <div className="max-w-2xl mx-auto p-6 min-h-[80vh] flex flex-col">
                <header className="flex justify-between items-center mb-10 mt-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMode(null)} className="flex items-center gap-2 text-stone-500 hover:text-ink transition-colors font-medium">
                            <IconArrowLeft /> Geri Dön
                        </button>
                        {/* Hint button — top left */}
                        {!isDone && (
                            <button
                                onClick={revealHint}
                                disabled={allRevealed}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
                                    allRevealed
                                        ? 'bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                                title="Rastgele bir harf aç"
                            >
                                💡 İpucu {hintCount > 0 && <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">{hintCount}</span>}
                            </button>
                        )}
                    </div>
                    <div className="flex gap-1">
                        {queue.map((_, i) => (
                            <div key={i} className={`w-2 h-2 rounded-full ${
                                i === currentIndex ? 'bg-violet-500' : i < currentIndex ? 'bg-stone-300' : 'bg-stone-200'
                            }`} />
                        ))}
                    </div>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center gap-8">
                    <div className="text-center">
                        <span className="text-xs uppercase tracking-widest font-bold text-violet-400 mb-1 block">Sesi Dinle, Kelimeyi Bul</span>
                        <p className="text-stone-400 text-sm">{word.length} harfli bir kelime</p>
                    </div>

                    {/* Letter Tiles */}
                    <div className="flex flex-wrap justify-center gap-2">
                        {word.split('').map((ch, i) => {
                            const isLetter = /[a-zA-Z]/.test(ch);
                            if (!isLetter) {
                                return <div key={i} className="flex items-end pb-2 w-3"><span className="text-xl text-stone-400">{ch}</span></div>;
                            }
                            const revealed = revealedIndices.includes(i) || isDone;
                            const isHinted = revealedIndices.includes(i) && !isDone;
                            return (
                                <div key={i} className={`w-10 h-12 flex flex-col items-center justify-end border-b-2 transition-all duration-300 ${
                                    isDone
                                        ? feedback === 'CORRECT' ? 'border-emerald-400' : 'border-red-400'
                                        : isHinted ? 'border-amber-400' : 'border-stone-300'
                                }`}>
                                    <span className={`text-2xl font-serif font-bold transition-all duration-300 ${
                                        isDone
                                            ? feedback === 'CORRECT' ? 'text-emerald-600' : 'text-red-500'
                                            : isHinted ? 'text-amber-600' : 'text-ink'
                                    }`}>
                                        {revealed ? ch : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Sound Button */}
                    <button
                        onClick={speakWord}
                        disabled={isDone}
                        className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-medium transition-all shadow-md ${
                            isDone
                                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700 hover:shadow-lg hover:scale-105 active:scale-95'
                        }`}
                    >
                        <span className="text-xl">🔊</span>
                        Sesi Dinle
                        {listenCount > 0 && !isDone && (
                            <span className="bg-violet-400/40 text-white text-xs px-2 py-0.5 rounded-full">{listenCount}x</span>
                        )}
                    </button>

                    {/* Input */}
                    <div className={`w-full max-w-sm transition-all duration-300 ${feedback === 'WRONG' ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
                        <input
                            ref={inputRef}
                            type="text"
                            className={`w-full text-center text-2xl p-4 rounded-2xl border-2 focus:outline-none transition-colors shadow-sm bg-white font-serif ${
                                feedback === 'IDLE' ? 'border-stone-300 focus:border-violet-400 text-ink'
                                : feedback === 'CORRECT' ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                                : 'border-red-400 bg-red-50 text-red-800'
                            }`}
                            placeholder="Kelimeyi yazın..."
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            readOnly={isDone}
                            spellCheck={false}
                            autoComplete="off"
                            autoFocus
                        />
                    </div>

                    {/* Check button */}
                    {feedback === 'IDLE' && (
                        <button
                            onClick={checkAnswer}
                            disabled={!inputValue.trim()}
                            className="px-8 py-3 bg-violet-600 text-white rounded-2xl font-medium hover:bg-violet-700 disabled:opacity-40 transition-all shadow-md hover:shadow-lg"
                        >
                            Kontrol Et
                        </button>
                    )}

                    {/* Feedback */}
                    {feedback === 'CORRECT' && (
                        <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300">
                            <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <span className="text-emerald-600 font-medium text-lg">Harika!</span>
                            {hintCount > 0 && <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{hintCount} ipucu kullandın</span>}
                            {listenCount > 0 && <span className="text-xs text-violet-600 bg-violet-50 px-3 py-1 rounded-full">{listenCount} kez dinledin</span>}
                            <span className="text-sm text-stone-400 bg-stone-100 px-3 py-1 rounded-full mt-1">Devam için Enter'a basın</span>
                        </div>
                    )}
                    {feedback === 'WRONG' && (
                        <div className="flex flex-col items-center gap-2 animate-in zoom-in duration-300 w-full max-w-sm">
                            <div className="text-red-500 font-medium">Doğru kelime:</div>
                            <div className="bg-white border-2 border-red-100 p-4 rounded-xl w-full text-center shadow-sm">
                                <span className="font-serif text-2xl text-ink font-medium">{word}</span>
                            </div>
                            <span className="text-sm text-stone-400 bg-stone-100 px-3 py-1 rounded-full mt-1">Devam için Enter'a basın</span>
                        </div>
                    )}
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
