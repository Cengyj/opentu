// @vitest-environment jsdom

import React, { lazy, Suspense } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MountAfterFirstActivation } from './MountAfterFirstActivation';

afterEach(cleanup);

describe('MountAfterFirstActivation', () => {
  it('does not invoke a lazy loader before the first real activation', async () => {
    const loader = vi.fn(async () => ({
      default: () => <div data-testid="lazy-overlay">overlay</div>,
    }));
    const LazyOverlay = lazy(loader);

    const view = render(
      <MountAfterFirstActivation active={false}>
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <LazyOverlay />
        </Suspense>
      </MountAfterFirstActivation>
    );

    expect(loader).not.toHaveBeenCalled();
    expect(screen.queryByTestId('loading')).toBeNull();

    view.rerender(
      <MountAfterFirstActivation active={true}>
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <LazyOverlay />
        </Suspense>
      </MountAfterFirstActivation>
    );

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('lazy-overlay')).toBeTruthy();

    view.rerender(
      <MountAfterFirstActivation active={false}>
        <Suspense fallback={<div data-testid="loading">loading</div>}>
          <LazyOverlay />
        </Suspense>
      </MountAfterFirstActivation>
    );

    expect(screen.getByTestId('lazy-overlay')).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
