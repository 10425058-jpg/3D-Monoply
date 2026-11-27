import { useLayoutEffect, useRef } from 'react';
import { useMotionPreferences } from '../../presentation/useMotionPreferences';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function BalanceText({ value, epoch, as: Tag = 'strong', className }: {
  value: number; epoch?: number; as?: 'strong' | 'b' | 'span'; className?: string;
}) {
  const node = useRef<HTMLElement | null>(null);
  const number = useRef(value);
  const previousEpoch = useRef(epoch);
  const { reducedMotion, visible } = useMotionPreferences();
  useLayoutEffect(() => {
    const element = node.current;
    const reset = epoch !== previousEpoch.current;
    previousEpoch.current = epoch;
    if (!element) return;
    const paint = (amount: number) => {
      number.current = amount;
      element.textContent = currency.format(amount);
    };
    if (reset || reducedMotion || !visible || number.current === value) {
      paint(value);
      return;
    }
    const from = number.current;
    const start = performance.now();
    let frame: number;
    const update = (now: number) => {
      const t = Math.min(1, (now - start) / 330);
      const amount = t === 1 ? value : Math.round(from + (value - from) * (1 - (1 - t) ** 3));
      if (amount !== number.current) paint(amount);
      if (t < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [epoch, reducedMotion, value, visible]);
  return <Tag ref={element => { node.current = element; }} className={className} aria-label={currency.format(value)}>
    {currency.format(number.current)}
  </Tag>;
}
