"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_MB = 5;

export function NuevoReclamoForm({ unidadId }: { unidadId: number }) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!descripcion.trim()) return;

    setEnviando(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu sesión expiró. Volvé a iniciar sesión.");
      setEnviando(false);
      return;
    }

    // 1. Subir la foto (si hay) a la carpeta del vecino en el bucket privado
    let fotoPath: string | null = null;
    if (foto) {
      if (foto.size > MAX_MB * 1024 * 1024) {
        setError(`La foto pesa más de ${MAX_MB} MB.`);
        setEnviando(false);
        return;
      }
      const extension = foto.name.split(".").pop() ?? "jpg";
      fotoPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: errorFoto } = await supabase.storage
        .from("fotos-reclamos")
        .upload(fotoPath, foto, { contentType: foto.type });

      if (errorFoto) {
        setError("No se pudo subir la foto: " + errorFoto.message);
        setEnviando(false);
        return;
      }
    }

    // 2. Guardar el reclamo (RLS verifica que sea en la unidad del vecino)
    const { error: errorReclamo } = await supabase.from("reclamos").insert({
      descripcion: descripcion.trim(),
      unidad_id: unidadId,
      vecino_id: user.id,
      foto_path: fotoPath,
    });

    if (errorReclamo) {
      setError("No se pudo guardar el reclamo: " + errorReclamo.message);
      setEnviando(false);
      return;
    }

    // 3. Limpiar el formulario y recargar los datos de la página
    form.reset();
    setDescripcion("");
    setFoto(null);
    setEnviando(false);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-md border p-4">
      <label htmlFor="descripcion" className="text-sm font-medium">
        Nuevo reclamo
      </label>
      <textarea
        id="descripcion"
        required
        rows={3}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Ej: pierde agua la canilla del baño"
        className="rounded-md border p-2 text-sm bg-transparent"
      />

      <label htmlFor="foto" className="text-sm font-medium">
        Foto (opcional)
      </label>
      <input
        id="foto"
        type="file"
        accept="image/*"
        onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
        className="text-sm"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Enviar reclamo"}
      </button>
    </form>
  );
}