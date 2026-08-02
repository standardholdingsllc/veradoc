import { requireApproved } from "@/lib/auth/guards";
import { getNotaryEarnings } from "@/lib/actions/notary";
import { EarningsClient } from "@/components/notary/earnings-client";

export default async function NotarioGananciasPage() {
  const profile = await requireApproved("notary");
  const earnings = await getNotaryEarnings(profile.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-primary">Ganancias</h1>
        <p className="mt-1 text-sm text-muted">
          Resumen mensual de certificaciones y estimado de pago.
        </p>
      </div>
      <EarningsClient months={earnings} />
    </div>
  );
}
