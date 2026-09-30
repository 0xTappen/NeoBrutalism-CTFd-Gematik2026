import "./main";
import $ from "jquery";
import CTFd from "../CTFd";
import dayjs from "dayjs";
import { cumulativeSum, colorHash, htmlEntities } from "../utils";

const graph = $("#score-graph");
let chart = null;
let chartLibrary = null;
const loadChartLibrary = () => {
  if (chartLibrary) return Promise.resolve(chartLibrary);
  return import(/* webpackChunkName: "scoreboard-echarts" */ "../components/scoreboard-echarts")
    .then(module => {
      chartLibrary = module.default;
      return chartLibrary;
    });
};

const categoryColor = category => {
  const colors = {
    web: "#2563eb",
    pwn: "#ef4444",
    reverse: "#22c55e",
    rev: "#22c55e",
    crypto: "#7c3aed",
    forensics: "#f97316",
    forensic: "#f97316",
    misc: "#64748b",
    osint: "#0891b2",
    hardware: "#ca8a04"
  };
  return colors[String(category).toLowerCase()] || colorHash(String(category));
};

const categoryTextColor = category => {
  const background = categoryColor(category);
  if (["#22c55e", "#f97316", "#ca8a04"].includes(background)) return "#111111";
  const hslLightness = background.match(/hsl\([^,]+,[^,]+,\s*([\d.]+)%\)/i);
  return hslLightness && Number(hslLightness[1]) > 50 ? "#111111" : "#ffffff";
};

const matrixStatus = (accountId, challengeId, detailByAccount, solveRanks) => {
  const detail = detailByAccount.get(String(accountId));
  if (!detail) return "unsolved";
  const solve = (detail.solves || []).find(item => item.challenge_id === challengeId);
  if (!solve) return "unsolved";
  const rank = solveRanks.get(challengeId)?.get(String(accountId));
  if (rank === 0) return "first";
  return "solved";
};

const createStatusIndicator = status => {
  const indicator = $("<span class='matrix-status'></span>").addClass(status);
  const labels = {
    first: ["fa-medal", "First solve"],
    solved: ["fa-check", "Solved"],
    unsolved: ["fa-minus", "Not solved"]
  };
  const config = labels[status];
  indicator.attr("title", config[1]).attr("aria-label", config[1]);
  indicator.append($("<i class='fas' aria-hidden='true'></i>").addClass(config[0]));
  return indicator;
};

