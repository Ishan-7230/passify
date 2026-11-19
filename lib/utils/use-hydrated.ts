"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
/** Prevent native submission or lost input before client form handlers are ready. */
export function useHydrated() { return useSyncExternalStore(subscribe,clientSnapshot,serverSnapshot); }
