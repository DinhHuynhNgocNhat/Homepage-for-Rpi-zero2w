// system_metrics.js
async function fetchMetrics() {
    const res = await fetch('/home/pi/homepage/system.log');
    const text = await res.text();
    const lines = text.trim().split('\n').slice(-30); // 30 dòng cuối
    const labels = [];
    const cpu = [], ram = [], temp = [], power = [];

    for (let line of lines) {
        const [time, c, r, t, p] = line.split(',');
        labels.push(time.split(' ')[1]); // giờ:phút:giây
        cpu.push(parseFloat(c));
        ram.push(parseFloat(r));
        temp.push(parseFloat(t));
        power.push(parseFloat(p));
    }

    return { labels, cpu, ram, temp, power };
}

async function drawChart() {
    const data = await fetchMetrics();
    const ctx = document.getElementById('metricsChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'CPU %', data: data.cpu, borderColor: 'red', fill: false },
                { label: 'RAM %', data: data.ram, borderColor: 'blue', fill: false },
                { label: 'Temp °C', data: data.temp, borderColor: 'orange', fill: false },
                { label: 'Power W', data: data.power, borderColor: 'green', fill: false },
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

window.onload = drawChart;
