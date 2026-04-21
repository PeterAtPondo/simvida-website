// SimVida wireframe · retirement projection playground
// Math ported from simvida-client/client/composables/useCalcs.ts
// Defaults from useDefaults.ts (inflation 6%, growth 10%, life expectancy 90)
(function () {

  const DEFAULTS = {
    inflationRate: 0.06,
    interestRate: 0.10,
    lifeExpectancy: 90,
    contribEscalation: 0.10, // 10% annual contribution increase
  };

  // ── Calc core (ports) ─────────────────────────────────────────

  // useCalcs.calculateFinancialProjections
  function calculateFinancialProjections(initial, growthRate, annualContribution, contribIncrease, years) {
    let fv = initial;
    let contribution = annualContribution;
    const values = [];
    for (let y = 1; y <= years; y++) {
      fv *= 1 + growthRate;
      fv += contribution;
      contribution *= 1 + contribIncrease;
      values.push({ year: y, value: fv });
    }
    return values;
  }

  // useCalcs.projectedMonthlyIncomeCalc (collapsed)
  function projectedMonthlyIncome(lumpSum, yearsUntilRetirement, yearsOfRetirement, growth, inflation) {
    if (yearsOfRetirement <= 0 || lumpSum <= 0) {
      return { presentMonthlyIncome: 0, futureMonthlyIncome: 0, annualWithdrawal: 0 };
    }
    const realRate = (1 + growth) / (1 + inflation) - 1;
    const monthlyRealRate = realRate / 12;
    const totalMonths = yearsOfRetirement * 12;
    const denom = 1 - Math.pow(1 + monthlyRealRate, -totalMonths);
    const future = denom !== 0 ? lumpSum * (monthlyRealRate / denom) : 0;
    const present = future / Math.pow(1 + inflation, yearsUntilRetirement);
    return { presentMonthlyIncome: present, futureMonthlyIncome: future, annualWithdrawal: future * 12 };
  }

  // Full trajectory: savings phase then drawdown phase
  function projectTrajectory(params) {
    const age = params.age;
    const retirementAge = params.retirementAge;
    const currentSavings = params.currentSavings;
    const monthlyContribution = params.monthlyContribution;
    const escalation = params.escalation != null ? params.escalation : DEFAULTS.contribEscalation;
    const yearsUntilRetirement = Math.max(0, retirementAge - age);
    const yearsOfRetirement = Math.max(0, DEFAULTS.lifeExpectancy - retirementAge);
    const g = DEFAULTS.interestRate;
    const i = DEFAULTS.inflationRate;

    // Savings phase
    const savings = calculateFinancialProjections(
      currentSavings, g, monthlyContribution * 12, escalation, yearsUntilRetirement
    );
    const lumpSum = savings.length > 0 ? savings[savings.length - 1].value : currentSavings;

    const { presentMonthlyIncome, futureMonthlyIncome, annualWithdrawal } =
      projectedMonthlyIncome(lumpSum, yearsUntilRetirement, yearsOfRetirement, g, i);

    // Drawdown phase (inflation-adjusted withdrawals)
    const drawdown = [];
    let fv = lumpSum;
    let withdrawal = annualWithdrawal;
    for (let y = 1; y <= yearsOfRetirement; y++) {
      fv = Math.max(fv - withdrawal, 0);
      fv *= 1 + g;
      withdrawal *= 1 + i;
      drawdown.push({ year: yearsUntilRetirement + y, value: fv });
    }

    const series = [
      { age: age, value: currentSavings },
      ...savings.map(s => ({ age: age + s.year, value: s.value })),
      ...drawdown.map(d => ({ age: age + d.year, value: d.value })),
    ];

    return { series, lumpSum, monthlyIncome: presentMonthlyIncome };
  }

  // ── Formatting ─────────────────────────────────────────────────

  function formatR(n) {
    if (!isFinite(n) || n <= 0) return 'R0';
    if (n >= 1_000_000) return 'R' + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'm';
    if (n >= 1_000) return 'R' + Math.round(n / 1_000) + 'k';
    return 'R' + Math.round(n);
  }

  function formatRand(n) {
    if (!isFinite(n) || n < 0) return 'R0';
    return 'R' + Math.round(n).toLocaleString('en-ZA');
  }

  // ── Nice ticks ─────────────────────────────────────────────────

  function niceStep(range, count) {
    const raw = range / Math.max(1, count);
    const exp = Math.pow(10, Math.floor(Math.log10(raw)));
    const base = raw / exp;
    const nice = base < 1.5 ? 1 : base < 3 ? 2 : base < 7 ? 5 : 10;
    return nice * exp;
  }

  function yTicks(max, count = 4) {
    if (max <= 0) return [0];
    const step = niceStep(max, count);
    const ticks = [];
    for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(t);
    return ticks;
  }

  // ── Age-adaptive lever picker ──────────────────────────────────
  // Different stages of life respond to different levers.
  // Young: time + compounding → small contribution bumps are huge.
  // Mid-life: contributions near peak → growing them faster (escalation) matters most.
  // Close to retirement: limited horizon → one more year of work compounds on both sides.
  function pickLever(inputs) {
    if (inputs.age < 40) {
      return {
        modify: { ...inputs, monthlyContribution: inputs.monthlyContribution + 1000 },
        legendLabel: 'saving R1,000 more each month',
        heading: 'One small lever',
        tail: `Save just R1,000 more each month. You'd retire at ${inputs.retirementAge} with <strong>{{income}}</strong> a month. At your age, small amounts compound into something serious.`,
      };
    }
    if (inputs.age < 55) {
      return {
        modify: { ...inputs, escalation: 0.15 },
        legendLabel: 'escalating your saving 15% a year',
        heading: 'One small lever',
        tail: `Escalate your saving 15% a year instead of 10%. You'd retire at ${inputs.retirementAge} with <strong>{{income}}</strong> a month. Your savings grow with your career.`,
      };
    }
    const delayedAge = Math.min(inputs.retirementAge + 1, DEFAULTS.lifeExpectancy - 1);
    return {
      modify: { ...inputs, retirementAge: delayedAge },
      legendLabel: `retiring at ${delayedAge} instead`,
      heading: 'One small lever',
      tail: `Work just one more year, retire at ${delayedAge} instead. You'd have <strong>{{income}}</strong> a month. One more year of saving, one fewer year of drawing down.`,
      delayedAge: delayedAge,
    };
  }

  // ── DOM wiring ─────────────────────────────────────────────────

  const ageEl      = document.getElementById('c-age');
  const savingsEl  = document.getElementById('c-savings');
  const monthlyEl  = document.getElementById('c-monthly');
  const retireEl   = document.getElementById('c-retire');

  const ageVal     = document.getElementById('c-age-v');
  const savingsVal = document.getElementById('c-savings-v');
  const monthlyVal = document.getElementById('c-monthly-v');
  const retireVal  = document.getElementById('c-retire-v');

  const svg        = document.getElementById('projection-chart');
  const resultEl   = document.getElementById('chart-result');

  if (!ageEl || !svg) return; // not on this page

  function getInputs() {
    return {
      age: +ageEl.value,
      currentSavings: +savingsEl.value,
      monthlyContribution: +monthlyEl.value,
      retirementAge: +retireEl.value,
    };
  }

  // ── Chart render ───────────────────────────────────────────────

  const W = 800, H = 300;
  const M = { l: 56, r: 24, t: 28, b: 32 };
  const innerW = W - M.l - M.r;
  const innerH = H - M.t - M.b;

  function drawChart(currentSeries, improvedSeries, inputs, lever) {
    const ages = improvedSeries.map(p => p.age);
    const xMin = Math.min(...ages);
    const xMax = DEFAULTS.lifeExpectancy;
    const allVals = improvedSeries.map(p => p.value).concat(currentSeries.map(p => p.value));
    const yRaw = Math.max(...allVals, 1);
    const yMax = niceStep(yRaw * 1.05, 1) * Math.ceil((yRaw * 1.05) / niceStep(yRaw * 1.05, 1));

    const xScale = age => M.l + ((age - xMin) / Math.max(1, (xMax - xMin))) * innerW;
    const yScale = v   => M.t + innerH - (v / yMax) * innerH;

    const pathFor = series => series
      .map((p, i) => (i === 0 ? 'M' : 'L') + xScale(p.age).toFixed(1) + ' ' + yScale(p.value).toFixed(1))
      .join(' ');

    const areaFor = series => {
      if (series.length === 0) return '';
      const line = pathFor(series);
      const last = series[series.length - 1];
      const first = series[0];
      return `${line} L${xScale(last.age).toFixed(1)} ${yScale(0).toFixed(1)} L${xScale(first.age).toFixed(1)} ${yScale(0).toFixed(1)} Z`;
    };

    const yt = yTicks(yMax, 4);
    const xt = [];
    const xStart = Math.ceil(xMin / 10) * 10;
    for (let t = xStart; t <= xMax; t += 10) xt.push(t);

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      ${yt.map(t => `<line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${yScale(t).toFixed(1)}" y2="${yScale(t).toFixed(1)}"/>`).join('')}

      <line class="retirement-line" x1="${xScale(inputs.retirementAge).toFixed(1)}" x2="${xScale(inputs.retirementAge).toFixed(1)}" y1="${M.t}" y2="${H - M.b}"/>
      <text class="retire-label" x="${xScale(inputs.retirementAge).toFixed(1)}" y="${(M.t - 10).toFixed(1)}" text-anchor="middle">retire at ${inputs.retirementAge}</text>

      <path class="area-current" d="${areaFor(currentSeries)}"/>
      <path class="series-current" d="${pathFor(currentSeries)}"/>

      <path class="area-improved" d="${areaFor(improvedSeries)}"/>
      <path class="series-improved" d="${pathFor(improvedSeries)}"/>

      <line class="axis" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>
      <line class="axis" x1="${M.l}" x2="${M.l}" y1="${M.t}" y2="${H - M.b}"/>

      ${yt.map(t => `<text class="tick-label" x="${M.l - 10}" y="${(yScale(t) + 4).toFixed(1)}" text-anchor="end">${formatR(t)}</text>`).join('')}

      ${xt.map(t => `<text class="tick-label" x="${xScale(t).toFixed(1)}" y="${H - M.b + 18}" text-anchor="middle">${t}</text>`).join('')}

      <g transform="translate(${M.l + 16}, ${M.t + 10})">
        <line class="legend-swatch series-improved" x1="0" x2="24" y1="0" y2="0"/>
        <text class="legend-label" x="32" y="4">${lever.legendLabel}</text>
        <line class="legend-swatch series-current" x1="0" x2="24" y1="20" y2="20"/>
        <text class="legend-label" x="32" y="24">current path</text>
      </g>
    `;
  }

  function updateResult(inputs, current, improved, lever) {
    const diff = Math.max(0, improved.monthlyIncome - current.monthlyIncome);
    const tail = lever.tail.replace('{{income}}', formatRand(improved.monthlyIncome));
    resultEl.innerHTML = `
      <p class="lead" style="margin-bottom: var(--sp-3);">
        <strong class="result-label-current">On your current path:</strong>
        retire at ${inputs.retirementAge} with about <strong>${formatRand(current.monthlyIncome)}</strong> a month, in today's money.
      </p>
      <p class="lead" style="margin-bottom: 0;">
        <strong class="result-label-lever">${lever.heading}:</strong>
        ${tail} That's <strong class="diff-highlight">${formatRand(diff)}</strong> more, every month of the rest of your life.
      </p>
    `;
  }

  function render() {
    const inputs = getInputs();
    if (inputs.retirementAge <= inputs.age) {
      inputs.retirementAge = inputs.age + 1;
      retireEl.value = inputs.retirementAge;
    }

    ageVal.textContent     = inputs.age;
    savingsVal.textContent = formatR(inputs.currentSavings);
    monthlyVal.textContent = formatR(inputs.monthlyContribution);
    retireVal.textContent  = inputs.retirementAge;

    const current  = projectTrajectory(inputs);
    const lever    = pickLever(inputs);
    const improved = projectTrajectory(lever.modify);

    drawChart(current.series, improved.series, inputs, lever);
    updateResult(inputs, current, improved, lever);
  }

  [ageEl, savingsEl, monthlyEl, retireEl].forEach(el => {
    el.addEventListener('input', render);
  });

  render();

})();
