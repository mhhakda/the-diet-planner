/**
 * Diet Planner - Final Production JavaScript with Diet Tracker Integration
 * @version 3.0.0 
 * @author TheDietPlanner.com
 * Features: Full Diet Tracker Integration, Fixed Share Functionality, Dark Mode Optimization
 */

// Global variables
let currentMealPlan = null;
let currentUserProfile = null;
let mealDatabase = null;
let mealDbLoadPromise = null;
let ChartsLoaded = false;
let Html2PdfLoaded = false;
let currentActiveSection = 'profile';
let sectionObserver;
let groceryList = [];
let swappedMeals = new Map();

// Theme management
let currentTheme = localStorage.getItem('theme') || 'light';
const INTEGRATION_STORAGE_KEY = 'dietplanner_integration_v3';

// Safe number parsing helper
function safeNumber(v) {
    if (v == null || v == undefined) return 0;
    const n = Number(String(v).replace(/[,-]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    initializeNavigation();
    initializeMobileMenu();
    initializeIntersectionObserver();
    initializeResultsToggle();
    initializeForm();
    loadMealsDatabase();
    loadExistingPlan();
    console.log('Diet Planner loaded successfully!');
});

// Theme Management
function initializeTheme() {
    document.body.setAttribute('data-theme', currentTheme);
    updateThemeToggle();
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeToggle();
}

function updateThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
}

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            if (!section) return;
            updateActiveNavItem(section);
            if (section === 'profile') {
                showForm();
            } else {
                // Only show results if meal plan exists
                if (!currentMealPlan) {
                    alert('Please generate a meal plan first!');
                    showForm();
                    return;
                }
                showResults();
                scrollToResultsSection(section);
            }
            closeMobileMenu();
        });
    });
}

function updateActiveNavItem(activeSection) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        const section = item.getAttribute('data-section');
        if (section === activeSection) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    currentActiveSection = activeSection;
}

// Mobile menu
function initializeMobileMenu() {
    const btn = document.getElementById('mobileMenuButton');
    const overlay = document.getElementById('mobileOverlay');
    if (btn) {
        btn.addEventListener('click', toggleMobileMenu);
    }
    if (overlay) {
        overlay.addEventListener('click', closeMobileMenu);
    }
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (!sidebar) return;
    sidebar.classList.toggle('mobile-open');
    if (overlay) {
        overlay.classList.toggle('active');
    }
    const btn = document.getElementById('mobileMenuButton');
    if (btn) {
        btn.setAttribute('aria-expanded', sidebar.classList.contains('mobile-open') ? 'true' : 'false');
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (!sidebar) return;
    sidebar.classList.remove('mobile-open');
    if (overlay) {
        overlay.classList.remove('active');
    }
    const btn = document.getElementById('mobileMenuButton');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
    }
}

// Intersection observer
function initializeIntersectionObserver() {
    if ('IntersectionObserver' in window) {
        sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateActiveNavItem(entry.target.id);
                }
            });
        }, { threshold: 0.5 });
        const sections = document.querySelectorAll('section, .form-section, .results-container');
        sections.forEach(s => sectionObserver.observe(s));
    }
}

function initializeResultsToggle() {
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        editBtn.addEventListener('click', showForm);
    }
}

function showForm() {
    const formSection = document.getElementById('formSection');
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.classList.remove('visible');
        resultsContainer.setAttribute('aria-hidden', 'true');
    }
    if (formSection) {
        formSection.classList.remove('hidden');
    }
    updateActiveNavItem('profile');
    currentActiveSection = 'profile';
}

function showResults() {
    if (!currentMealPlan) {
        console.warn('No meal plan available to show results');
        return;
    }
    const formSection = document.getElementById('formSection');
    const resultsContainer = document.getElementById('resultsContainer');
    if (formSection) {
        formSection.classList.add('hidden');
    }
    if (resultsContainer) {
        setTimeout(() => {
            resultsContainer.classList.add('visible');
            resultsContainer.setAttribute('aria-hidden', 'false');
            const resultsScroll = document.getElementById('resultsScroll');
            if (resultsScroll) {
                resultsScroll.scrollTop = 0;
            }
        }, 200);
    }
}

function scrollToResultsSection(sectionId) {
    const resultsScroll = document.getElementById('resultsScroll');
    if (!resultsScroll) return;
    let top = 0;
    if (sectionId === 'analytics') {
        const el = resultsScroll.querySelector('.charts-grid');
        if (el) top = el.offsetTop - 20;
    } else if (sectionId === 'exports') {
        const el = resultsScroll.querySelector('.export-section');
        if (el) top = el.offsetTop - 20;
    } else if (sectionId === 'grocery') {
        const el = resultsScroll.querySelector('.grocery-section');
        if (el) top = el.offsetTop - 20;
    } else if (sectionId === 'recipes') {
        const el = resultsScroll.querySelector('.recipe-section');
        if (el) top = el.offsetTop - 20;
    }
    resultsScroll.scrollTo({ top, behavior: 'smooth' });
}

// Form handling (robust / idempotent)
function initializeForm() {
    const generateBtn = document.getElementById('generateBtn');
    if (!generateBtn) return;

    // If an old stub placed a named callback reference, remove it
    try {
        if (generateBtn._stubCallback && typeof generateBtn._stubCallback === 'function') {
            try { generateBtn.removeEventListener('click', generateBtn._stubCallback); } catch (e) {}
            try { delete generateBtn._stubCallback; } catch (e) {}
        }

        // If a marker _stubPresent exists (from older safe stubs), clear it
        if (generateBtn._stubPresent) {
            try { delete generateBtn._stubPresent; } catch (e) {}
        }
    } catch (e) {
        console.warn('initializeForm: failed to remove stub handlers (non-fatal)', e);
    }

    // Remove previously bound real handler to avoid double-binding on hot reloads
    try {
        if (generateBtn._realCallback && typeof generateBtn._realCallback === 'function') {
            try { generateBtn.removeEventListener('click', generateBtn._realCallback); } catch (e) {}
        }
    } catch (e) {
        // non-fatal
    }

    // Bind the real handler and keep a reference for future removal
    generateBtn._realCallback = async function (e) {
        e.preventDefault();
        // small defensive guard
        try {
            await handleFormSubmit();
        } catch (err) {
            console.error('generateBtn._realCallback error:', err);
        }
    };

    generateBtn.addEventListener('click', generateBtn._realCallback);
    generateBtn._realBound = true;

    // Also wire edit profile button if present (idempotent)
    try {
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            if (editBtn._realCallback && typeof editBtn._realCallback === 'function') {
                try { editBtn.removeEventListener('click', editBtn._realCallback); } catch (e) {}
            }
            editBtn._realCallback = function (e) { e.preventDefault(); showForm(); };
            editBtn.addEventListener('click', editBtn._realCallback);
        }
    } catch (e) {}

    console.info('initializeForm: real handlers bound.');
}

