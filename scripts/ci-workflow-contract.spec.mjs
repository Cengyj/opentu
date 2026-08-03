import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const workflow = load(
  readFileSync(path.join(workspaceRoot, '.github/workflows/ci.yml'), 'utf8')
);
const jobs = workflow.jobs;

function findStep(job, name) {
  return job.steps.find((step) => step.name === name);
}

describe('CI workflow contract', () => {
  it('reports quality and production compilation independently', () => {
    expect(Object.keys(jobs).sort()).toEqual([
      'main',
      'quality',
      'release-e2e',
      'smoke',
    ]);
    expect(jobs.quality.needs).toBeUndefined();
    expect(jobs.main.needs).toBeUndefined();
    expect(jobs.smoke.needs).toBe('main');

    expect(findStep(jobs.main, 'Build web production artifact').run).toBe(
      'pnpm build:web'
    );
    expect(
      jobs.main.steps.some((step) =>
        /playwright|smoke|visual/i.test(`${step.name || ''} ${step.run || ''}`)
      )
    ).toBe(false);
  });

  it('keeps the production artifact stable across partial reruns', () => {
    const upload = findStep(jobs.main, 'Upload production web artifact');
    const download = findStep(jobs.smoke, 'Download production web artifact');

    expect(upload.uses).toBe('actions/upload-artifact@v6');
    expect(upload.with.name).toBe('web-production-${{ github.run_id }}');
    expect(upload.with.overwrite).toBe(true);
    expect(upload.with['if-no-files-found']).toBe('error');
    expect(download.uses).toBe('actions/download-artifact@v6');
    expect(download.with.name).toBe(upload.with.name);
    expect(download.with.path).toBe('dist/apps/web');
  });

  it('executes browser checks against the downloaded production artifact', () => {
    expect(jobs.smoke.env.NX_SKIP_NX_CACHE).toBe('true');
    expect(jobs.smoke.env.PLAYWRIGHT_WEB_SERVER_COMMAND).toContain(
      'web:preview'
    );
    expect(jobs.smoke.env.PLAYWRIGHT_WEB_SERVER_COMMAND).not.toContain(
      'serve web'
    );
    expect(
      findStep(jobs.smoke, 'Verify downloaded artifact release identity')
        .run
    ).toContain('--expected-release-id "${{ github.sha }}"');
    expect(findStep(jobs.smoke, 'Run production artifact smoke tests').run).toBe(
      'pnpm run e2e:smoke'
    );
  });
});
