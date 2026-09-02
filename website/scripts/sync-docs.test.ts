import { describe, expect, test } from 'bun:test'
import { EXCLUDED, PAGES, type Page } from '../pages'
import {
  frontmatter,
  rewriteLinks,
  splitTitle,
  stripHeadingEmoji,
  stripLeadingEmoji,
  transform,
  unmapped,
} from './sync-docs'

const base = '/react-native-nitro-h3'
const pageFor = (route: string): Page => {
  const page = PAGES.find((entry) => entry.route === route)
  if (!page) throw new Error(`no page for ${route}`)
  return page
}
const perf = pageFor('/performance/')
const api = pageFor('/api/')
const concept = pageFor('/concepts/cells-and-bigint/')

describe('splitTitle', () => {
  test('takes the first H1 and removes it from the body', () => {
    const { title, body } = splitTitle('# 🧮 Performance Guide\n\n> intro\n\n## Section\n')
    expect(title).toBe('🧮 Performance Guide')
    expect(body).toBe('> intro\n\n## Section\n')
  })

  test('ignores a `#` inside a fenced block', () => {
    const { title } = splitTitle('# Title\n\n```sh\n# a comment\n```\n')
    expect(title).toBe('Title')
  })

  test('throws without an H1', () => {
    expect(() => splitTitle('## Only H2\n')).toThrow(/no H1/)
  })

  test('throws on a second H1', () => {
    expect(() => splitTitle('# One\n\n# Two\n')).toThrow(/second H1/)
  })
})

describe('stripLeadingEmoji', () => {
  test('removes one leading emoji and the space after it', () => {
    expect(stripLeadingEmoji('🧮 Performance Guide')).toBe('Performance Guide')
    expect(stripLeadingEmoji('🛡️ Errors and memory safety')).toBe('Errors and memory safety')
  })

  test('leaves a plain title alone', () => {
    expect(stripLeadingEmoji('API reference')).toBe('API reference')
  })
})

describe('stripHeadingEmoji', () => {
  test('strips the emoji from a heading of any level', () => {
    expect(stripHeadingEmoji('## 📦 Installation')).toBe('## Installation')
    expect(stripHeadingEmoji('### 🔬 Methodology')).toBe('### Methodology')
  })

  test('leaves a heading without an emoji alone', () => {
    expect(stripHeadingEmoji('## Next steps')).toBe('## Next steps')
  })

  test('does not touch a heading-shaped line inside a fenced block', () => {
    const text = '```sh\n# 📦 install the package\n```\n'
    expect(stripHeadingEmoji(text)).toBe(text)
  })

  test('leaves an emoji outside a heading alone', () => {
    const text = '| ✅ supported | yes |\n\n> 💡 A tip.\n'
    expect(stripHeadingEmoji(text)).toBe(text)
  })
})

describe('rewriteLinks', () => {
  test('maps a sibling docs link to its route and keeps the anchor', () => {
    const out = rewriteLinks('see [x](benchmark.md#the-size-ledger)', perf, base)
    expect(out).toBe('see [x](/react-native-nitro-h3/benchmark/#the-size-ledger)')
  })

  test('maps a ./ and a ../ link from a nested page', () => {
    const out = rewriteLinks(
      '[a](../performance.md) [b](./typed-arrays-and-batch.md)',
      concept,
      base,
    )
    expect(out).toBe(
      '[a](/react-native-nitro-h3/performance/) [b](/react-native-nitro-h3/concepts/typed-arrays-and-batch/)',
    )
  })

  test('maps the api.md path to /api/', () => {
    const out = rewriteLinks(
      '[api](../packages/react-native-nitro-h3/docs/api.md#h3error)',
      perf,
      base,
    )
    expect(out).toBe('[api](/react-native-nitro-h3/api/#h3error)')
  })

  test('rewrites an image under img/ to the public path', () => {
    const out = rewriteLinks('![chart](../img/benchmark.svg)', perf, base)
    expect(out).toBe('![chart](/react-native-nitro-h3/img/benchmark.svg)')
  })

  test('sends an unmapped repository file to GitHub', () => {
    const out = rewriteLinks(
      '[c](../CONTRIBUTING.md) [r](releasing.md#quick-release-checklist)',
      perf,
      base,
    )
    expect(out).toBe(
      '[c](https://github.com/vgorte/react-native-nitro-h3/blob/main/CONTRIBUTING.md) [r](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/releasing.md#quick-release-checklist)',
    )
  })

  test('leaves absolute URLs and in-page anchors alone', () => {
    const text = '[h3](https://h3geo.org/) [top](#indexing) <https://example.com>'
    expect(rewriteLinks(text, perf, base)).toBe(text)
  })

  test('does not touch a fenced block', () => {
    const text = '```ts\nconst x = "[a](b.md)"\n```\n'
    expect(rewriteLinks(text, perf, base)).toBe(text)
  })
})

describe('frontmatter', () => {
  test('writes title, description, editUrl and lastUpdated', () => {
    const out = frontmatter(perf, 'Performance Guide', '2026-09-01T10:00:00+02:00')
    expect(out).toBe(
      [
        '---',
        'title: "Performance Guide"',
        `description: ${JSON.stringify(perf.description)}`,
        'editUrl: "https://github.com/vgorte/react-native-nitro-h3/edit/main/docs/performance.md"',
        'lastUpdated: 2026-09-01T10:00:00+02:00',
        '---',
        '',
      ].join('\n'),
    )
  })

  test('omits lastUpdated when the source has no history yet', () => {
    expect(frontmatter(perf, 'Performance Guide', null)).not.toContain('lastUpdated')
  })

  test('a generated page has no edit link and a two-level table of contents', () => {
    const out = frontmatter(api, 'API reference', null)
    expect(out).toContain('editUrl: false')
    expect(out).toContain('tableOfContents:\n  minHeadingLevel: 2\n  maxHeadingLevel: 2')
  })
})

describe('transform', () => {
  test('produces frontmatter followed by the body without the H1', () => {
    const out = transform('# 🧮 Performance Guide\n\nSee [b](benchmark.md).\n', perf, base, null)
    expect(out.startsWith('---\ntitle: "Performance Guide"\n')).toBe(true)
    expect(out.endsWith('---\n\nSee [b](/react-native-nitro-h3/benchmark/).\n')).toBe(true)
  })

  test('strips the emoji from the body headings too', () => {
    const out = transform('# 🧮 Performance Guide\n\n## 📦 Installation\n', perf, base, null)
    expect(out.endsWith('---\n\n## Installation\n')).toBe(true)
  })

  test('refuses GitHub alert syntax', () => {
    expect(() => transform('# T\n\n> [!NOTE]\n> x\n', perf, base, null)).toThrow(/\[!NOTE\]/)
  })
})

describe('unmapped', () => {
  test('does not return a mapped source', () => {
    expect(unmapped(['docs/performance.md'], PAGES, EXCLUDED)).toEqual([])
  })

  test('does not return a file excluded by name or by directory prefix', () => {
    expect(unmapped(['docs/releasing.md', 'docs/superpowers/plan.md'], PAGES, EXCLUDED)).toEqual([])
  })

  test('returns a docs file that is neither mapped nor excluded', () => {
    expect(unmapped(['docs/stray.md'], PAGES, EXCLUDED)).toEqual(['docs/stray.md'])
  })
})
