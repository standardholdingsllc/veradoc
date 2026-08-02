import { createClient } from "@/lib/supabase/server";
import { WizardClient } from "@/components/agente/wizard-client";
import { publicEnv } from "@/lib/env/public";
import { isDemoPaymentsEnabled } from "@/lib/env/server";

export default async function NuevoPaquetePage() {
  const supabase = await createClient();
  const { data: coverage } = await supabase
    .from("notary_coverage")
    .select("province")
    .eq("active", true);

  const { data: { user } } = await supabase.auth.getUser();

  const coveredProvinces = coverage?.map((c) => c.province) ?? [];

  return (
    <WizardClient
      coveredProvinces={coveredProvinces}
      culqiPublicKey={publicEnv.NEXT_PUBLIC_CULQI_PUBLIC_KEY}
      userEmail={user?.email ?? undefined}
      demoPaymentsEnabled={isDemoPaymentsEnabled()}
    />
  );
}
