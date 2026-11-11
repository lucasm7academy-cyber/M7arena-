import { useState } from 'react';
import { Crown, RefreshCw, UserX, Users, X } from 'lucide-react';
import { useSound } from '../../../../hooks/useSound';
import { type Role, ROLE_CONFIG } from '../../../../components/players/playerMeta';
import { type Membro, ROLE_ORDER, eloDisplay } from '../../roster';
import { ModalBase } from './ModalBase';

const ELO_COLORS: Record<string, string> = {
  Ferro: 'text-gray-500', Bronze: 'text-amber-600', Prata: 'text-gray-300',
  Ouro: 'text-yellow-400', Platina: 'text-cyan-400', Esmeralda: 'text-emerald-400',
  Diamante: 'text-blue-400', Mestre: 'text-amber-500',
  'Grão-Mestre': 'text-red-400', Desafiante: 'text-yellow-300',
};

const getEloColor = (elo: string) => ELO_COLORS[elo.split(' ')[0]] ?? 'text-white/60';

const sortPlayers = (players: any[]) =>
  [...players].sort((a, b) => {
    const oa = ROLE_ORDER.indexOf(a.role);
    const ob = ROLE_ORDER.indexOf(b.role);
    return oa !== ob ? oa - ob : (a.riotId || a.name || '').localeCompare(b.riotId || b.name || '');
  });

interface ManageLineupModalProps {
  membrosIniciais: Membro[];
  gradientFrom: string;
  onClose: () => void;
  onUpdateTeam: (players: Membro[]) => Promise<{ ok: boolean; error?: string }> | void;
  /** Cargo proprietário DO SITE (não do time): vê a coroa em qualquer membro,
      mesmo convidado sem conta (que vira capitão, não dono). */
  isProprietario?: boolean;
  /** Remove/expulsa jogador: dono, capitão ou proprietário do site. */
  podeRemover?: boolean;
  /** Promove/transfere a coroa: dono, capitão ou proprietário do site. */
  podePromover?: boolean;
}

