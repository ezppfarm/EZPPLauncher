import { spawn, execFileSync } from 'node:child_process';
import { accessSync, constants, existsSync } from 'node:fs';
import path from 'node:path';

const WINDOWS_TARGET = 'x86_64-pc-windows-msvc';
const TARGETS = ['macos', 'windows', 'linux'] as const;

type Target = (typeof TARGETS)[number];

function hostTarget(): Target {
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') return 'linux';
  throw new Error(`Unsupported build host: ${process.platform}`);
}

function findCommand(command: string, envPath: string): string | undefined {
  const extensions =
    process.platform === 'win32'
      ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')]
      : [''];

  for (const directory of envPath.split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension.toLowerCase()}`);
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Keep looking through PATH.
      }
    }
  }
}

function prependExistingPath(env: NodeJS.ProcessEnv, directory: string) {
  if (existsSync(directory)) env.PATH = `${directory}${path.delimiter}${env.PATH ?? ''}`;
}

function ensureUtf8Locale(env: NodeJS.ProcessEnv) {
  const current = env.LC_ALL || env.LC_CTYPE || env.LANG || '';
  if (current && current !== 'C' && current !== 'POSIX') return;

  // makeNSIS 3.13 crashes with std::bad_alloc on POSIX under the C locale.
  const locale = process.platform === 'darwin' ? 'en_US.UTF-8' : 'C.UTF-8';
  env.LC_ALL = locale;
  env.LANG = locale;
}

function selectRustupToolchain(env: NodeJS.ProcessEnv) {
  const rustup =
    findCommand('rustup', env.PATH ?? '') ??
    ['/opt/homebrew/opt/rustup/bin/rustup', '/usr/local/opt/rustup/bin/rustup'].find((candidate) =>
      existsSync(candidate)
    );
  if (!rustup) return;

  try {
    const cargo = execFileSync(rustup, ['which', 'cargo'], {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    env.PATH = `${path.dirname(cargo)}${path.delimiter}${env.PATH ?? ''}`;
  } catch {
    // Fall back to the cargo already on PATH.
  }
}

function hasRustTarget(target: string, env: NodeJS.ProcessEnv): boolean {
  try {
    const libdir = execFileSync('rustc', ['--print', 'target-libdir', '--target', target], {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return existsSync(libdir);
  } catch {
    return false;
  }
}

function windowsPrerequisites(env: NodeJS.ProcessEnv): string[] {
  const missing: string[] = [];

  if (!findCommand('cargo-xwin', env.PATH ?? '')) {
    missing.push('cargo-xwin (install with: cargo install --locked cargo-xwin)');
  }
  if (!findCommand('cmake', env.PATH ?? '')) {
    missing.push(
      process.platform === 'darwin'
        ? 'CMake (install with: brew install cmake)'
        : 'CMake (install cmake and add it to PATH)'
    );
  }
  if (!findCommand('nasm', env.PATH ?? '')) {
    missing.push(
      process.platform === 'darwin'
        ? 'NASM (install with: brew install nasm)'
        : 'NASM (install nasm and add it to PATH)'
    );
  }
  if (!findCommand('ninja', env.PATH ?? '')) {
    missing.push(
      process.platform === 'darwin'
        ? 'Ninja (install with: brew install ninja)'
        : 'Ninja (install ninja and add it to PATH)'
    );
  }
  if (!hasRustTarget(WINDOWS_TARGET, env)) {
    missing.push(
      `${WINDOWS_TARGET} Rust target (install with: rustup target add ${WINDOWS_TARGET})`
    );
  }
  if (process.platform !== 'win32') {
    if (!findCommand('llvm-rc', env.PATH ?? '')) {
      missing.push(
        process.platform === 'darwin'
          ? 'LLVM (install with: brew install llvm, then add its bin directory to PATH)'
          : 'LLVM (install llvm and lld, then add llvm-rc to PATH)'
      );
    }
    if (!findCommand('makensis', env.PATH ?? '')) {
      missing.push(
        process.platform === 'darwin'
          ? 'NSIS (install with: brew install nsis)'
          : 'NSIS (install makensis and add it to PATH)'
      );
    }
  }

  return missing;
}

function artifactDirectory(target: Target): string {
  if (target === 'windows') {
    const suffix =
      process.platform === 'win32'
        ? path.join('target', 'release')
        : path.join('target', WINDOWS_TARGET, 'release');
    return path.join('src-tauri', suffix, 'bundle', 'nsis');
  }
  if (target === 'macos') return path.join('src-tauri', 'target', 'release', 'bundle');
  return path.join('src-tauri', 'target', 'release', 'bundle');
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  console.log(`\n$ ${[command, ...args].join(' ')}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

/**
 * Vite's static-adapter build can leave the process alive after writing the
 * output. Stop it once the adapter confirms the build is complete, matching
 * the behavior of scripts/build.ts.
 */
function buildFrontend(command: string, env: NodeJS.ProcessEnv): Promise<void> {
  console.log(`\n$ ${command} x --bun vite build`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, ['x', '--bun', 'vite', 'build'], {
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let completed = false;

    const finish = (error?: Error) => {
      if (completed) return;
      completed = true;
      if (error) reject(error);
      else resolve();
    };

    child.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(data);
      if (!completed && data.toString().includes('✔ done')) {
        setTimeout(() => {
          child.kill();
          finish();
        }, 500);
      }
    });
    child.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
    child.on('error', finish);
    child.on('close', (code) => {
      if (code === 0) finish();
      else finish(new Error(`vite build exited with code ${code ?? 'unknown'}`));
    });
  });
}

