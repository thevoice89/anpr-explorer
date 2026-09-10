import './db'; // garantisce che le migrazioni vengano eseguite prima di accettare richieste
import { app } from './app';
import { env } from './config/env';

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ANPR Explorer backend in ascolto sulla porta ${env.PORT} (${env.NODE_ENV})`);
});
