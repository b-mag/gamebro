/** Secondary sub-weapons (Select + Attack, costs energy). */
export enum SubWeapon {
  None = 0,
  Knife = 1,
  Axe = 2,
  Hourglass = 3,
}

export const SUB_WEAPON_COST: Record<SubWeapon, number> = {
  [SubWeapon.None]: 0,
  [SubWeapon.Knife]: 8,
  [SubWeapon.Axe]: 15,
  [SubWeapon.Hourglass]: 25,
};

export const SUB_WEAPON_NAMES = ['---', 'KNIFE', 'AXE', 'TIME'];

export interface Projectile {
  id: number;
  kind: 'knife' | 'axe';
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  life: number;
}
