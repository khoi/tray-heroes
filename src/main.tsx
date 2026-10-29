import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles.css";
import { App } from "./ui/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
