'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoyEngine, decodeAnySave, type CastleVeinSaveData } from '@/engine';
import { BootSequence } from './BootSequence';
import { MainMenu } from './MainMenu';
import { GameBoyShellControls } from './GameBoyShellControls';

type AppPhase = 'boot' | 'menu';

interface GameBoyScreenProps {
  /** When set, skip boot/menu and load game directly (game route). */
  gameSlug?: string;
  /** Optional HEX continue code from menu. */
  saveCode?: string;
}

/**
 * Physical Game Boy shell wrapping the 160×144 canvas.
 */
export function GameBoyScreen({ gameSlug, saveCode }: GameBoyScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GameBoyEngine | null>(null);
  const [phase, setPhase] = useState<AppPhase>(gameSlug ? 'menu' : 'boot');
  const router = useRouter();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const eng = new GameBoyEngine({ scanlines: true });
    eng.bindCanvas(canvas, 4);
    setEngine(eng);

    if (gameSlug) {
      void (async () => {
        await eng.initAudio();
        const { getGameBySlug } = await import('@/games/registry');
        const reg = getGameBySlug(gameSlug);
        if (reg) {
          const game = reg.factory();
          await eng.startGame(game);
          if (saveCode) {
            const decoded = decodeAnySave(saveCode);
            if (decoded && 'loadFromSave' in game) {
              if (decoded.castleVein && gameSlug === 'castle-vein') {
                const cv: CastleVeinSaveData = decoded.castleVein;
                (game as { loadFromSave: (d: CastleVeinSaveData) => void }).loadFromSave(cv);
              } else if (decoded.eyeOfTheDeep && gameSlug === 'eye-of-the-deep') {
                const s = decoded.eyeOfTheDeep;
                (game as { loadFromSave: (l: number, sc: number, sd: number) => void }).loadFromSave(
                  s.level,
                  s.score,
                  s.seed,
                );
              } else if (decoded.sentry && gameSlug === 'sentry') {
                const s = decoded.sentry;
                (game as { loadFromSave: (l: number, sc: number, sd: number) => void }).loadFromSave(
                  s.level,
                  s.score,
                  s.seed,
                );
              } else if (decoded.theTriangle && gameSlug === 'the-triangle') {
                const s = decoded.theTriangle;
                (game as { loadFromSave: (l: number, sc: number, sd: number) => void }).loadFromSave(
                  s.level,
                  s.score,
                  s.seed,
                );
              }
            }
          }
          eng.start();
        }
      })();
    }
    // Boot/menu path: BootSequence or MainMenu starts the loop

    return () => {
      eng.stop();
      setEngine(null);
    };
  }, [gameSlug, saveCode]);

  const handleBootComplete = useCallback(() => {
    setPhase('menu');
  }, []);

  const handleSelectGame = useCallback(
    (slug: string, code?: string) => {
      engine?.stop();
      const q = code ? `?code=${encodeURIComponent(code)}` : '';
      router.push(`/games/${slug}${q}`);
    },
    [router, engine],
  );

  const handlePowerReset = useCallback(() => {
    engine?.stop();
    if (gameSlug) {
      router.push('/');
    } else {
      window.location.reload();
    }
  }, [engine, gameSlug, router]);

  return (
    <div className="gamebro-page">
      <div className="gamebro-shell">
        <GameBoyShellControls engine={engine} onPowerReset={handlePowerReset} />
        <div className="gamebro-label">GameBro</div>
        <div className="gamebro-screen-wrap scanlines">
          <canvas ref={canvasRef} className="gamebro-canvas" width={640} height={576} />
          {phase === 'boot' && engine && !gameSlug && (
            <BootSequence engine={engine} onComplete={handleBootComplete} />
          )}
          {phase === 'menu' && !gameSlug && engine && (
            <MainMenu engine={engine} onSelectGame={handleSelectGame} />
          )}
        </div>
        <p className="gamebro-controls-hint">
          <kbd>↑↓←→</kbd> / <kbd>WASD</kbd> move · <kbd>Z</kbd>/<kbd>Space</kbd> A ·{' '}
          <kbd>Shift</kbd> hold · Shift+<kbd>Z</kbd> backdash · Shift+<kbd>X</kbd> sub-weapon
        </p>
      </div>
    </div>
  );
}
