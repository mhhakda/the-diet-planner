# Diet Planner - Enhanced Version

A comprehensive web-based diet planning application that generates personalized weekly meal plans based on user profiles and integrates seamlessly with diet tracking systems.

## What Changed

### Files Modified/Created:
- **NEW: `planner.html`** - Complete rewrite with user questionnaire form and generated meal plan display
- **NEW: `planner.js`** - Complete rewrite with questionnaire handling, meal plan generation, and integrations
- **NEW: `planner.css`** - Additional styling for questionnaire and new features while maintaining design consistency
- **NEW: `meals.json`** - Extracted and enhanced meal database (272 meals) with proper nutritional data structure
- **PRESERVED: `style.css`** - Original design system preserved for consistency

### Key Features Added:
✅ User questionnaire (Age, Gender, Height, Weight, Goal, Diet Type, Region, Activity Level, Target Calories)
✅ "Generate Meal Plan" button - no results shown until clicked
✅ Smart meal plan generation algorithm based on user profile
✅ Modular JSON meal library with 272 meals across 3 regions and 4 diet types
✅ Dual Diet Tracker integration (localStorage + postMessage)
✅ "Go to Diet Tracker" button with configurable URL
✅ CSV export with UTF-8 BOM and proper escaping
✅ PDF export with charts, user profile, and complete meal plan
✅ Auto-fill for dates and safeNumber() helper for all numeric parsing
✅ Form validation with error highlighting
✅ Preserved visual theme and responsive design

## Diet Planner → Tracker Integration

### localStorage Integration
The planner writes data to localStorage key: `planned_meals_v1`

```javascript
// Diet Tracker integration code:
function importPlannedMeals() {
  const plannedData = localStorage.getItem('planned_meals_v1');
  if (plannedData) {
    const { entries } = JSON.parse(plannedData);
    entries.forEach(entry => addFoodEntry(entry));
    localStorage.removeItem('planned_meals_v1');
  }
}
```

### postMessage Integration
```javascript
// Receiver code for Diet Tracker:
window.addEventListener('message', function(event) {
  if (event.data?.type === 'DIET_PLANNER_PLAN') {
    const { entries } = event.data.payload;
    entries.forEach(entry => addFoodEntry(entry));
  }
});
```

## Deployment

### GitHub Pages
1. Upload all files to repository
2. Enable Pages in Settings → Pages
3. Access at: `https://username.github.io/repo/planner.html`

### Hostinger Iframe
```html
<iframe 
  src="https://your-domain.com/planner.html" 
  width="100%" 
  height="800px"
  sandbox="allow-scripts allow-same-origin allow-forms allow-downloads">
</iframe>
```

## Acceptance Tests

1. **Load Test**: Open planner.html → No console errors
2. **Form Test**: Fill questionnaire → Submit successfully  
3. **Generation Test**: Click "Generate Meal Plan" → Weekly grid appears
4. **Integration Test**: Click "Send to Tracker" → Check localStorage
5. **Export Test**: Download CSV/PDF → Verify content
6. **Responsive Test**: Resize browser → Layout adapts

## Technical Notes

- **Libraries**: Chart.js (v4.4.0) and html2pdf.js (v0.10.1) lazy-loaded for PDF export
- **Browser Support**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **File Size**: ~100KB initial load, ~475KB with all libraries loaded
- **Security**: No external data transmission, all processing client-side

## Configuration

Update `CONFIG.TRACKER_URL` in planner.js:
```javascript
const CONFIG = {
  TRACKER_URL: 'your-diet-tracker.html',
  // ...
};
```

## File Structure
```
diet-planner-updated/
├── planner.html      # Main application
├── planner.js        # Enhanced JavaScript
├── planner.css       # Additional styles
├── style.css         # Original design system
├── meals.json        # Meal database (272 meals)
└── README.md         # This file
```
