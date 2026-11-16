import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { LIVE } from "#content";
import { loadStoredContent } from "../lib/data";

// A live guide starts from the last content it downloaded, so it also works with no connection.
void (LIVE ? loadStoredContent() : Promise.resolve()).finally(() => createRoot(document.getElementById("root")!).render(<App />));
