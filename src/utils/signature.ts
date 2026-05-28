import crypto from 'crypto';

export function computeSignature(
  timestamp: string,
  fields: (string | undefined | null)[],
  signatureSalt: string
): string {
  let input = timestamp.trim();

  for (const field of fields) {
    if (field != null && field !== '') {
      input += String(field).trim();
    }
  }

  input += signatureSalt.trim();

  return crypto
    .createHash('sha256')
    .update(input, 'utf8')
    .digest('hex');
}
