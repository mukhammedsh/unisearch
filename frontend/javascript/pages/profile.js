import { initProfileUI } from "../components/profile-ui.js";
import { initLanguagesPanel } from "../languages.js";
import { hydrateHeroIcons } from "../icons.js";
import { initUniversityTranslations } from "../university-translations.js";
import { ensureExamConfig, ensureLanguageConfig } from "../utils.js";

export async function initProfilePage() {
  const page = document.getElementById("profilePage");
  if (!page) return;

  hydrateHeroIcons(page);

  await Promise.all([
    ensureExamConfig(),
    ensureLanguageConfig(),
    initUniversityTranslations().catch(() => null),
  ]);

  initLanguagesPanel();
  initProfileUI();
}
