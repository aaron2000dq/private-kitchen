"use client";

import * as React from "react";

export function PwaBootstrap() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NEXT_PUBLIC_STATIC_EXPORT !== "1") return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const register = () => {
      void navigator.serviceWorker.register(`${basePath}/sw.js`, {
        scope: `${basePath || ""}/`,
      }).catch(() => undefined);
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
