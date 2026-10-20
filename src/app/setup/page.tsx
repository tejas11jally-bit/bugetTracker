import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import SetupForm from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-3xl font-bold">Welcome to Ledgerly</h1>
      <p className="mt-2 text-muted">Set up your account, then log your first purchase. Base currency is AED.</p>
      <SetupForm />
    </main>
  );
}
