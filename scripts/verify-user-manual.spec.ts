import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateManual,
  replaceOutputDirectory,
  runGenerateManualCli,
} from './generate-manual';
import {
  ManualIntegrityError,
  readManualSourcePages,
  USER_MANUAL_DOCUMENT_MARKER,
  USER_MANUAL_SOURCE_DIGEST_META,
  USER_MANUAL_VERSION_META,
  validateManualOutput,
} from './manual-integrity';
import {
  parseVerifyUserManualArgs,
  runVerifyUserManualCli,
} from './verify-user-manual';

const temporaryDirectories: string[] = [];

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'opentu-user-manual-contract-')
  );
  temporaryDirectories.push(directory);
  return directory;
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function createSourcePage(
  contentDir: string,
  relativePath: string,
  title: string
): void {
  writeFile(
    path.join(contentDir, relativePath),
    `---\ntitle: ${title}\ncategory: advanced\norder: 1\n---\n\n# ${title}\n\n页面内容。\n`
  );
}

function createWorkspaceFixture(
  options: { brokenScreenshotSource?: boolean } = {}
) {
  const workspaceRoot = createTemporaryDirectory();
  const manualDir = path.join(workspaceRoot, 'docs', 'user-manual');
  const contentDir = path.join(manualDir, 'content');
  const outputDir = path.join(workspaceRoot, 'generated-manual');
  const screenshotSource = options.brokenScreenshotSource
    ? '../../broken-screenshots'
    : '../../missing-screenshots';

  writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ version: '9.9.9' })
  );
  writeFile(
    path.join(manualDir, 'config.yaml'),
    `site:\n  title: Opentu 用户手册\n  description: 测试手册\n  logo: test\ncategories:\n  advanced:\n    name: 进阶功能\n    order: 1\nscreenshots:\n  source: ${screenshotSource}\n  output: ./screenshots\noutput:\n  dir: ../../generated-manual\n  format: html\n`
  );
  createSourcePage(contentDir, 'index.mdx', '首页');
  createSourcePage(contentDir, 'advanced/settings.mdx', '设置与配置');

  if (options.brokenScreenshotSource) {
    writeFile(
      path.join(workspaceRoot, 'broken-screenshots'),
      'not a directory'
    );
  }

  return { workspaceRoot, contentDir, outputDir };
}

