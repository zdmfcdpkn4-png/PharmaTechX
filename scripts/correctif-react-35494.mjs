/**
 * Correctif amont React #35494, reporté dans le React qu'embarque Next 15.5
 * (décision du 23/09/2026, choix a — `docs/DECISIONS.md`, « Erreur
 * d'hydratation #418 »).
 *
 * L'erreur #418, intermittente, vient de React et non du site. Quand un
 * élément dont les enfants sont dans un morceau de données RSC pas encore
 * arrivé suspend, React le rejoue (`replaySuspendedUnitOfWork`) sans
 * rembobiner le curseur d'hydratation : il compare alors l'élément à son
 * propre premier enfant, conclut à une divergence et reconstruit toute la
 * page dans le navigateur. Corrigé en amont par react/react#35494
 * (« [Fiber] Correctly handle replaying when hydrating », fusionné le
 * 13/01/2026) : huit lignes, reprises ici à l'identique de leur forme
 * compilée dans React 19.3 (celui de Next 16.3.6).
 *
 * Lancé par `postinstall`, donc par `npm install` et `npm ci` — y compris au
 * build de Render. Garde-fous : la version de React doit être exactement
 * celle attendue et la branche visée trouvée une seule fois dans chacun des
 * quatre fichiers client, sinon l'installation échoue en disant pourquoi.
 * Un fichier déjà corrigé est laissé tel quel.
 *
 * Le cache de webpack tient `node_modules` pour immuable tant que la version
 * du paquet ne change pas (`snapshot.managedPaths` de Next) : constaté le
 * 23/09/2026, un build sur cache chaud a rendu le React d'avant, à l'octet
 * près. D'où, quand le correctif vient d'être posé, l'effacement de
 * `.next/cache/webpack`, et après `next build` le contrôle du code servi
 * (`--build`) : le build échoue si le correctif n'y est pas.
 *
 * À retirer au passage à Next 16, dont le React contient le correctif :
 * supprimer ce fichier, les lignes `postinstall` et `build` qui l'appellent
 * dans `package.json`, et `test/correctif-react.test.ts`.
 */
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** React embarqué par Next 15.5.25 (et 15.5.26, la dernière 15.x). */
export const VERSION_REACT = "19.2.0-canary-0bdb9206-20250818";

/** Posée avec le correctif : un fichier qui la porte est déjà corrigé. */
export const MARQUE = "/* correctif react#35494 (docs/DECISIONS.md, 23/09/2026) */";

/** Dossier du React qu'emploie l'App Router (canal stable, pas « experimental »). */
export const DOSSIER = "node_modules/next/dist/compiled/react-dom/cjs";

/** Les quatre variantes client : les seules qui hydratent. */
export const FICHIERS = [
  "react-dom-client.production.js",
  "react-dom-client.development.js",
  "react-dom-profiling.profiling.js",
  "react-dom-profiling.development.js",
];

// Branche « élément hôte » du rejeu : `case 5:` puis `resetHooksOnUnwind(x);`,
// avant `default:`. La variable s'appelle `next` en production, `unitOfWork`
// en développement ; l'indentation diffère aussi. Le saut de ligne final
// n'est pas consommé : deux branches accolées compteraient pour une.
const ANCRE = /\n([ \t]*)case 5:\n([ \t]*)resetHooksOnUnwind\((\w+)\);\n([ \t]*)default:(?=\n)/g;

/**
 * Corrige la source d'un fichier client de React.
 * @param {string} source
 * @returns {{ source: string, statut: "applique" | "deja" }}
 */
export function corriger(source) {
  if (!source.includes(`"${VERSION_REACT}"`)) {
    throw new Error(`ce n'est pas React ${VERSION_REACT}`);
  }
  if (source.includes(MARQUE)) return { source, statut: "deja" };

  const debut = source.indexOf("function replaySuspendedUnitOfWork(");
  const fin = source.indexOf("function throwAndUnwindWorkLoop(", debut);
  if (debut < 0 || fin < 0 || source.indexOf("function replaySuspendedUnitOfWork(", debut + 1) >= 0) {
    throw new Error("fonction replaySuspendedUnitOfWork introuvable ou en double");
  }
  // Les huit lignes emploient l'état d'hydratation du module : il doit exister.
  for (const nom of ["function popToNextHostParent(", "hydrationParentFiber", "nextHydratableInstance", "isHydrating"]) {
    if (!source.includes(nom)) throw new Error(`« ${nom} » introuvable`);
  }

  const corps = source.slice(debut, fin);
  const trouves = [...corps.matchAll(ANCRE)];
  if (trouves.length !== 1) {
    throw new Error(`branche « case 5 » du rejeu trouvée ${trouves.length} fois, 1 attendue`);
  }
  const [bloc, retraitCase, retrait, variable, retraitDefault] = trouves[0];
  const ajout = [
    MARQUE,
    `var fiber = ${variable};`,
    "fiber === hydrationParentFiber &&",
    "  (isHydrating",
    "    ? (popToNextHostParent(fiber),",
    "      5 === fiber.tag &&",
    "        null != fiber.stateNode &&",
    "        (nextHydratableInstance = fiber.stateNode))",
    "    : (popToNextHostParent(fiber), (isHydrating = !0)));",
  ].map((ligne) => retrait + ligne);
  const remplacement = [
    "",
    `${retraitCase}case 5:`,
    `${retrait}resetHooksOnUnwind(${variable});`,
    ...ajout,
    `${retraitDefault}default:`,
  ].join("\n");
  return {
    // Fonction de remplacement : un « $ » du texte ne serait pas interprété.
    source: source.slice(0, debut) + corps.replace(bloc, () => remplacement) + source.slice(fin),
    statut: "applique",
  };
}

