import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export function resolveExtensionBuildConfig(argv, env) {
  const isProd = argv.includes('--prod');
  const watch = !isProd && argv.includes('--watch');
  const rawApiUrl = env.MAILTRACK_API_URL?.trim() ?? '';

  if (isProd) {
    if (!rawApiUrl) {
      throw new Error('MAILTRACK_API_URL is required for extension production builds (--prod).');
    }
    let parsed;
    try {
      parsed = new URL(rawApiUrl);
    } catch {
      throw new Error(`MAILTRACK_API_URL is not a valid URL: ${rawApiUrl}`);
    }
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol !== 'https:' ||
      LOCALHOST_HOSTNAMES.has(host) ||
      host.endsWith('.localhost')
    ) {
      throw new Error(
        `MAILTRACK_API_URL must be a valid non-localhost HTTPS URL for production builds (received: ${rawApiUrl}).`,
      );
    }
    return {
      isProd: true,
      watch: false,
      apiBaseUrl: rawApiUrl.replace(/\/+$/, ''),
      apiOriginPattern: `${parsed.origin}/*`,
      sourcemap: false,
    };
  }

  const devUrl = (rawApiUrl || 'http://localhost:4000').replace(/\/+$/, '');
  const parsedDev = new URL(devUrl);
  return {
    isProd: false,
    watch,
    apiBaseUrl: devUrl,
    apiOriginPattern: `${parsedDev.origin}/*`,
    sourcemap: true,
  };
}

export function buildExtensionManifest(baseManifest, apiOriginPattern) {
  return {
    ...baseManifest,
    host_permissions: ['https://mail.google.com/*', apiOriginPattern],
  };
}

export async function runExtensionBuild() {
  const config = resolveExtensionBuildConfig(process.argv, process.env);
  const distDir = path.resolve('dist');

  fs.mkdirSync(distDir, { recursive: true });

  const baseManifest = JSON.parse(fs.readFileSync(path.resolve('manifest.json'), 'utf8'));
  const outputManifest = buildExtensionManifest(baseManifest, config.apiOriginPattern);
  fs.writeFileSync(
    path.join(distDir, 'manifest.json'),
    `${JSON.stringify(outputManifest, null, 2)}\n`,
    'utf8',
  );

  // Remove stale .map files from prior dev builds when running --prod
  if (!config.sourcemap) {
    for (const file of fs.readdirSync(distDir)) {
      if (file.endsWith('.map')) {
        fs.unlinkSync(path.join(distDir, file));
      }
    }
  }

  fs.copyFileSync(path.resolve('src/popup/popup.html'), path.join(distDir, 'popup.html'));
  fs.copyFileSync(path.resolve('src/popup/popup.css'), path.join(distDir, 'popup.css'));

  const common = {
    bundle: true,
    sourcemap: config.sourcemap,
    minify: config.isProd,
    target: 'chrome120',
    logLevel: 'info',
    define: {
      __MAILTRACK_API_URL__: JSON.stringify(config.apiBaseUrl),
      __MAILTRACK_PROD_BUILD__: JSON.stringify(config.isProd),
    },
  };

  const contexts = await Promise.all([
    esbuild.context({
      ...common,
      entryPoints: ['src/background/service-worker.ts'],
      outfile: 'dist/service-worker.js',
      format: 'esm',
    }),
    esbuild.context({
      ...common,
      entryPoints: ['src/content/index.ts'],
      outfile: 'dist/content.js',
      format: 'iife',
    }),
    esbuild.context({
      ...common,
      entryPoints: ['src/popup/popup.tsx'],
      outfile: 'dist/popup.js',
      format: 'esm',
    }),
  ]);

  if (config.watch) {
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log('[extension] watching for changes...');
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
  }
}

const isEntrypoint =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  await runExtensionBuild();
}
