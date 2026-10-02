import Link from "next/link";
import { EncabezadoAuth, LINK } from "@/components/auth-ui";

export default function Page() {
  return (
    <>
      <EncabezadoAuth
        titulo="Revisá tu mail"
        texto="Te mandamos un link para confirmar tu cuenta. Después de confirmarla, ya podés entrar."
      />
      <Link href="/auth/login" className={`${LINK} text-sm`}>
        Ir a iniciar sesión
      </Link>
    </>
  );
}
