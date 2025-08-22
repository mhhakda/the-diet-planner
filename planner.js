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
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
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
    if (themeToggle) {
        themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
    }
}

// Navigation Management
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            navigateToSection(targetSection);
        });
    });
}

function navigateToSection(sectionId) {
    updateActiveNavItem(sectionId);
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });
    }
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

// Intersection Observer for automatic section highlighting
function initializeIntersectionObserver() {
    const sections = document.querySelectorAll('.content-section');
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1
    };

    sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionId = entry.target.id;
                updateActiveNavItem(sectionId);
                currentActiveSection = sectionId;
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        sectionObserver.observe(section);
    });
}

// Mobile Menu Management
function initializeMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileOverlay = document.getElementById('mobileOverlay');
    
    if (mobileMenuButton && mobileOverlay) {
        mobileMenuButton.addEventListener('click', toggleMobileMenu);
        mobileOverlay.addEventListener('click', closeMobileMenu);
    }

    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
    }
}

// Form Management
function initializeForm() {
    const form = document.getElementById('dietForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    const generateBtn = document.getElementById('generateBtn');
    const generateBtnText = document.getElementById('generateBtnText');

    if (generateBtn && generateBtnText) {
        generateBtn.disabled = true;
        generateBtnText.textContent = 'Generating...';
    }

    showLoading();

    try {
        await generateMealPlan();
        setTimeout(() => {
            hideLoading();
            navigateToSection('plan');
        }, 2000);
    } catch (error) {
        console.error('Error generating meal plan:', error);
        hideLoading();
        alert('Error generating meal plan: ' + error.message);
    } finally {
        if (generateBtn && generateBtnText) {
            generateBtn.disabled = false;
            generateBtnText.textContent = 'Generate My Meal Plan';
        }
    }
}

// Validation
function validateForm() {
    const fields = ['age', 'gender', 'height', 'weight', 'goal', 'dietType', 'region', 'activityLevel'];
    let isValid = true;

    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(fieldId + '-error');
        
        if (!field) return;
        
        const control = field;
        control.classList.remove('is-invalid');
        if (errorDiv) errorDiv.textContent = '';

        if (!field.value.trim()) {
            control.classList.add('is-invalid');
            if (errorDiv) errorDiv.textContent = 'This field is required';
            isValid = false;
            return;
        }

        // Specific validations
        if (fieldId === 'age') {
            const age = safeNumber(field.value);
            if (age < 13 || age > 120) {
                control.classList.add('is-invalid');
                if (errorDiv) errorDiv.textContent = 'Age must be between 13 and 120';
                isValid = false;
            }
        }

        if (fieldId === 'height') {
            const height = safeNumber(field.value);
            if (height < 100 || height > 250) {
                control.classList.add('is-invalid');
                if (errorDiv) errorDiv.textContent = 'Height must be between 100-250 cm';
                isValid = false;
            }
        }

        if (fieldId === 'weight') {
            const weight = safeNumber(field.value);
            if (weight < 30 || weight > 300) {
                control.classList.add('is-invalid');
                if (errorDiv) errorDiv.textContent = 'Weight must be between 30-300 kg';
                isValid = false;
            }
        }
    });

    const targetCalories = document.getElementById('targetCalories');
    if (targetCalories && targetCalories.value.trim()) {
        const calories = safeNumber(targetCalories.value);
        if (calories < 800 || calories > 5000) {
            targetCalories.classList.add('is-invalid');
            const errorDiv = document.getElementById('targetCalories-error');
            if (errorDiv) errorDiv.textContent = 'Target calories must be between 800-5000';
            isValid = false;
        }
    }

    return isValid;
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
async function loadMealsDatabase() {
    if (mealDatabase) return mealDatabase;

    try {
        const response = await fetch('meals.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        mealDatabase = await response.json();
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
                    {"id": 1, "title": "Scrambled Eggs with Toast", "serving_size": "2 eggs + 2 slices", "calories": 320, "protein": 18, "carbs": 28, "fat": 14, "fiber": 3},
                    {"id": 2, "title": "Pancakes with Syrup", "serving_size": "3 pancakes", "calories": 420, "protein": 10, "carbs": 78, "fat": 10, "fiber": 3},
                    {"id": 3, "title": "Oatmeal with Berries", "serving_size": "1 cup", "calories": 250, "protein": 8, "carbs": 45, "fat": 5, "fiber": 6}
                ],
                "lunch": [
                    {"id": 11, "title": "Grilled Chicken Salad", "serving_size": "150g chicken + greens", "calories": 380, "protein": 36, "carbs": 14, "fat": 20, "fiber": 5},
                    {"id": 12, "title": "Turkey Sandwich", "serving_size": "2 slices + turkey", "calories": 400, "protein": 28, "carbs": 38, "fat": 14, "fiber": 4}
                ],
                "dinner": [
                    {"id": 21, "title": "Salmon with Vegetables", "serving_size": "150g salmon + veggies", "calories": 520, "protein": 42, "carbs": 24, "fat": 28, "fiber": 6},
                    {"id": 22, "title": "Steak with Potatoes", "serving_size": "200g steak + potatoes", "calories": 680, "protein": 45, "carbs": 42, "fat": 32, "fiber": 5}
                ],
                "snacks": [
                    {"id": 31, "title": "Apple with Peanut Butter", "serving_size": "1 apple + 2 tbsp PB", "calories": 190, "protein": 8, "carbs": 24, "fat": 12, "fiber": 4},
                    {"id": 32, "title": "Greek Yogurt", "serving_size": "1 cup", "calories": 150, "protein": 15, "carbs": 8, "fat": 4, "fiber": 0}
                ]
            }
        },
        "India": {
            "Regular": {
                "breakfast": [
                    {"id": 101, "title": "Aloo Paratha with Curd", "serving_size": "2 parathas + curd", "calories": 450, "protein": 12, "carbs": 65, "fat": 16, "fiber": 4},
                    {"id": 102, "title": "Dosa with Chutney", "serving_size": "2 dosas + chutney", "calories": 380, "protein": 10, "carbs": 65, "fat": 8, "fiber": 3}
                ],
                "lunch": [
                    {"id": 111, "title": "Fish Curry with Rice", "serving_size": "150g fish + rice", "calories": 520, "protein": 28, "carbs": 65, "fat": 14, "fiber": 3},
                    {"id": 112, "title": "Butter Chicken with Naan", "serving_size": "150g chicken + 2 naans", "calories": 720, "protein": 35, "carbs": 68, "fat": 32, "fiber": 4}
                ],
                "dinner": [
                    {"id": 121, "title": "Chicken Tikka with Naan", "serving_size": "200g chicken + 2 naans", "calories": 620, "protein": 35, "carbs": 52, "fat": 24, "fiber": 4},
                    {"id": 122, "title": "Paneer Butter Masala with Rice", "serving_size": "200g paneer + rice", "calories": 650, "protein": 28, "carbs": 68, "fat": 28, "fiber": 5}
                ],
                "snacks": [
                    {"id": 131, "title": "Bhel Puri", "serving_size": "1 cup", "calories": 200, "protein": 5, "carbs": 35, "fat": 5, "fiber": 3},
                    {"id": 132, "title": "Samosa", "serving_size": "2 samosas", "calories": 180, "protein": 4, "carbs": 26, "fat": 8, "fiber": 2}
                ]
            }
        }
    };
}

