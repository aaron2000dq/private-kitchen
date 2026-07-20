"use client";

import Link from "next/link";
import type * as React from "react";

export function AppLink({ prefetch = false, ...props }: React.ComponentProps<typeof Link>) {
  return <Link prefetch={prefetch} {...props} />;
}
