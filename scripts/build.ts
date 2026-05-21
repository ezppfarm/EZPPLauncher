import { spawn } from 'child_process';

function runVite(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bunx', ['--bun', 'vite', 'build'], { stdio: ['inherit', 'pipe', 'pipe'] });

    proc.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(data);
      if (data.toString().includes('✔ done')) {
        setTimeout(() => {
          proc.kill();
          resolve();
        }, 500);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
    proc.on('close', (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`vite build exited with code ${code}`));
    });
  });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

await run('bun', ['./scripts/sync-version.ts']);
await runVite();
await run('bunx', ['tauri', 'build']);
