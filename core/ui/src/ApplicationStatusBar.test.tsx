import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ApplicationStatusBar } from "./ApplicationStatusBar";
import { createApplicationStatusBar, updateApplicationStatusBar } from "./application-status";

test("React and hosted DOM use the same identity, status and company structure", () => {
  const props = { appName: "Aether CAD", companyName: "Jenkins Robotics", connection: "connected" as const };
  const { container, rerender } = render(<ApplicationStatusBar {...props} />);
  expect(container.firstElementChild?.outerHTML).toBe(createApplicationStatusBar(props).outerHTML);
  const row = screen.getByLabelText("Application status");
  expect(row.children[0].textContent).toBe("Connected to StudioAether CAD");
  expect(row.lastElementChild?.textContent).toBe("Jenkins Robotics");
  const liveStatus = screen.getByRole("status");
  rerender(<ApplicationStatusBar {...props} connection="offline" />);
  expect(screen.getByRole("status")).toBe(liveStatus);
  expect(liveStatus.textContent).toBe("Studio unavailable");
  expect(row.querySelector(".aui-application-status__message")?.textContent).toBe("Studio unavailable");
  rerender(<ApplicationStatusBar {...props} />);
  expect(row.querySelector(".aui-application-status__message")?.textContent).toBe("");
});

test("unknown company stays empty, local mode is honest and supplied text cannot inject markup", () => {
  const row = createApplicationStatusBar({ appName: "Aether Map", connection: "local" });
  expect(row.dataset.connection).toBe("local");
  expect(row.lastElementChild?.textContent).toBe("");
  updateApplicationStatusBar(row, { appName: "Map", companyName: "<img src=x>", connection: "connecting" });
  expect(row.querySelector("img")).toBeNull();
  expect(row.lastElementChild?.textContent).toBe("<img src=x>");
  expect(row.querySelector('[role="status"]')?.textContent).toBe("Connecting to Studio…");
});
