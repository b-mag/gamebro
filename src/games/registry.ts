import type { GameFactory, GameMetadata } from '@/engine';
import { createEyeOfTheDeep } from './eye-of-the-deep';

export interface RegisteredGame extends GameMetadata {
  factory: GameFactory;
}

/** Central registry — add new games here. */
export const GAME_REGISTRY: RegisteredGame[] = [
  {
    id: 'eye-of-the-deep',
    slug: 'eye-of-the-deep',
    name: 'Eye of the Deep',
    description: 'Sentinel-inspired underwater wireframe stealth.',
    factory: createEyeOfTheDeep,
  },
];

export function getGameBySlug(slug: string): RegisteredGame | undefined {
  return GAME_REGISTRY.find((g) => g.slug === slug);
}

export function getAllGames(): RegisteredGame[] {
  return GAME_REGISTRY;
}
