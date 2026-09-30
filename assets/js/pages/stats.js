import "./main";
import $ from "jquery";
import CTFd from "../CTFd";
import { createGraph, updateGraph } from "../graphs";

const api_funcs = {
  team: [
    x => CTFd.api.get_team_solves({ teamId: x }),
    x => CTFd.api.get_team_fails({ teamId: x }),
    x => CTFd.api.get_team_awards({ teamId: x })
  ],
  user: [
    x => CTFd.api.get_user_solves({ userId: x }),
    x => CTFd.api.get_user_fails({ userId: x }),
    x => CTFd.api.get_user_awards({ userId: x })
  ]
};

const renderGraphMessage = (target, message, type = "empty") => {
  $(target)
    .empty()
    .append(
      $("<div class='stats-graph-message text-center w-100'></div>")
        .addClass(`stats-graph-${type}`)
        .append("<i class='fas fa-chart-bar fa-2x mb-3' aria-hidden='true'></i>")
        .append($("<strong class='d-block'></strong>").text(message))
    );
};

const renderStatsError = retry => {
  ["#score-graph", "#categories-pie-graph", "#keys-pie-graph"].forEach(target => {
    renderGraphMessage(target, "STATISTICS UNAVAILABLE", "error");
  });
  const target = $("#score-graph .stats-graph-message");
  target.append("<button type='button' class='neo-button neo-button-primary neo-retry-button'>RETRY</button>");
  target.find(".neo-retry-button").on("click", retry);
};

const renderProgressSummary = (solves, totalChallenges) => {
  const page = document.querySelector(".account-page");
  if (!page) return;
  document.querySelector(".account-progress-summary")?.remove();
  const categories = new Map();
  solves.forEach(solve => {
    const category = solve.challenge?.category || "General";
    categories.set(category, (categories.get(category) || 0) + 1);
  });
  const strongest = [...categories.entries()].sort((a, b) => b[1] - a[1])[0];
  const latest = solves
    .map(solve => solve.date)
    .filter(Boolean)
    .sort()
    .pop();
  const percent = totalChallenges ? Math.min(100, Math.round((solves.length / totalChallenges) * 100)) : 0;
  const summary = document.createElement("section");
  summary.className = "account-progress-summary";
  summary.innerHTML = `
    <div class="account-progress-heading"><i class="fas fa-chart-line" aria-hidden="true"></i><strong>PROGRESS</strong><span>${solves.length}/${totalChallenges}</span></div>
    <div class="account-progress-track"><span style="width:${percent}%"></span></div>
    <div class="account-progress-meta">
      <span><i class="fas fa-layer-group" aria-hidden="true"></i>${strongest ? `Strongest: ${strongest[0]} (${strongest[1]})` : "No strongest category yet"}</span>
      <span><i class="fas fa-clock" aria-hidden="true"></i>${latest ? `Last solve: ${window.dayjs(latest).format("DD MMM YYYY HH:mm")}` : "No solves yet"}</span>
    </div>`;
  page.prepend(summary);
};

const createGraphs = (type, id, name, account_id) => {
  let [solves_func, fails_func, awards_func] = api_funcs[type];

  Promise.all([
    solves_func(account_id),
    fails_func(account_id),
    awards_func(account_id),
    CTFd.api.get_challenge_list().catch(() => ({ data: [] }))
  ]).then(responses => {
    renderProgressSummary(responses[0].data, responses[3].data.length);
    createGraph(
      "score_graph",
      "#score-graph",
      responses,
      type,
      id,
      name,
      account_id
    );
    if (responses[0].data.length === 0) {
      renderGraphMessage("#categories-pie-graph", "NO CATEGORY DATA YET");
      renderGraphMessage("#keys-pie-graph", "NO SOLVE DATA YET");
    } else {
      createGraph("category_breakdown", "#categories-pie-graph", responses, type, id, name, account_id);
      createGraph("solve_percentages", "#keys-pie-graph", responses, type, id, name, account_id);
    }
  }).catch(() => renderStatsError(() => createGraphs(type, id, name, account_id)));
};

const updateGraphs = (type, id, name, account_id) => {
  let [solves_func, fails_func, awards_func] = api_funcs[type];

  Promise.all([
    solves_func(account_id),
    fails_func(account_id),
    awards_func(account_id)
  ]).then(responses => {
    updateGraph(
      "score_graph",
      "#score-graph",
      responses,
      type,
      id,
      name,
      account_id
    );
    if (responses[0].data.length === 0) {
      renderGraphMessage("#categories-pie-graph", "NO CATEGORY DATA YET");
      renderGraphMessage("#keys-pie-graph", "NO SOLVE DATA YET");
    } else {
      updateGraph("category_breakdown", "#categories-pie-graph", responses, type, id, name, account_id);
      updateGraph("solve_percentages", "#keys-pie-graph", responses, type, id, name, account_id);
    }
  }).catch(() => renderStatsError(() => updateGraphs(type, id, name, account_id)));
};

$(() => {
  let type, id, name, account_id;
  ({ type, id, name, account_id } = window.stats_data);

  createGraphs(type, id, name, account_id);
  window.addEventListener("gematik-theme-changed", () => {
    updateGraphs(type, id, name, account_id);
  });
  setInterval(() => {
    updateGraphs(type, id, name, account_id);
  }, 300000);
});
