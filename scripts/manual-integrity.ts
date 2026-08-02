import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';

export const USER_MANUAL_DOCUMENT_MARKER =
  '<meta name="opentu-document" content="user-manual" />';
export const USER_MANUAL_SOURCE_DIGEST_META = 'opentu-source-digest';
export const USER_MANUAL_VERSION_META = 'opentu-manual-version';

export interface ManualSourcePage {
  filePath: string;
  relativePath: string;
  slug: string;
  title: string;
  sourceDigest: string;
}

export type ManualIntegrityIssueCode =
  | 'source-empty'
  | 'source-title-missing'
  | 'source-slug-conflict'
  | 'output-directory-missing'
  | 'output-page-missing'
  | 'output-page-unexpected'
  | 'output-page-not-file'
  | 'output-title-missing'
  | 'output-title-mismatch'
  | 'output-marker-missing'
  | 'output-app-shell'
  | 'output-source-digest-missing'
  | 'output-source-digest-mismatch'
  | 'output-version-missing'
  | 'output-version-mismatch'
  | 'output-resource-missing';

export interface ManualIntegrityIssue {
  code: ManualIntegrityIssueCode;
  path?: string;
  message: string;
}

export interface ManualIntegrityReport {
  contentDir: string;
  outputDir: string;
  slugs: string[];
  htmlFiles: string[];
}

export class ManualIntegrityError extends Error {
  readonly issues: ManualIntegrityIssue[];

  constructor(issues: ManualIntegrityIssue[]) {
    super(
      `User manual integrity check failed with ${issues.length} issue${
        issues.length === 1 ? '' : 's'
      }:\n${issues.map((issue) => `- ${issue.message}`).join('\n')}`
    );
    this.name = 'ManualIntegrityError';
    this.issues = issues;
  }
}

function normalizeRelativePath(value: string): string {
  return value.split(path.sep).join('/');
}

export function manualSlugFromRelativeMdxPath(relativePath: string): string {
  return normalizeRelativePath(relativePath)
    .replace(/\.mdx$/i, '')
    .replace(/\//g, '-')
    .replace(/^-/, '');
}

export function createManualSourceDigest(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex');
}

function collectMdxFiles(directory: string, rootDir: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMdxFiles(entryPath, rootDir));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.mdx')) {
      files.push(normalizeRelativePath(path.relative(rootDir, entryPath)));
    }
  }

  return files;
}

