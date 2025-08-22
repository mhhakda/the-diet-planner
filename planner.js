// Diet Planner - Complete Version with PDF Export
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
// Load meals database
async function loadMealsDatabase(forceReload = false) {
    if (mealDatabase && !forceReload) return mealDatabase;

    const mealsUrl = `meals.json?v=${Date.now()}`;
    try {
        const response = await fetch(mealsUrl, { cache: 'no-store' });
        if (!response.ok) {
            console.warn('meals.json fetch returned non-ok status:', response.status);
            if (mealDatabase) return mealDatabase;
            mealDatabase = createFallbackMeals();
            return mealDatabase;
        }

        const newData = await response.json();
        let newSignature;
        try {
            newSignature = JSON.stringify(newData);
        } catch (err) {
            newSignature = Date.now().toString();
        }

        const isValidShape = newData && typeof newData === 'object' && Object.keys(newData).length > 0;
        if (!isValidShape) {
            console.warn('meals.json has unexpected structure — using fallback meals.');
            if (!mealDatabase) mealDatabase = createFallbackMeals();
            return mealDatabase;
        }

        const prevSignature = mealDatabase && mealDatabase._signature ? mealDatabase._signature : null;
        if (newSignature !== prevSignature) {
            try {
                Object.defineProperty(newData, '_signature', { value: newSignature, enumerable: false, writable: true });
            } catch (e) {
                newData._signature = newSignature;
            }
            mealDatabase = newData;
            console.log('✅ meals.json updated and loaded');

            if (currentUserProfile) {
                try {
                    await selectAndDisplayPlanOnMealsUpdate(currentUserProfile);
                } catch (err) {
                    console.error('Error regenerating plan after meals update:', err);
                }
            }
        } else {
            if (!mealDatabase) mealDatabase = newData;
            console.log('meals.json fetched — no changes detected');
        }

        return mealDatabase;
    } catch (error) {
        console.error('❌ Failed to load meals.json:', error);
        mealDatabase = createFallbackMeals();
        return mealDatabase;
    }
}
// Ensure meals DB
async function ensureMealsLoaded() {
    if (mealDatabase) return mealDatabase;
    if (!mealDbLoadPromise) {
        console.time('loadMealsDatabase');
        mealDbLoadPromise = loadMealsDatabase(true).finally(() => console.timeEnd('loadMealsDatabase'));
    }
    mealDatabase = await mealDbLoadPromise;
    return mealDatabase;
}
// Fallback meals
function createFallbackMeals() {
    return {
        "USA": { "Regular": { "breakfast": [ { "id": 1, "title": "Scrambled Eggs with Toast", "serving_size": "1 serving", "calories": 320, "protein": 18, "carbs": 28, "fat": 14, "fiber": 3 } ] } },
        "India": { "Regular": { "breakfast": [ { "id": 101, "title": "Poha", "serving_size": "1 plate", "calories": 300, "protein": 8, "carbs": 50, "fat": 6, "fiber": 4 } ] } }
    };
}

// Normalize + key finder (reused)
function normalizeKey(str) {
    return str ? str.toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^\w_]/g, '') : '';
}
function findKey(keys, desired, synonyms = {}) {
    if (!desired) return null;
    const normDesired = normalizeKey(desired);
    if (keys.includes(desired)) return desired;
    const ci = keys.find(k => k.toLowerCase() === desired.toLowerCase());
    if (ci) return ci;
    const norm = keys.find(k => normalizeKey(k) === normDesired);
    if (norm) return norm;
    const mapped = synonyms[normDesired];
    if (mapped && keys.includes(mapped)) return mapped;
    return null;
}
const dietSynonyms = { keto: "Keto", ketogenic: "Keto", vegetarian: "Vegetarian", vegan: "Vegan", regular: "Regular" };

// Generate meal plan
async function generateMealPlan() {
    try {
        await ensureMealsLoaded();
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
            profile.targetCalories = Math.round(calculateDailyCalories(profile));
        }

        currentUserProfile = profile;

        // ✅ FIX: smart region + diet selection
        let regionKey = findKey(Object.keys(mealDatabase), profile.region);
        if (!regionKey) regionKey = Object.keys(mealDatabase)[0];
        let regionMeals = mealDatabase[regionKey];

        let dietKey = findKey(Object.keys(regionMeals), profile.dietType, dietSynonyms);
        if (!dietKey) dietKey = "Regular";
        let dietMeals = regionMeals[dietKey];

        if (!dietMeals) throw new Error(`No meals available for diet type: ${profile.dietType} in region: ${profile.region}`);

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

        document.getElementById('planContent')?.classList.remove('d-none');
        document.getElementById('planPlaceholder')?.classList.add('d-none');
        document.getElementById('analyticsContent')?.classList.remove('d-none');
        document.getElementById('analyticsPlaceholder')?.classList.add('d-none');

        return weeklyPlan;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        alert('Failed to generate meal plan: ' + (error.message || error));
    }
}

// ✅ FIX: PDF export use correct container
async function generateAndDownloadPdf() {
    async function waitForHtml2pdf(timeout = 7000) {
        const start = Date.now();
        while (typeof window.html2pdf === 'undefined') {
            if (Date.now() - start > timeout) throw new Error('html2pdf not available');
            await new Promise(r => setTimeout(r, 100));
        }
    }
    const content = document.getElementById('planContainer'); // FIXED ✅
    if (!content) {
        alert('No plan content to export.');
        return;
    }
    await waitForHtml2pdf();
    const opt = { margin: 0.5, filename: 'meal-plan.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } };
    await window.html2pdf().set(opt).from(content).save();
}
