// Diet Planner - Tracker Style JavaScript
// Matching the Diet Tracker design and functionality

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
    
    console.log('🍽️ Diet Planner loaded successfully! 🎉');
});

// Theme Management
function initializeTheme() {
    document.body.setAttribute('data-theme', currentTheme);
    updateThemeToggle();
    
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', toggleTheme);
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeToggle();
}

function updateThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.textContent = currentTheme === 'light' ? '🌙' : '☀️';
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
    // Update active nav item
    updateActiveNavItem(sectionId);
    
    // Scroll to section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest' 
        });
    }
    
    // Close mobile menu if open
    closeMobileMenu();
    
    // Update current active section
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
    
    mobileMenuButton.addEventListener('click', toggleMobileMenu);
    mobileOverlay.addEventListener('click', closeMobileMenu);
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
}

// Form Management
function initializeForm() {
    const form = document.getElementById('dietForm');
    form.addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    const generateBtn = document.getElementById('generateBtn');
    const generateBtnText = document.getElementById('generateBtnText');
    
    // Update button state
    generateBtn.disabled = true;
    generateBtnText.textContent = 'Generating...';
    
    // Show loading
    showLoading();

    try {
        await generateMealPlan();
        
        // Navigate to plan section after generation
        setTimeout(() => {
            hideLoading();
            navigateToSection('plan');
        }, 2000);
        
    } catch (error) {
        console.error('Error generating meal plan:', error);
        hideLoading();
        alert('Error generating meal plan: ' + error.message);
    } finally {
        generateBtn.disabled = false;
        generateBtnText.textContent = 'Generate My Meal Plan';
    }
}

// Validation
function validateForm() {
    const fields = ['age', 'gender', 'height', 'weight', 'goal', 'dietType', 'region', 'activityLevel'];
    let isValid = true;

    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(fieldId + '-error');
        const control = field;
        
        // Clear previous errors
        control.classList.remove('is-invalid');
        errorDiv.textContent = '';

        // Validate required fields
        if (!field.value.trim()) {
            control.classList.add('is-invalid');
            errorDiv.textContent = 'This field is required';
            isValid = false;
            return;
        }

        // Specific validations
        if (fieldId === 'age') {
            const age = safeNumber(field.value);
            if (age < 13 || age > 120) {
                control.classList.add('is-invalid');
                errorDiv.textContent = 'Age must be between 13 and 120';
                isValid = false;
            }
        }

        if (fieldId === 'height') {
            const height = safeNumber(field.value);
            if (height < 100 || height > 250) {
                control.classList.add('is-invalid');
                errorDiv.textContent = 'Height must be between 100-250 cm';
                isValid = false;
            }
        }

        if (fieldId === 'weight') {
            const weight = safeNumber(field.value);
            if (weight < 30 || weight > 300) {
                control.classList.add('is-invalid');
                errorDiv.textContent = 'Weight must be between 30-300 kg';
                isValid = false;
            }
        }
    });

    // Validate target calories if provided
    const targetCalories = document.getElementById('targetCalories');
    if (targetCalories.value.trim()) {
        const calories = safeNumber(targetCalories.value);
        if (calories < 800 || calories > 5000) {
            targetCalories.classList.add('is-invalid');
            document.getElementById('targetCalories-error').textContent = 'Target calories must be between 800-5000';
            isValid = false;
        }
    }

    return isValid;
}

