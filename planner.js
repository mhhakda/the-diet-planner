// Diet Planner - Complete Version with PDF Export
// Global variables
let currentMealPlan = null;
let currentUserProfile = null;
let mealDatabase = null;
let ChartsLoaded = false;
let Html2PdfLoaded = false;
let currentActiveSection = 'profile';
let sectionObserver;

// Theme management
let currentTheme = localStorage.getItem('theme') || 'light';

// Safe number parsing helper
function safeNumber(v) {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    initializeNavigation();
    initializeMobileMenu();
    initializeIntersectionObserver();
    loadMealsDatabase();
    loadExistingPlan();
    initializeForm();
    initializePdfExport(); // Initialize PDF export
    console.log('🍽️ Diet Planner loaded successfully! 🎉');

    // Bind reload meals button if present (no layout changes required; button optional)
    (function bindReloadButton() {
        const reloadBtn = document.getElementById('reloadMealsBtn');
        if (!reloadBtn) return;
        reloadBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            reloadBtn.disabled = true;
            const origText = reloadBtn.textContent;
            reloadBtn.textContent = 'Reloading meals...';
            try {
                await loadMealsDatabase(true);
                alert('✅ Meals reloaded. Any generated plan will now use the new meal data.');
            } catch (err) {
                alert('❌ Failed to reload meals: ' + (err.message || err));
            } finally {
                reloadBtn.disabled = false;
                reloadBtn.textContent = origText;
            }
        });
    })();
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
    themeToggle.textContent = currentTheme === 'light' ? '🌞' : '🌙';
}

// Navigation
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.getAttribute('data-section');
            if (section) navigateToSection(section);
        });
    });
}

function navigateToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest'
    });
    closeMobileMenu();
    currentActiveSection = sectionId;
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
}

// Mobile menu helpers
function initializeMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    if (menuBtn) menuBtn.addEventListener('click', toggleMobileMenu);
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return;
    menu.classList.toggle('open');
}

function closeMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (!menu) return;
    menu.classList.remove('open');
}

// Intersection observer for sections
function initializeIntersectionObserver() {
    if ('IntersectionObserver' in window) {
        sectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    updateActiveNavItem(id);
                }
            });
        }, { threshold: 0.5 });

        const sections = document.querySelectorAll('section');
        sections.forEach(s => sectionObserver.observe(s));
    }
}

// Loading State Management
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'block';
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Load meals database (improved: supports force reload, cache-busting, validation, and change-detection)
async function loadMealsDatabase(forceReload = false) {
    // If we already have a loaded DB and no forceReload requested, return cached
    if (mealDatabase && !forceReload) return mealDatabase;

    const mealsUrl = `meals.json?v=${Date.now()}`; // cache-busting query param
    try {
        const response = await fetch(mealsUrl, { cache: 'no-store' });
        if (!response.ok) {
            console.warn('meals.json fetch returned non-ok status:', response.status);
            if (mealDatabase) return mealDatabase;
            mealDatabase = createFallbackMeals();
            return mealDatabase;
        }
        const newData = await response.json();

        // Quick signature detection to know if data changed
        let newSignature;
        try {
            newSignature = JSON.stringify(newData);
        } catch (err) {
            newSignature = Date.now().toString();
        }

        // Basic validation of shape
        const isValidShape = newData && typeof newData === 'object' && Object.keys(newData).length > 0;
        if (!isValidShape) {
            console.warn('meals.json has unexpected structure — using fallback meals.');
            if (!mealDatabase) mealDatabase = createFallbackMeals();
            return mealDatabase;
        }

        // detect changes by comparing to previous signature stored on mealDatabase._signature
        const prevSignature = mealDatabase && mealDatabase._signature ? mealDatabase._signature : null;
        if (newSignature !== prevSignature) {
            // attach signature to new data copy (non-enumerable)
            try {
                Object.defineProperty(newData, '_signature', { value: newSignature, enumerable: false, writable: true });
            } catch (e) {
                newData._signature = newSignature;
            }
            mealDatabase = newData;
            console.log('✅ meals.json updated and loaded');

            // notify UI if element exists
            try {
                const notify = document.getElementById('mealsUpdateNotice');
                if (notify) {
                    notify.textContent = 'New meal data loaded — the app will use the updated meals.';
                    notify.classList.remove('d-none');
                    setTimeout(() => notify.classList.add('d-none'), 6000);
                }
            } catch (e) { /* ignore */ }

            // If profile currently loaded, regenerate plan automatically
            if (currentUserProfile) {
                try {
                    await selectAndDisplayPlanOnMealsUpdate(currentUserProfile);
                } catch (err) {
                    console.error('Error regenerating plan after meals update:', err);
                }
            }
        } else {
            // still set mealDatabase if not set
            if (!mealDatabase) mealDatabase = newData;
            console.log('meals.json fetched — no changes detected');
        }

        return mealDatabase;
    } catch (error) {
        console.error('Failed to load meals database:', error);
        mealDatabase = createFallbackMeals();
        return mealDatabase;
    }
}

