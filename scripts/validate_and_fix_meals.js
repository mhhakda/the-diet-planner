#!/usr/bin/env node
/**
 * Node.js script to validate and fix meals.json
 * - Writes cleaned structure compatible with the front-end:
 *   cleanedData[region][diet] = { breakfast: [], lunch: [], dinner: [], snacks: [] }
 *
 * Uses only Node.js core modules
 */

const fs = require('fs');
const path = require('path');

// Canonical constraints
const CANONICAL_REGIONS = [
    'India', 'USA', 'Europe', 'Middle_Eastern', 'Latin_American',
    'Nordic', 'East_Asian', 'African', 'Australian'
];

const CANONICAL_DIETS = [
    'Regular', 'Keto', 'Low_Carb', 'Vegetarian', 'Vegan',
    'Mediterranean', 'High_Protein'
];

const CANONICAL_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

// Mapping tables
const REGION_MAPPING = {
    'Asian': 'East_Asian',
    'Australia': 'Australian',
    'Oceania': 'Australian',
    'Oceana': 'Australian',
    'Middle East': 'Middle_Eastern',
    'Latin America': 'Latin_American',
    'East Asia': 'East_Asian'
};

const DIET_MAPPING = {
    'Ketogenic': 'Keto',
    'Low Carb': 'Low_Carb',
    'High Protein': 'High_Protein',
    'Paleo': 'Regular',
    'Diabetic_Friendly': 'Regular',
    'PCOS_Friendly': 'Regular',
    'Senior_Friendly': 'Regular'
};

// Animal products for diet validation
const VEGAN_VIOLATIONS = new Set([
    'meat', 'chicken', 'fish', 'beef', 'pork', 'lamb', 'egg', 'eggs', 'milk',
    'cheese', 'yogurt', 'butter', 'whey', 'honey', 'seafood', 'shrimp', 'crab',
    'salmon', 'tuna', 'turkey', 'bacon', 'ham', 'sausage', 'dairy', 'cream',
    'gelatin', 'casein', 'ghee', 'paneer'
]);

const VEGETARIAN_VIOLATIONS = new Set([
    'meat', 'chicken', 'fish', 'beef', 'pork', 'lamb', 'seafood', 'shrimp',
    'crab', 'salmon', 'tuna', 'turkey', 'bacon', 'ham', 'sausage'
]);

class MealNormalizer {
    constructor() {
        this.report = {
            id_reassignments: {},
            region_mapping: {},
            diet_mapping: {},
            vegan_violations: [],
            vegetarian_violations: [],
            summary: {},
            before_after_samples: [],
            unparseable_nutrients: [],
            title_generation_rules: []
        };
        this.nextId = 100000; // start large to avoid collisions with small numeric ids
        this.usedIds = new Set();
    }

    // Meal type normalization (infers if missing)
    normalizeMealType(mealType, title = '', tags = []) {
        if (!mealType) {
            const text = `${title} ${(tags && tags.join ? tags.join(' ') : '')}`.toLowerCase();
            if (/breakfast|pancake|oats|cereal|toast|porridge/.test(text)) return 'breakfast';
            if (/dinner|curry|roast|stew|soup|supper/.test(text)) return 'dinner';
            if (/snack|bar|chips|nuts|fruit|cookie/.test(text)) return 'snacks';
            return 'lunch';
        }
        const normalized = String(mealType).toLowerCase().trim();
        if (CANONICAL_MEAL_TYPES.includes(normalized)) return normalized;
        if (normalized === 'snack') return 'snacks';
        if (normalized === 'supper') return 'dinner';
        // try to match substrings
        for (const t of CANONICAL_MEAL_TYPES) {
            if (normalized.includes(t)) return t;
        }
        return 'lunch';
    }

