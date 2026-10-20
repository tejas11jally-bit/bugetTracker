"use client";

import { useEffect, useState } from "react";

// Service workers and web push only work in a secure context.
export default function SecureContextCheck() {
  const [secure, setSecure] = useState<boolean | null>(null);

  useEffect(() => {
    setSecure(window.isSecureContext);
  }, []);

  if (secure === null) return <span>Checking…</span>;
  return secure ? (
    <span className="font-semibold text-teal-700 dark:text-teal-400">Yes</span>
  ) : (
    <span className="font-semibold text-red-700 dark:text-red-400">
      No: push and install will fail
    </span>
  );
}
