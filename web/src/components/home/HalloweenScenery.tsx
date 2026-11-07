/** Vector scenery stays crisp in screenshots and inherits each team's palette. */
export function HalloweenScenery() {
  return (
    <svg className="halloween-scenery" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="halloween-moon"><stop stopColor="#fff4d4"/><stop offset=".75" stopColor="#bdb1aa"/><stop offset="1" stopColor="#80767f"/></radialGradient>
        <g id="halloween-bat"><path d="M0 0 Q-12-20-35-14 Q-23-7-25 4 Q-13-2-9 9 L0 5 9 9 Q13-2 25 4 Q23-7 35-14 Q12-20 0 0Z"/></g>
        <g id="halloween-pumpkin">
          <path d="M-3-26Q-8-39 5-42L10-38Q0-35 4-25" fill="#766d37"/>
          <path d="M0-24C-47-42-53 22-21 30Q0 39 21 30C53 22 47-42 0-24Z" fill="#9b451b"/>
          <ellipse cy="3" rx="22" ry="32" fill="#bc5820"/>
          <path d="M-27-6-9-1-23 5ZM27-6 9-1 23 5ZM-5 9 0 0 5 9ZM-27 15-14 19-10 14-3 23 6 16 12 20 28 12Q13 39-9 29Z" fill="#ffce70"/>
        </g>
      </defs>
      <circle cx="600" cy="170" r="104" fill="url(#halloween-moon)" opacity=".22"/>
      <g fill="#17141e" opacity=".25"><circle cx="570" cy="119" r="22"/><circle cx="645" cy="175" r="32"/><circle cx="583" cy="223" r="16"/></g>
      <g fill="#05060b"><use href="#halloween-bat" transform="translate(480 95) rotate(-18) scale(.65)"/><use href="#halloween-bat" transform="translate(725 128) rotate(15) scale(.85)"/><use href="#halloween-bat" transform="translate(800 75) rotate(20) scale(.4)"/></g>
      <g fill="none" stroke="#c3b8ca" strokeWidth="1" opacity=".17">
        <path d="M0 0 230 0M0 0 220 75M0 0 155 155M0 0 65 215M0 0 0 230M60 0Q50 15 57 20Q40 30 40 40Q20 42 17 57Q5 48 0 60M120 0Q100 30 114 40Q80 60 80 80Q40 84 34 114Q10 96 0 120M180 0Q150 45 171 60Q120 90 120 120Q60 126 51 171Q15 144 0 180"/>
        <path d="M1200 0 970 0M1200 0 980 75M1200 0 1045 155M1200 0 1135 215M1140 0Q1150 15 1143 20Q1160 30 1160 40Q1180 42 1183 57M1080 0Q1100 30 1086 40Q1120 60 1120 80Q1160 84 1166 114M1020 0Q1050 45 1029 60Q1080 90 1080 120Q1140 126 1149 171"/>
      </g>
      <g fill="#06070c">
        <path d="M0 560V130L30 240 18 160 51 269 89 220 58 290 72 349 134 302 103 349 150 344 91 372 122 560ZM1200 560V130L1170 240 1182 160 1149 269 1111 220 1142 290 1128 349 1066 302 1097 349 1050 344 1109 372 1078 560Z"/>
        <path d="M0 530Q170 492 320 540T640 535 960 535 1200 515V560H0Z"/>
      </g>
      <g opacity=".85"><use href="#halloween-pumpkin" transform="translate(95 503) rotate(-9) scale(.9)"/><use href="#halloween-pumpkin" transform="translate(151 522) scale(.55)"/><use href="#halloween-pumpkin" transform="translate(1110 503) rotate(9) scale(.9)"/></g>
    </svg>
  );
}
