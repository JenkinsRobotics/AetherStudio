import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { SignalMonitor } from "./SignalMonitor";

test("empty instrumentation does not fabricate samples and updates from supplied data", () => {
  const { rerender } = render(<SignalMonitor caption="Input A" traces={[]} />);
  const chart = screen.getByRole("img", { name: "Input A" });
  expect(chart.querySelectorAll("polyline")).toHaveLength(0);
  rerender(
    <SignalMonitor
      caption="Input A"
      traces={[{ id: "a", label: "Channel A", values: [0, 1, 0] }]}
    />,
  );
  expect(chart.querySelectorAll("polyline")).toHaveLength(1);
  expect(screen.getByText("Channel A")).toBeTruthy();
});

test("multiple monitors have independent grid references", () => {
  render(
    <>
      <SignalMonitor caption="Input A" traces={[]} />
      <SignalMonitor caption="Input B" traces={[]} />
    </>,
  );
  const charts = [
    screen.getByRole("img", { name: "Input A" }),
    screen.getByRole("img", { name: "Input B" }),
  ];
  const ids = charts.map((chart) => chart.querySelector("pattern")!.id);
  expect(new Set(ids).size).toBe(2);
  charts.forEach((chart, index) =>
    expect(chart.querySelector("rect")!.getAttribute("fill")).toBe(
      `url(#${ids[index]})`,
    ),
  );
});
