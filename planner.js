// Enhanced Diet Planner JavaScript
// Comprehensive meal planning with exports, charts, and integrations

// Global variables
let currentMealPlan = null;
let currentUserProfile = null;
let mealDatabase = null;
let ChartsLoaded = false;
let Html2PdfLoaded = false;

// Safe number parsing helper
function safeNumber(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
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
        // Fallback to basic data
        mealDatabase = createFallbackMeals();
        return mealDatabase;
    }
}

// Create fallback meals if loading fails
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
            },
            "Vegetarian": {
                "breakfast": [{"id": 101, "title": "Veggie Scramble", "serving_size": "2 eggs + veggies", "calories": 350, "protein": 18, "carbs": 16, "fat": 22, "fiber": 4}],
                "lunch": [{"id": 111, "title": "Quinoa Salad", "serving_size": "1.5 cups", "calories": 420, "protein": 16, "carbs": 68, "fat": 10, "fiber": 9}],
                "dinner": [{"id": 121, "title": "Eggplant Parmesan", "serving_size": "1 serving", "calories": 520, "protein": 22, "carbs": 48, "fat": 26, "fiber": 8}],
                "snacks": [{"id": 131, "title": "Hummus with Veggies", "serving_size": "1/4 cup + veggies", "calories": 120, "protein": 4, "carbs": 16, "fat": 6, "fiber": 4}]
            }
        }
    };
}

// Form validation
function validateForm() {
    const fields = ['age', 'gender', 'height', 'weight', 'goal', 'dietType', 'region', 'activityLevel'];
    let isValid = true;

    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const errorDiv = document.getElementById(fieldId + '-error');
        const group = field.closest('.form-group');
        
        // Clear previous errors
        group.classList.remove('error');
        errorDiv.textContent = '';

        // Validate required fields
        if (!field.value.trim()) {
            group.classList.add('error');
            errorDiv.textContent = 'This field is required';
            isValid = false;
            return;
        }

        // Specific validations
        if (fieldId === 'age') {
            const age = safeNumber(field.value);
            if (age < 13 || age > 120) {
                group.classList.add('error');
                errorDiv.textContent = 'Age must be between 13 and 120';
                isValid = false;
            }
        }

        if (fieldId === 'height') {
            const height = safeNumber(field.value);
            if (height < 100 || height > 250) {
                group.classList.add('error');
                errorDiv.textContent = 'Height must be between 100-250 cm';
                isValid = false;
            }
        }

        if (fieldId === 'weight') {
            const weight = safeNumber(field.value);
            if (weight < 30 || weight > 300) {
                group.classList.add('error');
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
            const group = targetCalories.closest('.form-group');
            const errorDiv = document.getElementById('targetCalories-error');
            group.classList.add('error');
            errorDiv.textContent = 'Target calories must be between 800-5000';
            isValid = false;
        }
    }

    return isValid;
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

        return weeklyPlan;
    } catch (error) {
        console.error('Error generating meal plan:', error);
        alert('Error generating meal plan: ' + error.message);
        throw error;
    }
}

