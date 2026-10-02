import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { blocsCompetence, criteres, filieres, getCritere, niveaux } from "@/content/habilitation";

export const dynamic = "force-dynamic";

/**
 * Rattachement des questions (question 87, choix a, 01/10/2026) : les deux
 * schémas de la page « Rattachement des questions », publiée d'abord à part,
 * entrent dans le site, au sous-menu Squelette. Le dépôt des questions et la
 * banque y renvoient. Tutorat et administration : ils déposent tous deux.
 *
 * Les schémas sont fixes : ils décrivent le fonctionnement du site, pas les
 * réglages en base. Seuls les nombres et les codes tirés de la fiche
 * (`content/habilitation.ts`) suivent le code. Un changement du modèle
 * (ce qui décide qu'un agent voit une question) se reporte ici, à la main.
 *
 * Chaque schéma est dessiné deux fois : en largeur, et en colonne quand son
 * cadre fait moins de 920 px (`.logigramme`, `app/globals.css`).
 */
export default async function RattachementQuestions() {
  const session = await sessionRequise("tuteur");
  const admin = session.role === "admin";
  // Écran réservé à l'administration : nommé, sans lien, pour le tutorat.
  const ecran = (href: string, libelle: string) =>
    admin ? <Link href={href}>{libelle}</Link> : <>{libelle} (administration)</>;
  const b101 = getCritere("B1-01");

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Comment sont rattachées les questions&nbsp;?</h1>
        <p>
          <strong>Ce n&apos;est pas la question qui ouvre un niveau, c&apos;est son module.</strong> Une question
          appartient à un module, et le module est coché pour des filières et des niveaux. L&apos;agent entre avec
          un code qui porte sa filière et son niveau : il reçoit le tronc commun et les modules publiés cochés pour
          eux, puis, dans chaque module, des questions validées, sous le plafond de son niveau. Les étiquettes de
          profil d&apos;une question ne font que la réserver, dans son module, à certaines filières ou certains
          niveaux.
        </p>
        <p className="legende" style={{ margin: 0 }}>
          Un module déposé se coche dans son formulaire (<Link href="/admin/modules">Modules</Link>), celui
          d&apos;un critère dans {ecran("/admin/rattachement", "Rattachement des modules")} ; une question se
          range au <Link href="/admin/questions/import">dépôt</Link> ou dans la{" "}
          <Link href="/admin/questions">Banque de questions</Link> ; le plafond se règle dans{" "}
          {ecran("/admin/niveaux-questions", "Niveaux des questions")}.
        </p>
      </section>

      <section className="section" aria-labelledby="titre-qui-voit">
        <div className="section-titre">
          <h2 id="titre-qui-voit" style={{ fontSize: "1.15rem" }}>Qui voit quelle question</h2>
        </div>
        <SchemaQuiVoit />
      </section>

      <section className="section" aria-labelledby="titre-rangements">
        <div className="section-titre">
          <h2 id="titre-rangements" style={{ fontSize: "1.15rem" }}>
            Une question qui recoupe un critère : trois rangements
          </h2>
        </div>
        <p className="section-intro">
          Un module déposé, comme ceux d&apos;un classeur de formation, ne recoupe pas forcément les critères de la
          fiche un pour un. Chacune de ses questions peut rester dans ce module, rejoindre le module du critère, ou
          être dans les deux. Exemple : une question du module 3 du classeur du pool de manipulation.
        </p>
        <SchemaTroisRangements libelleB101={b101?.libelle} />
      </section>

      <p className="legende" style={{ marginTop: "1.5rem" }}>
        Schémas fixes : ils décrivent le fonctionnement du site, pas vos réglages. Les modules d&apos;une filière
        et leurs niveaux se lisent sur sa page, dans <Link href="/admin/filieres">Filières</Link>.
      </p>
    </>
  );
}

