"use client";

import { useEffect } from "react";

// Registers the service worker so the board is installable as a PWA.
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
