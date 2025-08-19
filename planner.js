// Diet Planner Enhanced JavaScript
const CONFIG = {
    TRACKER_URL: 'diet-tracker.html',
    STORAGE_KEYS: {
        PLANNED_MEALS: 'planned_meals_v1',
        LAST_PLAN: 'last_generated_plan_v1'
    }
};

let mealsDatabase = null;
let generatedMealPlan = null;

// Safe number parsing
function safeNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}

// Load meals database
async function loadMealsDatabase() {
    try {
        const response = await fetch('meals.json');
        mealsDatabase = await response.json();
        console.log('Meals database loaded');
    } catch (error) {
        console.error('Error loading meals:', error);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    await loadMealsDatabase();

    // Form submission
    const form = document.getElementById('user-questionnaire');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        generateMealPlan();
    });

    // Button handlers
    document.getElementById('send-to-tracker-btn').addEventListener('click', sendToTracker);
    document.getElementById('download-csv-btn').addEventListener('click', downloadCSV);
    document.getElementById('download-pdf-btn').addEventListener('click', downloadPDF);
});

// Generate meal plan
function generateMealPlan() {
    const profile = {
        age: safeNumber(document.getElementById('age').value),
        gender: document.getElementById('gender').value,
        height: safeNumber(document.getElementById('height').value),
        weight: safeNumber(document.getElementById('weight').value),
        goal: document.getElementById('goal').value
    };

    // Generate weekly plan
    const plan = generateWeeklyPlan(profile);
    generatedMealPlan = { profile, plan };

    // Show meal plan section
    document.getElementById('meal-plan-section').classList.remove('hidden');
    displayMealPlan(plan);
}

// Generate weekly plan
function generateWeeklyPlan(profile) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    const plan = {};

    days.forEach(day => {
        plan[day] = {};
        mealTypes.forEach(mealType => {
            // Select random meal from database
            if (mealsDatabase && mealsDatabase.USA && mealsDatabase.USA.Regular) {
                const meals = mealsDatabase.USA.Regular[mealType] || [];
                if (meals.length > 0) {
                    const randomMeal = meals[Math.floor(Math.random() * meals.length)];
                    plan[day][mealType] = randomMeal;
                }
            }
        });
    });

    return plan;
}

// Display meal plan
function displayMealPlan(plan) {
    const grid = document.getElementById('meal-plan-grid');
    grid.innerHTML = '';

    Object.entries(plan).forEach(([day, meals]) => {
        const dayDiv = document.createElement('div');
        dayDiv.innerHTML = `<h3>${day}</h3>`;

        Object.entries(meals).forEach(([mealType, meal]) => {
            const mealDiv = document.createElement('div');
            mealDiv.className = 'meal-card';
            mealDiv.innerHTML = `
                <strong>${mealType}</strong><br>
                ${meal.title}<br>
                <small>${meal.calories} cal, ${meal.protein}g protein</small>
            `;
            dayDiv.appendChild(mealDiv);
        });

        grid.appendChild(dayDiv);
    });
}

// Send to tracker
function sendToTracker() {
    if (!generatedMealPlan) return;

    const trackerData = {
        metadata: { generatedAt: new Date().toISOString() },
        entries: []
    };

    Object.entries(generatedMealPlan.plan).forEach(([day, meals]) => {
        Object.entries(meals).forEach(([mealType, meal]) => {
            trackerData.entries.push({
                date: new Date().toISOString().split('T')[0],
                mealType: mealType,
                foodName: meal.title,
                calories: meal.calories,
                protein: meal.protein
            });
        });
    });

    // localStorage integration
    localStorage.setItem(CONFIG.STORAGE_KEYS.PLANNED_MEALS, JSON.stringify(trackerData));

    // postMessage integration
    window.postMessage({
        type: 'DIET_PLANNER_PLAN',
        payload: trackerData
    }, '*');

    alert('Plan sent to tracker!');
}

// Download CSV
function downloadCSV() {
    if (!generatedMealPlan) return;

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'Day,Meal Type,Meal Name,Calories,Protein\n';

    Object.entries(generatedMealPlan.plan).forEach(([day, meals]) => {
        Object.entries(meals).forEach(([mealType, meal]) => {
            csv += `${day},${mealType},"${meal.title}",${meal.calories},${meal.protein}\n`;
        });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meal-plan.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// Download PDF (simplified)
function downloadPDF() {
    alert('PDF download would require html2pdf library - see full implementation');
}