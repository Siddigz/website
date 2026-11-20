import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/*
 * The global stylesheets must not use CSS nesting. A browser without nesting
 * drops the nested declarations, and for the colour tokens that leaves dark
 * text on a dark background (Safari 15.4 to 16.4).
 */
function nestedRules(css: string): string[] {
  const found: string[] = [];
  const stack: ('at' | 'style')[] = [];
  let prelude = '';
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      const kind = prelude.trim().startsWith('@') ? 'at' : 'style';
      if (stack.includes('style')) found.push(prelude.trim());
      stack.push(kind);
      prelude = '';
    } else if (char === '}') {
      stack.pop();
      prelude = '';
    } else if (char === ';') {
      prelude = '';
    } else {
      prelude += char;
    }
  }
  return found;
}

describe('global stylesheets', () => {
  it.each([
    'src/styles/tokens.css',
    'src/styles/base.css',
    'src/styles/looks/crisp.css',
    'src/styles/looks/warm.css',
    'src/styles/looks/editorial.css',
  ])('%s uses no nesting', (path) => {
    expect(nestedRules(readFileSync(path, 'utf8'))).toEqual([]);
  });

  it('the nesting check itself catches nested rules', () => {
    expect(nestedRules(':root { color: red; @media (x) { color: blue; } }')).toEqual(['@media (x)']);
    expect(nestedRules('.a { .b { color: red; } }')).toEqual(['.b']);
    expect(nestedRules('@media (x) { .a { color: red; } } .b { color: blue; }')).toEqual([]);
  });
});
