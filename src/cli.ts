import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Command } from 'commander';
import kleur from 'kleur';
import { convertPath } from './index.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; description?: string };

const program = new Command();
program
  .name('docwalker')
  .description(pkg.description ?? 'DOCX to Markdown converter')
  .version(pkg.version);

program
  .command('convert')
  .description('Convert DOCX files to Markdown and extract embedded images')
  .argument('<input>', 'Path to a DOCX file or directory containing DOCX files')
  .argument('<output>', 'Directory for generated Markdown files')
  .option('-i, --image-dir <name>', 'Directory name for extracted images', 'images')
  .option('--dry-run', 'Perform conversion without writing files to disk', false)
  .option('--overwrite', 'Overwrite existing Markdown files', false)
  .action(async (input: string, output: string, options: { imageDir: string; dryRun: boolean; overwrite: boolean }) => {
    const inputPath = path.resolve(process.cwd(), input);
    const outputPath = path.resolve(process.cwd(), output);

    try {
      if (!options.dryRun) {
        await mkdir(outputPath, { recursive: true });
      }

      const { successes, failures } = await convertPath(inputPath, {
        outputDir: outputPath,
        imageDirName: options.imageDir,
        dryRun: options.dryRun,
        overwrite: options.overwrite
      });

      successes.forEach((result) => {
        const relativeOutput = path.relative(process.cwd(), result.outputPath) || result.outputPath;
        const status = options.dryRun ? kleur.yellow('●') : kleur.green('✔');
        const summary = `${kleur.bold(relativeOutput)} (${result.imagePaths.length} images)`;
        console.info(`${status} ${summary}`);
        if (result.warnings.length > 0) {
          result.warnings.forEach((warning) => {
            console.warn(`  ${kleur.yellow('⚠')} ${warning}`);
          });
        }
      });

      failures.forEach(({ inputPath: failedPath, error }) => {
        const relativeInput = path.relative(process.cwd(), failedPath) || failedPath;
        console.error(`${kleur.red('✖')} ${kleur.bold(relativeInput)}: ${error.message}`);
      });

      const total = successes.length + failures.length;
      const summaryLine = `${kleur.bold(successes.length.toString())}/${total} converted`;
      if (failures.length > 0) {
        console.error(`${kleur.red('Summary:')} ${summaryLine}`);
        process.exitCode = 1;
      } else {
        console.info(`${kleur.green('Summary:')} ${summaryLine}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${kleur.red('✖')} ${message}`);
      process.exit(1);
    }
  });

void program.parseAsync(process.argv);
