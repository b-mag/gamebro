'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameBoyEngine } from '@/engine';

const VOLUME_KEY = 'gamebro-volume';
const DEFAULT_VOLUME = 1;

interface GameBoyShellControlsProps {
  engine: GameBoyEngine | null;
  onPowerReset: () => void;
}

/**
 * DMG-style volume wheel + power button on the shell (mouse/touch clickable).
 */
export function GameBoyShellControls({ engine, onPowerReset }: GameBoyShellControlsProps) {
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [powerPressed, setPowerPressed] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(VOLUME_KEY);
    const v = stored ? parseFloat(stored) : DEFAULT_VOLUME;
    const vol = Number.isNaN(v) ? DEFAULT_VOLUME : Math.max(0, Math.min(1, v));
    setVolume(vol);
    engine?.audio.setVolume(vol);
  }, [engine]);

  const applyVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setVolume(clamped);
      engine?.audio.setVolume(clamped);
      localStorage.setItem(VOLUME_KEY, String(clamped));
    },
    [engine],
  );

  const volumeFromY = useCallback((clientY: number) => {
    const el = sliderRef.current;
    if (!el) return volume;
    const rect = el.getBoundingClientRect();
    const t = 1 - (clientY - rect.top) / rect.height;
    return Math.max(0, Math.min(1, t));
  }, [volume]);

  const onSliderPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    applyVolume(volumeFromY(e.clientY));
    engine?.audio.play('beep');
  };

  const onSliderPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    applyVolume(volumeFromY(e.clientY));
  };

  const onSliderPointerUp = () => {
    dragging.current = false;
  };

  const handlePowerClick = () => {
    setPowerPressed(true);
    engine?.audio.play('beep');
    setTimeout(() => {
      setPowerPressed(false);
      onPowerReset();
    }, 200);
  };

  const thumbY = `${(1 - volume) * 100}%`;

  return (
    <div className="gamebro-shell-controls">
      <div className="gamebro-volume">
        <span className="gamebro-volume-label">VOL</span>
        <div
          ref={sliderRef}
          className="gamebro-volume-track"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(volume * 100)}
          aria-label="Volume"
          onPointerDown={onSliderPointerDown}
          onPointerMove={onSliderPointerMove}
          onPointerUp={onSliderPointerUp}
          onPointerCancel={onSliderPointerUp}
        >
          <div className="gamebro-volume-notch" style={{ top: thumbY }} />
        </div>
      </div>
      <button
        type="button"
        className={`gamebro-power-btn${powerPressed ? ' pressed' : ''}`}
        aria-label="Power reset"
        onClick={handlePowerClick}
      >
        <span className="gamebro-power-dot" />
      </button>
    </div>
  );
}