// Create fallback meals
function createFallbackMeals() {
    return {
        "USA": {
            "Regular": {
                "breakfast": [
                    {"id": 1, "title": "Scrambled Eggs with Toast", "serving_size": "1 serving", "calories": 320, "protein": 18, "carbs": 28, "fat": 14, "fiber": 3},
                    {"id": 2, "title": "Pancakes with Syrup", "serving_size": "1 serving", "calories": 420, "protein": 10, "carbs": 78, "fat": 10, "fiber": 3},
                    {"id": 3, "title": "Oatmeal with Berries", "serving_size": "1 bowl", "calories": 250, "protein": 8, "carbs": 45, "fat": 5, "fiber": 6}
                ],
                "lunch": [
                    {"id": 11, "title": "Grilled Chicken Salad", "serving_size": "1 serving", "calories": 380, "protein": 36, "carbs": 14, "fat": 20, "fiber": 5},
                    {"id": 12, "title": "Turkey Sandwich", "serving_size": "1 serving", "calories": 400, "protein": 28, "carbs": 38, "fat": 14, "fiber": 4}
                ],
                "dinner": [
                    {"id": 21, "title": "Salmon with Vegetables", "serving_size": "1 serving", "calories": 520, "protein": 42, "carbs": 24, "fat": 28, "fiber": 6},
                    {"id": 22, "title": "Steak with Potatoes", "serving_size": "1 serving", "calories": 680, "protein": 45, "carbs": 42, "fat": 32, "fiber": 5}
                ],
                "snacks": [
                    {"id": 31, "title": "Apple with Peanut Butter", "serving_size": "1 serving", "calories": 190, "protein": 8, "carbs": 24, "fat": 12, "fiber": 4},
                    {"id": 32, "title": "Greek Yogurt", "serving_size": "1 cup", "calories": 150, "protein": 15, "carbs": 8, "fat": 4, "fiber": 0}
                ]
            }
        },
        "India": {
            "Regular": {
                "breakfast": [
                    {"id": 101, "title": "Poha", "serving_size": "1 plate", "calories": 300, "protein": 8, "carbs": 50, "fat": 6, "fiber": 4},
                    {"id": 102, "title": "Masala Omelette", "serving_size": "1 omelette", "calories": 240, "protein": 18, "carbs": 4, "fat": 16, "fiber": 1}
                ],
                "lunch": [
                    {"id": 111, "title": "Fish Curry with Rice", "serving_size": "1 serving", "calories": 520, "protein": 28, "carbs": 65, "fat": 14, "fiber": 3},
                    {"id": 112, "title": "Butter Chicken with Naan", "serving_size": "1 serving", "calories": 720, "protein": 35, "carbs": 68, "fat": 32, "fiber": 4}
                ],
                "dinner": [
                    {"id": 121, "title": "Chicken Tikka with Naan", "serving_size": "1 serving", "calories": 620, "protein": 35, "carbs": 52, "fat": 24, "fiber": 4},
                    {"id": 122, "title": "Paneer Butter Masala with Rice", "serving_size": "1 serving", "calories": 650, "protein": 28, "carbs": 68, "fat": 28, "fiber": 5}
                ],
                "snacks": [
                    {"id": 131, "title": "Bhel Puri", "serving_size": "1 plate", "calories": 200, "protein": 5, "carbs": 35, "fat": 5, "fiber": 3},
                    {"id": 132, "title": "Samosa", "serving_size": "1 piece", "calories": 180, "protein": 4, "carbs": 26, "fat": 8, "fiber": 2}
                ]
            }
        }
    };
}

