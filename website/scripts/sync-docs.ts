import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE, EXCLUDED, PAGES, type Page, REPO } from '../pages'

const WEBSITE = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = dirname(WEBSITE)
const CONTENT = join(WEBSITE, 'src', 'content', 'docs')
const FENCE = /^(```|~~~)/

/** Returns the H1 text and the body without it. Exactly one H1 outside fenced blocks is required. */
export function splitTitle(markdown: string): { title: string; body: string } {
  const lines = markdown.split('\n')
  let inFence = false
  let title = ''
  let titleIndex = -1
  for (const [index, line] of lines.entries()) {
    if (FENCE.test(line)) inFence = !inFence
    if (inFence || !line.startsWith('# ')) continue
    if (titleIndex !== -1) throw new Error(`second H1 at line ${index + 1}: ${line}`)
    title = line.slice(2).trim()
    titleIndex = index
  }
  if (titleIndex === -1) throw new Error('no H1 found')
  const rest = lines.filter((_, index) => index !== titleIndex)
  // The H1 is followed by one blank line in every source; drop it so the body starts on content.
  if (rest[titleIndex] === '') rest.splice(titleIndex, 1)
  return { title, body: rest.join('\n') }
}

/** Drops one leading emoji (with its variation selector) and the space after it. */
export function stripLeadingEmoji(title: string): string {
  return title.replace(/^(?:\p{Extended_Pictographic}|\u{FE0F}|\u{200D})+\s*/u, '')
}

/**
 * Rewrites every relative link and image to a base-prefixed route or public path. Astro emits
 * Markdown links verbatim, so a `./x.md` link would 404 on the site.
 */
export function rewriteLinks(body: string, page: Page, base: string): string {
  const sourceDir = posix.dirname(page.source)
  const routes = new Map(PAGES.map((entry) => [entry.source, entry.route]))
  const rewrite = (target: string): string => {
    if (/^(https?:|mailto:|#)/.test(target)) return target
    const [path, anchor] = target.split('#', 2)
    const suffix = anchor ? `#${anchor}` : ''
    const repoPath = posix.normalize(posix.join(sourceDir, path ?? ''))
    if (repoPath.startsWith('img/')) return `${base}/${repoPath}`
    const route = routes.get(repoPath)
    if (route) return `${base}${route}${suffix}`
    return `${REPO}/blob/main/${repoPath}${suffix}`
  }
  // Fenced blocks are skipped line by line, so a link-shaped string in code stays as written.
  let inFence = false
  return body
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) inFence = !inFence
      if (inFence) return line
      return line.replace(/\]\(([^)\s]+)\)/g, (_, target: string) => `](${rewrite(target)})`)
    })
    .join('\n')
}

/** Writes the YAML block Starlight needs. Values go through `JSON.stringify`, which is valid YAML. */
export function frontmatter(page: Page, title: string, lastUpdated: string | null): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(page.description)}`,
  ]
  if (page.generated) {
    lines.push('editUrl: false', 'tableOfContents:', '  minHeadingLevel: 2', '  maxHeadingLevel: 2')
  } else {
    lines.push(`editUrl: ${JSON.stringify(`${REPO}/edit/main/${page.source}`)}`)
  }
  if (lastUpdated) lines.push(`lastUpdated: ${lastUpdated}`)
  lines.push('---', '')
  return lines.join('\n')
}

/** Returns the frontmatter followed by the rewritten body. */
export function transform(
  markdown: string,
  page: Page,
  base: string,
  lastUpdated: string | null,
): string {
  const alert = markdown.match(/^> \[!\w+\]/m)
  if (alert) throw new Error(`${page.source} uses ${alert[0]}, which Starlight renders literally`)
  const { title, body } = splitTitle(markdown)
  return `${frontmatter(page, stripLeadingEmoji(title), lastUpdated)}\n${rewriteLinks(body, page, base)}`
}

function lastCommitDate(source: string): string | null {
  const result = Bun.spawnSync(['git', 'log', '-1', '--format=%cI', '--', source], { cwd: ROOT })
  const date = result.stdout.toString().trim()
  return date === '' ? null : date
}

/**
 * Returns the files that are neither a mapped `source` nor excluded. A trailing-slash entry in
 * `excluded` matches by prefix, every other entry by equality.
 */
export function unmapped(
  files: readonly string[],
  pages: readonly Page[],
  excluded: readonly string[],
): string[] {
  const mapped = new Set(pages.map((page) => page.source))
  const isExcluded = (file: string): boolean =>
    excluded.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry))
  return files.filter((file) => !mapped.has(file) && !isExcluded(file))
}

async function main() {
  // The gate runs first so a docs file nobody mapped leaves the generated tree as it was.
  const files: string[] = []
  for await (const file of new Bun.Glob('docs/**/*.md').scan({ cwd: ROOT })) files.push(file)
  const missing = unmapped(files, PAGES, EXCLUDED)
  if (missing.length > 0) {
    throw new Error(`not mapped in website/pages.ts and not excluded: ${missing.join(', ')}`)
  }

  await mkdir(CONTENT, { recursive: true })
  // The landing page is written by hand and lives in the same tree, so only generated pages go.
  for (const entry of await readdir(CONTENT)) {
    if (entry !== 'index.mdx') await rm(join(CONTENT, entry), { recursive: true, force: true })
  }
  for (const page of PAGES) {
    const sourcePath = join(ROOT, page.source)
    if (!existsSync(sourcePath)) throw new Error(`${page.source} does not exist`)
    const markdown = await readFile(sourcePath, 'utf8')
    const out = join(CONTENT, `${page.route.replace(/^\/|\/$/g, '')}.md`)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, transform(markdown, page, BASE, lastCommitDate(page.source)))
  }

  await mkdir(join(WEBSITE, 'public', 'img'), { recursive: true })
  await mkdir(join(WEBSITE, 'src', 'assets'), { recursive: true })
  // Everything under `img/` ships, so a page that references a new chart needs no change here.
  for (const entry of await readdir(join(ROOT, 'img'), { withFileTypes: true })) {
    if (!entry.isFile()) continue
    await copyFile(join(ROOT, 'img', entry.name), join(WEBSITE, 'public', 'img', entry.name))
  }
  await copyFile(join(ROOT, 'img', 'logo.svg'), join(WEBSITE, 'src', 'assets', 'logo.svg'))
  await copyFile(join(ROOT, 'img', 'logo.svg'), join(WEBSITE, 'public', 'favicon.svg'))

  console.log(`synced ${PAGES.length} pages into ${CONTENT}`)
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
