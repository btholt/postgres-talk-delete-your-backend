export function ProjectArt({ id, large = false }) {
  return (
    <svg className={`project-art art-${id}${large ? ' large' : ''}`} viewBox="0 0 480 280" role="img" aria-label={
      { 1: 'A goose on wheels', 2: 'An orchestrated sourdough loaf', 3: 'A cancelled subscription receipt', 4: 'Two agents in a meeting', 5: 'A houseplant watching television', 6: 'An infinite email loop', 7: 'A meal kit for a mason jar', 8: 'A very technical sneaker' }[id]
    }>
      <defs>
        <pattern id={`grid-${id}`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="currentColor" opacity=".07" /></pattern>
      </defs>
      <rect width="480" height="280" fill="url(#grid-0)" opacity="0" />
      <rect width="480" height="280" fill={`url(#grid-${id})`} />
      <circle cx="240" cy="140" r="108" fill="white" opacity=".25" />
      {id === 1 && <g>
        <path d="M97 217H383" stroke="#345746" strokeWidth="2" strokeDasharray="8 8" opacity=".4" />
        <ellipse cx="244" cy="231" rx="110" ry="9" fill="#315644" opacity=".1" />
        <circle cx="198" cy="214" r="17" fill="#234938" /><circle cx="302" cy="214" r="17" fill="#234938" />
        <circle cx="198" cy="214" r="7" fill="#c6dbac" /><circle cx="302" cy="214" r="7" fill="#c6dbac" />
        <path d="M160 197H330" stroke="#df7048" strokeWidth="9" strokeLinecap="round" />
        <path d="M162 136Q169 101 214 109L277 126Q283 114 282 90L282 77Q285 50 309 53Q331 56 327 79L320 100L314 154Q305 189 250 189H209Q167 182 162 136Z" fill="#fffcf0" stroke="#345746" strokeWidth="3" />
        <path d="M320 73L350 84L322 91" fill="#e99944" stroke="#345746" strokeWidth="2" />
        <circle cx="313" cy="70" r="3.5" fill="#234938" />
        <path d="M193 137Q220 161 266 145Q251 180 213 167" fill="#e1e7d1" stroke="#345746" strokeWidth="2" />
        <path d="M166 130L139 106L148 146" fill="#fffcf0" stroke="#345746" strokeWidth="3" />
        <path d="M231 188V197M264 188V197" stroke="#e99944" strokeWidth="5" />
        <path d="M107 81h60M91 97h55M112 113h24" stroke="#345746" strokeWidth="3" strokeLinecap="round" opacity=".35" />
        <g transform="translate(345 123) rotate(9)"><rect width="61" height="40" rx="8" fill="#174b39" /><text x="30" y="25" fill="#e6f0cf" fontSize="13" textAnchor="middle" fontFamily="monospace">HONK</text></g>
      </g>}
      {(id === 2 || id === 7) && <g>
        <path d="M131 204H349M155 77H184M297 81h32" stroke="#8e6047" strokeWidth="2" opacity=".4" />
        {id === 2 ? <>
          <path d="M145 164Q140 95 224 90Q313 79 333 157Q340 196 306 202H174Q145 201 145 164" fill="#cc8143" stroke="#694831" strokeWidth="3" />
          <path d="M189 122l-12 40M230 109l-12 48M272 112l-9 46" stroke="#f8ddb2" strokeWidth="12" strokeLinecap="round" />
          <path d="M213 74V45H154V73M285 70V44H340V72" fill="none" stroke="#694831" strokeWidth="2" />
          {[154, 213, 285, 340].map(x => <rect key={x} x={x - 9} y="65" width="18" height="18" rx="4" fill="#f9edda" stroke="#694831" strokeWidth="2" />)}
          <rect x="205" y="213" width="90" height="25" rx="5" fill="#694831" /><text x="250" y="230" textAnchor="middle" fill="#fff0d9" fontSize="11" fontFamily="monospace">99.9% RISE</text>
        </> : <>
          <rect x="197" y="80" width="91" height="125" rx="18" fill="#e9f2cf" stroke="#3d6d54" strokeWidth="3" />
          <path d="M201 151q43-23 83 0v40q-40 20-83 0z" fill="#cba376" />
          <rect x="191" y="71" width="104" height="22" rx="6" fill="#3d6d54" />
          <circle cx="220" cy="162" r="4" fill="#f7dfb3" /><circle cx="252" cy="177" r="5" fill="#f7dfb3" /><circle cx="269" cy="158" r="3" fill="#f7dfb3" />
          <path d="M140 138l-27 57h54zM326 111v74m-13-62h26" fill="#d9b677" stroke="#3d6d54" strokeWidth="3" />
          <text x="242" y="126" textAnchor="middle" fill="#3d6d54" fontSize="13" fontFamily="monospace">FEED ME</text>
        </>}
      </g>}
      {id === 3 && <g transform="rotate(-9 240 140)">
        <path d="M177 49H301V231L285 222L270 231L254 222L238 231L222 222L207 231L191 222L177 231Z" fill="#faf7ff" stroke="#615078" strokeWidth="3" />
        <path d="M196 78H279M196 96H251M196 151H277M196 169H266M196 187H245" stroke="#c2b0d1" strokeWidth="5" />
        <rect x="148" y="106" width="186" height="43" rx="7" fill="#615078" />
        <text x="241" y="133" textAnchor="middle" fill="white" fontSize="20" fontFamily="monospace" fontWeight="bold">CANCELLED</text>
        <circle cx="323" cy="194" r="25" fill="#def0aa" stroke="#615078" strokeWidth="2" /><path d="M312 194l8 7 14-16" fill="none" stroke="#615078" strokeWidth="4" />
      </g>}
      {id === 4 && <g stroke="#365776" strokeWidth="3">
        <ellipse cx="240" cy="194" rx="122" ry="26" fill="#93adca" />
        {[167, 298].map((x, i) => <g key={x}><rect x={x - 29} y="103" width="60" height="59" rx="15" fill={i ? '#eef4fd' : '#cce5a6'} /><path d={`M${x} 103V88`} /><circle cx={x} cy="84" r="5" fill="#e17e52" /><circle cx={x - 12} cy="129" r="4" fill="#365776" /><circle cx={x + 12} cy="129" r="4" fill="#365776" /><path d={`M${x - 8} 145h16M${x - 13} 165v30m26-30v30`} /></g>)}
        <path d="M216 83h49l-7 10h-35z" fill="#eef4fd" /><path d="M223 71h34M231 59h20" opacity=".4" />
        <rect x="214" y="177" width="55" height="30" rx="3" fill="#eef4fd" /><path d="M235 187h14" />
      </g>}
      {id === 5 && <g stroke="#71623c" strokeWidth="3">
        <rect x="256" y="98" width="101" height="79" rx="12" fill="#faf3cf" /><rect x="268" y="110" width="76" height="52" rx="5" fill="#b7c18a" />
        <path d="M289 177l-9 23m49-23 9 23M288 97l-12-20m25 20 17-23" />
        <path d="M136 165h69l-12 44h-45z" fill="#cd865c" />
        <path d="M169 165v-50M170 139q-50-1-35-34 36-7 35 34M171 123q-1-49 30-42 21 31-30 42M167 148q18-39 41-15-3 29-41 15" fill="#60845b" />
        <path d="M269 216h67M139 215h64" opacity=".4" />
      </g>}
      {id === 6 && <g stroke="#8c4e64" strokeWidth="3">
        <path d="M167 102Q239 37 314 105M311 177Q239 243 165 177" fill="none" strokeWidth="5" />
        <path d="M306 84l13 26-29 1M174 194l-15-25 29-2" fill="#8c4e64" />
        {[134, 275].map(x => <g key={x}><rect x={x} y="116" width="80" height="58" rx="7" fill="#fff2f2" /><path d={`M${x} 121l40 29 40-29M${x} 169l27-24m53 24-27-24`} fill="none" /></g>)}
        <text x="240" y="150" textAnchor="middle" fontSize="23" fill="#8c4e64" stroke="none">@</text>
      </g>}
      {id === 8 && <g stroke="#716049" strokeWidth="3">
        <path d="M143 153l28-53 35 15 24 39 83 16q21 5 25 27H146q-16-18-3-44" fill="#fcf7e8" />
        <path d="M145 197h198v14H147z" fill="#716049" /><path d="M207 136l-18 8m28 5-18 8m29 6-18 8" />
        <rect x="273" y="69" width="32" height="32" rx="5" fill="#d7b47f" /><rect x="328" y="103" width="32" height="32" rx="5" fill="#d7b47f" /><path d="M304 92l24 20m-41-10-20 48" strokeDasharray="5 5" />
        <text x="193" y="187" fill="#716049" stroke="none" fontSize="12" fontFamily="monospace">PROOF OF WALK</text>
      </g>}
      <g opacity=".45" fill="none" stroke="currentColor" strokeWidth="2"><path d="M81 161v12m-6-6h12M373 53v12m-6-6h12" /><circle cx="387" cy="205" r="4" /><circle cx="105" cy="54" r="3" /></g>
    </svg>
  );
}