export const ManageLineupModal = ({
  membrosIniciais, gradientFrom, onClose, onUpdateTeam, isProprietario = false,
  podeRemover = false,
  podePromover = false,
}: ManageLineupModalProps) => {
  const { playSound } = useSound();
  const [membros, setMembros] = useState<Membro[]>(sortPlayers(membrosIniciais));
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePromote = (idKey: string) => {
    playSound('click');
    setMembros(m => m.map(mb => ({ ...mb, isLeader: (mb.userId || mb.riotId) === idKey })));
  };

  const handleRemove = (idKey: string) => {
    playSound('click');
    setMembros(prev => {
      const removido = prev.find(mb => (mb.userId || mb.riotId) === idKey);
      const restantes = prev.filter(mb => (mb.userId || mb.riotId) !== idKey);
      // A coroa não fica órfã: se o líder saiu, o próximo herda — de
      // preferência alguém com CONTA (o dono do time precisa de user_id).
      if (removido?.isLeader && restantes.length > 0) {
        const herdeiro = restantes.find(mb => mb.userId) ?? restantes[0];
        return restantes.map(mb => (mb === herdeiro ? { ...mb, isLeader: true } : mb));
      }
      return restantes;
    });
    setConfirmRemove(null);
  };

  const handleRoleChange = (idKey: string, newRole: Role) => {
    playSound('click');
    setError(null);
    if (newRole !== 'RES') {
      const ocupada = membros.some(mb => (mb.userId || mb.riotId) !== idKey && mb.role === newRole);
      if (ocupada) {
        setError(`A rota ${ROLE_CONFIG[newRole].label} já está ocupada. Mova o jogador atual para a reserva antes.`);
        return;
      }
    } else {
      const reservas = membros.filter(mb => (mb.userId || mb.riotId) !== idKey && mb.role === 'RES').length;
      if (reservas >= 3) {
        setError('Máximo de 3 reservas atingido.');
        return;
      }
    }
    setMembros(m => sortPlayers(m.map(mb => (mb.userId || mb.riotId) === idKey ? { ...mb, role: newRole } : mb)));
  };

  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    setError(null);
    const roles = membros.map(m => m.role).filter(r => r !== 'RES');
    const hasDuplicates = new Set(roles).size !== roles.length;
    if (hasDuplicates) {
      setError('Posições duplicadas');
      playSound('click');
      return;
    }
    const reserves = membros.filter(m => m.role === 'RES');
    if (reserves.length > 3) {
      setError('Máximo de 3 reservas');
      playSound('click');
      return;
    }
    setSalvando(true);
    const res = await onUpdateTeam(membros);
    setSalvando(false);
    if (res && res.ok === false) {
      setError(res.error || 'Não foi possível salvar o lineup. Tente novamente.');
      playSound('click');
      return;
    }
    playSound('success');
    onClose();
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
                <Users className="w-5 h-5" style={{ color: gradientFrom }} />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-white">Gerenciar Lineup</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Ajuste as posições dos jogadores</p>
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

        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {membros.map(m => {
            const cfg = ROLE_CONFIG[m.role];
            const mId = m.userId || m.riotId;
            return (
              <div
                key={mId}
                className="bg-[#0c0c10] border border-white/10 rounded-xl p-3 flex items-center gap-3 hover:border-white/20 transition-colors"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}
                >
                  <img src={cfg.img} alt={cfg.label} className="w-4 h-4 object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-xs truncate">{m.riotId.split('#')[0]}</p>
                    {m.isLeader && (
                      <span
                        className="text-[8px] font-black px-1.5 py-0.5 rounded border flex-shrink-0"
                        style={{
                          color: gradientFrom,
                          borderColor: `${gradientFrom}50`,
                          background: `${gradientFrom}18`
                        }}
                      >
                        CAP
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] font-bold ${getEloColor(m.elo)} mt-0.5`}>{eloDisplay(m.elo)}</p>
                </div>
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(mId, e.target.value as Role)}
                  className="bg-black/60 text-white/80 text-xs font-black uppercase px-2.5 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:border-white/40 cursor-pointer shrink-0"
                >
                  {(Object.keys(ROLE_CONFIG) as Role[]).map(r => (
                    <option key={r} value={r} className="bg-[#0d0d0d]">{ROLE_CONFIG[r].label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5 justify-end">
                  {confirmRemove === mId ? (
                    <>
                      <span className="text-white/40 text-[9px] uppercase font-bold">Excluir?</span>
                      <button
                        onClick={() => handleRemove(mId)}
                        className="px-2 py-1 bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase rounded-lg cursor-pointer hover:bg-red-500/30 transition-colors"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        className="px-2 py-1 bg-white/5 border border-white/10 text-white/40 text-[9px] font-black uppercase rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        Não
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Coroa: quem tem a coroa é o dono/capitão (ADR-089).
                          O PROPRIETÁRIO DO SITE vê a coroa em qualquer membro
                          — até convidado sem conta (vira capitão; o dono só
                          muda para quem tem conta, regra do servidor). */}
                      {podePromover && !m.isLeader && (m.userId || isProprietario) && (
                        <button
                          onClick={() => handlePromote(mId)}
                          className="p-1.5 border border-white/10 rounded-lg bg-white/5 hover:bg-yellow-400/20 text-white/30 hover:text-yellow-400 transition-all cursor-pointer"
                          title={m.userId ? 'Promover a Capitão/Dono' : 'Promover a Capitão (sem conta não vira dono)'}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {/* Retirar da equipe vale para TODOS, inclusive o líder —
                          o proprietário pode kitar o dono e a coroa anda
                          sozinha (handleRemove promove o primeiro restante). */}
                      {podeRemover && (
                        <button
                          onClick={() => setConfirmRemove(mId)}
                          className="p-1.5 border border-white/10 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all cursor-pointer"
                          title={m.isLeader ? 'Expulsar (a coroa vai para o próximo)' : 'Expulsar'}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={salvando}
          className="w-full py-3.5 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: gradientFrom || '#FFB700',
            boxShadow: `0 0 25px -5px ${gradientFrom || '#FFB700'}66`
          }}
        >
          {salvando ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar Lineup'}
        </button>
      </div>
    </ModalBase>
  );
};
