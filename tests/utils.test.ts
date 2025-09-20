import { describe, expect, it } from 'vitest';
import { __internal } from '../src/lib/converter.js';

describe('slugify', () => {
  it('normalises whitespace and punctuation', () => {
    expect(__internal.slugify('My Fancy DOCX Title!!!')).toBe('my-fancy-docx-title');
  });

  it('falls back to document when empty', () => {
    expect(__internal.slugify('')).toBe('document');
  });
});

describe('toPosix', () => {
  it('replaces platform separators with forward slashes', () => {
    expect(__internal.toPosix('foo\\bar/baz')).toBe('foo/bar/baz');
  });
});

describe('buildFrontMatter', () => {
  it('escapes yaml-sensitive characters', () => {
    const frontMatter = __internal.buildFrontMatter({
      title: 'A "quote"',
      source: 'docs/report "alpha".docx',
      converted: '2024-01-01T00:00:00.000Z'
    });
    expect(frontMatter).toBe(
      '---\n' +
        'title: "A \\"quote\\""\n' +
        'source: "docs/report \\"alpha\\".docx"\n' +
        'converted: "2024-01-01T00:00:00.000Z"\n' +
        '---'
    );
  });
});
