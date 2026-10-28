import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function openBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'kickstopper-capture-'));
  const process = spawn(globalThis.process.env.BROWSER_BIN || '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-popup-blocking', '--window-size=1440,1000', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  async function close() {
    socket?.close();
    if (process.pid && process.exitCode === null && process.signalCode === null) {
      process.kill('SIGTERM');
      await once(process, 'exit');
    }
    await rm(profile, { recursive: true, force: true });
  }
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error('Browser startup timed out.')), 15000);
      process.on('error', error => { clearTimeout(timer); reject(error); });
      process.on('exit', code => { clearTimeout(timer); reject(new Error(`Browser exited during startup (${code}).`)); });
      process.stderr.on('data', chunk => {
        output = (output + chunk).slice(-6000);
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    socket = new WebSocket(endpoint);
    await once(socket, 'open');
    let id = 0;
    const pending = new Map();
    const listeners = new Set();
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      const call = pending.get(message.id);
      if (!call) {
        listeners.forEach(listener => listener(message));
        return;
      }
      pending.delete(message.id);
      clearTimeout(call.timer);
      message.error ? call.reject(new Error(JSON.stringify(message.error))) : call.resolve(message.result);
    });
    const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const callId = ++id;
      const timer = setTimeout(() => {
        pending.delete(callId);
        reject(new Error(`Browser command timed out: ${method}`));
      }, 20000);
      pending.set(callId, { resolve, reject, timer });
      socket.send(JSON.stringify({ id: callId, method, params, sessionId }));
    });
    const evaluate = async (session, expression) => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const wait = async (session, expression, timeout = 20000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await evaluate(session, expression)) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(`Browser condition timed out: ${expression}`);
    };
    const newPage = async url => {
      const { targetId } = await command('Target.createTarget', { url });
      return (await command('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    };
    const onEvent = listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    return { command, evaluate, wait, newPage, close, onEvent };
  } catch (error) {
    await close();
    throw error;
  }
}
