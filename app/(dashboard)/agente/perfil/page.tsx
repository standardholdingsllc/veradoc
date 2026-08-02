import { getCurrentProfile } from "@/lib/auth/helpers";
import { ProfileSettingsClient } from "@/components/agente/profile-settings-client";

export default async function PerfilPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-[700px] px-4 py-8 md:px-8">
        <p className="text-sm text-muted">Perfil no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[700px] px-4 py-8 md:px-8">
      <h1 className="mb-8 text-xl font-semibold text-primary">
        Configuración de perfil
      </h1>
      <ProfileSettingsClient profile={profile} />
    </div>
  );
}
