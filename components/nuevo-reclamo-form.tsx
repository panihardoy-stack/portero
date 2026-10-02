"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOTON_PRIMARIO, CAMPO, FUENTE_DISPLAY } from "@/components/portero-ui";

const MAX_MB = 5;

export function NuevoReclamoForm({ unidadId }: { unidadId: number }) {
  const router = useRouter();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  // Vista previa local de la foto elegida (se libera al cambiarla)
  useEffect(() => {
    if (!foto) {
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  function elegirFoto(archivo: File | null) {
    setError(null);
    if (archivo && archivo.size > MAX_MB * 1024 * 1024) {
      setError(`La foto pesa más de ${MAX_MB} MB. Elegí una más liviana.`);
      if (inputFoto.current) inputFoto.current.value = "";
      return;
    }
    setFoto(archivo);
  }

  function quitarFoto() {
    setFoto(null);
    if (inputFoto.current) inputFoto.current.value = "";
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!descripcion.trim()) return;

    setEnviando(true);
    setError(null);
    setEnviado(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión venció. Volvé a iniciar sesión para enviar el reclamo.");
      setEnviando(false);
      return;
    }

    // 1. Subir la foto (si hay) a la carpeta del vecino en el bucket privado
    let fotoPath: string | null = null;
    if (foto) {
      const extension = foto.name.split(".").pop() ?? "jpg";
      fotoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: errorFoto } = await supabase.storage
        .from("fotos-reclamos")
        .upload(fotoPath, foto, { contentType: foto.type });

      if (errorFoto) {
        setError("No se pudo subir la foto. Probá de nuevo o enviá el reclamo sin foto.");
        setEnviando(false);
        return;
      }
    }

    // 2. Guardar el reclamo (RLS verifica que sea en la unidad del vecino)
    const { data: nuevo, error: errorReclamo } = await supabase
      .from("reclamos")
      .insert({
        descripcion: descripcion.trim(),
        unidad_id: unidadId,
        vecino_id: user.id,
        foto_path: fotoPath,
      })
      .select("id")
      .single();

    if (errorReclamo || !nuevo) {
      setError("No se pudo guardar el reclamo: " + (errorReclamo?.message ?? "sin respuesta"));
      setEnviando(false);
      return;
    }

    // 3. Pedir la sugerencia de la IA en segundo plano (el vecino no espera la respuesta)
    fetch("/api/clasificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reclamoId: nuevo.id }),
      keepalive: true,
    }).catch(() => {
      // Si falla, el admin lo clasifica a mano o vuelve a pedir la sugerencia
    });

    // 4. Limpiar el formulario y recargar los datos de la página
    setDescripcion("");
    quitarFoto();
    setEnviando(false);
    setEnviado(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-5 rounded-lg border border-[#DDE1DB] bg-white p-5 sm:p-6"
    >
      <div>
        <h2 className={`${FUENTE_DISPLAY} text-xl font-semibold`}>Nuevo reclamo</h2>
        <p className="mt-1 text-sm text-[#5B655F]">
          La administración lo recibe apenas lo enviás.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="descripcion" className="text-sm font-medium">
          ¿Qué pasa?
        </label>
        <textarea
          id="descripcion"
          required
          rows={4}
          value={descripcion}
          onChange={(e) => {
            setDescripcion(e.target.value);
            setEnviado(false);
          }}
          placeholder="Por ejemplo: pierde agua la canilla del baño"
          className={`${CAMPO} resize-y`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Foto</span>
        <input
          ref={inputFoto}
          id="foto"
          type="file"
          accept="image/*"
          onChange={(e) => elegirFoto(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        {vistaPrevia ? (
          <div className="flex items-center gap-3 rounded-md border border-[#DDE1DB] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vistaPrevia} alt="Vista previa de la foto" className="h-14 w-14 rounded object-cover" />
            <p className="min-w-0 flex-1 truncate text-sm">{foto?.name}</p>
            <button
              type="button"
              onClick={quitarFoto}
              className="rounded px-2 py-1 text-sm font-medium text-[#A3352B] hover:bg-[#F7E3E0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A3352B]"
            >
              Quitar
            </button>
          </div>
        ) : (
          <label
            htmlFor="foto"
            className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-[#CFD5CD] px-4 py-5 text-center transition-colors hover:border-[#1E4D3E] hover:bg-[#F8F9F7] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#1E4D3E]"
          >
            <span className="text-sm font-medium text-[#1E4D3E]">Agregar una foto</span>
            <span className="text-xs text-[#5B655F]">
              Ayuda a entender el problema. Opcional, hasta {MAX_MB} MB.
            </span>
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-[#F7E3E0] px-3 py-2 text-sm text-[#8E2C23]">
          {error}
        </p>
      )}
      {enviado && (
        <p role="status" className="rounded-md bg-[#E3F0E8] px-3 py-2 text-sm text-[#265A42]">
          Reclamo enviado. Su avance aparece en tu lista.
        </p>
      )}

      <button type="submit" disabled={enviando} className={`${BOTON_PRIMARIO} self-start`}>
        {enviando ? "Enviando…" : "Enviar reclamo"}
      </button>
    </form>
  );
}
