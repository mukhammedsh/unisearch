import { getCurrentLanguage, t } from "./i18n.js";

function keyify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const TRANSLATIONS = {
  rus: {
    country: {
      usa: "США",
      uk: "Великобритания",
      switzerland: "Швейцария",
      singapore: "Сингапур",
      germany: "Германия",
      canada: "Канада",
      hong_kong: "Гонконг",
      japan: "Япония",
      south_korea: "Южная Корея",
      netherlands: "Нидерланды",
      china: "Китай",
      kazakhstan: "Казахстан",
      australia: "Австралия",
    },
    city: {
      astana: "Астана",
      beijing: "Пекин",
      cambridge: "Кембридж",
      daejeon: "Тэджон",
      delft: "Делфт",
      kaskelen: "Каскелен",
      kyoto: "Киото",
      lausanne: "Лозанна",
      london: "Лондон",
      melbourne: "Мельбурн",
      munich: "Мюнхен",
      seoul: "Сеул",
      sha_tin: "Ша-Тин",
      singapore: "Сингапур",
      stanford: "Стэнфорд",
      tokyo: "Токио",
      toronto: "Торонто",
      zurich: "Цюрих",
    },
    state: {
      bavaria: "Бавария",
      ca: "Калифорния",
      ma: "Массачусетс",
      massachusetts: "Массачусетс",
      ontario: "Онтарио",
      vaud: "Во",
      victoria: "Виктория",
    },
    language: {
      english: "Английский",
      german: "Немецкий",
      french: "Французский",
      korean: "Корейский",
      chinese: "Китайский",
    },
    study_level: {
      bachelor: "Бакалавриат",
      master: "Магистратура",
      phd: "Докторантура",
      foundation: "Подготовительный курс",
    },
    study_mode: {
      on_campus: "Очно (кампус)",
    },
    campus_size: {
      small: "Небольшой",
      medium: "Средний",
      large: "Большой",
    },
    tag: {
      research: "исследования",
      stem: "STEM",
      ai: "ИИ",
      robotics: "робототехника",
      startups: "стартапы",
      urban: "городская среда",
      innovation: "инновации",
      engineering: "инженерия",
      computing: "компьютерные науки",
      medicine: "медицина",
      sustainability: "устойчивое развитие",
      interdisciplinary: "междисциплинарность",
      policy: "политика",
      business: "бизнес",
      data_science: "наука о данных",
      life_sciences: "науки о жизни",
      semiconductors: "полупроводники",
      mobility: "мобильность",
      aerospace: "аэрокосмос",
      biomedical: "биомедицина",
      cybersecurity: "кибербезопасность",
      software_engineering: "программная инженерия",
      ict: "ICT",
      public_university: "государственный университет",
      private_university: "частный университет",
      comprehensive: "комплексный университет",
      global: "глобальный",
      academic_freedom: "академическая свобода",
      aerospace: "аэрокосмос",
      applied_learning: "практико-ориентированное обучение",
      asia: "Азия",
      bilingual: "двуязычие",
      biomedical: "биомедицина",
      collegiate: "колледжная система",
      cybersec: "кибербезопасность",
      data: "данные",
      design: "дизайн",
      english_medium: "обучение на английском",
      entrepreneurship: "предпринимательство",
      europe: "Европа",
      fundamental_research: "фундаментальные исследования",
      health_sciences: "науки о здоровье",
      ict: "ICT",
      industry_links: "связи с индустрией",
      industry_projects: "индустриальные проекты",
      it: "IT",
      japan: "Япония",
      kazakhstan: "Казахстан",
      liberal_arts: "свободные искусства",
      manufacturing: "производство",
      medicine: "медицина",
      multilingual: "многоязычие",
      national_university: "национальный университет",
      natural_sciences: "естественные науки",
      policy: "политика",
      prestige: "престиж",
      public_policy: "государственная политика",
      regional_impact: "региональное влияние",
      science_and_technology: "наука и технологии",
      silicon_valley: "Кремниевая долина",
      sustainability: "устойчивое развитие",
    },
    words: {
      levels: "уровней",
      program: "Программа",
      track: "Трек",
      not_specified: "Не указано",
      acceptance_rate: "Коэффициент приема",
      study_levels: "Уровни обучения",
      duration: "Длительность",
      language: "Язык",
      study_mode: "Формат обучения",
      no_program_data: "Нет данных по программам.",
      global_rank: "Глобальный рейтинг",
      campus_size: "Размер кампуса",
      campus_size_info_title: "Как интерпретировать размер кампуса",
      campus_size_info_small: "Small: до 500 000 м² (до 50 га)",
      campus_size_info_medium: "Medium: 500 000-2 000 000 м² (50-200 га)",
      campus_size_info_large: "Large: более 2 000 000 м² (200+ га)",
      campus_size_info_note: "Диапазоны ориентировочные и нужны для удобного сравнения.",
      focus_tags: "Ключевые теги",
      total_students: "Всего студентов",
      study_formats: "Форматы обучения",
      level_word: "уровень",
      admission_probability_title: "Вероятность поступления",
      admission_probability_sub:
        "Оценка построена на вашем профиле, минимальных требованиях, языковых правилах, селективности и финансовом контексте.",
      best_track: "Лучший трек",
      general_admission: "Общее поступление",
      high_chance: "Высокий шанс",
      good_chance: "Хороший шанс",
      moderate_chance: "Средний шанс",
      low_chance: "Низкий шанс",
      add_profile_evidence:
        "Добавьте экзамены или языковые подтверждения в профиле, чтобы получить более надежную оценку {chance} для этого университета.",
      no_admission_tracks_data: "Нет данных по конкретным трекам поступления.",
      track_filter: "Фильтр треков",
      from_profile: "из профиля",
      showing_tracks: "Показано {shown} из {total} треков",
      filter_any: "Любой",
      filter_grant: "Грант",
      filter_paid: "Платное",
      for_all_majors: "Для всех специальностей",
      est_net_cost: "Оценка чистой стоимости",
      base_cost_before_grant: "Базовая стоимость (до гранта)",
      est_cost: "Оценка стоимости",
      academic_exams: "Академические экзамены",
      language_exams: "Языковые экзамены",
      not_available: "Нет данных",
      extra_requirements: "Дополнительные требования",
      available_grants_aid: "Доступные гранты и помощь",
      cover: "Покрытие",
      need_based_aid: "Поддержка по финансовой потребности",
      merit_scholarship: "Стипендия за достижения",
      requires: "Требуется",
      no_specific_requirements_listed: "Конкретные требования не указаны",
      minimum_to_apply: "Минимум для подачи",
      real_average_admitted: "Реальный средний (зачисленные)",
      none: "Нет",
      no_tracks_selected_filter: "По выбранному фильтру треки не найдены.",
      language_track_rules: "Языковые правила трека",
      lang_mode_any: "Достаточно одного подтверждения языка",
      lang_mode_all: "Требуются все перечисленные языковые подтверждения",
      native_accepted: "Носитель языка принимается",
      min_cefr: "Минимум CEFR",
      typical: "Типичный уровень",
      exam_minimums: "Минимумы по экзаменам",
      typical_admitted: "Типичные баллы зачисленных",
      merit_based_scholarships_available: "Доступны стипендии за достижения",
      no_merit_based_scholarships: "Нет стипендий за достижения",
      need_based_financial_aid: "Доступна финансовая помощь по потребности",
      no_need_based_aid: "Нет помощи по финансовой потребности",
      from: "от",
      general_tuition: "Общая стоимость обучения",
      available_scholarships: "Доступные стипендии",
      total_per_year: "Итого / год",
    },
    templates: {
      desc_with_tags: "{name} — университет в {city}, {country}. Сильные стороны: {tags}.",
      desc_no_tags: "{name} — университет в {city}, {country}.",
    },
  },
  kz: {
    country: {
      usa: "АҚШ",
      uk: "Ұлыбритания",
      switzerland: "Швейцария",
      singapore: "Сингапур",
      germany: "Германия",
      canada: "Канада",
      hong_kong: "Гонконг",
      japan: "Жапония",
      south_korea: "Оңтүстік Корея",
      netherlands: "Нидерланд",
      china: "Қытай",
      kazakhstan: "Қазақстан",
      australia: "Аустралия",
    },
    city: {
      astana: "Астана",
      beijing: "Бейжің",
      cambridge: "Кембридж",
      daejeon: "Тэджон",
      delft: "Делфт",
      kaskelen: "Қаскелең",
      kyoto: "Киото",
      lausanne: "Лозанна",
      london: "Лондон",
      melbourne: "Мельбурн",
      munich: "Мюнхен",
      seoul: "Сеул",
      sha_tin: "Ша-Тин",
      singapore: "Сингапур",
      stanford: "Стэнфорд",
      tokyo: "Токио",
      toronto: "Торонто",
      zurich: "Цюрих",
    },
    state: {
      bavaria: "Бавария",
      ca: "Калифорния",
      ma: "Массачусетс",
      massachusetts: "Массачусетс",
      ontario: "Онтарио",
      vaud: "Во",
      victoria: "Виктория",
    },
    language: {
      english: "Ағылшын",
      german: "Неміс",
      french: "Француз",
      korean: "Кәріс",
      chinese: "Қытай",
    },
    study_level: {
      bachelor: "Бакалавриат",
      master: "Магистратура",
      phd: "Докторантура",
      foundation: "Дайындық бағдарламасы",
    },
    study_mode: {
      on_campus: "Кампуста",
    },
    campus_size: {
      small: "Шағын",
      medium: "Орташа",
      large: "Үлкен",
    },
    tag: {
      research: "зерттеу",
      stem: "STEM",
      ai: "ЖИ",
      robotics: "робототехника",
      startups: "стартаптар",
      urban: "қалалық",
      innovation: "инновация",
      engineering: "инженерия",
      computing: "есептеу технологиялары",
      medicine: "медицина",
      sustainability: "тұрақты даму",
      interdisciplinary: "пәнаралық",
      policy: "саясат",
      business: "бизнес",
      data_science: "деректер ғылымы",
      life_sciences: "өмір туралы ғылымдар",
      semiconductors: "жартылай өткізгіштер",
      mobility: "мобильділік",
      aerospace: "аэроғарыш",
      biomedical: "биомедицина",
      cybersecurity: "киберқауіпсіздік",
      software_engineering: "бағдарламалық инженерия",
      ict: "ICT",
      public_university: "мемлекеттік университет",
      private_university: "жекеменшік университет",
      comprehensive: "жан-жақты университет",
      global: "жаһандық",
      academic_freedom: "академиялық еркіндік",
      aerospace: "аэроғарыш",
      applied_learning: "практикалық оқу",
      asia: "Азия",
      bilingual: "екітілді",
      biomedical: "биомедицина",
      collegiate: "колледждік жүйе",
      cybersec: "киберқауіпсіздік",
      data: "деректер",
      design: "дизайн",
      english_medium: "ағылшын тілінде оқу",
      entrepreneurship: "кәсіпкерлік",
      europe: "Еуропа",
      fundamental_research: "іргелі зерттеу",
      health_sciences: "денсаулық ғылымдары",
      ict: "ICT",
      industry_links: "индустриямен байланыс",
      industry_projects: "индустриялық жобалар",
      it: "IT",
      japan: "Жапония",
      kazakhstan: "Қазақстан",
      liberal_arts: "еркін өнер",
      manufacturing: "өндіріс",
      medicine: "медицина",
      multilingual: "көптілді",
      national_university: "ұлттық университет",
      natural_sciences: "жаратылыстану",
      policy: "саясат",
      prestige: "бедел",
      public_policy: "мемлекеттік саясат",
      regional_impact: "өңірлік әсер",
      science_and_technology: "ғылым және технология",
      silicon_valley: "Кремний алқабы",
      sustainability: "тұрақты даму",
    },
    words: {
      levels: "деңгей",
      program: "Бағдарлама",
      track: "Трек",
      not_specified: "Көрсетілмеген",
      acceptance_rate: "Қабылдау көрсеткіші",
      study_levels: "Оқу деңгейлері",
      duration: "Ұзақтығы",
      language: "Тіл",
      study_mode: "Оқу форматы",
      no_program_data: "Бағдарламалар туралы дерек жоқ.",
      global_rank: "Жаһандық рейтинг",
      campus_size: "Кампус көлемі",
      campus_size_info_title: "Кампус өлшемін қалай түсінуге болады",
      campus_size_info_small: "Small: 500 000 м² дейін (50 га дейін)",
      campus_size_info_medium: "Medium: 500 000-2 000 000 м² (50-200 га)",
      campus_size_info_large: "Large: 2 000 000 м²-ден жоғары (200+ га)",
      campus_size_info_note: "Бұл шамамен алынған диапазондар, салыстыруға ыңғайлы болу үшін берілген.",
      focus_tags: "Негізгі тегтер",
      total_students: "Студент саны",
      study_formats: "Оқу форматтары",
      level_word: "деңгей",
      admission_probability_title: "Түсу ықтималдығы",
      admission_probability_sub:
        "Бағалау профиліңізге, минималды талаптарға, тіл ережелеріне, селективтілікке және қаржылық контекстке негізделген.",
      best_track: "Ең жақсы трек",
      general_admission: "Жалпы қабылдау",
      high_chance: "Жоғары мүмкіндік",
      good_chance: "Жақсы мүмкіндік",
      moderate_chance: "Орташа мүмкіндік",
      low_chance: "Төмен мүмкіндік",
      add_profile_evidence:
        "Осы университет үшін {chance} бағасының сенімді болуы үшін профайлға емтихан не тілдік дәлел қосыңыз.",
      no_admission_tracks_data: "Нақты қабылдау тректері бойынша дерек жоқ.",
      track_filter: "Трек фильтрі",
      from_profile: "профайлдан",
      showing_tracks: "{total} тректің {shown}-і көрсетілді",
      filter_any: "Кез келген",
      filter_grant: "Грант",
      filter_paid: "Ақылы",
      for_all_majors: "Барлық мамандықтарға",
      est_net_cost: "Таза құн бағасы",
      base_cost_before_grant: "Негізгі құн (грантқа дейін)",
      est_cost: "Құн бағасы",
      academic_exams: "Академиялық емтихандар",
      language_exams: "Тіл емтихандары",
      not_available: "Дерек жоқ",
      extra_requirements: "Қосымша талаптар",
      available_grants_aid: "Қолжетімді гранттар мен көмек",
      cover: "Қамту",
      need_based_aid: "Қаржылық қажеттілікке негізделген көмек",
      merit_scholarship: "Жетістікке арналған шәкіртақы",
      requires: "Талап етіледі",
      no_specific_requirements_listed: "Нақты талаптар көрсетілмеген",
      minimum_to_apply: "Өтінім беру минимумы",
      real_average_admitted: "Нақты орташа (қабылданғандар)",
      none: "Жоқ",
      no_tracks_selected_filter: "Таңдалған фильтр бойынша трек табылмады.",
      language_track_rules: "Тректегі тіл ережелері",
      lang_mode_any: "Бір тілдік дәлел жеткілікті",
      lang_mode_all: "Барлық көрсетілген тілдік дәлелдер қажет",
      native_accepted: "Ана тілі ретінде қабылданады",
      min_cefr: "CEFR минимумы",
      typical: "Типтік деңгей",
      exam_minimums: "Емтихан минимумдары",
      typical_admitted: "Қабылданғандардың типтік балы",
      merit_based_scholarships_available: "Жетістікке арналған шәкіртақылар бар",
      no_merit_based_scholarships: "Жетістікке арналған шәкіртақылар жоқ",
      need_based_financial_aid: "Қаржылық қажеттілікке негізделген көмек бар",
      no_need_based_aid: "Қаржылық қажеттілікке көмек жоқ",
      from: "бастап",
      general_tuition: "Жалпы оқу құны",
      available_scholarships: "Қолжетімді шәкіртақылар",
      total_per_year: "Жалпы / жыл",
    },
    templates: {
      desc_with_tags: "{name} — {city}, {country} қаласындағы университет. Күшті бағыттары: {tags}.",
      desc_no_tags: "{name} — {city}, {country} қаласындағы университет.",
    },
  },
};