// Helper: called internally after a meals.json change to reselect & display plan
async function selectAndDisplayPlanOnMealsUpdate(profile) {
    // Ensure DB is loaded
    await loadMealsDatabase(false);

    // find region meals or fallback to first region
    const regionMeals = mealDatabase[profile.region] || mealDatabase[Object.keys(mealDatabase)[0]];
    let dietMeals = null;
    if (regionMeals) {
        dietMeals = regionMeals[profile.dietType] || regionMeals['Regular'] || Object.values(regionMeals)[0];
    }
    if (!dietMeals) {
        // nothing sensible - use fallback created by helper
        const fallback = createFallbackMeals();
        const firstRegion = Object.keys(fallback)[0];
        dietMeals = fallback[firstRegion][Object.keys(fallback[firstRegion])[0]];
    }

    const weeklyPlan = selectMealsForWeek(dietMeals, profile.targetCalories, profile);
    currentMealPlan = weeklyPlan;
    currentUserProfile = profile;
    displayMealPlan(weeklyPlan, profile);
    try {
        await createCharts(weeklyPlan, profile);
    } catch(e) { /* ignore chart errors */ }
    return weeklyPlan;
}

// Create default meal
function createDefaultMeal(mealType, targetCalories) {
    const defaultMeals = {
        breakfast: { title: "Mixed Breakfast", serving_size: "1 serving", calories: Math.round(targetCalories * 0.9) },
        lunch: { title: "Balanced Lunch", serving_size: "1 serving", calories: Math.round(targetCalories * 0.9) },
        dinner: { title: "Nutritious Dinner", serving_size: "1 serving", calories: Math.round(targetCalories * 0.9) },
        snacks: { title: "Healthy Snack", serving_size: "1 serving", calories: Math.round(targetCalories * 0.9) }
    };

    return {
        id: Date.now(),
        ...defaultMeals[mealType],
        protein: Math.round(targetCalories * 0.15 / 4),
        carbs: Math.round(targetCalories * 0.5 / 4),
        fat: Math.round(targetCalories * 0.35 / 9),
        fiber: Math.round(targetCalories * 0.03)
    };
}

// Utility to pick meals for a week from a given dietMeals object
function selectMealsForWeek(dietMeals, targetCalories, profile) {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const mealTypes = Object.keys(dietMeals).filter(k => ['breakfast','lunch','dinner','snacks','pre_workout','post_workout'].includes(k) || true);
    const weeklyPlan = {};

    // simple selection: prioritize meals that are close to target per meal
    const targetPerMeal = Math.max(120, Math.round(targetCalories / (mealTypes.length || 3)));

    const availableMeals = [];
    Object.values(dietMeals).forEach(list => {
        if (Array.isArray(list)) {
            list.forEach(m => availableMeals.push(m));
        }
    });

    // build a list of meals per mealType if present
    const mealsByType = {};
    Object.keys(dietMeals).forEach(mt => {
        if (Array.isArray(dietMeals[mt])) mealsByType[mt] = dietMeals[mt];
    });

    const usedMealIds = new Set();

    days.forEach(day => {
        weeklyPlan[day] = {};
        mealTypes.forEach(mealType => {
            const list = mealsByType[mealType] || availableMeals;
            let suitableMeals = list.filter(m => {
                if (!m) return false;
                const cal = safeNumber(m.calories);
                return Math.abs(cal - targetPerMeal) <= Math.round(targetPerMeal * 0.6);
            });

            if (suitableMeals.length === 0) {
                suitableMeals = list.filter(m => !usedMealIds.has(m.id));
            }

            if (suitableMeals.length === 0) {
                suitableMeals = list;
            }

            const seed = day.length + mealType.length + targetPerMeal;
            const selectedMeal = suitableMeals[seed % suitableMeals.length];
            weeklyPlan[day][mealType] = selectedMeal;
            usedMealIds.add(selectedMeal.id);
        });
    });

    return weeklyPlan;
}

