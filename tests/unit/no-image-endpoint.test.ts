import { it, expect } from 'vitest';
import { GET } from '../../src/lib/no-image-endpoint';

it('the on-request picture address answers "not found", whatever is asked of it', () => {
  const response = GET();
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toContain('max-age');
});
