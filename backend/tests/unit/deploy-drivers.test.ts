/**
 * Drivers used on hosts without SMTP or a persistent disk: Gmail API email and Supabase Storage.
 * Network calls are mocked; each test loads the modules fresh with its own environment.
 */
type FetchCall = [string, RequestInit];

function loadWith<T>(vars: Record<string, string>, load: () => T): T {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  try {
    let mod!: T;
    jest.isolateModules(() => {
      mod = load();
    });
    return mod;
  } finally {
    process.env = saved;
  }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Gmail API mail transport', () => {
  const vars = { GMAIL_CLIENT_ID: 'cid', GMAIL_CLIENT_SECRET: 'csecret', GMAIL_REFRESH_TOKEN: 'rtoken', MAIL_FROM: 'BengkelGo <sender@gmail.com>' };
  afterEach(() => jest.restoreAllMocks());

  it('refreshes an access token once, then sends a base64url MIME message', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(200, { access_token: 'at-1', expires_in: 3600 }))
      .mockResolvedValueOnce(json(200, { id: 'm1' }))
      .mockResolvedValueOnce(json(200, { id: 'm2' }));
    const mailer = loadWith(vars, () => require('../../src/config/mailer') as typeof import('../../src/config/mailer'));
    expect(mailer.mailTransport).toBe('gmail-api');

    await mailer.sendMail({ to: 'budi@bengkelgo.id', subject: 'Booking terkonfirmasi: Ganti Oli', text: 'Halo', html: '<p>Halo</p>' });
    await mailer.sendMail({ to: 'ani@bengkelgo.id', subject: 'Kedua', text: 'Hai' });

    const calls = fetchMock.mock.calls as unknown as FetchCall[];
    expect(calls.map((c) => c[0])).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    ]);
    expect(String(calls[0][1].body)).toContain('refresh_token=rtoken');
    expect((calls[1][1].headers as Record<string, string>).Authorization).toBe('Bearer at-1');
    const raw = Buffer.from(JSON.parse(String(calls[1][1].body)).raw, 'base64url').toString();
    expect(raw).toMatch(/^From: BengkelGo <sender@gmail\.com>/m);
    expect(raw).toMatch(/^To: budi@bengkelgo\.id/m);
    expect(raw).toMatch(/^Subject: Booking terkonfirmasi: Ganti Oli/m);
  });

  it('throws when Google rejects the refresh token, so the caller can retry', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json(400, { error: 'invalid_grant' }));
    const mailer = loadWith(vars, () => require('../../src/config/mailer') as typeof import('../../src/config/mailer'));
    await expect(mailer.sendMail({ to: 'x@bengkelgo.id', subject: 's', text: 't' })).rejects.toThrow(/invalid_grant/);
  });
});

describe('Undeliverable test/example domains', () => {
  afterEach(() => jest.restoreAllMocks());

  it('recognises reserved domains but not real ones', () => {
    const { isUndeliverable } = loadWith({}, () => require('../../src/config/mailer') as typeof import('../../src/config/mailer'));
    for (const a of ['cust123@example.test', 'a@example.com', 'b@mail.example.org', 'c@x.invalid', 'd@host.local', 'e@localhost'])
      expect(isUndeliverable(a)).toBe(true);
    for (const a of ['budi@gmail.com', 'admin@bengkelgo.id', 'x@examples.com', 'y@testing.co.id']) expect(isUndeliverable(a)).toBe(false);
  });

  it('never calls the provider for them, even when email is configured', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const mailer = loadWith(
      { GMAIL_CLIENT_ID: 'cid', GMAIL_CLIENT_SECRET: 'csecret', GMAIL_REFRESH_TOKEN: 'rtoken' },
      () => require('../../src/config/mailer') as typeof import('../../src/config/mailer'),
    );
    await mailer.sendMail({ to: 'cust1792@example.test', subject: 'Booking terkonfirmasi', text: 'Halo' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Supabase Storage driver', () => {
  const vars = { STORAGE_DRIVER: 'supabase', SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srk', SUPABASE_BUCKET: 'uploads' };
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  afterEach(() => jest.restoreAllMocks());

  it('creates the private bucket once, uploads, serves and deletes by key', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json(400, { message: 'The resource already exists' })) // bucket exists
      .mockResolvedValueOnce(json(200, { Key: 'x' })) // upload 1
      .mockResolvedValueOnce(json(200, { Key: 'y' })) // upload 2 (no bucket call)
      .mockResolvedValueOnce(new Response(PNG, { status: 200 })) // download
      .mockResolvedValueOnce(json(200, {})); // delete
    const storage = loadWith(vars, () => require('../../src/common/utils/storage') as typeof import('../../src/common/utils/storage'));

    const key = await storage.saveImage('proofs', PNG, 'image/png');
    expect(key).toMatch(/^proofs\/[0-9a-f-]{36}\.png$/);
    await storage.saveImage('photos', PNG, 'image/png');

    const res = { type: jest.fn(), send: jest.fn(), sendFile: jest.fn() };
    await storage.sendStored(res as never, key);
    expect(res.type).toHaveBeenCalledWith('image/png');
    expect(res.send).toHaveBeenCalledWith(PNG);
    expect(res.sendFile).not.toHaveBeenCalled();

    await storage.deleteStored(key);

    const calls = fetchMock.mock.calls as unknown as FetchCall[];
    expect(calls[0][0]).toBe('https://proj.supabase.co/storage/v1/bucket');
    expect(JSON.parse(String(calls[0][1].body))).toMatchObject({ id: 'uploads', public: false });
    expect(calls[1][0]).toBe(`https://proj.supabase.co/storage/v1/object/uploads/${key}`);
    expect(calls[1][1]).toMatchObject({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer srk', 'Content-Type': 'image/png' }) });
    expect(calls[2][0]).toMatch(/\/storage\/v1\/object\/uploads\/photos\//);
    expect(calls[3][0]).toBe(`https://proj.supabase.co/storage/v1/object/uploads/${key}`);
    expect(calls[4][1]).toMatchObject({ method: 'DELETE' });
  });

  it('answers 404 for a missing file and refuses keys that are not ours', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json(400, { error: 'not_found' }));
    const storage = loadWith(vars, () => require('../../src/common/utils/storage') as typeof import('../../src/common/utils/storage'));
    const res = { type: jest.fn(), send: jest.fn() };
    await expect(storage.sendStored(res as never, 'proofs/11111111-1111-1111-1111-111111111111.jpg')).rejects.toMatchObject({ statusCode: 404 });
    await expect(storage.sendStored(res as never, '../.env')).rejects.toThrow('Invalid storage key');
  });
});
