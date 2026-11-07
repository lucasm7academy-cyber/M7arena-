// Geometria original do arquivo 2819770.svg fornecido pelo usuario.
export function HalloweenBat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1280.000000 585.000000" fill="currentColor" aria-hidden="true">
      <g transform="translate(0.000000,585.000000) scale(0.100000,-0.100000)">
        <path d="M9785 5728 c-2 -7 -22 -68 -45 -135 -313 -948 -940 -1649 -1822 -2037 -209 -92 -598 -211 -618 -189 -4 4 -47 209 -96 456 -49 246 -92 446 -96 445 -4 -2 -93 -85 -197 -186 l-190 -182 -48 30 c-86 55 -167 73 -301 67 -75 -3 -135 -11 -166 -22 l-49 -18 -177 184 -177 184 -26 -85 c-14 -47 -83 -276 -152 -510 -69 -234 -131 -440 -136 -458 -13 -40 -11 -40 -214 25 -834 270 -1466 781 -1894 1533 -119 210 -278 599 -306 753 -4 20 -11 37 -15 37 -4 0 -25 -21 -46 -47 -59 -73 -199 -219 -294 -307 -463 -431 -1050 -712 -1700 -815 -151 -24 -345 -41 -483 -42 l-102 0 110 -23 c694 -145 1141 -501 1270 -1010 13 -50 26 -126 30 -169 6 -63 10 -77 22 -73 37 15 183 48 290 67 149 26 427 36 544 20 414 -59 707 -271 890 -646 67 -137 110 -263 139 -403 22 -112 40 -248 40 -308 l0 -42 92 55 c106 64 190 101 314 140 83 25 102 27 264 27 161 0 182 -2 265 -27 119 -36 288 -120 400 -199 111 -78 344 -308 454 -446 97 -123 245 -344 336 -502 77 -133 237 -457 286 -579 l34 -84 13 49 c126 473 374 815 792 1093 392 262 930 443 1499 506 80 8 145 17 146 18 1 1 12 56 24 122 138 724 488 1210 991 1374 267 88 596 92 886 11 64 -17 64 -17 68 4 30 154 92 301 178 423 160 227 434 471 793 705 200 131 357 220 635 361 140 71 247 127 238 123 -10 -3 -71 -13 -135 -23 -183 -27 -599 -24 -793 6 -383 58 -703 159 -1057 331 -252 122 -474 255 -646 387 -39 30 -59 40 -62 31z" />
      </g>
    </svg>
  );
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
