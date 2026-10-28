import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkpoints } from './checkpoints.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runner = fileURLToPath(new URL('../../scripts/demo', import.meta.url));
const format = '{{.Label "com.docker.compose.project"}}\t{{.State}}\t{{.Status}}';

export class PresenterError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export function runCommand(command, args, { cwd = root, onOutput = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, env: { ...process.env, NO_COLOR: '1' } });
    let output = '';
    const collect = chunk => {
      const text = chunk.toString();
      output = (output + text).slice(-65536);
      onOutput(text);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(' ')} failed (exit ${code}).\n${output.trim()}`));
    });
  });
}

export function parseInventory(output) {
  const rows = output.trim().split('\n').filter(Boolean).map(line => {
    const [project, state, status] = line.split('\t');
    return { project, state, status };
  });
  return checkpoints.flatMap(checkpoint => {
    const containers = rows.filter(row => row.project === `kickstopper-${checkpoint.directory}`);
    const active = containers.some(row => ['running', 'restarting', 'paused'].includes(row.state));
    if (!active) return [];
    return [{
      id: checkpoint.id,
      ready: containers.length === checkpoint.containers &&
        containers.every(row => row.state === 'running' && row.status?.includes('(healthy)')),
    }];
  });
}

export function createController({ run = runCommand } = {}) {
  let operation = null;
  let task = Promise.resolve();
  const inventory = async () => parseInventory(await run('docker', [
    'ps', '-a', '--filter', 'label=com.docker.compose.project', '--format', format,
  ]));
  const log = text => { operation.log = (operation.log + text).slice(-24000); };
  const demo = (command, id) => run(runner, [command, id], { onOutput: log });

  async function performSwitch(target) {
    let previous = null;
    let touchedStacks = false;
    try {
      const active = await inventory();
      previous = active.length === 1 && active[0].ready ? active[0].id : null;
      if (previous === target.id) {
        operation.phase = 'complete';
        log(`Checkpoint ${target.id} is already healthy. No restart needed.\n`);
        return;
      }

      operation.phase = 'checking';
      log(`Checking prepared images for checkpoint ${target.id}...\n`);
      const cwd = fileURLToPath(new URL(`../../checkpoints/${target.directory}/`, import.meta.url));
      const images = (await run('docker', ['compose', 'config', '--images'], { cwd }))
        .trim().split('\n').filter(Boolean);
      if (!images.length) throw new Error('The target Compose configuration returned no images.');
      await run('docker', ['image', 'inspect', '--format', '{{.Id}}', ...images]);

      for (const checkpoint of active) {
        operation.phase = 'stopping';
        log(`\nStopping checkpoint ${checkpoint.id}; its data is preserved.\n`);
        touchedStacks = true;
        await demo('stop', checkpoint.id);
      }
      operation.phase = 'starting';
      touchedStacks = true;
      log(`\nStarting checkpoint ${target.id} and waiting for health checks...\n`);
      await demo('start', target.id);
      const started = await inventory();
      if (started.length !== 1 || started[0].id !== target.id || !started[0].ready) {
        throw new Error(`Checkpoint ${target.id} did not become the only healthy running checkpoint.`);
      }
      operation.phase = 'complete';
      log(`\nCheckpoint ${target.id} is ready.\n`);
    } catch (error) {
      operation.error = error.message;
      log(`\nSWITCH FAILED: ${error.message}\n`);
      if (!touchedStacks) {
        log(`Prepare the target in a terminal: ./scripts/demo prepare ${target.id}\nThe running demo was not stopped.\n`);
      } else if (previous && previous !== target.id) {
        operation.phase = 'restoring';
        log(`\nRestoring checkpoint ${previous}...\n`);
        try {
          await demo('stop', target.id);
          await demo('start', previous);
          log(`Checkpoint ${previous} restored. The requested switch still failed.\n`);
        } catch (restoreError) {
          operation.error += `\nRestoring checkpoint ${previous} also failed: ${restoreError.message}`;
          log(`\nRESTORE FAILED: ${restoreError.message}\nUse ./scripts/demo status in a terminal before continuing.\n`);
        }
      }
      operation.phase = 'failed';
    }
  }

  return {
    async status() {
      const active = await inventory();
      return {
        active,
        current: active.length === 1 ? active[0].id : null,
        ready: active.length === 1 && active[0].ready,
        busy: operation !== null && !['complete', 'failed'].includes(operation.phase),
        operation: operation ? { ...operation } : null,
      };
    },
    switchTo(id) {
      const target = checkpoints.find(checkpoint => checkpoint.id === id);
      if (!target) throw new PresenterError('Choose a checkpoint from 00 through 06.', 400);
      if (operation && !['complete', 'failed'].includes(operation.phase)) {
        throw new PresenterError('A checkpoint switch is already in progress.', 409);
      }
      operation = { target: id, phase: 'checking', error: null, log: '' };
      task = performSwitch(target);
      return { accepted: true, target: id };
    },
    async settled() { await task; },
  };
}
