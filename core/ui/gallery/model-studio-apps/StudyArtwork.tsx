import type { StudyApp, StudyItem } from "./studies";

/** Original vector scene artwork; interface icons come from AetherIcon. */
export function StudyArtwork({ app, item, prefix }: { app: StudyApp; item: StudyItem; prefix: string }) {
  if (app === "sketch") return <g stroke={item.color} strokeWidth={item.weight} fill="none" strokeLinejoin="round">
    {item.kind === "Circle" ? <circle cx="500" cy="350" r="65"/> : item.kind === "Rectangle" ? <rect x="425" y="300" width="150" height="100" rx="8"/> : null}
    {item.id === "enclosure" && <><rect x="244" y="113" width="338" height="466" rx="58" fill="#192125" fillOpacity=".7"/><rect x="258" y="127" width="310" height="438" rx="47"/><path d="M280 548H546M276 145Q413 117 550 145" opacity=".4"/>{[[276,148],[550,148],[276,544],[550,544]].map(([x,y])=><g key={`${x}-${y}`}><circle cx={x} cy={y} r="5"/><path d={`M${x-2} ${y}h4`}/></g>)}</>}
    {item.id === "driver" && <><circle cx="413" cy="410" r="135" fill="#10191d"/>{[124,114,92,83,48,43].map(r=><circle key={r} cx="413" cy="410" r={r} opacity={r===83?.35:1}/>)}{Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <circle key={i} cx={413+Math.cos(a)*129} cy={410+Math.sin(a)*129} r="3"/>;})}<path d="M372 391Q413 355 454 391M372 429Q413 465 454 429" opacity=".3"/></>}
    {item.id === "tweeter" && <><rect x="345" y="154" width="136" height="106" rx="45"/><ellipse cx="413" cy="207" rx="52" ry="43"/><circle cx="413" cy="207" r="29"/><circle cx="413" cy="207" r="24" opacity=".4"/><circle cx="357" cy="207" r="3"/><circle cx="469" cy="207" r="3"/></>}
    {item.id === "profile" && <><path d="M667 136H700Q758 136 766 195V519Q766 578 709 578H667ZM680 137V578M680 288H693V530H680" fill="#162024"/><path d="M700 149Q748 155 751 198V520Q749 563 709 563" opacity=".4"/><path d="M709 334V462M702 338H716M702 458H716"/></>}
    {item.id === "dimensions" && <g strokeWidth="1"><path d="M224 113H164M224 579H164M181 113V579M173 122L189 104M173 588L189 570M244 96V66M582 96V66M244 82H582M236 90L252 74M574 90L590 74"/><path d="M413 100V596M230 410H596M654 410H781" strokeDasharray="14 5 3 5" opacity=".45"/><path d="M518 487L607 613H677"/><g stroke="none" fill={item.color} fontSize="12" fontFamily="monospace"><text x="399" y="73">240</text><text x="169" y="360" transform="rotate(-90 169 360)">330</text><text x="615" y="607">Ø 190</text><text x="365" y="627" letterSpacing="3">FRONT</text><text x="675" y="627" letterSpacing="3">SIDE</text></g></g>}
  </g>;
  if (app === "map") {
    const points: Record<string,string> = {left:"125,303 365,240 365,535 125,487",right:"635,240 875,303 875,487 635,535",portal:"365,175 635,175 635,535 365,535",crown:"275,175 500,95 725,175",plinth:"125,535 875,535 836,587 164,587"};
    return <g><defs><clipPath id={`${prefix}-${item.id}`}><polygon points={points[item.id]}/></clipPath><linearGradient id={`${prefix}-${item.id}-fill`} x2=".8" y2="1"><stop stopColor={item.color}/><stop offset=".5" stopColor="#173151"/><stop offset="1" stopColor="#121a2e"/></linearGradient></defs>
      <polygon points={points[item.id]} fill={`url(#${prefix}-${item.id}-fill)`} stroke={item.color} strokeWidth="2"/>
      <g clipPath={`url(#${prefix}-${item.id})`} className="study-map-light" stroke={item.color} strokeWidth="2" fill="none" opacity=".8">
        {Array.from({length:19},(_,i)=><path key={i} d={`M${80+i*48} 620Q${560-i*10} ${210-i*8} ${60+i*53} 60`} />)}
        {Array.from({length:9},(_,i)=><path key={i} d={`M90 ${240+i*40}Q500 ${60+i*57} 910 ${240+i*40}`} opacity=".5"/>)}
      </g>
      {item.id==="portal"&&<><path d="M430 535V330a70 70 0 0 1 140 0V535" fill="#0b1018" stroke="#83dcf4" strokeWidth="2"/><path d="M443 535V330a57 57 0 0 1 114 0V535" fill="none" stroke="#477c98"/><path d="M450 535L470 370H530L550 535" fill="#213c53" opacity=".6"/></>}
    </g>;
  }
  const chip=(x:number,y:number,w:number,h:number,label:string,pins:number)=><g>
    {Array.from({length:pins},(_,i)=><g key={i}><rect x={x+12+i*(w-24)/(pins-1)} y={y-12} width="6" height="16" rx="1" fill="#b1b7a2"/><rect x={x+12+i*(w-24)/(pins-1)} y={y+h-4} width="6" height="16" rx="1" fill="#b1b7a2"/></g>)}
    <rect x={x} y={y} width={w} height={h} rx="5" fill="#202a29" stroke={item.color} strokeWidth="2"/><rect x={x+7} y={y+7} width={w-14} height={h-14} rx="3" fill="#151c1d"/><circle cx={x+16} cy={y+16} r="3" fill="#8c9b95"/><text x={x+w/2} y={y+h/2} textAnchor="middle" fill="#adbab3" fontSize="11" fontFamily="monospace">{label}</text>
  </g>;
  return <g>
    {item.id==="mcu"&&<>{chip(416,276,136,136,"AETHER / M4",12)}{Array.from({length:12},(_,i)=><g key={i}><rect x="404" y={288+i*10} width="16" height="6" fill="#a7b2a5"/><rect x="548" y={288+i*10} width="16" height="6" fill="#a7b2a5"/></g>)}<text x="475" y="369" fill="#61756d" fontSize="9">U1  •  48</text></>}
    {item.id==="usb"&&<><rect x="145" y="284" width="110" height="112" rx="10" fill={item.color} stroke="#dfdfcd"/><rect x="145" y="298" width="24" height="84" rx="8" fill="#151d1e"/><path d="M184 292V389M244 301V379" stroke="#7e8d87" strokeWidth="3"/>{Array.from({length:10},(_,i)=><rect key={i} x="254" y={300+i*8} width="15" height="4" fill="#c1b77f"/>)}</>}
    {item.id==="power"&&chip(300,181,80,55,"3V3",3)}
    {item.id==="header"&&<><rect x="663" y="207" width="88" height="256" rx="5" fill="#101a1c" stroke="#94a59a"/>{Array.from({length:8},(_,i)=><g key={i}>{[685,726].map(x=><g key={x}><rect x={x-8} y={222+i*30} width="16" height="16" fill={item.color}/><rect x={x-3} y={227+i*30} width="6" height="6" fill="#2f3e35"/></g>)}</g>)}</>}
    {item.id==="crystal"&&<><rect x="443" y="473" width="89" height="42" rx="9" fill={item.color} stroke="#d2d2ba"/><rect x="452" y="480" width="71" height="28" rx="7" fill="#728c83"/><text x="465" y="499" fill="#1e322a" fontSize="11">16.000</text></>}
    {item.id==="passives"&&<>{[[290,447],[290,482],[290,517],[574,447],[574,482],[574,517]].map(([x,y],i)=><g key={i}><rect x={x} y={y} width="40" height="18" rx="2" fill="#a9b8a7"/><rect x={x+7} y={y} width="26" height="18" fill={item.color}/><text x={x+3} y={y-6} fontSize="9" fill="#7ea38e">{i<3?`C${i+1}`:`R${i-2}`}</text></g>)}<circle cx="623" cy="485" r="7" fill="#6af8b2"/><circle cx="623" cy="485" r="14" fill="#6af8b2" opacity=".1"/></>}
  </g>;
}