const TRACK_LABELS = {
  rus: {
    aptitude_assessment: "Оценка способностей",
    direct_admission_sat: "Прямое поступление (SAT)",
    direct_admission_sat_abay_kunanbayev_grant: "Прямое поступление (SAT) - Грант имени Абая Кунанбаева",
    direct_entry: "Прямое зачисление",
    direct_entry_excellence_scholarship_grant: "Прямое зачисление - Стипендия Excellence (Грант)",
    engineering_track: "Инженерный трек",
    engineering_track_president_s_scholarship_grant: "Инженерный трек - Президентская стипендия (Грант)",
    entrance_exam: "Вступительный экзамен",
    foundation_nuet: "Подготовительная программа (NUET)",
    foundation_nuet_state_grant_grant: "Подготовительная программа (NUET) - Государственный грант (Грант)",
    general_admission: "Общее поступление",
    general_admission_pearson_scholarship_grant: "Общее поступление - Стипендия Pearson (Грант)",
    harvard_college: "Гарвардский колледж",
    harvard_college_financial_aid_grant: "Гарвардский колледж - Финансовая помощь (Грант)",
    international_admission: "Международное поступление",
    international_admission_asean_scholarship_grant: "Международное поступление - Стипендия ASEAN (Грант)",
    international_admission_kaist_scholarship_grant: "Международное поступление - Стипендия KAIST (Грант)",
    international_admissions: "Международное поступление",
    international_admissions_admission_scholarship_grant: "Международное поступление - Стипендия при поступлении (Грант)",
    international_admissions_glo_harmony_grant: "Международное поступление - Glo-Harmony (Грант)",
    international_track: "Международный трек",
    international_track_chinese_govt_scholarship_grant: "Международный трек - Стипендия правительства Китая (Грант)",
    international_ug: "Международный бакалавриат",
    international_ug_melbourne_intl_scholarship_grant: "Международный бакалавриат - Стипендия Melbourne Intl (Грант)",
    kyoto_iup: "Kyoto iUP",
    kyoto_iup_iup_scholarship_grant: "Kyoto iUP - Стипендия iUP (Грант)",
    numerus_clausus: "Numerus Clausus",
    numerus_clausus_justus_louise_van_effen_grant: "Numerus Clausus - Стипендия Justus & Louise van Effen (Грант)",
    paid_admission: "Платное поступление",
    peak_english_track: "PEAK (англоязычный трек)",
    peak_english_track_utokyo_scholarship_grant: "PEAK (англоязычный трек) - Стипендия UTokyo (Грант)",
    regular_action: "Основной набор",
    regular_action_need_based_aid_grant: "Основной набор - Поддержка по финансовой потребности (Грант)",
    standard_admission: "Стандартное поступление",
    standard_admission_need_based_aid_grant: "Стандартное поступление - Поддержка по финансовой потребности (Грант)",
    state_grant: "Государственный грант",
    state_rector_grant: "Государственный/ректорский грант",
    unt_paid: "UNT (платное)",
    general_tuition: "Общая стоимость обучения",
    no_matching_track: "Нет подходящего трека",
    no_tracks_for_selected_funding_type: "Нет треков для выбранного типа финансирования",
  },
  kz: {
    aptitude_assessment: "Қабілетті бағалау",
    direct_admission_sat: "Тікелей қабылдау (SAT)",
    direct_admission_sat_abay_kunanbayev_grant: "Тікелей қабылдау (SAT) - Абай Құнанбайұлы гранты",
    direct_entry: "Тікелей қабылдау",
    direct_entry_excellence_scholarship_grant: "Тікелей қабылдау - Excellence стипендиясы (Грант)",
    engineering_track: "Инженерлік трек",
    engineering_track_president_s_scholarship_grant: "Инженерлік трек - Президент стипендиясы (Грант)",
    entrance_exam: "Кіру емтиханы",
    foundation_nuet: "Дайындық бағдарламасы (NUET)",
    foundation_nuet_state_grant_grant: "Дайындық бағдарламасы (NUET) - Мемлекеттік грант (Грант)",
    general_admission: "Жалпы қабылдау",
    general_admission_pearson_scholarship_grant: "Жалпы қабылдау - Pearson стипендиясы (Грант)",
    harvard_college: "Гарвард колледжі",
    harvard_college_financial_aid_grant: "Гарвард колледжі - Қаржылық көмек (Грант)",
    international_admission: "Халықаралық қабылдау",
    international_admission_asean_scholarship_grant: "Халықаралық қабылдау - ASEAN стипендиясы (Грант)",
    international_admission_kaist_scholarship_grant: "Халықаралық қабылдау - KAIST стипендиясы (Грант)",
    international_admissions: "Халықаралық қабылдау",
    international_admissions_admission_scholarship_grant: "Халықаралық қабылдау - Қабылдау стипендиясы (Грант)",
    international_admissions_glo_harmony_grant: "Халықаралық қабылдау - Glo-Harmony (Грант)",
    international_track: "Халықаралық трек",
    international_track_chinese_govt_scholarship_grant: "Халықаралық трек - Қытай үкіметі стипендиясы (Грант)",
    international_ug: "Халықаралық бакалавриат",
    international_ug_melbourne_intl_scholarship_grant: "Халықаралық бакалавриат - Melbourne Intl стипендиясы (Грант)",
    kyoto_iup: "Kyoto iUP",
    kyoto_iup_iup_scholarship_grant: "Kyoto iUP - iUP стипендиясы (Грант)",
    numerus_clausus: "Numerus Clausus",
    numerus_clausus_justus_louise_van_effen_grant: "Numerus Clausus - Justus & Louise van Effen стипендиясы (Грант)",
    paid_admission: "Ақылы қабылдау",
    peak_english_track: "PEAK (ағылшын трегі)",
    peak_english_track_utokyo_scholarship_grant: "PEAK (ағылшын трегі) - UTokyo стипендиясы (Грант)",
    regular_action: "Негізгі қабылдау",
    regular_action_need_based_aid_grant: "Негізгі қабылдау - Қажеттілікке негізделген көмек (Грант)",
    standard_admission: "Стандартты қабылдау",
    standard_admission_need_based_aid_grant: "Стандартты қабылдау - Қажеттілікке негізделген көмек (Грант)",
    state_grant: "Мемлекеттік грант",
    state_rector_grant: "Мемлекеттік/ректор гранты",
    unt_paid: "UNT (ақылы)",
    general_tuition: "Жалпы оқу құны",
    no_matching_track: "Сәйкес трек табылмады",
    no_tracks_for_selected_funding_type: "Таңдалған қаржыландыру түрі бойынша тректер жоқ",
  },
};

