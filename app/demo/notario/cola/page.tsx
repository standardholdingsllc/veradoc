"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ColaNotarialRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/demo/notario");
  }, [router]);

  return null;
}
