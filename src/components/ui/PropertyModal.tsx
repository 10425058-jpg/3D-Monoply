import React from 'react';
import { PropertyData, Player, GROUP_COLORS } from './types';

export interface PropertyModalProps {
  property: PropertyData | null;
  isOpen: boolean;
  owner?: Player | null;
  activePlayer?: Player;
  canBuy?: boolean;
  canBuild?: boolean;
  onBuy?: (propertyId: string) => void;
  onAuction?: (propertyId: string) => void;
  onBuildHouse?: (propertyId: string) => void;
  onSellHouse?: (propertyId: string) => void;
  onToggleMortgage?: (propertyId: string) => void;
  onClose: () => void;
}

export const PropertyModal: React.FC<PropertyModalProps> = ({
  property,
  isOpen,
  owner,
  activePlayer,
  canBuy = false,
  canBuild = false,
  onBuy,
  onAuction,
  onBuildHouse,
  onSellHouse,
  onToggleMortgage,
  onClose,
}) => {
  if (!isOpen || !property) return null;

  const groupStyle = GROUP_COLORS[property.group] || GROUP_COLORS.brown;
  const isOwnedByActive = activePlayer && property.ownerId === activePlayer.id;
  const isStandardStreet = property.group !== 'railroad' && property.group !== 'utility';

  const rentLabels =
    property.group === 'railroad'
      ? ['1 Railroad Owned', '2 Railroads Owned', '3 Railroads Owned', '4 Railroads Owned']
      : property.group === 'utility'
      ? ['1 Utility Owned', '2 Utilities Owned']
      : [
          'Base Rent',
          'With 1 House',
          'With 2 Houses',
          'With 3 Houses',
          'With 4 Houses',
          'With HOTEL',
        ];

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="relative w-full max-w-md bg-[#0B0F19] border border-[#D4AF37]/40 rounded-3xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)]">
        {/* Official Title Deed Color Header */}
        <div
          className="px-6 py-5 text-center relative border-b border-white/15"
          style={{ backgroundColor: groupStyle.bg, color: groupStyle.text }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/25 hover:bg-black/40 text-white flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            ✕
          </button>

          <span className="text-[10px] font-bold uppercase tracking-[0.22em] opacity-85 block mb-1">
            Title Deed • {groupStyle.label}
          </span>
          <h2 className="font-serif font-extrabold text-2xl tracking-wide uppercase drop-shadow-sm">
            {property.name}
          </h2>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Price & Owner Summary Bar */}
          <div className="grid grid-cols-2 gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-3.5">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Purchase Price
              </span>
              <span className="font-mono font-bold text-xl text-[#F3E5AB]">
                ${property.price.toLocaleString()}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Current Owner
              </span>
              {owner ? (
                <span
                  className="font-semibold text-sm inline-flex items-center gap-1.5 mt-0.5"
                  style={{ color: owner.color }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: owner.color }}
                  />
                  {owner.name}
                </span>
              ) : (
                <span className="text-sm font-semibold text-emerald-400">
                  Available (Bank)
                </span>
              )}
            </div>
          </div>

          {/* Rent Schedule Table */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] pb-1.5 border-b border-white/10">
              <span>Development Level</span>
              <span>Rent Payable</span>
            </div>

            {rentLabels.map((label, idx) => {
              const rentAmount = property.rent[idx] ?? 0;
              const isCurrentTier = property.ownerId && property.houses === idx;

              return (
                <div
                  key={label}
                  className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs transition-colors ${
                    isCurrentTier
                      ? 'bg-[#D4AF37]/20 text-[#F3E5AB] font-bold border border-[#D4AF37]/40'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {isCurrentTier && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                    {label}
                  </span>
                  <span className="font-mono">
                    {property.group === 'utility' && rentAmount <= 10
                      ? `${rentAmount}× Dice Roll`
                      : `$${rentAmount.toLocaleString()}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Building & Mortgage Costs */}
          <div className="grid grid-cols-3 gap-2 text-center bg-white/[0.02] border border-white/10 rounded-2xl p-3 text-xs">
            <div>
              <span className="text-[10px] uppercase text-slate-400 block">House Cost</span>
              <span className="font-mono font-semibold text-[#F9F6F0]">
                {isStandardStreet ? `$${property.houseCost || 100}` : 'N/A'}
              </span>
            </div>
            <div className="border-x border-white/10">
              <span className="text-[10px] uppercase text-slate-400 block">Hotel Cost</span>
              <span className="font-mono font-semibold text-[#F9F6F0]">
                {isStandardStreet ? `$${property.hotelCost || property.houseCost || 100}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-400 block">Mortgage</span>
              <span className="font-mono font-semibold text-[#F9F6F0]">
                ${property.mortgageValue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Unowned Actions: Buy / Auction */}
            {!property.ownerId && canBuy && onBuy && (
              <button
                type="button"
                onClick={() => onBuy(property.id)}
                disabled={activePlayer ? activePlayer.cash < property.price : false}
                className="flex-1 py-3 rounded-xl font-serif font-bold uppercase tracking-wider text-xs sm:text-sm bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] text-[#0B0F19] shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Buy for ${property.price}
              </button>
            )}

            {!property.ownerId && canBuy && onAuction && (
              <button
                type="button"
                onClick={() => onAuction(property.id)}
                className="px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all"
              >
                Auction
              </button>
            )}

            {/* Owner Management Actions */}
            {isOwnedByActive && isStandardStreet && onBuildHouse && (
              <button
                type="button"
                onClick={() => onBuildHouse(property.id)}
                disabled={!canBuild || property.houses >= 5 || property.isMortgaged}
                className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 disabled:opacity-40 transition-all"
              >
                {property.houses === 4 ? 'Build Hotel' : '+ Build House'}
              </button>
            )}

            {isOwnedByActive && isStandardStreet && property.houses > 0 && onSellHouse && (
              <button
                type="button"
                onClick={() => onSellHouse(property.id)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-all"
              >
                Sell Building
              </button>
            )}

            {isOwnedByActive && property.houses === 0 && onToggleMortgage && (
              <button
                type="button"
                onClick={() => onToggleMortgage(property.id)}
                className="px-3.5 py-2.5 rounded-xl font-semibold text-xs bg-white/[0.06] hover:bg-white/10 text-slate-200 border border-white/10 transition-all"
              >
                {property.isMortgaged ? 'Unmortgage' : 'Mortgage'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl font-semibold text-xs sm:text-sm bg-white/[0.06] hover:bg-white/10 text-slate-300 transition-all ml-auto"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyModal;