// Generate meal plan
async function generateMealPlan() {
    try {
        await loadMealsDatabase(true);

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

        // Basic validation & defaults
        if (!profile.targetCalories || profile.targetCalories <= 0) {
            profile.targetCalories = Math.round(calculateDailyCalories(profile));
        }

        currentUserProfile = profile;

        const regionMeals = mealDatabase[profile.region];
        if (!regionMeals) {
            // fallback to first available region
            const firstRegion = Object.keys(mealDatabase)[0];
            if (!firstRegion) throw new Error('No meals available in database.');
            regionMeals = mealDatabase[firstRegion];
        }

        let dietMeals = regionMeals[profile.dietType];
        if (!dietMeals) {
            dietMeals = regionMeals['Regular'] || Object.values(regionMeals)[0];
            if (!dietMeals) {
                throw new Error(`No meals available for diet type: ${profile.dietType} in region: ${profile.region}`);
            }
        }

        const weeklyPlan = selectMealsForWeek(dietMeals, profile.targetCalories, profile);

        currentMealPlan = weeklyPlan;
        currentUserProfile = profile;

        localStorage.setItem('last_generated_plan_v1', JSON.stringify({
            plan: weeklyPlan,
            profile: profile,
            generated: new Date().toISOString()
        }));

        displayMealPlan(weeklyPlan, profile);
        await createCharts(weeklyPlan, profile);

        const planContent = document.getElementById('planContent');
        const planPlaceholder = document.getElementById('planPlaceholder');
        const analyticsContent = document.getElementById('analyticsContent');
        const analyticsPlaceholder = document.getElementById('analyticsPlaceholder');

        if (planContent) planContent.classList.remove('d-none');
        if (planPlaceholder) planPlaceholder.classList.add('d-none');
        if (analyticsContent) analyticsContent.classList.remove('d-none');
        if (analyticsPlaceholder) analyticsPlaceholder.classList.add('d-none');

        return weeklyPlan;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        alert('Failed to generate meal plan: ' + (error.message || error));
    }
}

// Calculate daily calories (Mifflin – St Jeor approximation)
function calculateDailyCalories(profile) {
    const age = safeNumber(profile.age);
    const weight = safeNumber(profile.weight);
    const height = safeNumber(profile.height);
    let bmr;
    if (profile.gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }
    const activityFactors = {
        'low': 1.2,
        'moderate': 1.375,
        'high': 1.55
    };
    const factor = activityFactors[profile.activityLevel] || 1.2;
    let calories = Math.round(bmr * factor);
    if (profile.goal === 'weight_loss') calories = Math.max(1200, Math.round(calories - 500));
    if (profile.goal === 'gain') calories = Math.round(calories + 300);
    return calories;
}

// Display plan to UI
function displayMealPlan(weeklyPlan, profile) {
    const planContainer = document.getElementById('planContainer');
    if (!planContainer) return;

    planContainer.innerHTML = '';
    Object.keys(weeklyPlan).forEach(day => {
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';

        const dayHeader = document.createElement('h3');
        dayHeader.textContent = day;
        dayCard.appendChild(dayHeader);

        const meals = weeklyPlan[day];
        const ul = document.createElement('ul');
        Object.keys(meals).forEach(mt => {
            const li = document.createElement('li');
            const meal = meals[mt];
            li.innerHTML = `<strong>${mt}:</strong> ${meal.title} — ${meal.serving_size || ''} (${meal.calories || 'N/A'} kcal)`;
            ul.appendChild(li);
        });
        dayCard.appendChild(ul);
        planContainer.appendChild(dayCard);
    });
}

