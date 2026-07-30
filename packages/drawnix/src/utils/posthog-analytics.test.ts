/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analytics } from './posthog-analytics';

describe('prompt analytics privacy', () => {
  const capture = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    capture.mockReset();
    window.posthog = { capture };
  });

  afterEach(() => {
    delete window.posthog;
    vi.useRealTimers();
  });

  it('reports prompt and requirement summaries without raw text', () => {
    const prompt = '仅用于隐私回归的原始提示词\n第二行';
    const requirements = '不得发送这段需求原文';

    analytics.trackPromptAction({
      action: 'copy',
      surface: 'prompt_history_tool',
      promptType: 'text',
      prompt,
      requirements,
      metadata: { record_status: 'completed' },
    });
    vi.runAllTimers();

    expect(capture).toHaveBeenCalledTimes(1);
    const [eventName, properties] = capture.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(eventName).toBe('prompt_action');
    expect(properties).toMatchObject({
      action: 'copy',
      surface: 'prompt_history_tool',
      promptType: 'text',
      has_prompt: true,
      prompt_length: prompt.length,
      prompt_line_count: 2,
      has_requirements: true,
      requirements_length: requirements.length,
      requirements_line_count: 1,
      metadata: { record_status: 'completed' },
    });
    expect(properties).not.toHaveProperty('prompt');
    expect(properties).not.toHaveProperty('requirements');
    expect(JSON.stringify(properties)).not.toContain(prompt);
    expect(JSON.stringify(properties)).not.toContain(requirements);
  });
});
