import type { ReactNode } from 'react';
import { useInView } from '../hooks/useInView';

/** Fades content up once when it scrolls into view. Marketing pages only. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      data-in={inView}
      className={className ? `reveal ${className}` : 'reveal'}
    >
      {children}
    </div>
  );
}
