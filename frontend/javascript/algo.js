/* frontend/javascript/algo.js */
import { loadProfile, EXAM_CONFIG } from "./utils.js";

// --- Вспомогательные функции ---

function checkRequirements(reqs, userScores) {
    if (!reqs) return true;
    for (const [exam, minVal] of Object.entries(reqs)) {
        const userVal = userScores[exam.toUpperCase()];
        // 🔥 FIX: Если у юзера нет баллов, считаем, что он "пока проходит" (чтобы не скрывать вуз)
        // Но можно давать штраф в скоринге, а не удалять.
        if (userVal === undefined || userVal === null || isNaN(userVal)) return true; 
        
        if (userVal < minVal) return false;
    }
    return true;
}

function calculateTrackScore(track, userScores) {
    let totalRatio = 0;
    let count = 0;
    const avgs = track.stats_avg || {};

    for (const [exam, avgVal] of Object.entries(avgs)) {
        const userVal = userScores[exam.toUpperCase()];
        if (userVal !== undefined && avgVal > 0) {
            totalRatio += (userVal / avgVal);
            count++;
        }
    }
    return count > 0 ? (totalRatio / count) : 1.0;
}

function evaluateUniversity(uni, userProfile, filters = {}) {
    // 1. Подготовка баллов
    const userScores = {};
    if (userProfile.exams) {
        userProfile.exams.forEach(e => {
            if (e.exam && e.score) userScores[e.exam.toUpperCase()] = parseFloat(e.score);
        });
    }
    
    // 🔥 FIX: Если профиль пустой, создаем "средний" профиль, чтобы алгоритм работал
    const isEmptyProfile = Object.keys(userScores).length === 0;
    if (isEmptyProfile) {
        userScores['GPA'] = 3.0; // Дефолт
    }

    const userStudyMode = userProfile.studyMode || "Any";
    const targetMajor = userProfile.major || "";

    let bestOption = null;
    let maxScore = -1;

    // 2. Бежим по сценариям
    // 🔥 FIX: Если треков нет, создаем "виртуальный" дефолтный трек
    let tracks = uni.admission_tracks || [];
    if (tracks.length === 0) {
        tracks = [{ 
            label: "General Admission", 
            study_mode: "On-campus", 
            requirements: {} // Нет требований
        }];
    }
    
    for (const track of tracks) {
        const trackMode = track.study_mode || "On-campus";
        if (userStudyMode !== "Any" && trackMode !== userStudyMode) continue;

        if (targetMajor && track.applicable_majors && track.applicable_majors.length > 0) {
            const isMatch = track.applicable_majors.some(m => 
                targetMajor.toLowerCase().includes(m.toLowerCase()) || 
                m.toLowerCase().includes(targetMajor.toLowerCase())
            );
            if (!isMatch) continue;
        }

        // Если не прошли требования, то в "строгом" режиме пропускаем.
        // Но давай лучше просто уменьшим Score, чтобы вуз не исчезал.
        const passedReqs = checkRequirements(track.requirements, userScores);
        
        let currentScore = calculateTrackScore(track, userScores);
        if (!passedReqs) currentScore *= 0.5; // Штраф 50% если не проходим

        let grantName = null;
        if (track.scholarships) {
            for (const grant of track.scholarships) {
                // То же самое для грантов - мягкая проверка
                if (checkRequirements(grant.requirements, userScores)) {
                    grantName = grant.name;
                    currentScore += 0.5;
                    break;
                }
            }
        }

        if (currentScore > maxScore) {
            maxScore = currentScore;
            
            const basePrice = track.finance_override 
                ? track.finance_override.total_cost_year_usd 
                : (uni.finance ? uni.finance.total_cost_year_usd : 0);

            bestOption = {
                trackLabel: track.label,
                score: currentScore,
                grantName: grantName,
                finalPrice: basePrice,
                studyMode: trackMode,
                passed: passedReqs // Запоминаем, прошли ли реально
            };
        }
    }

    // 🔥 FIX: Даже если bestOption null (совсем все плохо), возвращаем хоть что-то
    if (!bestOption) {
        bestOption = {
            trackLabel: "General",
            score: 0.1, // Очень низкий скор, будет в конце списка
            finalPrice: uni.finance ? uni.finance.total_cost_year_usd : 0,
            passed: false
        };
    }

    return {
        uni: uni,
        match: bestOption
    };
}

export function getUniSort(universities, balance0to100, filters = {}) {
    // 🔥 FIX: Добавлена проверка на пустоту
    if (!universities || universities.length === 0) return [];

    const profile = loadProfile();
    
    // 1. Оцениваем
    const results = universities.map(u => evaluateUniversity(u, profile, filters));

    // 2. Сортировка
    const balance = balance0to100 / 100; 
    const userBudget = parseFloat(profile.budget) || 10000000;

    results.sort((a, b) => {
        // Логика та же, но теперь у нас нет null в массиве results
        const rankA = a.uni.rank || 999;
        const rankB = b.uni.rank || 999;
        const scorePrestigeA = Math.max(0, 1 - (rankA / 500)); 
        const scorePrestigeB = Math.max(0, 1 - (rankB / 500));

        const costA = a.match.finalPrice || 50000;
        const costB = b.match.finalPrice || 50000;
        
        let scoreBudgetA = costA <= userBudget ? 1 : Math.max(0, 1 - (costA - userBudget) / userBudget);
        let scoreBudgetB = costB <= userBudget ? 1 : Math.max(0, 1 - (costB - userBudget) / userBudget);
        
        // Добавляем ROI (Окупаемость)
        const roiA = a.match.roiScore || 1; // Если нет, берем 1
        const roiB = b.match.roiScore || 1;

        const fitA = a.match.score;
        const fitB = b.match.score;

        const totalA = (scorePrestigeA * balance + scoreBudgetA * (1 - balance)) * fitA;
        const totalB = (scorePrestigeB * balance + scoreBudgetB * (1 - balance)) * fitB;

        return totalB - totalA;
    });

    return results.map(res => {
        const u = res.uni;
        u.matchData = res.match;
        
        // 🔥 FIX: Досчитываем ROI для отображения (если его не было в evaluate)
        if (!u.matchData.roiScore) {
             const salary = u.outcomes?.average_early_career_salary_usd || 40000;
             const price = u.matchData.finalPrice || 1;
             u.matchData.roiScore = parseFloat((salary / price).toFixed(2));
        }
        
        return u;
    });
}