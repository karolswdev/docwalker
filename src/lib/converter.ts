import path from 'node:path';
import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import fg from 'fast-glob';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { extension as getExtension } from 'mime-types';

const DEFAULT_IMAGE_DIR = 'images';
const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Caption'] => p.caption"
];

const turndown = createTurndownService();

export interface ConvertOptions {
  outputDir: string;
  imageDirName?: string;
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface ConversionResult {
  inputPath: string;
  outputPath: string;
  markdown: string;
  imagePaths: string[];
  warnings: string[];
  dryRun: boolean;
}

export interface BatchConversionResult {
  successes: ConversionResult[];
  failures: Array<{ inputPath: string; error: Error }>;
}

interface InternalConvertOptions extends ConvertOptions {
  sourceRoot: string;
}

type ExtendedImage = {
  contentType: string;
  altText?: string | null;
  readAsBuffer: () => Promise<Buffer>;
  read: (encoding?: string) => Promise<Buffer | string>;
};

export async function convertPath(
  inputPath: string,
  options: ConvertOptions
): Promise<BatchConversionResult> {
  const resolvedInput = path.resolve(inputPath);
  const resolvedOutput = path.resolve(options.outputDir);
  const imageDirName = options.imageDirName ?? DEFAULT_IMAGE_DIR;

  const stats = await stat(resolvedInput);
  const isDirectory = stats.isDirectory();

  const docPaths = isDirectory
    ? await fg(['**/*.docx'], {
        cwd: resolvedInput,
        absolute: true,
        caseSensitiveMatch: false,
        dot: false,
        ignore: ['**/~$*']
      })
    : [resolvedInput];

  if (docPaths.length === 0) {
    throw new Error(`No DOCX files found at ${resolvedInput}`);
  }

  const sourceRoot = isDirectory ? resolvedInput : path.dirname(resolvedInput);
  const successes: ConversionResult[] = [];
  const failures: Array<{ inputPath: string; error: Error }> = [];

  for (const docPath of docPaths) {
    try {
      const result = await convertDocxFile(docPath, {
        ...options,
        imageDirName,
        outputDir: resolvedOutput,
        sourceRoot
      });
      successes.push(result);
    } catch (error) {
      failures.push({
        inputPath: docPath,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  return { successes, failures };
}

export async function convertDocxFile(
  docPath: string,
  options: InternalConvertOptions
): Promise<ConversionResult> {
  const documentStat = await stat(docPath);
  if (!documentStat.isFile()) {
    throw new Error(`Expected a file at ${docPath}`);
  }

  if (!docPath.toLowerCase().endsWith('.docx')) {
    throw new Error(`Unsupported file type: ${docPath}`);
  }

  const relativeSourcePath = path.relative(options.sourceRoot, docPath) || path.basename(docPath);
  const relativeSourcePosix = toPosix(relativeSourcePath);
  const docBaseName = path.basename(docPath, path.extname(docPath));
  const docSlug = slugify(docBaseName);
  const markdownDirRelative = path.dirname(relativeSourcePath);
  const markdownDir = path.join(options.outputDir, markdownDirRelative === '.' ? '' : markdownDirRelative);
  const markdownFileName = `${docSlug}.md`;
  const markdownPath = path.join(markdownDir, markdownFileName);
  const imageRoot = path.join(options.outputDir, options.imageDirName ?? DEFAULT_IMAGE_DIR, docSlug);

  if (!(await pathExists(markdownPath)) || options.overwrite || options.dryRun) {
    // ok to proceed
  } else {
    throw new Error(`Refusing to overwrite existing file at ${markdownPath}`);
  }

  const buffer = await readFile(docPath);
  const imagePaths: string[] = [];
  const usedImageNames = new Set<string>();
  let imageIndex = 0;

  const markdownDirForWrites = options.dryRun ? null : markdownDir;
  if (markdownDirForWrites) {
    await mkdir(markdownDirForWrites, { recursive: true });
  }

  const convertImage = mammoth.images.imgElement(async (image: ExtendedImage) => {
    imageIndex += 1;
    const ext = getExtension(image.contentType) || 'bin';
    const descriptorSource = image.altText?.trim() ?? '';
    const descriptor = slugify(descriptorSource).replace(/^image-/, '');
    const baseSegment = `${docSlug}-image-${String(imageIndex).padStart(3, '0')}`;
    const fileStem = descriptor ? `${baseSegment}-${descriptor}` : baseSegment;
    let fileName = `${fileStem}.${ext}`;
    let attempt = 1;
    while (usedImageNames.has(fileName)) {
      attempt += 1;
      fileName = `${fileStem}-${attempt}.${ext}`;
    }
    usedImageNames.add(fileName);

    const imagePath = path.join(imageRoot, fileName);
    if (!options.dryRun) {
      await mkdir(path.dirname(imagePath), { recursive: true });
      const imageBuffer = await image.readAsBuffer();
      await writeFile(imagePath, imageBuffer);
    }

    const relativeSrc = toPosix(path.relative(path.dirname(markdownPath), imagePath));
    const altText = descriptorSource || `Image ${imageIndex}`;
    imagePaths.push(relativeSrc);
    return { src: relativeSrc, alt: altText };
  });

  const result = await mammoth.convertToHtml({ buffer }, {
    styleMap: STYLE_MAP,
    convertImage,
    ignoreEmptyParagraphs: false
  });

  const warnings = result.messages.filter((message) => message.type === 'warning').map((message) => message.message);
  const normalisedHtml = normaliseMammothHtml(result.value);
  const markdownBody = turndown.turndown(normalisedHtml).trimEnd();

  const frontMatter = buildFrontMatter({
    title: docBaseName,
    source: relativeSourcePosix,
    converted: new Date().toISOString()
  });

  const markdown = `${frontMatter}\n\n${markdownBody}\n`;

  if (!options.dryRun) {
    await writeFile(markdownPath, markdown, 'utf8');
  }

  return {
    inputPath: docPath,
    outputPath: markdownPath,
    markdown,
    imagePaths,
    warnings,
    dryRun: Boolean(options.dryRun)
  };
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  });
  service.use(gfm);
  service.keep(['table']);
  return service;
}

function slugify(value: string): string {
  if (!value) {
    return 'document';
  }
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'document';
}

function toPosix(input: string): string {
  return input.replace(/\\/g, '/');
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildFrontMatter(details: { title: string; source: string; converted: string }): string {
  const escapedTitle = escapeYaml(details.title);
  const escapedSource = escapeYaml(details.source);
  const escapedConverted = escapeYaml(details.converted);
  return `---\ntitle: "${escapedTitle}"\nsource: "${escapedSource}"\nconverted: "${escapedConverted}"\n---`;
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normaliseMammothHtml(html: string): string {
  if (!html) {
    return '';
  }

  let processed = html.replace(/\u00a0|&nbsp;/g, ' ');

  processed = processed.replace(/<p>\s*<br\s*\/?>(\s*<br\s*\/?\s*)*\s*<\/p>/gi, '');
  processed = processed.replace(/<p>\s*<\/p>/gi, '');

  processed = processed.replace(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi, (_match, tag, attrs, inner) => {
    const segments = inner
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .split('\n')
      .map((segment: string) => segment.trim())
      .filter((segment: string) => segment.length > 0);

    const combined = segments.join('<br />');
    const collapsedBreaks = combined.replace(/(<br\s*\/?>(\s*<br\s*\/?\s*)*)/gi, '<br />');
    const content = collapsedBreaks.trim();
    return `<${tag}${attrs}>${content}</${tag}>`;
  });

  processed = processed.replace(/(<br\s*\/?>(\s*<br\s*\/?\s*)*)/gi, '<br />');

  return processed;
}

export const __internal = {
  slugify,
  toPosix,
  buildFrontMatter,
  normaliseMammothHtml
};