// Loading State Management
function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
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
                    {"id": 102, "title": "Dosa with Chutney", "serving_size": "2 dosas + chutney", "calories": 380, "protein": 10, "carbs": 65, "fat": 8, "fiber": 3},
                    {"id": 103, "title": "Medu Vada with Sambar", "serving_size": "3 vadas + sambar", "calories": 380, "protein": 12, "carbs": 48, "fat": 16, "fiber": 5}
                ],
                "lunch": [
                    {"id": 111, "title": "Fish Curry with Rice", "serving_size": "150g fish + rice", "calories": 520, "protein": 28, "carbs": 65, "fat": 14, "fiber": 3},
                    {"id": 112, "title": "Butter Chicken with Naan", "serving_size": "150g chicken + 2 naans", "calories": 720, "protein": 35, "carbs": 68, "fat": 32, "fiber": 4},
                    {"id": 113, "title": "Biryani", "serving_size": "1 plate", "calories": 520, "protein": 22, "carbs": 78, "fat": 16, "fiber": 3}
                ],
                "dinner": [
                    {"id": 121, "title": "Chicken Tikka with Naan", "serving_size": "200g chicken + 2 naans", "calories": 620, "protein": 35, "carbs": 52, "fat": 24, "fiber": 4},
                    {"id": 122, "title": "Paneer Butter Masala with Rice", "serving_size": "200g paneer + rice", "calories": 650, "protein": 28, "carbs": 68, "fat": 28, "fiber": 5},
                    {"id": 123, "title": "Dal Makhani with Rice", "serving_size": "1 cup dal + rice", "calories": 520, "protein": 18, "carbs": 72, "fat": 16, "fiber": 8}
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
            tdee *= 0.8; // 20% deficit
            break;
        case 'gain':
        case 'muscle':
            tdee *= 1.15; // 15% surplus
            break;
        case 'maintain':
        default:
            // No change
            break;
    }

    return Math.round(tdee);
}

// Deterministic meal selection algorithm
function selectMealsForWeek(meals, targetCalories, profile) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const weeklyPlan = {};
    const usedMealIds = new Set();

    // Calorie distribution
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

            // Filter suitable meals (within 20% of target)
            let suitableMeals = availableMeals.filter(meal => {
                const calories = safeNumber(meal.calories);
                const isUnused = !usedMealIds.has(meal.id);
                const isInRange = calories >= targetForMeal * 0.8 && calories <= targetForMeal * 1.2;
                return isUnused && isInRange;
            });

            // If no suitable unused meals, use all suitable meals
            if (suitableMeals.length === 0) {
                suitableMeals = availableMeals.filter(meal => {
                    const calories = safeNumber(meal.calories);
                    return calories >= targetForMeal * 0.8 && calories <= targetForMeal * 1.2;
                });
            }

            // If still no suitable meals, use any unused meal
            if (suitableMeals.length === 0) {
                suitableMeals = availableMeals.filter(meal => !usedMealIds.has(meal.id));
            }

            // Last resort: use any meal
            if (suitableMeals.length === 0) {
                suitableMeals = availableMeals;
            }

            // Deterministic selection based on day and meal type
            const seed = day.length + mealType.length + targetForMeal;
            const selectedMeal = suitableMeals[seed % suitableMeals.length];
            
            weeklyPlan[day][mealType] = selectedMeal;
            usedMealIds.add(selectedMeal.id);
        });
    });

    return weeklyPlan;
}

// Create default meal when no meals available
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
        // Load meals database
        await loadMealsDatabase();

        // Get user profile
        const profile = {
            age: safeNumber(document.getElementById('age').value),
            gender: document.getElementById('gender').value,
            height: safeNumber(document.getElementById('height').value),
            weight: safeNumber(document.getElementById('weight').value),
            goal: document.getElementById('goal').value,
            dietType: document.getElementById('dietType').value,
            region: document.getElementById('region').value,
            activityLevel: document.getElementById('activityLevel').value,
            targetCalories: safeNumber(document.getElementById('targetCalories').value)
        };

        // Calculate target calories if not provided
        if (!profile.targetCalories || profile.targetCalories === 0) {
            profile.targetCalories = calculateTargetCalories(profile);
        }

        // Get meals for region and diet type
        const regionMeals = mealDatabase[profile.region];
        if (!regionMeals) {
            throw new Error(`No meals available for region: ${profile.region}`);
        }

        let dietMeals = regionMeals[profile.dietType];
        if (!dietMeals) {
            // Fallback to Regular if diet type not available
            dietMeals = regionMeals['Regular'] || Object.values(regionMeals)[0];
            if (!dietMeals) {
                throw new Error(`No meals available for diet type: ${profile.dietType} in region: ${profile.region}`);
            }
        }

        // Generate weekly plan
        const weeklyPlan = selectMealsForWeek(dietMeals, profile.targetCalories, profile);

        // Store data globally
        currentMealPlan = weeklyPlan;
        currentUserProfile = profile;

        // Save to localStorage
        localStorage.setItem('last_generated_plan_v1', JSON.stringify({
            plan: weeklyPlan,
            profile: profile,
            generated: new Date().toISOString()
        }));

        // Display results
        displayMealPlan(weeklyPlan, profile);
        await createCharts(weeklyPlan, profile);
        
        // Show content sections
        document.getElementById('planContent').classList.remove('d-none');
        document.getElementById('planPlaceholder').classList.add('d-none');
        document.getElementById('analyticsContent').classList.remove('d-none');
        document.getElementById('analyticsPlaceholder').classList.add('d-none');

        return weeklyPlan;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        throw error;
    }
}

