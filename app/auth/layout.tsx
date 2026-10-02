import Link from "next/link";
import { FUENTE_DISPLAY, Placa } from "@/components/portero-ui";

// Marco de todas las pantallas de ingreso: el portero eléctrico a la izquierda, el formulario a la derecha
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-[#F3F4F1] text-[#18211D] lg:grid-cols-2">
      <aside className="hidden flex-col justify-between gap-12 bg-[#1E4D3E] p-10 text-white lg:flex xl:p-14">
        <Logo claro />

        <PorteroElectrico />

        <div className="max-w-md">
          <p className={`${FUENTE_DISPLAY} text-3xl font-semibold leading-tight tracking-tight`}>
            Los reclamos del edificio, en un solo lugar.
          </p>
          <p className="mt-3 text-[#C9D9D1]">
            Los vecinos avisan con una foto. La administración asigna al proveedor y sigue cada
            reclamo hasta que se resuelve.
          </p>
        </div>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-10 md:px-10">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <Link
      href="/auth/login"
      className={`inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 ${
        claro ? "focus-visible:ring-white focus-visible:ring-offset-[#1E4D3E]" : "focus-visible:ring-[#1E4D3E]"
      }`}
    >
      <span
        aria-hidden
        className="h-5 w-7 rounded-[2px] border border-[#B8904F] bg-[linear-gradient(180deg,#F4E7CF,#E3CA9F)] shadow-[inset_0_0_0_1.5px_#F8EEDC]"
      />
      <span className={`${FUENTE_DISPLAY} text-xl font-semibold tracking-tight`}>Portero</span>
    </Link>
  );
}

// El tablero de timbres de la entrada de un edificio, con sus placas por unidad
function PorteroElectrico() {
  const pisos = [
    ["3A", "3B"],
    ["2A", "2B"],
    ["1A", "1B"],
  ];
  return (
    <div aria-hidden className="mx-auto w-64 rounded-lg border border-[#B8904F]/60 bg-[#173D31] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="mx-auto mb-5 grid w-24 grid-cols-6 gap-1.5">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#0F2B22]" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {pisos.map((piso) => (
          <div key={piso[0]} className="grid grid-cols-2 gap-3">
            {piso.map((unidad) => (
              <div key={unidad} className="flex items-center gap-2">
                <Placa unidad={unidad} />
                <span className="h-4 w-4 rounded-full border border-[#9C7638] bg-[radial-gradient(circle_at_35%_35%,#F4E7CF,#B8904F)]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
