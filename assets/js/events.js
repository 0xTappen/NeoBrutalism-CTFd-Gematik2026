import { Howl } from "howler";
import { NativeEventSource, EventSourcePolyfill } from "event-source-polyfill";
import { ezToast, ezAlert } from "./ezq";
import {
  WindowController,
  init_notification_counter,
  inc_notification_counter,
  dec_notification_counter
} from "./utils";

const EventSource = NativeEventSource || EventSourcePolyfill;

export default root => {
  let source = null;
  const wc = new WindowController();
  const howl = new Howl({
    preload: false,
    src: [
      root + "/themes/core/static/sounds/notification.webm",
      root + "/themes/core/static/sounds/notification.mp3"
    ]
  });

  init_notification_counter();
  CTFd.events = {
    source,
    controller: wc,
    howl
  };

  const firstBloodSound = new Howl({
    src: [new URL("../music/first-blood_TJM7IEK.mp3", import.meta.url).href],
    format: ["mp3"],
    volume: 0.85
  });
  const seen = new Set();
  const ensureAudio = () => {
    if (typeof Howler !== "undefined" && Howler.ctx && Howler.ctx.state === "suspended") {
      Howler.ctx.resume();
    }
  };
  document.addEventListener("pointerdown", ensureAudio, { passive: true });
  document.addEventListener("keydown", ensureAudio, { passive: true });
  document.addEventListener("click", ensureAudio, { passive: true });

  function firstBlood(data) {
    if (!data || seen.has(data.solve_id)) return;
    seen.add(data.solve_id);
    if (seen.size > 100) seen.delete(seen.values().next().value);
    const card = document.createElement("section");
    card.className = "neo-first-blood";
    card.setAttribute("role", "status");
    const emblem = document.createElement("div");
    emblem.className = "neo-blood-emblem";
    emblem.textContent = "01";
    emblem.setAttribute("aria-hidden", "true");
    const content = document.createElement("div");
    content.className = "neo-blood-content";
    const eyebrow = document.createElement("small");
    eyebrow.textContent = "ARENA UPDATE / FIRST CAPTURE";
    const title = document.createElement("strong");
    title.textContent = "FIRST BLOOD!";
    const body = document.createElement("p");
    const player = document.createElement("b");
    player.textContent = data.account;
    const challenge = document.createElement("span");
    challenge.textContent = data.challenge;
    body.append(player, document.createTextNode(" captured "), challenge);
    content.append(eyebrow, title, body);
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Dismiss first blood announcement");
    const dismiss = () => {
      card.classList.add("is-leaving");
      setTimeout(() => card.remove(), 250);
    };
    close.onclick = dismiss;
    const progress = document.createElement("div");
    progress.className = "neo-blood-progress";
    progress.setAttribute("aria-hidden", "true");
    card.append(emblem, content, close, progress);
    const old = document.querySelector(".neo-first-blood");
    if (old) old.remove();
    document.body.append(card);
    setTimeout(dismiss, 8000);

    if (localStorage.getItem("gematik-effects-muted") !== "true") {
      const now = Date.now();
      const lastFb = Number(localStorage.getItem("gematik-last-fb-sound") || 0);
      if (now - lastFb >= 1500) {
        localStorage.setItem("gematik-last-fb-sound", String(now));
        try {
          ensureAudio();
          firstBloodSound.stop();
          firstBloodSound.play();
        } catch (e) {
          console.warn("First blood playback error:", e);
        }
      }
    }
    if (window.updateChallengeBoard) window.updateChallengeBoard();
  }
  wc.first_blood = data => firstBlood(data);

  function connect() {
    if (source) return;
    source = new EventSource(root + "/events");
    CTFd.events.source = source;
    source.addEventListener("first_blood", event => {
      const data = JSON.parse(event.data);
      wc.broadcast("first_blood", data);
      firstBlood(data, true);
    });
    source.addEventListener(
      "notification",
      function(event) {
        let data = JSON.parse(event.data);
        wc.broadcast("notification", data);

        // Render in the master tab
        render(data);

        // Only play sounds in the master tab
        if (data.sound) {
          if (unlocked && localStorage.getItem("gematik-effects-muted") !== "true") {
            if (howl.state() === "unloaded") howl.load();
            howl.play();
          }
        }
      },
      false
    );
  }

  function disconnect() {
    if (source) {
      source.close();
      source = null;
    }
  }

  function render(data) {
    switch (data.type) {
      case "toast": {
        inc_notification_counter();
        // Trim toast body to length
        let length = 50;
        let trimmed_content =
          data.content.length > length
            ? data.content.substring(0, length - 3) + "..."
            : data.content;
        let clicked = false;
        ezToast({
          title: data.title,
          body: trimmed_content,
          onclick: function() {
            ezAlert({
              title: data.title,
              body: data.html,
              button: "Got it!",
              success: function() {
                clicked = true;
                dec_notification_counter();
              }
            });
          },
          onclose: function() {
            if (!clicked) {
              dec_notification_counter();
            }
          }
        });
        break;
      }
      case "alert": {
        inc_notification_counter();
        ezAlert({
          title: data.title,
          body: data.html,
          button: "Got it!",
          success: function() {
            dec_notification_counter();
          }
        });
        break;
      }
      case "background": {
        inc_notification_counter();
        break;
      }
      default: {
        inc_notification_counter();
        break;
      }
    }
  }

  wc.notification = data => render(data);

  wc.alert = function(data) {
    render(data);
  };

  wc.toast = function(data) {
    render(data);
  };

  wc.background = function(data) {
    render(data);
  };

  wc.masterDidChange = function() {
    if (this.isMaster) {
      connect();
    } else {
      disconnect();
    }
  };
  if (wc.isMaster) connect();
};
