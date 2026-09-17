import { useEffect, useState } from 'react';
import { ClockPosition } from '../types';

interface ClockOverlayProps {
  position: ClockPosition;
  showSeconds: boolean;
}

export function ClockOverlay({ position, showSeconds }: ClockOverlayProps) {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (position === 'none') return null;

  const positionClasses = {
    'bottom-left': 'bottom-6 left-6 text-left items-start',
    'bottom-right': 'bottom-6 right-6 text-right items-end',
    'top-left': 'top-6 left-6 text-left items-start',
    'top-right': 'top-6 right-6 text-right items-end',
  }[position];

  const timeFormatted = time.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
  });

  const dateFormatted = time.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      id="frame-clock-overlay"
      className={`absolute z-20 pointer-events-none flex flex-col ${positionClasses} drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`}
    >
      <div className="font-['Plus_Jakarta_Sans'] font-light tracking-tight text-white/95 text-4xl sm:text-5xl lg:text-6xl font-variant-numeric tabular-nums leading-none">
        {timeFormatted}
      </div>
      <div className="mt-1.5 font-['Plus_Jakarta_Sans'] text-white/80 text-xs sm:text-sm lg:text-base capitalize tracking-wider font-medium">
        {dateFormatted}
      </div>
    </div>
  );
}
