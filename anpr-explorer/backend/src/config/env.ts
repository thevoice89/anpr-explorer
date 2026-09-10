import 'dotenv/config';
import { z } from 'zod';

/**
 * Validazione rigorosa delle variabili d'ambiente all'avvio.
 * Se manca un valore obbligatorio, l'applicazione si arresta subito
 * invece di partire in uno stato di sicurezza incompleto.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve avere almeno 32 caratteri'),
  // Chiave di cifratura (KEK) usata per cifrare/decifrare i segreti PDND nel DB.
  // Deve essere base64 di 32 byte (256 bit) -> genera con: openssl rand -base64 32
  APP_ENCRYPTION_KEY: z.string().refine(
    (v) => {
      try {
        return Buffer.from(v, 'base64').length === 32;
      } catch {
        return false;
      }
    },
    { message: 'APP_ENCRYPTION_KEY deve essere una stringa base64 che codifica 32 byte' }
  ),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD_HASH: z.string().min(20, 'ADMIN_PASSWORD_HASH mancante o non valido (hash argon2id)'),
  CORS_ORIGIN: z.string().url(),
  DB_PATH: z.string().min(1).default('./data/anpr-explorer.db'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Configurazione ambiente non valida:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
