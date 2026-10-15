import { decrypt, encrypt, encryptionKey, SAUDI_IBAN } from './crypto.js';

describe('encryption at rest', () => {
  const key = encryptionKey(undefined, 'secret', false);

  it('round-trips and never repeats ciphertext', () => {
    const iban = 'SA0380000000608010167519';
    const a = encrypt(iban, key);
    expect(a).not.toContain(iban);
    expect(encrypt(iban, key)).not.toBe(a);
    expect(decrypt(a, key)).toBe(iban);
  });

  it('detects tampering', () => {
    const c = encrypt('SA0380000000608010167519', key).split(':');
    c[3] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(c.join(':'), key)).toThrow();
  });

  it('requires a key in production', () => {
    expect(() => encryptionKey(undefined, 'secret', true)).toThrow(/required/);
    expect(SAUDI_IBAN.test('SA0380000000608010167519')).toBe(true);
    expect(SAUDI_IBAN.test('GB33BUKB20201555555555')).toBe(false);
  });
});
