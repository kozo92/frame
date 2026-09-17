import { useState, useEffect, useRef, useCallback } from 'react';
import { DigitalFrame } from './components/DigitalFrame';
import { ControlsOverlay } from './components/ControlsOverlay';
import { SourceSelectorModal } from './components/SourceSelectorModal';
import { TransitionSettingsModal } from './components/TransitionSettingsModal';
import { PhotoItem, FrameSettings } from './types';
import { SAMPLE_PHOTOS } from './data/samplePhotos';

export default function App() {
  // Photos state
  const [photos, setPhotos] = useState<PhotoItem[]>(SAMPLE_PHOTOS);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(1);
  const [sourceName, setSourceName] = useState<string>('Galerie Haute Définition');

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Modals state
  const [isSourceModalOpen, setIsSourceModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<FrameSettings>({
    intervalSeconds: 6,
    transition: 'fade',
    transitionDuration: 1.2,
    kenBurnsActive: true,
    shuffle: false,
    frameStyle: 'borderless',
    fittingMode: 'cover',
    ambientBlurBackground: true,
    brightness: 100,
    clockPosition: 'bottom-left',
    showClockSeconds: false,
    showPhotoInfo: true,
    showProgressBar: true,
    autoHideControls: true,
  });

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (photos.length === 0) return;
    setDirection(1);
    setProgressPercent(0);

    if (settings.shuffle && photos.length > 1) {
      let nextIdx = Math.floor(Math.random() * photos.length);
      while (nextIdx === currentIndex && photos.length > 1) {
        nextIdx = Math.floor(Math.random() * photos.length);
      }
      setCurrentIndex(nextIdx);
    } else {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }
  }, [photos.length, settings.shuffle, currentIndex]);

  const handlePrev = useCallback(() => {
    if (photos.length === 0) return;
    setDirection(-1);
    setProgressPercent(0);
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleToggleShuffle = useCallback(() => {
    setSettings((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  // Update frame settings
  const handleUpdateSettings = (newSettings: Partial<FrameSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  // When new photos are loaded from local drive or SMB share
  const handlePhotosLoaded = (newPhotos: PhotoItem[], sourceLabel: string) => {
    setPhotos(newPhotos);
    setCurrentIndex(0);
    setProgressPercent(0);
    setDirection(1);
    setSourceName(sourceLabel);
    setIsPlaying(true);
  };

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
  }, [handleTogglePlay, handleNext, handlePrev]);

  // Slideshow interval timer & progress tracker
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isPlaying || photos.length <= 1) {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
      return;
    }

    startTimeRef.current = Date.now();
    const durationMs = settings.intervalSeconds * 1000;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / durationMs) * 100, 100);
      setProgressPercent(progress);

      if (elapsed >= durationMs) {
        handleNext();
        startTimeRef.current = Date.now();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);

    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isPlaying, currentIndex, photos.length, settings.intervalSeconds, handleNext]);

  const currentPhoto = photos.length > 0 ? photos[currentIndex] : null;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
      {/* The Core Digital Photo Frame Display */}
      <DigitalFrame
        currentPhoto={currentPhoto}
        direction={direction}
        settings={settings}
        onNext={handleNext}
        onPrev={handlePrev}
      />

      {/* Floating Ambient Controls */}
      <ControlsOverlay
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrev={handlePrev}
        currentIndex={currentIndex}
        totalPhotos={photos.length}
        sourceLabel={sourceName}
        settings={settings}
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onToggleShuffle={handleToggleShuffle}
        progressPercent={progressPercent}
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
