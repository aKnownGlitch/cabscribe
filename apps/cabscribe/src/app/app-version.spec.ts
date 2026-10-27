import { describe, expect, it } from 'vitest';
import { version as rootVersion } from '../../../../package.json';
import { version as appVersion } from '../../package.json';
import { version as desktopVersion } from '../../../cabscribe-desktop/package.json';
import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
  it('is a semantic version', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it('matches every package in the workspace', () => {
    expect(rootVersion).toBe(APP_VERSION);
    expect(appVersion).toBe(APP_VERSION);
    expect(desktopVersion).toBe(APP_VERSION);
  });
});