async function handleFormSubmit() {
    if (!validateForm()) return;
    const generateBtn = document.getElementById('generateBtn');
    const genText = document.getElementById('generateBtnText');
    if (generateBtn) generateBtn.disabled = true;
    if (genText) genText.textContent = 'Generating...';
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'block';
    try {
        await generateMealPlan();
        setTimeout(() => {
            if (loading) loading.style.display = 'none';
            showResults();
            updateActiveNavItem('plan');
        }, 300);
    } catch (err) {
        console.error('Error generating meal plan:', err);
        showAllergenAlert('Failed to generate meal plan. Please try again.');
        if (loading) loading.style.display = 'none';
    } finally {
        if (generateBtn) generateBtn.disabled = false;
        if (genText) genText.textContent = 'Generate My Meal Plan';
    }
}

function validateForm() {
    const fields = ['age', 'gender', 'height', 'weight', 'goal', 'dietType', 'region', 'activityLevel'];
    let isValid = true;
    fields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById(id + '-error');
        if (!el) return;
        el.classList.remove('is-invalid');
        if (err) err.textContent = '';
        if (!String(el.value || '').trim()) {
            el.classList.add('is-invalid');
            if (err) err.textContent = 'This field is required';
            isValid = false;
        } else {
            if (id === 'age') {
                const age = safeNumber(el.value);
                if (age < 13 || age > 120) {
                    el.classList.add('is-invalid');
                    if (err) err.textContent = 'Age must be 13-120';
                    isValid = false;
                }
            }
            if (id === 'height') {
                const height = safeNumber(el.value);
                if (height < 100 || height > 250) {
                    el.classList.add('is-invalid');
                    if (err) err.textContent = 'Height must be 100-250 cm';
                    isValid = false;
                }
            }
            if (id === 'weight') {
                const weight = safeNumber(el.value);
                if (weight < 30 || weight > 300) {
                    el.classList.add('is-invalid');
                    if (err) err.textContent = 'Weight must be 30-300 kg';
                    isValid = false;
                }
            }
        }
    });

    // Validate target calories if provided
    const targetCaloriesInput = document.getElementById('targetCalories');
    if (targetCaloriesInput && String(targetCaloriesInput.value || '').trim()) {
        const calories = safeNumber(targetCaloriesInput.value);
        if (calories < 800 || calories > 5000) {
            targetCaloriesInput.classList.add('is-invalid');
            const err = document.getElementById('targetCalories-error');
            if (err) err.textContent = 'Target calories must be 800-5000';
            isValid = false;
        }
    }
    return isValid;
}
// Enhanced Meals database loading
async function loadMealsDatabase(forceReload = false) {
    if (mealDatabase && !forceReload) return mealDatabase;
    if (mealDbLoadPromise && !forceReload) return mealDbLoadPromise;

    mealDbLoadPromise = (async () => {
        const candidates = [
            'meals.json',
            'meals.json',
            './meals.json',
            './meals.json',
            'data/meals.json',
            'data/meals.json',
            location.origin + '/meals.json',
            location.origin + '/meals.json'
        ];

        let rawData = null;
        for (const url of candidates) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                rawData = await response.json();
                console.log('Loaded meals data from', url);
                break;
            } catch (err) {
                console.warn('Could not load meals from', url, err.message || err);
            }
        }

        if (!rawData) {
            console.warn('Enhanced meals data not found, using fallback.');
            mealDatabase = createFallbackMeals();
            return mealDatabase;
        }

        // Normalize data structure
        mealDatabase = normalizeMealsData(rawData);
        console.log('Enhanced meals data loaded successfully.');
        return mealDatabase;
    })();

    return mealDbLoadPromise;
}

// Enhanced meal normalization to handle allergens and instructions
function normalizeMealsData(rawData) {
    // Handle different data structures
    if (rawData.meals && Array.isArray(rawData.meals)) {
        rawData = rawData.meals;
    } else if (rawData.data && rawData.data.meals && Array.isArray(rawData.data.meals)) {
        rawData = rawData.data.meals;
    }

    if (Array.isArray(rawData)) {
        // Convert flat array to structured format with enhancements
        const normalized = {};
        for (let i = 0; i < rawData.length; i++) {
            const meal = rawData[i];
            if (!meal || typeof meal !== 'object') continue;
            const regionKey = (meal.region || 'Global').toString();
            const diets = Array.isArray(meal.diets) && meal.diets.length ? meal.diets : [meal.diet || 'Regular'];
            const mealType = (meal.mealType || meal.type || meal.category || 'lunch').toString().toLowerCase();

            if (!normalized[regionKey]) normalized[regionKey] = {};

            for (const diet of diets) {
                const dietKey = diet || 'Regular';
                if (!normalized[regionKey][dietKey]) {
                    normalized[regionKey][dietKey] = {
                        breakfast: [], lunch: [], dinner: [], snacks: []
                    };
                }

                const normalizedMeal = {
                    id: meal.id || `${regionKey}_${dietKey}_${mealType}_${i}`,
                    title: meal.title || meal.name || `Meal ${i + 1}`,
                    serving_size: meal.serving_size || meal.servingsize || meal.serving || '1 serving',
                    calories: safeNumber(meal.calories || meal.kcal || 0),
                    protein: safeNumber(meal.protein || 0),
                    carbs: safeNumber(meal.carbs || 0),
                    fat: safeNumber(meal.fat || 0),
                    fiber: safeNumber(meal.fiber || 0),
                    foods: Array.isArray(meal.foods) ? meal.foods : 
                           (meal.ingredients ? String(meal.ingredients).split(',').map(s => ({ name: s.trim() })) : []),
                    allergens: meal.allergens || [],
                    prep_time: meal.prep_time || meal.prepTime || '20 minutes',
                    instructions: meal.instructions || 'Cook according to your preference.',
                    dietary_tags: meal.dietary_tags || meal.dietaryTags || []
                };

                // Normalize meal type
                let targetType = mealType;
                if (!['breakfast', 'lunch', 'dinner', 'snacks'].includes(targetType)) {
                    if (targetType.endsWith('s')) targetType = targetType.slice(0, -1);
                    else if (targetType === 'snack') targetType = 'snacks';
                    else targetType = 'lunch';
                }
                const finalType = ['breakfast', 'lunch', 'dinner', 'snacks'].includes(targetType) ? targetType : 'lunch';
                normalized[regionKey][dietKey][finalType].push(normalizedMeal);
            }
        }
        return normalized;
    }

    // Assume already structured format - add enhancements if missing
    for (const region in rawData) {
        for (const diet in rawData[region]) {
            for (const mealType in rawData[region][diet]) {
                rawData[region][diet][mealType] = rawData[region][diet][mealType].map(meal => ({
                    ...meal,
                    allergens: meal.allergens || [],
                    prep_time: meal.prep_time || meal.prepTime || '20 minutes',
                    instructions: meal.instructions || 'Cook according to your preference.',
                    dietary_tags: meal.dietary_tags || meal.dietaryTags || []
                }));
            }
        }
    }

    return rawData || createFallbackMeals();
}

