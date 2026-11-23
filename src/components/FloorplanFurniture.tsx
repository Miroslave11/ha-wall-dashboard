/**
 * Obrysová kresba nábytku pro výchozí půdorys 640×460 (podle původního dashboardu).
 * Upravte podle skutečného bytu, nebo místo ní nastavte `floorplan.background` v config.json.
 */
export function FloorplanFurniture({ width, height }: { width: number; height: number }) {
  return (
    <svg
      className="plan-furniture"
      width={width}
      height={height}
      viewBox="0 0 640 460"
      fill="none"
      stroke="rgba(255,255,255,0.17)"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Ložnice (0–300 × 0–300): manželská postel v pravém horním rohu, čelo u horní stěny */}
      <rect x="180" y="8" width="110" height="146" rx="6" />
      <path d="M180 15h110" />
      <rect x="186" y="21" width="47" height="22" rx="6" />
      <rect x="237" y="21" width="47" height="22" rx="6" />
      {/* přikrývka s přehnutým okrajem */}
      <rect x="183" y="72" width="104" height="79" rx="4" />
      <path d="M183 82h104" />
      {/* Komoda u levé stěny v levém horním rohu, se šuplíky */}
      <rect x="8" y="8" width="26" height="96" rx="3" />
      <path d="M8 32h26M8 56h26M8 80h26" />
      {/* Okno uprostřed levé (obvodové) stěny (délka 96 = 74 × 1,3), střed ve výšce 150 */}
      <g className="plan-window">
        <rect x="0" y="102" width="8" height="96" rx="1.5" />
        <path d="M4 102v96" />
      </g>
      {/* Svítidla (žárovky i LED pásky, např. za postelí v pracovně) se nekreslí zde, ale dynamicky z floorplan.rooms[].fixtures */}
      {/* Obývák & kuchyň (300–640 × 0–300) */}
      {/* gauč v levém rohu (opěradlo u levé stěny, dvě sedáky) a před ním konferenční stolek */}
      <rect x="306" y="6" width="74" height="122" rx="9" />
      <path d="M322 14v106" />
      <rect x="325" y="10" width="52" height="54" rx="8" />
      <rect x="325" y="70" width="52" height="54" rx="8" />
      <rect x="415" y="20" width="36" height="68" rx="3" />
      {/* TV stolek u pravé stěny v rohu u horní stěny, naproti gauči, a nad ním promítací plocha projektoru (domácí kino) */}
      <rect x="601" y="8" width="33" height="122" rx="2" />
      <rect x="636" y="8" width="3" height="122" rx="1.5" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.35)" />
      {/* jídelní stůl se čtyřmi místy a židlemi */}
      <rect x="419" y="143" width="153" height="51" rx="3" />
      <rect x="445" y="157" width="100" height="22" rx="2" />
      <circle cx="457" cy="150" r="6" />
      <circle cx="528" cy="150" r="6" />
      <circle cx="457" cy="187" r="6" />
      <circle cx="528" cy="187" r="6" />
      <rect x="442" y="126" width="30" height="18" rx="6" />
      <rect x="513" y="126" width="30" height="18" rx="6" />
      <rect x="442" y="192" width="30" height="18" rx="6" />
      <rect x="513" y="192" width="30" height="18" rx="6" />
      {/* kuchyňská linka těsně u dolní stěny a v rohu u pravé stěny, dřez s baterií */}
      <path d="M416 263H604V212H636V292H416Z" />
      <rect x="470" y="267" width="36" height="21" rx="3" />
      <rect x="474" y="270" width="28" height="15" rx="3" />
      <circle cx="488" cy="269" r="1.8" />
      {/* Pokoj / pracovna (0–210 × 300–460) */}
      {/* pracovní stůl v levém horním rohu podél stěny, na něm monitor */}
      <rect x="8" y="308" width="36" height="66" rx="3" />
      <rect x="14" y="326" width="6" height="30" rx="2" />
      <path d="M20 341h8" />
      {/* židle u stolu: sedák, opěrák a kolečkový kříž */}
      <rect x="52" y="322" width="30" height="32" rx="10" />
      <path d="M85 325q8 13 0 27" />
      <circle cx="67" cy="338" r="4" />
      {/* okno v levé (obvodové) stěně mezi stolem a postelí */}
      <g className="plan-window">
        <rect x="0" y="358" width="8" height="38" rx="1.5" />
        <path d="M4 358v38" />
      </g>
      {/* postel v levém dolním rohu podél dolní stěny, hlavou k levé stěně (pod oknem); délka 110 = 52 % šířky místnosti */}
      <rect x="10" y="396" width="110" height="54" rx="5" />
      <rect x="15" y="401" width="12" height="44" rx="5" />
      <rect x="31" y="401" width="84" height="44" rx="4" />
      <path d="M41 401v44" />
      {/* Šatna (210–300 × 300–460): nahoře sušička na prádlo, dole skříně s oblečením, mezi nimi volná chodba */}
      <rect x="226" y="308" width="40" height="28" rx="3" />
      <circle cx="246" cy="323" r="9" />
      <circle cx="246" cy="323" r="5" />
      <path d="M231 313h8" />
      {/* skříň vlevo (dvoukřídlá) a užší skříň vpravo */}
      <rect x="216" y="404" width="46" height="50" rx="2" />
      <path d="M239 404v50M235 424v10M243 424v10" />
      <rect x="282" y="404" width="14" height="38" rx="2" />
      <path d="M289 411v24" />
      {/* Koupelna (420–640 × 300–460), u horní stěny zleva: pračka, umyvadlo, rohový sprchový kout, záchod */}
      <rect x="424" y="306" width="44" height="32" rx="3" />
      <path d="M424 332h44" />
      <circle cx="432" cy="319" r="2" />
      <rect x="474" y="306" width="50" height="28" rx="3" />
      <ellipse cx="499" cy="321" rx="16" ry="9" />
      <circle cx="499" cy="311" r="2" />
      <path d="M598 306H530A68 68 0 0 0 598 374Z" />
      <circle cx="574" cy="332" r="3" />
      <circle cx="588" cy="316" r="4" />
      <rect x="608" y="306" width="26" height="11" rx="2" />
      <ellipse cx="621" cy="336" rx="11" ry="16" />
    </svg>
  );
}
