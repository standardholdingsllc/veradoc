"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CertificarRedirectPage() {
  const params = useParams<{ packetId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/demo/notario/paquetes/${params.packetId}#decision`);
  }, [params.packetId, router]);

  return null;
}
