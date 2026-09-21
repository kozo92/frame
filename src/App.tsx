import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DigitalFrame } from './components/DigitalFrame';
import { ControlsOverlay } from './components/ControlsOverlay';
import { SourceSelectorModal } from './components/SourceSelectorModal';
import { TransitionSettingsModal } from './components/TransitionSettingsModal';
import { PhotoItem, FrameSettings, PortraitOrientationMode } from './types';
import { SAMPLE_PHOTOS } from './data/samplePhotos';

// Fisher-Yates shuffle generator to guarantee that every photo is shown exactly once per cycle
function generateShuffledDeck(count: number, avoidFirstIndex: number = -1): number[] {
  if (count <= 0) return [];
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = indices[i];
    indices[i] = indices[j];
    indices[j] = temp;
  }
  // When starting a new cycle right after another cycle, prevent the first photo
  // of the new cycle from being identical to the last photo of the previous cycle
  if (count > 1 && avoidFirstIndex >= 0 && indices[0] === avoidFirstIndex) {
    const swapIdx = 1 + Math.floor(Math.random() * (count - 1));
    const temp = indices[0];
    indices[0] = indices[swapIdx];
    indices[swapIdx] = temp;
  }
  return indices;
}

export default function App() {
  // Photos state
  const [photos, setPhotos] = useState<PhotoItem[]>(SAMPLE_PHOTOS);

  // Deck of indices for cycle-based shuffle without repetition
  const shuffleDeckRef = useRef<number[]>(generateShuffledDeck(SAMPLE_PHOTOS.length));
  const shufflePointerRef = useRef<number>(0);
  const [shuffleStep, setShuffleStep] = useState<number>(0);

  // Start with the first photo of the shuffled deck
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    const deck = shuffleDeckRef.current;
    return deck.length > 0 ? deck[0] : 0;
  });
  const [direction, setDirection] = useState<number>(1);
  const [sourceName, setSourceName] = useState<string>('Galerie Haute Définition');

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // Modals state
  const [isSourceModalOpen, setIsSourceModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Settings (shuffle is TRUE by default as requested)
  const [settings, setSettings] = useState<FrameSettings>({
    intervalSeconds: 10,
    transition: 'fade',
    transitionDuration: 1.8,
    kenBurnsActive: false,
    shuffle: true,
    portraitReorientation: 'rotate-90',
    frameStyle: 'borderless',
    fittingMode: 'cover',
    ambientBlurBackground: true,
    brightness: 100,
    clockPosition: 'bottom-left',
    showClockSeconds: false,
    showPhotoInfo: true,
    showProgressBar: false,
    autoHideControls: true,
  });

  // Manual rotation override map (by photo id -> degrees 0, 90, 180, 270)
  const [photoRotations, setPhotoRotations] = useState<Record<string, number>>({});

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (photos.length === 0) return;
    setDirection(1);

    if (settings.shuffle && photos.length > 1) {
      let deck = shuffleDeckRef.current;
      if (!deck || deck.length !== photos.length) {
        deck = generateShuffledDeck(photos.length, currentIndex);
        shuffleDeckRef.current = deck;
        shufflePointerRef.current = 0;
      }

      let nextPointer = shufflePointerRef.current + 1;
      // When the entire cycle has completed without repetition:
      if (nextPointer >= deck.length) {
        const lastPhotoIdx = deck[deck.length - 1];
        deck = generateShuffledDeck(photos.length, lastPhotoIdx);
        shuffleDeckRef.current = deck;
        nextPointer = 0;
      }

      shufflePointerRef.current = nextPointer;
      setShuffleStep(nextPointer);
      setCurrentIndex(deck[nextPointer]);
    } else {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
  }, [photos.length, settings.shuffle, currentIndex]);

  const handlePrev = useCallback(() => {
    if (photos.length === 0) return;
    setDirection(-1);

    if (settings.shuffle && photos.length > 1) {
      let deck = shuffleDeckRef.current;
      if (!deck || deck.length !== photos.length) {
        deck = generateShuffledDeck(photos.length);
        shuffleDeckRef.current = deck;
        shufflePointerRef.current = 0;
      }

      let prevPointer = shufflePointerRef.current - 1;
      if (prevPointer < 0) {
        prevPointer = deck.length - 1;
      }

      shufflePointerRef.current = prevPointer;
      setShuffleStep(prevPointer);
      setCurrentIndex(deck[prevPointer]);
    } else {
      setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  }, [photos.length, settings.shuffle]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleToggleShuffle = useCallback(() => {
    setSettings((prev) => {
      const nextShuffle = !prev.shuffle;
      if (nextShuffle && photos.length > 1) {
        // Build fresh non-repeating cycle with current photo at position 0
        const remaining = Array.from({ length: photos.length }, (_, i) => i).filter(
          (i) => i !== currentIndex
        );
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = remaining[i];
          remaining[i] = remaining[j];
          remaining[j] = temp;
        }
        shuffleDeckRef.current = [currentIndex, ...remaining];
        shufflePointerRef.current = 0;
        setShuffleStep(0);
      }
      return { ...prev, shuffle: nextShuffle };
    });
  }, [photos.length, currentIndex]);

  // Update frame settings
  const handleUpdateSettings = (newSettings: Partial<FrameSettings>) => {
    if (newSettings.shuffle !== undefined && newSettings.shuffle !== settings.shuffle) {
      if (newSettings.shuffle && photos.length > 1) {
        const remaining = Array.from({ length: photos.length }, (_, i) => i).filter(
          (i) => i !== currentIndex
        );
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = remaining[i];
          remaining[i] = remaining[j];
          remaining[j] = temp;
        }
        shuffleDeckRef.current = [currentIndex, ...remaining];
        shufflePointerRef.current = 0;
        setShuffleStep(0);
      }
    }
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // When new photos are loaded from local drive or SMB share
  const handlePhotosLoaded = (newPhotos: PhotoItem[], sourceLabel: string) => {
    setSourceName(sourceLabel);

    setPhotos((prevPhotos) => {
      // Si c'est un flux progressif qui complète une liste déjà commencée
      const isProgressiveAddition = prevPhotos.length > 0 && newPhotos.length > prevPhotos.length && prevPhotos[0]?.id === newPhotos[0]?.id;

      if (isProgressiveAddition) {
        // Étendre le jeu aléatoire avec les nouvelles photos sans couper la photo en cours
        if (settings.shuffle) {
          const currentDeck = shuffleDeckRef.current;
          const currentCount = prevPhotos.length;
          const newIndices = Array.from({ length: newPhotos.length - currentCount }, (_, i) => currentCount + i);
          // Mélange des nouveaux indices
          for (let i = newIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = newIndices[i];
            newIndices[i] = newIndices[j];
            newIndices[j] = t;
          }
          shuffleDeckRef.current = [...currentDeck, ...newIndices];
        }
        return newPhotos;
      }

      // Nouveau chargement complet
      setDirection(1);
      setIsPlaying(true);

      if (settings.shuffle && newPhotos.length > 1) {
        const deck = generateShuffledDeck(newPhotos.length);
        shuffleDeckRef.current = deck;
        shufflePointerRef.current = 0;
        setShuffleStep(0);
        setCurrentIndex(deck[0]);
      } else {
        setCurrentIndex(0);
      }
      return newPhotos;
    });
  };

  // Calculate effective rotation for current photo (auto or manual)
  const currentPhotoEffectiveRotation = useMemo(() => {
    const photo = photos[currentIndex];
    if (!photo) return 0;
    if (photoRotations[photo.id] !== undefined) {
      return photoRotations[photo.id];
    }
    const isPort = (photo.height && photo.width) ? photo.height > photo.width : false;
    if (isPort) {
      if (settings.portraitReorientation === 'rotate-90') return 90;
      if (settings.portraitReorientation === 'rotate-270') return 270;
    }
    return 0;
  }, [photos, currentIndex, photoRotations, settings.portraitReorientation]);

  // Manual rotation step per photo (+90 degrees from current visual angle)
  const handleRotateCurrentPhoto = useCallback(() => {
    if (photos.length === 0) return;
    const photo = photos[currentIndex];
    if (!photo) return;

    setPhotoRotations((prev) => {
      const manual = prev[photo.id];
      let baseAngle = 0;
      if (manual !== undefined) {
        baseAngle = manual;
      } else {
        const isPort = (photo.height && photo.width) ? photo.height > photo.width : false;
        if (isPort) {
          if (settings.portraitReorientation === 'rotate-90') baseAngle = 90;
          else if (settings.portraitReorientation === 'rotate-270') baseAngle = 270;
        }
      }
      const next = (baseAngle + 90) % 360;
      return { ...prev, [photo.id]: next };
    });
  }, [photos, currentIndex, settings.portraitReorientation]);

  // Cycle portrait reorientation setting (Auto 90° -> Auto -90° -> Native/Off)
  const handleCyclePortraitReorientation = useCallback(() => {
    setSettings((prev) => {
      let nextMode: PortraitOrientationMode = 'rotate-90';
      if (prev.portraitReorientation === 'rotate-90') nextMode = 'rotate-270';
      else if (prev.portraitReorientation === 'rotate-270') nextMode = 'none';
      else nextMode = 'rotate-90';
      return { ...prev, portraitReorientation: nextMode };
    });
  }, []);

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  };

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          handleTogglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handleToggleFullscreen();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRotateCurrentPhoto();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setIsSourceModalOpen((prev) => !prev);
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setIsSettingsModalOpen((prev) => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleNext, handlePrev, handleRotateCurrentPhoto]);

  // Slideshow interval timer
  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;

    const timer = setTimeout(() => {
      handleNext();
    }, settings.intervalSeconds * 1000);

    return () => clearTimeout(timer);
  }, [isPlaying, currentIndex, photos.length, settings.intervalSeconds, handleNext]);

  // Preload upcoming photos in background for seamless transitions
  useEffect(() => {
    if (photos.length <= 1) return;
    let nextIndices: number[] = [];
    if (settings.shuffle && shuffleDeckRef.current.length === photos.length) {
      const deck = shuffleDeckRef.current;
      const ptr = shufflePointerRef.current;
      const next1 = (ptr + 1) % deck.length;
      const next2 = (ptr + 2) % deck.length;
      nextIndices = [deck[next1], deck[next2]];
    } else {
      nextIndices = [
        (currentIndex + 1) % photos.length,
        (currentIndex + 2) % photos.length,
      ];
    }
    nextIndices.forEach((idx) => {
      const url = photos[idx]?.url;
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [currentIndex, photos, settings.shuffle]);

  const currentPhoto = photos.length > 0 ? photos[currentIndex] : null;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
      {/* The Core Digital Photo Frame Display */}
      <DigitalFrame
        currentPhoto={currentPhoto}
        direction={direction}
        settings={settings}
        manualRotation={currentPhoto ? photoRotations[currentPhoto.id] : undefined}
        onNext={handleNext}
        onPrev={handlePrev}
      />

      {/* Floating Ambient Controls */}
      <ControlsOverlay
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        onRotatePhoto={handleRotateCurrentPhoto}
        currentRotation={currentPhotoEffectiveRotation}
        onCyclePortraitReorientation={handleCyclePortraitReorientation}
        currentIndex={currentIndex}
        totalPhotos={photos.length}
        sourceLabel={sourceName}
        settings={settings}
        shuffleStep={shuffleStep}
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onToggleShuffle={handleToggleShuffle}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Photo Source Modal (Disque dur local / Partage SMB NAS) */}
      <SourceSelectorModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onPhotosLoaded={handlePhotosLoaded}
        currentPhotosCount={photos.length}
      />

      {/* Transition & Customization Modal */}
      <TransitionSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />
    </main>
  );
}
