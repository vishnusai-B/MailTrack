import { describe, expect, it } from 'vitest';
import { buildExtensionManifest, resolveExtensionBuildConfig } from '../build.mjs';
import { resolveExtensionApiBaseUrl } from '../src/shared/storage.js';

describe('Phase 8.2 Extension Production Build & Storage Config', () => {
  it('uses localhost and sourcemaps for dev builds', () => {
    const cfg = resolveExtensionBuildConfig(['node', 'build.mjs'], {});
    expect(cfg.isProd).toBe(false);
    expect(cfg.apiBaseUrl).toBe('http://localhost:4000');
    expect(cfg.apiOriginPattern).toBe('http://localhost:4000/*');
    expect(cfg.sourcemap).toBe(true);
  });

  it('requires valid non-localhost HTTPS MAILTRACK_API_URL and disables sourcemaps in --prod', () => {
    expect(() => resolveExtensionBuildConfig(['node', 'build.mjs', '--prod'], {})).toThrow(
      /MAILTRACK_API_URL/,
    );
    expect(() =>
      resolveExtensionBuildConfig(['node', 'build.mjs', '--prod'], {
        MAILTRACK_API_URL: 'http://api.example.com',
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      resolveExtensionBuildConfig(['node', 'build.mjs', '--prod'], {
        MAILTRACK_API_URL: 'https://localhost:4000',
      }),
    ).toThrow(/HTTPS/);

    const prodCfg = resolveExtensionBuildConfig(['node', 'build.mjs', '--prod'], {
      MAILTRACK_API_URL: 'https://api.example.com/',
    });
    expect(prodCfg.isProd).toBe(true);
    expect(prodCfg.apiBaseUrl).toBe('https://api.example.com');
    expect(prodCfg.apiOriginPattern).toBe('https://api.example.com/*');
    expect(prodCfg.sourcemap).toBe(false);
  });

  it('transforms manifest host_permissions to Gmail and configured API origin without wildcards', () => {
    const manifest = buildExtensionManifest(
      {
        manifest_version: 3,
        name: 'MailTrack',
        permissions: ['storage'],
        host_permissions: ['https://mail.google.com/*', 'http://localhost:4000/*'],
      },
      'https://api.example.com/*',
    );
    expect(manifest.host_permissions).toEqual([
      'https://mail.google.com/*',
      'https://api.example.com/*',
    ]);
  });

  it('prevents stale stored localhost URLs from overriding production extension API URL', () => {
    expect(
      resolveExtensionApiBaseUrl('http://localhost:4000', 'https://api.example.com', true),
    ).toBe('https://api.example.com');
    expect(
      resolveExtensionApiBaseUrl('https://api.example.com/', 'https://api.example.com', true),
    ).toBe('https://api.example.com');
    expect(
      resolveExtensionApiBaseUrl('http://localhost:4000', 'http://localhost:4000', false),
    ).toBe('http://localhost:4000');
  });
});
