/** Solo's whole-dollar convention: principal plus 10% interest rounded up.
 * Integer arithmetic avoids ceil(100 * 1.1) accidentally charging 111. */
export const unmortgageCost = (principal: number) => principal + Math.ceil(principal / 10);
import { BOARD_SPACES } from '../data/boardData';
import type { BoardSpace, PropertyState } from '../types/game';


export function groupHasBuildings(space: BoardSpace, properties: Record<number, PropertyState>) {
  return BOARD_SPACES.some(candidate => candidate.colorGroup === space.colorGroup && (properties[candidate.id]?.houses ?? 0) > 0);
}