function usage() {
  console.log(`Build an EZPPLauncher release.

Usage:
  bun run release                 Build for the current platform
  bun run release:macos           Build the macOS app and DMG
  bun run release:windows         Build the Windows NSIS installer
  bun run release:linux           Build the Linux package

On macOS, release:windows cross-compiles using cargo-xwin. On Linux, use
release:linux on a Linux host; Linux bundles cannot be built from macOS.`);
}

const requested = process.argv[2]?.toLowerCase();
if (requested === '--help' || requested === '-h') {
  usage();
  process.exit(0);
}

let target: Target;
try {
  target = requested ? (requested as Target) : hostTarget();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!TARGETS.includes(target)) {
  console.error(`Unknown release target: ${requested}`);
  usage();
  process.exit(1);
}

const host = hostTarget();
if (target === 'macos' && host !== 'macos') {
  console.error('macOS releases must be built on macOS.');
  process.exit(1);
}
if (target === 'linux' && host !== 'linux') {
  console.error('Linux releases must be built on Linux. Use a Linux host or CI runner.');
  process.exit(1);
}

const env = { ...process.env };
if (host === 'macos') {
  prependExistingPath(env, '/opt/homebrew/opt/llvm/bin');
  prependExistingPath(env, '/usr/local/opt/llvm/bin');
  prependExistingPath(env, '/opt/homebrew/opt/nsis/bin');
  prependExistingPath(env, '/usr/local/opt/nsis/bin');
}
if (host !== 'windows') ensureUtf8Locale(env);
if (target === 'windows') selectRustupToolchain(env);

if (target === 'windows' && host !== 'windows') {
  const missing = windowsPrerequisites(env);
  if (missing.length > 0) {
    console.error('Windows cross-compilation is missing prerequisites:\n');
    for (const requirement of missing) console.error(`  - ${requirement}`);
    process.exit(1);
  }
}

const tauriArgs = ['x', 'tauri', 'build'];
if (target === 'windows') {
  tauriArgs.push('--bundles', 'nsis');
  if (host !== 'windows') tauriArgs.push('--runner', 'cargo-xwin', '--target', WINDOWS_TARGET);
}

const bun = findCommand('bun', env.PATH ?? '') ?? 'bun';
console.log(`Building the ${target} release from ${host}...`);

try {
  await run(bun, ['./scripts/sync-version.ts'], env);
  await buildFrontend(bun, env);

  if (target === 'linux') env.NO_STRIP = '1';
  await run(bun, tauriArgs, env);

  console.log(`\n✅ ${target} release built.`);
  console.log(`Artifacts: ${artifactDirectory(target)}`);
} catch (error) {
  console.error(`\n❌ Release build failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