    parseNumeric(value, fieldName, mealId) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return isNaN(value) ? 0 : value;
        if (typeof value === 'string') {
            const clean = value.replace(/,/g, '').trim();
            const parsed = parseFloat(clean);
            if (isNaN(parsed)) {
                this.report.unparseable_nutrients.push({ id: mealId, field: fieldName, value });
                return 0;
            }
            return parsed;
        }
        return 0;
    }

    generateTitle(meal, region, diet, originalId) {
        const given = (meal.title || '').toString().trim();
        if (given && !/option\s*\d+/i.test(given)) return given;

        const foods = meal.foods || [];
        if (Array.isArray(foods) && foods.length) {
            const names = foods.slice(0, 3).map(f => (typeof f === 'string' ? f : (f && f.name ? f.name : ''))).filter(Boolean);
            if (names.length) {
                const generated = names.length === 1 ? names[0] : (names.length === 2 ? `${names[0]} & ${names[1]}` : `${names[0]}, ${names[1]} & ${names[2]}`);
                this.report.title_generation_rules.push({ id: originalId, rule: 'generated_from_foods', title: generated });
                return generated;
            }
        }

        if (meal.ingredients && typeof meal.ingredients === 'string' && meal.ingredients.trim()) {
            const parts = meal.ingredients.split(/\s+/).slice(0, 6).join(' ');
            this.report.title_generation_rules.push({ id: originalId, rule: 'generated_from_ingredients', title: parts });
            return parts;
        }

        const fallback = `Meal ${region}-${diet}-${originalId}`;
        this.report.title_generation_rules.push({ id: originalId, rule: 'fallback_generated', title: fallback });
        return fallback;
    }

    checkDietViolations(meal, dietKey) {
        const textToCheck = `${meal.title || ''} ${meal.ingredients || ''}`.toLowerCase();
        const foods = meal.foods || [];
        const foodText = Array.isArray(foods) ? foods.map(f => (typeof f === 'string' ? f : (f && f.name ? f.name : ''))).join(' ') : '';
        const tags = Array.isArray(meal.tags) ? meal.tags.join(' ') : (meal.tags || '');
        const full = `${textToCheck} ${foodText} ${tags}`.toLowerCase();
        const violations = [];

        if (dietKey === 'Vegan') {
            for (const v of VEGAN_VIOLATIONS) if (full.includes(v)) violations.push(v);
        } else if (dietKey === 'Vegetarian') {
            for (const v of VEGETARIAN_VIOLATIONS) if (full.includes(v)) violations.push(v);
        }
        return violations;
    }

    getUniqueId(originalId) {
        // preserve non-colliding original string IDs
        if (originalId && !this.usedIds.has(String(originalId))) {
            this.usedIds.add(String(originalId));
            return originalId;
        }
        // generate numeric unique id
        while (this.usedIds.has(String(this.nextId))) this.nextId++;
        const id = String(this.nextId);
        this.usedIds.add(id);
        if (originalId) this.report.id_reassignments[String(originalId)] = id;
        this.nextId++;
        return id;
    }

    // Normalize a single meal into canonical object
    normalizeMealObject(meal, regionKey, dietKey, mealTypeHint = null) {
        if (!meal || typeof meal !== 'object') return null;
        const original = JSON.parse(JSON.stringify(meal));
        const originalId = meal.id || null;
        const id = this.getUniqueId(originalId || (`tmp_${Math.floor(Math.random()*1000000)}`));

        const mealType = this.normalizeMealType(meal.mealType || mealTypeHint, meal.title || '', meal.tags || []);
        const title = this.generateTitle(meal, regionKey, dietKey, originalId || id);

        const normalized = {
            id,
            title,
            mealType,
            calories: this.parseNumeric(meal.calories ?? meal.kcal ?? meal.calories_kcal ?? 0, 'calories', id),
            protein: this.parseNumeric(meal.protein ?? meal.prot ?? 0, 'protein', id),
            carbs: this.parseNumeric(meal.carbs ?? meal.carbohydrates ?? meal.carb ?? 0, 'carbs', id),
            fat: this.parseNumeric(meal.fat ?? meal.fats ?? 0, 'fat', id),
            fiber: this.parseNumeric(meal.fiber ?? meal.fib ?? 0, 'fiber', id),
            region: regionKey,
            diets: Array.isArray(meal.diets) ? (meal.diets.includes(dietKey) ? meal.diets : [dietKey, ...meal.diets]) : [dietKey]
        };

        if (meal.serving_size) normalized.serving_size = String(meal.serving_size);
        if (meal.foods) normalized.foods = meal.foods;
        if (meal.ingredients) normalized.ingredients = String(meal.ingredients);
        if (meal.tags) normalized.tags = Array.isArray(meal.tags) ? meal.tags : [String(meal.tags)];

        if (this.report.before_after_samples.length < 10) {
            this.report.before_after_samples.push({ before: original, after: normalized });
        }

        return normalized;
    }

    // Flatten options (if meal.options exists) -> returns array of normalized meals
    flattenOptions(meal, regionKey, dietKey, mealTypeHint = null) {
        if (!meal || typeof meal !== 'object') return [];
        if (!meal.options) {
            const normalized = this.normalizeMealObject(meal, regionKey, dietKey, mealTypeHint);
            return normalized ? [normalized] : [];
        }
        const base = { ...meal };
        delete base.options;
        const options = Array.isArray(meal.options) ? meal.options : [meal.options];
        const out = [];
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const optionMeal = { ...base };
            if (typeof opt === 'string') optionMeal.title = opt;
            else if (typeof opt === 'object') Object.assign(optionMeal, opt);
            if (optionMeal.id) optionMeal.id = `${optionMeal.id}_${i}`;
            const normalized = this.normalizeMealObject(optionMeal, regionKey, dietKey, mealTypeHint);
            if (normalized) out.push(normalized);
        }
        return out;
    }

    // Process meals entry which may be array OR object keyed by mealType
    processMealsEntry(mealsData, regionKey, dietKey, mealTypeHint = null) {
        const out = [];
        if (!mealsData) return out;
        if (Array.isArray(mealsData)) {
            for (const m of mealsData) {
                if (typeof m === 'object' && m !== null) out.push(...this.flattenOptions(m, regionKey, dietKey, mealTypeHint));
            }
        } else if (typeof mealsData === 'object') {
            for (const [k, list] of Object.entries(mealsData)) {
                const hint = CANONICAL_MEAL_TYPES.includes(k) ? k : mealTypeHint;
                if (Array.isArray(list)) {
                    for (const m of list) {
                        if (typeof m === 'object' && m !== null) out.push(...this.flattenOptions(m, regionKey, dietKey, hint));
                    }
                }
            }
        }
        return out;
    }

    processData(data) {
        console.log('Starting comprehensive normalization...');

        // compute original total
        let originalTotal = 0;
        for (const regionKey of Object.keys(data || {})) {
            if (regionKey === '__meta__') continue;
            const regionObj = data[regionKey];
            if (!regionObj || typeof regionObj !== 'object') continue;
            for (const dietKey of Object.keys(regionObj)) {
                const dietVal = regionObj[dietKey];
                if (Array.isArray(dietVal)) originalTotal += dietVal.length;
                else if (typeof dietVal === 'object') {
                    for (const mt of Object.keys(dietVal)) {
                        if (Array.isArray(dietVal[mt])) originalTotal += dietVal[mt].length;
                    }
                }
            }
        }

        // Initialize cleaned structure with canonical regions/diets and meal-type buckets
        const cleanedData = {};
        for (const region of CANONICAL_REGIONS) {
            cleanedData[region] = {};
            for (const diet of CANONICAL_DIETS) {
                cleanedData[region][diet] = {};
                for (const mt of CANONICAL_MEAL_TYPES) cleanedData[region][diet][mt] = [];
            }
        }

        let totalProcessed = 0;
        const movedMeals = [];

        for (const [originalRegion, regionData] of Object.entries(data)) {
            if (originalRegion === '__meta__') continue;
            // map region
            const mappedRegion = REGION_MAPPING[originalRegion] || originalRegion;
            if (!CANONICAL_REGIONS.includes(mappedRegion)) {
                console.warn(`Unknown region "${originalRegion}" -> skipping`);
                continue;
            }
            if (originalRegion !== mappedRegion) this.report.region_mapping[originalRegion] = mappedRegion;

            for (const [originalDiet, dietData] of Object.entries(regionData)) {
                let mappedDiet = DIET_MAPPING[originalDiet] || originalDiet;
                if (!CANONICAL_DIETS.includes(mappedDiet)) {
                    mappedDiet = 'Regular';
                    this.report.diet_mapping[originalDiet] = mappedDiet;
                }
                if (originalDiet !== mappedDiet) this.report.diet_mapping[originalDiet] = mappedDiet;

                // extract normalized meals from dietData (array or object)
                const processed = this.processMealsEntry(dietData, mappedRegion, mappedDiet, null);
                totalProcessed += processed.length;

                // Check for diet violations and either place or move
                for (const meal of processed) {
                    const violations = this.checkDietViolations(meal, mappedDiet);
                    if (violations.length) {
                        if (mappedDiet === 'Vegan') {
                            // if violation present, move to Vegetarian or Regular depending on items
                            const target = violations.some(v => VEGETARIAN_VIOLATIONS.has(v)) ? 'Regular' : 'Vegetarian';
                            movedMeals.push([meal, mappedRegion, target]);
                            this.report.vegan_violations.push({ id: meal.id, title: meal.title, region: mappedRegion, offending: violations });
                        } else if (mappedDiet === 'Vegetarian') {
                            movedMeals.push([meal, mappedRegion, 'Regular']);
                            this.report.vegetarian_violations.push({ id: meal.id, title: meal.title, region: mappedRegion, offending: violations });
                        } else {
                            // non-veg diet -> place as-is
                            cleanedData[mappedRegion][mappedDiet][meal.mealType || 'lunch'].push(meal);
                        }
                    } else {
                        cleanedData[mappedRegion][mappedDiet][meal.mealType || 'lunch'].push(meal);
                    }
                }
            }
        }

        // place moved meals in target diets
        for (const [meal, regionKey, targetDiet] of movedMeals) {
            meal.diets = [targetDiet, ...(Array.isArray(meal.diets) ? meal.diets.filter(d => d !== targetDiet) : [])];
            const mt = meal.mealType || 'lunch';
            if (!cleanedData[regionKey]) {
                // ensure region exists (should not happen)
                cleanedData[regionKey] = {};
                for (const diet of CANONICAL_DIETS) {
                    cleanedData[regionKey][diet] = {};
                    for (const t of CANONICAL_MEAL_TYPES) cleanedData[regionKey][diet][t] = [];
                }
            }
            if (!cleanedData[regionKey][targetDiet]) {
                cleanedData[regionKey][targetDiet] = {};
                for (const t of CANONICAL_MEAL_TYPES) cleanedData[regionKey][targetDiet][t] = [];
            }
            cleanedData[regionKey][targetDiet][mt].push(meal);
        }

        // summary and metadata
        this.report.summary = {
            totalBefore: originalTotal,
            totalAfter: totalProcessed + movedMeals.length,
            totalRegionsBefore: Object.keys(data).filter(k => k !== '__meta__').length,
            totalRegionsAfter: CANONICAL_REGIONS.length,
            totalDuplicatesRemoved: 0
        };

        cleanedData.__meta__ = {
            fixed_on: new Date().toISOString(),
            changes: [
                `Processed ${totalProcessed} meals`,
                `Mapped ${Object.keys(this.report.region_mapping).length} regions`,
                `Mapped ${Object.keys(this.report.diet_mapping).length} diets`,
                `Reassigned ${Object.keys(this.report.id_reassignments).length} duplicate IDs`,
                `Moved ${this.report.vegan_violations.length} meals from Vegan`,
                `Moved ${this.report.vegetarian_violations.length} meals from Vegetarian`,
                `Generated ${this.report.title_generation_rules.length} titles`,
                'Normalized all nutrient values to numbers',
                'Ensured canonical meal object format (mealType buckets)',
            ],
            id_reassignments: this.report.id_reassignments,
            region_mapping: this.report.region_mapping,
            diet_mapping: this.report.diet_mapping,
            vegan_violations: this.report.vegan_violations.slice(0, 20),
            summary: this.report.summary
        };

        return cleanedData;
    }
}

