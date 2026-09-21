import {
  X,
  Sliders,
  Sparkles,
  Layers,
  Clock,
  Sun,
  Shuffle,
  Eye,
  Maximize2,
  Check,
  RotateCw,
} from 'lucide-react';
import { FrameSettings, TransitionType, FrameStyle, FittingMode, ClockPosition } from '../types';

interface TransitionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: FrameSettings;
  onUpdateSettings: (newSettings: Partial<FrameSettings>) => void;
}

interface TransitionOption {
  id: TransitionType;
  label: string;
  description: string;
}

const TRANSITIONS: TransitionOption[] = [
  {
    id: 'fade',
    label: 'Fondu enchaîné',
    description: 'Transition classique douce et élégante par transparence.',
  },
  {
    id: 'slide-h',
    label: 'Glissement horizontal',
    description: 'Fait défiler l\'image latéralement comme un carrousel.',
  },
  {
    id: 'slide-v',
    label: 'Glissement vertical',
    description: 'Défilement de bas en haut pour un style panoramique.',
  },
  {
    id: 'zoom',
    label: 'Zoom progressif',
    description: 'Agrandissement doux et progressif au centre de l\'image.',
  },
  {
    id: 'blur',
    label: 'Flou cinématique',
    description: 'L\'ancienne image s\'estompe dans un flou optique velouté.',
  },
  {
    id: 'flip',
    label: 'Retournement 3D',
    description: 'Effet de rotation perspective spatiale à 360°.',
  },
  {
    id: 'random',
    label: 'Aléatoire',
    description: 'Alterne automatiquement une transition différente à chaque photo.',
  },
];

const FRAME_STYLES: { id: FrameStyle; label: string; previewClass: string }[] = [
  { id: 'borderless', label: 'Plein écran pur', previewClass: 'bg-black border border-stone-700' },
  { id: 'passe-partout', label: 'Passe-Partout Blanc Galerie', previewClass: 'bg-stone-100 border-4 border-stone-300' },
  { id: 'wood-oak', label: 'Cadre Chêne Clair', previewClass: 'bg-[#b28254] border-4 border-[#7a5028]' },
  { id: 'wood-walnut', label: 'Cadre Noyer Foncé', previewClass: 'bg-[#3b2416] border-4 border-[#1c0f07]' },
  { id: 'aluminum-black', label: 'Aluminium Brossé Noir', previewClass: 'bg-[#1a1a1c] border-2 border-white/20' },
  { id: 'canvas-shadow', label: 'Toile Flottante', previewClass: 'bg-stone-900 shadow-lg border border-white/10' },
];