// Fonction de rejeu minifiée par `next build` : la branche « case 11 » se
// termine par `….type.render,x.ref,…);break;`, puis vient `case 5:f(x);`.
// Ce qui suit jusqu'à `default:` est vide sans correctif, et fait environ
// 110 caractères avec : la recherche s'arrête à 400.
const REJEU_MINIFIE = /\.type\.render,([\w$]+)\.ref,[\w$]+\);break;case 5:[\w$]+\(\1\);([^]{0,400}?)default:/g;

/** Les huit lignes une fois minifiées : l'élément rejoué redevient le curseur. */
export const SIGNATURE_MINIFIEE = /5===([\w$]+)\.tag&&null!=\1\.stateNode&&\([\w$]+=\1\.stateNode\)/;

/**
 * Contrôle d'un fichier JavaScript servi au navigateur.
 * @param {string} code
 * @returns {("corrige" | "non-corrige")[]} un état par fonction de rejeu trouvée
 */
export function controlerCode(code) {
  return [...code.matchAll(REJEU_MINIFIE)].map(([, , insere]) =>
    insere !== "" && SIGNATURE_MINIFIEE.test(insere) ? "corrige" : "non-corrige",
  );
}

/** Après `next build` : le React servi au navigateur porte-t-il le correctif ? */
function controlerBuild(racine) {
  const dossier = join(racine, ".next/static/chunks");
  const corriges = [];
  for (const f of readdirSync(dossier, { recursive: true }).map(String).filter((f) => f.endsWith(".js"))) {
    const etats = controlerCode(readFileSync(join(dossier, f), "utf8"));
    if (etats.includes("non-corrige")) {
      throw new Error(
        `.next/static/chunks/${f} : React servi sans le correctif. Cache de build périmé ? Effacer ` +
          ".next/cache (sur Render : effacer le cache de build, voir docs/DEPLOIEMENT.md) et reconstruire.",
      );
    }
    if (etats.length > 0) corriges.push(f);
  }
  if (corriges.length === 0) {
    throw new Error("fonction de rejeu de React introuvable dans le code servi : forme minifiée inattendue");
  }
  console.log(`correctif React #35494 présent dans le code servi : ${corriges.join(", ")}`);
}

/** À l'installation : corrige les quatre fichiers client. */
function installer(racine) {
  const appliques = [];
  for (const nom of FICHIERS) {
    const chemin = join(racine, DOSSIER, nom);
    let resultat;
    try {
      resultat = corriger(readFileSync(chemin, "utf8"));
    } catch (e) {
      throw new Error(`${DOSSIER}/${nom} : ${e instanceof Error ? e.message : e}`);
    }
    if (resultat.statut === "applique") {
      writeFileSync(chemin, resultat.source);
      appliques.push(nom);
    }
  }
  if (appliques.length === 0) {
    console.log("correctif React #35494 : déjà en place");
    return;
  }
  // Sans cela, un build sur cache chaud reprendrait le React d'avant.
  rmSync(join(racine, ".next/cache/webpack"), { recursive: true, force: true });
  console.log(`correctif React #35494 appliqué : ${appliques.join(", ")} ; cache webpack effacé`);
}

// Chemins réels des deux côtés : le chargeur résout les liens symboliques
// pour `import.meta.url`, pas pour la ligne de commande — sans cela, un dépôt
// sous un lien symbolique verrait le script ne rien faire, en silence.
const lanceDirectement =
  process.argv[1] !== undefined &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (lanceDirectement) {
  const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
  const message = (e) => (e instanceof Error ? e.message : String(e));
  if (process.argv.includes("--build")) {
    try {
      controlerBuild(racine);
    } catch (e) {
      console.error(`\nBuild refusé, correctif React #35494 — ${message(e)}\n`);
      process.exit(1);
    }
  } else {
    try {
      installer(racine);
    } catch (e) {
      console.error(`\ncorrectif React #35494 NON appliqué — ${message(e)}`);
      console.error(
        "Le React embarqué par Next a changé. Si Next est passé en 16, le correctif y est déjà : retirer\n" +
          "scripts/correctif-react-35494.mjs, ses appels dans package.json (postinstall, build) et\n" +
          "test/correctif-react.test.ts. Sinon, vérifier que les huit lignes s'appliquent toujours avant de\n" +
          "changer VERSION_REACT (docs/DECISIONS.md, « Erreur d'hydratation #418 »).\n",
      );
      process.exit(1);
    }
  }
}
