export type PhotoSourceType = 'local' | 'smb' | 'sample';

export interface PhotoItem {
  id: string;
  url: string;
  name: string;
  source: PhotoSourceType;
  path?: string;
  size?: number;
  lastModified?: number;
  width?: number;
  height?: number;
  exifOrientation?: number; // Tag EXIF 0x0112 (1 to 8)
  isPortrait?: boolean; // Détecté via tag EXIF 0x0112 (6, 8, etc.) ou ratio hauteur > largeur
}

export type TransitionType =
  | 'fade'
  | 'slide-h'
  | 'slide-v'
  | 'zoom'
  | 'blur'
  | 'flip'
  | 'random';

export type FrameStyle =
  | 'borderless'
  | 'passe-partout'
  | 'wood-oak'
  | 'wood-walnut'
  | 'aluminum-black'
  | 'canvas-shadow';

export type FittingMode = 'cover' | 'contain';

export type ClockPosition = 'none' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface SmbConnectionConfig {
  host: string;
  share: string;
  folderPath: string;
  username: string;
  password: string;
  domain: string;
  port: number;
  recursive: boolean;
}

export type PortraitOrientationMode = 'rotate-90' | 'rotate-270' | 'none';

export interface FrameSettings {
  // Slideshow timing
  intervalSeconds: number; // Duration each photo stays visible
  transition: TransitionType; // Transition effect
  transitionDuration: number; // Duration of transition in seconds (e.g. 1.2s)
  kenBurnsActive: boolean; // Continuous subtle pan/zoom while image is displayed
  shuffle: boolean; // Random order or sequential
  portraitReorientation: PortraitOrientationMode; // Auto-reorient portrait photos to landscape
  
  // Visual presentation
  frameStyle: FrameStyle;
  fittingMode: FittingMode;
  ambientBlurBackground: boolean;
  brightness: number; // 20 to 100%
  
  // Overlays
  clockPosition: ClockPosition;
  showClockSeconds: boolean;
  showPhotoInfo: boolean;
  showProgressBar: boolean;
  autoHideControls: boolean;
}