const renderPodium = standings => {
  const podium = $("#scoreboard-podium");
  podium.empty();

  if (!Array.isArray(standings) || standings.length === 0) {
    podium.append("<div class='podium-empty neo-card text-center neo-bold'>NO RANKINGS YET</div>");
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const labels = ["Champion", "Second Place", "Third Place"];
  let previous = {};
  try { previous = JSON.parse(localStorage.getItem("gematik-scoreboard-positions") || "{}"); } catch (_error) { previous = {}; }
  const current = {};
  standings.slice(0, 3).forEach((standing, index) => {
    const key = String(standing.account_id || standing.id || standing.name);
    const position = Number(standing.pos || index + 1);
    current[key] = position;
    const card = $("<article class='podium-place'></article>").addClass(`place-${index + 1}`);
    const top = $("<div></div>");
    top.append($("<div class='podium-medal' aria-hidden='true'></div>").text(medals[index]));
    top.append($("<div class='podium-rank'></div>").text(labels[index]));
    const oldPosition = Number(previous[key]);
    const movement = oldPosition ? oldPosition - position : 0;
    top.append(
      $("<span class='podium-movement'></span>")
        .addClass(movement > 0 ? "up" : movement < 0 ? "down" : "same")
        .attr("title", oldPosition ? "Change since your last visit" : "No previous snapshot")
        .text(movement > 0 ? `↑${movement}` : movement < 0 ? `↓${Math.abs(movement)}` : "—")
    );
    top.append(
      $("<a class='podium-name'></a>")
        .attr("href", standing.account_url)
        .text(standing.name)
    );
    card.append(top);
    const score = $("<div class='podium-score'></div>");
    score.append($("<span></span>").text(standing.score));
    score.append("<small>PTS</small>");
    card.append(score);
    podium.append(card);
  });
  standings.forEach((standing, index) => {
    current[String(standing.account_id || standing.id || standing.name)] = Number(standing.pos || index + 1);
  });
  localStorage.setItem("gematik-scoreboard-positions", JSON.stringify(current));
};

const renderChallengeMatrix = (challenges, standings, details) => {
  const matrix = $("#challenge-matrix");
  matrix.empty();

  if (standings.length === 0) {
    matrix.append("<div class='matrix-empty neo-bold'>NO SOLVES YET</div>");
    return;
  }

  if (!Array.isArray(challenges) || challenges.length === 0) {
    const rankingTable = $("<table class='completion-matrix ranking-only'></table>");
    const rankingHead = $("<thead><tr></tr></thead>");
    rankingHead.find("tr").append(
      "<th class='matrix-rank'>#</th>",
      $("<th class='matrix-account'></th>").text(CTFd.config.userMode === "teams" ? "TEAM" : "USER"),
      "<th class='matrix-score'>SCORE</th>"
    );
    rankingTable.append(rankingHead);
    const rankingBody = $("<tbody></tbody>");
    standings.slice(0, 50).forEach((standing, index) => {
      const row = $("<tr></tr>");
      row.append($("<td class='matrix-rank neo-bold'></td>").text(standing.pos || index + 1));
      const account = $("<td class='matrix-account'></td>");
      account.append($("<a></a>").attr("href", standing.account_url).text(standing.name));
      row.append(account);
      row.append($("<td class='matrix-score neo-bold'></td>").text(standing.score));
      rankingBody.append(row);
    });
    rankingTable.append(rankingBody);
    matrix.append(rankingTable);
    return;
  }

  const categories = new Map();
  challenges.forEach(challenge => {
    if (!categories.has(challenge.category)) categories.set(challenge.category, []);
    categories.get(challenge.category).push(challenge);
  });
  const orderedCategories = Array.from(categories.keys()).sort((a, b) => a.localeCompare(b));
  orderedCategories.forEach(category => {
    categories.get(category).sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name));
  });
  const orderedChallenges = orderedCategories.flatMap(category => categories.get(category));

  const detailByAccount = new Map();
  Object.values(details).forEach(detail => detailByAccount.set(String(detail.id), detail));
  const solveRanks = new Map();
  orderedChallenges.forEach(challenge => {
    const solves = [];
    detailByAccount.forEach((detail, accountId) => {
      const solve = (detail.solves || []).find(item => item.challenge_id === challenge.id);
      if (solve) solves.push({ accountId, date: new Date(solve.date) });
    });
    solves.sort((a, b) => a.date - b.date);
    solveRanks.set(challenge.id, new Map(solves.map((solve, index) => [solve.accountId, index])));
  });

  const tableElement = $("<table class='completion-matrix'></table>");
  const head = $("<thead></thead>");
  const categoryRow = $("<tr></tr>");
  const fixedHeaders = [
    ["#", "matrix-rank"],
    [CTFd.config.userMode === "teams" ? "TEAM" : "USER", "matrix-account"],
    ["SCORE", "matrix-score"]
  ];
  fixedHeaders.forEach(header => {
    categoryRow.append(
      $("<th rowspan='2' class='matrix-sticky'></th>").addClass(header[1]).text(header[0])
    );
  });
  orderedCategories.forEach(category => {
    categoryRow.append(
      $("<th class='matrix-category-header'></th>")
        .attr("colspan", categories.get(category).length)
        .css("background-color", categoryColor(category))
        .css("color", categoryTextColor(category))
        .text(category)
    );
  });

  const challengeRow = $("<tr></tr>");
  orderedChallenges.forEach(challenge => {
    const header = $("<th class='matrix-challenge-header'></th>")
      .css("background-color", categoryColor(challenge.category))
      .css("color", categoryTextColor(challenge.category))
      .attr("title", `${challenge.name} — ${challenge.value} points`);
    header.append($("<span class='matrix-challenge-name'></span>").text(challenge.name));
    header.append($("<span class='matrix-points'></span>").text(`${challenge.value} PTS`));
    challengeRow.append(header);
  });
  head.append(categoryRow, challengeRow);

  const body = $("<tbody></tbody>");
  standings.slice(0, 50).forEach((standing, index) => {
    const row = $("<tr></tr>");
    row.append($("<td class='matrix-rank matrix-sticky neo-bold'></td>").text(standing.pos || index + 1));
    const accountCell = $("<td class='matrix-account matrix-sticky'></td>");
    accountCell.append($("<a></a>").attr("href", standing.account_url).text(standing.name));
    row.append(accountCell);
    row.append($("<td class='matrix-score matrix-sticky neo-bold'></td>").text(standing.score));
    orderedChallenges.forEach(challenge => {
      const status = matrixStatus(standing.account_id, challenge.id, detailByAccount, solveRanks);
      row.append($("<td></td>").append(createStatusIndicator(status)));
    });
    body.append(row);
  });
  tableElement.append(head, body);
  matrix.append(tableElement);
};

