import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { FaTwitch } from 'react-icons/fa6';
import { HalloweenBat, HalloweenPumpkins, HalloweenScenery } from './HalloweenScenery';
import { CutCard, cutPolygon } from '../ui/CutCard';
import { useUpcomingMatches, type UpcomingMatch } from './useUpcomingMatches';
import './upcoming-matches.css';

function Team({ match, side }: { match: UpcomingMatch; side: 'A' | 'B' }) {
  const color = match[`color${side}`];
  const style = { '--team': color, '--team-end': match[`color${side}2`] || color } as CSSProperties;
  const tag = match[`tag${side}`];
  const logo = match[`logo${side}`];
  return (
    <div className={`halloween-team halloween-team-${side}`} style={style}>
      <div className="halloween-portal">
        <HalloweenBat className="halloween-team-bat" />
        {side === 'B' && <HalloweenBat className="halloween-team-bat halloween-team-bat-small" />}
        <CutCard className="halloween-logo-frame" contentClassName="halloween-logo-content" borderWidth={2} borderColor={color} background="#0c0c12">
          {logo ? <img src={logo} style={{ clipPath: cutPolygon(12, 2) }} alt={`Logo ${match[`name${side}`] || tag}`} /> : <span className="halloween-initial">{tag.replace(/^#/, '').slice(0, 2)}</span>}
        </CutCard>
        <HalloweenPumpkins side={side === 'A' ? 'left' : 'right'} />
      </div>
      <strong className="halloween-team-tag"><span className="halloween-tag-hash">#</span>{tag.replace(/^#/, '')}</strong>
      <span className="halloween-team-name">{match[`name${side}`]}</span>
    </div>
  );
}

export function MatchPoster({ match }: { match: UpcomingMatch }) {
  const style = { '--team-a': match.colorA, '--team-b': match.colorB } as CSSProperties;
  return (
    <article className="halloween-poster" style={style} aria-label={`${match.campTitle}: ${match.tagA} versus ${match.tagB}, ${match.date}, ${match.time}`}>
      <HalloweenScenery />
      <div className="halloween-mist" aria-hidden="true" />
      <header className="halloween-heading">
        <h3>{match.campTitle || 'Campeonato'}</h3>
        {match.fase && <span className="halloween-phase">{match.fase}</span>}
      </header>
      <div className="halloween-matchup">
        <Team match={match} side="A" />
        <div className="halloween-versus">
          <span className="halloween-vs">VS</span>
          <div className="halloween-schedule">
            <HalloweenBat className="halloween-clock-bat" />
            <span className="halloween-date"><CalendarDays size={13} /> {match.date}</span>
            <strong>{match.time}</strong>
          </div>
        </div>
        <Team match={match} side="B" />
      </div>
      <footer className="halloween-footer">
        <span className="halloween-footer-line" />
        {match.streamer ? <a href={`https://twitch.tv/${match.streamer.twitch.replace(/^[@/]/, '')}`} target="_blank" rel="noopener noreferrer"><FaTwitch /> {match.streamer.twitch || match.streamer.nome}</a> : <span>LEAGUE OF LEGENDS</span>}
        <span className="halloween-footer-line" />
      </footer>
    </article>
  );
}

export function UpcomingMatches() {
  const { upcomingMatches, upcomingLoaded } = useUpcomingMatches();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = upcomingMatches.length;
  const change = (step: number) => setIndex(previous => (previous + step + count) % count);

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = setInterval(() => setIndex(previous => (previous + 1) % count), 8000);
    return () => clearInterval(timer);
  }, [paused, count, index]);

  if (!upcomingLoaded || !count) return null;
  return (
    <section className="halloween-section" aria-label="Próximos jogos" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      <MatchPoster match={upcomingMatches[index % count]} />
      {count > 1 && <nav className="halloween-navigation" aria-label="Selecionar confronto">
        <button onClick={() => change(-1)} aria-label="Jogo anterior"><ChevronLeft size={18} /></button>
        <div className="halloween-pagination">{upcomingMatches.map((match, i) => <button key={match.id} onClick={() => setIndex(i)} aria-label={`Ver jogo ${i + 1}`} aria-current={i === index ? 'true' : undefined} />)}</div>
        <button onClick={() => change(1)} aria-label="Próximo jogo"><ChevronRight size={18} /></button>
      </nav>}
    </section>
  );
}