const PROGRAM_NAMES = {
  rus: {
    agriculture: "Сельское хозяйство",
    aerospace_engineering: "Аэрокосмическая инженерия",
    architecture: "Архитектура",
    business: "Бизнес",
    business_information_systems: "Бизнес-информационные системы",
    computer_science: "Компьютерные науки",
    computer_science_bcomp: "Компьютерные науки (BComp)",
    computer_science_computing_and_software_systems_major: "Компьютерные науки (специализация «Вычислительные и программные системы»)",
    computer_science_and_engineering: "Компьютерные науки и инженерия",
    computer_science_and_engineering_6_3: "Компьютерные науки и инженерия (6-3)",
    computer_science_and_engineering_graduate: "Компьютерные науки и инженерия (магистратура/докторантура)",
    computer_science_and_technology: "Компьютерные науки и технологии",
    computing_beng_meng: "Вычислительная техника (BEng/MEng)",
    design: "Дизайн",
    economics: "Экономика",
    education: "Образование",
    electrical_engineering_and_computer_science_6_2_6_5: "Электротехника и компьютерные науки (6-2/6-5)",
    engineering: "Инженерия",
    engineering_digital_infrastructure_engineering_systems_major: "Инженерия (специализация «Инженерные системы цифровой инфраструктуры»)",
    environmental_sciences_peak: "Экологические науки (PEAK)",
    foundation_year: "Подготовительный год",
    humanities: "Гуманитарные науки",
    informatics: "Информатика",
    information_systems: "Информационные системы",
    japan_in_east_asia_peak: "Япония в Восточной Азии (PEAK)",
    kyoto_iup_preparatory_course: "Подготовительный курс Kyoto iUP",
    kyoto_iup_undergraduate_program: "Программа бакалавриата Kyoto iUP",
    law: "Право",
    life_sciences: "Науки о жизни",
    mechanical_and_aerospace_engineering: "Машиностроение и аэрокосмическая инженерия",
    mechanical_engineering: "Машиностроение",
    mathematics: "Математика",
    medicine: "Медицина",
    natural_sciences: "Естественные науки",
    physics: "Физика",
    psychology: "Психология",
    software_engineering: "Программная инженерия",
    social_sciences: "Социальные науки",
  },
  kz: {
    agriculture: "Ауыл шаруашылығы",
    aerospace_engineering: "Аэроғарыш инженериясы",
    architecture: "Сәулет",
    business: "Бизнес",
    business_information_systems: "Бизнес-ақпараттық жүйелер",
    computer_science: "Компьютерлік ғылымдар",
    computer_science_bcomp: "Компьютерлік ғылымдар (BComp)",
    computer_science_computing_and_software_systems_major: "Компьютерлік ғылымдар (Есептеу және бағдарламалық жүйелер бағыты)",
    computer_science_and_engineering: "Компьютерлік ғылымдар және инженерия",
    computer_science_and_engineering_6_3: "Компьютерлік ғылымдар және инженерия (6-3)",
    computer_science_and_engineering_graduate: "Компьютерлік ғылымдар және инженерия (магистратура/докторантура)",
    computer_science_and_technology: "Компьютерлік ғылымдар және технологиялар",
    computing_beng_meng: "Есептеу техникасы (BEng/MEng)",
    design: "Дизайн",
    economics: "Экономика",
    education: "Білім беру",
    electrical_engineering_and_computer_science_6_2_6_5: "Электротехника және компьютерлік ғылымдар (6-2/6-5)",
    engineering: "Инженерия",
    engineering_digital_infrastructure_engineering_systems_major: "Инженерия (Цифрлық инфрақұрылым инженерлік жүйелері бағыты)",
    environmental_sciences_peak: "Экологиялық ғылымдар (PEAK)",
    foundation_year: "Дайындық жылы",
    humanities: "Гуманитарлық ғылымдар",
    informatics: "Информатика",
    information_systems: "Ақпараттық жүйелер",
    japan_in_east_asia_peak: "Шығыс Азиядағы Жапония (PEAK)",
    kyoto_iup_preparatory_course: "Kyoto iUP дайындық курсы",
    kyoto_iup_undergraduate_program: "Kyoto iUP бакалавриат бағдарламасы",
    law: "Құқық",
    life_sciences: "Өмір туралы ғылымдар",
    mechanical_and_aerospace_engineering: "Машина жасау және аэроғарыш инженериясы",
    mechanical_engineering: "Машина жасау",
    mathematics: "Математика",
    medicine: "Медицина",
    natural_sciences: "Жаратылыстану ғылымдары",
    physics: "Физика",
    psychology: "Психология",
    software_engineering: "Бағдарламалық инженерия",
    social_sciences: "Әлеуметтік ғылымдар",
  },
};