const updateChallengeMatrix = () => {
  const challengeRequest = CTFd.user.id
    ? CTFd.api
        .get_challenge_list()
        .then(response => response)
        .catch(() => ({ data: [] }))
    : Promise.resolve({ data: [] });
  return Promise.all([
    challengeRequest,
    CTFd.api.get_scoreboard_list(),
    CTFd.api.get_scoreboard_detail({ count: 50 })
  ])
    .then(responses => {
      renderPodium(responses[1].data);
      renderChallengeMatrix(
        Array.isArray(responses[0].data) ? responses[0].data : [],
        Array.isArray(responses[1].data) ? responses[1].data : [],
        responses[2].data || {}
      );
    })
    .catch(error => {
      renderPodium([]);
      $("#challenge-matrix")
        .empty()
        .append(
          $("<div class='matrix-error'></div>")
            .append($("<p></p>").text((error && error.message) || "Completion data is currently unavailable."))
            .append("<button type='button' class='neo-button neo-button-primary neo-retry-button'>RETRY</button>")
        );
      $("#challenge-matrix .neo-retry-button").on("click", updateChallengeMatrix);
    });
};

const buildGraphData = () => {
  return CTFd.api.get_scoreboard_detail({ count: 10 }).then(response => {
    const places = response.data;

    const teams = Object.keys(places);
    if (teams.length === 0) {
      return false;
    }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const graphText = isDark ? "#f8fafc" : "#111111";
    const graphGrid = isDark ? "#374151" : "#d1d5db";
    const finalScores = teams.map(team => {
      const values = places[team].solves.map(solve => solve.value);
      const totals = cumulativeSum(values);
      return totals.length ? totals[totals.length - 1] : 0;
    });
    const leaderScore = Math.max(...finalScores);
    const latestPoints = [];
    const option = {
      backgroundColor: "transparent",
      animation: !reducedMotion,
      animationDuration: reducedMotion ? 0 : 850,
      animationEasing: "cubicOut",
      textStyle: { color: graphText, fontFamily: "Fredoka, Raleway, sans-serif" },
      title: {
        left: "center",
        text: "★  Top 10 " + (CTFd.config.userMode === "teams" ? "Teams" : "Users"),
        textStyle: { color: graphText, fontFamily: "Fredoka, DejaVu Sans, sans-serif" }
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#171c26" : "#ffffff",
        borderColor: isDark ? "#f8fafc" : "#111111",
        borderWidth: 3,
        padding: 12,
        textStyle: { color: graphText, fontFamily: "Fredoka, Raleway, sans-serif", fontWeight: 700 },
        extraCssText: "border-radius:0;box-shadow:5px 5px 0 rgba(0,0,0,.85);",
        axisPointer: {
          type: "cross"
        },
        formatter: params => {
          const points = params.filter(point => point.seriesType === "line");
          if (points.length === 0) return "";
          const timestamp = dayjs(points[0].value[0]).format("DD MMM YYYY, HH:mm:ss");
          const rows = points
            .map(point => `<div><strong>${htmlEntities(point.seriesName)}</strong>: ${point.value[1]} PTS</div>`)
            .join("");
          return `<div style="margin-bottom:6px;font-weight:900">${timestamp}</div>${rows}`;
        }
      },
      legend: {
        type: "scroll",
        orient: "horizontal",
        align: "left",
        bottom: 35,
        textStyle: { color: graphText },
        data: []
      },
      grid: {
        containLabel: true
      },
      xAxis: [
        {
          type: "time",
          boundaryGap: false,
          axisLabel: { color: graphText },
          axisLine: { lineStyle: { color: graphGrid } },
          data: []
        }
      ],
      yAxis: [
        {
          type: "value",
          axisLabel: { color: graphText },
          axisLine: { lineStyle: { color: graphGrid } },
          splitLine: { lineStyle: { color: graphGrid } }
        }
      ],
      series: []
    };

    for (let i = 0; i < teams.length; i++) {
      const team_score = [];
      const times = [];
      for (let j = 0; j < places[teams[i]]["solves"].length; j++) {
        team_score.push(places[teams[i]]["solves"][j].value);
        const date = dayjs(places[teams[i]]["solves"][j].date);
        times.push(date.toDate());
      }

      const total_scores = cumulativeSum(team_score);
      var scores = times.map(function(e, i) {
        return [e, total_scores[i]];
      });

      option.legend.data.push(places[teams[i]]["name"]);

      const color = colorHash(places[teams[i]]["name"] + places[teams[i]]["id"]);
      const isLeader = finalScores[i] === leaderScore;
      if (scores.length) {
        const latest = scores[scores.length - 1];
        scores[scores.length - 1] = {
          value: latest,
          symbolSize: isLeader ? 11 : 9,
          label: {
            show: true,
            position: "top",
            color: graphText,
            fontFamily: "Fredoka, Raleway, sans-serif",
            fontWeight: 900,
            formatter: `${latest[1]}`
          }
        };
        latestPoints.push({ value: latest, itemStyle: { color } });
      }

      const data = {
        name: places[teams[i]]["name"],
        type: "line",
        label: {
          normal: {
            position: "top"
          }
        },
        itemStyle: {
          normal: {
            color
          }
        },
        lineStyle: {
          width: isLeader ? 4 : 2,
          opacity: isLeader ? 1 : 0.72
        },
        emphasis: {
          focus: "series",
          lineStyle: { width: isLeader ? 5 : 4 }
        },
        z: isLeader ? 5 : 3,
        data: scores
      };
      option.series.push(data);
    }

    if (!reducedMotion && latestPoints.length) {
      option.series.push({
        name: "Latest scores",
        type: "effectScatter",
        coordinateSystem: "cartesian2d",
        data: latestPoints,
        symbolSize: 9,
        rippleEffect: { brushType: "stroke", scale: 2.2, period: 4 },
        tooltip: { show: false },
        silent: true,
        z: 2
      });
    }

    return option;
  });
};

