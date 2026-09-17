import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PhotoItem, FrameSettings, TransitionType } from '../types';
import { ClockOverlay } from './ClockOverlay';
import { ImageOff } from 'lucide-react';

interface DigitalFrameProps {
  currentPhoto: PhotoItem | null;
  direction: number;
  settings: FrameSettings;
  onNext: () => void;
  onPrev: () => void;
}

export function DigitalFrame({
  currentPhoto,
  direction,
  settings,
}: DigitalFrameProps) {
  const [activeTransition, setActiveTransition] = useState<TransitionType>(settings.transition);
  const [loadError, setLoadError] = useState(false);

  // When transition is set to 'random', choose a random transition on each photo change
  useEffect(() => {
    if (settings.transition === 'random') {
      const candidates: TransitionType[] = [
        'fade',
        'slide-h',
        'slide-v',
        'kenburns',
        'zoom',
        'blur',
        'flip',
      ];
      const randomIndex = Math.floor(Math.random() * candidates.length);
      setActiveTransition(candidates[randomIndex]);
    } else {
      setActiveTransition(settings.transition);
    }
    setLoadError(false);
  }, [currentPhoto?.id, settings.transition]);

  // Motion transition definitions
  const transitionDuration = settings.transitionDuration;

  const animationVariants = useMemo(() => {
    switch (activeTransition) {
      case 'slide-h':
        return {
          initial: { x: direction >= 0 ? '100%' : '-100%', opacity: 0.7 },
          animate: { x: 0, opacity: 1 },
          exit: { x: direction >= 0 ? '-100%' : '100%', opacity: 0 },
        };
      case 'slide-v':
        return {
          initial: { y: direction >= 0 ? '100%' : '-100%', opacity: 0.7 },
          animate: { y: 0, opacity: 1 },
          exit: { y: direction >= 0 ? '-100%' : '100%', opacity: 0 },
        };
      case 'zoom':
        return {
          initial: { scale: 1.15, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0.9, opacity: 0 },
        };
      case 'blur':
        return {
          initial: { filter: 'blur(20px)', opacity: 0, scale: 1.05 },
          animate: { filter: 'blur(0px)', opacity: 1, scale: 1 },
          exit: { filter: 'blur(16px)', opacity: 0, scale: 0.98 },
        };
      case 'flip':
        return {
          initial: { rotateY: direction >= 0 ? 80 : -80, opacity: 0, transformPerspective: 1200 },
          animate: { rotateY: 0, opacity: 1, transformPerspective: 1200 },
          exit: { rotateY: direction >= 0 ? -80 : 80, opacity: 0, transformPerspective: 1200 },
        };
      case 'kenburns':
        return {
          initial: { scale: 1.18, opacity: 0, x: -10, y: 10 },
          animate: { scale: 1.02, opacity: 1, x: 0, y: 0 },
          exit: { opacity: 0, scale: 0.98 },
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
    }
  }, [activeTransition, direction]);

  // Frame container styling based on FrameStyle
  const getFrameContainerClass = () => {
    switch (settings.frameStyle) {
      case 'passe-partout':
        return 'p-4 sm:p-8 md:p-10 bg-stone-100 shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-stone-300/80 m-4 sm:m-8 rounded-sm';
      case 'wood-oak':
        return 'p-4 sm:p-7 md:p-9 bg-gradient-to-br from-[#c8996b] via-[#a87442] to-[#7c4f27] shadow-[0_30px_70px_rgba(0,0,0,0.9)] border-4 border-[#6e431e] m-4 sm:m-8 rounded-sm';
      case 'wood-walnut':
        return 'p-4 sm:p-7 md:p-9 bg-gradient-to-br from-[#4a3424] via-[#2f1f14] to-[#1e130a] shadow-[0_30px_70px_rgba(0,0,0,0.95)] border-4 border-[#140b05] m-4 sm:m-8 rounded-sm';
      case 'aluminum-black':
        return 'p-3 sm:p-5 md:p-6 bg-gradient-to-b from-[#2d2d30] via-[#1b1b1d] to-[#121213] shadow-[0_25px_60px_rgba(0,0,0,0.9)] border border-white/15 m-3 sm:m-6 rounded-md';
      case 'canvas-shadow':
        return 'm-4 sm:m-8 shadow-[0_30px_80px_rgba(0,0,0,0.85)] border border-white/5 rounded-sm';
      case 'borderless':
      default:
        return 'w-full h-full';
    }
  };

  const brightnessStyle = {
    filter: `brightness(${settings.brightness}%)`,
  };

  return (
    <div
      id="digital-frame-root"
      className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center select-none"
      style={brightnessStyle}
    >
      {/* Dynamic blurred ambient background for contain mode */}
      {settings.fittingMode === 'contain' && settings.ambientBlurBackground && currentPhoto && (
        <div
          id="frame-ambient-backdrop"
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          <div
            className="w-full h-full bg-center bg-cover scale-125 blur-3xl opacity-35 transition-all duration-1000 ease-out"
            style={{ backgroundImage: `url("${currentPhoto.url}")` }}
          />
          <div className="absolute inset-0 bg-black/45" />
        </div>
      )}

      {/* Frame wrapper */}
      <div
        id="frame-enclosure"
        className={`relative w-full h-full flex items-center justify-center transition-all duration-500 overflow-hidden ${getFrameContainerClass()}`}
      >
        {/* The inner viewport holding the picture */}
        <div
          id="frame-photo-viewport"
          className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {currentPhoto && !loadError ? (
              <motion.div
                key={currentPhoto.id}
                variants={animationVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{
                  duration: transitionDuration,
                  ease: [0.25, 1, 0.5, 1], // Smooth natural cubic bezier
                }}
                className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden"
              >
                {/* Continuous Ken Burns drift option */}
                <motion.div
                  className="w-full h-full flex items-center justify-center"
                  animate={
                    settings.kenBurnsActive || activeTransition === 'kenburns'
                      ? {
                          scale: [1, 1.08, 1.04],
                          x: [0, 15, -10],
                          y: [0, -8, 8],
                        }
                      : { scale: 1, x: 0, y: 0 }
                  }
                  transition={{
                    duration: settings.intervalSeconds * 1.5,
                    ease: 'easeInOut',
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                >
                  <img
                    id={`photo-${currentPhoto.id}`}
                    src={currentPhoto.url}
                    alt={currentPhoto.name}
                    referrerPolicy="no-referrer"
                    onError={() => setLoadError(true)}
                    className={`w-full h-full select-none ${
                      settings.fittingMode === 'cover'
                        ? 'object-cover object-center'
                        : 'object-contain object-center'
                    }`}
                  />
                </motion.div>
              </motion.div>
            ) : loadError ? (
              <div
                key="load-error"
                id="photo-load-error"
                className="flex flex-col items-center justify-center text-stone-400 p-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-amber-400 mb-4">
                  <ImageOff className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-stone-200">
                  Impossible de charger l'image
                </h3>
                <p className="text-xs text-stone-400 max-w-md mt-1">
                  {currentPhoto?.name || 'Fichier indisponible ou format non supporté.'}
                </p>
              </div>
            ) : (
              <div
                key="empty-state"
                id="photo-empty-state"
                className="flex flex-col items-center justify-center text-stone-400 p-8 text-center"
              >
                <p className="text-sm font-medium">Aucune photo sélectionnée</p>
                <p className="text-xs text-stone-500 mt-1">
                  Choisissez un dossier local ou un partage SMB pour commencer.
                </p>
              </div>
            )}
          </AnimatePresence>

          {/* Clock & Date overlay */}
          <ClockOverlay
            position={settings.clockPosition}
            showSeconds={settings.showClockSeconds}
          />

          {/* Photo caption / info overlay */}
          {settings.showPhotoInfo && currentPhoto && (
            <div
              id="frame-photo-caption"
              className="absolute bottom-6 right-6 z-20 pointer-events-none max-w-sm sm:max-w-md text-right drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            >
              <div className="font-['Plus_Jakarta_Sans'] font-medium text-white/90 text-sm sm:text-base truncate">
                {currentPhoto.name}
              </div>
              {currentPhoto.path && (
                <div className="font-['Plus_Jakarta_Sans'] text-white/60 text-xs truncate mt-0.5">
                  {currentPhoto.path}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
