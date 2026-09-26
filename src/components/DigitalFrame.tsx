import { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PhotoItem, FrameSettings, TransitionType } from '../types';
import { ClockOverlay } from './ClockOverlay';
import { ImageOff, RotateCw } from 'lucide-react';
import { detectPhotoMetadata, isExifPortrait } from '../utils/exif';

interface DigitalFrameProps {
  currentPhoto: PhotoItem | null;
  direction: number;
  settings: FrameSettings;
  manualRotation?: number;
  onNext: () => void;
  onPrev: () => void;
  onPhotoMetadataDetected?: (photoId: string, metadata: { isPortrait: boolean; exifOrientation: number }) => void;
}

export function DigitalFrame({
  currentPhoto,
  direction,
  settings,
  manualRotation,
  onPhotoMetadataDetected,
}: DigitalFrameProps) {
  const [activeTransition, setActiveTransition] = useState<TransitionType>(settings.transition);
  const [loadError, setLoadError] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? (window.innerWidth || 1280) : 1280,
    height: typeof window !== 'undefined' ? (window.innerHeight || 800) : 800,
  }));
  const [metadataMap, setMetadataMap] = useState<Record<string, { isPortrait: boolean; exifOrientation: number }>>({});

  // Mesure des dimensions du viewport pour la rotation plein écran
  useEffect(() => {
    if (!viewportRef.current) return;
    const updateSize = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setViewportSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(viewportRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Détection du mode portrait en prenant en compte :
  // 1. Les métadonnées existantes de la photo (photo.isPortrait, photo.exifOrientation)
  // 2. Le cache local metadataMap alimenté par l'analyseur EXIF 0x0112
  const detectedInfo = useMemo(() => {
    if (!currentPhoto) return { isPortrait: false, exifOrientation: 1 };

    if (currentPhoto.isPortrait !== undefined) {
      return {
        isPortrait: currentPhoto.isPortrait,
        exifOrientation: currentPhoto.exifOrientation ?? 1,
      };
    }

    if (currentPhoto.exifOrientation && isExifPortrait(currentPhoto.exifOrientation)) {
      return {
        isPortrait: true,
        exifOrientation: currentPhoto.exifOrientation,
      };
    }

    if (currentPhoto.height && currentPhoto.width && currentPhoto.height > currentPhoto.width) {
      return {
        isPortrait: true,
        exifOrientation: currentPhoto.exifOrientation ?? 1,
      };
    }

    if (metadataMap[currentPhoto.id]) {
      return metadataMap[currentPhoto.id];
    }

    return { isPortrait: false, exifOrientation: 1 };
  }, [currentPhoto, metadataMap]);

  const isPortrait = detectedInfo.isPortrait;
  const currentExifOrientation = detectedInfo.exifOrientation;

  // Analyse asynchrone du tag EXIF 0x0112 et des dimensions pour chaque photo affichée
  useEffect(() => {
    if (!currentPhoto) return;
    if (currentPhoto.isPortrait !== undefined && currentPhoto.exifOrientation !== undefined) {
      return; // Métadonnées déjà complètes
    }
    if (metadataMap[currentPhoto.id]) {
      return; // Déjà analysé et mis en cache
    }

    let isMounted = true;
    detectPhotoMetadata(currentPhoto.url).then((meta) => {
      if (!isMounted) return;
      const detected = {
        isPortrait: meta.isPortrait,
        exifOrientation: meta.exifOrientation,
      };
      setMetadataMap((prev) => ({
        ...prev,
        [currentPhoto.id]: detected,
      }));
      onPhotoMetadataDetected?.(currentPhoto.id, detected);
    });

    return () => {
      isMounted = false;
    };
  }, [currentPhoto?.id, currentPhoto?.url, currentPhoto?.isPortrait, currentPhoto?.exifOrientation, metadataMap, onPhotoMetadataDetected]);

  // Si le tag EXIF 0x0112 ou le ratio indique le mode portrait, pivoter de 90 degrés
  const effectiveRotation = useMemo(() => {
    if (manualRotation !== undefined) {
      return manualRotation;
    }
    if (isPortrait) {
      if (settings.portraitReorientation === 'rotate-90') {
        return 90;
      }
      if (settings.portraitReorientation === 'rotate-270') {
        return 270;
      }
    }
    return 0;
  }, [manualRotation, isPortrait, settings.portraitReorientation]);

  const isRotatedQuarterTurn = effectiveRotation % 180 !== 0;

  // When transition is set to 'random', choose a random transition on each photo change
  useEffect(() => {
    if (settings.transition === 'random') {
      const candidates: TransitionType[] = [
        'fade',
        'slide-h',
        'slide-v',
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
          initial: { x: direction >= 0 ? '100%' : '-100%', opacity: 1, zIndex: 20 },
          animate: { x: 0, opacity: 1, zIndex: 20 },
          exit: { opacity: 0, zIndex: 1 },
        };
      case 'slide-v':
        return {
          initial: { y: direction >= 0 ? '100%' : '-100%', opacity: 1, zIndex: 20 },
          animate: { y: 0, opacity: 1, zIndex: 20 },
          exit: { opacity: 0, zIndex: 1 },
        };
      case 'zoom':
        return {
          initial: { scale: 1.08, opacity: 0, zIndex: 20 },
          animate: { scale: 1, opacity: 1, zIndex: 20 },
          exit: { opacity: 0, zIndex: 1 },
        };
      case 'blur':
        return {
          initial: { filter: 'blur(16px)', opacity: 0, zIndex: 20 },
          animate: { filter: 'blur(0px)', opacity: 1, zIndex: 20 },
          exit: { opacity: 0, zIndex: 1 },
        };
      case 'flip':
        return {
          initial: { rotateY: direction >= 0 ? 80 : -80, opacity: 0, transformPerspective: 1200, zIndex: 20 },
          animate: { rotateY: 0, opacity: 1, transformPerspective: 1200, zIndex: 20 },
          exit: { opacity: 0, zIndex: 1 },
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0, zIndex: 20 },
          animate: { opacity: 1, zIndex: 20 },
          exit: { opacity: 0, zIndex: 1 },
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

  // En mode portrait, redimensionner automatiquement (mode contain) afin d'afficher l'intégralité de l'image sans rognage (anti-crop)
  const effectiveFittingMode = (isPortrait || settings.fittingMode === 'contain') ? 'contain' : 'cover';

  // Dimensions of rotated photo container to span the landscape viewport
  const rotatedContainerStyle: React.CSSProperties = isRotatedQuarterTurn && viewportSize.width > 0 && viewportSize.height > 0
    ? {
        width: `${viewportSize.height}px`,
        height: `${viewportSize.width}px`,
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `translate(-50%, -50%) rotate(${effectiveRotation}deg)`,
        transformOrigin: 'center center',
        transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
      }
    : {
        width: '100%',
        height: '100%',
        transform: effectiveRotation !== 0 ? `rotate(${effectiveRotation}deg)` : undefined,
        transformOrigin: 'center center',
        transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
      };

  return (
    <div
      id="digital-frame-root"
      className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center select-none"
      style={brightnessStyle}
    >
      {/* Dynamic blurred ambient background for contain mode or uncropped portrait */}
      {effectiveFittingMode === 'contain' && settings.ambientBlurBackground && currentPhoto && (
        <div
          id="frame-ambient-backdrop"
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          <div
            className="w-full h-full bg-center bg-cover scale-125 blur-3xl opacity-35 transition-all duration-1000 ease-out"
            style={{
              backgroundImage: `url("${currentPhoto.url}")`,
              transform: isRotatedQuarterTurn ? `scale(1.4) rotate(${effectiveRotation}deg)` : undefined,
            }}
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
          ref={viewportRef}
          id="frame-photo-viewport"
          className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black"
        >
          <AnimatePresence initial={false}>
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
                <div
                  style={rotatedContainerStyle}
                  className="flex items-center justify-center"
                >
                  <img
                    id={`photo-${currentPhoto.id}`}
                    src={currentPhoto.url}
                    alt={currentPhoto.name}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setLoadError(true)}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalHeight && img.naturalWidth) {
                        const isPortByDim = img.naturalHeight > img.naturalWidth;
                        const isPort = isExifPortrait(currentExifOrientation) || isPortByDim;
                        if (!metadataMap[currentPhoto.id] || metadataMap[currentPhoto.id].isPortrait !== isPort) {
                          setMetadataMap((prev) => ({
                            ...prev,
                            [currentPhoto.id]: {
                              isPortrait: isPort,
                              exifOrientation: currentExifOrientation,
                            },
                          }));
                          onPhotoMetadataDetected?.(currentPhoto.id, {
                            isPortrait: isPort,
                            exifOrientation: currentExifOrientation,
                          });
                        }
                      }
                    }}
                    className={`w-full h-full select-none ${
                      effectiveFittingMode === 'contain'
                        ? 'object-contain object-center'
                        : 'object-cover object-center'
                    }`}
                  />
                </div>
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
              <div className="font-['Plus_Jakarta_Sans'] font-medium text-white/90 text-sm sm:text-base truncate flex items-center justify-end gap-2">
                {isPortrait && effectiveRotation !== 0 && (
                  <span
                    id="badge-auto-portrait-reorient"
                    className="inline-flex items-center gap-1 text-[11px] bg-amber-500/25 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-full font-mono font-normal"
                    title={`Format portrait d'origine réorienté à ${effectiveRotation}° en mode paysage`}
                  >
                    <RotateCw className="w-3 h-3" /> Auto-paysage ({effectiveRotation}°)
                  </span>
                )}
                {!isPortrait && effectiveRotation !== 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-normal">
                    <RotateCw className="w-3 h-3" /> {effectiveRotation}°
                  </span>
                )}
                <span>{currentPhoto.name}</span>
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