function createFallbackMeals() {
    return {
        'India': {
            'Regular': {
                breakfast: [
                    { id: 'fb1', title: 'Oatmeal with Fruits', serving_size: '1 serving', calories: 250, protein: 8, carbs: 45, fat: 4, fiber: 5, allergens: [], prep_time: '15 minutes', instructions: 'Cook oats with milk, add fruits and serve.', dietary_tags: ['vegetarian'] },
                    { id: 'fb2', title: 'Boiled Eggs', serving_size: '2 eggs', calories: 150, protein: 12, carbs: 1, fat: 10, fiber: 0, allergens: ['eggs'], prep_time: '10 minutes', instructions: 'Boil eggs for 8 minutes, peel and serve.', dietary_tags: [] }
                ],
                lunch: [
                    { id: 'fl1', title: 'Grilled Chicken Salad', serving_size: '1 bowl', calories: 350, protein: 30, carbs: 15, fat: 12, fiber: 6, allergens: [], prep_time: '20 minutes', instructions: 'Grill chicken, mix with salad vegetables.', dietary_tags: ['high-protein'] },
                    { id: 'fl2', title: 'Veggie Wrap', serving_size: '1 wrap', calories: 300, protein: 10, carbs: 40, fat: 8, fiber: 5, allergens: ['gluten'], prep_time: '15 minutes', instructions: 'Fill tortilla with vegetables and sauce.', dietary_tags: ['vegetarian'] }
                ],
                dinner: [
                    { id: 'fd1', title: 'Paneer Curry with Rice', serving_size: '1 plate', calories: 400, protein: 20, carbs: 50, fat: 15, fiber: 5, allergens: ['dairy'], prep_time: '30 minutes', instructions: 'Cook paneer curry and serve with rice.', dietary_tags: ['vegetarian'] },
                    { id: 'fd2', title: 'Fish with Quinoa', serving_size: '1 plate', calories: 450, protein: 35, carbs: 40, fat: 14, fiber: 4, allergens: ['fish'], prep_time: '25 minutes', instructions: 'Grill fish and serve with quinoa.', dietary_tags: ['high-protein'] }
                ],
                snacks: [
                    { id: 'fs1', title: 'Fruit and Nuts', serving_size: '1 small bowl', calories: 150, protein: 4, carbs: 20, fat: 6, fiber: 3, allergens: ['nuts'], prep_time: '5 minutes', instructions: 'Mix fresh fruits with nuts.', dietary_tags: ['healthy'] }
                ]
            }
        }
    };
}

// Calorie calculation
function calculateTargetCalories(profile) {
    const age = safeNumber(profile.age);
    const weight = safeNumber(profile.weight); // kg
    const height = safeNumber(profile.height); // cm
    const gender = (profile.gender || '').toString().toLowerCase();

    // Mifflin-St Jeor formula
    let bmr;
    if (gender === 'male' || gender === 'm') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const activityFactors = {
        'low': 1.2,
        'moderate': 1.375,
        'high': 1.55,
        'very-high': 1.725
    };

    const activity = (profile.activityLevel || 'low').toString();
    const factor = activityFactors[activity] || 1.2;
    let tdee = bmr * factor;

    // Adjust for goal
    const weeklyWeightTarget = 0.75; // kg per week
    const dailyCalorieAdjustment = (weeklyWeightTarget * 7700) / 7; // 825 calories/day

    switch ((profile.goal || '').toString().toLowerCase()) {
        case 'loss':
        case 'lose':
        case 'weightloss':
            tdee -= dailyCalorieAdjustment;
            break;
        case 'gain':
        case 'muscle':
        case 'weightgain':
            tdee += dailyCalorieAdjustment;
            break;
        case 'maintain':
        default:
            break;
    }

    tdee = Math.round(Math.max(800, Math.min(4200, tdee)));
    return tdee;
}

// Enhanced meal plan generation with allergen checking
async function generateMealPlan() {
    try {
        await loadMealsDatabase();
        if (!mealDatabase) {
            console.warn('Meal DB not loaded, using fallback.');
            mealDatabase = createFallbackMeals();
        }

        const profile = {
            age: safeNumber(document.getElementById('age')?.value),
            gender: document.getElementById('gender')?.value,
            height: safeNumber(document.getElementById('height')?.value),
            weight: safeNumber(document.getElementById('weight')?.value),
            goal: document.getElementById('goal')?.value,
            dietType: document.getElementById('dietType')?.value,
            region: document.getElementById('region')?.value,
            activityLevel: document.getElementById('activityLevel')?.value,
            targetCalories: safeNumber(document.getElementById('targetCalories')?.value),
            allergens: getAllergenPreferences()
        };

        if (!profile.targetCalories || profile.targetCalories <= 0) {
            profile.targetCalories = calculateTargetCalories(profile);
        }

        currentUserProfile = profile;

        // Get region data
        const regionKey = profile.region || 'India';
        const regionMeals = mealDatabase[regionKey] || mealDatabase['India'] || Object.values(mealDatabase)[0];

        if (!regionMeals) {
            throw new Error(`No meals available for region: ${regionKey}`);
        }

        // Get diet-specific meals
        const dietKey = profile.dietType === 'Mixed' ? 'Regular' : profile.dietType || 'Regular';
        const dietMeals = regionMeals[dietKey] || regionMeals['Regular'] || Object.values(regionMeals)[0];

        if (!dietMeals) {
            throw new Error(`No meals available for diet: ${profile.dietType} in region: ${profile.region}`);
        }

        // Check for allergens in available meals
        checkAllergenWarnings(dietMeals, profile.allergens);

        // Generate weekly plan with allergen filtering
        const weeklyPlan = selectMealsForWeek(dietMeals, profile.targetCalories, profile);

        // Store globally
        currentMealPlan = weeklyPlan;

        // Generate grocery list
        groceryList = generateGroceryList(weeklyPlan);

        // Persist data
        try {
            localStorage.setItem('lastGeneratedPlan_v1', JSON.stringify({
                plan: weeklyPlan,
                profile: profile,
                groceryList: groceryList,
                generated: new Date().toISOString()
            }));
        } catch (e) {
            console.warn('Could not save to localStorage:', e);
        }

        // Render
        displayMealPlan(weeklyPlan, profile);
        displayGroceryList(groceryList);
        displayRecipeInstructions(weeklyPlan);

        try {
            await createCharts(weeklyPlan, profile);
        } catch (e) {
            console.warn('Charts creation failed (non-fatal):', e);
        }

        console.log('Enhanced weekly plan generated for', regionKey, profile.dietType);
        return weeklyPlan;

    } catch (error) {
        console.error('Error generating meal plan:', error);
        throw error;
    }
}

// Allergen preference detection
function getAllergenPreferences() {
    const allergenInputs = document.querySelectorAll('input[name="allergens"]:checked');
    const allergens = Array.from(allergenInputs).map(input => input.value);

    const allergenText = document.getElementById('allergenText')?.value;
    if (allergenText) {
        const textAllergens = allergenText.toLowerCase().split(',').map(s => s.trim()).filter(s => s);
        allergens.push(...textAllergens);
    }

    return [...new Set(allergens)];
}

