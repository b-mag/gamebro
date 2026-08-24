'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { GameBoyEngine } from '@/engine';
import { PaletteShade } from '@/engine';

interface BootSequenceProps {
  engine: GameBoyEngine;
  onComplete: () => void;
}

/**
 * Canvas-rendered DMG boot — "GameBro" logo + power-on jingle.
 * Drawn on the native 160×144 buffer (not an HTML overlay).
 */
export function BootSequence({ engine, onComplete }: BootSequenceProps) {
  const bootStart = useRef(performance.now());
  const played = useRef(false);
  const completed = useRef(false);

  const draw = useCallback(() => {
    const r = engine.screen.renderer;
    const ctx = r.context;
    const elapsed = (performance.now() - bootStart.current) / 1000;

    r.clear(PaletteShade.Lightest);

    // Fade out in last 0.6s
    const fade = elapsed > 2.2 ? Math.max(0, 1 - (elapsed - 2.2) / 0.6) : 1;
    ctx.globalAlpha = fade;

    // Nintendo-style oval frame
    ctx.strokeStyle = '#0f380f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(80, 72, 62, 28, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Wordmark
    r.drawText('Game', 80, 54, {
      shade: PaletteShade.Darkest,
      align: 'center',
      size: 14,
    });
    r.drawText('BRO', 80, 70, {
      shade: PaletteShade.Dark,
      align: 'center',
      size: 16,
    });

    // ® mark
    r.fillRect(116, 48, 4, 4, PaletteShade.Darkest);
    r.drawText('®', 80, 108, {
      shade: PaletteShade.Dark,
      align: 'center',
      size: 6,
    });

    ctx.globalAlpha = 1;

    if (elapsed >= 2.8 && !completed.current) {
      completed.current = true;
      onComplete();
    }
  }, [engine, onComplete]);

  useEffect(() => {
    bootStart.current = performance.now();
    engine.phase = 'boot';
    engine.setHostCallbacks(
      () => {},
      draw,
    );
    engine.start();

    if (!played.current) {
      played.current = true;
      void engine.initAudio().then(() => {
        engine.audio.play('boot');
      });
    }

    return () => {
      engine.setHostCallbacks(null, null);
    };
  }, [engine, draw]);

  return null;
}