const TRACK_LABEL_FALLBACK_REPLACE = {
  rus: [
    ["Need-based Aid", "Поддержка по финансовой потребности"],
    ["Financial Aid", "Финансовая помощь"],
    ["Scholarship", "Стипендия"],
    ["Admission", "Поступление"],
    ["Track", "Трек"],
    ["Grant", "Грант"],
    ["Paid", "Платное"],
    ["International UG", "Международный бакалавриат"],
    ["International Admissions", "Международное поступление"],
    ["International Admission", "Международное поступление"],
  ],
  kz: [
    ["Need-based Aid", "Қажеттілікке негізделген көмек"],
    ["Financial Aid", "Қаржылық көмек"],
    ["Scholarship", "Стипендия"],
    ["Admission", "Қабылдау"],
    ["Track", "Трек"],
    ["Grant", "Грант"],
    ["Paid", "Ақылы"],
    ["International UG", "Халықаралық бакалавриат"],
    ["International Admissions", "Халықаралық қабылдау"],
    ["International Admission", "Халықаралық қабылдау"],
  ],
};

function getLangPack() {
  const lang = getCurrentLanguage();
  return TRANSLATIONS[lang] || null;
}

export function translateDataValue(group, value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  const pack = getLangPack();
  if (!pack || !pack[group]) return raw;
  return pack[group][keyify(raw)] || raw;
}

