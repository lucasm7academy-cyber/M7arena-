import React from 'react';
import { api } from '../../lib/api';

export interface UpcomingMatch {
  id: string;
  tagA: string;
  nameA?: string;
  colorA: string;
  colorA2?: string;
  logoA: string;
  tagB: string;
  nameB?: string;
  colorB: string;
  colorB2?: string;
  logoB: string;
  date: string;
  time: string;
  campId?: string;
  campTitle?: string;
  campColor?: string;
  fase?: string;
  matchId?: string;
  streamer?: { nome: string; twitch: string } | null;
}

const _UPCOMING_CACHE_TTL = 5 * 60 * 1000;
const _UPCOMING_CACHE_VER = 5; // bump ao mudar estrutura
let _upcomingCache: { data: UpcomingMatch[]; ts: number; v: number } | null = null;

export function useUpcomingMatches() {
  const [upcomingMatches, setUpcomingMatches] = React.useState<UpcomingMatch[]>([]);
  const [upcomingLoaded, setUpcomingLoaded] = React.useState(false);
  React.useEffect(() => {
    const fetchUpcoming = async () => {
      if (_upcomingCache && _upcomingCache.v === _UPCOMING_CACHE_VER && Date.now() - _upcomingCache.ts < _UPCOMING_CACHE_TTL) {
        setUpcomingMatches(_upcomingCache.data);
        setUpcomingLoaded(true);
        return;
      }
      try {
        const [camps, allTeams, agenda] = await Promise.all([
          api.tournaments.listAgenda(),
          api.teams.list().catch(() => [] as any[]),
          api.streams.agenda().catch(() => [] as any[]),
        ]);

        const streamerMap = new Map<string, { nome: string; twitch: string }>();
        for (const item of agenda as any[]) {
          if (item.match_id && item.streamer) streamerMap.set(item.match_id, item.streamer);
        }

        const teamMap = new Map<string, any>();
        if (Array.isArray(allTeams)) {
          for (const tm of allTeams) {
            if (tm.tag) teamMap.set(tm.tag.trim().toUpperCase(), tm);
            if (tm.nome) teamMap.set(tm.nome.trim().toUpperCase(), tm);
            if (tm.name) teamMap.set(tm.name.trim().toUpperCase(), tm);
            if (tm.id) teamMap.set(String(tm.id), tm);
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const raw: Array<{ sortKey: string; match: any; camp: any }> = [];

        for (const camp of camps) {
          const cron: any[] = camp.cronograma || [];
          const times: any[] = camp.times_inscritos || [];

          for (const match of cron) {
            // Apenas partidas confirmadas (times definiram a data/hora)
            if (match.status !== 'confirmado') continue;
            if (!match.timeA || !match.timeB) continue;
            if (!match.data || match.data === 'A COMBINAR') continue;
            const mDate = new Date(
              match.data.length === 10 ? match.data + 'T00:00:00' : match.data
            );
            if (isNaN(mDate.getTime())) continue;

            const resolveTeam = (tagOrName: string) => {
              if (!tagOrName) return null;
              const norm = tagOrName.trim().toUpperCase();
              const fromCamp = times.find((t: any) =>
                (t.tag && t.tag.trim().toUpperCase() === norm) ||
                (t.name && t.name.trim().toUpperCase() === norm) ||
                (t.nome && t.nome.trim().toUpperCase() === norm) ||
                (t.id && String(t.id) === norm)
              );
              const fromApi = teamMap.get(norm) || (fromCamp?.id ? teamMap.get(String(fromCamp.id)) : null);
              const color = fromApi?.gradient_from || fromApi?.gradientFrom || fromCamp?.cor || fromCamp?.gradient_from || fromCamp?.gradientFrom || null;
              const color2 = fromApi?.gradient_to || fromApi?.gradientTo || fromCamp?.gradient_to || fromCamp?.gradientTo || null;
              const logo = fromApi?.logo_url || fromApi?.logoUrl || fromCamp?.logo || fromCamp?.logo_url || '';
              const tag = fromApi?.tag || fromCamp?.tag || tagOrName;
              const name = fromApi?.nome || fromApi?.name || fromCamp?.name || fromCamp?.nome || tag;
              return {
                ...fromCamp,
                ...fromApi,
                color,
                color2,
                logo,
                tag,
                name,
              };
            };

            const tA = resolveTeam(match.timeA);
            const tB = resolveTeam(match.timeB);

            const diffDays = Math.round(
              (mDate.getTime() - today.getTime()) / 86400000
            );
            const dateStr =
              diffDays === 0
                ? 'HOJE'
                : diffDays === 1
                ? 'AMANHÃ'
                : mDate
                    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                    .toUpperCase();

            raw.push({
              sortKey: `${match.data}${match.hora || match.horario || '00:00'}`,
              match,
              camp: { ...camp, _times: times, _tA: tA, _tB: tB, _dateStr: dateStr },
            });
          }
        }

        raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        const mapped: UpcomingMatch[] = raw.map(({ match, camp: c }) => {
          const colorA = c._tA?.color || c._tA?.gradient_from || c._tA?.cor || '#00E5FF';
          const colorA2 = c._tA?.color2 || c._tA?.gradient_to || colorA;
          const colorB = c._tB?.color || c._tB?.gradient_from || c._tB?.cor || '#FF4655';
          const colorB2 = c._tB?.color2 || c._tB?.gradient_to || colorB;

          return {
            id: `${c.id}_${match.timeA}_${match.timeB}_${match.data}_${match.hora || match.horario || ''}`,
            campId: c.id,
            campTitle: c.titulo || c.nome || c.name || 'CAMPEONATO',
            campColor: c.theme_color || '#FFB700',
            fase: match.fase || match.phase_label || match.phase || 'Fase de Grupos',
            tagA: c._tA?.tag ? `#${c._tA.tag.replace(/^#/, '')}` : `#${match.timeA}`,
            nameA: c._tA?.name || match.timeA,
            colorA,
            colorA2,
            logoA: c._tA?.logo || '',
            tagB: c._tB?.tag ? `#${c._tB.tag.replace(/^#/, '')}` : `#${match.timeB}`,
            nameB: c._tB?.name || match.timeB,
            colorB,
            colorB2,
            logoB: c._tB?.logo || '',
            date: c._dateStr,
            time: match.hora || match.horario || '—',
            matchId: match.match_id,
            streamer: match.match_id ? streamerMap.get(match.match_id) ?? null : null,
          };
        });

        _upcomingCache = { data: mapped, ts: Date.now(), v: _UPCOMING_CACHE_VER };
        setUpcomingMatches(mapped);
        setUpcomingLoaded(true);
      } catch (err) {
        console.error('Erro ao buscar próximos jogos:', err);
        setUpcomingLoaded(true);
      }
    };
    fetchUpcoming();
  }, []);

  return { upcomingMatches, upcomingLoaded };
}
