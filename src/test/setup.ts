// Core
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// --- localStorage (jsdom's implementation here is incomplete) -------------
const createLocalStorage = (): Storage => {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear: () => {
      store = {};
    },
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: createLocalStorage(),
});

// Unmount React trees and clear localStorage between tests for isolation.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// --- requestAnimationFrame (used by SemiCircularProgress) ----------------
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame;
}

// --- matchMedia (used by useThemeMode) -----------------------------------
// Set each test (jsdom's stub is non-functional and `restoreMocks` resets it).
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

// --- Object URLs (used by the keep-alive/silent track) -------------------
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}

// --- HTMLMediaElement playback (jsdom has no media stack) -----------------
// Reapplied each test because `restoreMocks` strips the implementation.
beforeEach(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    writable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

// --- Web Audio mock ------------------------------------------------------
// Records created buffer sources so audio scheduling can be asserted.
export type MockBufferSource = {
  buffer: unknown;
  connected: boolean;
  startedAt: number | null;
  stopped: boolean;
  connect: (node: unknown) => unknown;
  disconnect: () => void;
  start: (when?: number) => void;
  stop: () => void;
};

export class MockAudioContext {
  static instances: MockAudioContext[] = [];

  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  destination = {};
  sources: MockBufferSource[] = [];

  constructor() {
    MockAudioContext.instances.push(this);
  }

  resume = vi.fn(async () => {
    this.state = 'running';
  });

  close = vi.fn(async () => {
    this.state = 'closed';
  });

  decodeAudioData = vi.fn(async () => ({ duration: 0.1 }) as unknown as AudioBuffer);

  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: (node: unknown) => node,
    disconnect: vi.fn(),
  }));

  createMediaElementSource = vi.fn(() => ({
    connect: (node: unknown) => node,
    disconnect: vi.fn(),
  }));

  createBufferSource = vi.fn((): MockBufferSource => {
    const source: MockBufferSource = {
      buffer: null,
      connected: false,
      startedAt: null,
      stopped: false,
      connect(node: unknown) {
        this.connected = true;
        return node;
      },
      disconnect() {
        this.connected = false;
      },
      start(when = 0) {
        this.startedAt = when;
      },
      stop() {
        this.stopped = true;
      },
    };
    this.sources.push(source);
    return source;
  });
}

beforeEach(() => {
  MockAudioContext.instances = [];
});

Object.defineProperty(window, 'AudioContext', {
  configurable: true,
  writable: true,
  value: MockAudioContext,
});
Object.defineProperty(window, 'webkitAudioContext', {
  configurable: true,
  writable: true,
  value: MockAudioContext,
});

// --- fetch (sound assets) ------------------------------------------------
// Unconditionally mocked: Node ships a native fetch that would otherwise try to
// hit the (non-existent) dev server for sound assets.
beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch;
});