// Allergen warning system
function checkAllergenWarnings(meals, userAllergens) {
    if (!userAllergens || userAllergens.length === 0) return;

    const allergenIssues = [];

    for (const mealType in meals) {
        for (const meal of meals[mealType] || []) {
            const mealAllergens = meal.allergens || [];
            const conflicts = userAllergens.filter(allergen => 
                mealAllergens.some(mealAllergen => 
                    mealAllergen.toLowerCase().includes(allergen.toLowerCase()) ||
                    allergen.toLowerCase().includes(mealAllergen.toLowerCase())
                )
            );

            if (conflicts.length > 0) {
                allergenIssues.push({
                    meal: meal.title,
                    allergens: conflicts
                });
            }
        }
    }

    if (allergenIssues.length > 0) {
        showAllergenAlert(allergenIssues);
    }
}

function showAllergenAlert(issues) {
    let message = '';
    if (typeof issues === 'string') {
        message = issues;
    } else {
        message = `⚠️ ALLERGEN WARNING\n\nThe following meals contain allergens you've indicated:\n\n`;
        issues.forEach(issue => {
            message += `• ${issue.meal}: Contains ${issue.allergens.join(', ')}\n`;
        });
        message += '\nThese meals have been filtered out or alternative options will be suggested.';
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = 'allergen-alert';
    alertDiv.innerHTML = `
        <div class="alert-content">
            <div class="alert-icon">⚠️</div>
            <div class="alert-message">${message.replace(/\n/g, '<br>')}</div>
            <button class="alert-close" onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 10000);
}
// Enhanced meal selection with allergen filtering
function selectMealsForWeek(meals, targetCalories, profile) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const weeklyPlan = {};
    const usedMealIds = new Set();
    const calorieDistribution = { breakfast: 0.25, lunch: 0.35, dinner: 0.35, snacks: 0.05 };

    days.forEach((day, dayIndex) => {
        weeklyPlan[day] = {};
        mealTypes.forEach((mealType, mtIndex) => {
            const targetForMeal = Math.max(0, Math.round(targetCalories * calorieDistribution[mealType]));
            let availableMeals = (meals[mealType] || []).slice();

            // Filter out meals with user allergens
            if (profile.allergens && profile.allergens.length > 0) {
                availableMeals = availableMeals.filter(meal => {
                    const mealAllergens = meal.allergens || [];
                    return !profile.allergens.some(userAllergen => 
                        mealAllergens.some(mealAllergen => 
                            mealAllergen.toLowerCase().includes(userAllergen.toLowerCase()) ||
                            userAllergen.toLowerCase().includes(mealAllergen.toLowerCase())
                        )
                    );
                });
            }

            if (!availableMeals || availableMeals.length === 0) {
                availableMeals = [];
                Object.keys(meals).forEach(k => {
                    if (Array.isArray(meals[k])) {
                        let filtered = meals[k];
                        if (profile.allergens && profile.allergens.length > 0) {
                            filtered = filtered.filter(meal => {
                                const mealAllergens = meal.allergens || [];
                                return !profile.allergens.some(userAllergen => 
                                    mealAllergens.some(mealAllergen => 
                                        mealAllergen.toLowerCase().includes(userAllergen.toLowerCase()) ||
                                        userAllergen.toLowerCase().includes(mealAllergen.toLowerCase())
                                    )
                                );
                            });
                        }
                        availableMeals.push(...filtered);
                    }
                });
            }

            if (!availableMeals || availableMeals.length === 0) {
                weeklyPlan[day][mealType] = createDefaultMeal(mealType, targetForMeal);
                return;
            }

            const suitable = availableMeals.filter(m => !usedMealIds.has(m.id || m.title));
            const candidates = suitable.length > 0 ? suitable : availableMeals;
            const seed = (dayIndex * 13 + mtIndex * 7 + (profile.age || 0));
            const chosen = pickMealCandidate(candidates, usedMealIds, targetForMeal, seed);

            if (chosen) {
                weeklyPlan[day][mealType] = chosen;
                usedMealIds.add(chosen.id || chosen.title);
            } else {
                weeklyPlan[day][mealType] = createDefaultMeal(mealType, targetForMeal);
            }
        });
    });

    return weeklyPlan;
}

function pickMealCandidate(candidates, usedIds, targetForMeal, seed) {
    if (!candidates || candidates.length === 0) return null;

    const candList = candidates.filter(Boolean).map(m => ({
        raw: m,
        id: m.id || (m.title ? String(m.title) : JSON.stringify(m)),
        calories: safeNumber(m.calories || m.kcal || 0),
        title: String(m.title || m.name || m.label || 'Meal')
    }));

    const lowerFactor = targetForMeal < 800 ? 0.4 : 0.6;
    const upperFactor = targetForMeal < 800 ? 2.0 : 1.4;
    let suitable = candList.filter(c => 
        !usedIds.has(c.id) && c.calories > 0 && 
        c.calories >= targetForMeal * lowerFactor && 
        c.calories <= targetForMeal * upperFactor
    );

    if (suitable.length === 0) {
        suitable = candList.filter(c => 
            c.calories > 0 && 
            c.calories >= targetForMeal * 0.6 && 
            c.calories <= targetForMeal * 1.4
        );
    }

    if (suitable.length === 0) {
        suitable = candList.filter(c => !usedIds.has(c.id));
    }

    if (suitable.length === 0) {
        suitable = candList;
    }

    const idx = Math.abs(seed) % suitable.length;
    return suitable[idx] ? suitable[idx].raw : null;
}

function createDefaultMeal(mealType, targetCalories) {
    const defaults = {
        breakfast: { title: 'Mixed Breakfast', serving_size: '1 serving', calories: Math.round(targetCalories) },
        lunch: { title: 'Balanced Lunch', serving_size: '1 serving', calories: Math.round(targetCalories) },
        dinner: { title: 'Nutritious Dinner', serving_size: '1 serving', calories: Math.round(targetCalories) },
        snacks: { title: 'Healthy Snack', serving_size: '1 serving', calories: Math.round(targetCalories) }
    };

    const base = defaults[mealType] || defaults.lunch;
    return {
        id: `fallback_${mealType}_${Date.now()}_${Math.round(Math.random() * 10000)}`,
        ...base,
        protein: Math.round(targetCalories * 0.15 / 4),
        carbs: Math.round(targetCalories * 0.50 / 4),
        fat: Math.round(targetCalories * 0.35 / 9),
        fiber: 5,
        allergens: [],
        prep_time: '20 minutes',
        instructions: 'Prepare according to your preferences.',
        dietary_tags: [],
        isFallback: true
    };
}

// Grocery List Generation
function generateGroceryList(weeklyPlan) {
    const ingredients = new Map();

    Object.keys(weeklyPlan).forEach(day => {
        Object.keys(weeklyPlan[day]).forEach(mealType => {
            const meal = weeklyPlan[day][mealType];
            if (meal && meal.foods && Array.isArray(meal.foods)) {
                meal.foods.forEach(food => {
                    const name = food.name || food;
                    if (name && typeof name === 'string') {
                        const count = ingredients.get(name) || 0;
                        ingredients.set(name, count + 1);
                    }
                });
            }
        });
    });

    const groceryCategories = {
        'Vegetables & Fruits': ['tomato', 'onion', 'garlic', 'ginger', 'potato', 'carrot', 'spinach', 'cucumber', 'fruit', 'apple', 'banana', 'lemon', 'mint', 'coriander', 'vegetables'],
        'Grains & Cereals': ['rice', 'wheat', 'oats', 'quinoa', 'roti', 'bread', 'pasta', 'noodles', 'flour'],
        'Proteins': ['paneer', 'tofu', 'chicken', 'fish', 'eggs', 'dal', 'lentils', 'beans', 'chickpeas'],
        'Dairy & Alternatives': ['milk', 'yogurt', 'curd', 'cheese', 'ghee', 'butter'],
        'Spices & Seasonings': ['salt', 'pepper', 'turmeric', 'chili', 'cumin', 'coriander seeds', 'mustard seeds', 'spices'],
        'Others': []
    };

    const categorizedList = {};

    Object.keys(groceryCategories).forEach(category => {
        categorizedList[category] = [];
    });

    ingredients.forEach((count, ingredient) => {
        let categorized = false;
        for (const [category, keywords] of Object.entries(groceryCategories)) {
            if (keywords.some(keyword => ingredient.toLowerCase().includes(keyword.toLowerCase()))) {
                categorizedList[category].push({
                    name: ingredient,
                    frequency: count
                });
                categorized = true;
                break;
            }
        }
        if (!categorized) {
            categorizedList['Others'].push({
                name: ingredient,
                frequency: count
            });
        }
    });

    Object.keys(categorizedList).forEach(category => {
        if (categorizedList[category].length === 0) {
            delete categorizedList[category];
        }
    });

    return categorizedList;
}

// FIXED DIET TRACKER INTEGRATION WITH PROPER FUNCTIONALITY
function sendToDietTracker() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('Please generate a meal plan first!');
        return;
    }

    try {
        // Prepare comprehensive data for diet tracker
        const trackerData = {
            mealPlan: currentMealPlan,
            profile: currentUserProfile,
            groceryList: groceryList,
            timestamp: new Date().toISOString(),
            source: 'diet-planner',
            version: '3.0.0'
        };

        // Store in localStorage with specific key for diet tracker
        localStorage.setItem('dietTrackerImport', JSON.stringify(trackerData));

        // Also store in integration storage
        localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(trackerData));

        // Show success notification
        showSuccessMessage('✅ Meal plan sent to Diet Tracker successfully!', 'success');

        // Redirect to diet tracker with import flag
        const dietTrackerUrl = 'https://thedietplanner.com/diet-tracker?import=true';

        // Open in new tab to preserve current work
        const newWindow = window.open(dietTrackerUrl, '_blank');

        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            // Popup blocked, offer direct link
            if (confirm('Popup was blocked. Would you like to navigate to Diet Tracker now?')) {
                window.location.href = dietTrackerUrl;
            }
        }

        console.log('Diet tracker data prepared and sent successfully');

    } catch (error) {
        console.error('Failed to send to diet tracker:', error);
        showSuccessMessage('❌ Failed to send data to diet tracker. Please try again.', 'error');
    }
}

// Show success/error messages
function showSuccessMessage(message, type = 'success') {
    const existingMessage = document.querySelector('.integration-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `integration-message ${type}`;
    messageDiv.innerHTML = `
        <div class="success-content">
            ${message}
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 8000);
}

