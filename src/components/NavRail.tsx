import { Icon, type IconName } from "./Icon";

export type PageId = "home" | "vacuum" | "garden" | "radar" | "heating" | "blinds" | "cameras" | "settings";

const ITEMS: Array<{ id: PageId; label: string; icon: IconName }> = [
  { id: "home", label: "Domů", icon: "home" },
  { id: "vacuum", label: "Vysavač", icon: "vacuum" },
  { id: "garden", label: "Zahrádka", icon: "leaf" },
  { id: "radar", label: "Radar", icon: "radar" },
  { id: "heating", label: "Topení", icon: "flame" },
  { id: "blinds", label: "Žaluzie", icon: "blinds" },
  { id: "cameras", label: "Kamery", icon: "camera" },
];

interface Props {
  page: PageId;
  onNavigate: (p: PageId) => void;
  onPhotoFrame?: () => void;
}

export function NavRail({ page, onNavigate, onPhotoFrame }: Props) {
  return (
    <nav className="nav glass" aria-label="Hlavní menu">
      {ITEMS.map((it) => (
        <button
          key={it.id}
          className={`nav-btn${page === it.id ? " nav-btn--active" : ""}`}
          aria-current={page === it.id ? "page" : undefined}
          onClick={() => onNavigate(it.id)}
        >
          <Icon name={it.icon} />
          <span>{it.label}</span>
        </button>
      ))}
      {onPhotoFrame && (
        <button className="nav-btn" onClick={onPhotoFrame}>
          <Icon name="image" />
          <span>Rámeček</span>
        </button>
      )}
      <div className="nav-spacer" />
      <button
        className={`nav-btn${page === "settings" ? " nav-btn--active" : ""}`}
        aria-current={page === "settings" ? "page" : undefined}
        onClick={() => onNavigate("settings")}
      >
        <Icon name="settings" />
        <span>Nastavení</span>
      </button>
    </nav>
  );
}
