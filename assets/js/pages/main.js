import CTFd from "../CTFd";
import $ from "jquery";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import nunjucks from "nunjucks";
import { Howl } from "howler";
import events from "../events";
import config from "../config";
import styles from "../styles";
import times from "../times";
import { default as helpers } from "../helpers";
import initNeoFeatures from "../components/neo-features";
import initNeoToast from "../components/neo-toast";
import initCTFdPlusPlusTickets from "../components/ctfdplusplus-tickets";

dayjs.extend(advancedFormat);

CTFd.init(window.init);
window.CTFd = CTFd;
window.helpers = helpers;
window.$ = $;
window.dayjs = dayjs;
window.nunjucks = nunjucks;
window.Howl = Howl;

const initCompetitionStatus = () => {
  const card = document.querySelector("#competition-status");
  if (!card) return;

  const badge = document.querySelector("#competition-status-badge");
  const message = document.querySelector("#competition-status-message");
  const countdown = document.querySelector("#competition-countdown");
  const countdownLabel = document.querySelector("#competition-countdown-label");
  const start = new Date("2026-11-21T09:00:00+07:00");
  const end = new Date("2026-11-21T19:00:00+07:00");

  const render = () => {
    const now = new Date();
    let target = null;
    let timerLabel = "";
    let state = "OPEN";
    let copy = "Challenges are available. Find flags and climb the leaderboard.";

    if (start && now < start) {
      state = "UPCOMING";
      copy = "Competition starts soon. Get your account and team ready.";
      target = start;
      timerLabel = "STARTS IN";
    } else if (end && now >= end) {
      state = "ENDED";
      copy = "Competition has ended. Final rankings remain available on the scoreboard.";
    } else if (start || end) {
      state = "LIVE";
      copy = "Main event is live. Submit flags before the timer reaches zero.";
      target = end;
      timerLabel = "ENDS IN";
    }

    badge.textContent = state;
    badge.className = `neo-badge ${state === "LIVE" || state === "OPEN" ? "neo-badge-green" : state === "ENDED" ? "neo-badge-red" : "neo-badge-blue"}`;
    message.textContent = copy;

    if (!target) {
      countdown.hidden = true;
      return;
    }
    const remaining = Math.max(0, target.getTime() - now.getTime());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    countdown.hidden = false;
    countdownLabel.textContent = timerLabel;
    countdown.querySelector('[data-countdown="days"]').textContent = days;
    countdown.querySelector('[data-countdown="hours"]').textContent = String(hours).padStart(2, "0");
    countdown.querySelector('[data-countdown="minutes"]').textContent = String(minutes).padStart(2, "0");
    countdown.querySelector('[data-countdown="seconds"]').textContent = String(seconds).padStart(2, "0");
  };

  render();
  window.setInterval(render, 1000);
};

