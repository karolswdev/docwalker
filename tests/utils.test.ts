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

describe('normaliseMammothHtml', () => {
  it('flattens table cell paragraphs and removes empties', () => {
    const html =
      '<table><tr><td><p>Heading</p></td><td><p>Value</p><p></p></td></tr><tr><td><p></p></td><td><p>Another</p></td></tr></table>';
    const normalised = __internal.normaliseMammothHtml(html);
    expect(normalised).toBe('<table><tr><td>Heading</td><td>Value</td></tr><tr><td></td><td>Another</td></tr></table>');
  });

  it('converts non-breaking spaces to regular spaces', () => {
    const html = '<p>&nbsp;</p><p>Foo&nbsp;Bar</p>';
    const normalised = __internal.normaliseMammothHtml(html);
    expect(normalised).toBe('<p>Foo Bar</p>');
  });
});
