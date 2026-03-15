import { describe, it, expect, vi } from 'vitest';

const mockSetupAudio = vi.fn();

vi.mock('../lib/setup-audio.js', () => ({
  setupAudio: (...args: unknown[]) => mockSetupAudio(...args),
}));

const { setupAudioCommand } = await import('./setup-audio.js');

describe('setupAudioCommand', () => {
  it('is named setup-audio', () => {
    expect(setupAudioCommand.name()).toBe('setup-audio');
  });

  it('has a description', () => {
    expect(setupAudioCommand.description()).toMatch(/audio/i);
  });
});
