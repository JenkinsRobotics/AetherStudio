import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AetherIcon, type AetherIconName } from "./AetherIcon";
import "./ConceptWidgets.css";

export interface SpecimenDefinition { id: string; title: string; detail: string; icon: AetherIconName; idealSize?: string; previewHeight?: number; designSize?: readonly [number,number]; content: ReactNode; }
export interface SpecimenSectionDefinition { id: string; title: string; detail: string; specimens: readonly SpecimenDefinition[]; minimumWidth?: number; maximumWidth?: number; }
export interface SpecimenBoardProps {
  title: string;
  detail: string;
  icon?: AetherIconName;
  eyebrow?: string;
  stats?: readonly string[];
  status?: string;
  sections: readonly SpecimenSectionDefinition[];
}

export function SpecimenBoard({ title, detail, icon = "hammer", eyebrow, stats = [], status, sections }: SpecimenBoardProps) {
  return <div className="aui-specimen-board">
    <header className="aui-specimen-board__intro">
      <AetherIcon name={icon} />
      <div>{eyebrow ? <small>{eyebrow}</small> : null}<strong>{title}</strong><span>{detail}</span></div>
      {stats.length || status ? <aside>{stats.map((stat) => <b key={stat}>{stat}</b>)}{status ? <em>{status}</em> : null}</aside> : null}
    </header>
    {sections.map((section) => <section className="aui-specimen-board__section" key={section.id}>
      <header><strong>{section.title}</strong><span>{section.detail}</span><small>{section.specimens.length}</small></header>
      <div className="aui-specimen-board__grid" style={{ "--aui-specimen-min": `${section.minimumWidth ?? 290}px`, "--aui-specimen-max": `${section.maximumWidth ?? 410}px` } as CSSProperties}>
        {section.specimens.map((specimen) => {
          return <article className="aui-specimen-card" key={specimen.id}>
          <header><AetherIcon name={specimen.icon} /><strong>{specimen.title}</strong><span>{specimen.detail}</span>{specimen.idealSize ? <small>IDEAL {specimen.idealSize}</small> : null}</header>
          <div className="aui-specimen-card__content" style={{ "--aui-specimen-height": `${specimen.previewHeight ?? 120}px` } as CSSProperties}>{specimen.designSize ? <ScaledSpecimen size={specimen.designSize} height={specimen.previewHeight ?? 370}>{specimen.content}</ScaledSpecimen> : specimen.content}</div>
        </article>;
        })}
      </div>
    </section>)}
  </div>;
}

function ScaledSpecimen({size,height,children}: {size:readonly [number,number];height:number;children:ReactNode}) {
  const host=useRef<HTMLDivElement>(null);
  const [scale,setScale]=useState(1);
  const [width,designHeight]=size;
  useEffect(()=>{
    const element=host.current;
    if(!element || typeof ResizeObserver === "undefined") return;
    const measure=()=>setScale(Math.min(element.clientWidth/width,height/designHeight,1));
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return ()=>observer.disconnect();
  },[width,designHeight,height]);
  return <div ref={host} className="aui-scaled-specimen" style={{height}}><div style={{width,height:designHeight,transform:`scale(${scale})`,transformOrigin:"top left"}}>{children}</div></div>;
}