/** Pointes de flèche d'un schéma : grise, et en couleur pour le lien qui décide. */
function Pointes({ prefixe }: { prefixe: string }) {
  return (
    <defs>
      <marker id={`${prefixe}-p`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="lg-pointe" />
      </marker>
      <marker id={`${prefixe}-pc`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="lg-pointe-cle" />
      </marker>
    </defs>
  );
}

function SchemaQuiVoit() {
  const premierCritere = criteres[0]?.id ?? "";
  const dernierCritere = criteres[criteres.length - 1]?.id ?? "";
  const premierNiveau = niveaux[0]?.code ?? "";
  const dernierNiveau = niveaux[niveaux.length - 1]?.code ?? "";
  const p = "url(#rq1-p)";
  const pc = "url(#rq1-pc)";
  const pe = "url(#rq1e-p)";
  const pce = "url(#rq1e-pc)";
  return (
    <figure className="logigramme" id="qui-voit">
      <div className="logigramme-cadre">
        <svg
          className="lg-large"
          viewBox="0 0 960 580"
          role="img"
          aria-label="À gauche le profil de l'agent : métier, filière, niveau, code d'accès. À droite le contenu : bloc, critère, module, question. Le seul lien entre les deux : le module est coché pour des filières et des niveaux. Le code d'accès ouvre le programme de l'agent, qui reçoit les modules publiés et cochés ; l'évaluation d'un module tire des questions validées sous le plafond du niveau de l'agent."
        >
          <Pointes prefixe="rq1" />

          <text x="149" y="22" textAnchor="middle" className="lg-col">{"PROFIL DE L'AGENT"}</text>
          <text x="480" y="22" textAnchor="middle" className="lg-col">{"CE QUE L'AGENT REÇOIT"}</text>
          <text x="811" y="22" textAnchor="middle" className="lg-col">CONTENU DE FORMATION</text>

          {/* Profil */}
          <rect x="24" y="40" width="250" height="62" rx="8" className="lg-boite" />
          <text x="40" y="66" className="lg-titre">Métier</text>
          <text x="40" y="86" className="lg-sous">préparateur, pharmacien, aide…</text>
          <rect x="24" y="150" width="250" height="62" rx="8" className="lg-boite" />
          <text x="40" y="176" className="lg-titre">Filière (profil de poste)</text>
          <text x="40" y="196" className="lg-sous">{`${filieres.length} de la fiche, puis ajoutées`}</text>
          <rect x="24" y="260" width="250" height="62" rx="8" className="lg-boite" />
          <text x="40" y="286" className="lg-titre">Niveau</text>
          <text x="40" y="306" className="lg-sous">{`${premierNiveau} … ${dernierNiveau}, puis ajoutés`}</text>
          <rect x="24" y="390" width="250" height="62" rx="8" className="lg-boite" />
          <text x="40" y="416" className="lg-titre">{"Code d'accès de l'agent"}</text>
          <text x="40" y="436" className="lg-sous">une filière et un de ses niveaux</text>

          <line x1="149" y1="102" x2="149" y2="146" className="lg-fleche" markerEnd={p} />
          <text x="159" y="129" className="lg-etiq">range</text>
          <line x1="149" y1="212" x2="149" y2="256" className="lg-fleche" markerEnd={p} />
          <text x="159" y="239" className="lg-etiq">porte</text>
          <line x1="149" y1="322" x2="149" y2="386" className="lg-fleche" markerEnd={p} />
          <text x="159" y="359" className="lg-etiq">choisi au code</text>

          {/* Contenu */}
          <rect x="686" y="40" width="250" height="62" rx="8" className="lg-boite" />
          <text x="702" y="66" className="lg-titre">Bloc</text>
          <text x="702" y="86" className="lg-sous">{`1 à ${blocsCompetence.length} de la fiche, puis ajoutés`}</text>
          <rect x="686" y="150" width="250" height="62" rx="8" className="lg-boite" />
          <text x="702" y="176" className="lg-titre">Critère de la fiche</text>
          <text x="702" y="196" className="lg-sous">{`${criteres.length}, de ${premierCritere} à ${dernierCritere}, figés`}</text>
          <rect x="686" y="260" width="250" height="62" rx="8" className="lg-boite-cle" />
          <text x="702" y="286" className="lg-titre">Module</text>
          <text x="702" y="306" className="lg-sous">du code (un par critère) ou déposé</text>
          <rect x="686" y="390" width="250" height="62" rx="8" className="lg-boite" />
          <text x="702" y="416" className="lg-titre">Question</text>
          <text x="702" y="436" className="lg-sous">un des trois niveaux des questions</text>

          <line x1="811" y1="102" x2="811" y2="146" className="lg-fleche" markerEnd={p} />
          <text x="821" y="129" className="lg-etiq">contient</text>
          <line x1="811" y1="212" x2="811" y2="256" className="lg-fleche" markerEnd={p} />
          <text x="821" y="239" className="lg-etiq">couvert par</text>
          <line x1="811" y1="388" x2="811" y2="326" className="lg-fleche" markerEnd={p} />
          <text x="803" y="352" textAnchor="end" className="lg-etiq">appartient à,</text>
          <text x="803" y="367" textAnchor="end" className="lg-etiq">et « aussi posée dans »</text>

          {/* Le seul lien entre les deux colonnes */}
          <path d="M686 280 H560 V181 H278" className="lg-cle" markerEnd={pc} />
          <text x="418" y="172" textAnchor="middle" className="lg-etiq-cle">coché pour des filières</text>
          <path d="M686 302 H278" className="lg-cle" markerEnd={pc} />
          <text x="418" y="294" textAnchor="middle" className="lg-etiq-cle">et pour des niveaux</text>
          <text x="418" y="320" textAnchor="middle" className="lg-etiq">déposé sans filière : tronc commun</text>
          <text x="418" y="336" textAnchor="middle" className="lg-etiq">déposé sans niveau : tous niveaux</text>

          {/* Ce que l'agent reçoit */}
          <rect x="355" y="390" width="250" height="62" rx="8" className="lg-boite" />
          <text x="371" y="416" className="lg-titre">{"Programme de l'agent"}</text>
          <text x="371" y="436" className="lg-sous">tronc commun et modules cochés</text>
          <rect x="355" y="500" width="250" height="62" rx="8" className="lg-boite" />
          <text x="371" y="526" className="lg-titre">{"Évaluation d'un module"}</text>
          <text x="371" y="546" className="lg-sous">questions validées, sous le plafond</text>

          <line x1="276" y1="421" x2="351" y2="421" className="lg-fleche" markerEnd={p} />
          <text x="314" y="413" textAnchor="middle" className="lg-etiq">ouvre</text>
          <path d="M712 322 V352 H540 V386" className="lg-fleche" markerEnd={p} />
          <text x="626" y="345" textAnchor="middle" className="lg-etiq">{"s'il est publié et coché"}</text>
          <line x1="480" y1="452" x2="480" y2="496" className="lg-fleche" markerEnd={p} />
          <text x="490" y="479" className="lg-etiq">un module à la fois</text>
          <path d="M736 452 V531 H609" className="lg-fleche" markerEnd={p} />
          <text x="672" y="523" textAnchor="middle" className="lg-etiq">si validée</text>
          <path d="M149 452 V531 H351" className="lg-fleche" markerEnd={p} />
          <text x="252" y="523" textAnchor="middle" className="lg-etiq">plafond de son niveau</text>
        </svg>
        <svg
          className="lg-etroit"
          viewBox="0 0 360 1072"
          role="img"
          aria-label="De haut en bas. Profil de l'agent : le métier range les filières, une filière porte des niveaux, le code d'accès choisit une filière et un de ses niveaux. Ce que l'agent reçoit : le code ouvre son programme ; l'évaluation d'un module, un module à la fois, tire des questions validées sous le plafond de son niveau. Contenu de formation : le bloc contient les critères, chaque critère est couvert par un module, chaque question appartient à un module ou y est aussi posée. Le seul lien entre le contenu et le profil : le module est coché pour des filières et des niveaux ; publié et coché, il entre au programme."
        >
          <Pointes prefixe="rq1e" />

          {/* Profil */}
          <text x="12" y="16" className="lg-col">{"PROFIL DE L'AGENT"}</text>
          <rect x="12" y="26" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="51" className="lg-titre">Métier</text>
          <text x="26" y="71" className="lg-sous">préparateur, pharmacien, aide…</text>
          <line x1="44" y1="86" x2="44" y2="124" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="110" className="lg-etiq">range</text>
          <rect x="12" y="128" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="153" className="lg-titre">Filière (profil de poste)</text>
          <text x="26" y="173" className="lg-sous">{`${filieres.length} de la fiche, puis ajoutées`}</text>
          <line x1="44" y1="188" x2="44" y2="226" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="212" className="lg-etiq">porte</text>
          <rect x="12" y="230" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="255" className="lg-titre">Niveau</text>
          <text x="26" y="275" className="lg-sous">{`${premierNiveau} … ${dernierNiveau}, puis ajoutés`}</text>
          <line x1="44" y1="290" x2="44" y2="328" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="314" className="lg-etiq">choisi au code</text>
          <rect x="12" y="332" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="357" className="lg-titre">{"Code d'accès de l'agent"}</text>
          <text x="26" y="377" className="lg-sous">une filière et un de ses niveaux</text>

          {/* Ce que l'agent reçoit */}
          <line x1="44" y1="392" x2="44" y2="446" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="413" className="lg-etiq">ouvre</text>
          <text x="60" y="438" className="lg-col">{"CE QUE L'AGENT REÇOIT"}</text>
          <rect x="12" y="450" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="475" className="lg-titre">{"Programme de l'agent"}</text>
          <text x="26" y="495" className="lg-sous">tronc commun et modules cochés</text>
          <line x1="44" y1="510" x2="44" y2="548" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="534" className="lg-etiq">un module à la fois</text>
          <rect x="12" y="552" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="577" className="lg-titre">{"Évaluation d'un module"}</text>
          <text x="26" y="597" className="lg-sous">questions validées, sous le plafond</text>

          {/* Contenu */}
          <text x="12" y="648" className="lg-col">CONTENU DE FORMATION</text>
          <rect x="12" y="658" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="683" className="lg-titre">Bloc</text>
          <text x="26" y="703" className="lg-sous">{`1 à ${blocsCompetence.length} de la fiche, puis ajoutés`}</text>
          <line x1="44" y1="718" x2="44" y2="756" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="742" className="lg-etiq">contient</text>
          <rect x="12" y="760" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="785" className="lg-titre">Critère de la fiche</text>
          <text x="26" y="805" className="lg-sous">{`${criteres.length}, de ${premierCritere} à ${dernierCritere}, figés`}</text>
          <line x1="44" y1="820" x2="44" y2="858" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="844" className="lg-etiq">couvert par</text>
          <rect x="12" y="862" width="292" height="96" rx="8" className="lg-boite-cle" />
          <text x="26" y="887" className="lg-titre">Module</text>
          <text x="26" y="907" className="lg-sous">du code (un par critère) ou déposé</text>
          <text x="26" y="928" className="lg-etiq">déposé sans filière : tronc commun</text>
          <text x="26" y="945" className="lg-etiq">déposé sans niveau : tous niveaux</text>
          <line x1="44" y1="1000" x2="44" y2="962" className="lg-fleche" markerEnd={pe} />
          <text x="54" y="976" className="lg-etiq">appartient à,</text>
          <text x="54" y="991" className="lg-etiq">et « aussi posée dans »</text>
          <rect x="12" y="1000" width="292" height="60" rx="8" className="lg-boite" />
          <text x="26" y="1025" className="lg-titre">Question</text>
          <text x="26" y="1045" className="lg-sous">un des trois niveaux des questions</text>

          {/* Publié et coché, le module entre au programme. */}
          <path d="M304 880 H322 V496 H308" className="lg-fleche" markerEnd={pe} />
          <text x="316" y="534" textAnchor="end" className="lg-etiq">si publié et coché</text>
          {/* Le seul lien entre le contenu et le profil */}
          <path d="M304 900 H340 V142 H308" className="lg-cle" markerEnd={pce} />
          <path d="M340 244 H308" className="lg-cle" markerEnd={pce} />
          <text x="334" y="120" textAnchor="end" className="lg-etiq-cle">coché pour des filières</text>
          <text x="334" y="222" textAnchor="end" className="lg-etiq-cle">et pour des niveaux</text>
        </svg>
      </div>
      <figcaption className="legende">
        Le profil de l&apos;agent et le contenu ne se touchent que par un lien, en couleur : le module coché pour
        des filières et des niveaux. Un module déposé sans filière cochée va au tronc commun ; sans niveau coché, il
        est proposé à tous les niveaux de ses filières. Un module du code sans case cochée garde les filières et les
        niveaux de sa fiche.
        Une question peut en plus être « aussi posée dans » d&apos;autres modules, et porter des étiquettes de
        profil qui la réservent à certaines filières ou certains niveaux à l&apos;intérieur de son module. Le bloc
        et le critère rangent le contenu et donnent l&apos;en-tête du rapport ; ils ne décident pas de qui voit
        quoi.
      </figcaption>
    </figure>
  );
}

function SchemaTroisRangements({ libelleB101 }: { libelleB101?: string }) {
  const p = "url(#rq2-p)";
  const pc = "url(#rq2-pc)";
  const pe = "url(#rq2e-p)";
  const pce = "url(#rq2e-pc)";
  return (
    <figure className="logigramme" id="trois-rangements">
      <div className="logigramme-cadre">
        <svg
          className="lg-large"
          viewBox="0 0 960 300"
          role="img"
          aria-label="Une question du module 3 du classeur, sur le port des gants en ZAC, et ses trois destinations possibles. a : le module déposé Module 3, coché pour le pool en N2R. b : le module du critère B1-01, habillage en ZAC, vu par tous les profils qui ont ce critère. c : le module déposé Module 3, et aussi posée dans B1-01."
        >
          <Pointes prefixe="rq2" />

          <rect x="24" y="112" width="210" height="76" rx="8" className="lg-boite" />
          <text x="40" y="140" className="lg-titre">Question du module 3</text>
          <text x="40" y="160" className="lg-sous">port des gants en ZAC</text>
          <text x="40" y="176" className="lg-sous">banque du pool</text>

          <line x1="236" y1="140" x2="326" y2="52" className="lg-cle" markerEnd={pc} />
          <line x1="236" y1="150" x2="326" y2="150" className="lg-fleche" markerEnd={p} />
          <line x1="236" y1="160" x2="326" y2="248" className="lg-fleche" markerEnd={p} />

          <rect x="330" y="24" width="250" height="56" rx="8" className="lg-boite-cle" />
          <text x="346" y="47" className="lg-titre">a) Module 3 — Règles…</text>
          <text x="346" y="66" className="lg-sous">déposé, bloc Pool, N2R coché</text>
          <text x="610" y="47" className="lg-etiq">vu par : le profil du pool en N2R</text>
          <text x="610" y="66" className="lg-etiq">rapport : titre du module</text>

          <rect x="330" y="122" width="250" height="56" rx="8" className="lg-boite" />
          <text x="346" y="145" className="lg-titre">b) B1-01 · habillage en ZAC</text>
          <text x="346" y="164" className="lg-sous">module du critère ; N2R à cocher</text>
          <text x="610" y="145" className="lg-etiq">vu par : tous les profils qui ont B1-01</text>
          <text x="610" y="164" className="lg-etiq">rapport : « Critère B1-01 »</text>

          <rect x="330" y="220" width="250" height="56" rx="8" className="lg-boite" />
          <text x="346" y="243" className="lg-titre">c) Module 3 — Règles…</text>
          <text x="346" y="262" className="lg-sous">déposé, bloc Pool, N2R coché</text>
          <line x1="582" y1="248" x2="684" y2="248" className="lg-fleche lg-pointille" markerEnd={p} />
          <text x="633" y="240" textAnchor="middle" className="lg-etiq">aussi posée dans</text>
          <rect x="688" y="220" width="248" height="56" rx="8" className="lg-boite" />
          <text x="704" y="243" className="lg-titre">B1-01 · habillage en ZAC</text>
          <text x="704" y="262" className="lg-sous">vue aussi par les profils de B1-01</text>
        </svg>
        <svg
          className="lg-etroit"
          viewBox="0 0 360 486"
          role="img"
          aria-label="Une question du module 3 du classeur, sur le port des gants en ZAC, et ses trois destinations possibles. a : le module déposé Module 3, coché pour le pool en N2R ; vu par le profil du pool en N2R. b : le module du critère B1-01, habillage en ZAC ; vu par tous les profils qui ont ce critère. c : le module déposé Module 3, et aussi posée dans B1-01."
        >
          <Pointes prefixe="rq2e" />

          <rect x="16" y="12" width="328" height="62" rx="8" className="lg-boite" />
          <text x="32" y="38" className="lg-titre">Question du module 3</text>
          <text x="32" y="58" className="lg-sous">port des gants en ZAC · banque du pool</text>

          <line x1="36" y1="74" x2="36" y2="360" className="lg-fleche" />

          <line x1="36" y1="124" x2="60" y2="124" className="lg-cle" markerEnd={pce} />
          <rect x="64" y="96" width="280" height="56" rx="8" className="lg-boite-cle" />
          <text x="80" y="119" className="lg-titre">a) Module 3 — Règles…</text>
          <text x="80" y="138" className="lg-sous">déposé, bloc Pool, N2R coché</text>
          <text x="64" y="172" className="lg-etiq">vu par : le profil du pool en N2R</text>
          <text x="64" y="188" className="lg-etiq">rapport : titre du module</text>

          <line x1="36" y1="240" x2="60" y2="240" className="lg-fleche" markerEnd={pe} />
          <rect x="64" y="212" width="280" height="56" rx="8" className="lg-boite" />
          <text x="80" y="235" className="lg-titre">b) B1-01 · habillage en ZAC</text>
          <text x="80" y="254" className="lg-sous">module du critère ; N2R à cocher</text>
          <text x="64" y="288" className="lg-etiq">vu par : tous les profils qui ont B1-01</text>
          <text x="64" y="304" className="lg-etiq">rapport : « Critère B1-01 »</text>

          <line x1="36" y1="358" x2="60" y2="358" className="lg-fleche" markerEnd={pe} />
          <rect x="64" y="330" width="280" height="56" rx="8" className="lg-boite" />
          <text x="80" y="353" className="lg-titre">c) Module 3 — Règles…</text>
          <text x="80" y="372" className="lg-sous">déposé, bloc Pool, N2R coché</text>
          <line x1="204" y1="386" x2="204" y2="414" className="lg-fleche lg-pointille" markerEnd={pe} />
          <text x="214" y="405" className="lg-etiq">aussi posée dans</text>
          <rect x="64" y="418" width="280" height="56" rx="8" className="lg-boite" />
          <text x="80" y="441" className="lg-titre">B1-01 · habillage en ZAC</text>
          <text x="80" y="460" className="lg-sous">vue aussi par les profils de B1-01</text>
        </svg>
      </div>
      <figcaption className="legende">
        Le même dépôt, trois destinations. En a, la question reste dans le module du classeur ; en b, elle rejoint
        le module du critère de la fiche ; en c, elle est dans les deux, par « Aussi posée dans », sur la question,
        dans la banque.{libelleB101 ? ` B1-01 : « ${libelleB101} ».` : ""}
      </figcaption>
    </figure>
  );
}