const initThemeMusic = () => {
  const toggle = document.querySelector("#music-toggle");
  if (!toggle) return;

  const musicUrl = new URL("../../music/theme.mp3", import.meta.url).href;
  const pausePreferenceKey = "gematik-theme-music-paused";
  const positionKey = "gematik-theme-music-position";
  let isPaused = true; // Music is opt-in on each page: no background media download.
  const soundtrack = new Howl({
    src: [musicUrl],
    html5: true,
    autoplay: false,
    preload: false,
    loop: true,
    volume: 0.28,
    onload() {
      let savedPosition = 0;
      let savedAt = Date.now();
      try {
        const savedState = JSON.parse(sessionStorage.getItem(positionKey) || "{}");
        savedPosition = Number(savedState.position) || 0;
        savedAt = Number(savedState.savedAt) || savedAt;
      } catch (_error) {
        savedPosition = 0;
      }
      const duration = soundtrack.duration();
      if (duration > 0) {
        const navigationTime = isPaused ? 0 : Math.max(0, (Date.now() - savedAt) / 1000);
        soundtrack.seek((savedPosition + navigationTime) % duration);
      }
      if (!isPaused) soundtrack.play();
    }
  });

  const updateToggle = () => {
    const icon = toggle.querySelector("i");
    const label = toggle.querySelector(".music-toggle-label");
    icon.classList.toggle("fa-volume-up", !isPaused);
    icon.classList.toggle("fa-volume-mute", isPaused);
    label.textContent = isPaused ? "PLAY MUSIC" : "PAUSE MUSIC";
    toggle.setAttribute("aria-pressed", String(isPaused));
    toggle.setAttribute("aria-label", isPaused ? "Play background music" : "Pause background music");
    toggle.setAttribute("title", isPaused ? "Play background music" : "Pause background music");
  };

  const resumeSoundtrack = () => {
    if (isPaused || soundtrack.playing()) return;
    soundtrack.play();
  };

  soundtrack.on("play", updateToggle);
  soundtrack.on("pause", updateToggle);
  soundtrack.on("stop", updateToggle);
  soundtrack.once("playerror", () => {
    if (isPaused) return;
    document.addEventListener("pointerdown", resumeSoundtrack, { once: true });
    document.addEventListener("keydown", resumeSoundtrack, { once: true });
  });

  toggle.addEventListener("click", () => {
    if (!isPaused) {
      isPaused = true;
      localStorage.setItem(pausePreferenceKey, "true");
      soundtrack.pause();
    } else {
      isPaused = false;
      localStorage.setItem(pausePreferenceKey, "false");
      if (soundtrack.state() === "unloaded") soundtrack.load();
      else soundtrack.play();
      updateToggle();
    }
  });

  const savePosition = () => {
    const position = Number(soundtrack.seek());
    if (Number.isFinite(position) && position >= 0) {
      sessionStorage.setItem(positionKey, JSON.stringify({
        position,
        savedAt: Date.now()
      }));
    }
  };
  window.setInterval(savePosition, 2000);
  window.addEventListener("pagehide", savePosition);
  window.addEventListener("beforeunload", savePosition);

  updateToggle();
  window.themeSoundtrack = soundtrack;
};

const initAnnouncementBanner = () => {
  const region = document.querySelector("#neo-announcement-region");
  if (!region || !CTFd.api || !CTFd.api.get_notification_list) return;

  CTFd.api.get_notification_list()
    .then(response => {
      const notifications = Array.isArray(response.data) ? response.data : [];
      if (!notifications.length) return;
      const notification = notifications[0];
      const key = `gematik-dismissed-announcement-${notification.id}`;
      if (localStorage.getItem(key) === "true") return;

      const banner = document.createElement("aside");
      banner.className = "neo-announcement";
      banner.setAttribute("role", "status");
      const icon = document.createElement("i");
      icon.className = "fas fa-bullhorn";
      icon.setAttribute("aria-hidden", "true");
      const content = document.createElement("div");
      content.className = "neo-announcement-content";
      const title = document.createElement("strong");
      title.textContent = notification.title || "ANNOUNCEMENT";
      const message = document.createElement("span");
      message.innerHTML = notification.html || notification.content || "";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "neo-announcement-close";
      close.setAttribute("aria-label", "Dismiss announcement");
      close.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
      close.addEventListener("click", () => {
        localStorage.setItem(key, "true");
        banner.remove();
      });
      content.append(title, message);
      banner.append(icon, content, close);
      region.appendChild(banner);
    })
    .catch(() => {});
};

const initGlobalShortcuts = () => {
  document.addEventListener("keydown", event => {
    const target = event.target;
    const isEditing = target && (target.matches("input, textarea, select") || target.isContentEditable);
    if (isEditing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      document.querySelector("#music-toggle")?.click();
    }
  });
};

$(() => {
  initNeoToast();
  styles();
  times();
  events(config.urlRoot);
  initNeoFeatures();
  initCompetitionStatus();
  initCTFdPlusPlusTickets();
  const deferThemeMusic = window.requestIdleCallback || (callback => window.setTimeout(callback, 250));
  deferThemeMusic(initThemeMusic, { timeout: 1500 });
  initAnnouncementBanner();
  initGlobalShortcuts();
});
