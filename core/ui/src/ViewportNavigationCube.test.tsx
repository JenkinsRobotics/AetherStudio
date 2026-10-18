import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import {
  ViewportNavigationCube,
  viewportCubeTransform,
} from "./ViewportNavigationCube";

test("projects camera orientation into the inverse world cube transform", () => {
  expect(viewportCubeTransform([0, 0, 0, 1])).toBe(
    "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
  );
  const { container, rerender } = render(
    <ViewportNavigationCube
      orientation={[0, 0, 0, 1]}
      onSelectView={() => {}}
      onFit={() => {}}
      onNudge={() => {}}
      onRoll={() => {}}
    />,
  );
  const front = container.querySelector<SVGElement>('[data-view="front"]');
  const originalPoints = front?.querySelector("polygon")?.getAttribute("points");
  expect(front).not.toBeNull();
  rerender(
    <ViewportNavigationCube
      orientation={[0, Math.SQRT1_2, 0, Math.SQRT1_2]}
      onSelectView={() => {}}
      onFit={() => {}}
      onNudge={() => {}}
      onRoll={() => {}}
    />,
  );
  expect(container.querySelector('[data-view="front"]')).toBeNull();
  expect(container.querySelector('[data-view="right"]')).not.toBeNull();
  expect(originalPoints).not.toBe("");
});

test("keeps face lettering at shallow angles until the face turns out of view", () => {
  const props = { onSelectView: () => {}, onFit: () => {}, onNudge: () => {}, onRoll: () => {} };
  const { container, rerender } = render(<ViewportNavigationCube {...props} orientation={[0, 0, 0, 1]} />);
  for (const degrees of [0.01, 1, 10, 15, 17, 30, 75, 89, 89.99]) {
    const halfAngle = degrees * Math.PI / 360;
    rerender(<ViewportNavigationCube {...props} orientation={[0, Math.sin(halfAngle), 0, Math.cos(halfAngle)]} />);
    expect(container.querySelector('[data-view="right"] text')?.textContent).toBe("RIGHT");
    expect(container.querySelector('[data-view="front"] text')?.textContent).toBe("FRONT");
    expect(container.querySelector('[data-view="back"]')).toBeNull();
    expect(container.querySelector('[data-view="left"]')).toBeNull();
  }
  const halfAngle = 91 * Math.PI / 360;
  rerender(<ViewportNavigationCube {...props} orientation={[0, Math.sin(halfAngle), 0, Math.cos(halfAngle)]} />);
  expect(container.querySelector('[data-view="front"]')).toBeNull();
  expect(container.querySelector('[data-view="back"] text')?.textContent).toBe("BACK");
});

test("emits typed face, fit, nudge, and roll intent", () => {
  const onSelectView = vi.fn();
  const onFit = vi.fn();
  const onNudge = vi.fn();
  const onRoll = vi.fn();
  render(
    <ViewportNavigationCube
      orientation={[0, 0, 0, 1]}
      onSelectView={onSelectView}
      onFit={onFit}
      onNudge={onNudge}
      onRoll={onRoll}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Front view" }));
  fireEvent.click(screen.getByRole("button", { name: "Nudge view left 15 degrees" }));
  fireEvent.click(screen.getByRole("button", { name: "Roll view clockwise" }));
  fireEvent.click(screen.getByRole("button", { name: "Home view" }));

  expect(onSelectView).toHaveBeenCalledWith("front");
  expect(onNudge).toHaveBeenCalledWith(-1, 0);
  expect(onRoll).toHaveBeenCalledWith(1);
  expect(onFit).toHaveBeenCalledTimes(1);
});

test('face lettering follows a half-turn camera roll instead of staying upright',()=>{
 const props={onSelectView:()=>{},onFit:()=>{},onNudge:()=>{},onRoll:()=>{}};
 const {container,rerender}=render(<ViewportNavigationCube {...props} orientation={[0,0,0,1]}/>);
 expect(container.querySelector('[data-view="front"] text')?.getAttribute('transform')).toBe('matrix(1 0 0 1 46 46)');
 rerender(<ViewportNavigationCube {...props} orientation={[0,0,1,0]}/>);
 expect(container.querySelector('[data-view="front"] text')?.getAttribute('transform')).toBe('matrix(-1 0 0 -1 46 46)');
});

test("edge and corner regions emit their shared direction by pointer and keyboard",()=>{
 const onSelectDirection=vi.fn();
 render(<ViewportNavigationCube orientation={[0,0,0,1]} onSelectDirection={onSelectDirection} onSelectView={()=>{}} onFit={()=>{}} onRoll={()=>{}} onNudge={()=>{}}/>);
 fireEvent.click(screen.getByRole('button',{name:'Right Front view'}));
 onSelectDirection.mock.calls[0][0].forEach((n:number,i:number)=>expect(n).toBeCloseTo([Math.SQRT1_2,0,Math.SQRT1_2][i]));
 fireEvent.keyDown(screen.getByRole('button',{name:'Right Top Front view'}),{key:'Enter'});
 expect(onSelectDirection.mock.calls[1][0]).toEqual([1/Math.sqrt(3),1/Math.sqrt(3),1/Math.sqrt(3)]);
});

test("Z-up labels and navigation targets agree with a front camera while X stays right", () => {
  const onSelectView = vi.fn();
  const { container } = render(<ViewportNavigationCube upAxis="z" orientation={[Math.SQRT1_2, 0, 0, Math.SQRT1_2]} onSelectView={onSelectView} onFit={()=>{}} onNudge={()=>{}} onRoll={()=>{}} />);
  expect(container.querySelector('[data-view="front"] text')?.textContent).toBe("FRONT");
  expect(container.querySelector('[data-view="top"]')).toBeNull();
  fireEvent.click(container.querySelector('[data-view="front"]')!);
  expect(onSelectView).toHaveBeenCalledWith("front");
  const x = container.querySelector('.aui-viewport-cube-axis-x line')!;
  const z = container.querySelector('.aui-viewport-cube-axis-z line')!;
  expect(Number(x.getAttribute('x2'))).toBeGreaterThan(Number(x.getAttribute('x1')));
  expect(Number(z.getAttribute('y2'))).toBeLessThan(Number(z.getAttribute('y1')));
});

test("gives axes depth masks scoped independently for multiple cube widgets", () => {
  const props={orientation:[0,0,0,1] as const,onSelectView:()=>{},onFit:()=>{},onNudge:()=>{},onRoll:()=>{}};
  const { container }=render(<><ViewportNavigationCube {...props}/><ViewportNavigationCube {...props}/></>);
  const masks=[...container.querySelectorAll('mask')];
  expect(new Set(masks.map(mask=>mask.id)).size).toBe(masks.length);
  for (const axis of container.querySelectorAll('.aui-viewport-cube-axes line, .aui-viewport-cube-axes text, .aui-viewport-cube-axes circle')) {
    const id=axis.getAttribute('mask')!.slice(5,-1);
    expect(masks.some(mask=>mask.id===id)).toBe(true);
  }
});