const renderGraphError = error => {
  graph
    .empty()
    .append(
      $("<div class='text-center w-100'></div>")
        .append("<i class='fas fa-chart-line fa-2x mb-3' aria-hidden='true'></i>")
        .append("<h3 class='neo-bold'>SCORE GRAPH UNAVAILABLE</h3>")
        .append($("<p></p>").text((error && error.message) || "Unable to load scoreboard data."))
        .append("<button type='button' class='neo-button neo-button-primary neo-retry-button'>RETRY</button>")
    );
  graph.find(".neo-retry-button").on("click", createGraph);
};

const createGraph = () => {
  Promise.all([buildGraphData(), loadChartLibrary()]).then(([option, echarts]) => {
    if (option === false) {
      // Replace spinner
      graph.html(
        '<h3 class="opacity-50 text-center w-100 justify-content-center align-self-center">No solves yet</h3>'
      );
      return;
    }

    graph.empty(); // Remove spinners
    const graphElement = document.querySelector("#score-graph");
    graphElement.classList.add("scoreboard-graph-live");
    chart = echarts.getInstanceByDom(graphElement) || echarts.init(graphElement);
    chart.setOption(option);

    $(window).on("resize", function() {
      if (chart != null && chart != undefined) {
        chart.resize();
      }
    });
  }).catch(renderGraphError);
};

const updateGraph = () => {
  Promise.all([buildGraphData(), loadChartLibrary()]).then(([option, echarts]) => {
    if (option === false) {
      if (chart) {
        chart.dispose();
        chart = null;
      }
      graph.html('<h3 class="text-center w-100">No solves yet</h3>');
      return;
    }
    const graphElement = document.querySelector("#score-graph");
    chart = echarts.getInstanceByDom(graphElement) || echarts.init(graphElement);
    chart.setOption(option);
  }).catch(renderGraphError);
};

function update() {
  updateGraph();
  updateChallengeMatrix();
}

$(() => {
  setInterval(update, 300000); // Update scores every 5 minutes
  createGraph();
  updateChallengeMatrix();
  window.addEventListener("gematik-theme-changed", updateGraph);
});

window.updateScoreboard = update;
