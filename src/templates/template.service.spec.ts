import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapar-hbs-'));

    service = new TemplateService();
    // Point the service at our temp directory instead of the bundled hbs dir.
    (service as unknown as { templatesDir: string }).templatesDir = tmpDir;
    // onModuleInit registers the `currentYear` helper used by some templates.
    service.onModuleInit();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const writeTemplate = (id: string, contents: string): void => {
    fs.writeFileSync(path.join(tmpDir, `${id}.hbs`), contents, 'utf8');
  };

  it('renders a template with the provided variables', async () => {
    writeTemplate('greeting', 'Hello, {{name}}! Code: {{code}}');

    const output = await service.render('greeting', {
      name: 'Ada',
      code: '1234',
    });

    expect(output).toBe('Hello, Ada! Code: 1234');
  });

  it('supports the registered currentYear helper', async () => {
    writeTemplate('footer', '© {{currentYear}} Chapar');

    const output = await service.render('footer');

    expect(output).toBe(`© ${new Date().getFullYear()} Chapar`);
  });

  it('caches the compiled template after the first render', async () => {
    writeTemplate('cached', 'v1: {{value}}');
    const first = await service.render('cached', { value: 'a' });
    expect(first).toBe('v1: a');

    // Change the file on disk; a cached template should ignore it.
    writeTemplate('cached', 'v2: {{value}}');
    const second = await service.render('cached', { value: 'b' });
    expect(second).toBe('v1: b');

    // After clearing the cache the new source is picked up.
    service.clearCache();
    const third = await service.render('cached', { value: 'c' });
    expect(third).toBe('v2: c');
  });

  it('throws NotFoundException when the template file is missing', async () => {
    await expect(service.render('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
