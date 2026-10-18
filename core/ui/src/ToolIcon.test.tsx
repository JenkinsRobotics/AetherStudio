import packagedAssets0 from "@aether/assets/catalogs/4bfcb1fee69082";
import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { ToolIcon, toolIconNames } from "./ToolIcon";

test("illustrated tools isolate gradient references across repeated instances", () => {
  const { container } = render(<><ToolIcon name="extrude" /><ToolIcon name="extrude" /></>);
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const svg of container.querySelectorAll('svg')) {
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    for (const element of svg.querySelectorAll('[fill]')) {
      const id = element.getAttribute('fill')?.match(/^url\(#(.+)\)$/)?.[1];
      if (id) expect([...svg.querySelectorAll('[id]')].some(node => node.id === id)).toBe(true);
    }
  }
});

test("every shared illustration is scalable vector geometry with no font or raster dependency", () => {
  const { container } = render(<>{toolIconNames.map(name => <ToolIcon key={name} name={name} />)}</>);
  expect(container.querySelectorAll('svg')).toHaveLength(toolIconNames.length);
  expect(container.querySelector('text,image,script,foreignObject')).toBeNull();
  for (const svg of container.querySelectorAll('svg')) {
    expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(svg.querySelector('path,circle')).not.toBeNull();
  }
});

// Each app (and each specimen) can opt into the pack without a global icon swap.
test("Graphite is scoped, supports prop overrides, and leaves the classic default intact", async () => {
  const { ToolIconTheme } = await import("./ToolIconTheme");
  const { container, rerender } = render(<>
    <ToolIcon name="part" />
    <ToolIconTheme pack="graphite-ribbon" palette="light">
      <ToolIcon name="part" />
      <ToolIcon name="part" pack="classic" />
      <ToolIcon name="part" palette="dark" />
    </ToolIconTheme>
  </>);
  const icons = [...container.querySelectorAll('svg')];
  expect(icons.map(icon => icon.getAttribute('data-icon-pack'))).toEqual(['classic', 'graphite-ribbon', 'classic', 'graphite-ribbon']);
  expect(icons[1].getAttribute('data-icon-palette')).toBe('light');
  expect(icons[3].getAttribute('data-icon-palette')).toBe('dark');
  expect(icons[0].innerHTML).not.toContain('--graphite-');
  expect(icons[1].innerHTML).toContain('--graphite-');
  rerender(<ToolIconTheme pack="graphite-ribbon" palette="dark"><ToolIcon name="part" /></ToolIconTheme>);
  expect(container.querySelector('svg')?.getAttribute('data-icon-palette')).toBe('dark');
});

test("Graphite covers the whole tool catalog with isolated gradients in repeated ribbons", async () => {
  const { graphiteToolIconNames } = await import("./ToolIcon");
  expect(toolIconNames.every(name => graphiteToolIconNames.includes(name))).toBe(true);
  expect(graphiteToolIconNames.length).toBeGreaterThanOrEqual(toolIconNames.length);
  const { container } = render(<>{(['light', 'dark'] as const).map(palette =>
    graphiteToolIconNames.map(name => <ToolIcon key={`${palette}-${name}`} name={name} pack="graphite-ribbon" palette={palette} />)
  )}</>);
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const svg of container.querySelectorAll('svg')) {
    expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(svg.querySelector('path,circle')).not.toBeNull();
    for (const element of svg.querySelectorAll('[fill],[stroke]')) {
      for (const attribute of ['fill', 'stroke']) {
        const id = element.getAttribute(attribute)?.match(/^url\(#(.+)\)$/)?.[1];
        if (id) expect([...svg.querySelectorAll('[id]')].some(node => node.id === id)).toBe(true);
      }
    }
  }
  expect(container.querySelector('text,image,script,foreignObject')).toBeNull();
});

test("standalone light and dark files are complete, self-contained SVGs", async () => {
  const { graphiteToolIconNames } = await import('./ToolIcon');
  const files = (packagedAssets0 as Record<string, string>);
  const base = "../../assets/icon-packs/graphite-ribbon";
  for (const name of graphiteToolIconNames) {
    const variants = ['light', 'dark'].map(palette => files[`${base}/${palette}/${name}.svg`]);
    expect(variants[0]).not.toBe(variants[1]);
    for (const text of variants) {
      expect(text).toBeTypeOf('string');
      expect(text).not.toMatch(/var\(|currentColor|<image|<script|<foreignObject/);
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
      expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 32 32');
      const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const node of doc.querySelectorAll('[fill],[stroke]')) {
        for (const attr of ['fill','stroke']) {
          const value = node.getAttribute(attr);
          if (!value) continue;
          expect(value).toMatch(/^(none|#[0-9a-f]{6}|url\(#[^)]+\))$/i);
          const target = value.match(/^url\(#([^)]+)\)$/)?.[1];
          if (target) expect(ids).toContain(target);
        }
      }
    }
  }
});

test("Classic retains transparent source defaults and stroke-only undo/redo", () => {
  const names = ['normal', 'arc', 'center-arc', 'elliptical-arc', 'circumscribed-polygon', 'text', 'undo', 'redo'] as const;
  const { container } = render(<>{names.map(name => <ToolIcon key={name} name={name} pack="classic" />)}</>);
  for (const svg of container.querySelectorAll('svg')) {
    // These defaults are inherited by the unfilled paths, ellipses and circles.
    expect(svg.querySelector('g[fill="none"]')).not.toBeNull();
  }
  for (const svg of [...container.querySelectorAll('svg')].slice(-2)) {
    const source = svg.querySelector('g[stroke="currentColor"]');
    expect(source?.getAttribute('fill')).toBe('none');
    expect(source?.getAttribute('stroke-width')).toBe('1.7');
    expect(source?.getAttribute('stroke-linecap')).toBe('round');
  }
});

test("every Classic material reference resolves within its own SVG", () => {
  const { container } = render(<>{toolIconNames.map(name => <ToolIcon key={name} name={name} pack="classic" />)}</>);
  for (const svg of container.querySelectorAll('svg')) {
    const ids = [...svg.querySelectorAll('[id]')].map(node => node.id);
    for (const node of svg.querySelectorAll('[fill],[stroke]')) {
      for (const attr of ['fill', 'stroke']) {
        const target = node.getAttribute(attr)?.match(/^url\(#([^)]+)\)$/)?.[1];
        if (target) expect(ids).toContain(target);
      }
    }
  }
});