// Display meal plan table
function displayMealPlan(weeklyPlan, profile) {
    const container = document.getElementById('mealPlanTable');
    const days = Object.keys(weeklyPlan);
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];

    let html = '<table class="meal-plan-table">';
    html += '<thead><tr>';
    html += '<th>Day</th>';
    mealTypes.forEach(type => {
        html += `<th>${type.charAt(0).toUpperCase() + type.slice(1)}</th>`;
    });
    html += '<th>Total Calories</th>';
    html += '</tr></thead><tbody>';

    days.forEach(day => {
        html += '<tr>';
        html += `<td><strong>${day}</strong></td>`;
        
        let totalCalories = 0;
        mealTypes.forEach(mealType => {
            const meal = weeklyPlan[day][mealType];
            if (meal) {
                const calories = safeNumber(meal.calories);
                totalCalories += calories;
                html += `<td>
                    <div class="meal-item">${meal.title}</div>
                    <div class="calorie-info">${calories} cal</div>`;
                if (meal.serving_size) {
                    html += `<div style="font-size: 0.8em; color: #888;">${meal.serving_size}</div>`;
                }
                if (meal.protein !== undefined) {
                    html += `<div style="font-size: 0.75em; color: #666;">
                        P: ${safeNumber(meal.protein)}g | C: ${safeNumber(meal.carbs)}g | F: ${safeNumber(meal.fat)}g
                    </div>`;
                }
                html += '</td>';
            } else {
                html += '<td>No meal</td>';
            }
        });
        
        html += `<td><strong>${Math.round(totalCalories)} cal</strong></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    // Add summary
    const weeklyStats = calculateWeeklyStats(weeklyPlan);
    html += `<div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <h4 style="color: #2d5a27; margin-bottom: 10px;">Weekly Summary</h4>
        <p><strong>Average Daily Calories:</strong> ${Math.round(weeklyStats.avgCalories)}</p>
        <p><strong>Total Weekly Calories:</strong> ${Math.round(weeklyStats.totalCalories)}</p>
        <p><strong>Target vs Actual:</strong> ${Math.round(((weeklyStats.avgCalories - profile.targetCalories) / profile.targetCalories) * 100)}% difference</p>
    </div>`;

    container.innerHTML = html;
}

// Calculate weekly statistics
function calculateWeeklyStats(weeklyPlan) {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let mealCount = 0;

    Object.keys(weeklyPlan).forEach(day => {
        Object.keys(weeklyPlan[day]).forEach(mealType => {
            const meal = weeklyPlan[day][mealType];
            if (meal) {
                totalCalories += safeNumber(meal.calories);
                totalProtein += safeNumber(meal.protein);
                totalCarbs += safeNumber(meal.carbs);
                totalFat += safeNumber(meal.fat);
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

// Create charts
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

        // Daily Calorie Chart
        const calorieCtx = document.getElementById('calorieChart');
        if (calorieCtx) {
            new Chart(calorieCtx, {
                type: 'bar',
                data: {
                    labels: days.map(day => day.substr(0, 3)), // Short day names
                    datasets: [{
                        label: 'Daily Calories',
                        data: dailyCalories,
                        backgroundColor: 'rgba(76, 175, 80, 0.6)',
                        borderColor: 'rgba(76, 175, 80, 1)',
                        borderWidth: 1
                    }, {
                        label: 'Target',
                        data: Array(7).fill(profile.targetCalories),
                        type: 'line',
                        borderColor: 'rgba(255, 152, 0, 1)',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        borderWidth: 2,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
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

        // Weekly Macros Chart
        const macrosCtx = document.getElementById('macrosChart');
        if (macrosCtx) {
            // Convert grams to calories for proper pie chart
            const proteinCals = weeklyStats.totalProtein * 4;
            const carbsCals = weeklyStats.totalCarbs * 4;
            const fatCals = weeklyStats.totalFat * 9;

            new Chart(macrosCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Protein', 'Carbohydrates', 'Fats'],
                    datasets: [{
                        data: [proteinCals, carbsCals, fatCals],
                        backgroundColor: [
                            'rgba(76, 175, 80, 0.8)',
                            'rgba(255, 193, 7, 0.8)',
                            'rgba(255, 87, 34, 0.8)'
                        ],
                        borderColor: [
                            'rgba(76, 175, 80, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(255, 87, 34, 1)'
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
                    }
                }
            });
        }

    } catch (error) {
        console.error('Failed to create charts:', error);
    }
}

// Export to CSV
function downloadCSV() {
    if (!currentMealPlan) {
        alert('No meal plan available to export');
        return;
    }

    // UTF-8 BOM for Excel compatibility
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
                    `"${meal.title.replace(/"/g, '""')}"`, // Escape quotes
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

    // Create and download file
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

