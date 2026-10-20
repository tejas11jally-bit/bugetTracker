import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/setup");
  const hasPasskey = (await prisma.passkey.count()) > 0;
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-bold">Ledgerly</h1>
      <p className="mt-1 text-muted">Welcome back, {user.name}.</p>
      <LoginForm next={next ?? "/"} hasPasskey={hasPasskey} />
    </main>
  );
}