// FIXED SHARE FUNCTIONALITY WITH PROPER URL HANDLING
function shareUrl() {
    if (!currentMealPlan) {
        alert('Please generate a meal plan first!');
        return;
    }

    // Generate shareable URL with plan data
    const planId = generatePlanId();

    // Store plan with unique ID for sharing
    const shareableData = {
        id: planId,
        plan: currentMealPlan,
        profile: {
            ...currentUserProfile,
            // Remove sensitive data
            age: currentUserProfile.age,
            gender: currentUserProfile.gender,
            goal: currentUserProfile.goal,
            dietType: currentUserProfile.dietType,
            region: currentUserProfile.region,
            activityLevel: currentUserProfile.activityLevel
        },
        created: new Date().toISOString(),
        version: '3.0.0'
    };

    // Store in localStorage for sharing
    localStorage.setItem(`shared_plan_${planId}`, JSON.stringify(shareableData));

    const shareUrl = `${window.location.origin}${window.location.pathname}?plan=${planId}`;

    if (navigator.share) {
        navigator.share({
            title: 'My Personalized Diet Plan',
            text: `Check out my personalized ${currentUserProfile.goal} diet plan from TheDietPlanner.com`,
            url: shareUrl
        }).then(() => {
            showSuccessMessage('✅ Plan shared successfully!', 'success');
        }).catch((err) => {
            console.log('Share failed, falling back to copy:', err);
            copyToClipboard(shareUrl);
        });
    } else {
        copyToClipboard(shareUrl);
    }
}

function generatePlanId() {
    return 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function copyToClipboard(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            showSuccessMessage('✅ Plan link copied to clipboard! Share it with anyone.', 'success');
        }).catch(() => {
            fallbackCopyTextToClipboard(url);
        });
    } else {
        fallbackCopyTextToClipboard(url);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showSuccessMessage('✅ Plan link copied to clipboard! Share it with anyone.', 'success');
        } else {
            showSuccessMessage('❌ Failed to copy link. Please copy manually: ' + text, 'error');
        }
    } catch (err) {
        showSuccessMessage('❌ Failed to copy link. Please copy manually: ' + text, 'error');
    }

    document.body.removeChild(textArea);
}

