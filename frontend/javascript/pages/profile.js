import { initProfileUI, requestProfileNavigationClose } from "../components/profile-ui.js";
import { initLanguagesPanel } from "../languages.js";
import { hydrateHeroIcons } from "../icons.js";
import { initUniversityTranslations } from "../university-translations.js";
import { ensureExamConfig, ensureLanguageConfig } from "../utils.js";

let profilePageGeneration = 0;
let disposeProfileUi = null;
let disposeLanguagesPanel = null;

export { requestProfileNavigationClose };

export function disposeProfilePage() {
  profilePageGeneration += 1;
  disposeProfileUi?.();
  disposeProfileUi = null;
  disposeLanguagesPanel?.();
  disposeLanguagesPanel = null;
}

export async function initProfilePage() {
  disposeProfilePage();
  const generation = profilePageGeneration;
  const page = document.getElementById("profilePage");
  if (!page) return;

  hydrateHeroIcons(page);

  await Promise.all([
    ensureExamConfig(),
    ensureLanguageConfig(),
    initUniversityTranslations().catch(() => null),
  ]);

  if (generation !== profilePageGeneration || !page.isConnected) return;
  disposeLanguagesPanel = initLanguagesPanel() || null;
  disposeProfileUi = initProfileUI() || null;
}
