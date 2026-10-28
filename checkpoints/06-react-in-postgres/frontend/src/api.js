import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api-client.js';
export { api };
export const ResourceContext = createContext(null);

export function useResource(path, interval = 0) {
  const resources = useContext(ResourceContext);
  const initial = () => ({ data: resources?.[path] ?? null, error: null, loading: resources?.[path] === undefined });
  const [state, setState] = useState(initial);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState(initial());
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
  }, [path, interval, revision, resources]);
  return { ...state, refresh };
}

function groupedInteger(value) {
  if (!Number.isSafeInteger(value)) throw new TypeError('Expected a safe integer for the demo formatter.');
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const dollars = cents => {
  const amount = Number(cents);
  if (typeof Intl !== 'undefined') return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: amount % 100 ? 2 : 0, maximumFractionDigits: 2,
  }).format(amount / 100);
  // This plv8 build has no ICU/Intl; the product uses only integer USD cents.
  if (!Number.isSafeInteger(amount)) throw new TypeError('Expected integer cents.');
  const absolute = Math.abs(amount);
  const fraction = absolute % 100;
  return `${amount < 0 ? '-$' : '$'}${groupedInteger(Math.floor(absolute / 100))}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
};
export const number = value => typeof Intl !== 'undefined'
  ? new Intl.NumberFormat('en-US').format(Number(value))
  : groupedInteger(Number(value));
export const daysLeft = deadline => Math.max(0, Math.ceil((new Date(deadline) - Date.now()) / 86400000));
