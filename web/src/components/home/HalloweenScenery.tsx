export function HalloweenBat({ className }: { className?: string }) {
  return <svg className={className} viewBox="-40 -26 80 44" fill="currentColor" aria-hidden="true"><path d="M-4-5-6-15 0-10 6-15 4-5Q18-19 37-23L28-7Q19-12 18 4Q10-5 8 12L0 6-8 12Q-10-5-18 4Q-19-12-28-7L-37-23Q-18-19-4-5Z" /></svg>;
}

/** Independent corner ornaments keep their proportions on narrow screens. */
export function HalloweenScenery() {
  return (
    <div className="halloween-scenery" aria-hidden="true">
      {['left', 'right'].map(side => <svg key={side} className={`halloween-web halloween-web-${side}`} viewBox="0 0 230 230" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 0 230 0M0 0 220 75M0 0 155 155M0 0 65 215M0 0 0 230M60 0Q50 15 57 20Q40 30 40 40Q20 42 17 57Q5 48 0 60M120 0Q100 30 114 40Q80 60 80 80Q40 84 34 114Q10 96 0 120M180 0Q150 45 171 60Q120 90 120 120Q60 126 51 171Q15 144 0 180"/>
      </svg>)}
      <svg className="halloween-moon" viewBox="0 0 120 120">
        <defs><linearGradient id="halloween-moon-light" x2="1" y2="1"><stop stopColor="#ffe4a1"/><stop offset="1" stopColor="#d78942"/></linearGradient></defs>
        <path d="M70 10A50 50 0 1 0 70 110C20 92 20 28 70 10Z" fill="url(#halloween-moon-light)"/>
      </svg>

    </div>
  );
}

export function HalloweenPumpkins({ side }: { side: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" className={`halloween-pumpkins halloween-pumpkins-${side}`} viewBox="0 0 150 115">
        <defs>
          <radialGradient id={`pumpkin-skin-${side}`} cx=".4" cy=".3" r=".8"><stop stopColor="#ff9d28"/><stop offset=".6" stopColor="#e76112"/><stop offset="1" stopColor="#a6370a"/></radialGradient>
          <g id={`pumpkin-${side}`}>
            <path d="M-3-26Q-8-39 5-42L10-38Q0-35 4-25" fill="#8e9d46"/>
            <path d="M0-24C-47-42-53 22-21 30Q0 39 21 30C53 22 47-42 0-24Z" fill={`url(#pumpkin-skin-${side})`}/>
            <ellipse cy="3" rx="22" ry="32" fill="none" stroke="#ffb234" strokeOpacity=".4" strokeWidth="2"/>
            <path d="M-27-6-9-1-23 5ZM27-6 9-1 23 5ZM-5 9 0 0 5 9ZM-27 15-14 19-10 14-3 23 6 16 12 20 28 12Q13 39-9 29Z" fill="#ffe9a0"/>
          </g>
        </defs>
        {side === 'left' && <use href={`#pumpkin-${side}`} transform="translate(55 64) rotate(-9)"/>}
        <use href={`#pumpkin-${side}`} transform={`translate(${side === 'right' ? 55 : 115} 83) rotate(12) scale(.57)`}/>
      </svg>
  );
}
