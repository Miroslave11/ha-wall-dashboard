import { lazy, Suspense, useMemo, useState, type CSSProperties } from "react";
import type { DashboardConfig } from "./config/types";
import { HassProvider, useConfig, useHass } from "./ha/HassContext";
import { roomBrightness } from "./ha/actions";
import { useClock } from "./hooks/useClock";
import { useAppUpdate } from "./hooks/useAppUpdate";
import { useIdle } from "./hooks/useIdle";
import { hexToRgbTriplet } from "./utils/color";
import { CamerasPage } from "./components/CamerasPage";
import { ConnectForm } from "./components/ConnectForm";
import { HeatingPage } from "./components/HeatingPage";
import { HomePage } from "./components/HomePage";
import { Icon } from "./components/Icon";
import { NavRail, type PageId } from "./components/NavRail";
import { PhotoFrame } from "./components/PhotoFrame";
import { PlaceholderPage } from "./components/PlaceholderPage";
import { SettingsPage } from "./components/SettingsPage";
import { Stage } from "./components/Stage";
import { TopBar } from "./components/TopBar";

/** Stránka Radar s mapou (Leaflet) se načte až při otevření, ať úvodní stránka zůstane lehká. */
const RadarPage = lazy(() => import("./components/RadarPage").then((m) => ({ default: m.RadarPage })));

function Dashboard() {
  const cfg = useConfig();
  const { entities, error, ready } = useHass();
  const now = useClock(1000);
  const [page, setPage] = useState<PageId>("home");
  // V Nastavení se fotorámeček sám nespouští (rozpracované změny by se ztratily)
  const { idle, wake, start } = useIdle(cfg.photoFrame.idleSeconds * 1000, cfg.photoFrame.enabled && page !== "settings");
  // nová verze z NASu → obnovit stránku (ne uprostřed úprav v Nastavení)
  useAppUpdate(page !== "settings");
  const startPhotoFrame = () => {
    setPage("home");
    start();
  };

  // Po návratu z fotorámečku vždy zpět na hlavní stránku
  const onWake = () => {
    wake();
    setPage("home");
  };

  // Teplé podsvícení celé plochy podle součtu jasů
  const ambient = useMemo(() => {
    const sum = cfg.floorplan.rooms.reduce((a, r) => a + roomBrightness(r, entities), 0);
    return Math.min(1, sum / 3.2);
  }, [cfg.floorplan.rooms, entities]);

  const themeVars = {
    "--accent": cfg.theme.accent,
    "--accent-rgb": hexToRgbTriplet(cfg.theme.accent, "94,224,255"),
    "--light": cfg.theme.light,
    "--light-rgb": hexToRgbTriplet(cfg.theme.light),
  } as CSSProperties;

  if (error) {
    return (
      <div className="center-msg">
        <Icon name="wifiOff" size={48} style={{ color: "#ff9d9d" }} />
        <h1>Nepodařilo se připojit k Home Assistantu</h1>
        <pre>{error}</pre>
        <button className="btn-pill" onClick={() => location.reload()}>
          Zkusit znovu
        </button>
        <div className="center-connect">
          <ConnectForm currentUrl={cfg.hass.url} />
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="center-msg">
        <p>Připojuji k Home Assistantu…</p>
      </div>
    );
  }

  return (
    <Stage width={cfg.stage.width} height={cfg.stage.height}>
      <div className="app" style={themeVars}>
        <div className="ambient" style={{ opacity: ambient }} aria-hidden="true" />
        <NavRail page={page} onNavigate={setPage} onPhotoFrame={cfg.photoFrame.enabled ? startPhotoFrame : undefined} />
        <main className="main">
          <TopBar now={now} />
          {page === "home" && <HomePage />}
          {page === "settings" && <SettingsPage onPhotoFrame={startPhotoFrame} />}
          {page === "radar" && (
            <Suspense fallback={null}>
              <RadarPage />
            </Suspense>
          )}
          {page === "heating" && <HeatingPage />}
          {page === "cameras" && <CamerasPage />}
          {page !== "home" && page !== "settings" && page !== "radar" && page !== "heating" && page !== "cameras" && <PlaceholderPage page={page} />}
        </main>
        {cfg.photoFrame.enabled && <PhotoFrame active={idle} onWake={onWake} now={now} />}
      </div>
    </Stage>
  );
}

export default function App({ config }: { config: DashboardConfig }) {
  return (
    <HassProvider config={config}>
      <Dashboard />
    </HassProvider>
  );
}
