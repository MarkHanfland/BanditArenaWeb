import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type AdministratorUser = {
  id: string;
  username: string;
  password: string;
  cognitoGroup: string;
  label: string;
  provisioned: boolean;
};

type PlayerUser = {
  id: string;
  email: string;
  password: string;
  label: string;
  provisioned: boolean;
};

type TestCredentialsFile = {
  version: number;
  administratorPool: { users: AdministratorUser[] };
  playerPool: { users: PlayerUser[] };
};

let cachedCredentials: TestCredentialsFile | null = null;

function resolveCredentialsPath(): string {
  if (process.env.BANDIT_TEST_CREDENTIALS_PATH) {
    return process.env.BANDIT_TEST_CREDENTIALS_PATH;
  }

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(thisDir, '../../../BanditArena/credentials/test-credentials.json'),
    path.resolve(thisDir, '../../../../BanditArena/credentials/test-credentials.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Bandit test credentials file not found. Create BanditArena/credentials/test-credentials.json ' +
      'from test-credentials.example.json, check out BanditArena as a sibling repo, ' +
      'or set BANDIT_TEST_CREDENTIALS_PATH.',
  );
}

function assertPasswordConfigured(identity: string, password: string | undefined, credentialsPath: string) {
  if (!password || password.startsWith('__SET_')) {
    throw new Error(`password is not configured for '${identity}' in ${credentialsPath}`);
  }
}

export function loadTestCredentials(): TestCredentialsFile {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const credentialsPath = resolveCredentialsPath();
  const raw = fs.readFileSync(credentialsPath, 'utf8');
  const parsed = JSON.parse(raw) as TestCredentialsFile;

  for (const user of parsed.administratorPool.users) {
    if (user.provisioned) {
      assertPasswordConfigured(user.username, user.password, credentialsPath);
    }
  }

  cachedCredentials = parsed;
  return parsed;
}

export function getTestAdministratorUser(roleId: string) {
  const cred = loadTestCredentials();
  const user = cred.administratorPool.users.find((entry) => entry.id === roleId);
  if (!user) {
    throw new Error(`Administrator role '${roleId}' not defined in test-credentials.json`);
  }

  if (user.provisioned) {
    assertPasswordConfigured(user.username, user.password, resolveCredentialsPath());
  }

  return user;
}
