import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollTo = vi.fn();
}

// Mock IntersectionObserver
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}));

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

// Mock ResizeObserver
class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

// Mock CSS.supports
Object.defineProperty(global, "CSS", {
  value: {
    supports: vi.fn().mockReturnValue(true),
  },
  writable: true,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "CSS", {
    value: {
      supports: vi.fn().mockReturnValue(true),
    },
    writable: true,
  });
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

// Mock Supabase environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";