export function StudyBackdrop({app,copper,prefix}:{app:StudyApp;copper:boolean;prefix:string}) {
  if(app==="sketch")return <g fill="#75868a" fontFamily="monospace"><text x="245" y="38" fontSize="12" letterSpacing="3">ORBIT / ACOUSTIC SERIES</text><text x="245" y="62" fontSize="10" fill="#47585d">01 — ENCLOSURE STUDY</text></g>;
  if(app==="map")return <g><defs><radialGradient id={`${prefix}-glow`}><stop stopColor="#2e557d" stopOpacity=".4"/><stop offset="1" stopColor="#101112" stopOpacity="0"/></radialGradient></defs><ellipse cx="500" cy="570" rx="460" ry="130" fill={`url(#${prefix}-glow)`}/><path d="M75 606H925M110 625H890M150 645H850" stroke="#36444b"/><g stroke="#293c46" strokeDasharray="6 6"><path d="M130 657L500 95L870 657" fill="none"/><path d="M500 95V657"/></g><text x="125" y="53" fill="#6b8496" fontSize="12" letterSpacing="3">PRISM / LIGHT STUDY 01</text><text x="738" y="642" fill="#617c8e" fontSize="10">1920 × 1080 · PREVIEW</text></g>;
  return <g><defs><linearGradient id={`${prefix}-board`} x2="1" y2="1"><stop stopColor="#234c43"/><stop offset="1" stopColor="#132c2b"/></linearGradient><pattern id={`${prefix}-pcb-grid`} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#95b995" opacity=".15"/></pattern></defs>
    <rect x="155" y="123" width="650" height="470" rx="25" fill="#000" opacity=".4" transform="translate(8 16)"/><rect x="155" y="123" width="650" height="470" rx="25" fill={`url(#${prefix}-board)`} stroke="#548979" strokeWidth="2"/><rect x="164" y="132" width="632" height="452" rx="19" fill={`url(#${prefix}-pcb-grid)`} stroke="#315e50"/>
    {[[182,151],[777,151],[182,565],[777,565]].map(([x,y])=><g key={`${x}-${y}`}><circle cx={x} cy={y} r="13" fill="#acac70"/><circle cx={x} cy={y} r="7" fill="#0d1719"/></g>)}
    <g stroke="#92996b" fill="none" strokeWidth="2" opacity={copper?.8:0} data-testid="copper-traces">
      {Array.from({length:10},(_,i)=><g key={i}><path d={`M269 ${303+i*8}H${288+i*7}L${333+i*7} ${288+i*10}H404`}/><path d={`M566 ${288+i*10}H${590+i*5}L${626+i*4} ${232+i*21}H685`}/><path d={`M${430+i*10} 427V${435+i*6}L${462+i*14} ${465+i*6}H${570+i*4}`}/></g>)}
      <path d="M259 311V171H299M255 371H280V554H649V190H400V220" strokeWidth="5" opacity=".6"/>
      {Array.from({length:12},(_,i)=><circle key={i} cx={582+i%3*19} cy={181+Math.floor(i/3)*15} r="3"/>)}
    </g><g fill="#91b9a7" fontFamily="monospace"><text x="217" y="160" fontSize="15" letterSpacing="4">ORBIT / CTRL</text><text x="218" y="178" fontSize="9">AETHER IO  ·  REV 01</text><text x="583" y="564" fontSize="10">USB-C / 3V3 / GPIO</text><text x="267" y="342" fontSize="9" transform="rotate(-90 267 342)">USB DATA</text><text x="756" y="256" fontSize="10" transform="rotate(90 756 256)">EXPANSION / 16 PIN</text></g>
  </g>;
}
