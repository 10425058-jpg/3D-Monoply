import React, { useState, useMemo, useEffect } from 'react';
import { Player, PropertyData, TradeOffer, GROUP_COLORS } from './types';

export interface TradeModalProps {
  isOpen: boolean;
  activePlayer: Player;
  players: Player[];
  properties: PropertyData[];
  incomingTrade?: TradeOffer | null;
  onSubmitTrade: (offer: TradeOffer) => void;
  onAcceptTrade?: (offer: TradeOffer) => void;
  onRejectTrade?: () => void;
  onClose: () => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  activePlayer,
  players,
  properties,
  incomingTrade = null,
  onSubmitTrade,
  onAcceptTrade,
  onRejectTrade,
  onClose,
}) => {
  const availablePartners = useMemo(
    () => players.filter((p) => p.id !== activePlayer?.id && !p.isBankrupt),
    [players, activePlayer]
  );

  const [partnerId, setPartnerId] = useState<string>(availablePartners[0]?.id || '');
  const [offeredProps, setOfferedProps] = useState<string[]>([]);
  const [requestedProps, setRequestedProps] = useState<string[]>([]);
  const [offeredCash, setOfferedCash] = useState<number>(0);
  const [requestedCash, setRequestedCash] = useState<number>(0);

  useEffect(() => {
    if (incomingTrade) {
      setPartnerId(incomingTrade.fromPlayerId);
      setOfferedProps(incomingTrade.offeredPropertyIds);
      setRequestedProps(incomingTrade.requestedPropertyIds);
      setOfferedCash(incomingTrade.offeredCash);
      setRequestedCash(incomingTrade.requestedCash);
    } else if (availablePartners.length > 0 && !availablePartners.some((p) => p.id === partnerId)) {
      setPartnerId(availablePartners[0].id);
    }
  }, [incomingTrade, availablePartners, partnerId]);

  if (!isOpen || !activePlayer) return null;

  const partner = players.find((p) => p.id === partnerId) || availablePartners[0];
  const myProperties = properties.filter((p) => p.ownerId === activePlayer.id && p.houses === 0);
  const partnerProperties = properties.filter((p) => p.ownerId === partner?.id && p.houses === 0);

  const toggleProp = (id: string, list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (incomingTrade) return;
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const offeredValue =
    offeredCash +
    offeredProps.reduce((sum, id) => sum + (properties.find((p) => p.id === id)?.price || 0), 0);

  const requestedValue =
    requestedCash +
    requestedProps.reduce((sum, id) => sum + (properties.find((p) => p.id === id)?.price || 0), 0);

  const isTradeValid =
    partner &&
    (offeredProps.length > 0 ||
      requestedProps.length > 0 ||
      offeredCash > 0 ||
      requestedCash > 0);

  const handlePropose = () => {
    if (!partner || !isTradeValid) return;
    onSubmitTrade({
      fromPlayerId: activePlayer.id,
      toPlayerId: partner.id,
      offeredPropertyIds: offeredProps,
      requestedPropertyIds: requestedProps,
      offeredCash,
      requestedCash,
    });
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-3xl bg-[#0B0F19] border border-[#D4AF37]/40 rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] block">
              Executive Negotiation
            </span>
            <h2 className="font-serif font-bold text-xl text-[#F9F6F0]">
              {incomingTrade ? 'Incoming Trade Proposal' : 'Propose Property Trade'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Two-Column Trade Builder */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Active Player Offer */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activePlayer.color }}
                />
                <span className="font-semibold text-sm text-[#F9F6F0]">
                  {activePlayer.name} (You Offer)
                </span>
              </div>
              <span className="font-mono text-xs text-[#F3E5AB]">
                 Cash: ${activePlayer.cash.toLocaleString()}
              </span>
            </div>

            {/* Cash Slider + Input */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Cash Offered</span>
                <span className="font-mono font-bold text-[#F3E5AB]">${offeredCash}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={activePlayer.cash}
                  step={10}
                  disabled={!!incomingTrade}
                  value={offeredCash}
                  onChange={(e) => setOfferedCash(Number(e.target.value))}
                  className="flex-1 accent-[#D4AF37]"
                />
                <input
                  type="number"
                  min={0}
                  max={activePlayer.cash}
                  disabled={!!incomingTrade}
                  value={offeredCash}
                  onChange={(e) =>
                    setOfferedCash(Math.min(activePlayer.cash, Math.max(0, Number(e.target.value))))
                  }
                  className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/15 font-mono text-xs text-right text-[#F9F6F0]"
                />
              </div>
            </div>

            {/* Selectable Deeds */}
            <div className="flex-1">
              <span className="text-xs text-slate-400 block mb-2">
                Select Deeds to Offer ({offeredProps.length})
              </span>
              {myProperties.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No tradable unimproved properties owned.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {myProperties.map((prop) => {
                    const selected = offeredProps.includes(prop.id);
                    const group = GROUP_COLORS[prop.group] || GROUP_COLORS.brown;
                    return (
                      <button
                        key={prop.id}
                        type="button"
                        onClick={() => toggleProp(prop.id, offeredProps, setOfferedProps)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                          selected
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F9F6F0]'
                            : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: group.bg }}
                          />
                          <span className="truncate">{prop.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">
                          ${prop.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Partner Request */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Partner:</span>
                <select
                  disabled={!!incomingTrade}
                  value={partner?.id || ''}
                  onChange={(e) => {
                    setPartnerId(e.target.value);
                    setRequestedProps([]);
                    setRequestedCash(0);
                  }}
                  className="bg-[#131B2E] border border-white/15 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#F9F6F0] focus:outline-none focus:border-[#D4AF37]"
                >
                  {availablePartners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {partner && (
                <span className="font-mono text-xs text-[#F3E5AB]">
                  Cash: ${partner.cash.toLocaleString()}
                </span>
              )}
            </div>

            {/* Requested Cash */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Cash Requested</span>
                <span className="font-mono font-bold text-[#F3E5AB]">${requestedCash}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={partner?.cash || 0}
                  step={10}
                  disabled={!!incomingTrade}
                  value={requestedCash}
                  onChange={(e) => setRequestedCash(Number(e.target.value))}
                  className="flex-1 accent-[#D4AF37]"
                />
                <input
                  type="number"
                  min={0}
                  max={partner?.cash || 0}
                  disabled={!!incomingTrade}
                  value={requestedCash}
                  onChange={(e) =>
                    setRequestedCash(
                      Math.min(partner?.cash || 0, Math.max(0, Number(e.target.value)))
                    )
                  }
                  className="w-20 px-2 py-1 rounded-lg bg-black/40 border border-white/15 font-mono text-xs text-right text-[#F9F6F0]"
                />
              </div>
            </div>

            {/* Partner Selectable Deeds */}
            <div className="flex-1">
              <span className="text-xs text-slate-400 block mb-2">
                Select Deeds to Request ({requestedProps.length})
              </span>
              {partnerProperties.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  Partner has no tradable unimproved properties.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {partnerProperties.map((prop) => {
                    const selected = requestedProps.includes(prop.id);
                    const group = GROUP_COLORS[prop.group] || GROUP_COLORS.brown;
                    return (
                      <button
                        key={prop.id}
                        type="button"
                        onClick={() => toggleProp(prop.id, requestedProps, setRequestedProps)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all ${
                          selected
                            ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F9F6F0]'
                            : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: group.bg }}
                          />
                          <span className="truncate">{prop.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400">
                          ${prop.price}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trade Valuation Summary & Actions */}
        <div className="px-6 py-4 bg-white/[0.03] border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-400">Total Offered Value: </span>
              <span className="font-mono font-bold text-[#F3E5AB]">${offeredValue}</span>
            </div>
            <span className="text-white/20">⇄</span>
            <div>
              <span className="text-slate-400">Total Requested Value: </span>
              <span className="font-mono font-bold text-[#F3E5AB]">${requestedValue}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {incomingTrade ? (
              <>
                <button
                  type="button"
                  onClick={onRejectTrade}
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                >
                  Reject Offer
                </button>
                <button
                  type="button"
                  onClick={() => onAcceptTrade?.(incomingTrade)}
                  className="px-6 py-2.5 rounded-xl font-serif font-bold uppercase tracking-wider text-xs bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] text-[#0B0F19]"
                >
                  Accept Trade
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl font-semibold text-xs bg-white/[0.06] hover:bg-white/10 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isTradeValid}
                  onClick={handlePropose}
                  className="px-6 py-2.5 rounded-xl font-serif font-bold uppercase tracking-wider text-xs bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] text-[#0B0F19] shadow-[0_0_20px_rgba(212,175,55,0.35)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Send Trade Offer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeModal;