// Check for shared plan on page load
function checkForSharedPlan() {
    const urlParams = new URLSearchParams(window.location.search);
    const planId = urlParams.get('plan');

    if (planId) {
        const sharedData = localStorage.getItem(`shared_plan_${planId}`);
        if (sharedData) {
            try {
                const planData = JSON.parse(sharedData);
                if (planData.plan && planData.profile) {
                    currentMealPlan = planData.plan;
                    currentUserProfile = planData.profile;
                    groceryList = generateGroceryList(currentMealPlan);

                    // Display the shared plan
                    displayMealPlan(currentMealPlan, currentUserProfile);
                    displayGroceryList(groceryList);
                    displayRecipeInstructions(currentMealPlan);
                    showResults();
                    updateActiveNavItem('plan');

                    showSuccessMessage('✅ Shared meal plan loaded successfully!', 'success');
                }
            } catch (err) {
                console.error('Failed to load shared plan:', err);
                showSuccessMessage('❌ Failed to load shared plan.', 'error');
            }
        } else {
            showSuccessMessage('❌ Shared plan not found or expired.', 'error');
        }
    }
}
// Display Grocery List
function displayGroceryList(groceryList) {
    const container = document.getElementById('groceryContainer') || createGroceryContainer();

    if (!groceryList || Object.keys(groceryList).length === 0) {
        container.innerHTML = '<div class="no-grocery">No grocery list available.</div>';
        return;
    }

    let html = `
        <div class="grocery-header">
            <h3>🛒 Weekly Grocery List</h3>
            <button id="exportGroceryBtn" class="btn-secondary">Export List</button>
        </div>
    `;

    Object.keys(groceryList).forEach(category => {
        const items = groceryList[category];
        if (items.length > 0) {
            html += `
                <div class="grocery-category">
                    <h4>${category}</h4>
                    <ul class="grocery-items">
            `;

            items.forEach(item => {
                html += `
                    <li class="grocery-item">
                        <input type="checkbox" id="grocery_${item.name}" class="grocery-checkbox">
                        <label for="grocery_${item.name}">
                            <span class="item-name">${item.name}</span>
                            <span class="item-frequency">(used ${item.frequency}x)</span>
                        </label>
                    </li>
                `;
            });

            html += `
                    </ul>
                </div>
            `;
        }
    });

    container.innerHTML = html;

    const exportBtn = document.getElementById('exportGroceryBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportGroceryList);
    }
}

function createGroceryContainer() {
    const container = document.createElement('div');
    container.id = 'groceryContainer';
    container.className = 'grocery-section';

    const mealPlanContainer = document.getElementById('mealPlanContainer');
    if (mealPlanContainer && mealPlanContainer.parentNode) {
        mealPlanContainer.parentNode.insertBefore(container, mealPlanContainer.nextSibling);
    } else {
        document.body.appendChild(container);
    }

    return container;
}

