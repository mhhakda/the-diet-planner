/**
 * Diet Planner - Complete JavaScript with Diet Tracker Design System
 * @version 1.0.0
 * @author TheDietPlanner.com
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
    }
    
    resultsScroll.scrollTo({
        top,
        behavior: 'smooth'
    });
}

// Form handling
function initializeForm() {
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleFormSubmit();
        });
    }
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
        alert('Failed to generate meal plan. See console.');
        
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

// Meals database loading
async function loadMealsDatabase(forceReload = false) {
    if (mealDatabase && !forceReload) return mealDatabase;
    
    if (mealDbLoadPromise && !forceReload) return mealDbLoadPromise;
    
    mealDbLoadPromise = (async () => {
        const candidates = [
            'meals.json',
            './meals.json',
            'data/meals.json',
            location.origin + '/meals.json'
        ];
        
        let rawData = null;
        for (const url of candidates) {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                rawData = await response.json();
                console.log('Loaded meals.json from', url);
                break;
            } catch (err) {
                console.warn('Could not load meals from', url, err.message || err);
            }
        }
        
        if (!rawData) {
            console.warn('meals.json not found, using fallback data.');
            mealDatabase = createFallbackMeals();
            return mealDatabase;
        }
        
        // Normalize data structure
        mealDatabase = normalizeMealsData(rawData);
        console.log('meals.json normalized and loaded.');
        
        return mealDatabase;
    })();
    
    return mealDbLoadPromise;
}

function normalizeMealsData(rawData) {
    // Handle different data structures
    if (rawData.meals && Array.isArray(rawData.meals)) {
        rawData = rawData.meals;
    } else if (rawData.data && rawData.data.meals && Array.isArray(rawData.data.meals)) {
        rawData = rawData.data.meals;
    }
    
    if (Array.isArray(rawData)) {
        // Convert flat array to structured format
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
                        breakfast: [],
                        lunch: [],
                        dinner: [],
                        snacks: []
                    };
                }
                
                const normalizedMeal = {
                    id: meal.id || `${regionKey}_${dietKey}_${mealType}_${i}`,
                    title: meal.title || meal.name || `Meal ${i + 1}`,
                    servingsize: meal.servingsize || meal.serving || '1 serving',
                    calories: safeNumber(meal.calories || meal.kcal || 0),
                    protein: safeNumber(meal.protein || 0),
                    carbs: safeNumber(meal.carbs || 0),
                    fat: safeNumber(meal.fat || 0),
                    fiber: safeNumber(meal.fiber || 0),
                    foods: Array.isArray(meal.foods) ? meal.foods : (meal.ingredients ? String(meal.ingredients).split(',').map(s => ({ name: s.trim() })) : [])
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
    
    // Assume already structured format
    return rawData || createFallbackMeals();
}

function createFallbackMeals() {
    return {
        'India': {
            'Regular': {
                breakfast: [
                    { id: 'fb1', title: 'Oatmeal with Fruits', servingsize: '1 serving', calories: 250, protein: 8, carbs: 45, fat: 4, fiber: 5 },
                    { id: 'fb2', title: 'Boiled Eggs', servingsize: '2 eggs', calories: 150, protein: 12, carbs: 1, fat: 10, fiber: 0 }
                ],
                lunch: [
                    { id: 'fl1', title: 'Grilled Chicken Salad', servingsize: '1 bowl', calories: 350, protein: 30, carbs: 15, fat: 12, fiber: 6 },
                    { id: 'fl2', title: 'Veggie Wrap', servingsize: '1 wrap', calories: 300, protein: 10, carbs: 40, fat: 8, fiber: 5 }
                ],
                dinner: [
                    { id: 'fd1', title: 'Paneer Curry with Rice', servingsize: '1 plate', calories: 400, protein: 20, carbs: 50, fat: 15, fiber: 5 },
                    { id: 'fd2', title: 'Fish with Quinoa', servingsize: '1 plate', calories: 450, protein: 35, carbs: 40, fat: 14, fiber: 4 }
                ],
                snacks: [
                    { id: 'fs1', title: 'Fruit and Nuts', servingsize: '1 small bowl', calories: 150, protein: 4, carbs: 20, fat: 6, fiber: 3 }
                ]
            }
        },
        'USA': {
            'Regular': {
                breakfast: [
                    { id: 'usb1', title: 'Scrambled Eggs with Toast', servingsize: '1 serving', calories: 320, protein: 18, carbs: 28, fat: 14, fiber: 3 }
                ],
                lunch: [
                    { id: 'usl1', title: 'Turkey Sandwich', servingsize: '1', calories: 420, protein: 30, carbs: 45, fat: 12, fiber: 4 }
                ],
                dinner: [
                    { id: 'usd1', title: 'Grilled Salmon', servingsize: '1', calories: 500, protein: 35, carbs: 30, fat: 22, fiber: 3 }
                ],
                snacks: [
                    { id: 'uss1', title: 'Greek Yogurt & Berries', servingsize: '1 cup', calories: 160, protein: 12, carbs: 18, fat: 4, fiber: 2 }
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
    const weeklyWeightTarget = 0.75; // kg per week (middle of 0.5-1kg range)
    const dailyCalorieAdjustment = (weeklyWeightTarget * 7700) / 7; // 825 calories/day
    
    switch ((profile.goal || '').toString().toLowerCase()) {
        case 'loss':
        case 'lose':
        case 'weightloss':
            tdee -= dailyCalorieAdjustment; // Subtract for weight loss
            break;
        case 'gain':
        case 'muscle':
        case 'weightgain':
            tdee += dailyCalorieAdjustment; // Add for weight gain
            break;
        case 'maintain':
        default:
            // No adjustment for maintenance
            break;
    }
    
    // Clamp to sensible range
    tdee = Math.round(Math.max(800, Math.min(4200, tdee)));
    
    return tdee;
}

// Meal plan generation
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
            targetCalories: safeNumber(document.getElementById('targetCalories')?.value)
        };
        
        if (!profile.targetCalories || profile.targetCalories <= 0) {
            profile.targetCalories = calculateTargetCalories(profile);
        }
        
        currentUserProfile = profile;
        
        // Get region data
        const regionKey = profile.region || 'India';
        const regionMeals = mealDatabase[regionKey] || mealDatabase['India'] || Object.values(mealDatabase)[0];
        
        if (!regionMeals) {
            console.error('No meals found for region', regionKey);
            throw new Error(`No meals available for region: ${regionKey}`);
        }
        
        // Get diet-specific meals
        const dietKey = profile.dietType === 'Mixed' ? 'Regular' : profile.dietType || 'Regular';
        const dietMeals = regionMeals[dietKey] || regionMeals['Regular'] || Object.values(regionMeals)[0];
        
        if (!dietMeals) {
            console.error('Diet not found:', profile.dietType, 'Available diets:', Object.keys(regionMeals));
            throw new Error(`No meals available for diet: ${profile.dietType} in region: ${profile.region}`);
        }
        
        // Generate weekly plan
        const weeklyPlan = selectMealsForWeek(dietMeals, profile.targetCalories, profile);
        
        // Store globally
        currentMealPlan = weeklyPlan;
        
        // Persist
        try {
            localStorage.setItem('lastGeneratedPlan_v1', JSON.stringify({
                plan: weeklyPlan,
                profile: profile,
                generated: new Date().toISOString()
            }));
        } catch (e) {
            // Ignore storage errors
        }
        
        // Render
        try {
            displayMealPlan(weeklyPlan, profile);
        } catch (e) {
            console.warn('displayMealPlan threw (non-fatal):', e);
        }
        
        try {
            await createCharts(weeklyPlan, profile);
        } catch (e) {
            console.warn('createCharts threw (non-fatal):', e);
        }
        
        console.log('Weekly plan generated for', regionKey, profile.dietType);
        return weeklyPlan;
        
    } catch (error) {
        console.error('Error generating meal plan:', error, error.stack ? error.stack : '');
        alert('Failed to generate meal plan. See console for details.');
        throw error;
    }
}

function selectMealsForWeek(meals, targetCalories, profile) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const weeklyPlan = {};
    const usedMealIds = new Set();
    
    const calorieDistribution = {
        breakfast: 0.25,
        lunch: 0.35,
        dinner: 0.35,
        snacks: 0.05
    };
    
    days.forEach((day, dayIndex) => {
        weeklyPlan[day] = {};
        
        mealTypes.forEach((mealType, mtIndex) => {
            const targetForMeal = Math.max(0, Math.round(targetCalories * calorieDistribution[mealType] * 0.25));
            
            let availableMeals = (meals[mealType] || []).slice();
            
            if (!availableMeals || availableMeals.length === 0) {
                // Fallback: collect from other meal types
                availableMeals = [];
                Object.keys(meals).forEach(k => {
                    if (Array.isArray(meals[k])) {
                        availableMeals.push(...meals[k]);
                    }
                });
            }
            
            if (!availableMeals || availableMeals.length === 0) {
                // Extreme fallback
                weeklyPlan[day][mealType] = createDefaultMeal(mealType, targetForMeal);
                return;
            }
            
            // Prefer variety - avoid recently used meals
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
    
    // Normalize candidates
    const candList = candidates.filter(Boolean).map(m => ({
        raw: m,
        id: m.id || (m.title ? String(m.title) : JSON.stringify(m)),
        calories: safeNumber(m.calories || m.kcal || 0),
        title: String(m.title || m.name || m.label || 'Meal')
    }));
    
    // 1. Unused & in-range (60-140% of target)
    const lowerFactor = targetForMeal < 800 ? 0.4 : 0.6;
    const upperFactor = targetForMeal < 800 ? 2.0 : 1.4;
    
    let suitable = candList.filter(c => 
        !usedIds.has(c.id) && 
        c.calories > 0 && 
        c.calories >= targetForMeal * lowerFactor && 
        c.calories <= targetForMeal * upperFactor
    );
    
    // 2. In-range (any)
    if (suitable.length === 0) {
        suitable = candList.filter(c => 
            c.calories > 0 && 
            c.calories >= targetForMeal * 0.6 && 
            c.calories <= targetForMeal * 1.4
        );
    }
    
    // 3. Unused
    if (suitable.length === 0) {
        suitable = candList.filter(c => !usedIds.has(c.id));
    }
    
    // 4. Fallback (all)
    if (suitable.length === 0) {
        suitable = candList;
    }
    
    // Deterministic-ish pick using seed
    const idx = Math.abs(seed) % suitable.length;
    return suitable[idx] ? suitable[idx].raw : null;
}

function createDefaultMeal(mealType, targetCalories) {
    const defaults = {
        breakfast: { title: 'Mixed Breakfast', servingsize: '1 serving', calories: Math.round(targetCalories) },
        lunch: { title: 'Balanced Lunch', servingsize: '1 serving', calories: Math.round(targetCalories) },
        dinner: { title: 'Nutritious Dinner', servingsize: '1 serving', calories: Math.round(targetCalories) },
        snacks: { title: 'Healthy Snack', servingsize: '1 serving', calories: Math.round(targetCalories) }
    };
    
    const base = defaults[mealType] || defaults.lunch;
    
    return {
        id: `fallback_${mealType}_${Date.now()}_${Math.round(Math.random() * 10000)}`,
        ...base,
        protein: Math.round(targetCalories * 0.15 / 4),
        carbs: Math.round(targetCalories * 0.50 / 4),
        fat: Math.round(targetCalories * 0.35 / 9),
        fiber: 5,
        isFallback: true
    };
}

// Display functions
function displayMealPlan(weeklyPlan, profile) {
    const container = document.getElementById('mealPlanContainer');
    if (!container) {
        console.warn('mealPlanContainer not found in DOM.');
        return;
    }
    
    const days = Object.keys(weeklyPlan);
    if (!days.length) {
        container.innerHTML = '<p>No meal plan available.</p>';
        return;
    }
    
    // Build HTML table
    let html = '';
    days.forEach((day, idx) => {
        html += `<h3 class="day-title">Day ${idx + 1} - ${day}</h3>`;
        html += `<table class="meal-table"><thead><tr><th>Meal</th><th>Food</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Fiber</th></tr></thead><tbody>`;
        
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mt => {
            const meal = weeklyPlan[day][mt];
            if (!meal) return;
            
            const title = getMealTitle(meal);
            const foods = Array.isArray(meal.foods) ? meal.foods.map(f => typeof f === 'string' ? f : f.name).join(', ') : '';
            
            html += `<tr>`;
            html += `<td>${mt.charAt(0).toUpperCase() + mt.slice(1)}</td>`;
            html += `<td>${title}${foods ? ' - ' + foods : ''}</td>`;
            html += `<td>${safeNumber(meal.calories)}</td>`;
            html += `<td>${safeNumber(meal.protein)}g</td>`;
            html += `<td>${safeNumber(meal.carbs)}g</td>`;
            html += `<td>${safeNumber(meal.fat)}g</td>`;
            html += `<td>${safeNumber(meal.fiber)}g</td>`;
            html += `</tr>`;
        });
        
        html += `</tbody></table>`;
    });
    
    container.innerHTML = html;
    
    // Update stats summary
    displayStatsCards(weeklyPlan, profile);
}

function getMealTitle(meal) {
    if (!meal) return 'No meal';
    if (typeof meal === 'string') return meal;
    
    const candidates = [meal.title, meal.name, meal.displayname, meal.dishname, meal.label];
    for (const c of candidates) {
        if (c && String(c).trim()) return String(c).trim();
    }
    
    if (Array.isArray(meal.foods) && meal.foods.length) {
        const parts = meal.foods.map(f => {
            if (!f) return '';
            if (typeof f === 'string') return f;
            return f.name || f.title || '';
        }).filter(Boolean);
        if (parts.length) return parts.slice(0, 4).join(', ');
    }
    
    if (meal.ingredients && typeof meal.ingredients === 'string') {
        const parts = meal.ingredients.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length) return parts.slice(0, 4).join(', ');
    }
    
    if (meal.id) return `Meal ${meal.id}`;
    return 'Custom Meal';
}

function displayStatsCards(weeklyPlan, profile) {
    const stats = calculateWeeklyStats(weeklyPlan);
    const container = document.getElementById('statsGrid');
    if (!container) return;
    
    // Calculate target difference in kg/week instead of percentage
    const calorieDiff = stats.avgCalories - profile.targetCalories;
    const targetDiffKgPerWeek = Math.round(((calorieDiff / 7700) * 7) * 100) / 100;
    
    container.innerHTML = `
        <div class="stat-card fade-in">
            <div class="stat-title">Calories</div>
            <div class="stat-value">${Math.round(stats.avgCalories)}</div>
            <div class="stat-target">${profile.targetCalories}</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Protein</div>
            <div class="stat-value">${Math.round(stats.avgProtein)}<span class="stat-unit">g</span></div>
            <div class="stat-target">${Math.round(profile.targetCalories * 0.15 / 4)}g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Carbs</div>
            <div class="stat-value">${Math.round(stats.avgCarbs)}<span class="stat-unit">g</span></div>
            <div class="stat-target">${Math.round(profile.targetCalories * 0.5 / 4)}g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Fat</div>
            <div class="stat-value">${Math.round(stats.avgFat)}<span class="stat-unit">g</span></div>
            <div class="stat-target">${Math.round(profile.targetCalories * 0.35 / 9)}g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Fiber</div>
            <div class="stat-value">${Math.round(stats.avgFiber)}<span class="stat-unit">g</span></div>
            <div class="stat-target">25g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Weight Change</div>
            <div class="stat-value ${Math.abs(targetDiffKgPerWeek) < 1.0 ? 'text-success' : 'text-warning'}">${targetDiffKgPerWeek > 0 ? '+' : ''}${targetDiffKgPerWeek} kg/week</div>
        </div>
    `;
}

function calculateWeeklyStats(weeklyPlan) {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0, mealCount = 0;
    
    Object.keys(weeklyPlan).forEach(day => {
        Object.keys(weeklyPlan[day]).forEach(mt => {
            const meal = weeklyPlan[day][mt];
            if (meal) {
                totalCalories += safeNumber(meal.calories);
                totalProtein += safeNumber(meal.protein);
                totalCarbs += safeNumber(meal.carbs);
                totalFat += safeNumber(meal.fat);
                totalFiber += safeNumber(meal.fiber);
                mealCount++;
            }
        });
    });
    
    return {
        totalCalories,
        avgCalories: totalCalories / 7,
        totalProtein,
        avgProtein: totalProtein / 7,
        totalCarbs,
        avgCarbs: totalCarbs / 7,
        totalFat,
        avgFat: totalFat / 7,
        totalFiber,
        avgFiber: totalFiber / 7,
        mealCount
    };
}

// Charts
async function loadChartJS() {
    if (ChartsLoaded && window.Chart) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = () => {
            ChartsLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Chart.js'));
        document.head.appendChild(script);
    });
}

async function createCharts(weeklyPlan, profile) {
    try {
        await loadChartJS();
    } catch (err) {
        console.warn('Chart.js not loaded:', err);
        return;
    }
    
    const days = Object.keys(weeklyPlan);
    const dailyCalories = days.map(d => {
        let total = 0;
        Object.keys(weeklyPlan[d]).forEach(mt => {
            total += safeNumber(weeklyPlan[d][mt]?.calories);
        });
        return total;
    });
    
    const weeklyStats = calculateWeeklyStats(weeklyPlan);
    
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? '#ffffff' : '#212529';
    const gridColor = isDark ? '#404040' : '#dee2e6';
    
    // Calorie chart
    const calorieCtx = document.getElementById('calorieChart');
    try {
        if (calorieCtx) {
            if (window.calorieChartInstance && typeof window.calorieChartInstance.destroy === 'function') {
                window.calorieChartInstance.destroy();
            }
            
            window.calorieChartInstance = new Chart(calorieCtx, {
                type: 'bar',
                data: {
                    labels: days.map(d => d.substr(0, 3)),
                    datasets: [{
                        label: 'Daily Calories',
                        data: dailyCalories,
                        backgroundColor: 'rgba(31, 184, 205, 0.8)',
                        borderColor: 'rgba(31, 184, 205, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }, {
                        label: 'Target',
                        data: Array(days.length).fill(profile.targetCalories),
                        type: 'line',
                        borderColor: 'rgba(230, 129, 97, 1)',
                        backgroundColor: 'rgba(230, 129, 97, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        pointBackgroundColor: 'rgba(230, 129, 97, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 16,
                                color: textColor,
                                font: { size: 12 }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Calories',
                                color: textColor,
                                font: { size: 12 }
                            },
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 11 } }
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error('Failed to create calorie chart:', err);
    }
    
    // Macros chart
    try {
        if (window.macrosChartInstance && typeof window.macrosChartInstance.destroy === 'function') {
            window.macrosChartInstance.destroy();
        }
        
        const macrosCtx = document.getElementById('macrosChart');
        if (macrosCtx) {
            const proteinCals = weeklyStats.totalProtein * 4;
            const carbsCals = weeklyStats.totalCarbs * 4;
            const fatCals = weeklyStats.totalFat * 9;
            
            window.macrosChartInstance = new Chart(macrosCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Protein', 'Carbs', 'Fat'],
                    datasets: [{
                        data: [proteinCals, carbsCals, fatCals],
                        backgroundColor: [
                            'rgba(31, 184, 205, 0.8)',
                            'rgba(230, 129, 97, 0.8)',
                            'rgba(168, 75, 47, 0.8)'
                        ],
                        borderColor: [
                            'rgba(31, 184, 205, 1)',
                            'rgba(230, 129, 97, 1)',
                            'rgba(168, 75, 47, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 12,
                                color: textColor,
                                font: { size: 11 }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label;
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = Math.round((value / total) * 100);
                                    return `${label}: ${percentage}% (${Math.round(value)} cal)`;
                                }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        }
    } catch (err) {
        console.error('Failed to create macros chart:', err);
    }
}

// Export functions
function sendToTrackerAndRedirect() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to send to tracker. Generate a meal plan first.');
        return;
    }
    
    const overlay = document.getElementById('redirectOverlay');
    if (overlay) overlay.style.display = 'flex';
    
    const integrationData = {
        version: '3.0',
        timestamp: new Date().toISOString(),
        source: 'thedietplanner-diet-planner',
        userProfile: currentUserProfile,
        mealPlan: currentMealPlan,
        dailyTargets: {
            calories: currentUserProfile.targetCalories,
            protein: Math.round(currentUserProfile.targetCalories * 0.15 / 4),
            carbs: Math.round(currentUserProfile.targetCalories * 0.5 / 4),
            fat: Math.round(currentUserProfile.targetCalories * 0.35 / 9),
            fiber: 25,
            water: 2000
        }
    };
    
    try {
        const payloadStr = JSON.stringify(integrationData);
        localStorage.setItem(INTEGRATION_STORAGE_KEY, payloadStr);
        localStorage.setItem('planned_meals_v1', payloadStr);
        localStorage.setItem('diettracker_import', payloadStr);
        localStorage.setItem('meal_plan_transfer', payloadStr);
        localStorage.setItem('meal_plan_sent', 'true');
        
        console.log('Meal plan data stored for Diet Tracker');
    } catch (err) {
        console.error('Failed to store meal plan for tracker:', err);
    }
    
    if (overlay) overlay.style.display = 'none';
    
    // Ask user before opening tracker
    const shouldOpen = confirm('Meal plan is ready to send. Do you want to open the Diet Tracker now?');
    if (shouldOpen) {
        // Use data-diet-tracker-url attribute on body (set in HTML)
        const redirectUrl = document.body.getAttribute('data-diet-tracker-url') || `${location.protocol}//${location.host}/diet-tracker`;
        
        try {
            const newWindow = window.open(redirectUrl, '_blank');
            if (!newWindow) {
                alert('Popup blocked. Please allow popups or open the tracker manually.');
            }
        } catch (err) {
            console.warn('Failed to open tracker:', err);
            alert('Failed to open tracker. Please open it manually.');
        }
    }
    
    if (overlay) overlay.style.display = 'none';
}

function downloadCSV() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to export. Generate a meal plan first.');
        return;
    }
    
    let csv = 'Date,Meal Time,Food Name,Serving Size,Calories,Protein,Carbs,Fat,Fiber\n';
    
    const days = Object.keys(currentMealPlan);
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    days.forEach(day => {
        mealTypes.forEach(mt => {
            const meal = currentMealPlan[day][mt];
            if (!meal) return;
            
            const titleSafe = (meal.title && typeof meal.title === 'string') ? 
                meal.title.replace(/"/g, '') : 
                getMealTitle(meal).replace(/"/g, '');
            
            const row = [
                day,
                mt.charAt(0).toUpperCase() + mt.slice(1),
                titleSafe,
                (meal.servingsize || 'N/A').replace(/"/g, ''),
                safeNumber(meal.calories),
                safeNumber(meal.protein),
                safeNumber(meal.carbs),
                safeNumber(meal.fat),
                safeNumber(meal.fiber)
            ].join(',');
            
            csv += row + '\n';
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `meal-plan-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('CSV downloaded');
}

async function downloadPDF() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to export. Generate a meal plan first.');
        return;
    }
    
    // Load html2pdf library
    if (!Html2PdfLoaded) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = () => {
                    Html2PdfLoaded = true;
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load html2pdf'));
                document.head.appendChild(script);
            });
        } catch (err) {
            console.error('Failed to load html2pdf:', err);
            alert('Failed to load PDF library. Please try again.');
            return;
        }
    }
    
    // Generate PDF content
    let html = `<div class="dp-pdf-root">`;
    html += `<h1 style="text-align: center; margin-bottom: 20px; color: #1FB8CD;">Your Weekly Meal Plan</h1>`;
    html += `<p style="text-align: center; margin-bottom: 30px; color: #626C71;">Generated by TheDietPlanner.com</p>`;
    
    const days = Object.keys(currentMealPlan);
    days.forEach((day, idx) => {
        html += `<h3 style="margin: 8px 0 6px 0; font-size: 12px;">${day} (Day ${idx + 1})</h3>`;
        html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px;">`;
        html += `<thead><tr style="background: #f3f4f6;"><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: left; width: 15%;">Meal</th><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: left; width: 35%;">Food</th><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: center; width: 10%;">Cal</th><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: center; width: 10%;">Protein</th><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: center; width: 10%;">Carbs</th><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: center; width: 10%;">Fat</th><th style="padding: 4px; border: 1px solid #e6e7e9; text-align: center; width: 10%;">Fiber</th></tr></thead><tbody>`;
        
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mt => {
            const meal = currentMealPlan[day][mt];
            if (!meal) return;
            
            const foods = Array.isArray(meal.foods) ? 
                meal.foods.map(f => typeof f === 'string' ? f : f.name || f.title).filter(Boolean).slice(0, 6).join(', ') : '';
            const title = getMealTitle(meal);
            const calories = safeNumber(meal.calories);
            const protein = safeNumber(meal.protein);
            const carbs = safeNumber(meal.carbs);
            const fat = safeNumber(meal.fat);
            const fiber = safeNumber(meal.fiber);
            
            html += `<tr><td style="padding: 4px; border: 1px solid #e6e7e9;">${mt.charAt(0).toUpperCase() + mt.slice(1)}</td><td style="padding: 4px; border: 1px solid #e6e7e9;">${title}${foods ? ` (${foods})` : ''}</td><td style="padding: 4px; border: 1px solid #e6e7e9; text-align: center;">${calories}</td><td style="padding: 4px; border: 1px solid #e6e7e9; text-align: center;">${protein}g</td><td style="padding: 4px; border: 1px solid #e6e7e9; text-align: center;">${carbs}g</td><td style="padding: 4px; border: 1px solid #e6e7e9; text-align: center;">${fat}g</td><td style="padding: 4px; border: 1px solid #e6e7e9; text-align: center;">${fiber}g</td></tr>`;
        });
        
        html += `</tbody></table>`;
    });
    html += `</div>`;
    
    // Create temporary element
    const temp = document.createElement('div');
    temp.style.boxSizing = 'border-box';
    temp.style.width = '1200px';
    temp.style.padding = '6px';
    temp.innerHTML = html;
    
    const style = document.createElement('style');
    style.innerHTML = `.dp-pdf-root { color: #222; } table { border-collapse: collapse; font-size: 10px; } thead { display: table-header-group; } tr { page-break-inside: avoid; -webkit-column-break-inside: avoid; } td, th { word-break: break-word; }`;
    temp.insertBefore(style, temp.firstChild);
    
    document.body.appendChild(temp);
    
    const options = {
        margin: [6, 6, 6, 6],
        filename: `TheDietPlanner-MealPlan-${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 1.5, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: 'css', legacy: false }
    };
    
    try {
        await html2pdf().set(options).from(temp).save();
    } catch (err) {
        console.error('PDF generation failed:', err);
        alert('PDF generation failed. See console.');
    } finally {
        if (temp && temp.parentNode) {
            temp.parentNode.removeChild(temp);
        }
    }
}

// Load existing saved plan
function loadExistingPlan() {
    try {
        const stored = localStorage.getItem('lastGeneratedPlan_v1');
        if (!stored) return;
        
        const data = JSON.parse(stored);
        const generated = new Date(data.generated);
        const now = new Date();
        const daysDiff = (now - generated) / (1000 * 60 * 60 * 24);
        
        if (daysDiff <= 7 && data.plan && data.profile) {
            currentMealPlan = data.plan;
            currentUserProfile = data.profile;
            
            // Populate form fields if present
            if (currentUserProfile) {
                Object.keys(currentUserProfile).forEach(key => {
                    const field = document.getElementById(key);
                    if (field && currentUserProfile[key] != undefined) {
                        field.value = currentUserProfile[key];
                    }
                });
            }
            
            // Try immediate render
            const attemptRender = () => {
                const canDisplay = typeof displayMealPlan === 'function';
                const canChart = typeof createCharts === 'function';
                
                if (canDisplay) {
                    try {
                        displayMealPlan(currentMealPlan, currentUserProfile);
                        console.log('Restored plan rendered to table.');
                    } catch (err) {
                        console.warn('displayMealPlan threw while restoring plan:', err);
                    }
                } else {
                    console.warn('displayMealPlan not defined yet. Will retry soon.');
                }
                
                if (canChart) {
                    try {
                        createCharts(currentMealPlan, currentUserProfile).catch(e => 
                            console.warn('createCharts error while restoring plan:', e)
                        );
                        console.log('Restored plan charts attempted.');
                    } catch (err) {
                        console.warn('createCharts threw while restoring plan:', err);
                    }
                } else {
                    console.warn('createCharts not defined yet. Will retry soon.');
                }
                
                return canDisplay && canChart;
            };
            
            if (attemptRender()) {
                console.log('Loaded plan from localStorage and rendered immediately.');
                return;
            }
            
            // Otherwise set up a short polling loop to retry rendering
            let attempts = 0;
            const maxAttempts = 12; // retry for up to 12 * 500ms = 6 seconds
            const interval = setInterval(() => {
                attempts++;
                const done = attemptRender();
                if (done || attempts >= maxAttempts) {
                    clearInterval(interval);
                    if (!done) {
                        console.warn('Loaded plan from storage but renderer functions not available yet. Plan kept in memory and will render when you generate next plan.');
                    }
                }
            }, 500);
        }
    } catch (err) {
        console.error('Failed to load existing plan:', err);
    }
}

// Set up event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const sendBtn = document.getElementById('sendToTrackerBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendToTrackerAndRedirect);
    }
    
    const csvBtn = document.getElementById('downloadCsvBtn');
    if (csvBtn) {
        csvBtn.addEventListener('click', downloadCSV);
    }
    
    const pdfBtn = document.getElementById('downloadPdfBtn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', downloadPDF);
    }
});

// Expose functions globally
window.sendToTrackerAndRedirect = sendToTrackerAndRedirect;
window.downloadCSV = downloadCSV;
window.downloadPDF = downloadPDF;
window.generateMealPlan = generateMealPlan;