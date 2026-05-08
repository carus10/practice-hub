import React, { useState, useEffect } from 'react';

interface WelcomeScreenProps {
  onEnter: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onEnter }) => {
  const [displayText, setDisplayText] = useState('');
  const fullText = "Practice Hub'a Hoşgeldiniz";
  const [isTypingDone, setIsTypingDone] = useState(false);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= fullText.length) {
        setDisplayText(fullText.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        setIsTypingDone(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black cursor-pointer overflow-hidden font-sans"
      onClick={onEnter}
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] scale-105"
        style={{ 
          backgroundImage: 'url("/assets/welcome-bg.png")',
        }}
      />
      
      {/* Light and Subtle Overlays */}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl w-full">
        <h1 className="text-5xl md:text-7xl font-medium text-white mb-8 tracking-[0.15em] uppercase drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] leading-tight">
          {/* Using a natural flow for the cursor to follow wrapping correctly */}
          <span className="inline">
            {displayText}
            <span className={`inline-block w-[3px] h-[0.8em] bg-accent shadow-[0_0_15px_rgba(192,86,33,0.8)] ml-2 align-middle -mt-1 ${!isTypingDone ? 'opacity-100' : 'animate-blink'}`}></span>
          </span>
        </h1>
        
        <div className={`transition-all duration-1000 delay-300 ${isTypingDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-xl md:text-2xl text-white/90 font-light tracking-[0.25em] uppercase mb-16 drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
              Kişisel Çalışma Alanınız
            </p>

            <button className="group relative px-20 py-5 overflow-hidden rounded-full transition-all active:scale-95 shadow-2xl">
              <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/20 group-hover:bg-white/15 transition-all" />
              <div className="relative flex items-center gap-6 text-white font-light tracking-[0.3em] text-sm uppercase group-hover:scale-105 transition-transform">
                <span>Keşfetmeye Başla</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
      `}</style>

      {/* Decorative corners */}
      <div className="absolute bottom-16 left-16 border-l border-b border-white/10 w-12 h-12" />
      <div className="absolute top-16 right-16 border-r border-t border-white/10 w-12 h-12" />
      
      <div className="absolute bottom-12 right-12 text-white/20 text-[10px] tracking-[0.5em] uppercase font-light">
        Pratik Hub v1.1
      </div>
    </div>
  );
};
