import { escapeHtml, escapeHtmlAttr, markMotionEnter, motionPress } from "../../utils.js";
import { heroIcon } from "../../icons.js";
import { t } from "../../i18n.js";
import { translateAdmissionText } from "../../university-translations.js";
import { mountDeadlineCalendar } from "./deadline-calendar-view.js";
import { trStudyLevel, trTrackLabel } from "../_shared.js";
import {
  GENERAL_PROGRAM_KEY,
  admissionStudyLevelSelectionByUniversity,
  applicantRouteLabel,
  categoryIsMba,
  cycleMatches,
  getAdmissionContextProfile,
  getAvailableStudyLevels,
  getCategoryLevelsList,
  localizeDeadlineCycle,
  localizeDeadlineDate,
  normalizeLevelKey,
  safeHttpUrl,
  selectedAdmissionContext,
  updateAdmissionUrl,
} from "./section-context.js";

const deadlineCalendarStateByUniversity = new Map();

export function extractUniversityDeadlines(university, categories) {
  const items = [];
  const seenKeys = new Set();

  const addRound = (round) => {
    const key = round.publicationStatus === "conflicting" && round.id
      ? `${round.level}:${round.id}`
      : `${round.level}:${round.title}:${round.deadline}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    items.push(round);
  };

  if (university?.deadlines && typeof university.deadlines === "object") {
    const d = university.deadlines;
    if (d.undergraduate && typeof d.undergraduate === "object") {
      const ug = d.undergraduate;
      addRound({
        level: "Bachelor",
        levelKey: "bachelor",
        title: t("university.deadlines.undergraduate_ucas", "Undergraduate (UCAS)"),
        cycle: ug.cycle || ug.academic_year || "",
        scope: ug.scope || "Undergraduate",
        sourceUrl: safeHttpUrl(ug.source_url),
        deadline: ug.application_deadline || "",
        notification: ug.decision_release_date || "",
        portal: ug.application_portal || "",
        fee: ug.application_fee_gbp ? `£${ug.application_fee_gbp}` : "",
        notes: ug.interview_period ? `${t("university.deadlines.interviews_label", "Interviews")}: ${ug.interview_period}` : "",
      });
    }
    if (d.graduate_taught_masters && typeof d.graduate_taught_masters === "object") {
      const gt = d.graduate_taught_masters;
      if (gt.scholarship_deadline_guidance) addRound({
        level: "Master", levelKey: "master", title: t("university.deadlines.graduate_guidance_title", "Graduate deadline guidance"),
        cycle: gt.cycle || gt.academic_year || "", scope: gt.scope || "Graduate taught courses",
        sourceUrl: safeHttpUrl(gt.source_url), guidance: true,
        notes: t("university.deadlines.guidance_course_dependent", "Deadlines vary by course. Check the course page for its exact date."),
      });
      addRound({
        level: "Master",
        levelKey: "master",
        title: t("university.deadlines.postgraduate_taught", "Postgraduate taught courses"),
        cycle: gt.cycle || gt.academic_year || "",
        scope: gt.scope || "",
        sourceUrl: safeHttpUrl(gt.source_url),
        deadline: gt.main_january_scholarship_deadline || gt.early_december_deadline || "",
        portal: gt.application_portal || "",
        fee: gt.application_fee_gbp ? `£${gt.application_fee_gbp}` : "",
        notes: "",
      });
      (Array.isArray(gt.mba_rounds) ? gt.mba_rounds : []).forEach((round) => addRound({
        level: "MBA", levelKey: "mba", title: `${t("university.deadlines.mba_round", "MBA application round")} ${round.stage || ""}`.trim(),
        cycle: round.cycle || gt.cycle || "", scope: round.scope || "MBA",
        sourceUrl: safeHttpUrl(round.source_url || gt.source_url), deadline: round.deadline || "", notes: "",
      }));
    }
    if (d.graduate_research_dphil && typeof d.graduate_research_dphil === "object") {
      const gr = d.graduate_research_dphil;
      if (gr.scholarship_deadline_guidance) addRound({
        level: "PhD", levelKey: "doctorate", title: t("university.deadlines.graduate_guidance_title", "Graduate deadline guidance"),
        cycle: gr.cycle || gr.academic_year || "", scope: gr.scope || "Research graduate courses",
        sourceUrl: safeHttpUrl(gr.source_url), guidance: true,
        notes: t("university.deadlines.guidance_course_dependent", "Deadlines vary by course. Check the course page for its exact date."),
      });
      addRound({
        level: "PhD",
        levelKey: "doctorate",
        title: t("university.deadlines.doctoral_research", "Doctoral research courses"),
        cycle: gr.cycle || gr.academic_year || "",
        scope: gr.scope || "",
        sourceUrl: safeHttpUrl(gr.source_url),
        deadline: gr.main_scholarship_deadline || "",
        portal: gr.application_portal || "",
        notes: "",
      });
    }
  }

  if (Array.isArray(categories)) {
    categories.forEach((cat) => {
      const catLabel = trTrackLabel(cat.label || cat.name || "");
      const levels = getCategoryLevelsList(cat);
      const levelDisplay = categoryIsMba(cat) ? "MBA" : (levels[0] || "General");
      const levelKey = normalizeLevelKey(levelDisplay);
      const portal = cat.application_portal || (Array.isArray(cat.application_portals) ? cat.application_portals[0] : "");
      let fee = "";
      if (typeof cat.application_fee === "string") {
        fee = cat.application_fee;
      } else if (cat.application_fee && typeof cat.application_fee === "object") {
        fee = cat.application_fee.amount ? `${cat.application_fee.currency || "$"}${cat.application_fee.amount}` : "";
      } else if (cat.application_fee_usd) {
        fee = `$${cat.application_fee_usd}`;
      }
      const waiver = Boolean(cat.fee_waiver_available || cat.fee_waiver_policy || (cat.application_fee && typeof cat.application_fee === "object" && cat.application_fee.waiver_available));

      if (Array.isArray(cat.admission_rounds) && cat.admission_rounds.length) {
        cat.admission_rounds.forEach((r) => {
          addRound({
            level: levelDisplay,
            levelKey,
            title: `${catLabel}: ${r.name || r.id}`,
            cycle: r.cycle || cat.cycle || cat.academic_year || "",
            applicantRoute: cat.applicant_route || "",
            scope: r.scope || cat.scope || levelDisplay,
            sourceUrl: safeHttpUrl(r.source_url || cat.source_url),
            approximate: r.approximate === true || r.is_approximate === true,
            deadline: r.deadline || "",
            notification: r.notification || "",
            replyDeadline: r.reply_deadline || "",
            portal,
            fee,
            waiver,
            notes: r.description || "",
          });
        });
      }

      if (Array.isArray(cat.deadlines) && cat.deadlines.length) {
        cat.deadlines.forEach((dl) => {
          const eventNames = {
            course_application: t("university.deadlines.event.application", "Application"),
            standardized_test: t("university.deadlines.event.test", "Test scores"),
            aid_application: t("university.deadlines.event.aid", "Financial aid"),
            equal_consideration: t("university.deadlines.event.equal_consideration", "Equal consideration"),
          };
          const roundName = eventNames[dl.deadline_type] || translateAdmissionText(dl.round, dl.round) || catLabel;
          const dlDate = dl.application_deadline || dl.date || "";
          addRound({
            id: dl.id || "",
            level: levelDisplay,
            levelKey,
            title: `${catLabel} (${roundName})`,
            cycle: dl.cycle || cat.cycle || cat.academic_year || "",
            applicantRoute: cat.applicant_route || "",
            applicantCategory: dl.applicant_category || "",
            applicantCategoryLabel: dl.applicant_category_label || "",
            applicabilityLabel: dl.applicability_label || "",
            scope: dl.scope || cat.scope || levelDisplay,
            sourceUrl: safeHttpUrl(dl.source_url || cat.source_url),
            conflictingSourceUrl: safeHttpUrl(dl.conflicting_source_url),
            publicationStatus: dl.publication_status || "",
            approximate: dl.approximate === true || dl.is_approximate === true,
            deadline: dlDate,
            time: dl.time || "",
            timezone: dl.timezone || "",
            notification: dl.decision_notification || "",
            aidDeadline: dl.financial_aid_deadline || "",
            replyDeadline: dl.reply_deadline || "",
            portal,
            fee,
            waiver,
            notes: dl.notes || dl.note || (dl.time_uk ? `${t("university.deadlines.time_label", "Time")}: ${dl.time_uk} UK` : ""),
          });
        });
      }

      if (cat.application_deadline && !cat.admission_rounds?.length && !cat.deadlines?.length) {
        addRound({
          level: levelDisplay,
          levelKey,
          title: catLabel,
          cycle: cat.cycle || cat.academic_year || university?.finance?.academic_year || "",
          applicantRoute: cat.applicant_route || "",
          deadline: cat.application_deadline,
          notification: cat.decision_notification || "",
          aidDeadline: cat.financial_aid_deadline || "",
          portal,
          fee,
          waiver,
          notes: cat.degree_level || "",
          scope: cat.scope || levelDisplay,
          sourceUrl: safeHttpUrl(cat.source_url),
          approximate: cat.approximate === true || cat.is_approximate === true,
        });
      }
    });
  }

  return items;
}

export function renderDeadlinesTabSection({ container, university, onContextChange }) {
  if (!container) return;
  const universityId = String(university.id || "").trim();
  const admissionContext = selectedAdmissionContext(university, getAdmissionContextProfile(university));
  const hasProgramSelection = admissionContext.selectedProgram !== GENERAL_PROGRAM_KEY;
  const deadlineCategories = admissionContext.visibleCategories;
  const allDeadlines = extractUniversityDeadlines(university, deadlineCategories)
    .filter((item) => !admissionContext.cycle || !item.cycle || cycleMatches(item.cycle, admissionContext.cycle) !== false);
  if (hasProgramSelection && !deadlineCategories.length) {
    container.innerHTML = `<div class="admission-empty-state">${escapeHtml(t("university.deadlines.program_not_reviewed", "Deadline details have not been reviewed for this program."))}</div>`;
    return;
  }
  if (!allDeadlines.some((item) => item.deadline || item.guidance)) {
    container.innerHTML = `<div data-deadline-calendar-host></div><div class="admission-empty-state">${escapeHtml(t("university.ux2.deadlines.not_collected"))}</div>`;
    mountDeadlineCalendar(container.querySelector("[data-deadline-calendar-host]"), []);
    return;
  }

  const availableLevels = getAvailableStudyLevels(deadlineCategories);
  const activeLevel = admissionContext.selectedLevel || "all";

  const filtered = activeLevel === "all"
    ? allDeadlines
    : allDeadlines.filter((d) => d.levelKey === activeLevel || d.levelKey === "general");

  const filteredDeadlines = filtered.filter((item) => item.deadline || ["conflicting", "not_yet_published", "unknown"].includes(item.publicationStatus));
  const filteredGuidance = filtered.filter((item) => item.guidance);
  const milestones = filteredDeadlines.filter((item) => item.deadline).map((item, index) => ({
    step: index + 1,
    phase: trStudyLevel(item.level),
    date: item.deadline,
    title: item.title,
    desc: item.notes || "",
  }));
  const calendarIcon = heroIcon("calendar", "ui-icon ui-icon--18");

  const levelFilterHtml = availableLevels.length > 1 && !hasProgramSelection ? `
    <div class="admissions-level-filter" role="group" aria-label="${escapeHtmlAttr(t("university.deadlines.filter_by_level", "Filter deadlines by degree level"))}">
      <button
        type="button"
        class="admissions-level-tab${activeLevel === "all" ? " is-active" : ""}"
        data-deadlines-level="all"
      >${escapeHtml(t("university.deadlines.all_levels", "All Degrees"))} (${allDeadlines.length})</button>
      ${availableLevels.map((lvl) => {
        const count = allDeadlines.filter((d) => d.levelKey === lvl.key).length;
        if (!count) return "";
        return `
          <button
            type="button"
            class="admissions-level-tab${activeLevel === lvl.key ? " is-active" : ""}"
            data-deadlines-level="${escapeHtmlAttr(lvl.key)}"
          >${escapeHtml(lvl.label)} (${count})</button>
        `;
      }).join("")}
    </div>
  ` : "";

  const timelineHtml = milestones.length ? `
    <div class="deadlines-timeline-wrapper">
      <div class="deadlines-timeline-head">
        <h4 class="deadlines-timeline-title">
          ${calendarIcon}
          <span>${escapeHtml(t("university.deadlines.timeline_title", "Admissions Timeline"))}</span>
        </h4>
      </div>
      <div class="deadlines-timeline" role="list">
        ${milestones.map((m) => `
          <div class="timeline-milestone" role="listitem">
            <div class="timeline-milestone-head">
              <span class="timeline-milestone-step">${m.step}</span>
              <span class="timeline-milestone-phase">${escapeHtml(m.phase)}</span>
            </div>
            <div class="timeline-milestone-date">${escapeHtml(m.date)}</div>
            <div class="timeline-milestone-title">${escapeHtml(m.title)}</div>
            <p class="timeline-milestone-desc">${escapeHtml(m.desc)}</p>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const guidanceHtml = filteredGuidance.length ? `
    <div class="deadline-guidance-list" aria-label="${escapeHtmlAttr(t("university.deadlines.guidance_title", "Admissions guidance"))}">
      ${filteredGuidance.map((item) => `<article class="deadline-guidance-item"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.notes)}</p>${item.scope ? `<span>${escapeHtml(item.scope)}</span>` : ""}${item.cycle ? `<span>${escapeHtml(t("university.admissions.cycle_label", "Cycle"))}: ${escapeHtml(item.cycle)}</span>` : ""}${item.sourceUrl ? `<a href="${escapeHtmlAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.deadlines.official_source", "Official source"))}</a>` : ""}</article>`).join("")}
    </div>
  ` : "";

  const cardsHtml = filteredDeadlines.length ? `
    <div class="admissions-deadlines-grid">
      ${filteredDeadlines.map((item, index) => {
        const feeStr = item.fee ? escapeHtml(String(item.fee)) : "";
        const waiverStr = item.waiver ? `<span class="admissions-fee-waiver">${escapeHtml(t("university.admissions.fee_waiver_available", "Fee waiver available"))}</span>` : "";
        const conflicting = item.publicationStatus === "conflicting";
        const publicationStatus = conflicting
          ? t("university.program_coverage.deadline_conflicting", "Official deadline information conflicts")
          : item.publicationStatus === "not_yet_published"
            ? t("university.program_coverage.deadline_not_published", "Not yet published by the university")
            : t("university.program_coverage.not_catalogued", "Not catalogued");
        const nextAction = conflicting
          ? t("university.program_coverage.next_action.deadline_conflicting", "Compare the official admissions pages and confirm the applicable deadline with the university.")
          : item.publicationStatus === "not_yet_published"
            ? t("university.program_coverage.next_action.deadline_not_published", "Check the official admissions page for updates to the deadline.")
            : t("university.program_coverage.next_action.deadline", "Confirm the course application deadline and entry year on the official admissions page.");
        return `
          <article class="admissions-deadline-item" id="deadline-card-${index}">
            <div class="admissions-deadline-item-head">
              <span class="admissions-deadline-level">${escapeHtml(trStudyLevel(item.level))}</span>
              ${item.portal ? `<span class="admissions-deadline-portal" title="${escapeHtmlAttr(item.portal)}">${escapeHtml(item.portal)}</span>` : ""}
            </div>
            <h4 class="admissions-deadline-name">${escapeHtml(item.title)}</h4>
            <div class="admissions-deadline-scope">${escapeHtml(t("university.admissions.route_label", "Applicant route"))}: ${escapeHtml(applicantRouteLabel(item.applicantRoute))}</div>
            ${item.applicantCategoryLabel ? `<div class="admissions-deadline-scope">${escapeHtml(t("university.deadlines.applicant_restriction", "Applicant restriction"))}: ${escapeHtml(item.applicantCategory === "us_citizen_or_permanent_resident_transfer" ? t("university.deadlines.us_citizen_permanent_resident_only", "U.S. citizens and U.S. permanent residents only") : item.applicantCategoryLabel)}</div>` : ""}
            ${item.applicabilityLabel ? `<div class="admissions-deadline-scope">${escapeHtml(t("university.deadlines.applicability", "Applies to"))}: ${escapeHtml(item.applicabilityLabel === "Spring entry only" ? t("university.deadlines.spring_entry_only", "Spring entry only") : item.applicabilityLabel)}</div>` : ""}
            ${item.cycle ? `<div class="admissions-deadline-cycle">${escapeHtml(t("university.admissions.cycle_label", "Cycle"))}: ${escapeHtml(localizeDeadlineCycle(item.cycle))}</div>` : ""}
            ${item.scope ? `<div class="admissions-deadline-scope">${escapeHtml(item.scope)}</div>` : ""}
            ${item.deadline ? `
              <div class="admissions-deadline-row admissions-deadline-row--primary">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.deadline_label", "Deadline"))}:</span>
                <strong class="admissions-deadline-date">${escapeHtml(localizeDeadlineDate(item.deadline))}</strong>
              </div>
            ` : `<p class="admissions-deadline-publication-status">${escapeHtml(publicationStatus)}</p>
              <p class="admissions-deadline-notes">${escapeHtml(nextAction)}</p>`}
            ${item.time ? `<div class="admissions-deadline-row admissions-deadline-time"><span class="admissions-deadline-label">${escapeHtml(t("university.deadlines.time_label", "Time"))}:</span><span>${escapeHtml(item.time)}${item.timezone ? ` ${escapeHtml(item.timezone)}` : ""}</span></div>` : ""}
            ${item.notification ? `
              <div class="admissions-deadline-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.notification_label", "Notification"))}:</span>
                <span>${escapeHtml(localizeDeadlineCycle(item.notification))}</span>
              </div>
            ` : ""}
            ${item.aidDeadline ? `
              <div class="admissions-deadline-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.aid_deadline_label", "Financial aid deadline"))}:</span>
                <span>${escapeHtml(localizeDeadlineDate(item.aidDeadline))}</span>
              </div>
            ` : ""}
            ${item.replyDeadline ? `
              <div class="admissions-deadline-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.reply_label", "Reply by"))}:</span>
                <span>${escapeHtml(item.replyDeadline)}</span>
              </div>
            ` : ""}
            ${feeStr ? `
              <div class="admissions-deadline-row admissions-deadline-fee-row">
                <span class="admissions-deadline-label">${escapeHtml(t("university.admissions.portal_fee_label", "Fee"))}:</span>
                <span>${feeStr} ${waiverStr}</span>
              </div>
            ` : ""}
            ${item.notes ? `<p class="admissions-deadline-notes">${escapeHtml(item.notes)}</p>` : ""}
            ${item.sourceUrl ? `<a class="admissions-deadline-source" href="${escapeHtmlAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.deadlines.official_source", "Official source"))}</a>` : ""}
            ${item.conflictingSourceUrl ? `<a class="admissions-deadline-source" href="${escapeHtmlAttr(item.conflictingSourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("university.program_coverage.source", "Official source"))}</a>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  ` : `<div class="admission-empty-state">${escapeHtml(t("university.deadlines.none_for_level", "No published deadlines for this study level."))}</div>`;

  const calendarHtml = '<div data-deadline-calendar-host></div>';
  container.innerHTML = `${levelFilterHtml}${calendarHtml}${guidanceHtml}${timelineHtml}${cardsHtml}`;

  container.querySelectorAll("[data-deadlines-level]").forEach((btn) => {
    btn.addEventListener("click", () => {
      motionPress(btn);
      const lvl = btn.getAttribute("data-deadlines-level") || "all";
      admissionStudyLevelSelectionByUniversity.set(universityId, lvl);
      updateAdmissionUrl({ level: lvl, route: "", cycle: "" });
      deadlineCalendarStateByUniversity.delete(universityId);
      onContextChange?.();
      renderDeadlinesTabSection({ container, university });
    });
  });

  const calendarState = deadlineCalendarStateByUniversity.get(universityId) || {};
  deadlineCalendarStateByUniversity.set(universityId, calendarState);
  mountDeadlineCalendar(container.querySelector("[data-deadline-calendar-host]"), filteredDeadlines, calendarState);

  markMotionEnter(container, ".timeline-milestone, .admissions-deadline-item", { limit: 16, staggerMs: 18 });
}