function validManualHtml(
  title: string,
  sourceDigest: string,
  version = '9.9.9'
): string {
  return `<!doctype html><html><head>${USER_MANUAL_DOCUMENT_MARKER}<meta name="${USER_MANUAL_SOURCE_DIGEST_META}" content="${sourceDigest}" /><meta name="${USER_MANUAL_VERSION_META}" content="${version}" /><title>${title} | Opentu 用户手册</title></head><body><main>${title}</main></body></html>`;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('user manual source and output integrity', () => {
  it('maps all current 21 MDX sources to unique generated slugs', () => {
    const pages = readManualSourcePages(
      path.join(process.cwd(), 'docs', 'user-manual', 'content')
    );

    expect(pages).toHaveLength(21);
    expect(new Set(pages.map((page) => page.slug)).size).toBe(21);
    expect(pages.map((page) => page.slug)).toContain('index');
    expect(pages.map((page) => page.slug)).toContain('advanced-settings');
  });

  it('accepts a one-to-one marked manual output', () => {
    const { contentDir, outputDir } = createWorkspaceFixture();
    for (const page of readManualSourcePages(contentDir)) {
      writeFile(
        path.join(outputDir, `${page.slug}.html`),
        validManualHtml(page.title, page.sourceDigest)
      );
    }

    const report = validateManualOutput({
      contentDir,
      outputDir,
      expectedVersion: '9.9.9',
    });

    expect(report.slugs).toEqual(['advanced-settings', 'index']);
    expect(report.htmlFiles).toEqual(['advanced-settings.html', 'index.html']);
  });

  it('rejects missing, stale, unmarked, mistitled, and app-shell pages together', () => {
    const { contentDir, outputDir } = createWorkspaceFixture();
    writeFile(
      path.join(outputDir, 'index.html'),
      '<!doctype html><html><head><title>Opentu 开图</title></head><body><div id="root"></div></body></html>'
    );
    writeFile(
      path.join(outputDir, 'stale.html'),
      validManualHtml('过期页面', 'unused-stale-digest')
    );

    expect(() => validateManualOutput({ contentDir, outputDir })).toThrowError(
      ManualIntegrityError
    );

    try {
      validateManualOutput({ contentDir, outputDir });
    } catch (error) {
      const codes = (error as ManualIntegrityError).issues.map(
        (issue) => issue.code
      );
      expect(codes).toEqual(
        expect.arrayContaining([
          'output-page-missing',
          'output-page-unexpected',
          'output-title-mismatch',
          'output-marker-missing',
          'output-app-shell',
        ])
      );
    }
  });

  it('rejects different source paths that collapse to the same slug', () => {
    const { contentDir } = createWorkspaceFixture();
    createSourcePage(contentDir, 'a-b.mdx', '页面 A');
    createSourcePage(contentDir, 'a/b.mdx', '页面 B');

    expect(() => readManualSourcePages(contentDir)).toThrowError(
      /both map to a-b\.html/
    );
  });

  it('rejects output from stale MDX content or another app version', () => {
    const { contentDir, outputDir } = createWorkspaceFixture();
    for (const page of readManualSourcePages(contentDir)) {
      writeFile(
        path.join(outputDir, `${page.slug}.html`),
        validManualHtml(page.title, page.sourceDigest)
      );
    }

    writeFile(
      path.join(contentDir, 'advanced', 'settings.mdx'),
      `---\ntitle: 设置与配置\ncategory: advanced\norder: 1\n---\n\n正文已经更新。\n`
    );

    try {
      validateManualOutput({
        contentDir,
        outputDir,
        expectedVersion: '10.0.0',
      });
      throw new Error('Expected stale output validation to fail');
    } catch (error) {
      const codes = (error as ManualIntegrityError).issues.map(
        (issue) => issue.code
      );
      expect(codes).toContain('output-source-digest-mismatch');
      expect(codes).toContain('output-version-mismatch');
    }
  });

  it('rejects missing screenshots once a generated resource set exists', () => {
    const { contentDir, outputDir } = createWorkspaceFixture();
    for (const page of readManualSourcePages(contentDir)) {
      const screenshot =
        page.slug === 'index'
          ? '<img src="screenshots/missing.png" alt="missing" />'
          : '';
      writeFile(
        path.join(outputDir, `${page.slug}.html`),
        validManualHtml(page.title, page.sourceDigest).replace(
          '</main>',
          `${screenshot}</main>`
        )
      );
    }
    writeFile(path.join(outputDir, 'screenshots', 'existing.png'), 'png');

    try {
      validateManualOutput({ contentDir, outputDir });
      throw new Error('Expected missing resource validation to fail');
    } catch (error) {
      const codes = (error as ManualIntegrityError).issues.map(
        (issue) => issue.code
      );
      expect(codes).toContain('output-resource-missing');
    }
  });
});

describe('atomic user manual generation', () => {
  it('falls back to copy-and-remove when Docker overlayfs rejects rename', () => {
    const parentDir = createTemporaryDirectory();
    const outputDir = path.join(parentDir, 'user-manual');
    const stagingDir = path.join(parentDir, '.user-manual.staging-test');
    writeFile(path.join(outputDir, 'old.html'), 'old');
    writeFile(path.join(stagingDir, 'index.html'), 'new');
    const crossDeviceRename: typeof fs.renameSync = () => {
      throw Object.assign(new Error('cross-device link'), { code: 'EXDEV' });
    };

    replaceOutputDirectory(stagingDir, outputDir, crossDeviceRename);

    expect(fs.existsSync(stagingDir)).toBe(false);
    expect(fs.existsSync(path.join(outputDir, 'old.html'))).toBe(false);
    expect(fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8')).toBe(
      'new'
    );
    expect(
      fs
        .readdirSync(parentDir)
        .some((name) => name.startsWith('.user-manual.backup-'))
    ).toBe(false);
  });

  it('replaces only after validation, drops stale HTML, and preserves media resources', async () => {
    const { workspaceRoot, contentDir, outputDir } = createWorkspaceFixture();
    writeFile(path.join(outputDir, 'index.html'), 'old manual');
    writeFile(path.join(outputDir, 'stale.html'), 'stale manual');
    writeFile(path.join(outputDir, 'screenshots', 'kept.png'), 'png-content');
    writeFile(path.join(outputDir, 'gifs', 'kept.gif'), 'gif-content');

    const result = await generateManual({ workspaceRoot, outputDir });

    expect(result.pageCount).toBe(2);
    expect(fs.existsSync(path.join(outputDir, 'stale.html'))).toBe(false);
    expect(
      fs.readFileSync(path.join(outputDir, 'screenshots', 'kept.png'), 'utf8')
    ).toBe('png-content');
    expect(
      fs.readFileSync(path.join(outputDir, 'gifs', 'kept.gif'), 'utf8')
    ).toBe('gif-content');
    expect(
      validateManualOutput({ contentDir, outputDir }).htmlFiles
    ).toHaveLength(2);
  });

  it('keeps the previous complete output when a post-render resource step fails', async () => {
    const { workspaceRoot, outputDir } = createWorkspaceFixture({
      brokenScreenshotSource: true,
    });
    writeFile(path.join(outputDir, 'index.html'), 'known-good-old-output');

    await expect(
      generateManual({ workspaceRoot, outputDir })
    ).rejects.toThrow();

    expect(fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8')).toBe(
      'known-good-old-output'
    );
    expect(
      fs
        .readdirSync(path.dirname(outputDir))
        .some((name) => name.startsWith('.generated-manual.staging-'))
    ).toBe(false);
  });

  it('turns an asynchronous generator rejection into a non-zero CLI result', async () => {
    const logger = { error: vi.fn() };

    const exitCode = await runGenerateManualCli(async () => {
      await Promise.resolve();
      throw new Error('async generation failure');
    }, logger);

    expect(exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      '❌ 用户手册生成失败:',
      expect.objectContaining({ message: 'async generation failure' })
    );
  });
});

describe('verify-user-manual CLI contract', () => {
  it('supports an explicit output directory and returns stable exit codes', () => {
    const { workspaceRoot, contentDir, outputDir } = createWorkspaceFixture();
    for (const page of readManualSourcePages(contentDir)) {
      writeFile(
        path.join(outputDir, `${page.slug}.html`),
        validManualHtml(page.title, page.sourceDigest)
      );
    }
    const logger = { log: vi.fn(), error: vi.fn() };

    const parsed = parseVerifyUserManualArgs(
      ['--', '--output-dir', 'generated-manual'],
      workspaceRoot
    );
    expect(parsed.outputDir).toBe(outputDir);

    expect(
      runVerifyUserManualCli(
        [
          '--content-dir',
          path.relative(workspaceRoot, contentDir),
          '--output-dir',
          path.relative(workspaceRoot, outputDir),
        ],
        workspaceRoot,
        logger
      )
    ).toBe(0);
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('2 pages'));

    expect(
      runVerifyUserManualCli(
        ['--content-dir', path.relative(workspaceRoot, contentDir)],
        workspaceRoot,
        logger
      )
    ).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('user manual entry links', () => {
  it('resolves app and landing-page links inside the deployed version scope', () => {
    const entryFiles = [
      {
        source: 'apps/web/index.html',
        deployedUrl: 'https://opentu.test/1.0.2/index.html',
      },
      {
        source: 'apps/web/public/home.html',
        deployedUrl: 'https://opentu.test/1.0.2/home.html',
      },
      {
        source: 'apps/web/public/en/home.html',
        deployedUrl: 'https://opentu.test/1.0.2/en/home.html',
      },
    ];

    for (const entryFile of entryFiles) {
      const html = fs.readFileSync(
        path.join(process.cwd(), entryFile.source),
        'utf8'
      );
      const manualLinks = Array.from(
        html.matchAll(/href="([^"]*user-manual\/[^"]+)"/g),
        (match) => match[1]
      );

      expect(manualLinks.length).toBeGreaterThan(0);
      expect(html).not.toMatch(/href="\/user-manual\//);
      for (const manualLink of manualLinks) {
        expect(new URL(manualLink, entryFile.deployedUrl).pathname).toMatch(
          /^\/1\.0\.2\/user-manual\//
        );
      }
    }
  });
});

describe('user manual build and release wiring', () => {
  it('runs the manual contract before standard web serve and build', () => {
    const project = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'apps/web/project.json'), 'utf8')
    ) as {
      targets: Record<
        string,
        {
          cache?: boolean;
          dependsOn?: string[];
          options?: { command?: string };
        }
      >;
    };

    expect(project.targets['build-manual'].cache).toBe(false);
    expect(project.targets['build-manual'].options?.command).toBe(
      'pnpm run manual:build'
    );
    expect(project.targets['serve-app'].dependsOn).toContain('build-manual');
    expect(project.targets['build-app'].dependsOn).toContain('build-manual');
  });

  it('does not silently skip or mis-forward release verification', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    ) as { scripts: Record<string, string> };
    const deployScript = fs.readFileSync(
      path.join(process.cwd(), 'scripts/deploy-hybrid.js'),
      'utf8'
    );

    expect(packageJson.scripts.release).not.toContain('--skip-manual');
    expect(packageJson.scripts['release:retry']).not.toContain('--skip-manual');
    expect(deployScript).not.toContain('manual:verify -- --output-dir');
    expect(deployScript).toContain(
      'manual:verify --output-dir dist/apps/web/user-manual'
    );
    expect(deployScript).toContain(
      'manual:verify --output-dir dist/deploy/server/user-manual'
    );
  });
});
