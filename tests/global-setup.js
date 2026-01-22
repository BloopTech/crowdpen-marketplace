// @ts-check
import { chromium } from '@playwright/test';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const storageRoot = path.resolve(process.cwd(), 'playwright', '.auth');
const ssoSecret = process.env.PLAYWRIGHT_SSO_SECRET;

const configs = [
  {
    label: 'marketplace',
    storageFile: 'marketplace.json',
    envPrefix: 'PLAYWRIGHT_MARKETPLACE',
  },
  {
    label: 'admin',
    storageFile: 'admin.json',
    envPrefix: 'PLAYWRIGHT_ADMIN',
  },
];

const getUserEnv = (prefix) => {
  const id = process.env[`${prefix}_USER_ID`];
  const email = process.env[`${prefix}_USER_EMAIL`];
  const name = process.env[`${prefix}_USER_NAME`];
  const image = process.env[`${prefix}_USER_IMAGE`];
  return { id, email, name, image };
};

const hasRequiredUserEnv = (user) => Boolean(user?.id && user?.email);

const buildSigninPayload = (userDataString) => {
  if (!ssoSecret) {
    return { userData: userDataString };
  }

  const ts = Math.floor(Date.now() / 1000);
  const payload = `${ts}.${userDataString}`;
  const sig = crypto
    .createHmac('sha256', ssoSecret)
    .update(payload)
    .digest('hex');

  return { userData: userDataString, ts, sig };
};

const createStorageState = async ({ label, storagePath, userData }) => {
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL });

    const userDataString = JSON.stringify(userData);
    const response = await context.request.post('/api/auth/sso/signin', {
      data: {
        ...buildSigninPayload(userDataString),
        callbackUrl: '/',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok() || !payload?.success) {
      throw new Error(
        payload?.error || `Failed to create ${label} auth session`
      );
    }

    await context.storageState({ path: storagePath });
    await context.close();
  } finally {
    if (browser) await browser.close();
  }
};

export default async function globalSetup() {
  await fs.mkdir(storageRoot, { recursive: true });

  for (const config of configs) {
    const storagePath = path.join(storageRoot, config.storageFile);
    const user = getUserEnv(config.envPrefix);

    if (!hasRequiredUserEnv(user)) {
      console.warn(
        `[playwright] Skipping ${config.label} auth setup (missing ${config.envPrefix}_USER_ID or ${config.envPrefix}_USER_EMAIL).`
      );
      continue;
    }

    await createStorageState({
      label: config.label,
      storagePath,
      userData: {
        id: user.id,
        email: user.email,
        name: user.name || config.label,
        image: user.image || null,
      },
    });
  }
}
