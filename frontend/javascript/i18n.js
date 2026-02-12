const I18N_STORAGE_KEY = "unisearch_ui_language_v1";

const LANG_ENG = "eng";
const LANG_RUS = "rus";
const LANG_KZ = "kz";
const SUPPORTED_LANGS = new Set([LANG_ENG, LANG_RUS, LANG_KZ]);
const LANG_FILE_BY_CODE = {
  [LANG_ENG]: "Localization/eng",
  [LANG_RUS]: "Localization/ru",
  [LANG_KZ]: "Localization/kz",
};

const HTML_LANG_MAP = {
  [LANG_ENG]: "en",
  [LANG_RUS]: "ru",
  [LANG_KZ]: "kk",
};

const DICT = {
  eng: {
    "title.index": "UniSearch - AI University Finder",
    "title.universities": "Universities | UniSearch",
    "title.university": "University | UniSearch",
    "title.ranking": "Global Rankings | UniSearch",
    "title.about": "About Us | UniSearch",
    "title.guide": "Guide | UniSearch",

    "nav.home": "Home",
    "nav.universities": "Universities",
    "nav.rankings": "Rankings",
    "nav.guide": "Guide",
    "nav.about": "About Us",
    "nav.profile": "Profile",
    "nav.open_menu": "Open menu",
    "nav.close_menu": "Close menu",
    "nav.switch_theme": "Switch theme",
    "nav.language": "Language",
    "nav.lang.eng": "English (US)",
    "nav.lang.rus": "Русский",
    "nav.lang.kz": "Қазақша",

    "home.hero.title": "Find your dream university with AI Power",
    "home.hero.title_html": "Find your dream university with <span class=\"text-gradient\"><span class=\"ai-gold\">AI Power</span></span>",
    "home.hero.desc":
      "UniSearch is a student-friendly platform for finding universities by comparing requirements, costs, and opportunities in one clear place.",
    "home.hero.start": "Start Matching",
    "home.hero.rankings": "View Rankings",
    "home.stats.top_universities": "Top Universities",
    "home.stats.countries": "Countries",
    "home.stats.open_source": "Open Source",
    "home.stats.ranking_chance": "Ranking + Chance",
    "home.why": "Why use UniSearch?",
    "home.feature.ai_title": "{fit} + {chance} AI",
    "home.feature.ai_desc":
      "{fit} ranks options by fit, while {chance} estimates your admission probability for each university track.",
    "home.feature.finance_title": "Financial Clarity",
    "home.feature.finance_desc":
      "See the real cost. Our system highlights Merit-based and Need-based aid opportunities, flagging universities that fit your wallet.",
    "home.feature.data_title": "Data-Driven Decisions",
    "home.feature.data_desc":
      "Built for the Infomatrix competition, we use structured JSON data and algorithms to eliminate bias in university selection.",
    "home.mockup.location": "Cambridge, USA",
    "home.mockup.grant_available": "✅ Grant Available",

    "universities.filter": "Filter",
    "universities.reset": "Reset",
    "universities.country": "Country",
    "universities.global": "Global",
    "universities.state_region": "State / Region",
    "universities.city": "City",
    "universities.all_cities": "All Cities",
    "universities.any_state": "Any State",
    "universities.select_country_first": "Select country first",
    "universities.cost_per_year": "Cost per year (USD)",
    "universities.sort_strategy": "Sort Strategy",
    "universities.sort_ai": "✨ {fit}: AI Smart Sort",
    "universities.sort_name_asc": "Name A-Z",
    "universities.sort_cost_asc": "Cost low to high",
    "universities.sort_cost_desc": "Cost high to low",
    "universities.search_placeholder": "Search university...",
    "universities.found_prefix": "Found",
    "universities.found_suffix": "universities",
    "universities.view_list": "List View",
    "universities.view_map": "Map View",
    "universities.loading": "Loading universities",
    "universities.tradeoff.focus": "Focus",
    "universities.tradeoff.focus.left": "Career & Practice",
    "universities.tradeoff.focus.right": "Science & Research",
    "universities.tradeoff.atmosphere": "Atmosphere",
    "universities.tradeoff.atmosphere.left": "Social & Events",
    "universities.tradeoff.atmosphere.right": "Hardcore Study",
    "universities.tradeoff.finance": "Finance",
    "universities.tradeoff.finance.left": "Budget & Grants",
    "universities.tradeoff.finance.right": "Prestige & Comfort",
    "universities.tradeoff.location": "Location",
    "universities.tradeoff.location.left": "Big City Life",
    "universities.tradeoff.location.right": "Cozy Campus",
    "universities.tradeoff.balanced": "Balanced (50/50)",
    "universities.help.open": "Show explanation",
    "universities.help.country": "Filters universities by country. Works together with city and region selectors.",
    "universities.help.state_region": "Narrows results inside the selected country. Useful for large countries with many cities.",
    "universities.help.city": "Shows universities in a specific city after country/region is selected.",
    "universities.help.cost_per_year": "Sets min/max annual cost filter. The list includes only universities inside this range.",
    "universities.help.sort_strategy": "UniFit uses your profile and sliders. Other options sort alphabetically or by cost only.",
    "universities.help.tradeoff.focus": "Shifts between applied career-practice orientation and science-research orientation.",
    "universities.help.tradeoff.atmosphere": "Shifts between social campus life and academically intense study environment.",
    "universities.help.tradeoff.finance": "Controls admission mode: left prioritizes grant chance, right prioritizes general/paid admission chance.",
    "universities.help.tradeoff.location": "Shifts between preference for big-city lifestyle and cozy campus-style locations.",
    "universities.state.empty": "No universities found.",
    "universities.state.failed": "Failed to load data.",
    "universities.state.ml_unavailable": "Machine Learning unavailable. Using rule-based ranking only.",
    "universities.card.est_cost_year": "Est. Cost/Year",
    "universities.badge.requirements_met": "✅ Requirements Met",
    "universities.badge.below_requirements": "⚠️ Below Requirements",
    "universities.badge.aid_likely": "🎓 Grant/Aid Likely (no budget penalty)",
    "universities.badge.over_budget_aid": "💸 Over Budget • Aid Available",
    "universities.badge.over_budget": "💰 Over Budget",
    "universities.badge.aid_available": "🎓 Aid Available",
    "universities.badge.acceptance": "Acceptance: {value}%",
    "universities.badge.conditional_exam_needed": "📝 Conditional / Exam Needed",
    "universities.badge.top_match": "⭐ Top Match",
    "universities.badge.your_vibe": "🔥 Your Vibe",
    "universities.badge.likely_grant": "🎓 Likely Grant",
    "universities.badge.paid_admission": "💼 Paid Admission",
    "universities.why.conditional_exam_needed": "Some required exam evidence is missing, so this result is conditional.",
    "universities.why.top_match": "This university is a strong preference match for your current slider setup.",
    "universities.why.your_vibe": "This university strongly matches your Focus, Atmosphere, and Location sliders.",
    "universities.why.likely_grant": "In grant-priority mode, this university has a strong grant admission chance.",
    "universities.why.paid_admission": "In willing-to-pay mode, this university has a strong general admission chance.",
    "universities.pagination.prev": "Prev",
    "universities.pagination.next": "Next",

    "university.loading": "Loading university details",
    "university.back_to_list": "Back to list",
    "university.tab.general": "General",
    "university.tab.programs": "Programs",
    "university.tab.admission": "Admission",
    "university.tab.costs": "Costs",
    "university.about_campus": "About & Campus",
    "university.overview": "Overview",
    "university.available_majors": "Available Majors",
    "university.entry_requirements": "Entry Requirements",
    "university.total_cost_calculator": "Total Cost Calculator",
    "university.discounts_scholarships": "Discounts & Scholarships",
    "university.loading_scholarships": "Loading scholarships",
    "university.total_estimated_cost": "Total Estimated Cost",
    "university.per_year": "per year",
    "university.price_from": "from {price} / year",
    "university.chat_assistant": "Chat Assistant",
    "university.mode_auto": "Mode: Auto",
    "university.model_label": "Model:",
    "university.model.auto": "Auto",
    "university.model.gemini": "Gemini",
    "university.model.fallback": "Fallback model",
    "university.model.local": "Local fallback",
    "university.ask_placeholder": "Ask about admission, scholarships, housing, deadlines...",
    "university.send": "Send",
    "university.clear": "Clear",
    "university.error_loading": "Error loading details.",
    "university.error_no_id": "Error: No ID provided.",
    "university.visit_website": "Visit Official Website",
    "university.show_on_map": "Show on map",

    "ranking.title": "Global University Rankings",
    "ranking.subtitle": "Top universities ranked by academic prestige and research impact (2025)",
    "ranking.loading": "Loading rankings",
    "ranking.acceptance": "Acceptance",
    "ranking.failed": "Failed to load rankings.",

    "about.eyebrow": "About Us",
    "about.title": "We are the abiturient team behind UniSearch.",
    "about.lead":
      "UniSearch is built by abiturients for abiturients. Our goal is to make university discovery clearer, easier, and more practical for real application planning.",
    "about.contact_kicker": "Contact Blocks",
    "about.contact_title": "Contact us",
    "about.contact.email": "Email",
    "about.contact.github": "GitHub",
    "about.email_note": "Main contact for project questions.",
    "about.github_note": "Code, commits, and project updates.",
    "about.team_kicker": "Our Team",
    "about.team_title": "Core contributors",
    "about.role.lead": "Lead Developer and Project Architect",
    "about.role.planning": "Planning and Documentation Assistant",
    "about.role.docs": "Documentation and Presentation Specialist",
    "about.bio.lead":
      "Responsible for all code and the implementation of all ideas. He is the team captain and makes decisions on the project.",
    "about.meta.lead": "15 years old, student in Zhanaozen Bilim-Innovation Lyceum.",
    "about.bio.planning":
      "Responsible for the text documentation, most of the ideas & improvements, and numerous tests of the site.",
    "about.meta.planning": "14 years old, student in Zhanaozen Bilim-Innovation Lyceum.",
    "about.bio.docs":
      "Assisted with testing and user interface, responsible for video documentation and presentation.",
    "about.meta.docs": "15 years old, student in Zhanaozen School-Gymnasium No. 5.",

    "guide.eyebrow": "UniSearch Guide",
    "guide.title": "How to use UniSearch and understand scores",
    "guide.intro":
      "This page explains key terms used in UniSearch: {fit} ranking logic, {chance} probability, admission tracks, score types, language proofs, and budget behavior.",
    "guide.nav.admission": "Admission",
    "guide.nav.exam_basics": "Exam Basics",
    "guide.nav.academic_exams": "Academic Exams",
    "guide.nav.language_exams": "Language Exams",
    "guide.nav.glossary": "Glossary",
    "guide.unifit.title": "{fit} (AI Smart Sort)",
    "guide.unifit.p1":
      "{fit} ranks universities by combining preference distance and admission probability. Focus/Atmosphere/Location sliders define PreferenceMismatch, while Finance switches admission mode (GrantChance vs GeneralChance). Final order uses FinalScore = 0.6 * PreferenceMismatch + 0.4 * AdmissionRisk (lower is better).",
    "guide.unifit.p2":
      'Missing exam evidence is treated as conditional, not automatic fail. University cards explain recommendation reasons with prioritized badges: first "Conditional / Exam Needed", then vibe match ("Your Vibe" / "Top Match"), then finance path ("Likely Grant" or "Paid Admission").',
    "guide.unifit.p3":
      "The model evaluates admission tracks separately when track data exists. That is why one university can look stronger than another for a specific student even if overall rank is lower.",
    "guide.unifit.p4":
      "Because your profile can change, {fit} results are intentionally dynamic. Updating exam scores, languages, or budget should immediately affect ordering.",
    "guide.ml.title": "ML in UniSearch (What it means)",
    "guide.ml.p1":
      "ML means Machine Learning. In UniSearch, ML is an additional personalization signal inside AI sorting, not a replacement for admission rules.",
    "guide.ml.p2":
      "You can write free-text preferences in Profile (interests). Backend always translates this text to US English via self-hosted LibreTranslate before ML scoring, then compares it against university metadata using TF-IDF and cosine similarity.",
    "guide.ml.p3":
      "Metadata text is built from university name, location, and program names, and is also enriched with description and tags.",
    "guide.ml.p4":
      "Before scoring, common short words and abbreviations are normalized (for example: ict, gamedev, ui/ux, genai) to improve matching quality.",
    "guide.ml.p5":
      "When interests are provided, ML is still calculated and returned in matchData.mlScore, but final ranking order is controlled by the weighted UniFit formula (PreferenceMismatch + AdmissionRisk). This keeps behavior deterministic while preserving personalization telemetry.",
    "guide.unichance.title": "{chance} (0-100 Admission Probability)",
    "guide.unichance.p1":
      "{chance} provides an estimate from 0 to 100 for each university and, when available, for each admission track. It is decision support, not a guarantee.",
    "guide.unichance.p2":
      "The estimate is calculated from profile and track data: minimum requirements, typical admitted scores, language rules, acceptance context, and affordability.",
    "guide.unichance.p3":
      "Suggested interpretation: 80-100 high chance, 60-79 good chance, 40-59 moderate chance, below 40 low chance.",
    "guide.unichance.p4":
      "The Best Track output highlights the strongest path inside one university and helps find alternatives with better fit.",
    "guide.admission.title": "Admission Track Terms",
    "guide.admission.p1":
      "An admission track is a specific pathway into a program. One university can publish multiple tracks with different requirements and costs.",
    "guide.admission.p2":
      "Requirements are minimum thresholds for eligibility. Real Average (Admitted) is often a better practical target where available.",
    "guide.admission.p3":
      "Language rules are explicit: in mode any, one listed proof is enough; in mode all, every listed requirement must be satisfied.",
    "guide.admission.p4":
      "Track-level scholarships and aid can change financial viability. Compare gross and effective cost when shortlisting.",
    "guide.exam_basics.title": "Exam Basics (Admissions)",
    "guide.exam_basics.p1":
      "Admissions usually evaluate academic preparation and language readiness as separate dimensions.",
    "guide.exam_basics.p2":
      "Domestic and international pathways can use different exam families (SAT, ACT, AP, IB, national exams, or institution-specific alternatives).",
    "guide.exam_basics.p3":
      "Language certificates are especially important for international applicants and can differ by track.",
    "guide.exam_basics.p4":
      "For strategy: confirm minimums, then target typical admitted levels, then distribute applications by risk level.",
    "guide.academic_exams.title": "Academic Exams",
    "guide.language_exams.title": "Language Exams",
    "guide.glossary.title": "Glossary",
    "guide.loading_language_config": "Loading language exam config",
    "guide.loading_exam_config": "Loading exam config",
    "guide.academic.intro":
      "The following academic exams are currently used by UniSearch for admission track matching and recommendation quality.",
    "guide.academic.default":
      "This is an academic metric used by one or more admission tracks in the UniSearch dataset.",
    "guide.academic.sat":
      "SAT is a standardized college admissions exam widely used for undergraduate applications, focused on evidence-based reading, writing, and mathematics.",
    "guide.academic.act":
      "ACT is a standardized admissions exam used by many universities, covering English, mathematics, reading, and science reasoning.",
    "guide.academic.gpa":
      "GPA represents cumulative school academic performance across courses and is often used as a baseline indicator of consistency.",
    "guide.academic.unt":
      "UNT (Unified National Testing) is the national exam used in Kazakhstan for many undergraduate admission pathways.",
    "guide.academic.nuettotal":
      "This is a combined entrance test score used in specific institutional admission routes.",
    "guide.academic.aptotal":
      "AP Total reflects combined performance across multiple Advanced Placement subjects.",
    "guide.academic.ibdiploma":
      "IB Diploma score is the overall International Baccalaureate Diploma result used in many global admissions systems.",
    "guide.language.default":
      "This language proficiency exam is used to verify readiness for study in the program language.",
    "guide.language.ielts":
      "IELTS evaluates English proficiency across listening, reading, writing, and speaking for academic contexts.",
    "guide.language.toefl":
      "TOEFL measures academic English proficiency and is commonly accepted for university admissions.",
    "guide.language.det":
      "Duolingo English Test is an online adaptive English proficiency exam accepted by many institutions.",
    "guide.language.pte":
      "PTE Academic is a computer-based English proficiency test used in international admissions.",
    "guide.language.cambridge":
      "Cambridge English qualifications assess practical English proficiency at standardized CEFR-aligned levels.",
    "guide.language.german":
      "TestDaF and DSH are German-language proficiency exams commonly required for German-taught study tracks.",
    "guide.language.french":
      "These exams assess French proficiency and are used for French-language academic eligibility.",
    "guide.language.dutch":
      "NT2 is a Dutch-as-a-second-language exam used to confirm readiness for Dutch-language study.",
    "guide.language.hsk":
      "HSK measures Chinese language proficiency for academic and formal language use.",
    "guide.language.jlpt":
      "JLPT measures Japanese language proficiency across standard difficulty levels.",
    "guide.language.topik":
      "TOPIK measures Korean language proficiency and is used for Korean-language academic readiness.",
    "guide.language.by_code":
      "This exam is used as language proof for {code}-language admission tracks.",
    "guide.scale_text":
      "In UniSearch, this score is entered on a {min}-{max} scale.",
    "guide.glossary.intro":
      "This glossary defines the exact terms used throughout UniSearch so users can interpret ranking and probability outputs consistently.",
    "guide.glossary.term.swr": "SWR Cache",
    "guide.glossary.term.admission_track": "Admission Track",
    "guide.glossary.term.requirements": "Requirements",
    "guide.glossary.term.stats_avg": "Stats Avg",
    "guide.glossary.term.language_requirements": "Language Requirements",
    "guide.glossary.term.mode_any": "Mode = any",
    "guide.glossary.term.mode_all": "Mode = all",
    "guide.glossary.term.match_score": "Match Score",
    "guide.glossary.fit":
      "AI ranking mode that balances prestige, affordability, and admission feasibility.",
    "guide.glossary.chance":
      "AI probability (0-100) of your admission, computed per track from your profile and requirements.",
    "guide.glossary.swr":
      "Stale-While-Revalidate: show cached data instantly, then refresh in background and update if changed.",
    "guide.glossary.admission_track":
      "A specific way to apply to a university (e.g., direct, exam-based, scholarship path).",
    "guide.glossary.requirements":
      "Minimum scores to be considered for a track.",
    "guide.glossary.stats_avg":
      "Typical scores of admitted students on that track.",
    "guide.glossary.language_requirements":
      "Accepted proof of language ability: native, CEFR, or language exam.",
    "guide.glossary.mode_any":
      "You need to satisfy at least one listed language option.",
    "guide.glossary.mode_all":
      "You must satisfy every listed language requirement.",
    "guide.glossary.match_score":
      "Internal {fit} ranking score; higher means a better fit for your profile.",
    "guide.muted.academic": "Plain-language explanations of the academic scores used in UniSearch admission matching.",
    "guide.muted.language": "Plain-language explanations of accepted language proofs across tracks.",
    "common.loading": "Loading",

    "tour.skip": "Skip",
    "tour.back": "Back",
    "tour.next": "Next",
    "tour.finish": "Finish",
    "tour.open_profile": "Open Profile",
    "tour.step1.kicker": "Welcome",
    "tour.step1.title": "Find universities faster",
    "tour.step1.desc":
      "This page helps you quickly shortlist universities by location, tuition, and fit for your profile.",
    "tour.step1.point1": "Use search + filters in the left panel.",
    "tour.step1.point2": "Switch between List and Map view on the top right.",
    "tour.step1.point3": "Use {fit} to sort by personalized fit.",
    "tour.step2.kicker": "Step 1",
    "tour.step2.title": "Fill your profile first",
    "tour.step2.desc":
      "Profile data makes recommendations and admission estimates more accurate.",
    "tour.step2.point1": "Add budget, major, and GPA.",
    "tour.step2.point2": "Add exam and language scores.",
    "tour.step2.point3": "This improves {fit} and {chance} quality.",
    "tour.step3.kicker": "Step 2",
    "tour.step3.title": "Use filtering strategically",
    "tour.step3.desc":
      "Start broad, then narrow by country, city, cost range, study level, and funding type.",
    "tour.step3.point1": "Adjust tuition min/max with the slider.",
    "tour.step3.point2": "Use grant/paid track filter for finance planning.",
    "tour.step3.point3": "Use map view to spot location clusters.",
    "tour.step4.kicker": "Step 3",
    "tour.step4.title": "Open details and compare tracks",
    "tour.step4.desc":
      "Click any card to inspect admissions, finance, and requirements per track.",
    "tour.step4.point1": "Review {chance} by track in the detail page.",
    "tour.step4.point2": "Check Admission and Costs tabs for requirement and funding details.",
    "tour.step4.point3": "Compare yearly cost and scholarships before applying.",

    "unifit.warning.title": "Limited Profile Data",
    "unifit.warning.desc":
      "UniFit works best when your profile includes exam scores or language evidence. Without them, the AI ranking may be less accurate.",
    "unifit.warning.confirm": "Okay I understand",
    "unifit.warning.cancel": "Cancel",

    "roi.tip": "Tip:",
    "roi.avg_hint_all_majors": "Showing computed average across all majors.",
    "roi.avg_hint_all_graduates": "Showing average for all graduates.",
    "roi.context.matched_major":
      "Calculation based on {major} graduates from this university.",
    "roi.context.missing_major":
      "Select your Major in Profile to see precise ROI for your field.",
    "roi.context.fallback_major": "Specific data for {major} not available.",
    "roi.context.default": "ROI is based on available university outcomes data.",
    "roi.what_is": "What is ROI?",
    "roi.explain":
      "It calculates how many times your first annual salary covers the cost of one year of education.",
    "roi.formula": "Formula: Avg. Graduate Salary / Annual Tuition Cost",
    "roi.estimated_salary": "Est. Graduate Salary",
    "roi.per_year_early": "per year (early career)",
    "roi.score": "ROI Score",
    "roi.title": "Estimated ROI (Return on Investment)",
    "roi.label.high_investment": "High Investment",

    "footer.copyright": "© 2026 UniSearch",

    "profile.label.budget": "Total Budget per year (USD)",
    "profile.placeholder.budget": "e.g. 20000",
    "profile.unit.usd_year": "USD / year",
    "profile.hint.budget_range": "Range: 1 - 1,000,000",
    "profile.label.study_mode": "Preferred Study Mode",
    "profile.option.study_mode_any": "Any (All formats)",
    "profile.option.study_mode_oncampus": "On-campus (Live)",
    "profile.option.study_mode_online": "Online / Distance",
    "profile.label.funding_type": "Preferred Funding Type",
    "profile.option.funding_any": "Any (Grant + Paid)",
    "profile.option.funding_grant": "Grant only",
    "profile.option.funding_paid": "Paid only",
    "profile.label.major": "Intended Major",
    "profile.option.major_any": "Undecided / Any",
    "profile.label.interests": "University Interests (AI)",
    "profile.placeholder.interests":
      "Describe your ideal university: programs, research, location, campus style, and goals.",
    "profile.hint.interests": "Used to personalize your recommendations.",
    "profile.label.gpa": "GPA (Percent)",
    "profile.placeholder.gpa": "e.g. 92",
    "profile.unit.gpa": "% (0 to 100)",
    "profile.hint.gpa": "GPA is stored as percent and used in admission matching.",
    "profile.label.exams": "Exams (list, optional)",
    "profile.option.select_exam": "Select Exam",
    "profile.placeholder.score": "Score",
    "profile.placeholder.lang_score": "Score (e.g. 7.5)",
    "profile.add": "Add",
    "profile.languages": "Languages",
    "profile.language": "Language",
    "profile.type": "Type",
    "profile.cefr": "CEFR",
    "profile.exam": "Exam",
    "profile.score": "Score",
    "profile.action.edit_name": "Edit Name",
    "profile.action.close": "Close",
    "profile.action.save_budget": "Save Budget",
    "profile.action.save_gpa": "Save GPA",

    "languages.select_type": "Select type",
    "languages.no_exams": "No exams",
    "languages.select_exam": "Select exam",
    "languages.saved": "Language saved",
    "languages.removed": "Removed",
    "languages.kind.native": "Native",
    "languages.kind.cefr": "CEFR",
    "languages.kind.exam": "Exam",
    "languages.error.choose_language_type": "Choose language and type",
    "languages.error.choose_cefr": "Choose CEFR level",
    "languages.error.choose_exam": "Choose exam",
    "languages.error.enter_score": "Enter score",
    "languages.error.score_range": "Score must be {min} - {max}",
    "languages.error.step_hint": "Step is {step} (e.g. {first}, {second}, ...)",
    "languages.error.integer_required": "{exam} requires an integer score",
    "languages.error.save_failed": "Failed to save language",

    "profile.preference_saved": "Preference saved",
    "profile.interests_saved": "Interests saved",
    "profile.name_invalid_length": "Name length must be 3-16 chars",
    "profile.name_invalid_symbols": "Invalid symbols in name",
    "profile.nickname_updated": "Nickname updated!",
    "profile.budget_cleared": "Budget cleared",
    "profile.budget_integers_only": "Integers only (no dots/commas)",
    "profile.budget_must_number": "Budget must be a number",
    "profile.budget_limit": "Limit: 1 - 1,000,000 USD",
    "profile.budget_saved": "Budget saved!",
    "profile.gpa_cleared": "GPA cleared",
    "profile.gpa_must_number": "GPA must be a number",
    "profile.gpa_range": "GPA must be between {min} and {max}%",
    "profile.gpa_step": "GPA must use step {step}",
    "profile.gpa_saved": "GPA saved",
    "profile.exam_select_required": "Please select an exam",
    "profile.exam_invalid_score": "Invalid score format",
    "profile.exam_integer_required": "{exam} score must be an integer (e.g. 1400)",
    "profile.exam_ielts_step": "IELTS score must end with .0 or .5",
    "profile.exam_updated": "Updated {exam} to {score}",
    "profile.exam_added": "Added {exam}",
    "profile.exam_removed": "Exam removed",
    "profile.exam_score_label": "Score: {score}",
    "profile.delete": "Delete",
  },
  rus: {
    "title.index": "UniSearch - AI подбор университета",
    "title.universities": "Университеты | UniSearch",
    "title.university": "Университет | UniSearch",
    "title.ranking": "Глобальные рейтинги | UniSearch",
    "title.about": "О нас | UniSearch",
    "title.guide": "Гайд | UniSearch",

    "nav.home": "Главная",
    "nav.universities": "Университеты",
    "nav.rankings": "Рейтинги",
    "nav.guide": "Гайд",
    "nav.about": "О нас",
    "nav.profile": "Профиль",
    "nav.open_menu": "Открыть меню",
    "nav.close_menu": "Закрыть меню",
    "nav.switch_theme": "Сменить тему",
    "nav.language": "Язык",
    "nav.lang.eng": "English (US)",
    "nav.lang.rus": "Русский",
    "nav.lang.kz": "Қазақша",

    "home.hero.title": "Найдите университет мечты с AI",
    "home.hero.title_html": "Найдите университет мечты с <span class=\"text-gradient\"><span class=\"ai-gold\">AI</span></span>",
    "home.hero.desc":
      "UniSearch — удобная платформа для поиска университетов: сравнивайте требования, стоимость и возможности в одном месте.",
    "home.hero.start": "Начать подбор",
    "home.hero.rankings": "Смотреть рейтинги",
    "home.stats.top_universities": "Топ университеты",
    "home.stats.countries": "Страны",
    "home.stats.open_source": "Открытый код",
    "home.stats.ranking_chance": "Рейтинг + Шанс",
    "home.why": "Почему UniSearch?",
    "home.feature.ai_title": "{fit} + {chance} AI",
    "home.feature.ai_desc":
      "{fit} ранжирует варианты по соответствию, а {chance} оценивает вероятность поступления по каждому треку.",
    "home.feature.finance_title": "Финансовая прозрачность",
    "home.feature.finance_desc":
      "Смотрите реальную стоимость. Система выделяет merit-based и need-based помощь и показывает университеты под ваш бюджет.",
    "home.feature.data_title": "Решения на данных",
    "home.feature.data_desc":
      "Проект для Infomatrix: используем структурированные JSON-данные и алгоритмы, чтобы снизить субъективность выбора.",

    "universities.filter": "Фильтр",
    "universities.reset": "Сброс",
    "universities.country": "Страна",
    "universities.global": "Глобально",
    "universities.state_region": "Штат / Регион",
    "universities.city": "Город",
    "universities.all_cities": "Все города",
    "universities.any_state": "Любой штат",
    "universities.select_country_first": "Сначала выберите страну",
    "universities.cost_per_year": "Стоимость в год (USD)",
    "universities.sort_strategy": "Стратегия сортировки",
    "universities.sort_ai": "✨ {fit}: AI умная сортировка",
    "universities.sort_name_asc": "Название А-Я",
    "universities.sort_cost_asc": "Цена по возрастанию",
    "universities.sort_cost_desc": "Цена по убыванию",
    "universities.search_placeholder": "Поиск университета...",
    "universities.found_prefix": "Найдено",
    "universities.found_suffix": "университетов",
    "universities.view_list": "Список",
    "universities.view_map": "Карта",
    "universities.loading": "Загрузка университетов",
    "universities.tradeoff.focus": "Фокус",
    "universities.tradeoff.focus.left": "Карьера и практика",
    "universities.tradeoff.focus.right": "Наука и исследования",
    "universities.tradeoff.atmosphere": "Атмосфера",
    "universities.tradeoff.atmosphere.left": "Социальность и ивенты",
    "universities.tradeoff.atmosphere.right": "Интенсивная учеба",
    "universities.tradeoff.finance": "Финансы",
    "universities.tradeoff.finance.left": "Бюджет и гранты",
    "universities.tradeoff.finance.right": "Престиж и комфорт",
    "universities.tradeoff.location": "Локация",
    "universities.tradeoff.location.left": "Жизнь в большом городе",
    "universities.tradeoff.location.right": "Уютный кампус",
    "universities.tradeoff.balanced": "Сбалансировано (50/50)",
    "universities.help.open": "Показать объяснение",
    "universities.help.country": "Фильтрует университеты по стране. Работает вместе с выбором региона и города.",
    "universities.help.state_region": "Сужает результаты внутри выбранной страны. Полезно для больших стран с множеством городов.",
    "universities.help.city": "Показывает университеты в конкретном городе после выбора страны/региона.",
    "universities.help.cost_per_year": "Задает минимальную и максимальную стоимость за год. В выдаче остаются только университеты в этом диапазоне.",
    "universities.help.sort_strategy": "UniFit использует профиль и ползунки. Другие варианты сортируют только по алфавиту или стоимости.",
    "universities.help.tradeoff.focus": "Сдвигает акцент между прикладной карьерной практикой и научно-исследовательским треком.",
    "universities.help.tradeoff.atmosphere": "Сдвигает акцент между активной социальной жизнью и интенсивной учебной средой.",
    "universities.help.tradeoff.finance": "Переключает режим вероятности: слева приоритет шанса гранта, справа приоритет общего/платного поступления.",
    "universities.help.tradeoff.location": "Сдвигает предпочтение между большим городом и более камерным кампусным форматом.",
    "universities.state.empty": "Университеты не найдены.",
    "universities.state.failed": "Не удалось загрузить данные.",
    "universities.state.ml_unavailable": "Machine Learning недоступен. Используется только rule-based ранжирование.",
    "universities.card.est_cost_year": "Примерная цена/год",
    "universities.badge.requirements_met": "✅ Требования выполнены",
    "universities.badge.below_requirements": "⚠️ Ниже требований",
    "universities.badge.aid_likely": "🎓 Вероятен грант/помощь (без штрафа по бюджету)",
    "universities.badge.over_budget_aid": "💸 Выше бюджета • Есть помощь",
    "universities.badge.over_budget": "💰 Выше бюджета",
    "universities.badge.aid_available": "🎓 Доступна помощь",
    "universities.badge.acceptance": "Уровень приема: {value}%",
    "universities.badge.conditional_exam_needed": "📝 Условно / Нужен экзамен",
    "universities.badge.top_match": "⭐ Отличное совпадение",
    "universities.badge.your_vibe": "🔥 Твой вайб",
    "universities.badge.likely_grant": "🎓 Вероятен грант",
    "universities.badge.paid_admission": "💼 Платное поступление",
    "universities.why.conditional_exam_needed": "Не хватает части экзаменационных данных, поэтому результат помечен как условный.",
    "universities.why.top_match": "Этот вуз хорошо совпадает с вашими текущими настройками ползунков.",
    "universities.why.your_vibe": "Этот вуз очень точно совпадает с вашими предпочтениями по Фокусу, Атмосфере и Локации.",
    "universities.why.likely_grant": "В режиме приоритета гранта у этого вуза высокий шанс поступления на грант.",
    "universities.why.paid_admission": "В режиме готовности платить у этого вуза высокий общий шанс поступления.",
    "universities.pagination.prev": "Назад",
    "universities.pagination.next": "Далее",

    "university.loading": "Загрузка данных университета",
    "university.back_to_list": "Назад к списку",
    "university.tab.general": "Общее",
    "university.tab.programs": "Программы",
    "university.tab.admission": "Поступление",
    "university.tab.costs": "Стоимость",
    "university.about_campus": "О вузе и кампусе",
    "university.overview": "Обзор",
    "university.available_majors": "Доступные специальности",
    "university.entry_requirements": "Входные требования",
    "university.total_cost_calculator": "Калькулятор общей стоимости",
    "university.discounts_scholarships": "Скидки и стипендии",
    "university.loading_scholarships": "Загрузка стипендий",
    "university.total_estimated_cost": "Примерная общая стоимость",
    "university.per_year": "в год",
    "university.price_from": "от {price} / год",
    "university.chat_assistant": "Чат-ассистент",
    "university.mode_auto": "Режим: Авто",
    "university.model_label": "Модель:",
    "university.model.auto": "Авто",
    "university.model.gemini": "Gemini",
    "university.model.fallback": "Резервная модель",
    "university.model.local": "Локальный fallback",
    "university.ask_placeholder": "Спросите про поступление, стипендии, жилье, дедлайны...",
    "university.send": "Отправить",
    "university.clear": "Очистить",
    "university.error_loading": "Ошибка загрузки данных.",
    "university.error_no_id": "Ошибка: ID не указан.",
    "university.visit_website": "Открыть официальный сайт",
    "university.show_on_map": "Показать на карте",

    "ranking.title": "Глобальный рейтинг университетов",
    "ranking.subtitle": "Топ университетов по академическому престижу и исследовательскому влиянию (2025)",
    "ranking.loading": "Загрузка рейтинга",
    "ranking.acceptance": "Уровень приема",
    "ranking.failed": "Не удалось загрузить рейтинг.",

    "about.eyebrow": "О нас",
    "about.title": "Мы команда абитуриентов UniSearch.",
    "about.lead":
      "UniSearch создан абитуриентами для абитуриентов. Наша цель — сделать выбор университета более понятным, простым и практичным.",
    "about.contact_kicker": "Контакты",
    "about.contact_title": "Свяжитесь с нами",
    "about.contact.email": "Email",
    "about.contact.github": "GitHub",
    "about.email_note": "Основной контакт по вопросам проекта.",
    "about.github_note": "Код, коммиты и обновления проекта.",
    "about.team_kicker": "Наша команда",
    "about.team_title": "Основные участники",
    "about.role.lead": "Ведущий разработчик и архитектор проекта",
    "about.role.planning": "Ассистент по планированию и документации",
    "about.role.docs": "Специалист по документации и презентации",
    "about.bio.lead":
      "Отвечает за весь код и реализацию всех идей. Является капитаном команды и принимает ключевые решения по проекту.",
    "about.meta.lead": "15 лет, ученик Жанаозенского лицея Білім-Инновация.",
    "about.bio.planning":
      "Отвечает за текстовую документацию, большинство идей и улучшений, а также за многочисленные тесты сайта.",
    "about.meta.planning": "14 лет, ученик Жанаозенского лицея Білім-Инновация.",
    "about.bio.docs":
      "Помогал с тестированием и интерфейсом, отвечает за видеодокументацию и презентацию.",
    "about.meta.docs": "15 лет, ученик Жанаозенской школы-гимназии №5.",

    "guide.eyebrow": "Гайд UniSearch",
    "guide.title": "Как пользоваться UniSearch и понимать оценки",
    "guide.intro":
      "На этой странице объясняются ключевые термины UniSearch: логика ранжирования {fit}, вероятность {chance}, треки поступления, типы баллов, языковые подтверждения и поведение бюджета.",
    "guide.nav.admission": "Поступление",
    "guide.nav.exam_basics": "Основы экзаменов",
    "guide.nav.academic_exams": "Академические экзамены",
    "guide.nav.language_exams": "Языковые экзамены",
    "guide.nav.glossary": "Глоссарий",
    "guide.unifit.title": "{fit} (AI умная сортировка)",
    "guide.unifit.p1":
      "{fit} ранжирует вузы по сочетанию дистанции предпочтений и вероятности поступления. Ползунки Фокус/Атмосфера/Локация формируют PreferenceMismatch, а Финансы переключают режим вероятности (GrantChance или GeneralChance). Итоговый порядок считает FinalScore = 0.6 * PreferenceMismatch + 0.4 * AdmissionRisk (меньше = лучше).",
    "guide.unifit.p2":
      'Отсутствующие экзамены считаются conditional, а не автоматическим fail. Карточки вузов объясняют причину рекомендации приоритетными тегами: сначала "Условно / Нужен экзамен", затем совпадение вайба ("Твой вайб" / "Отличное совпадение"), затем финансовый путь ("Вероятен грант" или "Платное поступление").',
    "guide.unifit.p3":
      "При наличии данных оценка считается по каждому треку отдельно. Поэтому вуз с меньшим общим рангом может быть лучше именно для вашего профиля.",
    "guide.unifit.p4":
      "Результаты {fit} динамические: изменение экзаменов, языков или бюджета сразу влияет на порядок.",
    "guide.ml.title": "ML в UniSearch (что это значит)",
    "guide.ml.p1":
      "ML — это Machine Learning. В UniSearch ML используется как дополнительный персонализирующий сигнал, а не замена правил поступления.",
    "guide.ml.p2":
      "Вы можете указать текстовые интересы в профиле. Перед ML-оценкой backend всегда переводит этот текст на американский английский (US English) через self-hosted LibreTranslate, затем сравнивает его с метаданными вузов через TF-IDF и cosine similarity.",
    "guide.ml.p3":
      "Текст метаданных формируется из названия вуза, локации, программ, а также description и tags.",
    "guide.ml.p4":
      "Перед скорингом короткие термины и аббревиатуры нормализуются (например ict, gamedev, ui/ux, genai).",
    "guide.ml.p5":
      "Если интересы заполнены, ML всё равно вычисляется и возвращается в matchData.mlScore, но итоговый порядок ранжирования задаётся взвешенной формулой UniFit (PreferenceMismatch + AdmissionRisk). Это сохраняет детерминированность и персонализацию.",
    "guide.unichance.title": "{chance} (вероятность поступления 0-100)",
    "guide.unichance.p1":
      "{chance} дает оценку вероятности от 0 до 100 по вузу и, если есть данные, по каждому треку. Это поддержка решения, а не гарантия.",
    "guide.unichance.p2":
      "Оценка строится по данным профиля и трека: минимальные требования, средние баллы поступивших, языковые правила, контекст acceptance и доступность по бюджету.",
    "guide.unichance.p3":
      "Практическая интерпретация: 80-100 высокий шанс, 60-79 хороший, 40-59 средний, ниже 40 низкий.",
    "guide.unichance.p4":
      "Блок Best Track показывает самый сильный путь внутри вуза и помогает найти более подходящие альтернативы.",
    "guide.admission.title": "Термины admission track",
    "guide.admission.p1":
      "Admission track — это конкретный путь поступления. У одного вуза может быть несколько треков с разными требованиями и стоимостью.",
    "guide.admission.p2":
      "Requirements — минимальный порог допуска. Real Average (Admitted) часто лучше отражает практическую конкурентность.",
    "guide.admission.p3":
      "Языковые правила обрабатываются явно: mode any — достаточно одного доказательства, mode all — нужно выполнить все условия.",
    "guide.admission.p4":
      "Стипендии и aid на уровне трека могут заметно менять итоговую финансовую картину.",
    "guide.exam_basics.title": "Основы экзаменов (поступление)",
    "guide.exam_basics.p1":
      "Поступление обычно оценивает две отдельные части: академическую подготовку и языковую готовность.",
    "guide.exam_basics.p2":
      "В разных странах и маршрутах используются разные экзамены: SAT, ACT, AP, IB, национальные или внутренние.",
    "guide.exam_basics.p3":
      "Языковые сертификаты особенно важны для международных абитуриентов и отличаются по трекам.",
    "guide.exam_basics.p4":
      "Стратегия: сначала закрыть минимумы, затем целиться в типичные уровни поступивших, затем распределить заявки по риску.",
    "guide.academic_exams.title": "Академические экзамены",
    "guide.language_exams.title": "Языковые экзамены",
    "guide.glossary.title": "Глоссарий",
    "guide.loading_language_config": "Загрузка конфигурации языковых экзаменов",
    "guide.muted.academic": "Объяснения академических баллов, которые используются в matching UniSearch.",
    "guide.muted.language": "Объяснения языковых подтверждений, принимаемых на треках.",

    "footer.copyright": "© 2026 UniSearch",

    "profile.label.budget": "Общий бюджет в год (USD)",
    "profile.placeholder.budget": "например, 20000",
    "profile.unit.usd_year": "USD / год",
    "profile.hint.budget_range": "Диапазон: 1 - 1,000,000",
    "profile.label.study_mode": "Предпочтительный формат обучения",
    "profile.option.study_mode_any": "Любой (все форматы)",
    "profile.option.study_mode_oncampus": "Очный (On-campus)",
    "profile.option.study_mode_online": "Онлайн / дистанционно",
    "profile.label.funding_type": "Предпочтительный тип финансирования",
    "profile.option.funding_any": "Любой (грант + платно)",
    "profile.option.funding_grant": "Только грант",
    "profile.option.funding_paid": "Только платно",
    "profile.label.major": "Планируемая специальность",
    "profile.option.major_any": "Не определился / Любая",
    "profile.label.interests": "Интересы по университету (AI)",
    "profile.placeholder.interests":
      "Опишите идеальный университет: программы, исследования, локацию, тип кампуса и цели.",
    "profile.hint.interests": "Используется для персонализации ваших рекомендаций.",
    "profile.label.gpa": "GPA (в процентах)",
    "profile.placeholder.gpa": "например, 92",
    "profile.unit.gpa": "% (от 0 до 100)",
    "profile.hint.gpa": "GPA хранится в процентах и используется в admission matching.",
    "profile.label.exams": "Экзамены (список, необязательно)",
    "profile.option.select_exam": "Выберите экзамен",
    "profile.placeholder.score": "Балл",
    "profile.placeholder.lang_score": "Балл (например, 7.5)",
    "profile.add": "Добавить",
    "profile.languages": "Языки",
    "profile.language": "Язык",
    "profile.type": "Тип",
    "profile.cefr": "CEFR",
    "profile.exam": "Экзамен",
    "profile.score": "Балл",
    "languages.select_type": "Выберите тип",
    "languages.no_exams": "Экзаменов нет",
    "languages.select_exam": "Выберите экзамен",
    "languages.saved": "Язык сохранен",
    "languages.removed": "Удалено",
    "languages.kind.native": "Родной",
    "languages.kind.cefr": "CEFR",
    "languages.kind.exam": "Экзамен",
    "languages.error.choose_language_type": "Выберите язык и тип",
    "languages.error.choose_cefr": "Выберите уровень CEFR",
    "languages.error.choose_exam": "Выберите экзамен",
    "languages.error.enter_score": "Введите балл",
    "languages.error.score_range": "Балл должен быть в диапазоне {min} - {max}",
    "languages.error.step_hint": "Шаг {step} (например, {first}, {second}, ...)",
    "languages.error.integer_required": "Для {exam} требуется целый балл",
    "languages.error.save_failed": "Не удалось сохранить язык",

    "profile.preference_saved": "Предпочтение сохранено",
    "profile.interests_saved": "Интересы сохранены",
    "profile.name_invalid_length": "Длина имени: 3-16 символов",
    "profile.name_invalid_symbols": "Недопустимые символы в имени",
    "profile.nickname_updated": "Ник обновлен!",
    "profile.budget_cleared": "Бюджет очищен",
    "profile.budget_integers_only": "Только целые числа (без точек и запятых)",
    "profile.budget_must_number": "Бюджет должен быть числом",
    "profile.budget_limit": "Лимит: 1 - 1,000,000 USD",
    "profile.budget_saved": "Бюджет сохранен!",
    "profile.gpa_cleared": "GPA очищен",
    "profile.gpa_must_number": "GPA должен быть числом",
    "profile.gpa_range": "GPA должен быть от {min} до {max}%",
    "profile.gpa_step": "Шаг GPA должен быть {step}",
    "profile.gpa_saved": "GPA сохранен",
    "profile.exam_select_required": "Выберите экзамен",
    "profile.exam_invalid_score": "Неверный формат балла",
    "profile.exam_integer_required": "Баллы {exam} должны быть целыми (например, 1400)",
    "profile.exam_ielts_step": "Балл IELTS должен оканчиваться на .0 или .5",
    "profile.exam_updated": "Обновлено: {exam} = {score}",
    "profile.exam_added": "Добавлен {exam}",
    "profile.exam_removed": "Экзамен удален",
    "profile.exam_score_label": "Балл: {score}",
    "profile.delete": "Удалить",
  },
  kz: {
    "title.index": "UniSearch - AI университет іздеу",
    "title.universities": "Университеттер | UniSearch",
    "title.university": "Университет | UniSearch",
    "title.ranking": "Әлемдік рейтингтер | UniSearch",
    "title.about": "Біз туралы | UniSearch",
    "title.guide": "Нұсқаулық | UniSearch",

    "nav.home": "Басты бет",
    "nav.universities": "Университеттер",
    "nav.rankings": "Рейтингтер",
    "nav.guide": "Нұсқаулық",
    "nav.about": "Біз туралы",
    "nav.profile": "Профиль",
    "nav.open_menu": "Мәзірді ашу",
    "nav.close_menu": "Мәзірді жабу",
    "nav.switch_theme": "Тақырыпты ауыстыру",
    "nav.language": "Тіл",
    "nav.lang.eng": "English (US)",
    "nav.lang.rus": "Русский",
    "nav.lang.kz": "Қазақша",

    "home.hero.title": "AI көмегімен армандаған университетіңізді табыңыз",
    "home.hero.title_html": "AI көмегімен армандаған университетіңізді <span class=\"text-gradient\"><span class=\"ai-gold\">табыңыз</span></span>",
    "home.hero.desc":
      "UniSearch — талаптар, шығындар және мүмкіндіктерді бір жерде салыстырып, университет табуға арналған ыңғайлы платформа.",
    "home.hero.start": "Іздеуді бастау",
    "home.hero.rankings": "Рейтингті көру",
    "home.stats.top_universities": "Үздік университеттер",
    "home.stats.countries": "Елдер",
    "home.stats.open_source": "Ашық код",
    "home.stats.ranking_chance": "Рейтинг + Мүмкіндік",
    "home.why": "Неге UniSearch?",
    "home.feature.ai_title": "{fit} + {chance} AI",
    "home.feature.ai_desc":
      "{fit} нұсқаларды сәйкес келуіне қарай сұрыптайды, ал {chance} әр трек бойынша түсу ықтималдығын бағалайды.",
    "home.feature.finance_title": "Қаржылық айқындық",
    "home.feature.finance_desc":
      "Нақты шығынды көріңіз. Жүйе merit-based және need-based көмекті көрсетіп, бюджетіңізге сай университеттерді бөледі.",
    "home.feature.data_title": "Дерекке негізделген шешім",
    "home.feature.data_desc":
      "Infomatrix үшін жасалған жоба: субъективтілікті азайту үшін құрылымдалған JSON деректері мен алгоритмдер қолданамыз.",

    "universities.filter": "Сүзгі",
    "universities.reset": "Тазалау",
    "universities.country": "Ел",
    "universities.global": "Жаһандық",
    "universities.state_region": "Штат / Аймақ",
    "universities.city": "Қала",
    "universities.all_cities": "Барлық қалалар",
    "universities.any_state": "Кез келген штат",
    "universities.select_country_first": "Алдымен елді таңдаңыз",
    "universities.cost_per_year": "Жылдық құны (USD)",
    "universities.sort_strategy": "Сұрыптау стратегиясы",
    "universities.sort_ai": "✨ {fit}: AI ақылды сұрыптау",
    "universities.sort_name_asc": "Атауы А-Я",
    "universities.sort_cost_asc": "Құны өсу ретімен",
    "universities.sort_cost_desc": "Құны кему ретімен",
    "universities.search_placeholder": "Университетті іздеу...",
    "universities.found_prefix": "Табылды",
    "universities.found_suffix": "университет",
    "universities.view_list": "Тізім",
    "universities.view_map": "Карта",
    "universities.loading": "Университеттер жүктелуде",
    "universities.tradeoff.focus": "Фокус",
    "universities.tradeoff.focus.left": "Мансап және практика",
    "universities.tradeoff.focus.right": "Ғылым және зерттеу",
    "universities.tradeoff.atmosphere": "Атмосфера",
    "universities.tradeoff.atmosphere.left": "Әлеуметтік өмір және іс-шаралар",
    "universities.tradeoff.atmosphere.right": "Қарқынды оқу",
    "universities.tradeoff.finance": "Қаржы",
    "universities.tradeoff.finance.left": "Бюджет және гранттар",
    "universities.tradeoff.finance.right": "Бедел және комфорт",
    "universities.tradeoff.location": "Орналасу",
    "universities.tradeoff.location.left": "Үлкен қала өмірі",
    "universities.tradeoff.location.right": "Жайлы кампус",
    "universities.tradeoff.balanced": "Теңгерімді (50/50)",
    "universities.help.open": "Түсіндірмені көрсету",
    "universities.help.country": "Университеттерді ел бойынша сүзеді. Қала және аймақ сүзгілерімен бірге жұмыс істейді.",
    "universities.help.state_region": "Таңдалған ел ішіндегі нәтижені тарылтады. Қаласы көп елдерге ыңғайлы.",
    "universities.help.city": "Ел/аймақ таңдалғаннан кейін нақты қаладағы университеттерді көрсетеді.",
    "universities.help.cost_per_year": "Жылдық бағаның минимум/максимум шегін қояды. Тізімде осы диапазондағы университеттер ғана қалады.",
    "universities.help.sort_strategy": "UniFit профиль мен слайдерлерді қолданады. Басқа режимдер тек атау не баға бойынша сұрыптайды.",
    "universities.help.tradeoff.focus": "Қолданбалы мансаптық бағыт пен ғылыми-зерттеу бағыты арасындағы басымдықты ауыстырады.",
    "universities.help.tradeoff.atmosphere": "Белсенді әлеуметтік орта мен қарқынды оқу ортасы арасындағы басымдықты ауыстырады.",
    "universities.help.tradeoff.finance": "Ықтималдық режимін ауыстырады: сол жақта грант шансы, оң жақта жалпы/ақылы түсу шансы басым.",
    "universities.help.tradeoff.location": "Үлкен қала өмірі мен жайлы кампус форматы арасындағы қалауды ауыстырады.",
    "universities.state.empty": "Университет табылмады.",
    "universities.state.failed": "Деректерді жүктеу сәтсіз аяқталды.",
    "universities.state.ml_unavailable": "Machine Learning қолжетімсіз. Тек rule-based сұрыптау қолданылуда.",
    "universities.card.est_cost_year": "Болжамды құн/жыл",
    "universities.badge.requirements_met": "✅ Талаптар орындалды",
    "universities.badge.below_requirements": "⚠️ Талаптан төмен",
    "universities.badge.aid_likely": "🎓 Грант/көмек ықтимал (бюджет айыппұлы жоқ)",
    "universities.badge.over_budget_aid": "💸 Бюджеттен жоғары • Көмек бар",
    "universities.badge.over_budget": "💰 Бюджеттен жоғары",
    "universities.badge.aid_available": "🎓 Көмек бар",
    "universities.badge.acceptance": "Қабылдау деңгейі: {value}%",
    "universities.badge.conditional_exam_needed": "📝 Шартты / Емтихан керек",
    "universities.badge.top_match": "⭐ Керемет сәйкестік",
    "universities.badge.your_vibe": "🔥 Сенің вайбың",
    "universities.badge.likely_grant": "🎓 Грант ықтимал",
    "universities.badge.paid_admission": "💼 Ақылы түсу",
    "universities.why.conditional_exam_needed": "Кейбір міндетті емтихан деректері жоқ, сондықтан нәтиже шартты болып белгіленді.",
    "universities.why.top_match": "Бұл университет сіздің қазіргі слайдер баптауыңызбен жақсы сәйкес келеді.",
    "universities.why.your_vibe": "Бұл университет сіздің Фокус, Атмосфера және Орналасу таңдауыңызға өте жақсы сәйкес келеді.",
    "universities.why.likely_grant": "Грант басымдығы режимінде бұл университетте грантпен түсу ықтималдығы жоғары.",
    "universities.why.paid_admission": "Ақылы түсу режимінде бұл университетте жалпы түсу ықтималдығы жоғары.",
    "universities.pagination.prev": "Артқа",
    "universities.pagination.next": "Келесі",

    "university.loading": "Университет деректері жүктелуде",
    "university.back_to_list": "Тізімге оралу",
    "university.tab.general": "Жалпы",
    "university.tab.programs": "Бағдарламалар",
    "university.tab.admission": "Қабылдау",
    "university.tab.costs": "Құны",
    "university.about_campus": "Университет және кампус",
    "university.overview": "Шолу",
    "university.available_majors": "Қолжетімді мамандықтар",
    "university.entry_requirements": "Қабылдау талаптары",
    "university.total_cost_calculator": "Жалпы құн калькуляторы",
    "university.discounts_scholarships": "Жеңілдіктер мен шәкіртақылар",
    "university.loading_scholarships": "Шәкіртақылар жүктелуде",
    "university.total_estimated_cost": "Болжамды жалпы құн",
    "university.per_year": "жылына",
    "university.price_from": "{price} бастап / жыл",
    "university.chat_assistant": "Чат көмекшісі",
    "university.mode_auto": "Режим: Авто",
    "university.model_label": "Модель:",
    "university.model.auto": "Авто",
    "university.model.gemini": "Gemini",
    "university.model.fallback": "Резерв модель",
    "university.model.local": "Жергілікті fallback",
    "university.ask_placeholder": "Қабылдау, шәкіртақы, жатақхана, дедлайн туралы сұраңыз...",
    "university.send": "Жіберу",
    "university.clear": "Тазалау",
    "university.error_loading": "Деректерді жүктеу қатесі.",
    "university.error_no_id": "Қате: ID көрсетілмеген.",
    "university.visit_website": "Ресми сайтқа өту",
    "university.show_on_map": "Картада көрсету",

    "ranking.title": "Әлемдік университет рейтингтері",
    "ranking.subtitle": "Академиялық бедел және зерттеу ықпалы бойынша үздік университеттер (2025)",
    "ranking.loading": "Рейтинг жүктелуде",
    "ranking.acceptance": "Қабылдау деңгейі",
    "ranking.failed": "Рейтингті жүктеу сәтсіз аяқталды.",

    "about.eyebrow": "Біз туралы",
    "about.title": "Біз UniSearch талапкерлер командасымыз.",
    "about.lead":
      "UniSearch талапкерлер үшін талапкерлер жасаған жоба. Мақсатымыз — университет таңдауды түсінікті, жеңіл және практикалық ету.",
    "about.contact_kicker": "Байланыс",
    "about.contact_title": "Бізбен байланысыңыз",
    "about.contact.email": "Email",
    "about.contact.github": "GitHub",
    "about.email_note": "Жоба сұрақтары үшін негізгі байланыс.",
    "about.github_note": "Код, коммиттер және жоба жаңартулары.",
    "about.team_kicker": "Біздің команда",
    "about.team_title": "Негізгі қатысушылар",
    "about.role.lead": "Бас әзірлеуші және жоба архитекторы",
    "about.role.planning": "Жоспарлау және құжаттама ассистенті",
    "about.role.docs": "Құжаттама және презентация маманы",
    "about.bio.lead":
      "Барлық код пен барлық идеялардың іске асуына жауапты. Команда капитаны ретінде жоба бойынша негізгі шешімдерді қабылдайды.",
    "about.meta.lead": "15 жаста, Жаңаөзен Білім-Инновация лицейінің оқушысы.",
    "about.bio.planning":
      "Мәтіндік құжаттамаға, идеялар мен жақсартулардың көп бөлігіне, сондай-ақ сайттың көптеген тестіне жауап береді.",
    "about.meta.planning": "14 жаста, Жаңаөзен Білім-Инновация лицейінің оқушысы.",
    "about.bio.docs":
      "Тестілеу мен интерфейске көмектесті, бейнеқұжаттама мен презентацияға жауапты.",
    "about.meta.docs": "15 жаста, Жаңаөзен №5 мектеп-гимназиясының оқушысы.",

    "guide.eyebrow": "UniSearch нұсқаулығы",
    "guide.title": "UniSearch-ті қолдану және бағаларды түсіну",
    "guide.intro":
      "Бұл бетте UniSearch-тегі негізгі терминдер түсіндіріледі: {fit} ранжирлеу логикасы, {chance} ықтималдық, қабылдау тректері, балл түрлері, тіл дәлелдері және бюджет логикасы.",
    "guide.nav.admission": "Қабылдау",
    "guide.nav.exam_basics": "Емтихан негіздері",
    "guide.nav.academic_exams": "Академиялық емтихандар",
    "guide.nav.language_exams": "Тіл емтихандары",
    "guide.nav.glossary": "Глоссарий",
    "guide.unifit.title": "{fit} (AI ақылды сұрыптау)",
    "guide.unifit.p1":
      "{fit} университеттерді preference distance пен түсу ықтималдығын біріктіріп сұрыптайды. Фокус/Атмосфера/Орналасу слайдерлері PreferenceMismatch есептейді, ал Қаржы ықтималдық режимін ауыстырады (GrantChance немесе GeneralChance). Қорытынды реттік көрсеткіш: FinalScore = 0.6 * PreferenceMismatch + 0.4 * AdmissionRisk (төмені жақсы).",
    "guide.unifit.p2":
      'Жетпейтін емтихан деректері automatic fail емес, conditional болып саналады. Университет карточкалары ұсыным себебін приоритетті тегтермен көрсетеді: алдымен "Шартты / Емтихан керек", кейін vibe сәйкестігі ("Сенің вайбың" / "Керемет сәйкестік"), содан кейін қаржылық жол ("Грант ықтимал" немесе "Ақылы түсу").',
    "guide.unifit.p3":
      "Трек деректері бар болса, модель әр тректі бөлек бағалайды. Сондықтан жалпы рангі төмендеу университет сізге жақсырақ сәйкесуі мүмкін.",
    "guide.unifit.p4":
      "{fit} нәтижесі динамикалық: емтихан, тіл, бюджет өзгерсе, тізім реті бірден жаңарады.",
    "guide.ml.title": "UniSearch-тегі ML (нені білдіреді)",
    "guide.ml.p1":
      "ML — Machine Learning. UniSearch-те ол admission ережелерін алмастырмайды, тек қосымша жекелендіру сигналы ретінде қолданылады.",
    "guide.ml.p2":
      "Профильдегі interests өрісіне еркін мәтін жаза аласыз. ML бағалауына дейін backend бұл мәтінді әрқашан self-hosted LibreTranslate арқылы америкалық ағылшынға (US English) аударады, содан кейін университет метадеректерімен TF-IDF және cosine similarity арқылы салыстырады.",
    "guide.ml.p3":
      "Метадерек мәтіні университет атауы, орналасуы, бағдарламалар, сондай-ақ description мен tags өрістерінен құралады.",
    "guide.ml.p4":
      "Бағалау алдында қысқа терминдер мен қысқартулар (ict, gamedev, ui/ux, genai) қалыпқа келтіріледі.",
    "guide.ml.p5":
      "Interests берілсе де, ML matchData.mlScore ішінде есептеліп қайтарылады, бірақ финалдық сұрыптау ретін UniFit-тің салмақталған формуласы (PreferenceMismatch + AdmissionRisk) анықтайды. Бұл нәтижені детерминалды және түсінікті етеді.",
    "guide.unichance.title": "{chance} (қабылдану ықтималдығы 0-100)",
    "guide.unichance.p1":
      "{chance} университет пен трек бойынша 0-ден 100-ге дейін ықтималдық бағасын береді. Бұл кепілдік емес, шешім қабылдауға көмек.",
    "guide.unichance.p2":
      "Баға профиль және трек деректерінен құралады: минималды талаптар, қабылданғандардың орташа балы, тіл ережелері, acceptance және бюджет сәйкестігі.",
    "guide.unichance.p3":
      "Түсіндіру: 80-100 жоғары мүмкіндік, 60-79 жақсы, 40-59 орташа, 40-тан төмен — төмен мүмкіндік.",
    "guide.unichance.p4":
      "Best Track бөлімі бір университет ішіндегі ең күшті жолды көрсетіп, жақсырақ балама табуға көмектеседі.",
    "guide.admission.title": "Admission track терминдері",
    "guide.admission.p1":
      "Admission track — белгілі бір түсу жолы. Бір университетте талаптары мен құны әртүрлі бірнеше трек болуы мүмкін.",
    "guide.admission.p2":
      "Requirements — ең төменгі шек. Real Average (Admitted) көбіне нақты бәсекелестік деңгейін жақсы көрсетеді.",
    "guide.admission.p3":
      "Тіл ережесі нақты: mode any — бір дәлел жеткілікті, mode all — барлық шарт орындалуы керек.",
    "guide.admission.p4":
      "Трек деңгейіндегі шәкіртақы мен aid нақты қаржылық нәтижеге қатты әсер етуі мүмкін.",
    "guide.exam_basics.title": "Емтихан негіздері (қабылдау)",
    "guide.exam_basics.p1":
      "Қабылдау әдетте екі бөлек бағытты бағалайды: академиялық дайындық және тілдік дайындық.",
    "guide.exam_basics.p2":
      "Әртүрлі елдер мен маршруттарда әртүрлі емтихандар қолданылады: SAT, ACT, AP, IB, ұлттық немесе ішкі емтихандар.",
    "guide.exam_basics.p3":
      "Тіл сертификаттары халықаралық талапкерлер үшін өте маңызды және трекке қарай ерекшеленеді.",
    "guide.exam_basics.p4":
      "Стратегия: алдымен минималды талаптарды жабыңыз, кейін орташа қабылданған деңгейге ұмтылыңыз, соңында өтінімдерді тәуекел бойынша бөліңіз.",
    "guide.academic_exams.title": "Академиялық емтихандар",
    "guide.language_exams.title": "Тіл емтихандары",
    "guide.glossary.title": "Глоссарий",
    "guide.loading_language_config": "Тіл емтиханы конфигурациясы жүктелуде",
    "guide.muted.academic": "UniSearch matching жүйесінде қолданылатын академиялық баллдар туралы түсінікті сипаттама.",
    "guide.muted.language": "Тректер бойынша қабылданатын тіл дәлелдерінің түсінікті сипаттамасы.",

    "footer.copyright": "© 2026 UniSearch",

    "profile.label.budget": "Жылдық жалпы бюджет (USD)",
    "profile.placeholder.budget": "мысалы, 20000",
    "profile.unit.usd_year": "USD / жыл",
    "profile.hint.budget_range": "Ауқым: 1 - 1,000,000",
    "profile.label.study_mode": "Оқу форматы",
    "profile.option.study_mode_any": "Кез келген (барлық формат)",
    "profile.option.study_mode_oncampus": "Кампус (On-campus)",
    "profile.option.study_mode_online": "Онлайн / қашықтан",
    "profile.label.funding_type": "Қаржыландыру түрі",
    "profile.option.funding_any": "Кез келген (грант + ақылы)",
    "profile.option.funding_grant": "Тек грант",
    "profile.option.funding_paid": "Тек ақылы",
    "profile.label.major": "Негізгі мамандық",
    "profile.option.major_any": "Белгісіз / Кез келген",
    "profile.label.interests": "Университет қызығушылықтары (AI)",
    "profile.placeholder.interests":
      "Өзіңізге ұнайтын университетті сипаттаңыз: бағдарламалар, зерттеу, орналасу, кампус түрі және мақсаттар.",
    "profile.hint.interests": "Ұсыныстарды сізге бейімдеу үшін қолданылады.",
    "profile.label.gpa": "GPA (пайыз)",
    "profile.placeholder.gpa": "мысалы, 92",
    "profile.unit.gpa": "% (0-ден 100-ге дейін)",
    "profile.hint.gpa": "GPA пайызбен сақталады және admission matching үшін қолданылады.",
    "profile.label.exams": "Емтихандар (тізім, міндетті емес)",
    "profile.option.select_exam": "Емтиханды таңдаңыз",
    "profile.placeholder.score": "Балл",
    "profile.placeholder.lang_score": "Балл (мысалы, 7.5)",
    "profile.add": "Қосу",
    "profile.languages": "Тілдер",
    "profile.language": "Тіл",
    "profile.type": "Түрі",
    "profile.cefr": "CEFR",
    "profile.exam": "Емтихан",
    "profile.score": "Балл",
    "languages.select_type": "Түрін таңдаңыз",
    "languages.no_exams": "Емтихан жоқ",
    "languages.select_exam": "Емтиханды таңдаңыз",
    "languages.saved": "Тіл сақталды",
    "languages.removed": "Өшірілді",
    "languages.kind.native": "Ана тілі",
    "languages.kind.cefr": "CEFR",
    "languages.kind.exam": "Емтихан",
    "languages.error.choose_language_type": "Тілді және түрін таңдаңыз",
    "languages.error.choose_cefr": "CEFR деңгейін таңдаңыз",
    "languages.error.choose_exam": "Емтиханды таңдаңыз",
    "languages.error.enter_score": "Балл енгізіңіз",
    "languages.error.score_range": "Балл {min} - {max} аралығында болуы керек",
    "languages.error.step_hint": "Қадам {step} (мысалы, {first}, {second}, ...)",
    "languages.error.integer_required": "{exam} үшін бүтін балл қажет",
    "languages.error.save_failed": "Тілді сақтау сәтсіз аяқталды",

    "profile.preference_saved": "Баптау сақталды",
    "profile.interests_saved": "Қызығушылықтар сақталды",
    "profile.name_invalid_length": "Атау ұзындығы 3-16 таңба болуы керек",
    "profile.name_invalid_symbols": "Атауда рұқсат етілмеген таңбалар бар",
    "profile.nickname_updated": "Лақап ат жаңартылды!",
    "profile.budget_cleared": "Бюджет тазартылды",
    "profile.budget_integers_only": "Тек бүтін сандар (үтір/нүктесіз)",
    "profile.budget_must_number": "Бюджет сан болуы керек",
    "profile.budget_limit": "Шек: 1 - 1,000,000 USD",
    "profile.budget_saved": "Бюджет сақталды!",
    "profile.gpa_cleared": "GPA тазартылды",
    "profile.gpa_must_number": "GPA сан болуы керек",
    "profile.gpa_range": "GPA {min} және {max}% арасында болуы керек",
    "profile.gpa_step": "GPA қадамы {step} болуы керек",
    "profile.gpa_saved": "GPA сақталды",
    "profile.exam_select_required": "Емтиханды таңдаңыз",
    "profile.exam_invalid_score": "Балл форматы қате",
    "profile.exam_integer_required": "{exam} балы бүтін сан болуы керек (мысалы, 1400)",
    "profile.exam_ielts_step": "IELTS балы .0 немесе .5 мәнімен аяқталуы керек",
    "profile.exam_updated": "{exam} жаңартылды: {score}",
    "profile.exam_added": "{exam} қосылды",
    "profile.exam_removed": "Емтихан өшірілді",
    "profile.exam_score_label": "Балл: {score}",
    "profile.delete": "Өшіру",
  },
};

