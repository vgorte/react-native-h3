/**
 * Generates `packages/react-native-h3/docs/api.md` from the package's public TypeScript sources.
 *
 * Every entry is rendered from the same JSDoc the editor shows, so the reference and the tooltips
 * cannot disagree. `src/index.ts` is the definition of public: a declaration the barrel does not
 * re-export never reaches the page.
 *
 * Usage:
 *   bun run docs:api           rewrite `packages/react-native-h3/docs/api.md`
 *   bun run docs:api --check   fail if `packages/react-native-h3/docs/api.md` is out of date
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'packages', 'react-native-h3', 'src')
const BARREL = join(SRC, 'index.ts')
const OUT = join(HERE, '..', 'packages', 'react-native-h3', 'docs', 'api.md')

/** Section title per source file; a file that is not listed is title-cased. */
const TITLES: Record<string, string> = {
  H3Error: 'Errors',
  async: 'Async variants',
  configure: 'Configuration',
  edges: 'Directed edges',
  hierarchy: 'Hierarchy',
  indexing: 'Indexing',
  inspection: 'Inspection',
  measurement: 'Measurement',
  misc: 'Miscellaneous',
  regions: 'Regions',
  traversal: 'Traversal',
  types: 'Types',
  units: 'Angle conversion',
  vertexes: 'Vertexes',
}

interface Entry {
  name: string
  signature: string
  doc: string
}

function titleOf(base: string): string {
  const known = TITLES[base]
  if (known != null) {
    return known
  }
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** Collects the local names `src/index.ts` re-exports, which is the whole public surface. */
function publicNames(barrel: string): Set<string> {
  const source = ts.createSourceFile('index.ts', barrel, ts.ScriptTarget.Latest, true)
  const names = new Set<string>()

  source.forEachChild((node) => {
    if (!ts.isExportDeclaration(node) || node.exportClause == null) {
      return
    }
    if (!ts.isNamedExports(node.exportClause)) {
      return
    }
    for (const element of node.exportClause.elements) {
      // `propertyName` is the local name in `export { local as exported }`
      names.add((element.propertyName ?? element.name).text)
    }
  })

  return names
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false
}

function docOf(code: string, node: ts.Node): string {
  const ranges = ts.getLeadingCommentRanges(code, node.getFullStart()) ?? []
  const block = ranges.filter((range) => code.slice(range.pos, range.pos + 3) === '/**').pop()
  if (block == null) {
    return ''
  }
  return code
    .slice(block.pos + 3, block.end - 2)
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
    .join('\n')
    .trim()
}

function signatureOf(
  code: string,
  node: ts.Node,
  source: ts.SourceFile,
  bodyStart?: number,
): string {
  const end = bodyStart ?? node.getEnd()
  return code
    .slice(node.getStart(source), end)
    .replace(/^export\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function entriesOf(code: string, fileName: string, publicApi: ReadonlySet<string>): Entry[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true)
  const entries: Entry[] = []

  const push = (name: string, signature: string, node: ts.Node): void => {
    if (!publicApi.has(name)) {
      return
    }
    entries.push({ name, signature, doc: docOf(code, node) })
  }

  source.forEachChild((node) => {
    if (!isExported(node)) {
      return
    }
    if (ts.isFunctionDeclaration(node) && node.name != null) {
      push(node.name.text, signatureOf(code, node, source, node.body?.getStart(source)), node)
      return
    }
    if (ts.isClassDeclaration(node) && node.name != null) {
      const members = node.members.map((member) => member.getText(source)).join('\n  ')
      push(node.name.text, `class ${node.name.text} {\n  ${members}\n}`, node)
      return
    }
    if (
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) {
      push(node.name.text, node.getText(source).replace(/^export\s+/, ''), node)
      return
    }
    // `ContainmentMode` is a frozen const, which none of the branches above reach
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          push(declaration.name.text, node.getText(source).replace(/^export\s+/, ''), node)
        }
      }
    }
  })

  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

async function render(): Promise<string> {
  const publicApi = publicNames(await readFile(BARREL, 'utf8'))
  // filename order, so the check compares like with like on every machine
  const files = (await readdir(SRC)).filter((file) => file.endsWith('.ts')).sort()

  const lines: string[] = [
    '# API reference',
    '',
    '<!-- Generated by `scripts/gen-api-docs.ts`. Do not edit by hand; edit the JSDoc in',
    '     `packages/react-native-h3/src` and run `bun run docs:api`. -->',
    '',
    'Every function throws [`H3Error`](#h3error) on failure. Cells are `bigint`; cell sets are',
    '`BigUint64Array` views over the buffer C++ produced, containing only real cells.',
    '',
  ]

  let count = 0
  for (const file of files) {
    const code = await readFile(join(SRC, file), 'utf8')
    const entries = entriesOf(code, file, publicApi)
    if (entries.length === 0) {
      continue
    }
    lines.push(`## ${titleOf(file.replace(/\.ts$/, ''))}`, '')
    for (const entry of entries) {
      count += 1
      lines.push(`### ${entry.name}`, '', '```ts', entry.signature, '```', '')
      if (entry.doc !== '') {
        lines.push(entry.doc, '')
      }
    }
  }

  lines.push(`<!-- ${count} exported symbols -->`, '')
  return lines.join('\n')
}

async function main(): Promise<void> {
  const rendered = await render()
  if (process.argv.includes('--check')) {
    const current = await readFile(OUT, 'utf8').catch(() => '')
    if (current !== rendered) {
      process.stderr.write(
        'packages/react-native-h3/docs/api.md is out of date; run `bun run docs:api`\n',
      )
      process.exit(1)
    }
    process.stdout.write('packages/react-native-h3/docs/api.md is up to date\n')
    return
  }
  await writeFile(OUT, rendered)
  process.stdout.write(`Wrote ${OUT}\n`)
}

await main()
