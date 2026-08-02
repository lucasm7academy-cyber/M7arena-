export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-3xl space-y-6">
        <h1 className="font-headline text-5xl font-extrabold tracking-tight text-primary uppercase">
          M7Arena
        </h1>
        <p className="text-xl text-on-surface-variant max-w-xl mx-auto">
          A maior plataforma de torneios e campeonatos e-sports de League of Legends.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <a
            href="/campeonatos"
            className="px-6 py-3 bg-primary text-on-primary font-bold rounded-lg hover:brightness-110 transition-all m7-glow"
          >
            Ver Campeonatos
          </a>
          <a
            href="/partidas"
            className="px-6 py-3 bg-surface-variant text-on-background font-semibold rounded-lg border border-outline hover:border-primary transition-all"
          >
            Salas de Jogo
          </a>
        </div>
      </div>
    </main>
  );
}
