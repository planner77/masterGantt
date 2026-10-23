import { useState, type Dispatch, type SetStateAction } from "react";

/** Peer screens retain their draft filters and expansion without remounting the host. */
export function useLogisticsViewState<T>(view: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [initialValue] = useState(initial);
  const [states, setStates] = useState<Record<string, T>>({});
  const value = Object.prototype.hasOwnProperty.call(states, view) ? states[view] : initialValue;
  return [value, next => setStates(previous => {
    const current = Object.prototype.hasOwnProperty.call(previous, view) ? previous[view] : initialValue;
    return { ...previous, [view]: typeof next === "function" ? (next as (value: T) => T)(current) : next };
  })];
}
