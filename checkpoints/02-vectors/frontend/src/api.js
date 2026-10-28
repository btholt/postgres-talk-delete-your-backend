import { useCallback, useEffect, useState } from 'react';

export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

export function useResource(path, interval = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });
    async function load() {
      try {
        const data = await api(path, { signal: controller.signal });
        setState({ data, error: null, loading: false });
      } catch (error) {
        if (error.name !== 'AbortError') setState(previous => ({ ...previous, error: error.message, loading: false }));
      }
    }
    load();
    const timer = interval ? setInterval(load, interval) : null;
    return () => { controller.abort(); clearInterval(timer); };
  }, [path, interval, revision]);
  return { ...state, refresh };
}

export const dollars = cents => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: Number(cents) % 100 ? 2 : 0, maximumFractionDigits: 2,
}).format(Number(cents) / 100);

export const number = value => new Intl.NumberFormat('en-US').format(Number(value));
export const daysLeft = deadline => Math.max(0, Math.ceil((new Date(deadline) - Date.now()) / 86400000));
