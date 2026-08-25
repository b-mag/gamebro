import type { GameFactory, GameMetadata } from '@/engine';
import { createEyeOfTheDeep } from './eye-of-the-deep';
import { createCastleVein } from './castle-vein';
import { createHorizon } from './horizon';
import { createWarPickle } from './war-pickle';
import { createMightyMudskipper } from './mighty-mudskipper';
import { createHiddenTemples } from './hidden-temples';
import { createHooked } from './hooked';
import { createSentry } from './sentry';
import { createTheTriangle } from './the-triangle';

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
  {
    id: 'sentry',
    slug: 'sentry',
    name: 'SENTRY',
    description: 'Absorb. Build. Transfer. Silence the Sentinel.',
    factory: createSentry,
  },
  {
    id: 'the-triangle',
    slug: 'the-triangle',
    name: 'The Triangle',
    description: 'Descent-style slow dogfight. Watch the lock monitor.',
    factory: createTheTriangle,
  },
  {
    id: 'castle-vein',
    slug: 'castle-vein',
    name: 'Castle Vein',
    description: 'Belard explores the cursed castle. GB metroidvania.',
    factory: createCastleVein,
  },
  {
    id: 'hidden-temples',
    slug: 'hidden-temples',
    name: 'Hidden Temples',
    description: 'Legend of the Hidden Temples. Jungle action RPG.',
    factory: createHiddenTemples,
  },
  {
    id: 'war-pickle',
    slug: 'war-pickle',
    name: 'War Pickle',
    description: 'Contra / Metal Slug mashup. Pickle go boom.',
    factory: createWarPickle,
  },
  {
    id: 'mighty-mudskipper',
    slug: 'mighty-mudskipper',
    name: 'Mighty Mudskipper',
    description: 'Mario x Sonic mudfish. Zoom in the shallows!',
    factory: createMightyMudskipper,
  },
  {
    id: 'horizon',
    slug: 'horizon',
    name: 'Horizon',
    description: 'Mech horizontal shooter. Bullets, lasers, bosses.',
    factory: createHorizon,
  },
  {
    id: 'hooked',
    slug: 'hooked',
    name: 'Hooked',
    description: 'Read the water. Own the strike. GB fishing.',
    factory: createHooked,
  },
];

export function getGameBySlug(slug: string): RegisteredGame | undefined {
  return GAME_REGISTRY.find((g) => g.slug === slug);
}

export function getAllGames(): RegisteredGame[] {
  return GAME_REGISTRY;
}
