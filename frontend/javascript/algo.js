/* 3. algo.js - Алгоритмы сортировки и ИИ */
import { loadProfile } from "./utils.js";

const SCALES = { "GPA": 100, "IELTS": 9.0, "TOEFL": 120, "SAT": 1600, "ACT": 36 };

function normalizeScore(examName, score) {
    const max = SCALES[examName.toUpperCase()] || 100;
    return Math.min(Math.max(score / max, 0), 1);
}

// 1. Prestige (50% Rank + 50% Difficulty)
function calculatePrestigeScore(u) {
    let diffScore = 0;
    let count = 0;
    
    // A. Сложность (Acceptance + Min Exams)
    const ar = u?.academics?.acceptance_rate_percent;
    if (ar !== undefined && !isNaN(ar)) {
        diffScore += (100 - ar) / 100; 
        count++;
    }

    // Средние баллы (Avg)
    const avgs = u?.exams_avg || {};
    for (const [key, val] of Object.entries(avgs)) {
        const norm = normalizeScore(key, val);
        if (norm > 0) { diffScore += norm; count++; }
    }
    
    const difficulty = count === 0 ? 0.5 : (diffScore / count);

    // B. Мировой рейтинг (World Rank)
    const rank = u.rank || 1000; 
    let rankScore = 0;
    if (rank <= 100) {
        rankScore = 1.0 - (rank * 0.005); 
    } else {
        rankScore = Math.max(0, 0.5 - ((rank - 100) * 0.0005));
    }

    return (difficulty * 0) + (rankScore * 1);
    // Пока что игнорируй наш алгоритм, учитываем только из ранкинга престижность
}

// 2. Eligibility (Multiplier)
function calculateEligibilityMultiplier(u, userExams) {
    if (!userExams || Object.keys(userExams).length === 0) return 1.0; 

    const mins = u?.exams_min || {};
    const avgs = u?.exams_avg || {};
    let isFail = false;
    let isExcellent = false;

    for (const [exam, minVal] of Object.entries(mins)) {
        const userVal = userExams[exam.toUpperCase()];
        if (userVal !== undefined) {
            if (userVal < minVal) isFail = true;
            const avgVal = avgs[exam] || avgs[exam.toLowerCase()];
            if (avgVal && userVal >= avgVal) {
                isExcellent = true;
            }
        }
    }

    if (isFail) return 0.05; 
    if (isExcellent) return 1.2; 
    return 1.0; 
}

// 3. Budget Score (0..1)
function calculateBudgetScore(u, userBudget, balance) {
    const cost = u?.finance?.total_cost_year_usd || 0;
    const fa = u?.finance?.financial_aid || {};
    const hasAid = fa.merit_based || fa.need_based;

    if (!userBudget || userBudget <= 0) return 1.0;

    if (cost <= userBudget) {
        const utilization = cost / userBudget; 
        return 0.6 + (0.4 * utilization); 
    }

    const overflow = (cost - userBudget) / userBudget; 
    let penalty = overflow; 
    if (hasAid) penalty *= 0.5; 

    const strictness = 1.0 - balance; 
    let score = 1.0 - (penalty * strictness * 3.0); 
    
    return Math.max(0, score);
}

// Главная функция сортировки
function getUniSort(universities, balance0to100) {
    const profile = loadProfile(); // Берется из utils.js
    const userBudget = parseFloat(profile.budget);
    const userExams = {};
    
    if (profile.exams && Array.isArray(profile.exams)) {
        profile.exams.forEach(e => {
            if (e.exam && e.score) userExams[e.exam.toUpperCase()] = parseFloat(e.score);
        });
    }

    const balance = balance0to100 / 100; 

    const scored = universities.map(u => {
        const prestige = calculatePrestigeScore(u);
        const budgetScore = calculateBudgetScore(u, userBudget, balance);
        const eligibility = calculateEligibilityMultiplier(u, userExams);

        const weightedScore = (prestige * balance) + (budgetScore * (1 - balance));
        const finalScore = weightedScore * eligibility;

        return { uni: u, score: finalScore };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(x => x.uni);
}

export { getUniSort };
