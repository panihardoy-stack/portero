"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SalirButton() {
  const router = useRouter();

  async function salir() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={salir}
      className="rounded-md border border-[#DDE1DB] px-3 py-1.5 text-sm font-medium text-[#18211D] transition-colors hover:bg-[#F3F4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E4D3E]"
    >
      Salir
    </button>
  );
}
