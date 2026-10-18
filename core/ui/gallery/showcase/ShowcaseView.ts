import { createContext, useContext } from "react";
import type { ShowcaseLocation } from "./collections";
export const ShowcaseViewContext = createContext<ShowcaseLocation>({ tab: "home", section: "Home", mode: "light" });
export const useShowcaseView = () => useContext(ShowcaseViewContext);
