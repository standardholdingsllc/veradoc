import { createClient } from "@/lib/supabase/server";
import { WizardClient } from "@/components/agente/wizard-client";
import { isDemoPaymentsEnabled } from "@/lib/env/server";
import { getPacketPricing } from "@/lib/services/pricing-service";
import { publicEnv } from "@/lib/env/public";

export default async function NuevoPaquetePage() {
  const supabase = await createClient();
  const { data: coverage } = await supabase
    .from("notary_coverage")
    .select("province")
    .eq("active", true);

  const coveredProvinces = coverage?.map((c) => c.province) ?? [];
  const pricing = await getPacketPricing();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const realtorEmail = user?.email ?? "";

  return (
    <WizardClient
      coveredProvinces={coveredProvinces}
      feeAmount={pricing.amountCentimos / 100}
      serviceWindowDays={pricing.serviceWindowDays}
      includedServices={pricing.includedServices}
      excludedServices={pricing.excludedServices}
      demoPaymentsEnabled={isDemoPaymentsEnabled()}
      mercadoPagoPublicKey={publicEnv.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? ""}
      realtorEmail={realtorEmail}
    />
  );
}
