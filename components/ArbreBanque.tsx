import Link from "next/link";
import { Badge } from "./Badge";
import type { Filiere, Niveau } from "@/content/habilitation";

/**
 * Arborescence de la banque de questions : filière → niveau → module.
 *
 * Demandée le 19/09/2026 pour rendre la banque lisible d'un coup d'œil. Elle
 * ne remplace pas la liste : elle la précède et sert à s'y rendre. Sa valeur
 * est autant dans ce qu'elle montre que dans ce qu'elle laisse voir en creux —
 * un module sans question validée saute aux yeux.
 *
 * Un module rattaché à deux niveaux figure sous chacun : c'est fidèle au
 * rattachement, ce n'est pas un doublon. Un module sans filière est au tronc
 * commun, un module sans niveau vaut pour tous les niveaux de sa filière.
 *
 * Rien de dynamique : des `<details>`, donc pas une ligne de script, et le
 * repli fonctionne sans JavaScript comme le reste du site.
 */

export interface ModuleArbre {
  id: string;
  titre: string;
  etiquette: string;
  postes: string[];
  niveaux: string[];
}

export interface CompteQuestions {
  valides: number;
  aVerifier: number;
  reservees: number;
}

type Comptes = Record<string, CompteQuestions>;

const VIDE: CompteQuestions = { valides: 0, aVerifier: 0, reservees: 0 };

function cumuler(modules: ModuleArbre[], comptes: Comptes): CompteQuestions {
  return modules.reduce(
    (t, m) => {
      const c = comptes[m.id] ?? VIDE;
      return {
        valides: t.valides + c.valides,
        aVerifier: t.aVerifier + c.aVerifier,
        reservees: t.reservees + c.reservees,
      };
    },
    { ...VIDE },
  );
}

/** Deux nombres et une jauge : la part validée, la part à vérifier. */
function Compte({ c, modules }: { c: CompteQuestions; modules?: number }) {
  const total = c.valides + c.aVerifier;
  const pc = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return (
    <span className="arbre-compte">
      {modules !== undefined && (
        <span className="legende">
          {modules} module{modules > 1 ? "s" : ""}
        </span>
      )}
      <span className="jauge" aria-hidden="true">
        {total > 0 && (
          <>
            <span className="jauge-part jauge-part--ok" style={{ width: `${pc(c.valides)}%` }} />
            <span className="jauge-part jauge-part--attente" style={{ width: `${pc(c.aVerifier)}%` }} />
          </>
        )}
      </span>
      <span className="legende">
        {total === 0 ? (
          <em>aucune question</em>
        ) : (
          <>
            <strong>{c.valides}</strong> validée{c.valides > 1 ? "s" : ""}
            {c.aVerifier > 0 ? ` · ${c.aVerifier} à vérifier` : ""}
            {c.reservees > 0 ? ` · ${c.reservees} réservée${c.reservees > 1 ? "s" : ""}` : ""}
          </>
        )}
      </span>
    </span>
  );
}

function LigneModule({
  m,
  comptes,
  actif,
}: {
  m: ModuleArbre;
  comptes: Comptes;
  actif?: string;
}) {
  const c = comptes[m.id] ?? VIDE;
  const vide = c.valides + c.aVerifier === 0;
  return (
    <li className={`arbre-module${vide ? " arbre-module--vide" : ""}${actif === m.id ? " arbre-module--actif" : ""}`}>
      <Link href={`/admin/questions?module=${encodeURIComponent(m.id)}`}>
        <span className="etiquette etiquette--site">{m.etiquette}</span>
        <span className="arbre-titre">{m.titre}</span>
      </Link>
      <Compte c={c} />
    </li>
  );
}