export function readManualSourcePages(contentDir: string): ManualSourcePage[] {
  const resolvedContentDir = path.resolve(contentDir);
  const relativePaths = collectMdxFiles(resolvedContentDir, resolvedContentDir);
  const issues: ManualIntegrityIssue[] = [];
  const pages: ManualSourcePage[] = [];
  const slugOwners = new Map<string, string>();

  if (relativePaths.length === 0) {
    throw new ManualIntegrityError([
      {
        code: 'source-empty',
        path: resolvedContentDir,
        message: `No MDX source pages found in ${resolvedContentDir}`,
      },
    ]);
  }

  for (const relativePath of relativePaths) {
    const filePath = path.join(resolvedContentDir, ...relativePath.split('/'));
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(fileContent);
    const title =
      typeof parsed.data.title === 'string' ? parsed.data.title.trim() : '';
    const slug = manualSlugFromRelativeMdxPath(relativePath);

    if (!title) {
      issues.push({
        code: 'source-title-missing',
        path: filePath,
        message: `Manual source page has no frontmatter title: ${relativePath}`,
      });
    }

    const previousOwner = slugOwners.get(slug);
    if (previousOwner) {
      issues.push({
        code: 'source-slug-conflict',
        path: filePath,
        message: `Manual source pages ${previousOwner} and ${relativePath} both map to ${slug}.html`,
      });
    } else {
      slugOwners.set(slug, relativePath);
    }

    pages.push({
      filePath,
      relativePath,
      slug,
      title,
      sourceDigest: createManualSourceDigest(fileContent),
    });
  }

  if (issues.length > 0) {
    throw new ManualIntegrityError(issues);
  }

  return pages.sort((left, right) => left.slug.localeCompare(right.slug));
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHtmlTitle(html: string): string | null {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlText(match[1]) : null;
}

function getHtmlAttribute(tag: string, attributeName: string): string | null {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tag.match(
    new RegExp(`\\s${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i')
  );
  return match ? decodeHtmlText(match[2]) : null;
}

function getMetaContent(html: string, metaName: string): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    if (getHtmlAttribute(tag, 'name') === metaName) {
      return getHtmlAttribute(tag, 'content');
    }
  }
  return null;
}

function containsApplicationRootShell(html: string): boolean {
  return /<[^>]+\bid\s*=\s*["']root["'][^>]*>/i.test(html);
}

function resolveManualResourceReference(
  reference: string,
  outputDir: string
): { path: string; optionalRoot?: string } | null {
  const withoutQuery = reference.split(/[?#]/, 1)[0];
  let decodedReference: string;
  try {
    decodedReference = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }

  if (/^https?:\/\//i.test(decodedReference)) {
    const pathname = new URL(decodedReference).pathname;
    const manualAsset = pathname.match(
      /\/user-manual\/(screenshots|gifs)\/(.+)$/i
    );
    if (!manualAsset) {
      return null;
    }
    return {
      path: path.join(outputDir, manualAsset[1], manualAsset[2]),
      optionalRoot: path.join(outputDir, manualAsset[1]),
    };
  }

  const manualAsset = decodedReference.match(/^(screenshots|gifs)\/(.+)$/i);
  if (manualAsset) {
    return {
      path: path.join(outputDir, manualAsset[1], manualAsset[2]),
      optionalRoot: path.join(outputDir, manualAsset[1]),
    };
  }

  if (/^(?:\.\.\/)+product_showcase\//i.test(decodedReference)) {
    return { path: path.resolve(outputDir, decodedReference) };
  }

  return null;
}

function getMissingManualResources(html: string, outputDir: string): string[] {
  const missing = new Set<string>();
  for (const match of html.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi)) {
    const resolved = resolveManualResourceReference(match[2], outputDir);
    if (!resolved) {
      continue;
    }
    // Screenshots and GIFs are optional for a clean HTML-only build. Once a
    // resource set exists (for release/manual-update), it must be complete.
    if (resolved.optionalRoot && !fs.existsSync(resolved.optionalRoot)) {
      continue;
    }
    if (!fs.existsSync(resolved.path) || !fs.statSync(resolved.path).isFile()) {
      missing.add(match[2]);
    }
  }
  return Array.from(missing).sort();
}

function listRootHtmlEntries(outputDir: string): Array<{
  name: string;
  isFile: boolean;
}> {
  return fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => ({ name: entry.name, isFile: entry.isFile() }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function validateManualOutput(options: {
  contentDir: string;
  outputDir: string;
  expectedVersion?: string;
}): ManualIntegrityReport {
  const contentDir = path.resolve(options.contentDir);
  const outputDir = path.resolve(options.outputDir);
  const sourcePages = readManualSourcePages(contentDir);
  const issues: ManualIntegrityIssue[] = [];

  if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
    throw new ManualIntegrityError([
      {
        code: 'output-directory-missing',
        path: outputDir,
        message: `Manual output directory does not exist: ${outputDir}`,
      },
    ]);
  }

  const expectedFiles = new Map<string, ManualSourcePage>(
    sourcePages.map((page): [string, ManualSourcePage] => [
      `${page.slug}.html`,
      page,
    ])
  );
  const actualEntries = listRootHtmlEntries(outputDir);
  const actualFiles = new Map(
    actualEntries.map((entry) => [entry.name, entry])
  );

  for (const [fileName] of expectedFiles) {
    if (!actualFiles.has(fileName)) {
      issues.push({
        code: 'output-page-missing',
        path: path.join(outputDir, fileName),
        message: `Missing generated manual page: ${fileName}`,
      });
    }
  }

  for (const entry of actualEntries) {
    if (!expectedFiles.has(entry.name)) {
      issues.push({
        code: 'output-page-unexpected',
        path: path.join(outputDir, entry.name),
        message: `Unexpected or stale generated manual page: ${entry.name}`,
      });
    }
  }

  for (const [fileName, sourcePage] of expectedFiles) {
    const actualEntry = actualFiles.get(fileName);
    if (!actualEntry) {
      continue;
    }

    const outputPath = path.join(outputDir, fileName);
    if (!actualEntry.isFile) {
      issues.push({
        code: 'output-page-not-file',
        path: outputPath,
        message: `Generated manual page is not a regular file: ${fileName}`,
      });
      continue;
    }

    const html = fs.readFileSync(outputPath, 'utf8');
    const title = getHtmlTitle(html);
    if (!title) {
      issues.push({
        code: 'output-title-missing',
        path: outputPath,
        message: `Generated manual page has no title: ${fileName}`,
      });
    } else if (!title.includes(sourcePage.title)) {
      issues.push({
        code: 'output-title-mismatch',
        path: outputPath,
        message: `Generated title for ${fileName} does not contain source title "${sourcePage.title}"`,
      });
    }

    if (!html.includes(USER_MANUAL_DOCUMENT_MARKER)) {
      issues.push({
        code: 'output-marker-missing',
        path: outputPath,
        message: `Generated manual marker is missing from ${fileName}`,
      });
    }

    if (containsApplicationRootShell(html)) {
      issues.push({
        code: 'output-app-shell',
        path: outputPath,
        message: `Application root shell was found where a manual page was expected: ${fileName}`,
      });
    }

    const sourceDigest = getMetaContent(html, USER_MANUAL_SOURCE_DIGEST_META);
    if (!sourceDigest) {
      issues.push({
        code: 'output-source-digest-missing',
        path: outputPath,
        message: `Generated source digest is missing from ${fileName}`,
      });
    } else if (sourceDigest !== sourcePage.sourceDigest) {
      issues.push({
        code: 'output-source-digest-mismatch',
        path: outputPath,
        message: `Generated page is stale for its MDX source: ${fileName}`,
      });
    }

    const outputVersion = getMetaContent(html, USER_MANUAL_VERSION_META);
    if (!outputVersion) {
      issues.push({
        code: 'output-version-missing',
        path: outputPath,
        message: `Generated manual version is missing from ${fileName}`,
      });
    } else if (
      options.expectedVersion &&
      outputVersion !== options.expectedVersion
    ) {
      issues.push({
        code: 'output-version-mismatch',
        path: outputPath,
        message: `Generated manual version for ${fileName} is ${outputVersion}, expected ${options.expectedVersion}`,
      });
    }

    for (const reference of getMissingManualResources(html, outputDir)) {
      issues.push({
        code: 'output-resource-missing',
        path: outputPath,
        message: `Generated manual resource is missing for ${fileName}: ${reference}`,
      });
    }
  }

  if (issues.length > 0) {
    throw new ManualIntegrityError(issues);
  }

  return {
    contentDir,
    outputDir,
    slugs: sourcePages.map((page) => page.slug),
    htmlFiles: actualEntries.map((entry) => entry.name),
  };
}
