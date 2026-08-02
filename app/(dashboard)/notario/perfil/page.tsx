import { getCurrentProfile } from "@/lib/auth/helpers";
import { NotaryProfileClient } from "@/components/notary/notary-profile-client";

export default async function NotarioPerfilPage() {
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
      <NotaryProfileClient profile={profile} />
    </div>
  );
}