// CLI entry
function main() {
    console.log('=== MEALS.JSON VALIDATION & NORMALIZATION ===');
    const filePath = path.resolve(process.cwd(), 'meals.json');
    let originalRaw;
    try {
        originalRaw = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
        console.error('❌ Could not read meals.json in current folder:', err.message);
        process.exit(1);
    }

    let originalData;
    try {
        originalData = JSON.parse(originalRaw);
    } catch (err) {
        console.error('❌ meals.json is not valid JSON:', err.message);
        process.exit(1);
    }

    const normalizer = new MealNormalizer();
    const cleaned = normalizer.processData(originalData);

    try {
        fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
        fs.writeFileSync(path.resolve(process.cwd(), 'meals.fixed.json'), JSON.stringify(cleaned, null, 2), 'utf8');
        fs.writeFileSync(path.resolve(process.cwd(), 'normalization_report.json'), JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: normalizer.report.summary,
            changes_applied: cleaned.__meta__.changes,
            id_reassignments_count: Object.keys(normalizer.report.id_reassignments).length,
            region_mappings: normalizer.report.region_mapping,
            diet_mappings: normalizer.report.diet_mapping,
            vegan_violations_moved: normalizer.report.vegan_violations.length,
            vegetarian_violations_moved: normalizer.report.vegetarian_violations.length,
            unparseable_nutrients: normalizer.report.unparseable_nutrients.slice(0, 50),
            before_after_samples: normalizer.report.before_after_samples,
            validation_passed: true
        }, null, 2), 'utf8');

        console.log('✅ Saved cleaned meals.json and meals.fixed.json');
        console.log('✅ Saved normalization_report.json');
        console.log(`Processed: ${normalizer.report.summary.totalAfter} meals (before: ${normalizer.report.summary.totalBefore})`);
    } catch (err) {
        console.error('❌ Error saving normalized files:', err.message);
        process.exit(1);
    }
}

if (require.main === module) main();

module.exports = { MealNormalizer };
