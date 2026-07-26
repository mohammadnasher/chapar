import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

interface CachedTemplate {
  filePath: string;
  mtimeMs: number;
  compiled: HandlebarsTemplateDelegate;
}

/**
 * Renders Handlebars templates by id.
 *
 * Templates are looked up in two places, in order:
 *  1. TEMPLATES_DIR (optional) — an external directory, e.g. a bind-mounted
 *     volume, so users of the published image can add or override templates
 *     without rebuilding it.
 *  2. The built-in templates bundled with the image (src/templates/hbs).
 *
 * Compiled templates are cached per file and re-compiled automatically when
 * the file's mtime changes, so edits to mounted templates apply on the next
 * render without a restart.
 */
@Injectable()
export class TemplateService implements OnModuleInit {
  private readonly cache = new Map<string, CachedTemplate>();
  private readonly builtinDir = path.join(__dirname, 'hbs');
  private readonly customDir: string;

  constructor(config: ConfigService) {
    this.customDir = config.get<string>('TEMPLATES_DIR', '');
  }

  onModuleInit() {
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
  }

  /** Directories searched for templates, highest priority first. */
  private searchDirs(): string[] {
    return this.customDir ? [this.customDir, this.builtinDir] : [this.builtinDir];
  }

  private resolveTemplatePath(templateId: string): string {
    // The id is user-supplied — restrict it to a plain file stem so it can
    // never traverse outside the template directories.
    if (!/^[A-Za-z0-9][\w.-]*$/.test(templateId) || templateId.includes('..')) {
      throw new BadRequestException(`Invalid template id: ${templateId}`);
    }

    for (const dir of this.searchDirs()) {
      const filePath = path.join(dir, `${templateId}.hbs`);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }

    throw new NotFoundException(`Template not found: ${templateId}`);
  }

  async render(
    templateId: string,
    variables: Record<string, unknown> = {},
  ): Promise<string> {
    const filePath = this.resolveTemplatePath(templateId);
    const { mtimeMs } = fs.statSync(filePath);

    const cached = this.cache.get(templateId);
    let compiled = cached?.compiled;

    // Re-compile when the template resolves to a different file (e.g. an
    // override was mounted) or the file changed on disk since it was cached.
    if (!cached || cached.filePath !== filePath || cached.mtimeMs !== mtimeMs) {
      const source = fs.readFileSync(filePath, 'utf8');
      compiled = Handlebars.compile(source);
      this.cache.set(templateId, { filePath, mtimeMs, compiled });
    }

    return compiled!(variables);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
