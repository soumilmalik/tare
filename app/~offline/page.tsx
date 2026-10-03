export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-text-1">You&apos;re offline</p>
      <p className="text-sm text-text-2">Connect to the internet and reopen Tare.</p>
    </main>
  );
}