// Display meal plan with stats
function displayMealPlan(weeklyPlan, profile) {
    displayStatsCards(weeklyPlan, profile);
    displayMealTable(weeklyPlan);
}

// Display stats cards with tracker-style layout
function displayStatsCards(weeklyPlan, profile) {
    const weeklyStats = calculateWeeklyStats(weeklyPlan);
    const container = document.getElementById('statsGrid');
    
    const targetDifference = Math.round(((weeklyStats.avgCalories - profile.targetCalories) / profile.targetCalories) * 100);
    
    container.innerHTML = `
        <div class="stat-card fade-in">
            <div class="stat-title">Calories</div>
            <div class="stat-value">${Math.round(weeklyStats.avgCalories)}<span class="stat-unit"></span></div>
            <div class="stat-target">/ ${profile.targetCalories}</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Protein</div>
            <div class="stat-value">${Math.round(weeklyStats.avgProtein)}<span class="stat-unit">g</span></div>
            <div class="stat-target">/ ${Math.round(profile.targetCalories * 0.15 / 4)}g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Carbs</div>
            <div class="stat-value">${Math.round(weeklyStats.avgCarbs)}<span class="stat-unit">g</span></div>
            <div class="stat-target">/ ${Math.round(profile.targetCalories * 0.5 / 4)}g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Fat</div>
            <div class="stat-value">${Math.round(weeklyStats.avgFat)}<span class="stat-unit">g</span></div>
            <div class="stat-target">/ ${Math.round(profile.targetCalories * 0.35 / 9)}g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Fiber</div>
            <div class="stat-value">${Math.round(weeklyStats.avgFiber)}<span class="stat-unit">g</span></div>
            <div class="stat-target">/ 25g</div>
        </div>
        <div class="stat-card fade-in">
            <div class="stat-title">Target Diff</div>
            <div class="stat-value ${targetDifference >= 0 ? 'text-success' : 'text-warning'}">
                ${targetDifference >= 0 ? '+' : ''}${targetDifference}<span class="stat-unit">%</span>
            </div>
        </div>
    `;
}