let currentLang = LANG_ENG;
let __packsLoaded = false;
let __packsLoadPromise = null;

function normalizeLang(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (SUPPORTED_LANGS.has(raw)) return raw;
  if (raw.startsWith("en")) return LANG_ENG;
  if (raw.startsWith("ru")) return LANG_RUS;
  if (raw.startsWith("kk") || raw.startsWith("kz")) return LANG_KZ;
  return "";
}

function detectDeviceLang() {
  const first = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages[0]
    : (navigator.language || "");
  return normalizeLang(first) || LANG_ENG;
}

function readStoredLang() {
  try {
    return normalizeLang(localStorage.getItem(I18N_STORAGE_KEY));
  } catch (e) {
    return "";
  }
}

function writeStoredLang(lang) {
  try {
    localStorage.setItem(I18N_STORAGE_KEY, lang);
  } catch (e) {
    // ignore
  }
}

function setHtmlLang(lang) {
  const htmlLang = HTML_LANG_MAP[lang] || "en";
  document.documentElement.setAttribute("lang", htmlLang);
}

function _parseLocalizationFile(content) {
  const out = {};
  const rows = String(content || "").split(/\r?\n/);
  for (const rawRow of rows) {
    const row = String(rawRow || "").trim();
    if (!row || row.startsWith("#")) continue;
    const idx = row.indexOf(":");
    if (idx <= 0) continue;
    const key = row.slice(0, idx).trim();
    const value = row.slice(idx + 1).trim().replaceAll("\\n", "\n");
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

async function _loadLocalizationPacks() {
  if (__packsLoaded) return;
  if (__packsLoadPromise) return __packsLoadPromise;

  __packsLoadPromise = (async () => {
    const langs = [LANG_ENG, LANG_RUS, LANG_KZ];
    await Promise.all(
      langs.map(async (lang) => {
        const file = LANG_FILE_BY_CODE[lang];
        if (!file) return;
        try {
          const res = await fetch(file, { cache: "no-store" });
          if (!res.ok) return;
          const raw = await res.text();
          const parsed = _parseLocalizationFile(raw);
          if (!parsed || typeof parsed !== "object") return;
          DICT[lang] = { ...(DICT[lang] || {}), ...parsed };

          const code = String(parsed["meta.code"] || "").trim();
          const navKey = lang === LANG_ENG ? "nav.lang.eng" : (lang === LANG_RUS ? "nav.lang.rus" : "nav.lang.kz");
          if (code && !String(DICT[lang][navKey] || "").trim()) DICT[lang][navKey] = code.toUpperCase();
        } catch (e) {
          // keep built-in fallback pack
        }
      })
    );
    __packsLoaded = true;
  })();

  return __packsLoadPromise;
}

export function getCurrentLanguage() {
  return currentLang;
}

export function t(key, fallback = "") {
  const k = String(key || "").trim();
  if (!k) return String(fallback || "");
  const active = DICT[currentLang] || {};
  const en = DICT[LANG_ENG] || {};
  const value = active[k];
  if (value !== undefined && value !== null) return String(value);
  const enValue = en[k];
  if (enValue !== undefined && enValue !== null) return String(enValue);
  return String(fallback || "");
}

export function tFormat(key, params = {}, fallback = "") {
  let out = t(key, fallback);
  const map = params && typeof params === "object" ? params : {};
  Object.keys(map).forEach((paramKey) => {
    out = out.replaceAll(`{${paramKey}}`, String(map[paramKey]));
  });
  return out;
}

function applyTokenSubstitutions(text) {
  let out = String(text || "");
  const ai = window.AI_FUNCTIONS || {};
  const fit = String(ai.fit || "UniFit");
  const chance = String(ai.chance || "UniChance");
  out = out.replaceAll("{fit}", fit);
  out = out.replaceAll("{chance}", chance);
  return out;
}

export function applyTranslations(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;

  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const translated = applyTokenSubstitutions(t(key, el.textContent || ""));
    el.textContent = translated;
  });

  scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    const translated = applyTokenSubstitutions(t(key, el.innerHTML || ""));
    el.innerHTML = translated;
  });

  scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("placeholder") || ""));
    el.setAttribute("placeholder", translated);
  });

  scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("title") || ""));
    el.setAttribute("title", translated);
  });

  scope.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    const translated = applyTokenSubstitutions(t(key, el.getAttribute("aria-label") || ""));
    el.setAttribute("aria-label", translated);
  });
}

export function setLanguage(lang, options = {}) {
  const next = normalizeLang(lang) || LANG_ENG;
  const persist = options.persist !== false;
  const emit = options.emit !== false;
  const changed = next !== currentLang;
  currentLang = next;
  setHtmlLang(next);
  if (persist) writeStoredLang(next);
  if (changed && emit) {
    window.dispatchEvent(new CustomEvent("languageChanged", { detail: { language: next } }));
  }
  return next;
}

export async function initI18n() {
  await _loadLocalizationPacks();
  const stored = readStoredLang();
  const detected = detectDeviceLang();
  const resolved = normalizeLang(stored || detected) || LANG_ENG;
  setLanguage(resolved, { persist: !stored, emit: false });
  return currentLang;
}


