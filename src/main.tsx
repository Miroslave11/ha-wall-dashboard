import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/300.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "./styles/global.css";
import App from "./App";
import { applyStoredConnection, getStoredHassUrl } from "./config/connection";
import { loadConfig, validateConfig } from "./config/loadConfig";

const root = createRoot(document.getElementById("root")!);

// ?lowpower v URL vypne rozostření skla (pro slabé tablety)
if (new URLSearchParams(location.search).has("lowpower")) {
  document.documentElement.classList.add("low-power");
}

loadConfig()
  // adresa HA zadaná v aplikaci (Nastavení → Připojení) má přednost před souborem
  .then((fileConfig) => applyStoredConnection(fileConfig, getStoredHassUrl()))
  .then((config) => {
    const errors = validateConfig(config);
    if (errors.length) throw new Error("Chyby v config.json:\n• " + errors.join("\n• "));
    root.render(
      <StrictMode>
        <App config={config} />
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    root.render(
      <div className="center-msg">
        <h1>Dashboard se nespustil</h1>
        <pre>{err instanceof Error ? err.message : String(err)}</pre>
      </div>,
    );
  });
