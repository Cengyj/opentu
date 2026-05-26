// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionButtons } from './ActionButtons';

vi.mock('tdesign-react', () => ({
  Button: ({ icon, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {icon}
    </button>
  ),
}));

vi.mock('tdesign-icons-react', () => ({
  ChevronDownIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} data-testid="chevron-icon" />
  ),
  RefreshIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} data-testid="refresh-icon" />
  ),
}));

vi.mock('../../shared', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => children,
}));

describe('ActionButtons', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    cleanup();
  });

  it('keeps the default quantity selector and passes the selected count', () => {
    const onGenerate = vi.fn();

    const { container } = render(
      <ActionButtons
        language="en"
        type="image"
        isGenerating={false}
        hasGenerated={false}
        canGenerate={true}
        onGenerate={onGenerate}
        onReset={vi.fn()}
      />
    );

    const quantityInput = container.querySelector(
      '.quantity-input'
    ) as HTMLInputElement;
    expect(quantityInput).toBeTruthy();

    fireEvent.change(quantityInput, { target: { value: '3' } });
    fireEvent.blur(quantityInput);
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    expect(onGenerate).toHaveBeenCalledWith(3);
  });

  it('supports a custom generate label without a quantity selector', () => {
    const onGenerate = vi.fn();

    const { container } = render(
      <ActionButtons
        language="en"
        type="image"
        isGenerating={false}
        hasGenerated={false}
        canGenerate={true}
        onGenerate={onGenerate}
        onReset={vi.fn()}
        showQuantity={false}
        generateLabel="Generate PSD"
      />
    );

    expect(container.querySelector('.quantity-input')).toBeNull();
    expect(container.querySelector('.action-divider')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Generate PSD' }));

    expect(onGenerate).toHaveBeenCalledWith(undefined);
  });

  it('keeps a custom generate label after content has been generated', () => {
    render(
      <ActionButtons
        language="zh"
        type="image"
        isGenerating={false}
        hasGenerated={true}
        canGenerate={true}
        onGenerate={vi.fn()}
        onReset={vi.fn()}
        showQuantity={false}
        generateLabel="重新规划 PSD"
      />
    );

    expect(screen.getByRole('button', { name: '重新规划 PSD' })).toBeTruthy();
  });
});
