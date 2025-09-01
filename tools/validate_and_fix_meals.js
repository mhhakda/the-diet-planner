#!/usr/bin/env node
/**
 * Meals.json validator and normalizer
 * Usage: node tools/validate_and_fix_meals.js meals.json meals.fixed.json
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
        this.nextId = 1;
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
            // Infer from title or tags
            const text = `${title} ${Array.isArray(tags) ? tags.join(' ') : ''}`.toLowerCase();
            
            if (/breakfast|pancake|oats|chai|cereal|toast|morning/.test(text)) {
                return 'breakfast';
            } else if (/dinner|curry|roast|stew|soup|evening/.test(text)) {
                return 'dinner';
            } else if (/snack|bar|chips|nuts|fruit/.test(text)) {
                return 'snacks';
            } else {
                return 'lunch'; // default
            }
        }
        
        const normalized = String(mealType).toLowerCase().trim();
        
        if (CANONICAL_MEAL_TYPES.includes(normalized)) {
            return normalized;
        } else if (normalized === 'snack') {
            return 'snacks';
        } else if (normalized === 'supper') {
            return 'dinner';
        } else {
            return 'lunch'; // default
        }
    }

    parseNumeric(value, fieldName, mealId) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        
        if (typeof value === 'number') {
            return value;
        }
        
        if (typeof value === 'string') {
            const cleanValue = value.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(cleanValue);
            if (isNaN(parsed)) {
                this.stats.unparseableNutrients.push({
                    id: mealId,
                    field: fieldName,
                    value: value
                });
                return 0;
            }
            return parsed;
        }
        
        return 0;
    }

    generateTitle(meal, region, diet, index) {
        // Check existing title
        const title = (meal.title || meal.name || '').trim();
        if (title && !/^option\s*\d+/i.test(title)) {
            return title;
        }

        // Try to build from foods (first 3)
        const foods = meal.foods || [];
        if (Array.isArray(foods) && foods.length > 0) {
            const foodNames = foods.slice(0, 3).map(food => {
                if (typeof food === 'string') return food;
                if (typeof food === 'object' && food) {
                    return food.name || food.title || '';
                }
                return '';
            }).filter(name => name.trim()).map(name => name.trim());

            if (foodNames.length > 0) {
                this.stats.titlesGenerated++;
                if (foodNames.length === 1) {
                    return foodNames[0];
                } else if (foodNames.length === 2) {
                    return `${foodNames[0]} & ${foodNames[1]}`;
                } else {
                    return `${foodNames[0]}, ${foodNames[1]} & ${foodNames[2]}`;
                }
            }
        }

        // Try ingredients (first 6 words)
        const ingredients = meal.ingredients || '';
        if (ingredients && typeof ingredients === 'string') {
            const words = ingredients.trim().split(/\s+/).slice(0, 6);
            if (words.length > 0) {
                this.stats.titlesGenerated++;
                return words.join(' ') + (words.length >= 6 ? '...' : '');
            }
        }

        // Fallback
        this.stats.titlesGenerated++;
        return `Meal ${region}-${diet}-${index}`;
    }

    getUniqueId(originalId) {
        if (originalId && typeof originalId === 'number' && !this.usedIds.has(originalId)) {
            this.usedIds.add(originalId);
            return originalId;
        }

        // Need to reassign
        while (this.usedIds.has(this.nextId)) {
            this.nextId++;
        }

        const newId = this.nextId;
        this.usedIds.add(newId);

        if (originalId) {
            this.idReassignments[originalId] = newId;
            this.stats.duplicateIds++;
        }

        this.nextId++;
        return newId;
    }

    checkDietViolations(meal, dietKey) {
        const textToCheck = [
            meal.title || '',
            meal.ingredients || '',
            ...(Array.isArray(meal.tags) ? meal.tags : []),
            ...(Array.isArray(meal.foods) ? meal.foods.map(f => 
                typeof f === 'string' ? f : (f && f.name) || ''
            ) : [])
        ].join(' ').toLowerCase();

        const violations = [];

        if (dietKey === 'Vegan') {
            for (const violation of VEGAN_VIOLATIONS) {
                if (textToCheck.includes(violation)) {
                    violations.push(violation);
                }
            }
        } else if (dietKey === 'Vegetarian') {
            for (const violation of VEGETARIAN_VIOLATIONS) {
                if (textToCheck.includes(violation)) {
                    violations.push(violation);
                }
            }
        }

        return violations;
    }

    flattenOptions(meal, regionKey, dietKey, mealTypeHint) {
        if (!meal.options || !Array.isArray(meal.options)) {
            return [this.normalizeMeal(meal, regionKey, dietKey, mealTypeHint)];
        }

        this.stats.optionsFlattened++;
        const baseMeal = { ...meal };
        delete baseMeal.options;

        const flattenedMeals = [];
        for (let i = 0; i < meal.options.length; i++) {
            const optionMeal = { ...baseMeal };
            const option = meal.options[i];

            if (typeof option === 'string') {
                optionMeal.title = option;
            } else if (typeof option === 'object' && option) {
                Object.assign(optionMeal, option);
            }

            // Ensure unique ID for each option
            if (optionMeal.id) {
                optionMeal.id = `${optionMeal.id}_${i}`;
            }

            const normalized = this.normalizeMeal(optionMeal, regionKey, dietKey, mealTypeHint);
            if (normalized) {
                flattenedMeals.push(normalized);
            }
        }

        return flattenedMeals;
    }

    normalizeMeal(meal, regionKey, dietKey, mealTypeHint = null, index = 0) {
        if (!meal || typeof meal !== 'object') {
            return null;
        }

        this.stats.totalProcessed++;

        // Check for preparation field
        if (Object.keys(meal).some(key => key.toLowerCase().includes('preparation'))) {
            this.stats.preparationFieldsRemoved++;
        }

        const originalId = meal.id;
        const uniqueId = this.getUniqueId(originalId);

        // Build canonical meal object
        const normalized = {
            id: uniqueId,
            title: this.generateTitle(meal, regionKey, dietKey, index),
            mealType: this.normalizeMealType(
                meal.mealType || mealTypeHint, 
                meal.title || '', 
                meal.tags
            )
        };

        // Optional serving_size
        if (meal.serving_size) {
            normalized.serving_size = String(meal.serving_size);
        }

        // Required numeric fields
        normalized.calories = this.parseNumeric(meal.calories, 'calories', uniqueId);
        normalized.protein = this.parseNumeric(meal.protein, 'protein', uniqueId);
        normalized.carbs = this.parseNumeric(meal.carbs, 'carbs', uniqueId);
        normalized.fat = this.parseNumeric(meal.fat, 'fat', uniqueId);
        normalized.fiber = this.parseNumeric(meal.fiber, 'fiber', uniqueId);

        // Optional foods array
        if (meal.foods) {
            normalized.foods = meal.foods;
        }

        // Optional ingredients
        if (meal.ingredients) {
            normalized.ingredients = String(meal.ingredients);
        }

        // Diets array - must include parent diet
        let diets = meal.diets || [];
        if (!Array.isArray(diets)) {
            diets = [dietKey];
        } else if (!diets.includes(dietKey)) {
            diets.push(dietKey);
        }
        normalized.diets = diets;

        // Optional tags
        if (meal.tags) {
            normalized.tags = Array.isArray(meal.tags) ? meal.tags : [String(meal.tags)];
        }

        // Required region
        normalized.region = regionKey;

        return normalized;
    }

    validateAndFix(inputData) {
        console.log('🔧 Starting meals.json validation and normalization...');

        // Initialize clean structure
        const cleanedData = {};
        for (const region of CANONICAL_REGIONS) {
            cleanedData[region] = {};
            for (const diet of CANONICAL_DIETS) {
                cleanedData[region][diet] = [];
            }
        }

        // Process each region
        for (const [originalRegion, regionData] of Object.entries(inputData)) {
            if (originalRegion === '__meta__') continue;

            // Map region key
            const regionKey = REGION_MAPPING[originalRegion] || originalRegion;
            if (!CANONICAL_REGIONS.includes(regionKey)) {
                console.warn(`⚠️  Unknown region ${originalRegion}, skipping`);
                continue;
            }

            if (originalRegion !== regionKey) {
                this.regionMappings[originalRegion] = regionKey;
                this.stats.regionMappings++;
            }

            console.log(`📍 Processing region: ${originalRegion} -> ${regionKey}`);

            // Process each diet
            for (const [originalDiet, dietData] of Object.entries(regionData)) {
                // Map diet key
                let dietKey = DIET_MAPPING[originalDiet] || originalDiet;
                if (!CANONICAL_DIETS.includes(dietKey)) {
                    console.log(`   Moving unknown diet ${originalDiet} to Regular`);
                    dietKey = 'Regular';
                }

                if (originalDiet !== dietKey) {
                    this.dietMappings[originalDiet] = dietKey;
                    this.stats.dietMappings++;
                }

                // Collect meals from this diet
                let allMeals = [];
                if (Array.isArray(dietData)) {
                    allMeals = dietData;
                } else if (typeof dietData === 'object' && dietData) {
                    // Nested structure: diet -> mealType -> meals[]
                    for (const [mealType, mealList] of Object.entries(dietData)) {
                        if (Array.isArray(mealList)) {
                            allMeals.push(...mealList.map(meal => ({ ...meal, _mealTypeHint: mealType })));
                        }
                    }
                }

                console.log(`   🍽️  Processing ${allMeals.length} meals in ${originalDiet} -> ${dietKey}`);

                // Process each meal
                for (let i = 0; i < allMeals.length; i++) {
                    const meal = allMeals[i];
                    if (!meal || typeof meal !== 'object') continue;

                    const mealTypeHint = meal._mealTypeHint;
                    delete meal._mealTypeHint;

                    // Flatten options if present
                    const flattenedMeals = this.flattenOptions(meal, regionKey, dietKey, mealTypeHint);

                    // Check diet violations and place meals appropriately
                    for (const normalizedMeal of flattenedMeals) {
                        const violations = this.checkDietViolations(normalizedMeal, dietKey);

                        if (violations.length > 0) {
                            let targetDiet = dietKey;
                            
                            if (dietKey === 'Vegan') {
                                // Move to Vegetarian if only dairy/eggs, otherwise Regular
                                const hasOnlyDairyEggs = violations.every(v => 
                                    ['egg', 'eggs', 'milk', 'cheese', 'yogurt', 'butter', 'ghee', 'cream', 'dairy'].includes(v)
                                );
                                targetDiet = hasOnlyDairyEggs ? 'Vegetarian' : 'Regular';
                                
                                this.stats.veganViolations.push({
                                    id: normalizedMeal.id,
                                    title: normalizedMeal.title,
                                    region: regionKey,
                                    offending: violations,
                                    movedTo: targetDiet
                                });
                            } else if (dietKey === 'Vegetarian') {
                                targetDiet = 'Regular';
                                
                                this.stats.vegetarianViolations.push({
                                    id: normalizedMeal.id,
                                    title: normalizedMeal.title,
                                    region: regionKey,
                                    offending: violations,
                                    movedTo: targetDiet
                                });
                            }

                            // Update meal's diets array
                            normalizedMeal.diets = [targetDiet, ...normalizedMeal.diets.filter(d => d !== targetDiet)];
                            cleanedData[regionKey][targetDiet].push(normalizedMeal);
                        } else {
                            // Add to original diet
                            cleanedData[regionKey][dietKey].push(normalizedMeal);
                        }
                    }
                }
            }
        }

        // Calculate final stats
        const totalAfter = Object.values(cleanedData).reduce((sum, regionData) => {
            return sum + Object.values(regionData).reduce((regionSum, meals) => regionSum + meals.length, 0);
        }, 0);

        // Add metadata
        cleanedData.__meta__ = {
            fixed_on: new Date().toISOString(),
            script_version: '1.0.0',
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
            ].filter(change => !change.includes(' 0 ')),
            id_reassignments: this.idReassignments,
            region_mappings: this.regionMappings,
            diet_mappings: this.dietMappings,
            summary: {
                totalBefore: this.stats.totalProcessed,
                totalAfter: totalAfter,
                duplicateIdsFixed: this.stats.duplicateIds,
                titlesGenerated: this.stats.titlesGenerated
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
            if (this.stats.veganViolations.length > 5) {
                console.log(`   ... and ${this.stats.veganViolations.length - 5} more`);
            }
        }

        if (this.stats.vegetarianViolations.length > 0) {
            console.log(`\n⚠️  VEGETARIAN VIOLATIONS (${this.stats.vegetarianViolations.length}):`);
            this.stats.vegetarianViolations.slice(0, 5).forEach(v => {
                console.log(`   ID ${v.id}: "${v.title}" contains [${v.offending.join(', ')}] -> moved to ${v.movedTo}`);
            });
            if (this.stats.vegetarianViolations.length > 5) {
                console.log(`   ... and ${this.stats.vegetarianViolations.length - 5} more`);
            }
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

    // Load input file
    let inputData;
    try {
        const rawData = fs.readFileSync(inputFile, 'utf8');
        inputData = JSON.parse(rawData);
        console.log(`📂 Loaded ${inputFile} (${Math.round(rawData.length / 1024)}KB)`);
    } catch (error) {
        console.error(`❌ Error loading ${inputFile}: ${error.message}`);
        process.exit(1);
    }

    // Validate and fix
    const validator = new MealValidator();
    const cleanedData = validator.validateAndFix(inputData);

    // Save output file
    try {
        fs.writeFileSync(outputFile, JSON.stringify(cleanedData, null, 2));
        console.log(`💾 Saved ${outputFile} (${Math.round(JSON.stringify(cleanedData).length / 1024)}KB)`);
    } catch (error) {
        console.error(`❌ Error saving ${outputFile}: ${error.message}`);
        process.exit(1);
    }

    // Print report
    validator.printReport();

    // Final validation
    console.log('\n=== FINAL VALIDATION ===');
    const regions = Object.keys(cleanedData).filter(k => k !== '__meta__');
    const regionsValid = regions.every(r => CANONICAL_REGIONS.includes(r));
    console.log(`✅ All regions canonical: ${regionsValid}`);

    let dietsValid = true;
    for (const [region, regionData] of Object.entries(cleanedData)) {
        if (region === '__meta__') continue;
        if (!Object.keys(regionData).every(d => CANONICAL_DIETS.includes(d))) {
            dietsValid = false;
            break;
        }
    }
    console.log(`✅ All diets canonical: ${dietsValid}`);

    const hasPreparation = JSON.stringify(cleanedData).includes('"preparation');
    console.log(`✅ No preparation fields: ${!hasPreparation}`);

    const hasOptions = JSON.stringify(cleanedData).includes('"options"');
    console.log(`✅ No options arrays: ${!hasOptions}`);

    console.log('🎉 Normalization complete and validated!');
}

if (require.main === module) {
    main();
}

module.exports = { MealValidator };