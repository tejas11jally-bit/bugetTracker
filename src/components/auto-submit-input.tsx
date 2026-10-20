"use client";

import type { InputHTMLAttributes } from "react";

/** Submits its form when the value changes and the field loses focus (or Enter). */
export function AutoSubmitInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onBlur={(e) => {
        if (e.currentTarget.value !== String(props.defaultValue ?? "")) e.currentTarget.form?.requestSubmit();
      }}
    />
  );
}

export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
