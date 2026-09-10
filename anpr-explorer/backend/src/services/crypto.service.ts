import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // raccomandato per GCM
const KEY = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64'); // 32 byte = AES-256

/**
 * Cifra una stringa in chiaro con AES-256-GCM.
 * Formato di output: "<iv-hex>:<authTag-hex>:<ciphertext-hex>"
 * Un IV casuale viene generato a ogni chiamata: non riutilizzare mai un IV con la stessa chiave.
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decifra una stringa prodotta da encrypt(). Lancia un errore se il payload
 * è stato manomesso (authTag non valido) o malformato.
 */
export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato payload cifrato non valido');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
