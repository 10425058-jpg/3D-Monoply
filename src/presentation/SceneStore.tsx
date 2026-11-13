import React, { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { useGameStore } from '../store/useGameStore';

/** Only data and presentation controls cross the scene boundary. No game commands. */
export type SceneState = Pick<ReturnType<typeof useGameStore.getState>,
  'players' | 'properties' | 'currentPlayerIndex' | 'turnPhase' | 'dice' | 'gameSpeed' |
  'cameraMode' | 'selectedSpaceId' | 'hoveredSpaceId' | 'selectSpace' | 'setHoveredSpace' |
  'setCameraMode' | 'logs' | 'activeCard' | 'auction' | 'railroadRaid' | 'winner'>;

const SceneContext = createContext<StoreApi<SceneState>>(useGameStore as unknown as StoreApi<SceneState>);
export const SceneStoreProvider = SceneContext.Provider;
export const useSceneStore = () => useContext(SceneContext);
export function useSceneState<T>(selector: (state: SceneState) => T): T {
  return useStore(useSceneStore(), selector);
}
