import React from 'react';
import { ArrowLeft } from 'lucide-react';
import SoloApp from '../App';
import { PresentationProvider } from '../presentation/PresentationProvider';

/** Imported only after Solo is selected; the existing store stays cached between visits. */
export default function SoloGame({ onHome }: { onHome: () => void }) {
  return <PresentationProvider><SoloApp /><button className="city-solo-home" onClick={onHome}><ArrowLeft size={14} />Main menu</button></PresentationProvider>;
}
