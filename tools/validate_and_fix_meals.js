#!/usr/bin/env node
/**
 * Meals.json validator and normalizer (tools/)
 * Usage: node tools/validate_and_fix_meals.js <input.json> <output.json>
 *
 * Produces cleanedData[region][diet] = { breakfast: [], lunch: [], dinner: [], snacks: [] }
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
    'Australia': 'Australian',
    'Oceania': 'Australian',
    'Oceana': 'Australian',
    'East Asia': 'East_Asian',
    'Latin America': 'Latin_American',
    'Middle East': 'Middle_Eastern',
    'United States': 'USA'
};

const DIET_MAPPING = {
    'Low Carb': 'Low_Carb',
    'High Protein': 'High_Protein',
    'Ketogenic': 'Keto'
};

// Diet violation keywords
const VEGAN_VIOLATIONS = [
    'chicken', 'beef', 'pork', 'fish', 'lamb', 'shrimp', 'crab', 'egg', 'eggs',
    'milk', 'cheese', 'yogurt', 'butter', 'ghee', 'honey', 'meat', 'turkey',
    'bacon', 'ham', 'sausage', 'dairy', 'cream', 'gelatin', 'casein', 'whey'
];

const VEGETARIAN_VIOLATIONS = [
    'chicken', 'beef', 'pork', 'fish', 'lamb', 'shrimp', 'crab', 'meat',
    'turkey', 'bacon', 'ham', 'sausage', 'seafood', 'salmon', 'tuna'
];

class MealValidator {
    constructor() {
        this.nextId = 100000; // safe start to avoid colliding with small numeric IDs
        this.usedIds = new Set();
        this.stats = {
            totalProcessed: 0,
            duplicateIds: 0,
            titlesGenerated: 0,
            regionMappings: 0,
            dietMappings: 0,
            preparationFieldsRemoved: 0,
            optionsFlattened: 0,
            veganViolations: [],
            vegetarianViolations: [],
            unparseableNutrients: []
        };
        this.idReassignments = {};
        this.regionMappings = {};
        this.dietMappings = {};
    }

    normalizeMealType(mealType, title = '', tags = []) {
        if (!mealType) {
            const text = `${title} ${Array.isArray(tags) ? tags.join(' ') : ''}`.toLowerCase();
            if (/breakfast|pancake|oats|chai|cereal|toast|morning/.test(text)) return 'breakfast';
            if (/dinner|curry|roast|stew|soup|evening|supper/.test(text)) return 'dinner';
            if (/snack|bar|chips|nuts|fruit|cookie/.test(text)) return 'snacks';
            return 'lunch';
        }
        const normalized = String(mealType).toLowerCase().trim();
        if (CANONICAL_MEAL_TYPES.includes(normalized)) return normalized;
        if (normalized === 'snack') return 'snacks';
        if (normalized === 'supper') return 'dinner';
        for (const t of CANONICAL_MEAL_TYPES) if (normalized.includes(t)) return t;
        return 'lunch';
    }

    parseNumeric(value, fieldName, mealId) {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return isNaN(value) ? 0 : value;
        if (typeof value === 'string') {
            // remove currency/symbols/commas but keep minus and dot
            const cleanValue = value.replace(/[^\d.-]+/g, '').trim();
            const parsed = parseFloat(cleanValue);
            if (isNaN(parsed)) {
                this.stats.unparseableNutrients.push({ id: mealId, field: fieldName, value });
                return 0;
            }
            return parsed;
        }
        return 0;
    }

    generateTitle(meal, region, diet, index) {
        const title = (meal.title || meal.name || '').toString().trim();
        if (title && !/^option\s*\d+/i.test(title)) return title;

        const foods = meal.foods || [];
        if (Array.isArray(foods) && foods.length) {
            const foodNames = foods.slice(0, 3).map(f => {
                if (typeof f === 'string') return f;
                if (typeof f === 'object' && f) return f.name || f.title || '';
                return '';
            }).filter(s => s && s.trim());
            if (foodNames.length) {
                this.stats.titlesGenerated++;
                if (foodNames.length === 1) return foodNames[0];
                if (foodNames.length === 2) return `${foodNames[0]} & ${foodNames[1]}`;
                return `${foodNames[0]}, ${foodNames[1]} & ${foodNames[2]}`;
            }
        }

        const ingredients = meal.ingredients || '';
        if (ingredients && typeof ingredients === 'string') {
            const words = ingredients.trim().split(/\s+/).slice(0, 6);
            if (words.length) {
                this.stats.titlesGenerated++;
                return words.join(' ') + (words.length >= 6 ? '...' : '');
            }
        }

        this.stats.titlesGenerated++;
        return `Meal ${region}-${diet}-${index}`;
    }

    getUniqueId(originalId) {
        if (originalId !== undefined && originalId !== null) {
            const key = String(originalId);
            if (!this.usedIds.has(key)) {
                this.usedIds.add(key);
                return key;
            } else {
                // collision with existing id - we'll reassign
                this.stats.duplicateIds++;
            }
        }
        // generate new unique string id
        while (this.usedIds.has(String(this.nextId))) this.nextId++;
        const id = String(this.nextId++);
        this.usedIds.add(id);
        if (originalId !== undefined && originalId !== null) {
            this.idReassignments[String(originalId)] = id;
        }
        return id;
    }

    checkDietViolations(meal, dietKey) {
        const title = meal.title || '';
        const ingredients = meal.ingredients || '';
        const tags = Array.isArray(meal.tags) ? meal.tags.join(' ') : (meal.tags || '');
        const foods = Array.isArray(meal.foods) ? meal.foods.map(f => (typeof f === 'string' ? f : (f && f.name ? f.name : ''))).join(' ') : '';
        const textToCheck = `${title} ${ingredients} ${tags} ${foods}`.toLowerCase();
        const violations = [];

        if (dietKey === 'Vegan') {
            for (const v of VEGAN_VIOLATIONS) if (textToCheck.includes(v)) violations.push(v);
        } else if (dietKey === 'Vegetarian') {
            for (const v of VEGETARIAN_VIOLATIONS) if (textToCheck.includes(v)) violations.push(v);
        }

        return violations;
    }

    flattenOptions(meal, regionKey, dietKey, mealTypeHint) {
        if (!meal.options || !Array.isArray(meal.options)) {
            const single = this.normalizeMeal(meal, regionKey, dietKey, mealTypeHint);
            return single ? [single] : [];
        }
        this.stats.optionsFlattened++;
        const base = { ...meal };
        delete base.options;
        const out = [];
        for (let i = 0; i < meal.options.length; i++) {
            const opt = meal.options[i];
            const optionMeal = { ...base };
            if (typeof opt === 'string') optionMeal.title = opt;
            else if (opt && typeof opt === 'object') Object.assign(optionMeal, opt);
            if (optionMeal.id) optionMeal.id = `${optionMeal.id}_${i}`;
            const normalized = this.normalizeMeal(optionMeal, regionKey, dietKey, mealTypeHint, i);
            if (normalized) out.push(normalized);
        }
        return out;
    }

    normalizeMeal(meal, regionKey, dietKey, mealTypeHint = null, index = 0) {
        if (!meal || typeof meal !== 'object') return null;
        this.stats.totalProcessed++;

        if (Object.keys(meal).some(k => k.toLowerCase().includes('preparation'))) {
            this.stats.preparationFieldsRemoved++;
        }

        const uniqueId = this.getUniqueId(meal.id);
        const mealType = this.normalizeMealType(meal.mealType || mealTypeHint, meal.title || '', meal.tags || []);
        const title = this.generateTitle(meal, regionKey, dietKey, index);

        const normalized = {
            id: uniqueId,
            title,
            mealType,
            calories: this.parseNumeric(meal.calories ?? meal.kcal ?? meal.calories_kcal ?? 0, 'calories', uniqueId),
            protein: this.parseNumeric(meal.protein ?? meal.prot ?? 0, 'protein', uniqueId),
            carbs: this.parseNumeric(meal.carbs ?? meal.carbohydrates ?? meal.carb ?? 0, 'carbs', uniqueId),
            fat: this.parseNumeric(meal.fat ?? meal.fats ?? 0, 'fat', uniqueId),
            fiber: this.parseNumeric(meal.fiber ?? meal.fib ?? 0, 'fiber', uniqueId),
            region: regionKey
        };

        if (meal.serving_size) normalized.serving_size = String(meal.serving_size);
        if (meal.foods) normalized.foods = meal.foods;
        if (meal.ingredients) normalized.ingredients = String(meal.ingredients);
        if (meal.tags) normalized.tags = Array.isArray(meal.tags) ? meal.tags : [String(meal.tags)];

        // diets: ensure parent diet included
        let diets = meal.diets;
        if (!Array.isArray(diets)) diets = [dietKey];
        else if (!diets.includes(dietKey)) diets = [dietKey, ...diets];
        normalized.diets = diets;

        return normalized;
    }

    validateAndFix(inputData) {
        console.log('🔧 Starting meals.json validation and normalization...');

        // Initialize cleaned structure with canonical regions/diets and meal-type buckets
        const cleanedData = {};
        for (const region of CANONICAL_REGIONS) {
            cleanedData[region] = {};
            for (const diet of CANONICAL_DIETS) {
                cleanedData[region][diet] = {};
                for (const mt of CANONICAL_MEAL_TYPES) cleanedData[region][diet][mt] = [];
            }
        }

        // iterate input
        for (const [origRegion, regionData] of Object.entries(inputData || {})) {
            if (origRegion === '__meta__') continue;

            const regionKey = REGION_MAPPING[origRegion] || origRegion;
            if (!CANONICAL_REGIONS.includes(regionKey)) {
                console.warn(`⚠️  Unknown region ${origRegion}, skipping`);
                continue;
            }
            if (origRegion !== regionKey) {
                this.regionMappings[origRegion] = regionKey;
                this.stats.regionMappings++;
            }

            for (const [origDiet, dietData] of Object.entries(regionData || {})) {
                let dietKey = DIET_MAPPING[origDiet] || origDiet;
                if (!CANONICAL_DIETS.includes(dietKey)) {
                    this.dietMappings[origDiet] = 'Regular';
                    dietKey = 'Regular';
                }
                if (origDiet !== dietKey) {
                    this.dietMappings[origDiet] = dietKey;
                    this.stats.dietMappings++;
                }

                // Collect a flat list of meal entries from dietData (array or object keyed by mealType)
                let allMeals = [];
                if (Array.isArray(dietData)) {
                    allMeals = dietData;
                } else if (dietData && typeof dietData === 'object') {
                    for (const [k, v] of Object.entries(dietData)) {
                        if (Array.isArray(v)) {
                            allMeals.push(...v.map(m => ({ ...m, _mealTypeHint: CANONICAL_MEAL_TYPES.includes(k) ? k : null })));
                        }
                    }
                }

                for (let i = 0; i < allMeals.length; i++) {
                    const meal = allMeals[i];
                    if (!meal || typeof meal !== 'object') continue;

                    const mealTypeHint = meal._mealTypeHint;
                    delete meal._mealTypeHint;

                    const flattened = this.flattenOptions(meal, regionKey, dietKey, mealTypeHint);

                    for (const normalizedMeal of flattened) {
                        const violations = this.checkDietViolations(normalizedMeal, dietKey);
                        if (violations.length > 0) {
                            let targetDiet = dietKey;
                            if (dietKey === 'Vegan') {
                                const dairyEggOnly = violations.every(v =>
                                    ['egg', 'eggs', 'milk', 'cheese', 'yogurt', 'butter', 'ghee', 'cream', 'dairy'].includes(v)
                                );
                                targetDiet = dairyEggOnly ? 'Vegetarian' : 'Regular';
                                this.stats.veganViolations.push({ id: normalizedMeal.id, title: normalizedMeal.title, offending: violations, movedTo: targetDiet });
                            } else if (dietKey === 'Vegetarian') {
                                targetDiet = 'Regular';
                                this.stats.vegetarianViolations.push({ id: normalizedMeal.id, title: normalizedMeal.title, offending: violations, movedTo: targetDiet });
                            }

                            normalizedMeal.diets = [targetDiet, ...(Array.isArray(normalizedMeal.diets) ? normalizedMeal.diets.filter(d => d !== targetDiet) : [])];
                            cleanedData[regionKey][targetDiet][normalizedMeal.mealType || 'lunch'].push(normalizedMeal);
                        } else {
                            cleanedData[regionKey][dietKey][normalizedMeal.mealType || 'lunch'].push(normalizedMeal);
                        }
                    }
                }
            }
        }

        // Build metadata
        const totalAfter = CANONICAL_REGIONS.reduce((sumR, r) => {
            return sumR + CANONICAL_DIETS.reduce((sumD, d) => {
                return sumD + CANONICAL_MEAL_TYPES.reduce((s, mt) => s + (cleanedData[r][d][mt] ? cleanedData[r][d][mt].length : 0), 0);
            }, 0);
        }, 0);

        cleanedData.__meta__ = {
            fixed_on: new Date().toISOString(),
            script_version: 'tools-1.0.0',
            changes: [
                `Processed ${this.stats.totalProcessed} meals`,
                `Reassigned ${this.stats.duplicateIds} duplicate IDs`,
                `Generated ${this.stats.titlesGenerated} missing titles`,
                `Mapped ${this.stats.regionMappings} regions`,
                `Mapped ${this.stats.dietMappings} diets`,
                `Removed ${this.stats.preparationFieldsRemoved} preparation fields`,
                `Flattened ${this.stats.optionsFlattened} options arrays`,
                `Moved ${this.stats.veganViolations.length} meals from Vegan`,
                `Moved ${this.stats.vegetarianViolations.length} meals from Vegetarian`
            ].filter(Boolean),
            id_reassignments: this.idReassignments,
            region_mappings: this.regionMappings,
            diet_mappings: this.dietMappings,
            summary: {
                totalBefore: this.stats.totalProcessed,
                totalAfter
            }
        };

        return cleanedData;
    }

    printReport() {
        console.log('\n=== VALIDATION REPORT ===');
        console.log(`✅ Total meals processed: ${this.stats.totalProcessed}`);
        console.log(`🔄 Duplicate IDs reassigned: ${this.stats.duplicateIds}`);
        console.log(`📝 Titles generated: ${this.stats.titlesGenerated}`);
        console.log(`🗺️  Regions mapped: ${this.stats.regionMappings}`);
        console.log(`🍽️  Diets mapped: ${this.stats.dietMappings}`);
        console.log(`🚫 Preparation fields removed: ${this.stats.preparationFieldsRemoved}`);
        console.log(`📋 Options arrays flattened: ${this.stats.optionsFlattened}`);

        if (this.stats.veganViolations.length > 0) {
            console.log(`\n⚠️  VEGAN VIOLATIONS (${this.stats.veganViolations.length}):`);
            this.stats.veganViolations.slice(0, 5).forEach(v => {
                console.log(`   ID ${v.id}: "${v.title}" contains [${v.offending.join(', ')}] -> moved to ${v.movedTo}`);
            });
            if (this.stats.veganViolations.length > 5) console.log(`   ... and ${this.stats.veganViolations.length - 5} more`);
        }

        if (this.stats.vegetarianViolations.length > 0) {
            console.log(`\n⚠️  VEGETARIAN VIOLATIONS (${this.stats.vegetarianViolations.length}):`);
            this.stats.vegetarianViolations.slice(0, 5).forEach(v => {
                console.log(`   ID ${v.id}: "${v.title}" contains [${v.offending.join(', ')}] -> moved to ${v.movedTo}`);
            });
            if (this.stats.vegetarianViolations.length > 5) console.log(`   ... and ${this.stats.vegetarianViolations.length - 5} more`);
        }

        if (this.stats.unparseableNutrients.length > 0) {
            console.log(`\n⚠️  UNPARSEABLE NUTRIENTS (${this.stats.unparseableNutrients.length}):`);
            this.stats.unparseableNutrients.slice(0, 3).forEach(n => {
                console.log(`   ID ${n.id}: ${n.field} = "${n.value}" -> set to 0`);
            });
        }

        console.log('\n✅ Validation complete!');
    }
}

function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node tools/validate_and_fix_meals.js <input.json> <output.json>');
        process.exit(1);
    }

    const [inputFile, outputFile] = args;

    let inputData;
    try {
        const raw = fs.readFileSync(inputFile, 'utf8');
        inputData = JSON.parse(raw);
        console.log(`📂 Loaded ${inputFile} (${Math.round(raw.length/1024)} KB)`);
    } catch (err) {
        console.error(`❌ Could not read/parse ${inputFile}:`, err.message);
        process.exit(1);
    }

    const validator = new MealValidator();
    const cleaned = validator.validateAndFix(inputData);

    try {
        fs.writeFileSync(outputFile, JSON.stringify(cleaned, null, 2), 'utf8');
        console.log(`💾 Saved ${outputFile} (${Math.round(JSON.stringify(cleaned).length/1024)} KB)`);
    } catch (err) {
        console.error(`❌ Could not write ${outputFile}:`, err.message);
        process.exit(1);
    }

    validator.printReport();

    // Final quick checks
    const regions = Object.keys(cleaned).filter(k => k !== '__meta__');
    const regionsValid = regions.every(r => CANONICAL_REGIONS.includes(r));
    console.log(`\n✅ All regions canonical: ${regionsValid}`);

    let dietsValid = true;
    for (const r of CANONICAL_REGIONS) {
        const regionObj = cleaned[r];
        if (!regionObj) continue;
        const dietKeys = Object.keys(regionObj);
        if (!dietKeys.every(d => CANONICAL_DIETS.includes(d))) { dietsValid = false; break; }
        // check meal-type buckets exist
        for (const d of CANONICAL_DIETS) {
            if (!regionObj[d] || !CANONICAL_MEAL_TYPES.every(mt => Object.prototype.hasOwnProperty.call(regionObj[d], mt))) {
                dietsValid = false;
                break;
            }
        }
        if (!dietsValid) break;
    }
    console.log(`✅ All diets canonical and have meal-type buckets: ${dietsValid}`);

    const hasPreparation = JSON.stringify(cleaned).includes('"preparation');
    const hasOptions = JSON.stringify(cleaned).includes('"options"');
    console.log(`✅ No "preparation" fields present: ${!hasPreparation}`);
    console.log(`✅ No "options" arrays present: ${!hasOptions}`);

    console.log('\n🎉 Normalization finished.');
}

if (require.main === module) main();

module.exports = { MealValidator };
