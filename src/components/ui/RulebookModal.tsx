import React, { useState } from 'react';

export interface RulebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RULE_SECTIONS = [
  {
    id: 'overview',
    title: 'How to Play',
    icon: '👑',
    summary: 'Build an empire by acquiring color sets, developing houses and hotels, and bankrupting opponents.',
    points: [
      'Each player starts on GO with $1,500 (or your custom starting capital).',
      'Players take turns rolling two dice and advancing clockwise around the 3D board.',
      'Pass or land on GO to collect $200 salary from the Bank.',
      'The last remaining solvent player wins the match.',
    ],
  },
  {
    id: 'dice',
    title: 'Dice & Movement',
    icon: '🎲',
    summary: 'Roll two standard six-sided dice to navigate the city streets.',
    points: [
      'Roll Doubles (both dice show the same number) to earn an immediate bonus turn.',
      'Rolling Doubles three consecutive times sends your token directly to Jail.',
      'Your token triggers the action of the space where it finishes its movement.',
    ],
  },
  {
    id: 'properties',
    title: 'Buying Properties',
    icon: '🏠',
    summary: 'Acquire Title Deeds to establish recurring rent income.',
    points: [
      'Landing on an unowned Street, Railroad, or Utility gives you the first right to purchase it at face value.',
      'If you decline to purchase, the Bank may auction the deed to the highest bidder.',
      'Owning all properties in a single color group forms a Monopoly.',
    ],
  },
  {
    id: 'rent',
    title: 'Rent & Buildings',
    icon: '🏗️',
    summary: 'Multiply property yields with even development across color sets.',
    points: [
      'Owning a complete color group doubles the base rent on all unimproved lots in that group.',
      'Houses must be built evenly across a color group before adding a second house to any lot.',
      'Four Houses on a property can be upgraded into a luxury Hotel for maximum rent.',
      'Mortgaged properties do not collect rent until unmortgaged (+10% interest).',
    ],
  },
  {
    id: 'jail',
    title: 'Jail Rules',
    icon: '⛓️',
    summary: 'How you enter Jail and the three legal ways to exit.',
    points: [
      'You are sent to Jail by landing on "Go to Jail", drawing a Jail card, or rolling 3 consecutive Doubles.',
      'You may still collect rent, trade, and manage buildings while in Jail.',
      'Exit Jail by: (1) Paying $50 bail before rolling, (2) Using a Get Out of Jail Free card, or (3) Rolling Doubles on your turn (up to 3 attempts).',
    ],
  },
  {
    id: 'bankruptcy',
    title: 'Bankruptcy',
    icon: '⚖️',
    summary: 'Liquidate buildings or mortgage deeds when cash reserves run low.',
    points: [
      'Houses and Hotels can be sold back to the Bank at 50% of their purchase cost.',
      'If you owe more than your total net worth (cash + buildings + mortgage value), you must declare bankruptcy and retire from the game.',
    ],
  },
];

export const RulebookModal: React.FC<RulebookModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>(RULE_SECTIONS[0].id);

  if (!isOpen) return null;

  const currentSection = RULE_SECTIONS.find((s) => s.id === activeTab) || RULE_SECTIONS[0];

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-3xl bg-[#0B0F19] border border-[#D4AF37]/40 rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.9)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-lg">
              📖
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] block">
                Official Handbook
              </span>
              <h2 className="font-serif font-bold text-xl text-[#F9F6F0]">
                Monopoly Rulebook
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Body Layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-60 bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/10 p-3 flex md:flex-col gap-1.5 overflow-x-auto">
            {RULE_SECTIONS.map((sec) => {
              const active = sec.id === activeTab;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveTab(sec.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left shrink-0 transition-all ${
                    active
                      ? 'bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40'
                      : 'text-slate-400 hover:text-[#F9F6F0] hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{sec.icon}</span>
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#D4AF37]/15 to-transparent border border-[#D4AF37]/30">
              <div className="flex items-center gap-2 text-lg font-serif font-bold text-[#F9F6F0]">
                <span>{currentSection.icon}</span>
                <h3>{currentSection.title}</h3>
              </div>
              <p className="text-xs sm:text-sm text-[#F3E5AB] mt-1 leading-relaxed">
                {currentSection.summary}
              </p>
            </div>

            <ul className="space-y-3">
              {currentSection.points.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs sm:text-sm text-slate-200 leading-relaxed"
                >
                  <span className="w-6 h-6 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#F3E5AB] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white/[0.03] border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-serif font-bold uppercase tracking-wider text-xs bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] text-[#0B0F19]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export default RulebookModal;
