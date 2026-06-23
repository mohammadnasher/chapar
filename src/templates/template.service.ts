import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TemplateService implements OnModuleInit {
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly templatesDir = path.join(__dirname, 'hbs');

  onModuleInit() {
    Handlebars.registerHelper('currentYear', () => new Date().getFullYear());
  }

  async render(
    templateId: string,
    variables: Record<string, unknown> = {},
  ): Promise<string> {
    let compiled = this.cache.get(templateId);

    if (!compiled) {
      const filePath = path.join(this.templatesDir, `${templateId}.hbs`);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Template not found: ${templateId}`);
      }

      const source = fs.readFileSync(filePath, 'utf8');
      compiled = Handlebars.compile(source);
      this.cache.set(templateId, compiled);
    }

    return compiled(variables);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
