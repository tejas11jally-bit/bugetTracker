export default function Offline() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-muted">Open Quick add to log a purchase. It will sync when you&apos;re back online.</p>
      <a href="/add" className="mt-6 inline-block rounded-xl bg-accent px-4 py-2.5 font-semibold text-white">
        Quick add
      </a>
    </main>
  );
}
