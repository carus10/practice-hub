import React, { useState, useEffect } from 'react';

interface WelcomeScreenProps {
  onEnter: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onEnter }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [typedText, setTypedText] = useState('');
  
  const fullText = "PRACTICE HUB";

  useEffect(() => {
    // Slight delay to trigger enter animations and start typing
    const timer = setTimeout(() => {
      setIsLoaded(true);
      
      let index = 0;
      const typeInterval = setInterval(() => {
        if (index <= fullText.length) {
          setTypedText(fullText.slice(0, index));
          index++;
        } else {
          clearInterval(typeInterval);
        }
      }, 150); // Typing speed
      
      return () => clearInterval(typeInterval);
    }, 400); // Start typing shortly after loading
    
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onEnter();
    }, 800); // Wait for exit animation
  };

  return (
    <div 
      className={`fixed inset-0 w-full h-full bg-[#faf9f6] flex items-center justify-center overflow-hidden font-sans selection:bg-accent/30 transition-all duration-800 ease-in-out ${isExiting ? 'opacity-0 scale-110 blur-xl pointer-events-none' : 'opacity-100 scale-100 blur-0'}`}
      onClick={handleEnter}
    >
      {/* Dynamic Background Orbs */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orange-200/40 mix-blend-multiply filter blur-[100px] opacity-70 animate-blob transition-all duration-1000 ${isLoaded ? 'opacity-70 translate-y-0' : 'opacity-0 -translate-y-20'}`} />
      <div className={`absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-200/40 mix-blend-multiply filter blur-[100px] opacity-70 animate-blob animation-delay-2000 transition-all duration-1000 ${isLoaded ? 'opacity-70 translate-x-0' : 'opacity-0 translate-x-20'}`} />
      <div className={`absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full bg-amber-100/40 mix-blend-multiply filter blur-[120px] opacity-70 animate-blob animation-delay-4000 transition-all duration-1000 ${isLoaded ? 'opacity-70 translate-y-0' : 'opacity-0 translate-y-20'}`} />

      {/* Subtle Noise Texture for Premium Feel */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* Main Content Container */}
      <div className={`relative z-10 flex flex-col items-center justify-center w-full max-w-4xl p-8 transition-all duration-1000 transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
        
        {/* Glassmorphic Card */}
        <div 
          className="relative w-full aspect-[21/9] md:aspect-[16/6] min-h-[400px] rounded-[2.5rem] p-1 group cursor-pointer transition-transform duration-300 active:scale-95"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Animated Gradient Border */}
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-r from-accent/20 via-white/50 to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-sm" />
          
          <div className="relative h-full w-full bg-white/60 dark:bg-white/5 backdrop-blur-2xl rounded-[2.3rem] border border-white/80 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col items-center justify-center py-12 transition-transform duration-700 group-hover:scale-[0.99]">
            
            {/* Top decorative line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-accent/30 dark:via-accent/50 to-transparent" />

            <div className="flex flex-col items-center space-y-6 z-20 pb-16">
              {/* Badge */}
              <div className="px-4 py-1.5 rounded-full border border-ink/10 dark:border-white/10 bg-white/50 dark:bg-white/5 text-xs font-medium tracking-[0.2em] text-ink/60 dark:text-white/60 uppercase backdrop-blur-md">
                Yeni Nesil Çalışma Alanı
              </div>

              {/* Main Title */}
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-light text-ink tracking-tight flex flex-col items-center gap-2">
                <span className="font-serif italic text-accent/80 text-3xl md:text-4xl pr-8 md:pr-12">The</span>
                <div className="tracking-[0.15em] font-medium uppercase drop-shadow-sm min-h-[1.2em] flex items-center justify-center w-full">
                  <span>{typedText}</span>
                  {/* Blinking Cursor */}
                  <span className="w-[3px] h-[0.8em] bg-accent ml-2 animate-blink inline-block" />
                </div>
              </h1>

              {/* Description */}
              <p className="text-sm md:text-base text-ink/50 font-light tracking-wide max-w-md text-center mt-6 px-6 leading-relaxed">
                Odaklan, öğren ve geliş. Kelimelerin gücünü keşfetmek için tasarlandı.
              </p>
            </div>

            {/* Bottom floating button indicator */}
            <div className={`absolute bottom-6 transition-all duration-700 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-60 translate-y-2'}`}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-[1px] h-8 bg-gradient-to-b from-ink/20 to-transparent animate-pulse" />
                <span className="text-[10px] tracking-[0.4em] text-ink/40 uppercase font-semibold">Keşfet</span>
              </div>
            </div>

            {/* Decorative Corner Accents */}
            <div className="absolute top-6 left-6 w-8 h-8 border-t border-l border-ink/10 rounded-tl-xl" />
            <div className="absolute bottom-6 right-6 w-8 h-8 border-b border-r border-ink/10 rounded-br-xl" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blob {
          animation: blob 15s infinite alternate;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

