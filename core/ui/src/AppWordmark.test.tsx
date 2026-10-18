import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { appMarkSources } from "@aether/assets/branding/marks/sources";
import { appWordmarkData } from "@aether/assets/branding/wordmarks/data";
import { AppWordmark, type AppWordmarkName } from "./AppWordmark";
import { ApplicationIdentity } from "./ApplicationChrome";
import { sectionTab, SHOWCASE_TABS } from "../gallery/showcase";
afterEach(cleanup);
test("all nine wordmarks retain their matching original A and accessible product name",()=>{
 const apps=Object.keys(appWordmarkData.apps) as AppWordmarkName[];expect(apps).toHaveLength(9);
 const {container}=render(<>{apps.map(app=><AppWordmark key={app} app={app}/>)}</>);
 for(const app of apps){const logo=screen.getByRole('img',{name:`Aether ${appWordmarkData.apps[app].name}`});expect(logo.querySelector('image')?.getAttribute('href')).toBe(appMarkSources[app]);expect(logo.getAttribute('height')).toBe('36');expect(logo.querySelectorAll('path')).toHaveLength(2);}
 const ids=Array.from(container.querySelectorAll('linearGradient')).map(el=>el.id);expect(new Set(ids).size).toBe(apps.length);
});
test("light/dark variants and header sizes preserve proportions without clipping long names",()=>{
 const {rerender}=render(<AppWordmark app="animation" size={28} appearance="light"/>);let logo=screen.getByRole('img',{name:'Aether Animation'});const ratio=Number(logo.getAttribute('width'))/28;expect(logo.getAttribute('data-appearance')).toBe('light');rerender(<AppWordmark app="animation" size={40} appearance="dark"/>);logo=screen.getByRole('img',{name:'Aether Animation'});expect(Number(logo.getAttribute('width'))/40).toBeCloseTo(ratio);expect(logo.getAttribute('data-appearance')).toBe('dark');expect(logo.getAttribute('preserveAspectRatio')).toBe('xMinYMid meet');
});
test("header wordmark keeps one accessible home link and supports A-only collapsed identity",()=>{
 const onHome=vi.fn(e=>e.preventDefault());const {rerender}=render(<ApplicationIdentity id="cad" name="Aether CAD" launcher={false} onHome={onHome}/>);
 const link=screen.getByRole('link',{name:'Aether CAD home'});expect(link.querySelector('.aui-app-wordmark')).toBeTruthy();expect(screen.queryByRole('img')).toBeNull();fireEvent.click(link);expect(onHome).toHaveBeenCalledOnce();
 rerender(<ApplicationIdentity id="cad" name="Aether CAD" launcher={false} showName={false}/>);expect(screen.getByRole('link').querySelector('img')?.getAttribute('src')).toBe(appMarkSources.cad);expect(document.querySelector('.aui-app-wordmark')).toBeNull();
});
test("custom app identities keep their existing fallback and wordmarks are grouped with assets",()=>{
 render(<ApplicationIdentity id="custom" name="Custom app" identityStyle="wordmark" launcher={false}/>);expect(screen.getByText('Custom app')).toBeTruthy();expect(screen.getByRole('link',{name:'Custom app home'})).toBeTruthy();expect(sectionTab('Application header logos')).toBe('icons');expect(SHOWCASE_TABS.find(t=>t.id==='icons')!.sections).toContain('Application header logos');expect(SHOWCASE_TABS.find(t=>t.id==='windows')!.sections).not.toContain('Application header logos');
});