// Display meal table with tracker-style emojis
function displayMealTable(weeklyPlan) {
    const container = document.getElementById('mealPlanTable');
    const days = Object.keys(weeklyPlan);
    const mealTypes = [
        { key: 'breakfast', name: '🌅 Breakfast' },
        { key: 'lunch', name: '🍽️ Lunch' },
        { key: 'dinner', name: '🌙 Dinner' },
        { key: 'snacks', name: '🍎 Snack' }
    ];

    let html = '<table class="table">';
    html += '<thead><tr>';
    html += '<th>Day</th>';
    mealTypes.forEach(meal => {
        html += `<th>${meal.name}</th>`;
    });
    html += '<th>Daily Total</th>';
    html += '</tr></thead><tbody>';

    days.forEach(day => {
        html += '<tr>';
        html += `<td class="day-header">${day}</td>`;
        
        let totalCalories = 0;
        mealTypes.forEach(mealType => {
            const meal = weeklyPlan[day][mealType.key];
            if (meal) {
                const calories = safeNumber(meal.calories);
                totalCalories += calories;
                html += `<td>
                    <div class="meal-item">${meal.title}</div>
                    <div class="meal-serving text-primary">${calories} kcal</div>`;
                if (meal.serving_size) {
                    html += `<div class="meal-serving">${meal.serving_size}</div>`;
                }
                if (meal.protein !== undefined) {
                    html += `<div class="meal-nutrients">
                        P: ${safeNumber(meal.protein)}g • C: ${safeNumber(meal.carbs)}g • F: ${safeNumber(meal.fat)}g
                    </div>`;
                }
                html += '</td>';
            } else {
                html += '<td><div class="text-muted">No meal</div></td>';
            }
        });
        
        html += `<td><strong class="text-success">${Math.round(totalCalories)} kcal</strong></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Calculate weekly statistics
function calculateWeeklyStats(weeklyPlan) {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let mealCount = 0;

    Object.keys(weeklyPlan).forEach(day => {
        Object.keys(weeklyPlan[day]).forEach(mealType => {
            const meal = weeklyPlan[day][mealType];
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

// Lazy load Chart.js
async function loadChartJS() {
    if (ChartsLoaded || window.Chart) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        script.onload = () => {
            ChartsLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Create charts with tracker-style colors
async function createCharts(weeklyPlan, profile) {
    try {
        await loadChartJS();
        
        // Prepare data
        const days = Object.keys(weeklyPlan);
        const dailyCalories = days.map(day => {
            let dayTotal = 0;
            Object.keys(weeklyPlan[day]).forEach(mealType => {
                const meal = weeklyPlan[day][mealType];
                if (meal) dayTotal += safeNumber(meal.calories);
            });
            return dayTotal;
        });

        const weeklyStats = calculateWeeklyStats(weeklyPlan);

        // Get theme colors
        const isDark = currentTheme === 'dark';
        const textColor = isDark ? '#ffffff' : '#212529';
        const gridColor = isDark ? '#404040' : '#dee2e6';

        // Daily Calorie Chart
        const calorieCtx = document.getElementById('calorieChart');
        if (calorieCtx) {
            new Chart(calorieCtx, {
                type: 'bar',
                data: {
                    labels: days.map(day => day.substr(0, 3)),
                    datasets: [{
                        label: 'Daily Calories',
                        data: dailyCalories,
                        backgroundColor: 'rgba(0, 123, 255, 0.8)',
                        borderColor: 'rgba(0, 123, 255, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                    }, {
                        label: 'Target',
                        data: Array(7).fill(profile.targetCalories),
                        type: 'line',
                        borderColor: 'rgba(40, 167, 69, 1)',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        pointBackgroundColor: 'rgba(40, 167, 69, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
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
                                padding: 20,
                                color: textColor
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: gridColor
                            },
                            ticks: {
                                color: textColor
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Calories',
                                color: textColor
                            },
                            grid: {
                                color: gridColor
                            },
                            ticks: {
                                color: textColor
                            }
                        }
                    }
                }
            });
        }

        // Weekly Macros Chart
        const macrosCtx = document.getElementById('macrosChart');
        if (macrosCtx) {
            const proteinCals = weeklyStats.totalProtein * 4;
            const carbsCals = weeklyStats.totalCarbs * 4;
            const fatCals = weeklyStats.totalFat * 9;

            new Chart(macrosCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Protein', 'Carbohydrates', 'Fat'],
                    datasets: [{
                        data: [proteinCals, carbsCals, fatCals],
                        backgroundColor: [
                            'rgba(0, 123, 255, 0.8)',
                            'rgba(40, 167, 69, 0.8)',
                            'rgba(255, 193, 7, 0.8)'
                        ],
                        borderColor: [
                            'rgba(0, 123, 255, 1)',
                            'rgba(40, 167, 69, 1)',
                            'rgba(255, 193, 7, 1)'
                        ],
                        borderWidth: 2,
                        hoverOffset: 4
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
                                padding: 20,
                                color: textColor
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

    } catch (error) {
        console.error('Failed to create charts:', error);
    }
}

// Export Functions
function downloadCSV() {
    if (!currentMealPlan) {
        alert('No meal plan available to export');
        return;
    }

    let csvContent = '\uFEFF';
    csvContent += 'Date,Meal Time,Food Name,Serving Size,Calories,Protein,Carbs,Fat,Fiber\n';

    const days = Object.keys(currentMealPlan);
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];

    days.forEach(day => {
        mealTypes.forEach(mealType => {
            const meal = currentMealPlan[day][mealType];
            if (meal) {
                const row = [
                    day,
                    mealType.charAt(0).toUpperCase() + mealType.slice(1),
                    `"${meal.title.replace(/"/g, '""')}"`,
                    `"${meal.serving_size || 'N/A'}"`,
                    safeNumber(meal.calories),
                    safeNumber(meal.protein),
                    safeNumber(meal.carbs),
                    safeNumber(meal.fat),
                    safeNumber(meal.fiber)
                ].join(',');
                csvContent += row + '\n';
            }
        });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `meal-plan-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Lazy load html2pdf
async function loadHtml2Pdf() {
    if (Html2PdfLoaded || window.html2pdf) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => {
            Html2PdfLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function downloadPDF() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to export');
        return;
    }

    try {
        await loadHtml2Pdf();
        
        const pdfContent = createPDFContent();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pdfContent;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '800px';
        document.body.appendChild(tempDiv);

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `meal-plan-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        const pdf = await html2pdf().from(tempDiv).set(opt).output('blob');
        document.body.removeChild(tempDiv);

        try {
            const url = URL.createObjectURL(pdf);
            const link = document.createElement('a');
            link.href = url;
            link.download = opt.filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (downloadError) {
            const url = URL.createObjectURL(pdf);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

function createPDFContent() {
    const weeklyStats = calculateWeeklyStats(currentMealPlan);
    const days = Object.keys(currentMealPlan);
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];

    let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px;">
        <h1 style="color: #007bff; text-align: center; margin-bottom: 30px;">🍽️ Your Personalized Meal Plan</h1>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; page-break-inside: avoid;">
            <h2 style="color: #212529; margin-bottom: 15px;">Profile Summary</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <p><strong>Age:</strong> ${currentUserProfile.age} years</p>
                    <p><strong>Gender:</strong> ${currentUserProfile.gender}</p>
                    <p><strong>Height:</strong> ${currentUserProfile.height} cm</p>
                    <p><strong>Weight:</strong> ${currentUserProfile.weight} kg</p>
                </div>
                <div>
                    <p><strong>Goal:</strong> ${currentUserProfile.goal}</p>
                    <p><strong>Diet Type:</strong> ${currentUserProfile.dietType}</p>
                    <p><strong>Region:</strong> ${currentUserProfile.region}</p>
                    <p><strong>Target Calories:</strong> ${currentUserProfile.targetCalories}/day</p>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h2 style="color: #212529; margin-bottom: 15px;">Weekly Overview</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                    <h3 style="margin: 0; color: #007bff;">${Math.round(weeklyStats.avgCalories)}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Calories</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                    <h3 style="margin: 0; color: #007bff;">${Math.round(weeklyStats.avgProtein)}g</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Protein</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                    <h3 style="margin: 0; color: #007bff;">${Math.round(weeklyStats.avgCarbs)}g</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Carbs</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #e3f2fd; border-radius: 8px;">
                    <h3 style="margin: 0; color: #007bff;">${Math.round(weeklyStats.avgFat)}g</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Fat</p>
                </div>
            </div>
        </div>`;

    html += '<h2 style="color: #212529; margin-bottom: 15px;">🗓️ 7-Day Meal Plan</h2>';
    
    days.forEach((day, index) => {
        if (index % 2 === 0 && index > 0) {
            html += '<div style="page-break-before: always;"></div>';
        }
        
        html += `<div style="margin-bottom: 25px; page-break-inside: avoid;">
            <h3 style="color: #007bff; margin-bottom: 10px;">${day}</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #dee2e6;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Meal</th>
                        <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Food</th>
                        <th style="padding: 10px; border: 1px solid #dee2e6; text-align: right;">Calories</th>
                        <th style="padding: 10px; border: 1px solid #dee2e6; text-align: right;">Protein</th>
                    </tr>
                </thead>
                <tbody>`;

        let dayTotal = 0;
        const mealNames = {
            breakfast: '🌅 Breakfast',
            lunch: '🍽️ Lunch',
            dinner: '🌙 Dinner',
            snacks: '🍎 Snack'
        };
        
        mealTypes.forEach(mealType => {
            const meal = currentMealPlan[day][mealType];
            if (meal) {
                const calories = safeNumber(meal.calories);
                dayTotal += calories;
                html += `<tr>
                    <td style="padding: 8px; border: 1px solid #dee2e6; font-weight: bold;">${mealNames[mealType]}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6;">
                        ${meal.title}<br>
                        <small style="color: #6c757d;">${meal.serving_size || ''}</small>
                    </td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${calories}</td>
                    <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${safeNumber(meal.protein)}g</td>
                </tr>`;
            }
        });

        html += `<tr style="background: #f8f9fa; font-weight: bold;">
                <td colspan="2" style="padding: 8px; border: 1px solid #dee2e6;">Daily Total</td>
                <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">${Math.round(dayTotal)}</td>
                <td style="padding: 8px; border: 1px solid #dee2e6; text-align: right;">-</td>
            </tr>
            </tbody></table>
        </div>`;
    });

    html += `
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; page-break-inside: avoid;">
            <h3 style="color: #212529; margin-bottom: 15px;">📝 Important Notes</h3>
            <ul style="line-height: 1.6;">
                <li>This meal plan is generated based on your profile and goals</li>
                <li>Adjust portion sizes according to your hunger levels and energy needs</li>
                <li>Stay hydrated by drinking plenty of water throughout the day</li>
                <li>Consult with a healthcare provider before making significant dietary changes</li>
                <li>Generated on: ${new Date().toLocaleDateString()}</li>
            </ul>
        </div>
    </div>`;

    return html;
}

// Integration Functions
function sendPlanToLocalStorage() {
    if (!currentMealPlan || !currentUserProfile) {
        return false;
    }

    const integrationData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        userProfile: currentUserProfile,
        mealPlan: currentMealPlan,
        source: 'diet-planner'
    };

    try {
        localStorage.setItem('planned_meals_v1', JSON.stringify(integrationData));
        return true;
    } catch (error) {
        console.error('Failed to save plan to localStorage:', error);
        return false;
    }
}

function sendPlanViaPostMessage() {
    if (!currentMealPlan || !currentUserProfile) {
        return false;
    }

    const message = {
        type: 'DIET_PLANNER_PLAN',
        payload: {
            version: '1.0',
            timestamp: new Date().toISOString(),
            userProfile: currentUserProfile,
            mealPlan: currentMealPlan
        }
    };

    if (window.parent !== window) {
        window.parent.postMessage(message, '*');
    }
    
    Array.from(document.querySelectorAll('iframe')).forEach(iframe => {
        try {
            iframe.contentWindow.postMessage(message, '*');
        } catch (e) {
            console.log('Could not send to iframe:', e);
        }
    });

    return true;
}

function sendPlanToTracker() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('❌ No meal plan available to send to tracker.\nPlease generate a meal plan first.');
        return;
    }

    const localStorageSuccess = sendPlanToLocalStorage();
    const postMessageSuccess = sendPlanViaPostMessage();

    if (localStorageSuccess || postMessageSuccess) {
        alert('✅ Meal plan sent to Diet Tracker successfully!\n\n🔄 The tracker will automatically import your plan when you open it.');
    } else {
        alert('❌ Failed to send meal plan to tracker. Please try again.');
    }
}

function goToTracker() {
    // Open your actual diet tracker URL
    const trackerURL = 'https://mhhakda.github.io/diet-tracker/';
    window.open(trackerURL, '_blank');
}

// Load existing plan on page load
function loadExistingPlan() {
    try {
        const stored = localStorage.getItem('last_generated_plan_v1');
        if (stored) {
            const data = JSON.parse(stored);
            const generated = new Date(data.generated);
            const now = new Date();
            const daysDiff = (now - generated) / (1000 * 60 * 60 * 24);
            
            if (daysDiff <= 7 && data.plan && data.profile) {
                currentMealPlan = data.plan;
                currentUserProfile = data.profile;
                
                // Auto-populate form with previous data
                if (currentUserProfile) {
                    Object.keys(currentUserProfile).forEach(key => {
                        const field = document.getElementById(key);
                        if (field && currentUserProfile[key]) {
                            field.value = currentUserProfile[key];
                        }
                    });
                }
                
                // Show the plan if it exists
                if (currentMealPlan) {
                    displayMealPlan(currentMealPlan, currentUserProfile);
                    createCharts(currentMealPlan, currentUserProfile);
                    document.getElementById('planContent').classList.remove('d-none');
                    document.getElementById('planPlaceholder').classList.add('d-none');
                    document.getElementById('analyticsContent').classList.remove('d-none');
                    document.getElementById('analyticsPlaceholder').classList.add('d-none');
                }
                
                console.log('✅ Loaded existing meal plan from localStorage');
            }
        }
    } catch (error) {
        console.error('Failed to load existing plan:', error);
    }
}