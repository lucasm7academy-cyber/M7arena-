import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { buscarJogadorCompleto } from "../../api/riot";
import { CUT_FRAME, CUT_FRAME_INNER } from "./constants";
import type {
  AvailabilityWindow,
  ChampionPoolEntry,
  PoolRole,
  RankSnapshot,
  RiotPlayer,
} from "./types";
import { submitTierlist } from "./api";
import { isValidAvailabilityWindow } from "./utils";
import { PlayerForm } from "./components/PlayerForm";
import { RiotLookup } from "./components/RiotLookup";
import { SubmitPanel } from "./components/SubmitPanel";
import { SuccessScreen } from "./components/SuccessScreen";
import { TierlistSection } from "./components/TierlistSection";

function toRank(ranqueadas: any[], queueType: string): RankSnapshot | null {
  if (!Array.isArray(ranqueadas)) return null;
  const entry = ranqueadas.find((item) => item?.queueType === queueType);
  if (!entry?.tier) return null;
  return {
    tier: String(entry.tier).toUpperCase(),
    rank: String(entry.rank ?? ""),
    lp: Number(entry.leaguePoints ?? 0),
    wins: Number(entry.wins ?? 0),
    losses: Number(entry.losses ?? 0),
  };
}

function scrollMainTo(top: number) {
  const main = document.querySelector("main");
  if (main instanceof HTMLElement) main.scrollTo({ top, behavior: "smooth" });
}