// Export to PDF
async function downloadPDF() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to export');
        return;
    }

    try {
        await loadHtml2Pdf();

        // Create temporary PDF content
        const pdfContent = createPDFContent();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pdfContent;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '800px';
        document.body.appendChild(tempDiv);

        // Configure PDF options
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `meal-plan-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Generate PDF
        const pdf = await html2pdf().from(tempDiv).set(opt).output('blob');
        
        // Clean up
        document.body.removeChild(tempDiv);

        // Try direct download first
        try {
            const url = URL.createObjectURL(pdf);
            const link = document.createElement('a');
            link.href = url;
            link.download = opt.filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (downloadError) {
            // Fallback: open in new tab
            const url = URL.createObjectURL(pdf);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Please try again.');
    }
}

// Create PDF content
function createPDFContent() {
    const weeklyStats = calculateWeeklyStats(currentMealPlan);
    const days = Object.keys(currentMealPlan);
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];

    let html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
        <h1 style="color: #2d5a27; text-align: center; margin-bottom: 30px;">Your Personalized Meal Plan</h1>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; page-break-inside: avoid;">
            <h2 style="color: #2d5a27; margin-bottom: 15px;">Profile Summary</h2>
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
            <h2 style="color: #2d5a27; margin-bottom: 15px;">Weekly Overview</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <h3 style="margin: 0; color: #2d5a27;">${Math.round(weeklyStats.avgCalories)}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Calories</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <h3 style="margin: 0; color: #2d5a27;">${Math.round(weeklyStats.avgProtein)}g</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Protein</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <h3 style="margin: 0; color: #2d5a27;">${Math.round(weeklyStats.avgCarbs)}g</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Carbs</p>
                </div>
                <div style="text-align: center; padding: 15px; background: #e8f5e8; border-radius: 8px;">
                    <h3 style="margin: 0; color: #2d5a27;">${Math.round(weeklyStats.avgFat)}g</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em;">Avg Daily Fat</p>
                </div>
            </div>
        </div>`;

    // Add detailed meal plan
    html += '<h2 style="color: #2d5a27; margin-bottom: 15px;">7-Day Meal Plan</h2>';
    
    days.forEach((day, index) => {
        if (index % 2 === 0 && index > 0) {
            html += '<div style="page-break-before: always;"></div>';
        }
        
        html += `<div style="margin-bottom: 25px; page-break-inside: avoid;">
            <h3 style="color: #2d5a27; margin-bottom: 10px;">${day}</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Meal</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Food</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Calories</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Protein</th>
                    </tr>
                </thead>
                <tbody>`;

        let dayTotal = 0;
        mealTypes.forEach(mealType => {
            const meal = currentMealPlan[day][mealType];
            if (meal) {
                const calories = safeNumber(meal.calories);
                dayTotal += calories;
                html += `<tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-transform: capitalize;">${mealType}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">
                        ${meal.title}<br>
                        <small style="color: #666;">${meal.serving_size || ''}</small>
                    </td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${calories}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${safeNumber(meal.protein)}g</td>
                </tr>`;
            }
        });

        html += `<tr style="background: #f8f9fa; font-weight: bold;">
                <td colspan="2" style="padding: 8px; border: 1px solid #ddd;">Daily Total</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${Math.round(dayTotal)}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">-</td>
            </tr>
            </tbody></table>
        </div>`;
    });

    html += `
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; page-break-inside: avoid;">
            <h3 style="color: #2d5a27; margin-bottom: 15px;">Important Notes</h3>
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

// Diet Tracker Integration - localStorage method
function sendPlanToLocalStorage() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to send');
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

// Diet Tracker Integration - postMessage method
function sendPlanViaPostMessage() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to send');
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

    // Send to all frames/windows
    if (window.parent !== window) {
        window.parent.postMessage(message, '*');
    }
    
    // Send to any child frames
    Array.from(document.querySelectorAll('iframe')).forEach(iframe => {
        try {
            iframe.contentWindow.postMessage(message, '*');
        } catch (e) {
            console.log('Could not send to iframe:', e);
        }
    });

    return true;
}

// Combined integration function
function sendPlanToTracker() {
    if (!currentMealPlan || !currentUserProfile) {
        alert('No meal plan available to send to tracker');
        return;
    }

    const localStorageSuccess = sendPlanToLocalStorage();
    const postMessageSuccess = sendPlanViaPostMessage();

    if (localStorageSuccess || postMessageSuccess) {
        alert('✅ Meal plan sent to Diet Tracker successfully!\n\nThe tracker will automatically import your plan.');
    } else {
        alert('❌ Failed to send meal plan to tracker. Please try again.');
    }
}

// Go to Diet Tracker function (placeholder - update with actual URL)
function goToTracker() {
    // Update this URL to your actual diet tracker URL
    const trackerURL = './diet-tracker.html';
    window.open(trackerURL, '_blank');
}

// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
    // Load existing plan if available
    loadExistingPlan();

    const form = document.getElementById('dietForm');
    const generateBtn = document.getElementById('generateBtn');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        // Show loading
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generating...';
        document.getElementById('loading').style.display = 'block';
        document.getElementById('formSection').classList.add('hidden');

        try {
            await generateMealPlan();
            
            // Show results
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('resultsSection').style.display = 'block';
            }, 1500);

        } catch (error) {
            // Show form again on error
            document.getElementById('loading').style.display = 'none';
            document.getElementById('formSection').classList.remove('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate My Meal Plan';
        }
    });
});

// Load existing plan on page load
function loadExistingPlan() {
    try {
        const stored = localStorage.getItem('last_generated_plan_v1');
        if (stored) {
            const data = JSON.parse(stored);
            const generated = new Date(data.generated);
            const now = new Date();
            const daysDiff = (now - generated) / (1000 * 60 * 60 * 24);
            
            // Only auto-load if generated within last 7 days
            if (daysDiff <= 7 && data.plan && data.profile) {
                currentMealPlan = data.plan;
                currentUserProfile = data.profile;
                console.log('Loaded existing meal plan from localStorage');
            }
        }
    } catch (error) {
        console.error('Failed to load existing plan:', error);
    }
}

// Go back to form
function goBackToForm() {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('formSection').classList.remove('hidden');
    document.getElementById('generateBtn').disabled = false;
    document.getElementById('generateBtn').textContent = 'Generate My Meal Plan';
}

// Load the meals database when page loads
loadMealsDatabase().then(() => {
    console.log('Meals database loaded successfully');
}).catch(error => {
    console.error('Failed to load meals database:', error);
});

// Diet Tracker receiver code (to be included in tracker app)
const DIET_TRACKER_RECEIVER = `
// Diet Tracker Integration Receiver Code
// Include this in your Diet Tracker application

// Listen for meal plans from Diet Planner
window.addEventListener('message', function(event) {
    // Validate origin for security (update with your actual domains)
    const allowedOrigins = ['https://yourdomain.com', 'http://localhost:3000', 'http://127.0.0.1:3000'];
    if (!allowedOrigins.includes(event.origin)) {
        return;
    }

    if (event.data.type === 'DIET_PLANNER_PLAN') {
        const planData = event.data.payload;
        
        // Validate data
        if (planData.version && planData.mealPlan && planData.userProfile) {
            // Import the meal plan into your tracker
            importMealPlan(planData);
            
            // Show success message
            console.log('Meal plan imported from Diet Planner');
            showNotification('✅ Meal plan imported successfully from Diet Planner!');
        }
    }
});

// Check localStorage for meal plans on load
function checkForPlannedMeals() {
    try {
        const stored = localStorage.getItem('planned_meals_v1');
        if (stored) {
            const data = JSON.parse(stored);
            const timestamp = new Date(data.timestamp);
            const now = new Date();
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            
            // Import if data is fresh (within 24 hours)
            if (hoursDiff <= 24 && data.mealPlan && data.userProfile) {
                importMealPlan(data);
                showNotification('✅ Found meal plan from Diet Planner!');
                
                // Clear the data after import
                localStorage.removeItem('planned_meals_v1');
            }
        }
    } catch (error) {
        console.error('Failed to check for planned meals:', error);
    }
}

// Your implementation of importMealPlan function
function importMealPlan(planData) {
    // Implement this based on your tracker's data structure
    console.log('Importing meal plan:', planData);
    // Example:
    // - Convert planData.mealPlan to your format
    // - Update your calendar/tracker with the meals
    // - Set user preferences based on planData.userProfile
}

// Your implementation of showNotification function
function showNotification(message) {
    // Implement this based on your UI framework
    console.log('Notification:', message);
    // Example: show toast, alert, or in-app notification
}

// Call this when your tracker app loads
document.addEventListener('DOMContentLoaded', checkForPlannedMeals);
`;

console.log('Diet Planner Enhanced JavaScript loaded successfully');