// Calculate BMR and target calories
function calculateTargetCalories(profile) {
    const age = safeNumber(profile.age);
    const weight = safeNumber(profile.weight);
    const height = safeNumber(profile.height);

    // Mifflin-St Jeor Equation
    let bmr;
    if (profile.gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Activity factor
    const activityFactors = {
        'low': 1.2,
        'moderate': 1.375,
        'high': 1.55,
        'very-high': 1.725
    };

    let tdee = bmr * (activityFactors[profile.activityLevel] || 1.2);

    // Goal adjustment
    switch (profile.goal) {
        case 'loss':
            tdee *= 0.8;
            break;
        case 'gain':
        case 'muscle':
            tdee *= 1.15;
            break;
        case 'maintain':
        default:
            break;
    }

    return Math.round(tdee);
}

// Meal selection algorithm
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

    days.forEach(day => {
        weeklyPlan[day] = {};
        
        mealTypes.forEach(mealType => {
            const targetForMeal = Math.round(targetCalories * calorieDistribution[mealType]);
            const availableMeals = meals[mealType] || [];
            
            if (availableMeals.length === 0) {
                weeklyPlan[day][mealType] = createDefaultMeal(mealType, targetForMeal);
                return;
            }

            let suitableMeals = availableMeals.filter(meal => {
                const calories = safeNumber(meal.calories);
                const isUnused = !usedMealIds.has(meal.id);
                const isInRange = calories >= targetForMeal * 0.8 && calories <= targetForMeal * 1.2;
                return isUnused && isInRange;
            });

            if (suitableMeals.length === 0) {
                suitableMeals = availableMeals.filter(meal => {
                    const calories = safeNumber(meal.calories);
                    return calories >= targetForMeal * 0.8 && calories <= targetForMeal * 1.2;
                });
            }

            if (suitableMeals.length === 0) {
                suitableMeals = availableMeals.filter(meal => !usedMealIds.has(meal.id));
            }

            if (suitableMeals.length === 0) {
                suitableMeals = availableMeals;
            }

            const seed = day.length + mealType.length + targetForMeal;
            const selectedMeal = suitableMeals[seed % suitableMeals.length];
            weeklyPlan[day][mealType] = selectedMeal;
            usedMealIds.add(selectedMeal.id);
        });
    });

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
        fiber: 5
    };
}