export function TierListExperience() {
  const [riotInput, setRiotInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [player, setPlayer] = useState<RiotPlayer | null>(null);

  const [fullName, setFullName] = useState("");
  const [contact, setContact] = useState("");
  const [primaryRole, setPrimaryRole] = useState<PoolRole>("MID");
  const [availability, setAvailability] = useState<AvailabilityWindow[]>([]);
  const [pool, setPool] = useState<ChampionPoolEntry[]>([]);
  const [website, setWebsite] = useState("");

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const detailsRef = useRef<HTMLDivElement>(null);
  const lookupSeq = useRef(0);

  useEffect(() => {
    document.title = "Tier List · M7 Academy";
    return () => {
      document.title = "M7 Arena";
    };
  }, []);

  const profileReady = fullName.trim().length >= 2 && contact.length >= 10 && availability.length > 0;
  const poolReady = pool.length >= 3;
  const canSubmit = Boolean(player) && profileReady && poolReady && !saving;

  function handlePrimaryRoleChange(role: PoolRole) {
    setPrimaryRole(role);
    setPool((prev) => prev.map((entry) => ({ ...entry, role })));
  }

  async function handleLookup() {
    if (lookupLoading) return;

    const raw = riotInput.trim();
    if (!raw) {
      setLookupError("Digite seu Riot ID para começar.");
      return;
    }
    if (!raw.includes("#")) {
      setLookupError("Use o formato Nome#TAG. Exemplo: Faker#BR1.");
      return;
    }

    const seq = ++lookupSeq.current;
    setLookupLoading(true);
    setLookupError("");
    setPlayer(null);

    try {
      const result = await buscarJogadorCompleto(raw);
      if (seq !== lookupSeq.current) return;

      if (!result.success) {
        setLookupError(result.error || "Não encontramos essa conta no servidor BR.");
        return;
      }

      const data = result.data;
      const hashIndex = data.riotId.lastIndexOf("#");
      const gameName = hashIndex > 0 ? data.riotId.slice(0, hashIndex) : data.riotId;
      const tagLine = hashIndex > 0 ? data.riotId.slice(hashIndex + 1) : "BR1";

      setRiotInput(data.riotId);
      setPlayer({
        riotId: data.riotId,
        puuid: data.puuid,
        gameName,
        tagLine,
        summonerLevel: data.nivel ?? null,
        profileIconId: data.iconeId ?? null,
        profileIconUrl: data.iconeUrl,
        solo: toRank(data.ranqueadas, "RANKED_SOLO_5x5"),
        flex: toRank(data.ranqueadas, "RANKED_FLEX_SR"),
      });

      window.setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (error: any) {
      if (seq === lookupSeq.current) {
        setLookupError(error?.message || "Não foi possível consultar a Riot agora. Tente novamente.");
      }
    } finally {
      if (seq === lookupSeq.current) setLookupLoading(false);
    }
  }

  function handleResetNick() {
    lookupSeq.current += 1;
    setPlayer(null);
    setLookupError("");
    window.setTimeout(() => scrollMainTo(0), 50);
  }

  async function handleSubmit() {
    if (!player) {
      toast.error("Busque seu Riot ID antes de enviar.");
      return;
    }
    if (!profileReady) {
      toast.error("Preencha seu nome, WhatsApp e disponibilidade.");
      return;
    }
    if (!poolReady) {
      toast.error("Adicione pelo menos 3 campeões na tier list.");
      return;
    }
    if (!availability.every(isValidAvailabilityWindow)) {
      toast.error("Confira os horários de disponibilidade.");
      return;
    }

    setSubmitError("");
    setSaving(true);

    try {
      await submitTierlist({
        riotId: player.riotId,
        puuid: player.puuid,
        gameName: player.gameName,
        tagLine: player.tagLine,
        summonerLevel: player.summonerLevel,
        profileIconId: player.profileIconId,
        solo: player.solo,
        flex: player.flex,
        fullName: fullName.trim(),
        contact,
        email: "",
        discord: "",
        primaryRole,
        secondaryRole: "",
        availability,
        championPool: pool.map((entry) => ({ ...entry, role: primaryRole })),
        notes: "",
        acceptedTerms: true,
        website,
      });
      setSubmitted(true);
      scrollMainTo(0);
    } catch (error: any) {
      const message = error?.message || "Não foi possível enviar sua tier list. Tente novamente.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function resetAll() {
    lookupSeq.current += 1;
    setSubmitted(false);
    setPlayer(null);
    setRiotInput("");
    setLookupError("");
    setFullName("");
    setContact("");
    setPrimaryRole("MID");
    setAvailability([]);
    setPool([]);
    setSubmitError("");
    setSaving(false);
  }

  if (submitted && player) {
    return (
      <SuccessScreen
        player={player}
        fullName={fullName}
        poolCount={pool.length}
        availability={availability}
        onRestart={resetAll}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <section
        className="relative overflow-hidden shadow-2xl shadow-black/40"
        style={{
          clipPath: CUT_FRAME,
          background:
            "linear-gradient(125deg, rgba(255,183,0,0.85) 0%, rgba(255,255,255,0.14) 42%, rgba(255,183,0,0.16) 100%)",
        }}
      >
        <div className="relative overflow-hidden bg-[#08080a]" style={{ clipPath: CUT_FRAME_INNER }}>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block">
            <img
              src="/images/tierlist/jhin.png"
              alt="Jhin"
              className="h-full w-full object-cover object-[center_18%] opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/25 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-[#08080a]/35" />
          </div>

          <div className="relative h-36 w-full overflow-hidden md:hidden">
            <img
              src="/images/tierlist/jhin.png"
              alt="Jhin"
              className="h-full w-full object-cover object-[center_18%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/25 to-transparent" />
          </div>

          <div className="relative z-10 p-6 md:p-9 md:pr-[48%]">
            <div className="flex items-center gap-3">
              <img
                src="/images/patrocinadores/m7-arena.png"
                alt="M7 Arena"
                className="h-10 w-auto object-contain md:h-11"
              />
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.26em] text-primary">M7 Academy</p>
                <h1 className="mt-1 text-2xl font-black uppercase leading-none tracking-tight text-white sm:text-3xl md:text-4xl">
                  Monte sua <span className="text-primary">Tier List</span>
                </h1>
              </div>
            </div>

            <RiotLookup
              input={riotInput}
              onInputChange={(value) => {
                setRiotInput(value);
                if (lookupError) setLookupError("");
              }}
              onSubmit={handleLookup}
              onReset={handleResetNick}
              loading={lookupLoading}
              error={lookupError}
              player={player}
            />
          </div>
        </div>
      </section>

      {player ? (
        <motion.div
          ref={detailsRef}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-8 space-y-8"
        >
          <PlayerForm
            fullName={fullName}
            setFullName={setFullName}
            contact={contact}
            setContact={setContact}
            primaryRole={primaryRole}
            setPrimaryRole={handlePrimaryRoleChange}
            availability={availability}
            setAvailability={setAvailability}
          />

          <TierlistSection pool={pool} setPool={setPool} primaryRole={primaryRole} />

          <SubmitPanel
            canSubmit={canSubmit}
            saving={saving}
            error={submitError}
            onSubmit={handleSubmit}
          />

          <div className="pb-8 text-center">
            <button
              type="button"
              onClick={resetAll}
              className="text-[10px] font-black uppercase tracking-widest text-white/25 transition-colors hover:text-primary"
            >
              Limpar formulário
            </button>
          </div>
        </motion.div>
      ) : null}

      <input
        type="text"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
      />
    </div>
  );
}
