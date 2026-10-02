import { Suspense } from "react";
import Link from "next/link";
import { EncabezadoAuth, LINK } from "@/components/auth-ui";

async function Detalle({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (!params?.error) return null;
  return <p className="mb-6 rounded-md bg-[#EEF0EC] px-3 py-2 text-xs text-[#5B655F]">Código: {params.error}</p>;
}

export default function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <>
      <EncabezadoAuth
        titulo="No se pudo completar"
        texto="El link puede haber vencido o ya se usó. Pedí uno nuevo o iniciá sesión de nuevo."
      />
      <Suspense>
        <Detalle searchParams={searchParams} />
      </Suspense>
      <Link href="/auth/login" className={`${LINK} text-sm`}>
        Volver a iniciar sesión
      </Link>
    </>
  );
}