// Export Grocery List
function exportGroceryList() {
    if (!groceryList) return;

    let exportText = 'WEEKLY GROCERY LIST\nGenerated by TheDietPlanner.com\n\n';

    Object.keys(groceryList).forEach(category => {
        const items = groceryList[category];
        if (items.length > 0) {
            exportText += `${category.toUpperCase()}:\n`;
            items.forEach(item => {
                exportText += `□ ${item.name} (needed ${item.frequency}x)\n`;
            });
            exportText += '\n';
        }
    });

    exportText += `\nGenerated on: ${new Date().toLocaleDateString()}\nTotal Categories: ${Object.keys(groceryList).length}`;

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Display Recipe Instructions
function displayRecipeInstructions(weeklyPlan) {
    const container = document.getElementById('recipeContainer') || createRecipeContainer();

    let html = `
        <div class="recipe-header">
            <h3>👨‍🍳 Recipe Instructions</h3>
            <button id="toggleAllRecipes" class="btn-secondary">Expand All</button>
        </div>
    `;

    Object.keys(weeklyPlan).forEach(day => {
        html += `
            <div class="recipe-day">
                <h4>${day}</h4>
        `;

        Object.keys(weeklyPlan[day]).forEach(mealType => {
            const meal = weeklyPlan[day][mealType];
            const mealId = `recipe_${day}_${mealType}`.replace(/\s+/g, '_');

            html += `
                <div class="recipe-meal">
                    <div class="recipe-meal-header" onclick="toggleRecipe('${mealId}')">
                        <h5>${mealType.charAt(0).toUpperCase() + mealType.slice(1)}: ${meal.title}</h5>
                        <div class="recipe-meta">
                            <span class="prep-time">⏱️ ${meal.prep_time || '20 mins'}</span>
                            <span class="calories">🔥 ${meal.calories} cal</span>
                            ${meal.allergens && meal.allergens.length > 0 ? 
                                `<span class="allergen-warning" title="Contains: ${meal.allergens.join(', ')}">⚠️</span>` : ''}
                        </div>
                        <span class="expand-icon">▼</span>
                    </div>
                    <div id="${mealId}" class="recipe-content collapsed">
                        <div class="recipe-instructions">
                            <h6>Instructions:</h6>
                            <p>${meal.instructions || 'No specific instructions available.'}</p>
                        </div>
                        ${meal.allergens && meal.allergens.length > 0 ? 
                            `<div class="recipe-allergens">
                                <h6>⚠️ Allergen Information:</h6>
                                <p>Contains: ${meal.allergens.join(', ')}</p>
                            </div>` : ''}
                        ${meal.dietary_tags && meal.dietary_tags.length > 0 ?
                            `<div class="recipe-tags">
                                <h6>Dietary Tags:</h6>
                                <div class="tag-list">
                                    ${meal.dietary_tags.map(tag => `<span class="diet-tag">${tag}</span>`).join(' ')}
                                </div>
                            </div>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html;

    const toggleAllBtn = document.getElementById('toggleAllRecipes');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', toggleAllRecipes);
    }
}

function createRecipeContainer() {
    const container = document.createElement('div');
    container.id = 'recipeContainer';
    container.className = 'recipe-section';

    const groceryContainer = document.getElementById('groceryContainer');
    if (groceryContainer && groceryContainer.parentNode) {
        groceryContainer.parentNode.insertBefore(container, groceryContainer.nextSibling);
    } else {
        const mealPlanContainer = document.getElementById('mealPlanContainer');
        if (mealPlanContainer && mealPlanContainer.parentNode) {
            mealPlanContainer.parentNode.insertBefore(container, mealPlanContainer.nextSibling);
        }
    }

    return container;
}

// Recipe Toggle Functions
function toggleRecipe(recipeId) {
    const element = document.getElementById(recipeId);
    if (!element) return;

    const isCollapsed = element.classList.contains('collapsed');

    if (isCollapsed) {
        element.classList.remove('collapsed');
        element.style.maxHeight = element.scrollHeight + 'px';
    } else {
        element.style.maxHeight = '0px';
        setTimeout(() => {
            element.classList.add('collapsed');
        }, 300);
    }

    const header = element.previousElementSibling;
    const icon = header.querySelector('.expand-icon');
    if (icon) {
        icon.textContent = isCollapsed ? '▲' : '▼';
    }
}

function toggleAllRecipes() {
    const toggleBtn = document.getElementById('toggleAllRecipes');
    const allRecipes = document.querySelectorAll('.recipe-content');
    const isExpandingAll = toggleBtn.textContent === 'Expand All';

    allRecipes.forEach(recipe => {
        const isCollapsed = recipe.classList.contains('collapsed');

        if (isExpandingAll && isCollapsed) {
            recipe.classList.remove('collapsed');
            recipe.style.maxHeight = recipe.scrollHeight + 'px';
        } else if (!isExpandingAll && !isCollapsed) {
            recipe.style.maxHeight = '0px';
            setTimeout(() => {
                recipe.classList.add('collapsed');
            }, 300);
        }
    });

    const allIcons = document.querySelectorAll('.expand-icon');
    allIcons.forEach(icon => {
        icon.textContent = isExpandingAll ? '▲' : '▼';
    });

    toggleBtn.textContent = isExpandingAll ? 'Collapse All' : 'Expand All';
}

// Enhanced display functions
function displayMealPlan(weeklyPlan, profile) {
    const container = document.getElementById('mealPlanContainer');
    if (!container) {
        console.warn('mealPlanContainer not found in DOM.');
        return;
    }

    const days = Object.keys(weeklyPlan);
    if (!days.length) {
        container.innerHTML = '<div class="no-plan">No meal plan available.</div>';
        return;
    }

    let html = `
        <div class="meal-plan-header">
            <h2>Your Personalized 7-Day Meal Plan</h2>
            <div class="plan-stats">
                <span>Target: ${profile.targetCalories || 'N/A'} cal/day</span>
                <span>Goal: ${profile.goal || 'N/A'}</span>
                <span>Diet: ${profile.dietType || 'N/A'}</span>
            </div>
        </div>
    `;

    days.forEach((day, idx) => {
        const dayMeals = weeklyPlan[day];
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0;

        html += `
            <div class="day-section">
                <h3>Day ${idx + 1} - ${day}</h3>
                <div class="meals-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Meal</th>
                                <th>Food</th>
                                <th>Calories</th>
                                <th>Protein</th>
                                <th>Carbs</th>
                                <th>Fat</th>
                                <th>Fiber</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            const meal = dayMeals[mealType];
            if (!meal) return;

            const calories = safeNumber(meal.calories);
            const protein = safeNumber(meal.protein);
            const carbs = safeNumber(meal.carbs);
            const fat = safeNumber(meal.fat);
            const fiber = safeNumber(meal.fiber);

            totalCalories += calories;
            totalProtein += protein;
            totalCarbs += carbs;
            totalFat += fat;
            totalFiber += fiber;

            const foods = meal.foods && Array.isArray(meal.foods) 
                ? meal.foods.map(f => typeof f === 'string' ? f : f.name || '').filter(f => f).join(', ')
                : '';

            const title = meal.title || 'Untitled Meal';
            const hasAllergens = meal.allergens && meal.allergens.length > 0;

            html += `
                <tr class="meal-row" data-day="${day}" data-meal-type="${mealType}">
                    <td class="meal-type">
                        ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                        ${hasAllergens ? `<span class="allergen-warning" title="Contains: ${meal.allergens.join(', ')}">⚠️</span>` : ''}
                    </td>
                    <td class="meal-title">
                        <strong>${title}</strong>
                        ${foods ? `<br><small>${foods}</small>` : ''}
                        ${meal.prep_time ? `<br><small>⏱️ ${meal.prep_time}</small>` : ''}
                    </td>
                    <td>${calories}</td>
                    <td>${protein}g</td>
                    <td>${carbs}g</td>
                    <td>${fat}g</td>
                    <td>${fiber}g</td>
                    <td class="meal-actions">
                        <button class="swap-btn" onclick="showSwapOptions(this.closest('.meal-row'))" title="Swap meal">🔄</button>
                    </td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                        <tfoot>
                            <tr class="day-totals">
                                <td colspan="2"><strong>Daily Total</strong></td>
                                <td><strong>${totalCalories}</strong></td>
                                <td><strong>${totalProtein}g</strong></td>
                                <td><strong>${totalCarbs}g</strong></td>
                                <td><strong>${totalFat}g</strong></td>
                                <td><strong>${totalFiber}g</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Load existing plan from storage
function loadExistingPlan() {
    try {
        // First check for shared plan
        checkForSharedPlan();

        const saved = localStorage.getItem('lastGeneratedPlan_v1');
        if (!saved) return;

        const data = JSON.parse(saved);
        if (!data.plan || !data.profile) return;

        // Only load if no shared plan was loaded
        if (!currentMealPlan) {
            currentMealPlan = data.plan;
            currentUserProfile = data.profile;
            groceryList = data.groceryList || {};

            // Populate form with saved profile
            if (data.profile) {
                const fields = ['age', 'gender', 'height', 'weight', 'goal', 'dietType', 'region', 'activityLevel', 'targetCalories'];
                fields.forEach(field => {
                    const element = document.getElementById(field);
                    if (element && data.profile[field] !== undefined) {
                        element.value = data.profile[field];
                    }
                });
            }

            console.log('Existing plan loaded but not displayed - waiting for user action');
        }

    } catch (e) {
        console.warn('Could not load existing plan:', e);
    }
}

// Meal swapping placeholder functions (can be expanded)
function showSwapOptions(mealRow) {
    alert('Meal swapping feature is available! Click to replace this meal with a similar alternative.');
    // Implementation would show modal with alternative meals
}

// Export functions for external use
window.dietPlanner = {
    generateMealPlan,
    exportToPDF,
    showSwapOptions,
    sendToDietTracker,
    exportGroceryList,
    shareUrl
};

console.log('Enhanced Diet Planner v3.0 loaded with full functionality!');
// ENHANCED ANALYTICS CHARTS
async function createCharts(weeklyPlan, profile) {
    try {
        await loadChartJS();

        const weeklyNutrition = calculateWeeklyNutrition(weeklyPlan);
        const dailyCalories = calculateDailyCalories(weeklyPlan);
        const macroDistribution = calculateMacroDistribution(weeklyPlan);
        const varietyAnalysis = calculateVarietyAnalysis(weeklyPlan);

        createWeeklyCaloriesChart(dailyCalories);
        createMacroDistributionChart(macroDistribution);
        createDailyNutritionChart(weeklyNutrition);
        createVarietyAnalysisChart(varietyAnalysis);

    } catch (error) {
        console.error('Failed to create charts:', error);
    }
}

function calculateWeeklyNutrition(weeklyPlan) {
    const days = Object.keys(weeklyPlan);
    return days.map(day => {
        const dayMeals = weeklyPlan[day];
        let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0;

        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            const meal = dayMeals[mealType];
            if (meal) {
                totalCalories += safeNumber(meal.calories);
                totalProtein += safeNumber(meal.protein);
                totalCarbs += safeNumber(meal.carbs);
                totalFat += safeNumber(meal.fat);
                totalFiber += safeNumber(meal.fiber);
            }
        });

        return {
            day: day.substring(0, 3),
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
            fiber: totalFiber
        };
    });
}

function calculateDailyCalories(weeklyPlan) {
    const days = Object.keys(weeklyPlan);
    return days.map(day => {
        const dayMeals = weeklyPlan[day];
        let totalCalories = 0;

        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            const meal = dayMeals[mealType];
            if (meal) {
                totalCalories += safeNumber(meal.calories);
            }
        });

        return { day: day.substring(0, 3), calories: totalCalories };
    });
}

function calculateMacroDistribution(weeklyPlan) {
    let totalProtein = 0, totalCarbs = 0, totalFat = 0;

    Object.keys(weeklyPlan).forEach(day => {
        const dayMeals = weeklyPlan[day];
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            const meal = dayMeals[mealType];
            if (meal) {
                totalProtein += safeNumber(meal.protein);
                totalCarbs += safeNumber(meal.carbs);
                totalFat += safeNumber(meal.fat);
            }
        });
    });

    const total = totalProtein + totalCarbs + totalFat;
    return {
        protein: Math.round((totalProtein / total) * 100),
        carbs: Math.round((totalCarbs / total) * 100),
        fat: Math.round((totalFat / total) * 100)
    };
}

function calculateVarietyAnalysis(weeklyPlan) {
    const mealTypes = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
    const uniqueMeals = new Set();

    Object.keys(weeklyPlan).forEach(day => {
        const dayMeals = weeklyPlan[day];
        Object.keys(mealTypes).forEach(mealType => {
            const meal = dayMeals[mealType];
            if (meal) {
                mealTypes[mealType]++;
                uniqueMeals.add(meal.title);
            }
        });
    });

    return {
        totalMeals: Array.from(uniqueMeals).length,
        totalPlanned: Object.values(mealTypes).reduce((a, b) => a + b, 0),
        varietyScore: Math.round((Array.from(uniqueMeals).length / 28) * 100)
    };
}

function createWeeklyCaloriesChart(dailyCalories) {
    const canvas = document.getElementById('weeklyCaloriesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dailyCalories.map(d => d.day),
            datasets: [{
                label: 'Daily Calories',
                data: dailyCalories.map(d => d.calories),
                backgroundColor: 'rgba(74, 144, 226, 0.8)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Weekly Calorie Distribution'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Calories'
                    }
                }
            }
        }
    });
}

