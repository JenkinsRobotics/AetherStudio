import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { INITIAL_STYLE, PropertiesPanelSpecimen } from "../gallery/PropertiesPanelDemo";

afterEach(cleanup);
const commit = (label: string, value: string) => {
  const input = screen.getByRole("textbox", {name:label});
  fireEvent.input(input,{target:{value}});
  fireEvent.blur(input);
};
const shape = () => screen.getByTestId("styled-object");

test("linked and independent corners update the correct preview corners", () => {
  render(<PropertiesPanelSpecimen/>);
  commit("Top left radius","24");
  expect(shape().style.borderRadius).toBe("24px 24px 24px 24px");
  fireEvent.click(screen.getByRole("button",{name:"Link corner radii"}));
  commit("Bottom left radius","4");
  expect(shape().style.borderRadius).toBe("24px 24px 24px 4px");
  commit("Width","300");
  expect(shape().style.width).toBe("300px");
  commit("Width","-2");
  expect(shape().style.width).toBe("300px");
});

test("paint controls validate colors and preserve values while disabled", () => {
  render(<PropertiesPanelSpecimen/>);
  commit("Fill color","#abcdef");
  expect(shape().style.background).toBe("rgb(171, 205, 239)");
  commit("Fill color","invalid");
  expect(screen.getByRole("alert").textContent).toContain("six-digit");
  expect(shape().style.background).toBe("rgb(171, 205, 239)");
  fireEvent.click(screen.getByRole("checkbox",{name:"Enable fill"}));
  expect(shape().style.background).toBe("transparent");
  expect((screen.getByRole("textbox",{name:"Fill color"}) as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox",{name:"Enable fill"}));
  expect(shape().style.background).toBe("rgb(171, 205, 239)");
  fireEvent.change(screen.getByRole("combobox",{name:"Border style"}),{target:{value:"dashed"}});
  commit("Thickness","6");
  expect(shape().style.borderStyle).toBe("dashed");
  expect(shape().style.borderWidth).toBe("6px");
});

test("shadow, section disclosure and reset remain independently editable", () => {
  render(<PropertiesPanelSpecimen/>);
  commit("Offset X","-12");
  commit("Blur","40");
  expect(shape().style.boxShadow).toContain("-12px 12px 40px");
  fireEvent.click(screen.getByRole("button",{name:"Shadow"}));
  expect(screen.queryByRole("textbox",{name:"Blur"})).toBeNull();
  fireEvent.click(screen.getByRole("checkbox",{name:"Enable shadow"}));
  expect(shape().style.boxShadow).toBe("none");
  fireEvent.click(screen.getByRole("button",{name:"Reset properties"}));
  expect(shape().style.boxShadow).toContain("0px 12px 28px");
  expect(shape().style.width).toBe(`${INITIAL_STYLE.width}px`);
});
