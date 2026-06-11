/* =====================================================
   FitnessFreak AI — diet.js
   BMI / BMR / TDEE calculation + meal plan rendering
   Calls /api/bmi, renders accordion + metric cards
   ===================================================== */

let selectedGender = 'male';
let lastPlanData   = null;

window.setGender = function(gender, btn) {
  selectedGender = gender;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

// ── Input validation ──────────────────────────────────
function validateInputs() {
  const height = parseFloat(document.getElementById('height').value);
  const weight = parseFloat(document.getElementById('weight').value);
  const age    = parseInt(document.getElementById('age').value);
  let valid = true;

  function setError(id, hintId, show) {
    const input = document.getElementById(id);
    const hint  = document.getElementById(hintId);
    input?.classList.toggle('error', show);
    hint?.classList.toggle('d-none', !show);
    if (show) valid = false;
  }

  setError('height', 'heightHint', !height || height < 100 || height > 250);
  setError('weight', 'weightHint', !weight || weight < 20  || weight > 300);
  setError('age',    'ageHint',    !age    || age < 10     || age > 100);
  return valid;
}

// ── Generate diet plan ────────────────────────────────
window.generateDiet = async function() {
  if (!validateInputs()) return;

  const height = parseFloat(document.getElementById('height').value);
  const weight = parseFloat(document.getElementById('weight').value);
  const age    = parseInt(document.getElementById('age').value);

  // Loading state
  document.getElementById('generateBtnText').classList.add('d-none');
  document.getElementById('generateBtnLoader').classList.remove('d-none');
  document.getElementById('generateBtn').disabled = true;
  document.getElementById('dietIdle').classList.remove('d-none');
  document.getElementById('dietResults').classList.add('d-none');

  try {
    const res  = await fetch('/api/bmi', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ height, weight, age, gender: selectedGender })
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      showToast(data.error || 'Calculation failed. Please try again.', 'error');
      return;
    }

    lastPlanData = data;
    renderResults(data);
    showToast('Plan generated successfully!', 'success');

  } catch(err) {
    showToast('Network error. Please check your connection.', 'error');
  } finally {
    document.getElementById('generateBtnText').classList.remove('d-none');
    document.getElementById('generateBtnLoader').classList.add('d-none');
    document.getElementById('generateBtn').disabled = false;
  }
};

// ── Render results ────────────────────────────────────
function renderResults(data) {
  const { bmi, category, bmr, tdee, plan } = data;

  // Metric cards
  document.getElementById('rBmi').textContent    = bmi;
  document.getElementById('rBmiCat').textContent = category;
  document.getElementById('rBmr').textContent    = bmr.toLocaleString();
  document.getElementById('rTdee').textContent   = tdee.toLocaleString();
  document.getElementById('rGoal').textContent   = plan.goal;
  document.getElementById('rTarget').textContent = plan.target_calories.toLocaleString() + ' kcal target';

  // Colour BMI card based on category
  const bmiCard = document.getElementById('rBmi').closest('.metric-card');
  if (bmiCard) {
    const colours = {
      'Underweight': '#f5a623',
      'Normal weight': '#22c573',
      'Overweight': '#f04b4b',
      'Obese': '#f04b4b'
    };
    bmiCard.style.setProperty('--bmi-color', colours[category] || '#22c573');
    bmiCard.querySelector('.metric-val').style.color = colours[category] || '#22c573';
  }

  // Tip banner
  document.getElementById('dietTip').innerHTML =
    `<i class="bi bi-lightbulb-fill me-2" style="color:var(--ff-green)"></i>${plan.tip}`;

  // Hydration
  document.getElementById('hydrationText').textContent = plan.hydration;

  // Meal accordion
  const acc = document.getElementById('mealAccordion');
  acc.innerHTML = '';

  const meals = [
    { id: 'breakfast', icon: 'bi-sunrise',        label: 'Breakfast', items: plan.breakfast },
    { id: 'lunch',     icon: 'bi-sun',             label: 'Lunch',     items: plan.lunch     },
    { id: 'dinner',    icon: 'bi-moon-stars',       label: 'Dinner',    items: plan.dinner    },
    { id: 'snacks',    icon: 'bi-apple',            label: 'Snacks',    items: plan.snacks    },
  ];

  meals.forEach((meal, idx) => {
    const totalCal = meal.items.reduce((s, m) => s + m.cal, 0);
    const items = meal.items.map(m =>
      `<div class="meal-item">
        <span class="meal-name">${m.name}</span>
        <span class="meal-cal">${m.cal} kcal</span>
      </div>`
    ).join('');

    acc.innerHTML += `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button${idx > 0 ? ' collapsed' : ''}"
                  type="button" data-bs-toggle="collapse"
                  data-bs-target="#meal-${meal.id}">
            <i class="bi ${meal.icon} me-2"></i>
            ${meal.label}
            <span style="margin-left:auto;font-size:.78rem;color:var(--ff-muted);font-weight:400">
              ~${totalCal} kcal
            </span>
          </button>
        </h2>
        <div id="meal-${meal.id}" class="accordion-collapse collapse${idx === 0 ? ' show' : ''}">
          <div class="accordion-body">${items}</div>
        </div>
      </div>`;
  });

  // Show results
  document.getElementById('dietIdle').classList.add('d-none');
  document.getElementById('dietResults').classList.remove('d-none');

  // Scroll results into view on mobile
  if (window.innerWidth < 992) {
    document.getElementById('dietResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── Export plan ───────────────────────────────────────
window.exportPlan = function() {
  if (!lastPlanData) return;
  const { bmi, category, bmr, tdee, plan } = lastPlanData;

  const lines = [
    '====================================',
    '   FitnessFreak AI — My Diet Plan',
    '====================================',
    '',
    `BMI        : ${bmi} (${category})`,
    `BMR        : ${bmr} kcal/day`,
    `Daily Goal : ${plan.target_calories} kcal  (${plan.goal})`,
    '',
    'BREAKFAST',
    ...plan.breakfast.map(m => `  • ${m.name} — ${m.cal} kcal`),
    '',
    'LUNCH',
    ...plan.lunch.map(m => `  • ${m.name} — ${m.cal} kcal`),
    '',
    'DINNER',
    ...plan.dinner.map(m => `  • ${m.name} — ${m.cal} kcal`),
    '',
    'SNACKS',
    ...plan.snacks.map(m => `  • ${m.name} — ${m.cal} kcal`),
    '',
    'HYDRATION',
    `  ${plan.hydration}`,
    '',
    'TIP',
    `  ${plan.tip}`,
    '',
    '====================================',
    `  Generated by FitnessFreak AI`,
    `  ${new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}`,
    '====================================',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'FitnessFreakAI_DietPlan.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Plan exported!', 'success');
};
