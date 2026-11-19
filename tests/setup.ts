import { vi } from "vitest";

// Next.js enforces this import at bundle time; Node tests run outside React's loader.
vi.mock("server-only", () => ({}));
