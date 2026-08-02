import { requireApproved } from "@/lib/auth/guards";
import { getNotaryQueue } from "@/lib/actions/notary";
import { NotaryQueueClient } from "@/components/notary/notary-queue-client";

export default async function NotarioDashboardPage() {
  const profile = await requireApproved("notary");
  const queue = await getNotaryQueue(profile.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-primary">
          Panel del notario
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cola de paquetes asignados para revisión notarial.
        </p>
      </div>
      <NotaryQueueClient items={queue} />
    </div>
  );
}
