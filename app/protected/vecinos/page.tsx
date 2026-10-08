import { exigirAdmin } from "@/lib/datos/sesion";
import { listarVecinosAdmin } from "@/lib/datos/vecinos";
import { obtenerCatalogos } from "@/lib/datos/catalogos";
import { ClasificarVecino } from "@/components/clasificar-vecino";
import { EstadoVacio } from "@/components/estado-vacio";
import { FUENTE_DISPLAY, Placa } from "@/components/portero-ui";
import { CodigoInvitacion } from "@/components/codigo-invitacion";

// Solo el admin: perfil de cada vecino, que ajusta la urgencia de sus reclamos
export default async function VecinosPage() {
  const { supabase } = await exigirAdmin();
  const [vecinos, catalogos, edificiosRes] = await Promise.all([
    listarVecinosAdmin(supabase),
    obtenerCatalogos(),
    supabase.from("edificios").select("id, nombre, codigo_invitacion").order("nombre"),
  ]);
  const edificios = edificiosRes.data ?? [];
  const conAjuste = catalogos.tiposVecino.filter((t) => t.sube_niveles > 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#5B655F]">Solo lo ve la administración</p>
          <h1 className={`${FUENTE_DISPLAY} mt-1 text-3xl font-semibold tracking-tight`}>Vecinos</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {edificios.map((e) => (
            <CodigoInvitacion key={e.id} codigo={e.codigo_invitacion} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Cómo afecta cada perfil">
        {conAjuste.map((t) => (
          <div key={t.codigo} className="rounded-lg border border-[#DDE1DB] bg-white p-4">
            <p className="font-semibold">{t.nombre}</p>
            <p className="mt-1 text-sm text-[#5B655F]">{t.descripcion}</p>
            <p className="mt-2 text-sm text-[#7A4F12]">
              Sube {t.sube_niveles === 1 ? "un nivel" : `${t.sube_niveles} niveles`} la urgencia
              {t.categorias
                ? ` en ${t.categorias.map((c) => catalogos.categorias.find((x) => x.codigo === c)?.nombre ?? c).join(", ").toLowerCase()}`
                : " en cualquier categoría"}
              .
            </p>
          </div>
        ))}
      </section>

      {vecinos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay vecinos en tus edificios"
          texto="Compartí el código del edificio: cuando un vecino se una con él, aparece acá."
        />
      ) : (
        <ul className="divide-y divide-[#E6E9E4] overflow-hidden rounded-lg border border-[#DDE1DB] bg-white">
          {vecinos.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Placa unidad={v.unidad} />
                <p className="truncate font-medium">{v.nombre ?? "Sin nombre"}</p>
              </div>
              <ClasificarVecino vecinoId={v.id} tipo={v.tipo} motivo={v.motivo} />
            </li>
          ))}
        </ul>
      )}

      <p className="max-w-prose text-xs text-[#5B655F]">
        El perfil es un dato personal (ley 18.331): usalo con criterios observables y anotá el motivo. El vecino no lo ve,
        y la decisión final sobre cada reclamo siempre es de la administración.
      </p>
    </div>
  );
}
