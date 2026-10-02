import { redirect } from "next/navigation";

// La portada lleva directo al panel; si no hay sesión, el panel manda al login.
export default function Home() {
  redirect("/protected");
}
