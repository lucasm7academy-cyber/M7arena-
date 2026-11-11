import { useEffect, useState } from 'react';
import { Check, Plus, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { useSound } from '../../../../hooks/useSound';
import { buildProfileIconUrl, buscarJogadorCompleto } from '../../../../api/riot';
import { type Role } from '../../../../components/players/playerMeta';
import { type Membro } from '../../roster';
import { ModalBase } from './ModalBase';

const MODAL_ROLES = ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'R1', 'R2', 'COACH'] as const;
type ModalRole = typeof MODAL_ROLES[number];

const MODAL_ROLE_CONFIG: Record<ModalRole, { label: string; img: string; color: string; bg: string }> = {
  TOP: { label: 'TOP', img: '/lanes_brancas/Top_iconB.png', color: 'text-red-400', bg: 'bg-red-400/10' },
  JG: { label: 'JG', img: '/lanes_brancas/Jungle_iconB.png', color: 'text-green-400', bg: 'bg-green-400/10' },
  MID: { label: 'MID', img: '/lanes_brancas/Middle_iconB.png', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  ADC: { label: 'ADC', img: '/lanes_brancas/Bottom_iconB.png', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  SUP: { label: 'SUP', img: '/lanes_brancas/Support_iconB.png', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  R1: { label: 'R1', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  R2: { label: 'R2', img: '/lanes_brancas/icon-position-fillB.png', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  COACH: { label: 'COACH', img: '/lanes_brancas/coach_iconB.svg', color: 'text-purple-400', bg: 'bg-purple-400/10' },
};

interface InvitePlayerModalProps {
  membros: Membro[];
  gradientFrom: string;
  onClose: () => void;
  onAddPlayer: (players: Membro[]) => Promise<{ ok: boolean; error?: string }>;
}

export const InvitePlayerModal = ({
  membros,
  gradientFrom,
  onClose,
  onAddPlayer,
}: InvitePlayerModalProps) => {
  const { playSound } = useSound();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [pendingPlayers, setPendingPlayers] = useState<any[]>([]);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); setNotFound(false); return; }
    setSearching(true); setNotFound(false);
    const timer = setTimeout(async () => {
      // Buscar localmente nas contas Riot via API própria (jogadores cadastrados)
      let data: any[] = [];
      try {
        data = await api.players.search(query);
      } catch (err) {
        console.error('❌ Erro ao buscar jogadores:', err);
      }

      if (data && data.length > 0) {
        setSearchResults(data.map(p => ({ ...p, is_guest: false })));
        setSearching(false);
        setNotFound(false);
      } else {
        // Se não achou local e tem hashtag, tenta API da Riot
        if (query.includes('#')) {
          try {
            const res = await buscarJogadorCompleto(query.trim());
            setSearching(false);
            if (res.success && res.data) {
              setSearchResults([{
                user_id: null,
                riot_id: res.data.riotId,
                profile_icon_id: res.data.iconeId,
                level: res.data.nivel,
                puuid: res.data.puuid,
                eloData: res.data.ranqueadas,
                is_guest: true
              }]);
              setNotFound(false);
            } else {
              // Não existe nem na Riot: entra DIRETO como convidado manual
              // (sem conta em lugar nenhum — não precisa de botão).
              setSearchResults([]);
              const [nick, tag] = query.trim().split('#');
              if (nick && tag && tag.length >= 3) {
                addManualGuest(query);
                setNotFound(false);
              } else {
                setNotFound(true);
              }
            }
          } catch {
            setSearching(false);
            setSearchResults([]);
            const [nick, tag] = query.trim().split('#');
            if (nick && tag && tag.length >= 3) {
              addManualGuest(query);
              setNotFound(false);
            } else {
              setNotFound(true);
            }
          }
        } else {
          setSearching(false);
          setSearchResults([]);
          setNotFound(true);
        }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectSearchResult = (p: any) => {
    playSound('click');
    const alreadyPending = pendingPlayers.some(item => item.riot_id === p.riot_id);
    if (alreadyPending) {
      setError('Jogador já está na lista de adições pendentes.');
      return;
    }

    const existingMember = membros.find(m => m.riotId === p.riot_id);
    let initialRole: ModalRole = 'R1';
    if (existingMember) {
      if (existingMember.role === 'RES') {
        const reserves = membros.filter(m => m.role === 'RES');
        const resIndex = reserves.findIndex(m => m.riotId === p.riot_id);
        initialRole = resIndex === 1 ? 'R2' : 'R1';
      } else {
        initialRole = existingMember.role as ModalRole;
      }
    }

    setPendingPlayers(prev => [...prev, {
      ...p,
      selectedRole: initialRole,
      isExisting: !!existingMember
    }]);

    setQuery('');
    setSearchResults([]);
    setError(null);
  };

  const handleRemovePending = (riotId: string) => {
    playSound('click');
    setPendingPlayers(prev => prev.filter(p => p.riot_id !== riotId));
    setError(null);
  };

  const handleRoleChange = (riotId: string, role: ModalRole) => {
    playSound('click');
    setPendingPlayers(prev => prev.map(p => {
      if (p.riot_id === riotId) {
        return { ...p, selectedRole: role };
      }
      return p;
    }));
    setError(null);
  };

  const handleAddDirectly = async () => {
    if (pendingPlayers.length === 0) return;
    setError(null);

    let finalMembers = [...membros];

    for (const pending of pendingPlayers) {
      const selectedRole = pending.selectedRole;
      const dbRole = (selectedRole === 'R1' || selectedRole === 'R2') ? 'RES' : selectedRole;

      let eloStr = '';
      if (pending.is_guest) {
        if (pending.eloData) {
          const soloRank = pending.eloData.find((e: any) => e.queueType === 'RANKED_SOLO_5x5');
          if (soloRank) eloStr = `${soloRank.tier} ${soloRank.rank ?? ''}`.trim();
        } else if (pending.elo_cache) {
          eloStr = pending.elo_cache;
        }
      } else {
        const solo = pending.elo_cache?.soloQ;
        if (solo?.tier) eloStr = `${solo.tier} ${solo.rank ?? ''}`.trim();
      }

      const existingIndex = finalMembers.findIndex(m => m.riotId === pending.riot_id);

      if (existingIndex !== -1) {
        finalMembers[existingIndex] = {
          ...finalMembers[existingIndex],
          role: dbRole,
          cargo: dbRole === 'COACH' ? 'coach' : 'jogador',
        };
      } else {
        const newMember: Membro = {
          userId:   pending.user_id,
          riotId:   pending.riot_id,
          role:     dbRole,
          cargo:    dbRole === 'COACH' ? 'coach' : 'jogador',
          isLeader: false,
          elo:      eloStr || 'UNRANKED',
          balance:  0,
          iconeId:  pending.profile_icon_id ?? 1,
          puuid:    pending.puuid ?? undefined,
        };
        finalMembers.push(newMember);
      }
    }

    const activePlayers = finalMembers.filter(m => m.role !== 'COACH');
    if (activePlayers.length > 8) {
      setError('O time não pode ter mais de 8 jogadores (incluindo titulares e reservas).');
      return;
    }

    const roleCounts: Record<Role, number> = {
      TOP: 0, JG: 0, MID: 0, ADC: 0, SUP: 0, RES: 0, COACH: 0
    };
    for (const m of finalMembers) {
      roleCounts[m.role]++;
    }

    if (roleCounts.TOP > 1) { setError('Apenas 1 jogador pode ocupar a rota TOP.'); return; }
    if (roleCounts.JG > 1) { setError('Apenas 1 jogador pode ocupar a rota JG.'); return; }
    if (roleCounts.MID > 1) { setError('Apenas 1 jogador pode ocupar a rota MID.'); return; }
    if (roleCounts.ADC > 1) { setError('Apenas 1 jogador pode ocupar a rota ADC.'); return; }
    if (roleCounts.SUP > 1) { setError('Apenas 1 jogador pode ocupar a rota SUP.'); return; }
    if (roleCounts.RES > 3) { setError('Máximo de 3 reservas atingido.'); return; }
    if (roleCounts.COACH > 1) { setError('Apenas 1 coach é permitido.'); return; }

    setSending(true);

    const res = await onAddPlayer(finalMembers);
    setSending(false);
    if (!res?.ok) {
      setError(res?.error || 'Erro ao salvar no banco de dados. Verifique a conexão.');
      return;
    }

    playSound('success');
    setSent(true);
    setTimeout(onClose, 1500);
  };

  // Adiciona um convidado manual direto na lista de pendentes (sem conta, sem
  // resultado de busca). Usado pelo AUTO-ADD quando a busca não encontra nada.
  const addManualGuest = (riotId: string) => {
    playSound('click');
    const guestPlayer = {
      user_id: null,
      riot_id: riotId.trim(),
      profile_icon_id: 1,
      level: 1,
      is_guest: true,
      elo_cache: 'UNRANKED',
      is_manual: true
    };

    const alreadyPending = pendingPlayers.some(item => item.riot_id === guestPlayer.riot_id);
    if (alreadyPending) {
      setError('Jogador já está na lista de adições pendentes.');
      return;
    }

    const existingMember = membros.find(m => m.riotId === guestPlayer.riot_id);
    let initialRole: ModalRole = 'R1';
    if (existingMember) {
      if (existingMember.role === 'RES') {
        const reserves = membros.filter(m => m.role === 'RES');
        const resIndex = reserves.findIndex(m => m.riotId === guestPlayer.riot_id);
        initialRole = resIndex === 1 ? 'R2' : 'R1';
      } else {
        initialRole = existingMember.role as ModalRole;
      }
    }

    setPendingPlayers(prev => [...prev, {
      ...guestPlayer,
      selectedRole: initialRole,
      isExisting: !!existingMember
    }]);

    setQuery('');
    setError(null);
  };

  return (
    <ModalBase onClose={onClose} gradientFrom={gradientFrom}>
      <div className="space-y-5">
        <div className="border-b border-white/5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl p-[1px] flex items-center justify-center shrink-0"
              style={{
                background: gradientFrom
              }}
            >
              <div
                className="w-full h-full bg-[#08080a] rounded-[11px] flex items-center justify-center"
              >
                <UserPlus className="w-5 h-5" style={{ color: gradientFrom }} />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-white">Adicionar Jogadores</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Busque por Riot ID e monte seu time</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white p-1 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 flex items-center gap-3">
            <X className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-400 text-xs font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-white/40 text-[10px] font-black uppercase tracking-widest block">1. Buscar Player</label>
          <div className="relative flex items-center bg-[#0c0c10] border border-white/10 rounded-xl focus-within:border-white/25 transition-colors">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setError(null); }}
              placeholder="Riot ID (ex: Kami#BR1)"
              className="w-full bg-transparent pl-10 pr-10 py-3 text-white text-xs font-semibold placeholder:text-white/25 focus:outline-none"
            />
            {searching && <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 animate-spin" />}
          </div>

          {query.length >= 2 && !searching && (
            <div className="mt-2">
              {notFound ? (
                <div className="bg-[#0c0c10] border border-white/10 rounded-xl p-4 text-center space-y-2.5">
                  <p className="text-white/40 text-xs font-medium">
                    {query.includes('#')
                      ? 'Riot ID incompleto — continue digitando (ex: Kami#BR1)'
                      : 'Digite o Riot ID completo (ex: Kami#BR1)'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  {searchResults.map((p, idx) => {
                    const iconUrl = p.profile_icon_id ? buildProfileIconUrl(p.profile_icon_id) : null;
                    return (
                      <button
                        key={p.user_id || idx}
                        onClick={() => handleSelectSearchResult(p)}
                        className="w-full flex items-center justify-between bg-[#0c0c10] hover:bg-[#121218] border border-white/10 hover:border-white/20 rounded-xl p-2.5 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg p-[1px] flex items-center justify-center shrink-0 border border-white/10 overflow-hidden bg-[#08080a]"
                          >
                            {iconUrl ? (
                              <img src={iconUrl} alt="" className="w-full h-full object-cover" loading="lazy" width={32} height={32} />
                            ) : (
                              <span className="text-white/60 text-xs font-bold">{p.riot_id.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-white text-xs font-bold">{p.riot_id}</p>
                            <p className="text-[9px] text-white/40 uppercase font-semibold">
                              {p.is_guest ? 'Riot API (Convidado)' : p.level ? `Nível ${p.level} (Cadastrado)` : 'Cadastrado'}
                            </p>
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-white/30" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {pendingPlayers.length > 0 && (
          <div className="space-y-2.5">
            <label className="text-white/40 text-[10px] uppercase tracking-widest font-black flex justify-between items-center">
              <span>2. Jogadores Pendentes ({pendingPlayers.length})</span>
              <button onClick={() => setPendingPlayers([])} className="text-red-400 hover:text-red-300 text-[10px] font-bold lowercase cursor-pointer">Limpar todos</button>
            </label>
            <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
              {pendingPlayers.map((p, idx) => {
                const iconUrl = p.profile_icon_id ? buildProfileIconUrl(p.profile_icon_id) : null;
                return (
                  <div
                    key={p.riot_id || idx}
                    className="bg-[#0c0c10] border border-white/10 rounded-xl p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg p-[1px] flex items-center justify-center shrink-0 border border-white/10 overflow-hidden bg-[#08080a]"
                        >
                          {iconUrl ? (
                            <img src={iconUrl} loading="lazy" alt="" className="w-full h-full object-cover" width={36} height={36} />
                          ) : (
                            <span className="text-white/60 text-xs font-bold">{p.riot_id.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white text-xs font-bold leading-none">{p.riot_id}</p>
                            {p.isExisting && (
                              <span
                                className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded"
                              >
                                Já no time
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-white/40 mt-1 uppercase font-semibold">
                            {p.is_manual ? 'Convidado Manual' : p.is_guest ? 'Convidado (Riot API)' : `Cadastrado (Nível ${p.level})`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleRemovePending(p.riot_id)} className="text-white/30 hover:text-red-400 p-1 transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-white/30 text-[9px] font-black uppercase tracking-wider">Definir Posição:</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {MODAL_ROLES.map(role => {
                          const cfg = MODAL_ROLE_CONFIG[role];
                          const isSelected = p.selectedRole === role;
                          return (
                            <button
                              key={role}
                              onClick={() => handleRoleChange(p.riot_id, role)}
                              title={cfg.label}
                              className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-white/10 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                                  : 'bg-white/5 border-white/5 hover:border-white/15'
                              }`}
                            >
                              <img src={cfg.img} alt={cfg.label} className={`w-4 h-4 object-contain ${isSelected ? 'opacity-100' : 'opacity-30'}`} />
                              <span className="text-[9px] font-black mt-1" style={{ color: isSelected ? 'white' : 'rgba(255,255,255,0.3)' }}>{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/5 border border-white/10 text-white/60 text-xs font-black uppercase tracking-wider hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleAddDirectly}
            disabled={pendingPlayers.length === 0 || sent || sending}
            className="flex-[1.5] py-3 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            style={{
              backgroundColor: gradientFrom || '#FFB700',
              boxShadow: `0 0 25px -5px ${gradientFrom || '#FFB700'}66`
            }}
          >
            {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</> : sent ? <><Check className="w-4 h-4" /> Salvo com sucesso!</> : <><Check className="w-4 h-4" /> Salvar Alterações</>}
          </button>
        </div>
      </div>
    </ModalBase>
  );
};