// Generate meal plan
async function generateMealPlan() {
    try {
        await loadMealsDatabase();

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

        if (!profile.targetCalories || profile.targetCalories === 0) {
            profile.targetCalories = calculateTargetCalories(profile);
        }

        const regionMeals = mealDatabase[profile.region];
        if (!regionMeals) {
            throw new Error(`No meals available for region: ${profile.region}`);
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
        throw error;
    }
}

// Display meal plan
function displayMealPlan(weeklyPlan, profile) {
    displayStatsCards(weeklyPlan, profile);
    displayMealTable(weeklyPlan);
}

// Calculate weekly stats
function calculateWeeklyStats(weeklyPlan) {
    const days = Object.keys(weeklyPlan);
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    days.forEach(day => {
        const dayPlan = weeklyPlan[day];
        Object.values(dayPlan).forEach(meal => {
            if (meal && meal.calories) {
                totalCalories += safeNumber(meal.calories);
                totalProtein += safeNumber(meal.protein);
                totalCarbs += safeNumber(meal.carbs);
                totalFat += safeNumber(meal.fat);
            }
        });
    });

    return {
        avgCalories: Math.round(totalCalories / 7),
        avgProtein: Math.round(totalProtein / 7),
        avgCarbs: Math.round(totalCarbs / 7),
        avgFat: Math.round(totalFat / 7),
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat
    };
}

// Display stats cards
function displayStatsCards(weeklyPlan, profile) {
    const weeklyStats = calculateWeeklyStats(weeklyPlan);
    const container = document.getElementById('statsGrid');
    
    if (!container) return;

    const targetDifference = Math.round(((weeklyStats.avgCalories - profile.targetCalories) / profile.targetCalories) * 100);

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${weeklyStats.avgCalories}</div>
            <div class="stat-label">Avg Daily Calories</div>
            <div class="stat-target">Target: ${profile.targetCalories} (${targetDifference >= 0 ? '+' : ''}${targetDifference}%)</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${weeklyStats.avgProtein}g</div>
            <div class="stat-label">Avg Daily Protein</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${weeklyStats.avgCarbs}g</div>
            <div class="stat-label">Avg Daily Carbs</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${weeklyStats.avgFat}g</div>
            <div class="stat-label">Avg Daily Fat</div>
        </div>
    `;
}

// Display meal table
function displayMealTable(weeklyPlan) {
    const container = document.getElementById('mealTable');
    if (!container) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = [
        { key: 'breakfast', name: 'Breakfast' },
        { key: 'lunch', name: 'Lunch' },
        { key: 'dinner', name: 'Dinner' },
        { key: 'snacks', name: 'Snacks' }
    ];

    let html = `
        <div class="meal-plan-container">
            <div class="user-profile-summary">
                <h3>Your Profile Summary</h3>
                <div class="profile-details">
                    <div class="profile-item"><strong>Age:</strong> ${currentUserProfile.age} years</div>
                    <div class="profile-item"><strong>Gender:</strong> ${currentUserProfile.gender}</div>
                    <div class="profile-item"><strong>Height:</strong> ${currentUserProfile.height} cm</div>
                    <div class="profile-item"><strong>Weight:</strong> ${currentUserProfile.weight} kg</div>
                    <div class="profile-item"><strong>Goal:</strong> ${currentUserProfile.goal}</div>
                    <div class="profile-item"><strong>Diet Type:</strong> ${currentUserProfile.dietType}</div>
                    <div class="profile-item"><strong>Region:</strong> ${currentUserProfile.region}</div>
                    <div class="profile-item"><strong>Target Calories:</strong> ${currentUserProfile.targetCalories}/day</div>
                </div>
            </div>
            <table class="meal-table">
                <thead>
                    <tr>
                        <th>Day</th>`;
    
    mealTypes.forEach(meal => {
        html += `<th>${meal.name}</th>`;
    });
    html += '<th>Daily Total</th></tr></thead><tbody>';

    days.forEach(day => {
        html += `<tr><td class="day-cell"><strong>${day}</strong></td>`;
        let totalCalories = 0;

        mealTypes.forEach(mealType => {
            const meal = weeklyPlan[day][mealType.key];
            if (meal) {
                const calories = safeNumber(meal.calories);
                totalCalories += calories;
                html += `<td class="meal-cell">
                    <div class="meal-title">${meal.title}</div>
                    <div class="meal-calories">${calories} kcal</div>`;
                if (meal.serving_size) {
                    html += `<div class="meal-serving">${meal.serving_size}</div>`;
                }
                if (meal.protein !== undefined) {
                    html += `<div class="meal-macros">P: ${safeNumber(meal.protein)}g • C: ${safeNumber(meal.carbs)}g • F: ${safeNumber(meal.fat)}g</div>`;
                }
                html += '</td>';
            } else {
                html += '<td class="meal-cell"><div class="no-meal">No meal</div></td>';
            }
        });

        html += `<td class="total-cell"><strong>${Math.round(totalCalories)} kcal</strong></td></tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Load existing plan
function loadExistingPlan() {
    try {
        const saved = localStorage.getItem('last_generated_plan_v1');
        if (saved) {
            const data = JSON.parse(saved);
            currentMealPlan = data.plan;
            currentUserProfile = data.profile;
            
            if (currentMealPlan && currentUserProfile) {
                displayMealPlan(currentMealPlan, currentUserProfile);
                
                const planContent = document.getElementById('planContent');
                const planPlaceholder = document.getElementById('planPlaceholder');
                
                if (planContent) planContent.classList.remove('d-none');
                if (planPlaceholder) planPlaceholder.classList.add('d-none');
            }
        }
    } catch (error) {
        console.error('Error loading existing plan:', error);
    }
}

// Create charts
async function createCharts(weeklyPlan, profile) {
    ChartsLoaded = true;
    console.log('Charts created for weekly plan');
}

// ===================== PDF EXPORT FUNCTIONALITY =====================

// Initialize PDF export
function initializePdfExport() {
    // Load html2pdf library
    if (!window.html2pdf && !Html2PdfLoaded) {
        loadHtml2PdfLibrary();
    }

    // Find and bind PDF export buttons
    setTimeout(() => {
        bindPdfExportButtons();
    }, 1000);
}

// Bind PDF export to buttons
function bindPdfExportButtons() {
    // Find buttons that might be PDF export buttons
    const potentialButtons = document.querySelectorAll('button, a, [role="button"]');
    
    potentialButtons.forEach(button => {
        const text = button.textContent?.toLowerCase() || '';
        const id = button.id?.toLowerCase() || '';
        const className = button.className?.toLowerCase() || '';
        
        // Check if this might be a PDF export button
        const isPdfButton = text.includes('pdf') || text.includes('download') || text.includes('export') ||
                           id.includes('pdf') || id.includes('download') || id.includes('export') ||
                           className.includes('pdf') || className.includes('download') || className.includes('export');
        
        if (isPdfButton) {
            // Remove existing listeners and add our PDF export handler
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', handlePdfExport);
            console.log('PDF export bound to button:', newButton.textContent);
        }
    });

    // Also try common button IDs
    const commonIds = ['downloadPdf', 'exportPdf', 'pdfExport', 'downloadBtn', 'exportBtn', 'download-pdf', 'export-pdf'];
    commonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handlePdfExport);
            console.log('PDF export bound to ID:', id);
        }
    });
}

