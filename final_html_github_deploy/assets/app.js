(function () {
  "use strict";

  const charts = {};
  const highlightMonth = "2026-03";
  const palette = {
    slate900: "#0f172a",
    slate700: "#334155",
    slate500: "#64748b",
    slate300: "#cbd5e1",
    slate200: "#e2e8f0",
    orange: "#ea580c",
    emerald: "#10b981",
    blue: "#2563eb",
    blueSoft: "rgba(37, 99, 235, .13)",
    rose: "#e11d48"
  };

  function readGlobal(name) {
    try {
      return Function(`return typeof ${name} !== "undefined" ? ${name} : undefined`)();
    } catch (error) {
      return undefined;
    }
  }

  function showError(message) {
    const el = document.getElementById("errorMessage");
    if (!el) return;
    el.textContent = message;
    el.classList.add("active");
  }

  function bindTabs() {
    document.querySelectorAll(".viz-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const panelId = tab.dataset.panel;
        document.querySelectorAll(".viz-tab").forEach(item => {
          item.classList.toggle("active", item === tab);
        });
        document.querySelectorAll(".panel").forEach(panel => {
          panel.classList.toggle("active", panel.id === panelId);
        });
        Object.values(charts).forEach(chart => chart.resize());
      });
    });
  }

  const monthLabel = month => `${Number(String(month).slice(5, 7))}월`;
  const fmt = (n, digits = 1) => Number(n || 0).toLocaleString("ko-KR", { maximumFractionDigits: digits });
  const pct = n => `${fmt(n, 1)}%`;

  function commonGrid() {
    return {
      color: palette.slate200,
      borderDash: [3, 3],
      drawBorder: false
    };
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function makeChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    destroyChart(id);
    charts[id] = new Chart(canvas, config);
  }

  function shortMovie(name, len = 11) {
    return String(name).length > len ? `${String(name).slice(0, len)}...` : String(name);
  }

  function initCharts(monthlyDiversityIndices, monthlyMovieIndices) {
    if (!window.Chart) {
      showError("Chart.js 파일을 불러오지 못했습니다. vendor/chart.umd.min.js 경로를 확인해주세요.");
      return;
    }

    if (!Array.isArray(monthlyDiversityIndices) || !Array.isArray(monthlyMovieIndices)) {
      showError("데이터 파일을 불러오지 못했습니다. js_data 폴더가 index.html과 함께 업로드됐는지 확인해주세요.");
      return;
    }

    Chart.defaults.font.family = "\"Inter\", \"Segoe UI\", \"Malgun Gothic\", system-ui, sans-serif";
    Chart.defaults.color = palette.slate500;
    Chart.defaults.animation = false;

    const months = monthlyDiversityIndices
      .map(d => d.month)
      .filter(month => month >= "2026-01" && month <= "2026-05")
      .sort();

    if (!months.length) {
      showError("표시할 2026년 1-5월 데이터가 없습니다.");
      return;
    }

    const diversityRows = () => months
      .map(month => monthlyDiversityIndices.find(d => d.month === month))
      .filter(Boolean);

    const movieRows = month => monthlyMovieIndices
      .filter(d => d.month === month)
      .sort((a, b) => Number(b.SS_screen_share_pct || 0) - Number(a.SS_screen_share_pct || 0));

    function renderHhi() {
      const rows = diversityRows();
      makeChart("hhiChart", {
        type: "bar",
        data: {
          labels: rows.map(d => monthLabel(d.month)),
          datasets: [
            {
              type: "bar",
              label: "HHI",
              data: rows.map(d => d.HHI_screen_10000),
              backgroundColor: rows.map(d => d.month === highlightMonth ? palette.orange : palette.slate300),
              borderColor: rows.map(d => d.month === highlightMonth ? "#f97316" : palette.slate300),
              borderWidth: rows.map(d => d.month === highlightMonth ? 1.5 : 0),
              borderRadius: 7,
              yAxisID: "y",
              order: 2
            },
            {
              type: "line",
              label: "유효 영화수",
              data: rows.map(d => d.effective_movie_count),
              borderColor: palette.emerald,
              backgroundColor: "white",
              borderWidth: 3,
              pointBackgroundColor: "white",
              pointBorderColor: palette.emerald,
              pointBorderWidth: 2.5,
              pointRadius: rows.map(d => d.month === highlightMonth ? 6 : 4),
              tension: .35,
              yAxisID: "y1",
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              align: "end",
              labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11, weight: "700" } }
            },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, .92)",
              padding: 10,
              callbacks: {
                afterTitle: items => rows[items[0].dataIndex].month === highlightMonth ? "3월 집중도 최고점" : "",
                label: ctx => ctx.dataset.yAxisID === "y1"
                  ? `유효 영화수: ${fmt(ctx.raw, 2)}개`
                  : `HHI: ${fmt(ctx.raw, 0)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: "700" } } },
            y: {
              beginAtZero: true,
              suggestedMax: 2200,
              title: { display: true, text: "HHI", color: palette.slate500, font: { size: 11, weight: "800" } },
              grid: commonGrid(),
              ticks: { callback: v => fmt(v, 0), font: { size: 10 } }
            },
            y1: {
              beginAtZero: true,
              suggestedMax: 10,
              position: "right",
              title: { display: true, text: "유효 영화수", color: palette.emerald, font: { size: 11, weight: "800" } },
              grid: { drawOnChartArea: false },
              ticks: { callback: v => `${v}개`, color: palette.emerald, font: { size: 10 } }
            }
          }
        }
      });
    }

    function renderCr3() {
      const rows = diversityRows();
      const maxIdx = rows.reduce((best, row, idx) => row.CR3_screen_pct > rows[best].CR3_screen_pct ? idx : best, 0);
      makeChart("cr3Chart", {
        type: "line",
        data: {
          labels: rows.map(d => monthLabel(d.month)),
          datasets: [
            {
              label: "CR3",
              data: rows.map(d => d.CR3_screen_pct),
              borderColor: palette.blue,
              backgroundColor: palette.blueSoft,
              borderWidth: 3,
              fill: true,
              tension: .38,
              pointRadius: rows.map((d, i) => i === maxIdx ? 7 : 4),
              pointHoverRadius: 8,
              pointBackgroundColor: rows.map((d, i) => i === maxIdx ? palette.orange : "white"),
              pointBorderColor: rows.map((d, i) => i === maxIdx ? palette.orange : palette.blue),
              pointBorderWidth: 2.5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, .92)",
              padding: 10,
              callbacks: {
                afterTitle: items => rows[items[0].dataIndex].month === highlightMonth ? "3월 최고치" : "",
                label: ctx => `상위 3편 점유율: ${pct(ctx.raw)}`
              }
            }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, weight: "700" } } },
            y: {
              beginAtZero: true,
              suggestedMax: 75,
              grid: commonGrid(),
              ticks: { callback: v => `${v}%`, font: { size: 10 } },
              title: { display: true, text: "상위 3편 스크린 점유율", color: palette.slate500, font: { size: 11, weight: "800" } }
            }
          }
        }
      });
    }

    function renderMonthSelect() {
      const select = document.getElementById("monthSelect");
      select.innerHTML = months
        .map(month => `<option value="${month}" ${month === highlightMonth ? "selected" : ""}>${monthLabel(month)}</option>`)
        .join("");
      select.addEventListener("change", renderTop5);
    }

    function renderTop5() {
      const select = document.getElementById("monthSelect");
      const month = select.value || highlightMonth;
      const rows = movieRows(month).slice(0, 5);
      const table = document.getElementById("top5Table");
      const caption = document.getElementById("top5Caption");

      if (!rows.length) {
        table.innerHTML = "";
        caption.textContent = `${monthLabel(month)} Top5 데이터가 없습니다.`;
        destroyChart("top5Chart");
        return;
      }

      const top5Total = rows.reduce((sum, d) => sum + Number(d.SS_screen_share_pct || 0), 0);
      makeChart("top5Chart", {
        type: "bar",
        data: {
          labels: rows.map(d => shortMovie(d.movieNm)),
          datasets: [
            {
              label: "스크린 점유율",
              data: rows.map(d => d.SS_screen_share_pct),
              backgroundColor: rows.map((d, i) => i === 0 ? palette.rose : palette.slate300),
              borderRadius: 7,
              borderSkipped: false
            }
          ]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, .92)",
              padding: 10,
              callbacks: {
                title: items => rows[items[0].dataIndex].movieNm,
                label: ctx => `스크린 점유율: ${pct(ctx.raw)}`,
                afterLabel: ctx => `관객 점유율: ${pct(rows[ctx.dataIndex].audience_share_pct)}`
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              suggestedMax: Math.max(45, Number(rows[0].SS_screen_share_pct || 0) + 5),
              grid: commonGrid(),
              ticks: { callback: v => `${v}%`, font: { size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: palette.slate700, font: { size: 11, weight: "750" } }
            }
          }
        }
      });

      table.innerHTML = rows.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td title="${d.movieNm}">${d.movieNm}</td>
          <td>${pct(d.SS_screen_share_pct)}</td>
          <td>${pct(d.audience_share_pct)}</td>
        </tr>
      `).join("");

      caption.innerHTML =
        `<b>${monthLabel(month)} Top5 합계</b>는 ${pct(top5Total)}입니다. 1위 <b>${rows[0].movieNm}</b>의 스크린 점유율은 ${pct(rows[0].SS_screen_share_pct)}입니다.`;
    }

    renderMonthSelect();
    renderHhi();
    renderCr3();
    renderTop5();
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindTabs();
    initCharts(readGlobal("monthlyDiversityIndices"), readGlobal("monthlyMovieIndices"));
  });
})();
