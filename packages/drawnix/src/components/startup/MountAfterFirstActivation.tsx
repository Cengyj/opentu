import { type ReactNode, useEffect, useState } from 'react';

export interface MountAfterFirstActivationProps {
  active: boolean;
  children: ReactNode;
}

/**
 * Keeps an optional UI subtree out of React's render graph until it is first
 * needed. Once activated it stays mounted so controlled close animations,
 * focus restoration and component-local state retain their existing behavior.
 */
export function MountAfterFirstActivation({
  active,
  children,
}: MountAfterFirstActivationProps) {
  const [hasActivated, setHasActivated] = useState(active);

  useEffect(() => {
    if (active) {
      setHasActivated(true);
    }
  }, [active]);

  return active || hasActivated ? children : null;
}
