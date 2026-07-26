import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TemplateService } from './template.service';

describe('TemplateService', () => {
  let service: TemplateService;
  let customDir: string;
  let builtinDir: string;

  const makeService = (templatesDir: string): TemplateService => {
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) =>
        key === 'TEMPLATES_DIR' ? templatesDir || defaultValue : defaultValue,
      ),
    } as unknown as ConfigService;

    const svc = new TemplateService(config);
    // Redirect the built-in directory to a temp dir we control.
    (svc as unknown as { builtinDir: string }).builtinDir = builtinDir;
    // onModuleInit registers the `currentYear` helper used by some templates.
    svc.onModuleInit();
    return svc;
  };

  const write = (dir: string, id: string, contents: string): void => {
    fs.writeFileSync(path.join(dir, `${id}.hbs`), contents, 'utf8');
  };

  beforeEach(() => {
    customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapar-custom-'));
    builtinDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapar-builtin-'));
    service = makeService(customDir);
  });

  afterEach(() => {
    fs.rmSync(customDir, { recursive: true, force: true });
    fs.rmSync(builtinDir, { recursive: true, force: true });
  });

  it('renders a template with the provided variables', async () => {
    write(builtinDir, 'greeting', 'Hello, {{name}}! Code: {{code}}');

    const output = await service.render('greeting', {
      name: 'Ada',
      code: '1234',
    });

    expect(output).toBe('Hello, Ada! Code: 1234');
  });

  it('supports the registered currentYear helper', async () => {
    write(builtinDir, 'footer', '© {{currentYear}} Chapar');

    const output = await service.render('footer');

    expect(output).toBe(`© ${new Date().getFullYear()} Chapar`);
  });

  it('prefers a template in TEMPLATES_DIR over the built-in one', async () => {
    write(builtinDir, 'welcome', 'builtin: {{name}}');
    write(customDir, 'welcome', 'custom: {{name}}');

    const output = await service.render('welcome', { name: 'Ada' });

    expect(output).toBe('custom: Ada');
  });

  it('falls back to the built-in template when not in TEMPLATES_DIR', async () => {
    write(builtinDir, 'only-builtin', 'from builtin');

    const output = await service.render('only-builtin');

    expect(output).toBe('from builtin');
  });

  it('picks up changes to a template file without a restart', async () => {
    write(customDir, 'live', 'v1: {{value}}');
    expect(await service.render('live', { value: 'a' })).toBe('v1: a');

    // Rewrite the file with a newer mtime; the cache must invalidate itself.
    write(customDir, 'live', 'v2: {{value}}');
    const future = Date.now() / 1000 + 5;
    fs.utimesSync(path.join(customDir, 'live.hbs'), future, future);

    expect(await service.render('live', { value: 'b' })).toBe('v2: b');
  });

  it('throws NotFoundException when the template file is missing', async () => {
    await expect(service.render('does-not-exist')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects template ids that attempt path traversal', async () => {
    await expect(service.render('../secrets')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.render('a/../../b')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('works without TEMPLATES_DIR configured (built-ins only)', async () => {
    const svc = makeService('');
    write(builtinDir, 'plain', 'plain output');

    expect(await svc.render('plain')).toBe('plain output');
  });
});