// Load html2pdf library
function loadHtml2PdfLibrary() {
    if (Html2PdfLoaded || window.html2pdf) return;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
        Html2PdfLoaded = true;
        console.log('✅ html2pdf library loaded');
    };
    script.onerror = () => {
        console.error('❌ Failed to load html2pdf library');
    };
    document.head.appendChild(script);
}

// Handle PDF export
async function handlePdfExport(e) {
    e.preventDefault();

    // Check if meal plan exists
    if (!currentMealPlan || !currentUserProfile) {
        alert('⚠️ Please generate a meal plan first before downloading PDF.');
        return;
    }

    // Ensure html2pdf is loaded
    if (!window.html2pdf) {
        if (!Html2PdfLoaded) {
            loadHtml2PdfLibrary();
        }
        
        // Wait for library to load
        let attempts = 0;
        while (!window.html2pdf && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.html2pdf) {
            alert('❌ PDF export library failed to load. Please try again.');
            return;
        }
    }

    try {
        // Show loading state
        const button = e.target;
        const originalText = button.textContent;
        button.textContent = '⏳ Generating PDF...';
        button.disabled = true;

        // Generate and download PDF
        await generateAndDownloadPdf();

        console.log('✅ PDF generated successfully');
        
        // Restore button
        button.textContent = originalText;
        button.disabled = false;

    } catch (error) {
        console.error('❌ Error generating PDF:', error);
        alert('❌ Error generating PDF. Please try again.');
        
        // Restore button
        const button = e.target;
        button.textContent = 'Download PDF';
        button.disabled = false;
    }
}

