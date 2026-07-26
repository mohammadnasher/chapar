import { ConfigService } from '@nestjs/config';
import { KavehNegarProvider } from './kavehnegar.provider';

describe('KavehNegarProvider — sender line selection', () => {
  const makeProvider = (lines: string): KavehNegarProvider => {
    const config = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'KAVEHNEGAR_API_KEY') return 'test-api-key';
        if (key === 'KAVEHNEGAR_LINES') return lines || defaultValue;
        return defaultValue;
      }),
    } as unknown as ConfigService;
    return new KavehNegarProvider(config);
  };

  const sentParams = (): URLSearchParams =>
    new URLSearchParams(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string,
    );

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as never;
  });

  it('uses the first configured line as the default sender', async () => {
    const provider = makeProvider('10004346, 30002225');

    await provider.send({ channel: 'sms', recipient: '0912', body: 'hi' });

    expect(sentParams().get('sender')).toBe('10004346');
  });

  it('uses the requested line when it is in the configured list', async () => {
    const provider = makeProvider('10004346,30002225');

    await provider.send({
      channel: 'sms',
      recipient: '0912',
      body: 'hi',
      sender: '30002225',
    });

    expect(sentParams().get('sender')).toBe('30002225');
  });

  it('rejects a requested line that is not configured', async () => {
    const provider = makeProvider('10004346');

    await expect(
      provider.send({
        channel: 'sms',
        recipient: '0912',
        body: 'hi',
        sender: '99999999',
      }),
    ).rejects.toThrow('Sender line "99999999" is not configured');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('omits the sender param when no lines are configured', async () => {
    const provider = makeProvider('');

    await provider.send({ channel: 'sms', recipient: '0912', body: 'hi' });

    expect(sentParams().has('sender')).toBe(false);
  });

  it('passes a requested line through when no allowlist is configured', async () => {
    const provider = makeProvider('');

    await provider.send({
      channel: 'sms',
      recipient: '0912',
      body: 'hi',
      sender: '20001111',
    });

    expect(sentParams().get('sender')).toBe('20001111');
  });
});
