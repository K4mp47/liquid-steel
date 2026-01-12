import LiquidBackground from "@/components/LiquidBackground";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="opacity-70 scale-[100%] flex min-h-screen w-full flex-col items-center justify-between bg-white dark:bg-black sm:items-start">
        <LiquidBackground />
      </main>
    </div>
  );
}
