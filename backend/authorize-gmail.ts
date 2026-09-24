import fs from 'fs/promises';
import path from 'path';
import { authenticate } from '@google-cloud/local-auth';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
];

async function main() {
  const credentialsPath = path.join(process.cwd(), 'credentials.json');
  const tokenPath = path.join(process.cwd(), 'token.json');

  console.log('Starting Gmail authorization...');
  console.log('Please authorize: bajivali400@gmail.com');

  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath,
  });

  await fs.writeFile(
    tokenPath,
    JSON.stringify(auth.credentials, null, 2),
    'utf8'
  );

  console.log('');
  console.log('========================================');
  console.log('Gmail authorization successful!');
  console.log('========================================');
  console.log('Token saved to backend/token.json');
}

main().catch((error) => {
  console.error('');
  console.error('Gmail authorization failed:');
  console.error(error);
  process.exit(1);
});