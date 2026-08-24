'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GameBoyEngine } from '@/engine';
import { PaletteShade, decodeSave } from '@/engine';
import { getAllGames } from '@/games/registry';

interface MainMenuProps {
  engine: GameBoyEngine;
  onSelectGame: (slug: string, saveCode?: string) => void;
}

type MenuMode = 'list' | 'enterCode';

/**
 * Classic Game Boy cartridge menu — green on green, minimal chrome.
 */
export function MainMenu({ engine, onSelectGame }: MainMenuProps) {
  const games = getAllGames();
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<MenuMode>('list');
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');

  const draw = useCallback(() => {
    const r = engine.screen.renderer;
    r.clear(PaletteShade.Lightest);

    r.drawText('GAMEBRO', 80, 8, {
      shade: PaletteShade.Darkest,
      align: 'center',
      size: 10,
    });
    r.drawText('SELECT GAME', 80, 22, {
      shade: PaletteShade.Dark,
      align: 'center',
      size: 7,
    });

    if (mode === 'list') {
      games.forEach((game, i) => {
        const prefix = i === selected ? '►' : ' ';
        const shade = i === selected ? PaletteShade.Darkest : PaletteShade.Dark;
        r.drawText(`${prefix}${game.name}`, 20, 40 + i * 14, { shade, size: 8 });
      });

      r.drawText('↑↓ MOVE  A PLAY', 80, 120, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 6,
      });
      r.drawText('B CONTINUE CODE', 80, 128, {
        shade: PaletteShade.Light,
        align: 'center',
        size: 6,
      });
    } else {
      r.drawText('ENTER CODE', 80, 40, { shade: PaletteShade.Darkest, align: 'center', size: 8 });
      r.drawText(`${codeInput}_`, 80, 58, { shade: PaletteShade.Dark, align: 'center', size: 7 });
      if (error) {
        r.drawText(error, 80, 74, { shade: PaletteShade.Darkest, align: 'center', size: 6 });
      }
      r.drawText('A=LOAD  B=BACK', 80, 120, { shade: PaletteShade.Light, align: 'center', size: 6 });
    }
  }, [engine, games, selected, mode, codeInput, error]);

  useEffect(() => {
    engine.phase = 'menu';
    engine.setHostCallbacks(
      () => {},
      draw,
    );
    engine.start();
    return () => engine.setHostCallbacks(null, null);
  }, [engine, draw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'list') {
        if (e.key === 'ArrowUp' || e.key === 'w') {
          e.preventDefault();
          setSelected((s) => (s - 1 + games.length) % games.length);
          engine.audio.play('beep');
        }
        if (e.key === 'ArrowDown' || e.key === 's') {
          e.preventDefault();
          setSelected((s) => (s + 1) % games.length);
          engine.audio.play('beep');
        }
        if (e.key === 'z' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          engine.audio.play('select');
          onSelectGame(games[selected].slug);
        }
        if (e.key === 'x' || e.key === 'c') {
          e.preventDefault();
          setMode('enterCode');
          setCodeInput('');
          setError('');
          engine.audio.play('beep');
        }
      } else {
        if (e.key === 'Backspace') {
          setCodeInput((c) => c.slice(0, -1));
          engine.audio.play('beep');
        } else if (/^[0-9A-Fa-f]$/.test(e.key) && codeInput.length < 15) {
          setCodeInput((c) => c + e.key.toUpperCase());
          engine.audio.play('beepHigh');
        }
        if (e.key === 'z' || e.key === ' ') {
          e.preventDefault();
          const save = decodeSave(codeInput);
          if (save) {
            engine.audio.play('select');
            onSelectGame(games[0].slug, codeInput);
          } else {
            setError('INVALID CODE');
            engine.audio.play('beep');
          }
        }
        if (e.key === 'x' || e.key === 'c') {
          e.preventDefault();
          setMode('list');
          setError('');
          engine.audio.play('beep');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, selected, games, codeInput, engine, onSelectGame]);

  return null;
}
