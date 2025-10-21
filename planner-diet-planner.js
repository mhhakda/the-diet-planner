
/**
 * planner-diet-planner-fixed.js
 * Fixed and improved planner script:
 * - Robust initializeForm (removes stub handlers, idempotent)
 * - handleFormSubmit with simple local generation (placeholder for AI integration)
 * - displayMealPlan and populateResultsOverview
 * - CSV export and PDF export (print-based fallback, works without external libs)
 * - initializePdfExport wiring and send-to-tracker helper
 *
 * Drop this file in your site and ensure index.html references it:
 * <script src="planner-diet-planner-fixed.js"></script>
 *
 * Note: This script avoids external dependencies so PDF uses print() flow which
 * works in modern browsers (Save as PDF). If you want true programmatic PDF bytes,
 * add html2pdf/jsPDF libraries and replace exportToPDF with those calls.
 */

;(function () {
  'use strict';

  // --- Globals ---
  window.currentMealPlan = window.currentMealPlan || null;
  window.currentUserProfile = window.currentUserProfile || null;
  const debug = true;

  function log(...args) { if (debug) console.log('[planner]', ...args); }

  // --- Utility helpers ---
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function capitalize(s) {
    if (!s) return s;
    s = String(s);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function qs(id) { return document.getElementById(id); }

  // --- Initialization & Form handling ---
  function initializeForm() {
    const generateBtn = qs('generateBtn');
    if (!generateBtn) return log('initializeForm: generateBtn not found');

    // Remove any stub handlers left by old stubs (non-destructive)
    try {
      if (generateBtn._stubCallback && typeof generateBtn._stubCallback === 'function') {
        try { generateBtn.removeEventListener('click', generateBtn._stubCallback); } catch (e) {}
        try { delete generateBtn._stubCallback; } catch (e) {}
      }
      if (generateBtn._stubbound) {
        try { generateBtn._stubbound = false; } catch (e) {}
      }
      if (generateBtn._stubPresent) {
        try { delete generateBtn._stubPresent; } catch (e) {}
      }
    } catch (e) {
      log('initializeForm: cleanup stub handlers failed', e);
    }

    // Remove previously-bound real handler to avoid double-binding
    try {
      if (generateBtn._realCallback && typeof generateBtn._realCallback === 'function') {
        try { generateBtn.removeEventListener('click', generateBtn._realCallback); } catch (e) {}
      }
    } catch (e) { /* ignore */ }

    // Real handler
    generateBtn._realCallback = async function (e) {
      e.preventDefault();
      try {
        await handleFormSubmit();
      } catch (err) {
        console.error('handleFormSubmit error', err);
        alert('Failed to create meal plan: ' + (err && err.message ? err.message : String(err)));
      }
    };
    generateBtn.addEventListener('click', generateBtn._realCallback);
    generateBtn._realBound = true;
    log('initializeForm: bound generate button');

    // Edit profile button
    const editBtn = qs('editProfileBtn');
    if (editBtn) {
      try {
        if (editBtn._realCallback && typeof editBtn._realCallback === 'function') {
          try { editBtn.removeEventListener('click', editBtn._realCallback); } catch (e) {}
        }
      } catch (e) {}
      editBtn._realCallback = function (e) {
        e.preventDefault();
        // show form section again
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('hidden'));
        const resultsContainer = qs('resultsContainer');
        if (resultsContainer) resultsContainer.classList.remove('visible');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
      editBtn.addEventListener('click', editBtn._realCallback);
    }

    log('initializeForm complete');
  }

  // Validate profile form and return profile object or throw Error
  function readAndValidateProfile() {
    const age = Number(qs('age')?.value || 0);
    const gender = qs('gender')?.value || '';
    const height = Number(qs('height')?.value || 0);
    const weight = Number(qs('weight')?.value || 0);
    const goal = qs('goal')?.value || '';
    const dietType = qs('dietType')?.value || '';
    const region = qs('region')?.value || '';
    const activityLevel = qs('activityLevel')?.value || '';
    const targetCaloriesRaw = qs('targetCalories')?.value || '';
    const targetCalories = targetCaloriesRaw ? Number(targetCaloriesRaw) : null;

    // minimal validation
    const errors = [];
    if (!age || age < 13 || age > 120) errors.push('Please enter a valid age (13-120).');
    if (!gender) errors.push('Please select your gender.');
    if (!height || height < 100 || height > 250) errors.push('Please enter a valid height in cm.');
    if (!weight || weight < 30 || weight > 300) errors.push('Please enter a valid weight in kg.');
    if (!goal) errors.push('Please select a health goal.');
    if (!activityLevel) errors.push('Please select an activity level.');

    if (errors.length) {
      throw new Error(errors.join(' '));
    }

    return {
      age, gender, height, weight, goal, dietType, region, activityLevel, targetCalories
    };
  }

  // Placeholder plan generator (replace with AI call integration)
  function generateSamplePlan(profile) {
    // Simple template: create 7-day plan with breakfast/lunch/dinner and macro estimates
    const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    const baseCal = profile.targetCalories || Math.round(10 * profile.weight + 6.25 * profile.height - 5 * profile.age + (profile.gender === 'male' ? 5 : -161));
    const dailyCal = Math.max(1200, baseCal);
    const protein = Math.round((profile.goal === 'muscle' ? 0.28 : 0.22) * dailyCal / 4);
    const carbs = Math.round((profile.goal === 'loss' ? 0.45 : 0.50) * dailyCal / 4);
    const fats = Math.round((dailyCal - (protein*4 + carbs*4)) / 9);

    const plan = {};
    days.forEach((d, i) => {
      plan[d] = {
        Breakfast: [
          { title: 'Oats with milk and banana', serving_size: '1 bowl', calories: Math.round(dailyCal * 0.25) }
        ],
        Lunch: [
          { title: 'Grilled chicken / paneer with rice', serving_size: '1 plate', calories: Math.round(dailyCal * 0.35) }
        ],
        Dinner: [
          { title: 'Mixed salad + roti', serving_size: '1 plate', calories: Math.round(dailyCal * 0.30) }
        ],
        Snacks: [
          { title: 'Fruit or nuts', serving_size: '1 small', calories: Math.round(dailyCal * 0.10) }
        ],
        meta: { calories: dailyCal, protein, carbs, fats }
      };
      // slight variation
      if (i % 2 === 0) plan[d].Lunch[0].title = (profile.dietType === 'Vegetarian') ? 'Paneer curry with rice' : 'Grilled fish with rice';
    });
    return plan;
  }

  async function handleFormSubmit() {
    // show loader
    const loading = qs('loading');
    if (loading) loading.style.display = 'block';
    // disable button
    const genBtn = qs('generateBtn');
    if (genBtn) genBtn.disabled = true;

    try {
      const profile = readAndValidateProfile();
      window.currentUserProfile = profile;

      // If you have an AI backend, call it here. For now we generate a sample plan.
      // Example integration point: await fetch('/api/generate-mealplan', { method:'POST', body: JSON.stringify(profile) })
      const plan = generateSamplePlan(profile);

      // store and render
      window.currentMealPlan = plan;
      try { localStorage.setItem('currentMealPlan', JSON.stringify({ plan, profile })); } catch (e) {}
      displayMealPlan(plan, profile);

      // show results and hide form
      document.querySelectorAll('.form-section').forEach(s => s.classList.add('hidden'));
      const resultsContainer = qs('resultsContainer');
      if (resultsContainer) resultsContainer.classList.add('visible');
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } finally {
      if (loading) loading.style.display = 'none';
      if (genBtn) genBtn.disabled = false;
    }
  }

  // --- Rendering results ---

  function clearChildren(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function displayMealPlan(plan, profile) {
    try {
      if (!plan || typeof plan !== 'object') {
        log('displayMealPlan: no plan provided');
        return;
      }
      const container = qs('mealPlanContainer');
      if (!container) return;
      // Build structured HTML table per day
      const daysOrder = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const keys = Object.keys(plan);
      // Order keys when possible
      const ordered = [];
      daysOrder.forEach(d => { const k = keys.find(x => x.toLowerCase() === d); if (k) ordered.push(k); });
      keys.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });

      let html = '';
      ordered.forEach(dayKey => {
        const day = plan[dayKey];
        html += `<div class="day-title">${escapeHtml(capitalize(dayKey))}</div>`;
        if (!day || typeof day !== 'object') {
          html += `<div class="meal-item"> ${escapeHtml(String(day || '—'))} </div>`;
          return;
        }
        html += `<table class="meal-table" aria-label="${escapeHtml(capitalize(dayKey))} meals"><thead><tr><th>Meal</th><th>Items</th><th>Serving</th><th>Calories</th></tr></thead><tbody>`;
        Object.keys(day).forEach(mealName => {
          if (mealName === 'meta') return;
          const items = day[mealName];
          if (Array.isArray(items)) {
            items.forEach(it => {
              const title = it && (it.title || it.name || it.food) ? escapeHtml(it.title || it.name || it.food) : '—';
              const serve = it && it.serving_size ? escapeHtml(it.serving_size) : '—';
              const cal = it && (it.calories || it.cal) ? escapeHtml(String(it.calories || it.cal)) : '—';
              html += `<tr><td style="width:120px;font-weight:600">${escapeHtml(mealName)}</td><td>${title}</td><td>${serve}</td><td>${cal}</td></tr>`;
            });
          } else if (typeof items === 'object') {
            const title = items.title || items.name || '';
            html += `<tr><td style="width:120px;font-weight:600">${escapeHtml(mealName)}</td><td>${escapeHtml(title)}</td><td>${escapeHtml(items.serving_size||'—')}</td><td>${escapeHtml(String(items.calories||'—'))}</td></tr>`;
          } else {
            html += `<tr><td style="width:120px;font-weight:600">${escapeHtml(mealName)}</td><td>${escapeHtml(String(items))}</td><td>—</td><td>—</td></tr>`;
          }
        });
        // append meta row if available
        const meta = day.meta || {};
        if (meta && (meta.calories || meta.protein || meta.carbs || meta.fats)) {
          html += `<tr><td colspan="4" style="padding-top:8px;font-size:12px;color:var(--color-text-secondary)">Estimated: ${escapeHtml(String(meta.calories||''))} kcal — P:${escapeHtml(String(meta.protein||''))}g C:${escapeHtml(String(meta.carbs||''))}g F:${escapeHtml(String(meta.fats||''))}g</td></tr>`;
        }
        html += `</tbody></table>`;
      });

      container.innerHTML = html;

      // update overview stats & charts
      populateResultsOverview(plan, profile);
      createCharts(plan);

    } catch (err) {
      console.error('displayMealPlan error', err);
    }
  }

  function populateResultsOverview(plan, profile) {
    const statsGrid = qs('statsGrid');
    if (!statsGrid) return;
    clearChildren(statsGrid);

    // Compute aggregates if meta present
    const days = Object.keys(plan || {});
    let totalCal = 0, count = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0;
    days.forEach(d => {
      const meta = plan[d] && plan[d].meta ? plan[d].meta : null;
      if (meta && meta.calories) { totalCal += Number(meta.calories); count++; }
      if (meta && meta.protein) totalProtein += Number(meta.protein || 0);
      if (meta && meta.carbs) totalCarbs += Number(meta.carbs || 0);
      if (meta && meta.fats) totalFats += Number(meta.fats || 0);
    });
    const avgCal = count ? Math.round(totalCal / count) : (profile && profile.targetCalories) ? profile.targetCalories : null;
    const avgProtein = count ? Math.round(totalProtein / Math.max(1,count)) : null;
    const avgCarbs = count ? Math.round(totalCarbs / Math.max(1,count)) : null;
    const avgFats = count ? Math.round(totalFats / Math.max(1,count)) : null;

    // Build stat cards
    const cards = [];
    cards.push({ title: 'Avg Daily Calories', value: avgCal ? String(avgCal) + ' kcal' : '—' });
    cards.push({ title: 'Avg Protein', value: avgProtein ? avgProtein + ' g' : '—' });
    cards.push({ title: 'Avg Carbs', value: avgCarbs ? avgCarbs + ' g' : '—' });
    cards.push({ title: 'Avg Fats', value: avgFats ? avgFats + ' g' : '—' });

    cards.forEach(c => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.innerHTML = `<div class="stat-title">${escapeHtml(c.title)}</div><div class="stat-value">${escapeHtml(c.value)}</div>`;
      statsGrid.appendChild(card);
    });
  }

  // Basic chart creation if Chart.js present; otherwise do nothing
  function createCharts(plan) {
    try {
      if (!window.Chart) {
        log('Chart.js not present; skipping charts');
        return;
      }
      // prepare calorie data per day
      const keys = Object.keys(plan || {});
      const labels = keys.map(k => capitalize(k));
      const calories = keys.map(k => (plan[k] && plan[k].meta && plan[k].meta.calories) ? Number(plan[k].meta.calories) : 0);
      const protein = keys.map(k => (plan[k] && plan[k].meta && plan[k].meta.protein) ? Number(plan[k].meta.protein) : 0);
      const carbs = keys.map(k => (plan[k] && plan[k].meta && plan[k].meta.carbs) ? Number(plan[k].meta.carbs) : 0);
      const fats = keys.map(k => (plan[k] && plan[k].meta && plan[k].meta.fats) ? Number(plan[k].meta.fats) : 0);

      // Destroy old charts if exist
      if (qs('calorieChart').__chartInstance) {
        try { qs('calorieChart').__chartInstance.destroy(); } catch (e) {}
      }
      if (qs('macrosChart').__chartInstance) {
        try { qs('macrosChart').__chartInstance.destroy(); } catch (e) {}
      }

      const ctx1 = qs('calorieChart').getContext('2d');
      qs('calorieChart').__chartInstance = new Chart(ctx1, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Calories', data: calories, backgroundColor: 'rgba(33,128,141,0.7)' }] },
        options: { responsive: true, maintainAspectRatio: false }
      });

      const ctx2 = qs('macrosChart').getContext('2d');
      qs('macrosChart').__chartInstance = new Chart(ctx2, {
        type: 'line',
        data: { labels, datasets: [
          { label: 'Protein (g)', data: protein, fill: false },
          { label: 'Carbs (g)', data: carbs, fill: false },
          { label: 'Fats (g)', data: fats, fill: false }
        ] },
        options: { responsive: true, maintainAspectRatio: false }
      });

    } catch (err) {
      console.warn('createCharts error', err);
    }
  }

  // --- Export helpers ---

  function downloadCsv() {
    try {
      const plan = window.currentMealPlan;
      if (!plan) { alert('No meal plan to export'); return; }

      // Flatten rows: day, meal, item, serving, calories
      const rows = [['Day','Meal','Item','Serving','Calories']];
      Object.keys(plan).forEach(day => {
        const d = plan[day];
        Object.keys(d).forEach(meal => {
          if (meal === 'meta') return;
          const items = d[meal];
          if (Array.isArray(items)) {
            items.forEach(it => {
              const title = it && (it.title || it.name || it.food) ? (it.title || it.name || it.food) : '';
              const serve = it && it.serving_size ? it.serving_size : '';
              const cal = it && (it.calories || it.cal) ? (it.calories || it.cal) : '';
              rows.push([capitalize(day), meal, title, serve, cal]);
            });
          } else if (typeof items === 'object') {
            rows.push([capitalize(day), meal, items.title || items.name || '', items.serving_size||'', items.calories||'']);
          } else {
            rows.push([capitalize(day), meal, String(items||''), '', '']);
          }
        });
      });

      const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meal-plan.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { document.body.removeChild(a); URL.revokeObjectURL(url); } catch (e) {} }, 500);
    } catch (err) {
      console.error('downloadCsv error', err);
      alert('Failed to download CSV: ' + (err.message || err));
    }
  }

  function exportToPDF() {
    try {
      const plan = window.currentMealPlan;
      if (!plan) { alert('No meal plan to export'); return; }

      // Create printable HTML page in a new window; call print() so user can Save as PDF
      const printable = window.open('', '_blank');
      if (!printable) {
        alert('Popup blocked. Allow popups for this site to download PDFs.');
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(n => n.outerHTML).join('\n');

      const content = qs('mealPlanContainer') ? qs('mealPlanContainer').innerHTML : '<p>No content</p>';
      const stats = qs('statsGrid') ? qs('statsGrid').innerHTML : '';
      const header = `<div style="font-family:inherit;padding:20px;border-bottom:1px solid #eee;margin-bottom:10px"><h1 style="margin:0">Meal Plan</h1><p style="margin:0;color:#666">${new Date().toLocaleString()}</p></div>`;

      printable.document.open();
      printable.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Meal Plan</title>${styles}<style>body{font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,Arial,sans-serif;padding:20px;color:#222} .meal-table{width:100%;border-collapse:collapse} .meal-table th, .meal-table td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body>${header}<div id="printStats">${stats}</div><div id="printContent">${content}</div></body></html>`);
      printable.document.close();

      // Wait a moment then print (some browsers require load)
      setTimeout(() => {
        try {
          printable.focus();
          printable.print();
          // don't auto-close — allow user to inspect or save; optionally close after some time
          // setTimeout(() => printable.close(), 2000);
        } catch (e) {
          console.error('print error', e);
          alert('Printing failed: ' + (e && e.message ? e.message : e));
        }
      }, 500);

    } catch (err) {
      console.error('exportToPDF error', err);
      alert('Failed to export PDF: ' + (err.message || err));
    }
  }

  function sendToDietTracker() {
    try {
      const plan = window.currentMealPlan;
      const profile = window.currentUserProfile;
      if (!plan) { alert('No plan to send'); return; }

      const payload = { plan, profile, transferredAt: new Date().toISOString() };
      try { localStorage.setItem('planned_meals_v1', JSON.stringify(payload)); } catch (e) {
        console.warn('sendToDietTracker: localStorage save failed', e);
      }

      const trackerUrl = document.body.getAttribute('data-diet-tracker-url') || 'https://thedietplanner.com/diet-tracker';
      // show small redirect overlay
      const overlay = qs('redirectOverlay');
      if (overlay) overlay.style.display = 'flex';
      setTimeout(() => {
        try {
          window.open(trackerUrl, '_blank');
        } finally {
          if (overlay) overlay.style.display = 'none';
        }
      }, 700);
    } catch (err) {
      console.error('sendToDietTracker error', err);
      alert('Failed to send to Diet Tracker: ' + (err.message || err));
    }
  }

  // Initialize export buttons and their handlers (idempotent)
  function initializePdfExport() {
    // CSV
    const csvBtn = qs('downloadCsvBtn');
    if (csvBtn) {
      try {
        if (csvBtn._realCallback) csvBtn.removeEventListener('click', csvBtn._realCallback);
      } catch (e) {}
      csvBtn._realCallback = function (e) { e.preventDefault(); downloadCsv(); };
      csvBtn.addEventListener('click', csvBtn._realCallback);
    }
    // PDF
    const pdfBtn = qs('downloadPdfBtn');
    if (pdfBtn) {
      try {
        if (pdfBtn._realCallback) pdfBtn.removeEventListener('click', pdfBtn._realCallback);
      } catch (e) {}
      pdfBtn._realCallback = function (e) { e.preventDefault(); exportToPDF(); };
      pdfBtn.addEventListener('click', pdfBtn._realCallback);
    }

    // Send to tracker
    const sendBtn = qs('sendToTrackerBtn');
    if (sendBtn) {
      try {
        if (sendBtn._realCallback) sendBtn.removeEventListener('click', sendBtn._realCallback);
      } catch (e) {}
      sendBtn._realCallback = function (e) { e.preventDefault(); sendToDietTracker(); };
      sendBtn.addEventListener('click', sendBtn._realCallback);
    }
    log('initializePdfExport: bound CSV/PDF/Send handlers');
  }

  // Called by loadExistingPlan() from inline stub, or by DOMContentLoaded below
  function renderMealPlanPreview() {
    if (typeof inlineMealPlanPreview === 'function') {
      try { inlineMealPlanPreview(); } catch (e) { console.warn('renderMealPlanPreview wrapper error', e); }
    } else {
      if (window.currentMealPlan) displayMealPlan(window.currentMealPlan, window.currentUserProfile);
    }
  }

  // Load on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    try {
      // wire up form handlers and export handlers
      initializeForm();
      initializePdfExport();


  // AI Meal Plan Generator
  function initializeAIGenerator() {
    const generateAIBtn = document.getElementById('generateAIBtn');
    if (!generateAIBtn) return;

    generateAIBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'block';

      try {
        const profile = readAndValidateProfile();
        window.currentUserProfile = profile;

        // Build AI prompt from user profile
        const prompt = `Generate a detailed weekly meal plan (breakfast, lunch, dinner, snacks, macros) for this profile: Age: ${profile.age}, Gender: ${profile.gender}, Height: ${profile.height} cm, Weight: ${profile.weight} kg, Goal: ${profile.goal}, Diet Type: ${profile.dietType}, Region: ${profile.region}, Activity Level: ${profile.activityLevel}, Target Calories: ${profile.targetCalories || 'Auto'}. Format the response as clean HTML with tables showing each day's meals and nutritional breakdown.`;

        // OpenAI API call
        const OPENAI_API_KEY = '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';
        const url = 'https://api.openai.com/v1/chat/completions';
        const payload = {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a nutrition expert providing personalized, macro-based meal plans. Return the meal plan as clean, well-formatted HTML with tables.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000,
          temperature: 0.7
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const aiHtml = data.choices[0].message.content;

        // Display results in the same container
        const resultsContainer = document.getElementById('resultsContainer');
        if (resultsContainer && !resultsContainer.classList.contains('visible')) {
          resultsContainer.classList.add('visible');
        }
        document.querySelectorAll('.form-section').forEach(s => s.classList.add('hidden'));

        const container = document.getElementById('mealPlanContainer');
        if (container) {
          container.innerHTML = `<div class="ai-meal-plan">${aiHtml}</div>`;
        }

        // Populate overview section
        const overview = document.getElementById('resultsOverview');
        if (overview) {
          overview.innerHTML = `
            <div class="result-item">
              <span class="result-label">Profile:</span>
              <span class="result-value">${profile.age}y, ${profile.gender}, ${profile.goal}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Diet Type:</span>
              <span class="result-value">${profile.dietType}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Region:</span>
              <span class="result-value">${profile.region}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Generated By:</span>
              <span class="result-value">AI (OpenAI GPT-4)</span>
            </div>
          `;
        }

      } catch (err) {
        log('AI Generation Error:', err);
        alert('Failed to generate meal plan with AI: ' + (err.message || err));
      } finally {
        if (loading) loading.style.display = 'none';
      }
    });
  }
      initializeAIGenerator();      // call stubs that may exist
      try { if (typeof initializeTheme === 'function') initializeTheme(); } catch (e) {}
      try { if (typeof initializeNavigation === 'function') initializeNavigation(); } catch (e) {}
      try { if (typeof initializeMobileMenu === 'function') initializeMobileMenu(); } catch (e) {}

      // render existing plan if any
      try { if (typeof loadExistingPlan === 'function') loadExistingPlan(); } catch (e) {}
      // also call preview renderer if plan exists
      if (window.currentMealPlan) {
        try { displayMealPlan(window.currentMealPlan, window.currentUserProfile); } catch (e) {}
      }

    } catch (err) {
      console.error('DOMContentLoaded init error', err);
    }
  });

  // Expose some functions for console debugging
  window.__planner = {
    displayMealPlan, generateSamplePlan, downloadCsv, exportToPDF, initializeForm, initializePdfExport, renderMealPlanPreview
  };

  log('planner-diet-planner-fixed.js loaded');

})();
