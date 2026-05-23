import { afterEach, describe, expect, it, vi } from 'vitest';
import { isBlockedExternalLink, openExternalLink } from './external-link-policy';

describe('external-link-policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks GitHub-owned hosts', () => {
    expect(isBlockedExternalLink('https://github.com/ljquan/aitu')).toBe(true);
    expect(isBlockedExternalLink('https://gist.github.com/abc')).toBe(true);
    expect(isBlockedExternalLink('https://raw.githubusercontent.com/a/b/c')).toBe(
      true
    );
  });

  it('allows non-GitHub and local links', () => {
    expect(isBlockedExternalLink('https://foropencode.com/')).toBe(false);
    expect(isBlockedExternalLink('./versions.html')).toBe(false);
  });

  it('does not open blocked links', () => {
    const openSpy = vi.spyOn(window, 'open');

    expect(openExternalLink('https://github.com/ljquan/aitu')).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens allowed links through the centralized policy', () => {
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue({ opener: null } as Window);

    expect(openExternalLink('https://foropencode.com/')).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      'https://foropencode.com/',
      '_blank',
      'noopener'
    );
  });
});