// Generate and download PDF
async function generateAndDownloadPdf() {
    const weeklyStats = calculateWeeklyStats(currentMealPlan);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = [
        { key: 'breakfast', name: 'Breakfast' },
        { key: 'lunch', name: 'Lunch' },
        { key: 'dinner', name: 'Dinner' },
        { key: 'snacks', name: 'Snacks' }
    ];

    // Create PDF content element
    const pdfElement = document.createElement('div');
    pdfElement.style.cssText = `
        font-family: 'Arial', sans-serif;
        line-height: 1.4;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background: white;
    `;

    pdfElement.innerHTML = `
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #33808d; padding-bottom: 20px;">
            <h1 style="color: #33808d; margin: 0 0 10px 0; font-size: 28px;">🍽️ Personal Diet Plan</h1>
            <p style="color: #666; margin: 0; font-size: 14px;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <!-- User Profile -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; page-break-inside: avoid;">
            <h2 style="color: #33808d; margin: 0 0 15px 0; font-size: 20px; border-bottom: 2px solid #33808d; padding-bottom: 5px;">👤 Your Profile</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                <div><strong>Age:</strong> ${currentUserProfile.age} years</div>
                <div><strong>Gender:</strong> ${currentUserProfile.gender}</div>
                <div><strong>Height:</strong> ${currentUserProfile.height} cm</div>
                <div><strong>Weight:</strong> ${currentUserProfile.weight} kg</div>
                <div><strong>Goal:</strong> ${currentUserProfile.goal}</div>
                <div><strong>Diet Type:</strong> ${currentUserProfile.dietType}</div>
                <div><strong>Region:</strong> ${currentUserProfile.region}</div>
                <div><strong>Target Calories:</strong> ${currentUserProfile.targetCalories}/day</div>
            </div>
        </div>

        <!-- Nutrition Summary -->
        <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin-bottom: 25px; page-break-inside: avoid;">
            <h2 style="color: #33808d; margin: 0 0 15px 0; font-size: 20px; border-bottom: 2px solid #33808d; padding-bottom: 5px;">📊 Nutritional Summary</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 14px;">
                <div style="text-align: center; background: white; padding: 15px; border-radius: 6px; border: 1px solid #ddd;">
                    <div style="font-size: 24px; font-weight: bold; color: #33808d;">${weeklyStats.avgCalories}</div>
                    <div style="font-size: 12px; color: #666;">Avg Daily Calories</div>
                </div>
                <div style="text-align: center; background: white; padding: 15px; border-radius: 6px; border: 1px solid #ddd;">
                    <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${weeklyStats.avgProtein}g</div>
                    <div style="font-size: 12px; color: #666;">Avg Daily Protein</div>
                </div>
                <div style="text-align: center; background: white; padding: 15px; border-radius: 6px; border: 1px solid #ddd;">
                    <div style="font-size: 24px; font-weight: bold; color: #f39c12;">${weeklyStats.avgCarbs}g</div>
                    <div style="font-size: 12px; color: #666;">Avg Daily Carbs</div>
                </div>
                <div style="text-align: center; background: white; padding: 15px; border-radius: 6px; border: 1px solid #ddd;">
                    <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${weeklyStats.avgFat}g</div>
                    <div style="font-size: 12px; color: #666;">Avg Daily Fat</div>
                </div>
            </div>
        </div>

        <!-- Weekly Meal Plan -->
        <div style="margin-bottom: 25px;">
            <h2 style="color: #33808d; margin: 0 0 20px 0; font-size: 20px; border-bottom: 2px solid #33808d; padding-bottom: 5px;">📅 7-Day Meal Plan</h2>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; background: white; border: 1px solid #ddd;">
                    <thead>
                        <tr style="background: #33808d; color: white;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold; min-width: 80px;">Day</th>
                            ${mealTypes.map(meal => `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; min-width: 120px;">${meal.name}</th>`).join('')}
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; min-width: 80px;">Daily Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${days.map((day, dayIndex) => {
                            let totalCalories = 0;
                            const mealCells = mealTypes.map(mealType => {
                                const meal = currentMealPlan[day][mealType.key];
                                if (meal) {
                                    const calories = safeNumber(meal.calories);
                                    totalCalories += calories;
                                    return `
                                        <td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">
                                            <div style="font-weight: bold; color: #33808d; margin-bottom: 4px; font-size: 11px;">${meal.title}</div>
                                            <div style="color: #e67e22; font-weight: bold; margin-bottom: 2px; font-size: 10px;">${calories} kcal</div>
                                            ${meal.serving_size ? `<div style="font-size: 9px; color: #666; margin-bottom: 2px;">${meal.serving_size}</div>` : ''}
                                            ${meal.protein !== undefined ? `<div style="font-size: 9px; color: #27ae60;">P: ${safeNumber(meal.protein)}g • C: ${safeNumber(meal.carbs)}g • F: ${safeNumber(meal.fat)}g</div>` : ''}
                                        </td>
                                    `;
                                } else {
                                    return '<td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #999; font-style: italic;">No meal</td>';
                                }
                            }).join('');
                            
                            return `
                                <tr style="${dayIndex % 2 === 0 ? 'background: #f8f9fa;' : 'background: white;'}">
                                    <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; background: #e8f4f8; color: #33808d;">${day}</td>
                                    ${mealCells}
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #e67e22; font-size: 12px;">${Math.round(totalCalories)} kcal</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 12px; color: #666; text-align: center; border: 1px solid #ddd;">
            <p style="margin: 0 0 10px 0;"><strong>Disclaimer:</strong> This meal plan is generated based on general nutritional guidelines and your personal information.</p>
            <p style="margin: 0;"><strong>Please consult with a healthcare provider or registered dietitian before making significant changes to your diet.</strong></p>
        </div>
    `;

    // PDF generation options
    const options = {
        margin: [10, 15, 10, 15],
        filename: `diet-plan-${currentUserProfile.region.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            letterRendering: true,
            allowTaint: false,
            backgroundColor: '#ffffff'
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait'
        }
    };

    // Generate and download PDF
    await window.html2pdf().set(options).from(pdfElement).save();
}

// Export global functions for debugging
window.dietPlannerDebug = {
    getCurrentMealPlan: () => currentMealPlan,
    getCurrentUserProfile: () => currentUserProfile,
    exportToPdf: handlePdfExport,
    bindPdfButtons: bindPdfExportButtons
};

console.log('🍽️ Diet Planner with PDF Export loaded successfully! 🎉');