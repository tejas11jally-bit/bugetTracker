"use client";

import { useEffect } from "react";

/** Scrolls an element into view without a URL #fragment (fragments stop server-action refreshes). */
export default function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "center" });
  }, [id]);
  return null;
}
