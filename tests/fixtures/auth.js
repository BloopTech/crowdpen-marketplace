// @ts-check
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const storageRoot = path.resolve(process.cwd(), 'playwright', '.auth');
const marketplaceStorageState = path.join(storageRoot, 'marketplace.json');
const adminStorageState = path.join(storageRoot, 'admin.json');
const emptyStorageState = { cookies: [], origins: [] };

const buildAuthTest = ({ label, storagePath, envPrefix }) =>
  base.extend({
    storageState: async ({}, applyState, testInfo) => {
      if (!fs.existsSync(storagePath)) {
        testInfo.skip(
          true,
          `Missing ${label} auth storage state at ${storagePath}. Set ${envPrefix}_USER_ID and ${envPrefix}_USER_EMAIL and rerun Playwright.`
        );
        return applyState(emptyStorageState);
      }

      return applyState(storagePath);
    },
  });

export const marketplaceTest = buildAuthTest({
  label: 'marketplace',
  storagePath: marketplaceStorageState,
  envPrefix: 'PLAYWRIGHT_MARKETPLACE',
});

export const adminTest = buildAuthTest({
  label: 'admin',
  storagePath: adminStorageState,
  envPrefix: 'PLAYWRIGHT_ADMIN',
});

export { expect, marketplaceStorageState, adminStorageState };