function Groupe({
  cle,
  titre,
  badge,
  modules,
  niveaux,
  comptes,
  actif,
}: {
  cle: string;
  titre: string;
  badge?: string;
  modules: ModuleArbre[];
  niveaux: Niveau[];
  comptes: Comptes;
  actif?: string;
}) {
  if (modules.length === 0) return null;
  const total = cumuler(modules, comptes);
  // Un module sans niveau vaut pour tous : il est listé à part, en tête.
  const sansNiveau = modules.filter((m) => m.niveaux.length === 0);
  const parNiveau = niveaux
    .map((n) => ({ n, liste: modules.filter((m) => m.niveaux.includes(String(n.code))) }))
    .filter((x) => x.liste.length > 0);
  // Un niveau cité par un module mais absent du référentiel reste visible.
  const connus = new Set(niveaux.map((n) => String(n.code)));
  const orphelins = [...new Set(modules.flatMap((m) => m.niveaux).filter((c) => !connus.has(c)))];

  return (
    <details className="arbre-groupe" open>
      <summary>
        <Badge nom={badge} />
        <span className="arbre-titre">{titre}</span>
        <Compte c={total} modules={modules.length} />
      </summary>
      {sansNiveau.length > 0 && (
        <div className="arbre-niveau">
          <p className="arbre-niveau-titre">
            Tous niveaux <Compte c={cumuler(sansNiveau, comptes)} />
          </p>
          <ul className="liste-nue">
            {sansNiveau.map((m) => (
              <LigneModule key={`${cle}-${m.id}`} m={m} comptes={comptes} actif={actif} />
            ))}
          </ul>
        </div>
      )}
      {parNiveau.map(({ n, liste }) => (
        <div key={String(n.code)} className="arbre-niveau">
          <p className="arbre-niveau-titre">
            <span className="etiquette etiquette--neutre">{String(n.code)}</span> {n.libelle}
            <Compte c={cumuler(liste, comptes)} />
          </p>
          <ul className="liste-nue">
            {liste.map((m) => (
              <LigneModule key={`${cle}-${n.code}-${m.id}`} m={m} comptes={comptes} actif={actif} />
            ))}
          </ul>
        </div>
      ))}
      {orphelins.map((code) => {
        const liste = modules.filter((m) => m.niveaux.includes(code));
        return (
          <div key={code} className="arbre-niveau">
            <p className="arbre-niveau-titre">
              <span className="etiquette etiquette--attention">{code}</span> niveau absent du référentiel
              <Compte c={cumuler(liste, comptes)} />
            </p>
            <ul className="liste-nue">
              {liste.map((m) => (
                <LigneModule key={`${cle}-${code}-${m.id}`} m={m} comptes={comptes} actif={actif} />
              ))}
            </ul>
          </div>
        );
      })}
    </details>
  );
}

export function ArbreBanque({
  filieres,
  niveaux,
  modules,
  comptes,
  moduleActif,
}: {
  filieres: Filiere[];
  niveaux: Niveau[];
  modules: ModuleArbre[];
  comptes: Comptes;
  moduleActif?: string;
}) {
  const troncCommun = modules.filter((m) => m.postes.length === 0);
  const rattaches = new Set<string>();
  const groupes = filieres
    .filter((f) => f.id !== "socle")
    .map((f) => {
      const liste = modules.filter((m) => m.postes.includes(f.id));
      liste.forEach((m) => rattaches.add(m.id));
      return { f, liste };
    })
    .filter((g) => g.liste.length > 0);
  // Une filière citée par un module mais retirée du référentiel : visible aussi.
  const connues = new Set(filieres.map((f) => f.id));
  const inconnues = [...new Set(modules.flatMap((m) => m.postes).filter((id) => !connues.has(id)))];

  const total = cumuler(modules, comptes);

  return (
    <section className="section arbre">
      <div className="section-titre">
        <h2 style={{ fontSize: "1.15rem" }}>Couverture de la banque</h2>
        <span className="compte">
          <Compte c={total} modules={modules.length} />
        </span>
      </div>
      <p className="legende">
        Filière, puis niveau, puis module. Un module rattaché à deux niveaux figure sous chacun.
        Les modules sans question apparaissent en grisé : ce sont les trous de la banque.
      </p>
      <Groupe
        cle="tronc"
        titre="Tronc commun — tous postes"
        modules={troncCommun}
        niveaux={niveaux}
        comptes={comptes}
        actif={moduleActif}
      />
      {groupes.map(({ f, liste }) => (
        <Groupe
          key={f.id}
          cle={f.id}
          titre={f.libelle}
          badge={f.badge}
          modules={liste}
          niveaux={niveaux.filter((n) => n.filiere === f.id)}
          comptes={comptes}
          actif={moduleActif}
        />
      ))}
      {inconnues.map((id) => (
        <Groupe
          key={id}
          cle={id}
          titre={`${id} — filière absente du référentiel`}
          modules={modules.filter((m) => m.postes.includes(id))}
          niveaux={niveaux}
          comptes={comptes}
          actif={moduleActif}
        />
      ))}
    </section>
  );
}
