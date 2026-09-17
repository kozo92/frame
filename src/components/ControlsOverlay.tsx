import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
  Sliders,
  FolderOpen,
  Shuffle,
  Sun,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { FrameSettings } from '../types';

interface ControlsOverlayProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentIndex: number;
  totalPhotos: number;
  sourceLabel: string;
  settings: FrameSettings;
  onOpenSourceModal: () => void;
  onOpenSettingsModal: () => void;
  onToggleShuffle: () => void;
  progressPercent: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function ControlsOverlay({
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentIndex,
  totalPhotos,
  sourceLabel,
  settings,
  onOpenSourceModal,
  onOpenSettingsModal,
  onToggleShuffle,
  progressPercent,
  isFullscreen,
  onToggleFullscreen,
}: ControlsOverlayProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Auto-hide controls after 3.5 seconds of inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleUserActivity = () => {
      setIsVisible(true);
      clearTimeout(timeout);
      if (settings.autoHideControls) {
        timeout = setTimeout(() => {
          setIsVisible(false);
        }, 3500);
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    // Initial timeout
    timeout = setTimeout(() => {
      setIsVisible(false);
    }, 4000);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
    };
  }, [settings.autoHideControls]);

  return (
    <>
      {/* Discreet top countdown progress bar */}
      {settings.showProgressBar && (
        <div
          id="frame-progress-track"
          className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-40 overflow-hidden pointer-events-none"
        >
          <div
            id="frame-progress-bar"
            className="h-full bg-amber-500/80 transition-all duration-200 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Floating Header info bar */}
      <div
        id="frame-top-controls"
        className={`absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
        }`}
      >
        <div className="flex items-center gap-2 bg-stone-950/80 backdrop-blur-md border border-white/10 px-3.5 py-1.5 rounded-full text-stone-200 pointer-events-auto shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium font-['Plus_Jakarta_Sans'] max-w-[220px] sm:max-w-xs truncate">
            {sourceLabel}
          </span>
          <span className="text-white/30 text-xs">•</span>
          <span className="text-xs text-stone-400 font-mono">
            {totalPhotos > 0 ? `${currentIndex + 1} / ${totalPhotos}` : '0 photo'}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Transition badge */}
          <button
            onClick={onOpenSettingsModal}
            className="hidden sm:flex items-center gap-1.5 bg-stone-950/80 backdrop-blur-md border border-white/10 hover:border-amber-500/50 px-3 py-1.5 rounded-full text-xs text-stone-300 hover:text-amber-400 transition-colors shadow-lg cursor-pointer"
            title="Modifier la transition"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="capitalize">
              {settings.transition === 'fade'
                ? 'Fondu'
                : settings.transition === 'slide-h'
                ? 'Gliss. H'
                : settings.transition === 'slide-v'
                ? 'Gliss. V'
                : settings.transition === 'kenburns'
                ? 'Ken Burns'
                : settings.transition === 'zoom'
                ? 'Zoom'
                : settings.transition === 'blur'
                ? 'Flou'
                : settings.transition === 'flip'
                ? '3D Flip'
                : 'Aléatoire'}
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              ({settings.intervalSeconds}s)
            </span>
          </button>

          {/* Keyboard shortcut guide */}
          <button
            onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
            className="p-2 bg-stone-950/80 backdrop-blur-md border border-white/10 hover:bg-stone-900 rounded-full text-stone-300 hover:text-white transition-colors shadow-lg cursor-pointer"
            title="Raccourcis clavier"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Bottom Control Deck */}
      <div
        id="frame-bottom-controls"
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 sm:gap-2.5 bg-stone-950/85 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-2 rounded-2xl shadow-2xl transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Source Button */}
        <button
          id="btn-open-source-modal"
          onClick={onOpenSourceModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-xl transition-colors cursor-pointer border border-stone-700"
          title="Changer la source (Disque dur local / NAS SMB)"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Source</span>
        </button>

        {/* Transition Settings Button */}
        <button
          id="btn-open-settings-modal"
          onClick={onOpenSettingsModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-stone-800/80 hover:bg-stone-700 text-stone-200 text-xs font-medium rounded-xl transition-colors cursor-pointer border border-stone-700"
          title="Options de transition personnalisable"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Transitions</span>
        </button>

        <div className="h-4 w-px bg-white/15 mx-1" />

        {/* Shuffle Button */}
        <button
          id="btn-toggle-shuffle"
          onClick={onToggleShuffle}
          className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
            settings.shuffle
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
          }`}
          title={settings.shuffle ? 'Lecture aléatoire activée' : 'Lecture séquentielle'}
        >
          <Shuffle className="w-4 h-4" />
        </button>

        {/* Prev Button */}
        <button
          id="btn-prev-photo"
          onClick={onPrev}
          disabled={totalPhotos <= 1}
          className="p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
          title="Photo précédente (Flèche gauche)"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Play/Pause Button */}
        <button
          id="btn-toggle-play"
          onClick={onTogglePlay}
          className="p-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl transition-colors shadow-md cursor-pointer font-bold"
          title={isPlaying ? 'Mettre en pause (Espace)' : 'Reprendre le défilement (Espace)'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Next Button */}
        <button
          id="btn-next-photo"
          onClick={onNext}
          disabled={totalPhotos <= 1}
          className="p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-30 cursor-pointer"
          title="Photo suivante (Flèche droite)"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/15 mx-1" />

        {/* Fullscreen Button */}
        <button
          id="btn-toggle-fullscreen"
          onClick={onToggleFullscreen}
          className="p-2 text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
          title={isFullscreen ? 'Quitter le plein écran (F ou Echap)' : 'Mode plein écran (F)'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* Keyboard shortcuts modal/tooltip */}
      {showShortcutsHelp && (
        <div
          id="shortcuts-help-card"
          className="fixed bottom-20 right-6 z-50 p-4 bg-stone-950/95 border border-stone-800 rounded-xl shadow-2xl backdrop-blur-md text-xs text-stone-300 w-64 space-y-2 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-1 border-b border-stone-800">
            <span className="font-semibold text-stone-100">Raccourcis clavier</span>
            <button
              onClick={() => setShowShortcutsHelp(false)}
              className="text-stone-500 hover:text-stone-300 text-sm font-bold"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-stone-400">Lecture / Pause :</span>
              <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-200">Espace</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Photo précédente :</span>
              <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-200">←</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Photo suivante :</span>
              <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-200">→</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Plein écran :</span>
              <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-200">F</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Source (Local/NAS) :</span>
              <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-200">S</kbd>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Réglages transitions :</span>
              <kbd className="px-1.5 py-0.5 bg-stone-800 rounded text-stone-200">T</kbd>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