export function TransitionSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: TransitionSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      id="transition-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="transition-settings-panel"
        className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-semibold text-stone-100 font-['Plus_Jakarta_Sans']">
                Personnalisation du Cadre & Transitions
              </h2>
              <p className="text-xs text-stone-400">
                Ajustez les effets d'animation, les durées et l'habillage visuel
              </p>
            </div>
          </div>
          <button
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-200 text-sm">
          {/* 1. SELECTION DU TYPE DE TRANSITION */}
          <div>
            <label className="block text-xs font-semibold text-amber-400 tracking-wider uppercase mb-2">
              Type de transition entre chaque image
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TRANSITIONS.map((t) => {
                const isSelected = settings.transition === t.id;
                return (
                  <button
                    key={t.id}
                    id={`btn-transition-${t.id}`}
                    onClick={() => onUpdateSettings({ transition: t.id })}
                    className={`text-left p-3 rounded-xl border transition-all flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm'
                        : 'border-stone-800 bg-stone-950/40 hover:border-stone-700 text-stone-300'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        {t.label}
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5 leading-snug">
                        {t.description}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. DUREES : TRANSITION ET AFFICHAGE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-4 bg-stone-950/50 border border-stone-800 rounded-xl">
            {/* Transition duration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-stone-300">
                  Durée de l'effet de transition
                </span>
                <span className="text-xs font-mono font-semibold text-amber-400">
                  {settings.transitionDuration.toFixed(1)} s
                </span>
              </div>
              <input
                id="input-transition-duration"
                type="range"
                min="0.3"
                max="3.0"
                step="0.1"
                value={settings.transitionDuration}
                onChange={(e) =>
                  onUpdateSettings({ transitionDuration: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 mt-1">
                <span>Rapide (0.3s)</span>
                <span>Normal (1.0s)</span>
                <span>Cinématique (3.0s)</span>
              </div>
            </div>

            {/* Interval per photo */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-stone-300">
                  Temps d'affichage par photo
                </span>
                <span className="text-xs font-mono font-semibold text-amber-400">
                  {settings.intervalSeconds < 60
                    ? `${settings.intervalSeconds} s`
                    : `${Math.round(settings.intervalSeconds / 60)} min`}
                </span>
              </div>
              <input
                id="input-interval-seconds"
                type="range"
                min="2"
                max="60"
                step="1"
                value={settings.intervalSeconds}
                onChange={(e) =>
                  onUpdateSettings({ intervalSeconds: parseInt(e.target.value, 10) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-stone-500 mt-1">
                <span>2s</span>
                <span>10s</span>
                <span>30s</span>
                <span>60s</span>
              </div>
            </div>
          </div>

          {/* 3. SHUFFLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-stone-950/40 border border-stone-800 rounded-xl">
              <div className="space-y-0.5">
                <div className="font-medium text-xs text-stone-200">
                  Ordre aléatoire sans répétition (Shuffle)
                </div>
                <div className="text-[11px] text-stone-400">
                  Joue l'ensemble de la collection photo sans aucune répétition durant tout le cycle
                </div>
              </div>
              <button
                id="toggle-shuffle"
                onClick={() => onUpdateSettings({ shuffle: !settings.shuffle })}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  settings.shuffle ? 'bg-amber-500' : 'bg-stone-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    settings.shuffle ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 4. REORIENTATION DES PHOTOS PORTRAIT EN PAYSAGE */}
          <div className="p-4 bg-stone-950/50 border border-stone-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-xs text-stone-200 flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Réorientation des photos portrait vers paysage</span>
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  Fait pivoter automatiquement les photos verticales pour les afficher au format paysage sur votre écran
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                id="btn-orient-rotate-90"
                onClick={() => onUpdateSettings({ portraitReorientation: 'rotate-90' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                  settings.portraitReorientation === 'rotate-90'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Pivoter à 90°</span>
                  {settings.portraitReorientation === 'rotate-90' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">Paysage horaire (Défaut)</div>
              </button>

              <button
                type="button"
                id="btn-orient-rotate-270"
                onClick={() => onUpdateSettings({ portraitReorientation: 'rotate-270' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                  settings.portraitReorientation === 'rotate-270'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Pivoter à -90°</span>
                  {settings.portraitReorientation === 'rotate-270' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">Paysage anti-horaire</div>
              </button>

              <button
                type="button"
                id="btn-orient-none"
                onClick={() => onUpdateSettings({ portraitReorientation: 'none' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                  settings.portraitReorientation === 'none'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:text-stone-200'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>Désactivé</span>
                  {settings.portraitReorientation === 'none' && <Check className="w-3.5 h-3.5" />}
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">Conserver portrait</div>
              </button>
            </div>
          </div>

          {/* 4. STYLE DU CADRE PHYSIQUE */}
          <div>
            <label className="block text-xs font-semibold text-amber-400 tracking-wider uppercase mb-2">
              Habillage du cadre (Bordures)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {FRAME_STYLES.map((f) => {
                const isSelected = settings.frameStyle === f.id;
                return (
                  <button
                    key={f.id}
                    id={`btn-frame-style-${f.id}`}
                    onClick={() => onUpdateSettings({ frameStyle: f.id })}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-stone-800 bg-stone-950/40 hover:border-stone-700 text-stone-300'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded shrink-0 ${f.previewClass}`} />
                    <span className="text-xs font-medium truncate">{f.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. AJUSTEMENT IMAGE & FOND FLOU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Remplissage de l'écran
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-fit-cover"
                  onClick={() => onUpdateSettings({ fittingMode: 'cover' })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                    settings.fittingMode === 'cover'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-stone-800 bg-stone-950/40 text-stone-400'
                  }`}
                >
                  Remplir (Cover)
                </button>
                <button
                  id="btn-fit-contain"
                  onClick={() => onUpdateSettings({ fittingMode: 'contain' })}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-colors cursor-pointer ${
                    settings.fittingMode === 'contain'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                      : 'border-stone-800 bg-stone-950/40 text-stone-400'
                  }`}
                >
                  Ajuster (Entier)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Horloge & Date
              </label>
              <select
                id="select-clock-position"
                value={settings.clockPosition}
                onChange={(e) =>
                  onUpdateSettings({ clockPosition: e.target.value as ClockPosition })
                }
                className="w-full py-2 px-3 bg-stone-950 border border-stone-700 rounded-lg text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="none">Désactivée (Masquée)</option>
                <option value="bottom-left">En bas à gauche</option>
                <option value="bottom-right">En bas à droite</option>
                <option value="top-left">En haut à gauche</option>
                <option value="top-right">En haut à droite</option>
              </select>
            </div>
          </div>

          {/* 6. LUMINOSITE */}
          <div className="p-3 bg-stone-950/40 border border-stone-800 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Luminosité du cadre
              </span>
              <span className="text-xs font-mono font-semibold text-amber-400">
                {settings.brightness}%
              </span>
            </div>
            <input
              id="input-brightness"
              type="range"
              min="20"
              max="100"
              step="5"
              value={settings.brightness}
              onChange={(e) =>
                onUpdateSettings({ brightness: parseInt(e.target.value, 10) })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-stone-950/70 border-t border-stone-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Appliquer et fermer
          </button>
        </div>
      </div>
    </div>
  );
}