// Create summary charts (stub-simple)
async function createCharts(weeklyPlan, profile) {
    // For performance and compatibility we keep it lightweight.
    try {
        // If your existing charts library is loaded, call into it here.
        // This function intentionally left as a low-impact call.
        return true;
    } catch (e) {
        console.warn('Chart creation failed:', e);
    }
}

// PDF export initialization
function initializePdfExport() {
    // lazy load html2pdf
    if (typeof window.html2pdf !== 'undefined') {
        Html2PdfLoaded = true;
    } else {
        const s = document.createElement('script');
        s.src = 'https://raw.githack.com/eKoopmans/html2pdf/master/dist/html2pdf.bundle.min.js';
        s.onload = () => { Html2PdfLoaded = true; };
        document.head.appendChild(s);
    }
}

async function generateAndDownloadPdf() {
    if (!Html2PdfLoaded) {
        console.warn('html2pdf not loaded yet. Waiting a short moment...');
        await new Promise(r => setTimeout(r, 300));
    }

    const content = document.getElementById('planExport');
    if (!content) {
        alert('No plan content to export.');
        return;
    }

    // clone to ensure layout not disrupted
    const pdfElement = content.cloneNode(true);
    pdfElement.style.width = '800px';
    pdfElement.style.padding = '20px';

    document.body.appendChild(pdfElement);
    try {
        await new Promise((resolve, reject) => {
            try {
                const opt = {
                    margin:       0.5,
                    filename:     'meal-plan.pdf',
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2 },
                    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
                };
                window.html2pdf().set(opt).from(pdfElement).save().then(resolve).catch(reject);
            } catch (err) {
                reject(err);
            }
        });
    } catch (e) {
        console.error('PDF generation failed:', e);
        alert('Failed to generate PDF: ' + (e.message || e));
    } finally {
        try { document.body.removeChild(pdfElement); } catch(e){/*ignore*/}
    }
}

// Save plan to tracker (send to tracker button handler)
function sendPlanToTracker() {
    if (!currentMealPlan) {
        alert('No plan generated yet.');
        return;
    }
    try {
        localStorage.setItem('last_sent_plan', JSON.stringify({
            plan: currentMealPlan,
            profile: currentUserProfile,
            sentAt: new Date().toISOString()
        }));
        // redirect to tracker page (if exists)
        if (window.location.pathname.endsWith('index.html')) {
            window.location.href = 'tracker.html';
        } else {
            // try relative
            window.location.href = 'tracker.html';
        }
    } catch (e) {
        console.error('Failed to send plan to tracker:', e);
        alert('Failed to send plan to tracker: ' + (e.message || e));
    }
}

// Load existing plan from storage
function loadExistingPlan() {
    try {
        const raw = localStorage.getItem('last_generated_plan_v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.plan) {
            currentMealPlan = parsed.plan;
            currentUserProfile = parsed.profile;
            displayMealPlan(parsed.plan, parsed.profile);
        }
    } catch (e) {
        console.warn('Could not load existing plan from localStorage:', e);
    }
}

// Simple form initialization
function initializeForm() {
    const genBtn = document.getElementById('generateBtn');
    if (genBtn) genBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await generateMealPlan();
    });

    const pdfBtn = document.getElementById('downloadPdfBtn');
    if (pdfBtn) pdfBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await generateAndDownloadPdf();
    });

    const sendBtn = document.getElementById('sendToTrackerBtn');
    if (sendBtn) sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendPlanToTracker();
    });
}

// Misc helpers and utilities (kept small)
function formatNumber(n) {
    return Number(n).toLocaleString();
}

// End of file (any additional functions from the original file remain unchanged)
