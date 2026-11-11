import "./main";
import "bootstrap/js/dist/tab";
import { ezQuery, ezAlert } from "../ezq";
import { htmlEntities } from "../utils";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import $ from "jquery";
import CTFd from "../CTFd";
import config from "../config";
import hljs from "highlight.js";
import { Howl } from "howler";
import { getCategoryIcon } from "../components/category-icons";

dayjs.extend(relativeTime);

CTFd._internal.challenge = {};
let challenges = [];
let selectedCategory = "all";
let selectedStatus = "all";
let sortOrder = "default";
let searchQuery = "";
let lastChallengeTrigger = null;
const bookmarkKey = "gematik-challenge-bookmarks";
const recentActivityKey = "gematik-challenge-recent-activity";
const fingerprintKey = "ctfd_browser_fingerprint";

const readStoredArray = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
};

let bookmarkedChallenges = new Set(readStoredArray(bookmarkKey).map(String));

const getBrowserFingerprint = () => {
  let fingerprint = localStorage.getItem(fingerprintKey);
  if (fingerprint) return fingerprint;
  fingerprint = window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(fingerprintKey, fingerprint);
  return fingerprint;
};

const submitChallengeAttempt = () => {
  const challengeId = $("#challenge-id").val();
  const submission = $("#challenge-input").val();
  const aiSources = $(".ctfdpp-ai-source")
    .map(function() {
      return $(this).val();
    })
    .get()
    .filter(source => String(source).trim() !== "");
  const solverFiles = $("#solver-files")[0]?.files || [];
  const hasMetadata = aiSources.length > 0 || solverFiles.length > 0;

  if (!hasMetadata) {
    return CTFd._internal.challenge.submit();
  }

  const path = CTFd.config.preview === true
    ? "/api/v1/challenges/attempt?preview=true"
    : "/api/v1/challenges/attempt";
  const body = new FormData();
  body.append("challenge_id", challengeId);
  body.append("submission", submission);
  body.append("nonce", CTFd.config.csrfNonce);
  body.append("browser_fingerprint", getBrowserFingerprint());
  aiSources.forEach(source => body.append("ai_source", source));
  Array.from(solverFiles).forEach(file => body.append("solver", file));

  return window.fetch(`${CTFd.config.urlRoot}${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "CSRF-Token": CTFd.config.csrfNonce
    },
    body
  }).then(response => response.json());
};

const addAiSourceField = value => {
  const list = $("#ctfdpp-ai-sources");
  const index = list.children(".ctfdpp-ai-source-row").length;
  const row = $("<div class='ctfdpp-ai-source-row'></div>");
  const input = $("<input class='neo-input ctfdpp-ai-source w-100' type='url' name='ai_source'>")
    .attr("id", `ai-source-${index}`)
    .attr("placeholder", "https://chat.openai.com/share/...")
    .val(value || "");
  const remove = $("<button type='button' class='neo-icon-button' title='Remove AI source' aria-label='Remove AI source'></button>")
    .append("<i class='fas fa-times' aria-hidden='true'></i>")
    .on("click", () => {
      row.remove();
      if (!list.children(".ctfdpp-ai-source-row").length) addAiSourceField();
    });
  row.append(input, remove);
  list.append(row);
};

const recordChallengeActivity = (challenge, action) => {
  if (!challenge) return;
  const activity = readStoredArray(recentActivityKey)
    .filter(item => String(item.id) !== String(challenge.id));
  activity.unshift({
    id: challenge.id,
    name: challenge.name,
    category: challenge.category || "General",
    action,
    timestamp: Date.now()
  });
  localStorage.setItem(recentActivityKey, JSON.stringify(activity.slice(0, 5)));
  renderRecentActivity();
};

const renderRecentActivity = () => {
  const panel = $("#challenge-recent");
  const list = $("#challenge-recent-list").empty();
  if (!panel.length) return;
  const activity = readStoredArray(recentActivityKey)
    .filter(item => challenges.some(challenge => String(challenge.id) === String(item.id)))
    .slice(0, 4);
  panel.prop("hidden", activity.length === 0);
  activity.forEach(item => {
    const button = $("<button type='button' class='challenge-recent-item'></button>");
    button.append($("<i class='fas challenge-category-icon' aria-hidden='true'></i>").addClass(getCategoryIcon(item.category)));
    button.append($("<span class='challenge-recent-name'></span>").text(item.name));
    button.append($("<small></small>").text(item.action));
    button.on("click", () => loadChal(item.id));
    list.append(button);
  });
};

const toggleChallengeBookmark = challenge => {
  const id = String(challenge.id);
  const isBookmarked = bookmarkedChallenges.has(id);
  isBookmarked ? bookmarkedChallenges.delete(id) : bookmarkedChallenges.add(id);
  localStorage.setItem(bookmarkKey, JSON.stringify(Array.from(bookmarkedChallenges)));
  $(".challenge-bookmark").filter(function() {
    return String($(this).data("challengeId")) === id;
  })
    .toggleClass("active", !isBookmarked)
    .attr("aria-pressed", !isBookmarked ? "true" : "false");
  recordChallengeActivity(challenge, isBookmarked ? "BOOKMARK REMOVED" : "BOOKMARKED");
};

const correctAnswerSound = new Howl({
  src: [new URL("../../music/tbeb-correct-answer.mp3", import.meta.url).href],
  format: ["mp3"],
  volume: 0.8
});
const incorrectAnswerSound = new Howl({
  src: [new URL("../../music/zzzzzzzzzz-incorrect.mp3", import.meta.url).href],
  format: ["mp3"],
  volume: 0.8
});
const alreadySolvedSound = new Howl({
  src: [new URL("../../music/dj-stop.mp3", import.meta.url).href],
  format: ["mp3"],
  volume: 0.8
});
const firstBloodSound = new Howl({
  src: [new URL("../../music/first-blood_TJM7IEK.mp3", import.meta.url).href],
  format: ["mp3"],
  volume: 0.9
});
const submissionSounds = [correctAnswerSound, incorrectAnswerSound, alreadySolvedSound, firstBloodSound];

function playSubmissionSound(sound) {
  submissionSounds.forEach(effect => {
    try { effect.stop(); } catch (_) {}
  });
  if (localStorage.getItem("gematik-effects-muted") !== "true") {
    try {
      if (typeof Howler !== "undefined" && Howler.ctx && Howler.ctx.state === "suspended") {
        Howler.ctx.resume();
      }
      sound.play();
    } catch (e) {
      console.warn("Submission sound error:", e);
    }
  }
}

function applyChallengeFilters() {
  let totalVisible = 0;

  $("#challenges-board > [data-category]").each(function() {
    const category = String($(this).data("category"));
    const categoryMatches = selectedCategory === "all" || category === selectedCategory;
    let visibleChallenges = 0;
    const row = $(this).find(".challenges-row");
    const cards = row.find(".challenge-card-wrapper").get();

    cards.sort((first, second) => {
      const a = first.dataset;
      const b = second.dataset;
      switch (sortOrder) {
        case "points-asc": return Number(a.value) - Number(b.value);
        case "points-desc": return Number(b.value) - Number(a.value);
        case "solves-desc": return Number(b.solves) - Number(a.solves);
        case "solves-asc": return Number(a.solves) - Number(b.solves);
        default: return Number(a.order) - Number(b.order);
      }
    });
    row.append(cards);

    $(this).find(".challenge-card-wrapper").each(function() {
      const name = $(this).find(".chal-name").text().toLowerCase();
      const isSolved = String($(this).data("solved")) === "true";
      const statusMatches =
        selectedStatus === "all" ||
        (selectedStatus === "solved" && isSolved) ||
        (selectedStatus === "unsolved" && !isSolved);
      const isVisible = categoryMatches && statusMatches && name.includes(searchQuery);
      $(this).toggle(isVisible);
      if (isVisible) visibleChallenges++;
    });

    totalVisible += visibleChallenges;
    $(this).toggle(categoryMatches && visibleChallenges > 0);
  });

  const categoryRows = $("#challenges-board > [data-category]").get();
  const categoryMetric = row => {
    const visibleCards = $(row)
      .find(".challenge-card-wrapper")
      .get()
      .filter(card => card.style.display !== "none");

    if (visibleCards.length === 0) return null;
    const field = sortOrder.startsWith("points") ? "value" : "solves";
    const values = visibleCards.map(card => Number(card.dataset[field]));
    return sortOrder.endsWith("asc") ? Math.min(...values) : Math.max(...values);
  };

  categoryRows.sort((first, second) => {
    if (sortOrder === "default") {
      return Number(first.dataset.order) - Number(second.dataset.order);
    }

    const a = categoryMetric(first);
    const b = categoryMetric(second);
    if (a === null) return 1;
    if (b === null) return -1;
    const direction = sortOrder.endsWith("asc") ? 1 : -1;
    return (a - b) * direction || Number(first.dataset.order) - Number(second.dataset.order);
  });
  $("#challenges-board").append(categoryRows);

  $("#challenge-filter-empty").prop("hidden", totalVisible > 0 || challenges.length === 0);
  $("#challenge-filter-reset").prop(
    "hidden",
    selectedCategory === "all" && selectedStatus === "all" && sortOrder === "default" && !searchQuery
  );
}

function renderStatusFilters() {
  const solved = challenges.filter(challenge => Boolean(challenge.solved_by_me)).length;
  const choices = [
    { name: "ALL", count: challenges.length, value: "all" },
    { name: "UNSOLVED", count: challenges.length - solved, value: "unsolved" },
    { name: "SOLVED", count: solved, value: "solved" }
  ];
  const filter = $("#challenge-status-filter").empty();

  choices.forEach(choice => {
    const button = $("<button type='button' class='category-filter-button'></button>");
    button.toggleClass("active", choice.value === selectedStatus);
    button.attr("data-status", choice.value);
    button.attr("aria-pressed", choice.value === selectedStatus ? "true" : "false");
    button.append($("<span></span>").text(choice.name));
    button.append($("<span class='category-count'></span>").text(choice.count));
    button.on("click", () => {
      selectedStatus = choice.value;
      filter.find(".category-filter-button").removeClass("active").attr("aria-pressed", "false");
      button.addClass("active").attr("aria-pressed", "true");
      applyChallengeFilters();
    });
    filter.append(button);
  });
}

function renderCategoryFilters(categories) {
  const filter = $("#challenge-category-filter");
  filter.empty();

  const choices = [{ name: "ALL CATEGORIES", count: categories.length, value: "all" }];
  categories.forEach(category => {
    choices.push({
      name: category,
      count: challenges.filter(challenge => challenge.category === category).length,
      value: category
    });
  });

  choices.forEach(choice => {
    const option = $("<button type='button' class='dropdown-item'></button>")
      .attr("data-category", choice.value)
      .toggleClass("active", choice.value === selectedCategory);
    option.append(
      $("<i class='fas challenge-category-icon' aria-hidden='true'></i>")
        .addClass(getCategoryIcon(choice.value))
    );
    option.append($("<span></span>").text(`${choice.name} (${choice.count})`));
    option.on("click", () => {
      selectedCategory = choice.value;
      updateCategoryControl();
      applyChallengeFilters();
    });
    filter.append(option);
  });
  updateCategoryControl();
}

function updateCategoryControl() {
  const active = $("#challenge-category-filter [data-category]").filter(function() {
    return String($(this).data("category")) === selectedCategory;
  }).first();
  $("#challenge-category-filter .dropdown-item").removeClass("active");
  active.addClass("active");
  $("#challenge-category-label").text(active.text() || "ALL CATEGORIES");
}

function updateSortControl() {
  const active = $(`#challenge-sort [data-sort="${sortOrder}"]`);
  $("#challenge-sort .dropdown-item").removeClass("active");
  active.addClass("active");
  $("#challenge-sort-label").text(active.text() || "DEFAULT");
}

const loadChal = id => {
  const chal = $.grep(challenges, chal => chal.id == id)[0];

  if (!chal) {
    return;
  }

  if (chal.type === "hidden") {
    ezAlert({
      title: "Challenge Hidden!",
      body: "You haven't unlocked this challenge yet!",
      button: "Got it!"
    });
    return;
  }

  displayChal(chal);
};

const loadChalByName = name => {
  let idx = name.lastIndexOf("-");
  let pieces = [name.slice(0, idx), name.slice(idx + 1)];
  let id = pieces[1];

  const chal = $.grep(challenges, chal => chal.id == id)[0];
  if (chal) {
    displayChal(chal);
  }
};

const displayChal = chal => {
  const trigger = $(".challenge-button").filter(function() { return String(this.value) === String(chal.id); });
  return Promise.all([
    CTFd.api.get_challenge({ challengeId: chal.id }),
    $.getScript(config.urlRoot + chal.script),
    $.get(config.urlRoot + chal.template)
  ]).then(responses => {
    const challenge = CTFd._internal.challenge;

    $("#challenge-window").empty();

    // Inject challenge data into the plugin
    challenge.data = responses[0].data;
    recordChallengeActivity(chal, "VIEWED");

    // Call preRender function in plugin
    if (typeof challenge.preRender === "function") {
      challenge.preRender();
    }

    // Build HTML from the Jinja response in API
    $("#challenge-window").append(responses[0].data.view);

    const challengeContext = $(".challenge-context-row");
    const category = challenge.data.category || "General";
    challengeContext.append(
      $("<span class='neo-badge neo-badge-blue'></span>")
        .append($("<i class='fas mr-2' aria-hidden='true'></i>").addClass(getCategoryIcon(category)))
        .append(document.createTextNode(category))
    );
    if (challenge.data.solved_by_me) {
      challengeContext.append('<span class="neo-badge neo-badge-green"><i class="fas fa-check mr-2" aria-hidden="true"></i>SOLVED</span>');
    }
    challengeContext.append(
      `<span class="neo-badge neo-badge-yellow"><i class="fas fa-medal mr-2" aria-hidden="true"></i>${Number(challenge.data.solves || 0) === 0 ? "FIRST BLOOD OPEN" : "FIRST BLOOD CLAIMED"}</span>`
    );

    $("#challenge-window #challenge-input").addClass("form-control");
    $("#challenge-window #challenge-submit").addClass(
      "btn btn-md btn-outline-secondary float-right"
    );

    let modal = $("#challenge-window").find(".modal-dialog");
    if (
      window.init.theme_settings &&
      window.init.theme_settings.challenge_window_size
    ) {
      switch (window.init.theme_settings.challenge_window_size) {
        case "sm":
          modal.addClass("modal-sm");
          break;
        case "lg":
          modal.addClass("modal-lg");
          break;
        case "xl":
          modal.addClass("modal-xl");
          break;
        default:
          break;
      }
    }

    $(".challenge-solves").off("click").on("click", function(_event) {
      getSolves($("#challenge-id").val());
    });
    $(".challenge-submissions").off("click").on("click", function(_event) {
      getSelfSubmissions($("#challenge-id").val());
    });
    $(".nav-tabs a").off("click.challengeTab").on("click.challengeTab", function(event) {
      event.preventDefault();
      $(this).tab("show");
    });

    $(".load-hint").off("click").on("click", function(_event) {
      loadHint($(this).data("hint-id"));
    });

    $("#ctfdpp-add-ai-source").off("click").on("click", () => addAiSourceField());
    if ($("#ctfdpp-ai-sources").length) addAiSourceField();

    $("#challenge-submit").off("click").on("click", function(event) {
      event.preventDefault();
      $("#challenge-submit").addClass("disabled-button");
      $("#challenge-submit").prop("disabled", true);
      submitChallengeAttempt()
        .then(renderSubmissionResponse)
        .then(loadChals)
        .then(markSolves)
        .catch(renderRequestError)
        .then(enableSubmit);
    });

    $("#challenge-input").off("keyup").on("keyup", event => {
      if (event.keyCode == 13) {
        $("#challenge-submit").click();
      }
    });

    if (typeof challenge.postRender === "function") {
      challenge.postRender();
    }

    $("#challenge-window")
      .find("pre code")
      .each(function(_idx) {
        hljs.highlightBlock(this);
      });

    window.location.replace(
      window.location.href.split("#")[0] + `#${chal.name}-${chal.id}`
    );
    if ($("#challenge-window").parent()[0] !== document.body) {
      $("#challenge-window").appendTo("body");
    }
    $("#challenge-window").scrollTop(0);
    $("#challenge-window .modal-body").scrollTop(0);
    $("#challenge-window").modal("show");
  }).catch(() => {
    if (window.neoToast) window.neoToast("Unable to load challenge. Please try again.", "error");
  });
};

function enableSubmit() {
  $("#challenge-submit").removeClass("disabled-button").prop("disabled", false);
}

function renderRequestError(error) {
  const message =
    (error && error.message) || "Unable to contact the server. Please try again.";
  $("#result-message").text(message);
  $("#result-notification")
    .removeClass()
    .addClass("alert alert-danger alert-dismissable text-center w-100 neo-bold")
    .show();
}

function renderSubmissionResponse(response) {
  const result = response.data;
  if (!result) {
    renderRequestError(new Error("The server returned an unexpected response. Please retry."));
    enableSubmit();
    return;
  }
  if (result.status === "invalid") {
    renderRequestError(new Error(result.message));
    const metadataInput = /AI Source/i.test(result.message)
      ? $(".ctfdpp-ai-source").first()
      : $("#solver-files");
    metadataInput.trigger("focus");
    enableSubmit();
    return;
  }

  const result_message = $("#result-message");
  const result_notification = $("#result-notification");
  const answer_input = $("#challenge-input");
  result_notification.removeClass();
  result_message.text(result.message);
  if (window.neoToast) {
    const toastType = result.status === "correct" ? "success" : result.status === "incorrect" ? "error" : "info";
    window.neoToast(result.message, toastType);
  }

  const next_btn = $(
    `<div class='col-md-12 pb-3'><button class='btn btn-info w-100'>Next Challenge</button></div>`
  ).click(function() {
    $("#challenge-window").modal("toggle");
    setTimeout(function() {
      loadChal(CTFd._internal.challenge.data.next_id);
    }, 500);
  });

  if (result.status === "authentication_required") {
    window.location =
      CTFd.config.urlRoot +
      "/login?next=" +
      CTFd.config.urlRoot +
      window.location.pathname +
      window.location.hash;
    return;
  } else if (result.status === "incorrect") {
    // Incorrect key
    playSubmissionSound(incorrectAnswerSound);
    result_notification.addClass(
      "alert alert-danger alert-dismissable text-center"
    );
    result_notification.slideDown();

    answer_input.removeClass("correct");
    answer_input.addClass("wrong");
    setTimeout(function() {
      answer_input.removeClass("wrong");
    }, 3000);
  } else if (result.status === "correct") {
    // Challenge Solved
    const isFirstBlood = Number(CTFd._internal.challenge.data.solves || 0) === 0;
    if (isFirstBlood) {
      localStorage.setItem("gematik-last-fb-sound", String(Date.now()));
      playSubmissionSound(firstBloodSound);
    } else {
      playSubmissionSound(correctAnswerSound);
    }
    recordChallengeActivity(CTFd._internal.challenge.data, "SOLVED");
    result_notification.addClass(
      "alert alert-success alert-dismissable text-center"
    );
    result_notification.slideDown();

    if (
      $(".challenge-solves")
        .text()
        .trim()
    ) {
      // Only try to increment solves if the text isn't hidden
      $(".challenge-solves").text(
        parseInt(
          $(".challenge-solves")
            .text()
            .split(" ")[0]
        ) +
          1 +
          " Solves"
      );
    }

    answer_input.val("");
    $(".ctfdpp-ai-source").val("");
    $("#solver-files").val("");
    answer_input.removeClass("wrong");
    answer_input.addClass("correct");

    if (CTFd._internal.challenge.data.next_id) {
      $(".submit-row").html(next_btn);
    }
  } else if (result.status === "already_solved") {
    // Challenge already solved
    playSubmissionSound(alreadySolvedSound);
    result_notification.addClass(
      "alert alert-info alert-dismissable text-center"
    );
    result_notification.slideDown();

    answer_input.addClass("correct");

    if (CTFd._internal.challenge.data.next_id) {
      $(".submit-row").html(next_btn);
    }
  } else if (result.status === "paused") {
    // CTF is paused
    result_notification.addClass(
      "alert alert-warning alert-dismissable text-center"
    );
    result_notification.slideDown();
  } else if (result.status === "ratelimited") {
    // Keys per minute too high
    result_notification.addClass(
      "alert alert-warning alert-dismissable text-center"
    );
    result_notification.slideDown();

    answer_input.addClass("too-fast");
    setTimeout(function() {
      answer_input.removeClass("too-fast");
    }, 3000);
  }
  setTimeout(function() {
    $(".alert").slideUp();
    enableSubmit();
  }, 3000);
}

function markSolves() {
  challenges.forEach(challenge => {
    if (challenge.solved_by_me) {
      const btn = $(`button[value="${challenge.id}"]`);
      btn.addClass("solved-challenge");
      btn.attr("aria-label", `${challenge.name} (solved)`);
      if (btn.find(".corner-button-check").length === 0) {
        btn.prepend("<i class='fas fa-check corner-button-check' aria-hidden='true'></i>");
      }
    }
  });
}

function getSolves(id) {
  const box = $("#challenge-solves-names");
  const current = () => box[0] === document.getElementById("challenge-solves-names") && String($("#challenge-id").val()) === String(id);
  const showState = message => box.empty().append(
    $("<tr></tr>").append($("<td colspan='2' role='status'></td>").text(message))
  );
  showState("Loading solves...");
  return CTFd.api.get_challenge_solves({ challengeId: id }).then(response => {
    if (!current()) return;
    if (response.success === false || !Array.isArray(response.data)) {
      throw new Error("Unable to load solves");
    }
    const data = response.data;
    $(".challenge-solves").html(
      `<i class="fas fa-check-circle mr-2" aria-hidden="true"></i>${data.length} ${data.length === 1 ? "Solve" : "Solves"}`
    );
    if (!data.length) {
      showState("No solves to display yet.");
      return;
    }
    box.empty();
    data.forEach(solve => {
      const account = $("<td></td>");
      const url = new URL(solve.account_url, window.location.href);
      if (url.origin === window.location.origin && /^https?:$/.test(url.protocol)) {
        account.append($("<a></a>").attr("href", url.href).text(solve.name));
      } else {
        account.text(solve.name);
      }
      const date = dayjs(solve.date);
      box.append($("<tr></tr>").append(
        account,
        $("<td></td>").text(date.isValid() ? date.fromNow() : "Unknown date")
      ));
    });
  }).catch(() => {
    if (!current()) return;
    showState("Could not load solves. ");
    box.find("td").append(
      $("<button type='button' class='neo-button neo-button-secondary'>Retry</button>")
        .on("click", () => getSolves(id))
    );
  });
}

function getSelfSubmissions(id) {
  const state = $(".challenge-submissions-state");
  const table = $("#submissions .table-responsive");
  const list = $("#challenge-submissions-list");
  state.html('<i class="fas fa-circle-notch fa-spin mr-2" aria-hidden="true"></i>LOADING SUBMISSIONS...').show();
  table.prop("hidden", true);

  return CTFd.fetch(
    `/api/v1/users/me/submissions?challenge_id=${encodeURIComponent(id)}`,
    { method: "GET", credentials: "same-origin" }
  )
    .then(response => response.json())
    .then(response => {
      if (!response.success) throw new Error("Unable to load submissions");
      list.empty();
      response.data.forEach(submission => {
        const isCorrect = submission.type === "correct";
        const result = isCorrect ? "CORRECT" : "INCORRECT";
        const resultClass = isCorrect ? "submission-correct" : "submission-incorrect";
        const provided = String(submission.provided || "");
        const row = $("<tr>");
        const status = $("<td>").append(
          $("<span>", { class: resultClass })
            .append($("<i>", { class: `fas ${isCorrect ? "fa-check-circle" : "fa-times-circle"} mr-2`, "aria-hidden": "true" }))
            .append(document.createTextNode(result))
        );
        const value = $("<code>", { class: "submission-value", text: "Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢" });
        const reveal = $("<button>", {
          type: "button",
          class: "submission-action",
          title: "Show submission",
          "aria-label": "Show submission",
          "aria-pressed": "false"
        }).append('<i class="fas fa-eye" aria-hidden="true"></i>');
        const copy = $("<button>", {
          type: "button",
          class: "submission-action",
          title: "Copy submission",
          "aria-label": "Copy submission"
        }).append('<i class="fas fa-copy" aria-hidden="true"></i>');

        reveal.on("click", function() {
          const isVisible = $(this).attr("aria-pressed") === "true";
          value.text(isVisible ? "Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢" : provided);
          $(this)
            .attr("aria-pressed", String(!isVisible))
            .attr("aria-label", isVisible ? "Show submission" : "Hide submission")
            .attr("title", isVisible ? "Show submission" : "Hide submission")
            .find("i")
            .toggleClass("fa-eye", isVisible)
            .toggleClass("fa-eye-slash", !isVisible);
        });

        copy.on("click", async function() {
          try {
            await navigator.clipboard.writeText(provided);
            if (window.neoToast) window.neoToast("Submission copied", "success");
            $(this).addClass("copied").attr("title", "Copied").attr("aria-label", "Copied");
            window.setTimeout(() => {
              $(this).removeClass("copied").attr("title", "Copy submission").attr("aria-label", "Copy submission");
            }, 1500);
          } catch (_error) {
            const helper = $("<textarea>").val(provided).appendTo(document.body).select();
            document.execCommand("copy");
            helper.remove();
            if (window.neoToast) window.neoToast("Submission copied", "success");
          }
        });

        const actions = $("<span>", { class: "submission-actions" }).append(reveal, copy);
        const submissionCell = $("<td>", { class: "submission-value-cell" })
          .append($("<div>", { class: "submission-value-wrap" }).append(value, actions));
        row.append(status, submissionCell, $("<td>", { text: dayjs(submission.date).fromNow() }));
        list.append(row);
      });
      state.toggle(response.data.length === 0).text("NO SUBMISSIONS YET");
      table.prop("hidden", response.data.length === 0);
    })
    .catch(() => {
      state.html('<i class="fas fa-exclamation-triangle mr-2" aria-hidden="true"></i>UNABLE TO LOAD SUBMISSIONS').show();
    });
}

function loadChals() {
  return CTFd.api.get_challenge_list().then(function(response) {
    const categories = [];
    const $challenges_board = $("#challenges-board");
    challenges = response.data;

    if (window.BETA_sortChallenges) {
      challenges = window.BETA_sortChallenges(challenges);
    }

    $challenges_board.empty();

    if (challenges.length === 0) {
      $("#challenge-category-filter").empty();
      $challenges_board.append(
        '<div class="neo-card utility-empty-state text-center my-5 py-5">' +
          '<i class="fas fa-flag fa-3x mb-3" aria-hidden="true"></i>' +
          '<h3 class="neo-bold mb-3">NO CHALLENGES AVAILABLE YET</h3>' +
          '<p class="mb-0">Challenges will appear here once they are published.</p>' +
        '</div>'
      );
      return;
    }

    for (let i = challenges.length - 1; i >= 0; i--) {
      if ($.inArray(challenges[i].category, categories) == -1) {
        const category = challenges[i].category;
        categories.push(category);

        const categoryid = category.replace(/ /g, "-").hashCode();
        const categoryrow = $(
          "" +
            '<div id="{0}-row" class="pt-4 mb-3">'.format(categoryid) +
            '<div class="category-header col-md-12 mb-3" style="border-bottom: 4px solid var(--neo-outline); padding-bottom: 10px;">' +
            "</div>" +
            '<div class="category-challenges col-md-12">' +
            '<div class="challenges-row row"></div>' +
            "</div>" +
            "</div>"
        );
        categoryrow.attr("data-category", category);
        categoryrow.attr("data-order", categories.length - 1);
        const categoryHeading = $('<h2 class="neo-bold m-0 text-uppercase"></h2>');
        categoryHeading.append(
          $("<i class='fas challenge-category-icon' aria-hidden='true'></i>")
            .addClass(getCategoryIcon(category))
        );
        categoryHeading.append($("<span></span>").text(category));
        categoryrow.find(".category-header").append(categoryHeading);

        $challenges_board.append(categoryrow);
      }
    }

    for (let i = 0; i <= challenges.length - 1; i++) {
      const chalinfo = challenges[i];
      const chalid = chalinfo.name.replace(/ /g, "-").hashCode();
      const catid = chalinfo.category.replace(/ /g, "-").hashCode();
      const chalwrap = $(
        "<div id='{0}' class='challenge-card-wrapper col-sm-6 col-md-4 col-lg-3 mb-3'></div>".format(chalid)
      );
      chalwrap.attr({
        "data-challenge-id": chalinfo.id,
        "data-solved": Boolean(chalinfo.solved_by_me),
        "data-value": Number(chalinfo.value) || 0,
        "data-solves": Number(chalinfo.solves) || 0,
        "data-order": i
      });
      let chalbutton;

      const isSolved = Boolean(chalinfo.solved_by_me);
      const solvedClass = isSolved ? " solved-challenge" : "";

      chalbutton = $(
        "<button type='button' class='neo-button w-100 text-left d-flex flex-column align-items-start justify-content-between p-4 challenge-button" + solvedClass + "' style='height: 100%; border-width: 4px; box-shadow: 4px 4px 0 var(--neo-shadow-color);' value='{0}'></button>".format(
          chalinfo.id
        )
      );

      chalbutton.attr(
        "aria-label",
        `${chalinfo.name}, ${chalinfo.value} points, ${chalinfo.solves || 0} solves${isSolved ? ", solved" : ""}`
      );

      const chalheader = $("<div class='chal-name neo-bold w-100'>{0}</div>".format(chalinfo.name));
      const chalmeta = $("<div class='challenge-meta w-100'></div>");
      chalmeta.append($("<span class='challenge-solves-count'></span>").text(`${chalinfo.solves || 0} SOLVES`));
      chalmeta.append(
        $("<span class='challenge-first-blood'></span>")
          .addClass(Number(chalinfo.solves || 0) === 0 ? "open" : "claimed")
          .text(Number(chalinfo.solves || 0) === 0 ? "FIRST BLOOD OPEN" : "FIRST BLOOD CLAIMED")
      );
      const chalscore = $("<div class='challenge-score mt-auto neo-bold w-100 d-flex justify-content-between align-items-center'><span>{0}</span> <span class='badge'>PTS</span></div>".format(chalinfo.value));
      for (let j = 0; j < chalinfo.tags.length; j++) {
        const tag = "tag-" + chalinfo.tags[j].value.replace(/ /g, "-");
        chalwrap.addClass(tag);
      }

      chalbutton.append(chalheader);
      chalbutton.append(chalmeta);
      chalbutton.append(chalscore);
      chalwrap.append(chalbutton);
      const bookmarkButton = $("<button type='button' class='challenge-bookmark'></button>")
        .attr("data-challenge-id", chalinfo.id)
        .toggleClass("active", bookmarkedChallenges.has(String(chalinfo.id)))
        .attr("aria-pressed", bookmarkedChallenges.has(String(chalinfo.id)) ? "true" : "false")
        .attr("aria-label", `Bookmark ${chalinfo.name}`)
        .attr("title", "Save challenge")
        .append("<i class='fas fa-star' aria-hidden='true'></i>")
        .on("click", event => {
          event.preventDefault();
          event.stopPropagation();
          toggleChallengeBookmark(chalinfo);
        });
      chalwrap.append(bookmarkButton);

      $("#" + catid + "-row")
        .find(".category-challenges > .challenges-row")
        .append(chalwrap);
    }

    $(".challenge-button").off("click").on("click", function(_event) {
      lastChallengeTrigger = this;
      loadChal(this.value);
    });

    renderCategoryFilters(categories);
    renderStatusFilters();
    renderRecentActivity();
    applyChallengeFilters();
  }).catch(error => {
    const message = (error && error.message) || "Unable to load challenges.";
    $("#challenges-board")
      .empty()
      .append(
        $("<div class='neo-card utility-empty-state text-center my-5 py-5'></div>")
          .append("<i class='fas fa-wifi fa-3x mb-3' aria-hidden='true'></i>")
          .append("<h3 class='neo-bold mb-2'>CHALLENGES UNAVAILABLE</h3>")
          .append($("<p></p>").text(message))
          .append("<button type='button' class='neo-button neo-button-primary neo-retry-button'>RETRY</button>")
      );
    $("#challenges-board .neo-retry-button").on("click", () => update().catch(() => {}));
    throw error;
  });
}

function update() {
  return loadChals().then(markSolves);
}

$(() => {
  const challengeWindow = $("#challenge-window");
  $("#challenge-filter-mobile-toggle").on("click", function() {
    const panel = $("#challenge-filter-mobile-panel");
    const isOpen = panel.toggleClass("mobile-open").hasClass("mobile-open");
    $(this).attr("aria-expanded", String(isOpen));
  });

  $("#challenge-recent-clear").on("click", function() {
    localStorage.removeItem(recentActivityKey);
    localStorage.removeItem(bookmarkKey);
    bookmarkedChallenges.clear();
    $(".challenge-bookmark")
      .removeClass("active")
      .attr("aria-pressed", "false");
    renderRecentActivity();
    if (window.neoToast) window.neoToast("Recent activity and bookmarks cleared", "success");
  });

  // The challenge body is replaced after every API request. Delegate the close
  // action to the persistent modal root so the control never loses its handler.
  challengeWindow
    .off("click.neoChallengeClose")
    .on("click.neoChallengeClose", "[data-dismiss='modal']", function(event) {
      event.preventDefault();
      challengeWindow.modal("hide");
    });

  $("#challenge-search").on("input", function() {
    searchQuery = String($(this).val()).trim().toLowerCase();
    applyChallengeFilters();
  });

  $("#challenge-sort").on("click", "[data-sort]", function() {
    sortOrder = String($(this).data("sort"));
    updateSortControl();
    applyChallengeFilters();
  });

  $("#challenge-filter-reset").on("click", function() {
    selectedCategory = "all";
    selectedStatus = "all";
    sortOrder = "default";
    searchQuery = "";
    $("#challenge-search").val("");
    $("#challenge-status-filter .category-filter-button")
      .removeClass("active")
      .attr("aria-pressed", "false");
    $("#challenge-status-filter [data-status='all']")
      .addClass("active")
      .attr("aria-pressed", "true");
    updateCategoryControl();
    updateSortControl();
    applyChallengeFilters();
  });

  update()
    .then(() => {
      if (window.location.hash.length > 0) {
        loadChalByName(decodeURIComponent(window.location.hash.substring(1)));
      }
    })
    .catch(() => {});

  document.addEventListener("keydown", event => {
    const target = event.target;
    const isEditing = target && (target.matches("input, textarea, select") || target.isContentEditable);
    if (event.key === "/" && !isEditing) {
      event.preventDefault();
      $("#challenge-search").trigger("focus");
      return;
    }
    if (event.key === "Escape" && challengeWindow.hasClass("show")) {
      challengeWindow.modal("hide");
      return;
    }
    if (isEditing || !challengeWindow.hasClass("show")) return;
    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleChallengeBookmark(CTFd._internal.challenge.data);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const visible = $(".challenge-card-wrapper:visible .challenge-button").get();
    if (!visible.length) return;
    const activeId = String(CTFd._internal.challenge.data.id);
    const activeIndex = visible.findIndex(button => String(button.value) === activeId);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (Math.max(activeIndex, 0) + direction + visible.length) % visible.length;
    event.preventDefault();
    loadChal(visible[nextIndex].value);
  });

  $("#challenge-input").keyup(function(event) {
    if (event.keyCode == 13) {
      $("#challenge-submit").click();
    }
  });

  $(".nav-tabs a").click(function(event) {
    event.preventDefault();
    $(this).tab("show");
  });

  challengeWindow.on("hidden.bs.modal", function(_event) {
    $(".nav-tabs a:first").tab("show");
    history.replaceState("", window.document.title, window.location.pathname);
    if (lastChallengeTrigger && document.body.contains(lastChallengeTrigger)) {
      lastChallengeTrigger.focus();
    }
  });

  $(".challenge-solves").click(function(_event) {
    getSolves($("#challenge-id").val());
  });

  challengeWindow.on("hide.bs.modal", function(_event) {
    $("#challenge-input").removeClass("wrong");
    $("#challenge-input").removeClass("correct");
    $("#incorrect-key").slideUp();
    $("#correct-key").slideUp();
    $("#already-solved").slideUp();
    $("#too-fast").slideUp();
  });
});
setInterval(() => update().catch(() => {}), 300000); // Update every 5 minutes.

const displayHint = data => {
  if (window.neoToast) window.neoToast("Hint opened", "info");
  ezAlert({
    title: "Hint",
    body: data.html,
    button: "Got it!"
  });
};

const displayUnlock = id => {
  ezQuery({
    title: "Unlock Hint?",
    body: "Are you sure you want to open this hint?",
    success: () => {
      const params = {
        target: id,
        type: "hints"
      };
      CTFd.api.post_unlock_list({}, params).then(response => {
        if (response.success) {
          CTFd.api.get_hint({ hintId: id }).then(response => {
            displayHint(response.data);
          });

          return;
        }

        ezAlert({
          title: "Error",
          body: response.errors.score,
          button: "Got it!"
        });
      });
    }
  });
};

const loadHint = id => {
  CTFd.api.get_hint({ hintId: id }).then(response => {
    if (!response.success) {
      let msg = Object.values(response.errors).join("\n");
      alert(msg);
      return;
    }
    if (response.data.content) {
      displayHint(response.data);
      return;
    }

    displayUnlock(id);
  }).catch(error => {
    ezAlert({
      title: "Error",
      body: (error && error.message) || "Unable to load this hint.",
      button: "Got it!"
    });
  });
};

window.updateChallengeBoard = update;
