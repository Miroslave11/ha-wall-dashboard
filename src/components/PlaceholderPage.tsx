import type { PageId } from "./NavRail";

const TITLES: Partial<Record<PageId, string>> = {
  vacuum: "Vysavač",
  garden: "Zahrádka",
  radar: "Radar",
  heating: "Topení",
  blinds: "Žaluzie",
  cameras: "Web kamery",
};

/** Stránky, které ještě nejsou hotové – viz CLAUDE.md, sekce „Další kroky“. */
export function PlaceholderPage({ page }: { page: PageId }) {
  return (
    <section className="page glass" aria-label={TITLES[page]}>
      <h1 className="card-title">{TITLES[page] ?? page}</h1>
      <p>Tahle stránka zatím není hotová. Navrhnout a napojit ji můžeš v dalším kroku – v CLAUDE.md je seznam připravených úkolů.</p>
    </section>
  );
}