export function translateWord(key, fallback = "") {
  const pack = getLangPack();
  if (!pack || !pack.words) return String(fallback || "");
  return pack.words[String(key || "").trim()] || String(fallback || "");
}

export function translateTemplate(key, fallback = "", params = {}) {
  let out = translateWord(key, fallback);
  const map = params && typeof params === "object" ? params : {};
  Object.keys(map).forEach((k) => {
    out = out.replaceAll(`{${k}}`, String(map[k]));
  });
  return out;
}

export function translateUniversityName(id, fallback = "") {
  const uniId = String(id || "").trim();
  if (!uniId) return String(fallback || "");
  const key = `university.name.${uniId}`;
  const translated = String(t(key, "") || "").trim();
  return translated || String(fallback || "");
}

export function translateUniversityDescription(university, fallback = "") {
  const lang = getCurrentLanguage();
  const sourceDescription = String(fallback || "");
  if (lang === "eng") return sourceDescription;

  const u = university && typeof university === "object" ? university : {};
  const uniId = String(u.id || "").trim();
  if (uniId) {
    const key = `university.description.${uniId}`;
    const localized = String(t(key, "") || "").trim();
    if (localized) return localized;
  }

  // Keep full source context if specific localization is missing.
  if (sourceDescription) return sourceDescription;

  const name = translateUniversityName(u.id, String(u.name || fallback || ""));
  const city = translateDataValue("city", u?.location?.city || "", String(u?.location?.city || ""));
  const country = translateDataValue("country", u?.location?.country || "", String(u?.location?.country || ""));
  const tagsRaw = Array.isArray(u.tags) ? u.tags.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const tags = tagsRaw
    .map((x) => translateDataValue("tag", x, x))
    .slice(0, 4);

  const pack = TRANSLATIONS[lang];
  const tpl = tags.length ? pack.templates.desc_with_tags : pack.templates.desc_no_tags;
  return tpl
    .replaceAll("{name}", name || String(u.name || ""))
    .replaceAll("{city}", city || String(u?.location?.city || ""))
    .replaceAll("{country}", country || String(u?.location?.country || ""))
    .replaceAll("{tags}", tags.join(", "));
}

