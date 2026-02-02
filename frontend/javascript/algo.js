/* frontend/javascript/algo.js */

import { nested } from "./utils.js";

/**
 * Основная функция сортировки (AI Sort)
 * @param {Array} items - Список университетов
 * @param {Number} aiBalance - Значение слайдера (0 = Budget, 100 = Prestige)
 * @param {Object} filters - Состояние фильтров (нужно для фильтрации по бюджету)
 */
export function getUniSort(items, aiBalance, filters) {
    // 1. Сначала фильтруем (это важно, чтобы не сортировать мусор)
    // Если есть жесткие фильтры (например, userBudget), можно учесть их здесь или оставить как есть.
    
    // 2. Определяем веса
    // aiBalance идет от 0 до 100.
    // Если 100 -> PrestigeWeight = 1.0, BudgetWeight = 0.0
    // Если 0   -> PrestigeWeight = 0.0, BudgetWeight = 1.0
    const prestigeWeight = aiBalance / 100; 
    const budgetWeight = 1 - prestigeWeight;

    // 3. Находим мин/макс значения для нормализации
    let maxCost = 0;
    let minRank = 9999;
    let maxRank = 0;

    items.forEach(u => {
        const cost = getCost(u);
        const rank = u.rank || 200; // Если ранга нет, считаем его низким (200)
        if (cost > maxCost) maxCost = cost;
        if (rank < minRank) minRank = rank;
        if (rank > maxRank) maxRank = rank;
    });

    // Защита от деления на ноль
    if (maxCost === 0) maxCost = 1;
    if (maxRank === 0) maxRank = 200;

    // 4. Сортируем
    return items.sort((a, b) => {
        // --- ЭКСТРЕМАЛЬНЫЙ РЕЖИМ (ФИКС ДЛЯ ВАС) ---
        // Если слайдер > 80 (почти фулл престиж), сортируем ТУПО ПО РАНГУ
        if (aiBalance >= 80) {
            const rankA = a.rank || 999;
            const rankB = b.rank || 999;
            return rankA - rankB; // Меньше ранг = лучше (1 лучше 20)
        }
        
        // Если слайдер < 20 (почти фулл бюджет), сортируем ТУПО ПО ЦЕНЕ
        if (aiBalance <= 20) {
            const costA = getCost(a);
            const costB = getCost(b);
            return costA - costB; // Меньше цена = лучше
        }
        // -------------------------------------------

        // Обычный взвешенный режим (Mixed Mode)
        const scoreA = calculateScore(a, prestigeWeight, budgetWeight, maxRank, maxCost);
        const scoreB = calculateScore(b, prestigeWeight, budgetWeight, maxRank, maxCost);

        return scoreB - scoreA; // Больше очков = выше в списке
    });
}

// Вспомогательная: Достаем цену
function getCost(u) {
    // Пробуем найти минимальную цену среди треков, иначе берем общую
    if (u.admission_tracks && u.admission_tracks.length > 0) {
        const prices = u.admission_tracks.map(t => t.finance_override?.total_cost_year_usd || u.finance?.total_cost_year_usd || 0).filter(p => p > 0);
        if (prices.length > 0) return Math.min(...prices);
    }
    return nested(u, ["finance", "total_cost_year_usd"], 0);
}

// Вспомогательная: Считаем очки (0.0 - 1.0)
function calculateScore(u, pWeight, bWeight, maxRank, maxCost) {
    const rank = u.rank || 200;
    const cost = getCost(u);

    // Нормализация (чем меньше ранг, тем выше очки)
    // 1 место = 1.0, 200 место = 0.0
    const rankScore = 1 - (rank / 200); 

    // Нормализация цены (чем меньше цена, тем выше очки)
    // $0 = 1.0, MaxCost = 0.0
    const costScore = 1 - (cost / maxCost);

    // Итоговая формула
    return (rankScore * pWeight) + (costScore * bWeight);
}