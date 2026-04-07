(function () {
  const REFRESH_MS = 15000;
  const TIMER_KEY = '__homepageMetricsTimer__';
  const INIT_KEY = '__homepageMetricsInit__';
  const OBSERVER_KEY = '__homepageMetricsObserver__';
  const KEEP_POINTS = 40;
  let isRendering = false;

  function loadChartJs() {
    return new Promise((resolve, reject) => {
      if (window.Chart) return resolve();

      const existing = document.querySelector('script[data-chartjs]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.setAttribute('data-chartjs', 'true');
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load Chart.js'));
      document.head.appendChild(s);
    });
  }

  async function fetchText(path) {
    const url = window.location.origin + path + '?t=' + Date.now();
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    if (!res.ok) throw new Error('Cannot load ' + path);
    return res.text();
  }

  async function fetchCSV() {
    const text = await fetchText('/system.csv');
    const rawLines = text.trim().split('\n').filter(Boolean);
    const hasHeader = rawLines[0] && /[a-zA-Z]/.test(rawLines[0]);
    const lines = hasHeader ? rawLines.slice(1) : rawLines;

    const labels = [];
    const cpu = [];
    const ram = [];
    const temp = [];
    const power = [];

    for (const line of lines) {
      const [time, c, r, t, p] = line.split(',');
      if (!time) continue;
      labels.push(time.trim());
      cpu.push(parseFloat(c) || 0);
      ram.push(parseFloat(r) || 0);
      temp.push(parseFloat(t) || 0);
      power.push(parseFloat(p) || 0);
    }

    return {
      labels: labels.slice(-KEEP_POINTS),
      cpu: cpu.slice(-KEEP_POINTS),
      ram: ram.slice(-KEEP_POINTS),
      temp: temp.slice(-KEEP_POINTS),
      power: power.slice(-KEEP_POINTS)
    };
  }

  async function fetchStatsCSV(path) {
    const text = await fetchText(path);
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(s => s.trim());

    return lines.slice(1).map(line => {
      const cols = line.split(',');
      const row = {};
      headers.forEach((h, i) => {
        row[h] = (cols[i] || '').trim();
      });
      return row;
    });
  }

  function ensureChartBlock() {
    let block = document.getElementById('custom-metrics-block');
    if (block && document.body.contains(block)) return block;

    const services = document.getElementById('services');
    if (!services) throw new Error('#services not found');

    block = document.createElement('div');
    block.id = 'custom-metrics-block';
    block.style.margin = '12px 8px 0 8px';

    block.innerHTML = `
      <div class="services-group basis-full flex-1 p-1">
        <h2 class="flex text-theme-800 dark:text-theme-300 text-xl font-medium mb-3">Metrics</h2>

        <div class="rounded-md shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5 p-4">
          <div id="metrics-status" style="font-size:12px; margin-bottom:12px; opacity:0.85;">Loading...</div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; align-items:start; margin-bottom:18px;">
            <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:600;">CPU</div>
                <div id="cpu-current" style="font-size:18px; font-weight:700;">0%</div>
              </div>
              <div style="position:relative; height:180px;">
                <canvas id="cpuChart"></canvas>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:600;">RAM</div>
                <div id="ram-current" style="font-size:18px; font-weight:700;">0%</div>
              </div>
              <div style="position:relative; height:180px;">
                <canvas id="ramChart"></canvas>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:600;">Temperature</div>
                <div id="temp-current" style="font-size:18px; font-weight:700;">0 °C</div>
              </div>
              <div style="position:relative; height:180px;">
                <canvas id="tempChart"></canvas>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:600;">Power</div>
                <div id="power-current" style="font-size:18px; font-weight:700;">0 W</div>
              </div>
              <div style="position:relative; height:180px;">
                <canvas id="powerChart"></canvas>
              </div>
            </div>
          </div>

          <div style="margin-top:10px;">
            <h3 style="font-size:16px; font-weight:700; margin-bottom:10px;">Long-term Stats</h3>

            <div id="longterm-groups" style="display:flex; flex-direction:column; gap:18px;">
              ${buildGroupHTML('weekly', 'Weekly (7 ngày gần nhất)')}
              ${buildGroupHTML('monthly', 'Monthly (theo ngày trong tháng)')}
              ${buildGroupHTML('yearly', 'Yearly (theo tháng trong năm)')}
              ${buildGroupHTML('years', 'Years Comparison (theo năm)')}
            </div>
          </div>
        </div>
      </div>
    `;

    services.insertAdjacentElement('afterend', block);
    return block;
  }

  function buildGroupHTML(prefix, title) {
    const defs = [
      { key: 'cpu_avg', label: 'CPU Avg', unit: '%' },
      { key: 'ram_avg', label: 'RAM Avg', unit: '%' },
      { key: 'temp_avg', label: 'Temperature Avg', unit: '°C' },
      { key: 'power_avg', label: 'Power Avg', unit: 'W' },
      { key: 'power_total', label: 'Power Total', unit: 'W total' }
    ];

    return `
      <div>
        <h4 style="font-size:14px; font-weight:700; margin:0 0 8px 0;">${title}</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; align-items:start;">
          ${defs.map(def => `
            <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                <div style="font-size:14px; font-weight:600;">${def.label}</div>
                <div id="${prefix}-${def.key}-current" style="font-size:14px; font-weight:700; white-space:nowrap;">0 ${def.unit}</div>
              </div>
              <div style="position:relative; height:180px;">
                <canvas id="${prefix}-${def.key}-chart"></canvas>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function setStatus(text) {
    const el = document.getElementById('metrics-status');
    if (el) el.textContent = text;
  }

  function destroyIfExists(id) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return null;

    const oldChartByEl = Chart.getChart(canvas);
    if (oldChartByEl) oldChartByEl.destroy();

    const oldChartById = Chart.getChart(id);
    if (oldChartById) oldChartById.destroy();

    return canvas;
  }

  function makeDoughnut(canvas, value, color) {
    return new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Used', 'Remaining'],
        datasets: [{
          data: [value, Math.max(0, 100 - value)],
          backgroundColor: [color, 'rgba(148,163,184,0.18)'],
          borderWidth: 0
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        }
      }
    });
  }

  function makeLine(canvas, labels, data, color, yLabel, unit) {
    return new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: yLabel,
          data,
          borderColor: color,
          backgroundColor: 'transparent',
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2,
          tension: 0.25
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const v = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0;
                return yLabel + ': ' + formatValue(v, unit);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#cbd5e1', maxTicksLimit: 8 },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#cbd5e1',
              callback: function (value) {
                return formatTick(value, unit);
              }
            },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  function makeBar(canvas, labels, data, color, label, unit) {
    return new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: color,
          borderRadius: 6
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                const v = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0;
                return label + ': ' + formatValue(v, unit);
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#cbd5e1', maxTicksLimit: 8 },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#cbd5e1',
              callback: function (value) {
                return formatTick(value, unit);
              }
            },
            grid: { color: 'rgba(255,255,255,0.06)' }
          }
        }
      }
    });
  }

  function formatTick(value, unit) {
    if (unit === '%' || unit === '°C' || unit === 'W') return value + unit;
    if (unit === 'W total') return value + 'W';
    return value;
  }

  function formatValue(value, unit) {
    const n = Number(value) || 0;
    if (unit === '%') return n.toFixed(2) + '%';
    if (unit === '°C') return n.toFixed(2) + ' °C';
    if (unit === 'W') return n.toFixed(3) + ' W';
    if (unit === 'W total') return n.toFixed(3) + ' W';
    return n.toFixed(2);
  }

  function setCurrentValue(id, value, unit) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatValue(value, unit);
  }

  function getLastValue(rows, key) {
    if (!rows || !rows.length) return 0;
    return parseFloat(rows[rows.length - 1][key]) || 0;
  }

  function getLabelKey(rows) {
    if (!rows || !rows.length) return null;
    const candidates = ['Day', 'Date', 'Month', 'Year', 'Week'];
    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(rows[0], key)) return key;
    }
    return Object.keys(rows[0])[0] || null;
  }

  function sliceLast(rows, count) {
    return rows.slice(Math.max(0, rows.length - count));
  }

  function renderLongGroup(prefix, rows, options) {
    const labelKey = getLabelKey(rows);
    if (!labelKey || !rows.length) return;

    const labels = rows.map(r => r[labelKey]);
    const defs = [
      { key: 'cpu_avg', label: 'CPU Avg', unit: '%', color: '#ff4d4f', type: 'line' },
      { key: 'ram_avg', label: 'RAM Avg', unit: '%', color: '#4096ff', type: 'line' },
      { key: 'temp_avg', label: 'Temperature Avg', unit: '°C', color: '#faad14', type: 'line' },
      { key: 'power_avg', label: 'Power Avg', unit: 'W', color: '#52c41a', type: 'line' },
      { key: 'power_total', label: 'Power Total', unit: 'W total', color: 'rgba(19, 194, 194, 0.8)', type: 'bar' }
    ];

    defs.forEach(def => {
      const canvasId = `${prefix}-${def.key}-chart`;
      const currentId = `${prefix}-${def.key}-current`;
      const canvas = destroyIfExists(canvasId);
      if (!canvas) return;

      const data = rows.map(r => parseFloat(r[def.key]) || 0);
      setCurrentValue(currentId, data[data.length - 1] || 0, def.unit);

      if (def.type === 'bar') {
        makeBar(canvas, labels, data, def.color, def.label, def.unit);
      } else {
        makeLine(canvas, labels, data, def.color, def.label, def.unit);
      }
    });
  }

  async function renderOnce() {
    await loadChartJs();
    ensureChartBlock();

    const [
      data,
      dailyStats,
      monthlyStats,
      yearlyStats
    ] = await Promise.all([
      fetchCSV(),
      fetchStatsCSV('/daily_stats.csv'),
      fetchStatsCSV('/monthly_stats.csv'),
      fetchStatsCSV('/yearly_stats.csv')
    ]);

    const latestCpu = data.cpu[data.cpu.length - 1] || 0;
    const latestRam = data.ram[data.ram.length - 1] || 0;
    const latestTemp = data.temp[data.temp.length - 1] || 0;
    const latestPower = data.power[data.power.length - 1] || 0;

    document.getElementById('cpu-current').textContent = latestCpu.toFixed(0) + '%';
    document.getElementById('ram-current').textContent = latestRam.toFixed(0) + '%';
    document.getElementById('temp-current').textContent = latestTemp.toFixed(1) + ' °C';
    document.getElementById('power-current').textContent = latestPower.toFixed(3) + ' W';

    const cpuCanvas = destroyIfExists('cpuChart');
    const ramCanvas = destroyIfExists('ramChart');
    const tempCanvas = destroyIfExists('tempChart');
    const powerCanvas = destroyIfExists('powerChart');

    if (!cpuCanvas || !ramCanvas || !tempCanvas || !powerCanvas) {
      throw new Error('One or more canvases not found');
    }

    makeDoughnut(cpuCanvas, latestCpu, '#ff4d4f');
    makeDoughnut(ramCanvas, latestRam, '#4096ff');
    makeLine(tempCanvas, data.labels, data.temp, '#faad14', 'Temp', '°C');
    makeLine(powerCanvas, data.labels, data.power, '#52c41a', 'Power', 'W');

    const weeklyRows = sliceLast(dailyStats, 7);
    const monthlyRows = dailyStats;
    const yearlyRows = monthlyStats;
    const yearsRows = yearlyStats;

    renderLongGroup('weekly', weeklyRows);
    renderLongGroup('monthly', monthlyRows);
    renderLongGroup('yearly', yearlyRows);
    renderLongGroup('years', yearsRows);

    const latest = data.labels[data.labels.length - 1] || 'n/a';
    setStatus(
      'Last CSV point: ' +
      latest +
      ' | Short-term rows: ' +
      data.labels.length +
      ' | Daily: ' +
      dailyStats.length +
      ' | Monthly: ' +
      monthlyStats.length +
      ' | Yearly: ' +
      yearlyStats.length +
      ' | Refreshed: ' +
      new Date().toLocaleTimeString()
    );
  }

  async function loop() {
    if (isRendering) return;
    isRendering = true;

    try {
      await renderOnce();
    } catch (err) {
      console.error('Metrics chart error:', err);
      setStatus('Error: ' + err.message);
    } finally {
      isRendering = false;
      clearTimeout(window[TIMER_KEY]);
      window[TIMER_KEY] = setTimeout(loop, REFRESH_MS);
    }
  }

  function boot() {
    if (window[INIT_KEY]) return;
    window[INIT_KEY] = true;
    loop();

    if (window[OBSERVER_KEY]) {
      window[OBSERVER_KEY].disconnect();
    }

    const observer = new MutationObserver(() => {
      const block = document.getElementById('custom-metrics-block');
      if (!block || !document.body.contains(block)) {
        window[INIT_KEY] = false;
        clearTimeout(window[TIMER_KEY]);
        observer.disconnect();
        window[OBSERVER_KEY] = null;
        setTimeout(boot, 500);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window[OBSERVER_KEY] = observer;
  }

  window.addEventListener('load', () => setTimeout(boot, 1000));
})();
