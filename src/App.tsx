import React, { useState, useCallback, useEffect, useMemo } from 'react';

// UI Components
import HeaderBar from './components/HeaderBar';
import PlayerPanels from './components/PlayerPanels';
import ActivityLog from './components/ActivityLog';
import ActionDock from './components/ActionDock';
import SetupModal from './components/SetupModal';
import PropertyModal from './components/PropertyModal';
import CardPopup from './components/CardPopup';
import TradeModal from './components/TradeModal';
import RulebookModal from './components/RulebookModal';

// 3D Board / Scene Component
import MonopolyBoard from './components/MonopolyBoard';

// Game State & Types
import { useGameStore } from './store/gameStore';
import type {
  ModalType,
  Player,
  Property,
  GameCard,
  TradeOffer,
  GameSetupConfig,
} from './types/game';

/**
 * Active modal identifier coordinated centrally by App.tsx.
 * Prevents conflicting modal overlays while preserving underlying 3D scene state.
 */
export type ActiveModalType =
  | 'setup'
  | 'property'
  | 'card'
  | 'trade'
  | 'rulebook'
  | null;

export const App: React.FC = () => {
  // ---------------------------------------------------------------------------
  // 1. Existing Game State Connection
  // ---------------------------------------------------------------------------
  const {
    players,
    currentPlayerIndex,
    properties,
    dice,
    isRolling,
    turnPhase,
    gameStatus,
    events,
    activeCard,
    selectedPropertyId,
    winner,
    // Actions from existing game logic
    startGame,
    resetGame,
    rollDice,
    buyProperty,
    skipProperty,
    buildHouse,
    sellHouse,
    mortgageProperty,
    unmortgageProperty,
    payBail,
    useGetOutOfJailCard,
    acknowledgeCard,
    executeTrade,
    endTurn,
    selectProperty,
  } = useGameStore();

  // ---------------------------------------------------------------------------
  // 2. Centralized Modal & Responsive HUD State
  // ---------------------------------------------------------------------------
  const [activeModal, setActiveModal] = useState<ActiveModalType>(() =>
    gameStatus === 'setup' ? 'setup' : null
  );
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(false);

  // Derived current player & selected property
  const currentPlayer: Player | undefined = useMemo(
    () => players[currentPlayerIndex],
    [players, currentPlayerIndex]
  );

  const selectedProperty: Property | null = useMemo(() => {
    if (selectedPropertyId === null || selectedPropertyId === undefined) {
      return null;
    }
    return properties.find((prop: Property) => prop.id === selectedPropertyId) ?? null;
  }, [properties, selectedPropertyId]);

  const currentSpaceProperty: Property | null = useMemo(() => {
    if (!currentPlayer) return null;
    return (
      properties.find((prop: Property) => prop.position === currentPlayer.position) ??
      null
    );
  }, [properties, currentPlayer]);

  // ---------------------------------------------------------------------------
  // 3. Synchronize Game Lifecycle Events with Active Modals
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (gameStatus === 'setup') {
      setActiveModal('setup');
    } else if (activeCard) {
      setActiveModal('card');
    } else if (selectedPropertyId !== null && selectedPropertyId !== undefined) {
      setActiveModal('property');
    }
  }, [gameStatus, activeCard, selectedPropertyId]);

  // Close non-setup modals on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeModal && activeModal !== 'setup') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ---------------------------------------------------------------------------
  // 4. Centralized Modal & Interaction Handlers
  // ---------------------------------------------------------------------------
  const handleOpenModal = useCallback((modal: Exclude<ActiveModalType, null>) => {
    setActiveModal(modal);
    // Close mobile drawers when opening a modal to avoid visual clutter
    setIsLeftPanelOpen(false);
    setIsRightPanelOpen(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    if (activeModal === 'property' && selectProperty) {
      selectProperty(null);
    }
    if (activeModal === 'card' && acknowledgeCard) {
      acknowledgeCard();
    }
    setActiveModal(null);
  }, [activeModal, selectProperty, acknowledgeCard]);

  const handleBoardSelectProperty = useCallback(
    (propertyId: number | string) => {
      if (selectProperty) {
        selectProperty(propertyId);
      }
      setActiveModal('property');
    },
    [selectProperty]
  );

  const handleStartGame = useCallback(
    (config: GameSetupConfig) => {
      startGame(config);
      setActiveModal(null);
    },
    [startGame]
  );

  const handleTradeSubmit = useCallback(
    (offer: TradeOffer) => {
      executeTrade(offer);
      setActiveModal(null);
    },
    [executeTrade]
  );

  const toggleLeftPanel = useCallback(() => {
    setIsLeftPanelOpen((prev) => !prev);
    setIsRightPanelOpen(false);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setIsRightPanelOpen((prev) => !prev);
    setIsLeftPanelOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // 5. Render Layout
  // ---------------------------------------------------------------------------
  return (
    <div className="app-container game-screen">
      {/* =====================================================================
          LAYER 0: 3D MONOPOLY BOARD SCENE
          Preserves Three.js / React Three Fiber canvas, camera, lighting, and
          pointer interactions across the entire viewport.
      ===================================================================== */}
      <main
        className="game-board-container"
        aria-label="3D Monopoly Board Viewport"
      >
        <div className="board-canvas-wrapper">
          <MonopolyBoard
            players={players}
            currentPlayerIndex={currentPlayerIndex}
            properties={properties}
            dice={dice}
            isRolling={isRolling}
            selectedPropertyId={selectedPropertyId}
            onSelectProperty={handleBoardSelectProperty}
          />
        </div>
      </main>

      {/* =====================================================================
          LAYER 1: HUD OVERLAY (Header, Side Panels, Bottom Action Dock)
          Uses pointer-events: none on container and pointer-events: auto on
          interactive HUD children so the 3D board remains interactive.
      ===================================================================== */}
      <div className="game-hud-layer">
        {/* 1. HEADER SECTION */}
        <header className="game-header">
          <HeaderBar
            gameStatus={gameStatus}
            currentPlayer={currentPlayer}
            turnPhase={turnPhase}
            winner={winner}
            onOpenRulebook={() => handleOpenModal('rulebook')}
            onOpenTrade={() => handleOpenModal('trade')}
            onOpenSetup={() => handleOpenModal('setup')}
            onResetGame={resetGame}
            onTogglePlayersPanel={toggleLeftPanel}
            onToggleLogPanel={toggleRightPanel}
            isPlayersPanelOpen={isLeftPanelOpen}
            isLogPanelOpen={isRightPanelOpen}
          />
        </header>

        {/* 2. MAIN GAME AREA (Left Player Panels & Right Activity Log) */}
        <div className="game-main-area">
          {/* Mobile Backdrop for Collapsible Drawers */}
          {(isLeftPanelOpen || isRightPanelOpen) && (
            <div
              className="mobile-panel-backdrop"
              onClick={() => {
                setIsLeftPanelOpen(false);
                setIsRightPanelOpen(false);
              }}
              aria-hidden="true"
            />
          )}

          {/* Left: PlayerPanels */}
          <aside
            className={`game-side-panel game-side-panel--left ${
              isLeftPanelOpen ? 'is-open' : ''
            }`}
            aria-label="Player Information Panels"
          >
            <PlayerPanels
              players={players}
              currentPlayerIndex={currentPlayerIndex}
              properties={properties}
              onSelectProperty={handleBoardSelectProperty}
              onOpenTrade={() => handleOpenModal('trade')}
            />
          </aside>

          {/* Center spacer allows unobstructed 3D board interaction */}
          <div className="game-board-spacer" aria-hidden="true" />

          {/* Right: ActivityLog */}
          <aside
            className={`game-side-panel game-side-panel--right ${
              isRightPanelOpen ? 'is-open' : ''
            }`}
            aria-label="Game Activity Log"
          >
            <ActivityLog events={events} players={players} />
          </aside>
        </div>

        {/* 3. BOTTOM SECTION: ActionDock */}
        <footer className="game-action-dock">
          <ActionDock
            currentPlayer={currentPlayer}
            currentProperty={currentSpaceProperty}
            dice={dice}
            isRolling={isRolling}
            turnPhase={turnPhase}
            gameStatus={gameStatus}
            onRollDice={rollDice}
            onBuyProperty={() =>
              currentSpaceProperty && buyProperty(currentSpaceProperty.id)
            }
            onSkipProperty={skipProperty}
            onManageProperty={() => {
              if (currentSpaceProperty) {
                handleBoardSelectProperty(currentSpaceProperty.id);
              } else if (selectedProperty) {
                setActiveModal('property');
              }
            }}
            onOpenTrade={() => handleOpenModal('trade')}
            onPayBail={payBail}
            onUseJailCard={useGetOutOfJailCard}
            onEndTurn={endTurn}
          />
        </footer>
      </div>

      {/* =====================================================================
          LAYER 2: CENTRALIZED MODAL LAYER
          Rendered above both the 3D scene and HUD panels.
      ===================================================================== */}
      {activeModal !== null && (
        <div
          className="modal-overlay game-modal-layer animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          {activeModal === 'setup' && (
            <div className="modal-content animate-scale-in">
              <SetupModal
                isOpen={true}
                onStartGame={handleStartGame}
                onClose={
                  gameStatus !== 'setup' ? handleCloseModal : undefined
                }
              />
            </div>
          )}

          {activeModal === 'property' && selectedProperty && (
            <div className="modal-content animate-scale-in">
              <PropertyModal
                isOpen={true}
                property={selectedProperty}
                players={players}
                currentPlayer={currentPlayer}
                turnPhase={turnPhase}
                onClose={handleCloseModal}
                onBuy={() => buyProperty(selectedProperty.id)}
                onBuildHouse={() => buildHouse(selectedProperty.id)}
                onSellHouse={() => sellHouse(selectedProperty.id)}
                onMortgage={() => mortgageProperty(selectedProperty.id)}
                onUnmortgage={() => unmortgageProperty(selectedProperty.id)}
              />
            </div>
          )}

          {activeModal === 'card' && activeCard && (
            <div className="modal-content animate-scale-in">
              <CardPopup
                isOpen={true}
                card={activeCard as GameCard}
                currentPlayer={currentPlayer}
                onAcknowledge={() => {
                  acknowledgeCard();
                  setActiveModal(null);
                }}
                onClose={handleCloseModal}
              />
            </div>
          )}

          {activeModal === 'trade' && (
            <div className="modal-content animate-scale-in">
              <TradeModal
                isOpen={true}
                players={players}
                currentPlayer={currentPlayer}
                properties={properties}
                onSubmitTrade={handleTradeSubmit}
                onClose={handleCloseModal}
              />
            </div>
          )}

          {activeModal === 'rulebook' && (
            <div className="modal-content animate-scale-in">
              <RulebookModal isOpen={true} onClose={handleCloseModal} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
