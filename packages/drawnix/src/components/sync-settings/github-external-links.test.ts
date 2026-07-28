import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GITHUB_API_BASE } from '../../services/github-sync/types';

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const join = (...parts: string[]) => parts.join('');

describe('GitHub/Gist external jump entries', () => {
  it('removes repository jump entries from toolbar and menu sources', () => {
    const source = [
      readSource('../toolbar/app-toolbar/app-toolbar.tsx'),
      readSource('../toolbar/app-toolbar/app-menu-items.tsx'),
    ].join('\n');

    expect(source).not.toContain(join('https://', 'github', '.com/ljquan/aitu'));
    expect(source).not.toContain(join('toolbar_click_', 'github'));
    expect(source).not.toContain(join('toolbar_click_menu_', 'github'));
    expect(source).not.toContain(join('GitHub', 'Link'));
    expect(source).not.toContain(join('menu.', 'github'));
  });

  it('removes token and gist external jump entries from sync settings sources', () => {
    const source = [
      readSource('./SyncSettings.tsx'),
      readSource('./TokenGuide.tsx'),
      readSource('./RecycleBin.tsx'),
      readSource('./sync-settings.scss'),
      readSource('./token-guide.scss'),
    ].join('\n');

    expect(source).not.toContain(join('github', '.com/settings/tokens'));
    expect(source).not.toContain(join('gist.', 'github', '.com'));
    expect(source).not.toContain(join('href={', 'token', 'Creation', 'Url', '}'));
    expect(source).not.toContain(join('window.open(', 'gist'));
    expect(source).not.toContain(join('在 GitHub', ' 创建 Token'));
    expect(source).not.toContain(join('在 GitHub', ' 查看'));
    expect(source).not.toContain(join('打开 GitHub', ' Token 设置'));
    expect(source).not.toContain('Personal access tokens 页面');
    expect(source).not.toContain('Generate token');
    expect(source).not.toContain('GitHub 设置中');
    expect(source).not.toContain('sync-settings__token-link');
    expect(source).not.toContain('token-guide__link');
  });

  it('preserves internal GitHub API sync capabilities', () => {
    const tokenService = readSource('../../services/github-sync/token-service.ts');
    const apiService = readSource('../../services/github-sync/github-api-service.ts');
    const context = readSource('../../contexts/GitHubSyncContext.tsx');

    expect(GITHUB_API_BASE).toBe('https://api.github.com');
    expect(tokenService).toContain("fetch('https://api.github.com/user'");
    expect(tokenService).toContain("fetch('https://api.github.com/gists?per_page=1'");
    expect(apiService).toContain('async createSyncGist');
    expect(apiService).toContain('async listSyncGists');
    expect(apiService).toContain('async updateGistFiles');
    expect(context).toContain('setToken: (token: string) => Promise<boolean>');
    expect(context).toContain('listGists: () => Promise<GistInfo[]>');
  });
});