const ADMISSION_REPLACE = {
  rus: [
    ["Application fee", "Регистрационный сбор"],
    ["non-refundable", "невозвратный"],
    ["fee waiver available", "возможна льгота по оплате"],
    ["submitted by school", "подается школой"],
    ["submitted electronically", "подается в электронном виде"],
    ["submitted online", "подается онлайн"],
    ["submitted", "подан"],
    ["online", "онлайн"],
    ["passport", "паспорт"],
    ["national ID", "удостоверение личности"],
    ["certificate", "сертификат"],
    ["diploma", "диплом"],
    ["transcript", "транскрипт"],
    ["transcripts", "транскрипты"],
    ["recommendation letter", "рекомендательное письмо"],
    ["recommendations", "рекомендации"],
    ["school report", "школьный отчет"],
    ["personal statement", "мотивационное эссе"],
    ["motivation letter", "мотивационное письмо"],
    ["interview", "интервью"],
    ["entrance examination", "вступительный экзамен"],
    ["proof of English language proficiency", "подтверждение уровня английского языка"],
    ["English language test report", "результат языкового теста по английскому"],
    ["upload", "загрузите"],
    ["documents", "документы"],
    ["document", "документ"],
    ["if required", "если требуется"],
    ["if applicable", "если применимо"],
    ["high school", "старшая школа"],
    ["secondary school", "средняя школа"],
    ["university", "университет"],
    ["academic", "академический"],
    ["results", "результаты"],
    ["grade", "оценка"],
    ["midyear", "промежуточный"],
    ["final", "финальный"],
    ["expected", "ожидаемый"],
    ["official", "официальный"],
    ["copy", "копия"],
    ["curriculum vitae", "резюме (CV)"],
    ["resume", "резюме"],
    ["language proficiency", "уровень владения языком"],
    ["financial sponsor", "финансовый спонсор"],
    ["enrollment certificate", "справка о зачислении"],
    ["registration form", "регистрационная форма"],
    ["medical report", "медицинский отчет"],
    ["statement of criminal records or offence", "заявление о судимости/правонарушениях"],
    ["Upper secondary school-leaving certificate", "аттестат о завершении старшей школы"],
  ],
  kz: [
    ["Application fee", "Өтінім ақысы"],
    ["non-refundable", "қайтарылмайды"],
    ["fee waiver available", "ақыдан босату мүмкін"],
    ["submitted by school", "мектеп арқылы жіберіледі"],
    ["submitted electronically", "электронды түрде жіберіледі"],
    ["submitted online", "онлайн жіберіледі"],
    ["submitted", "жіберілген"],
    ["online", "онлайн"],
    ["passport", "паспорт"],
    ["national ID", "жеке куәлік"],
    ["certificate", "сертификат"],
    ["diploma", "диплом"],
    ["transcript", "транскрипт"],
    ["transcripts", "транскрипттер"],
    ["recommendation letter", "ұсыныс хат"],
    ["recommendations", "ұсыныстар"],
    ["school report", "мектеп есебі"],
    ["personal statement", "мотивациялық эссе"],
    ["motivation letter", "мотивациялық хат"],
    ["interview", "сұхбат"],
    ["entrance examination", "кіру емтиханы"],
    ["proof of English language proficiency", "ағылшын тілі деңгейін дәлелдеу"],
    ["English language test report", "ағылшын тілі тестінің нәтижесі"],
    ["upload", "жүктеңіз"],
    ["documents", "құжаттар"],
    ["document", "құжат"],
    ["if required", "қажет болса"],
    ["if applicable", "қолданылса"],
    ["high school", "жоғары сынып мектебі"],
    ["secondary school", "орта мектеп"],
    ["university", "университет"],
    ["academic", "академиялық"],
    ["results", "нәтижелер"],
    ["grade", "баға"],
    ["midyear", "аралық кезең"],
    ["final", "қорытынды"],
    ["expected", "күтілетін"],
    ["official", "ресми"],
    ["copy", "көшірме"],
    ["curriculum vitae", "резюме (CV)"],
    ["resume", "резюме"],
    ["language proficiency", "тіл деңгейі"],
    ["financial sponsor", "қаржылық демеуші"],
    ["enrollment certificate", "оқуға тіркелу анықтамасы"],
    ["registration form", "тіркеу формасы"],
    ["medical report", "медициналық есеп"],
    ["statement of criminal records or offence", "соттылық/құқық бұзушылық туралы мәлімдеме"],
    ["Upper secondary school-leaving certificate", "жоғары сыныпты аяқтау аттестаты"],
  ],
};

function replaceInsensitive(text, search, replacement) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), replacement);
}

export function translateAdmissionText(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  const lang = getCurrentLanguage();
  if (lang === "eng") return raw;
  const rules = ADMISSION_REPLACE[lang] || [];
  let out = raw;
  rules.forEach(([from, to]) => {
    out = replaceInsensitive(out, from, to);
  });
  return out;
}

export function translateTrackLabel(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  const lang = getCurrentLanguage();
  if (lang === "eng") return raw;

  const map = TRACK_LABELS[lang] || null;
  if (map) {
    const exact = map[keyify(raw)];
    if (exact) return exact;
  }

  let out = translateAdmissionText(raw, raw);
  const fallbackRules = TRACK_LABEL_FALLBACK_REPLACE[lang] || [];
  fallbackRules.forEach(([from, to]) => {
    out = replaceInsensitive(out, from, to);
  });
  return out;
}

export function translateProgramName(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "");
  const lang = getCurrentLanguage();
  if (lang === "eng") return raw;

  const map = PROGRAM_NAMES[lang] || null;
  if (!map) return raw;
  return map[keyify(raw)] || raw;
}