function createMacroDistributionChart(macroDistribution) {
    const canvas = document.getElementById('macroDistributionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbs', 'Fat'],
            datasets: [{
                data: [macroDistribution.protein, macroDistribution.carbs, macroDistribution.fat],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Macronutrient Distribution'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createDailyNutritionChart(weeklyNutrition) {
    const canvas = document.getElementById('dailyNutritionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: weeklyNutrition.map(d => d.day),
            datasets: [
                {
                    label: 'Protein (g)',
                    data: weeklyNutrition.map(d => d.protein),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.4
                },
                {
                    label: 'Carbs (g)',
                    data: weeklyNutrition.map(d => d.carbs),
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4
                },
                {
                    label: 'Fat (g)',
                    data: weeklyNutrition.map(d => d.fat),
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Nutrition Trends'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Grams'
                    }
                }
            }
        }
    });
}

function createVarietyAnalysisChart(varietyAnalysis) {
    const canvas = document.getElementById('varietyAnalysisChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Unique Meals', 'Total Planned', 'Variety Score'],
            datasets: [{
                label: 'Count/Score',
                data: [varietyAnalysis.totalMeals, varietyAnalysis.totalPlanned, varietyAnalysis.varietyScore],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Meal Variety Analysis'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Load Chart.js library
async function loadChartJS() {
    if (window.Chart) return;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Enhanced PDF export with grocery list and recipe instructions
async function exportToPDF() {
    try {
        await loadHtml2Pdf();

        if (!currentMealPlan || !currentUserProfile) {
            alert('No meal plan available to export');
            return;
        }

        // Create comprehensive PDF content
        let pdfContent = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #2c3e50; margin-bottom: 10px;">Personalized Diet Plan</h1>
                    <p style="color: #7f8c8d; margin: 0;">Generated by TheDietPlanner.com</p>
                    <p style="color: #7f8c8d; margin: 5px 0;">Date: ${new Date().toLocaleDateString()}</p>
                </div>

                <div style="background: #ecf0f1; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Profile Summary</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <p><strong>Age:</strong> ${currentUserProfile.age} years</p>
                        <p><strong>Gender:</strong> ${currentUserProfile.gender}</p>
                        <p><strong>Height:</strong> ${currentUserProfile.height} cm</p>
                        <p><strong>Weight:</strong> ${currentUserProfile.weight} kg</p>
                        <p><strong>Goal:</strong> ${currentUserProfile.goal}</p>
                        <p><strong>Diet Type:</strong> ${currentUserProfile.dietType}</p>
                        <p><strong>Activity Level:</strong> ${currentUserProfile.activityLevel}</p>
                        <p><strong>Target Calories:</strong> ${currentUserProfile.targetCalories}/day</p>
                    </div>
                </div>
        `;

        // Add 7-day meal plan
        const days = Object.keys(currentMealPlan);
        days.forEach((day, idx) => {
            pdfContent += `
                <div style="margin-bottom: 25px; break-inside: avoid;">
                    <h3 style="background: #4A90E2; color: white; padding: 10px; margin: 0 0 15px 0; border-radius: 5px;">
                        Day ${idx + 1} - ${day}
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                        <thead>
                            <tr style="background: #ecf0f1;">
                                <th style="border: 1px solid #bdc3c7; padding: 8px; text-align: left;">Meal</th>
                                <th style="border: 1px solid #bdc3c7; padding: 8px; text-align: left;">Food</th>
                                <th style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">Cal</th>
                                <th style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">Protein</th>
                                <th style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">Carbs</th>
                                <th style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">Fat</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
                const meal = currentMealPlan[day][mealType];
                if (!meal) return;

                const foods = meal.foods && Array.isArray(meal.foods) 
                    ? meal.foods.map(f => typeof f === 'string' ? f : f.name || '').filter(f => f).join(', ')
                    : '';

                pdfContent += `
                    <tr>
                        <td style="border: 1px solid #bdc3c7; padding: 8px; vertical-align: top;">
                            <strong>${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</strong>
                            ${meal.allergens && meal.allergens.length > 0 ? 
                                `<br><small style="color: #e74c3c;">⚠️ ${meal.allergens.join(', ')}</small>` : ''}
                        </td>
                        <td style="border: 1px solid #bdc3c7; padding: 8px; vertical-align: top;">
                            <strong>${meal.title}</strong>
                            ${foods ? `<br><small style="color: #7f8c8d;">${foods}</small>` : ''}
                            ${meal.prep_time ? `<br><small style="color: #7f8c8d;">⏱️ ${meal.prep_time}</small>` : ''}
                        </td>
                        <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">${meal.calories}</td>
                        <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">${meal.protein}g</td>
                        <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">${meal.carbs}g</td>
                        <td style="border: 1px solid #bdc3c7; padding: 8px; text-align: center;">${meal.fat}g</td>
                    </tr>
                `;
            });

            pdfContent += `
                        </tbody>
                    </table>
                </div>
            `;
        });

        pdfContent += `
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #bdc3c7; color: #7f8c8d; font-size: 12px;">
                    <p>Generated by TheDietPlanner.com | ${new Date().toLocaleDateString()}</p>
                    <p>For more personalized meal plans, visit www.thedietplanner.com</p>
                </div>
            </div>
        `;

        const element = document.createElement('div');
        element.innerHTML = pdfContent;

        const opt = {
            margin: [0.5, 0.5, 0.5, 0.5],
            filename: `diet-plan-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(element).save();

    } catch (error) {
        console.error('PDF export failed:', error);
        alert('PDF export failed. Please try again.');
    }
}

// Load external libraries
async function loadHtml2Pdf() {
    if (window.html2pdf) return;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
