import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// Vitest globals are disabled, so Testing Library cannot register its own auto-cleanup.
// Without this, mounted components/hooks leak between tests (e.g. a live session keeps reconnecting).
afterEach(() => cleanup());
