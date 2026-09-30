import $ from "jquery";
import CTFd from "../CTFd";
import { ezAlert } from "../ezq";

const displayedTicketIds = new Set();
let pendingTicketLoad = null;
let reloadQueued = false;

const ticketTitle = ticket => ticket.title || "Ticket";
const ticketHtml = ticket => ticket.html || ticket.content || "";

const playTicketSound = ticket => {
  if (!ticket.sound) return;
  const soundtrack = window.themeSoundtrack;
  if (soundtrack && soundtrack.playing()) soundtrack.pause();
  if (CTFd.events && CTFd.events.howl) {
    CTFd.events.howl.play();
  }
};

const markDisplayed = ticket => {
  if (!ticket || ticket.id === null || ticket.id === undefined) return true;
  const id = String(ticket.id);
  if (displayedTicketIds.has(id)) return false;
  displayedTicketIds.add(id);
  return true;
};

const showTicket = ticket => {
  playTicketSound(ticket);

  if (ticket.type === "alert") {
    ezAlert({
      title: ticketTitle(ticket),
      body: ticketHtml(ticket),
      button: "Got it!"
    });
    return;
  }

  if (window.neoToast) {
    window.neoToast(ticketTitle(ticket), "info");
  }

  const region = $("#neo-toast-region");
  if (!region.length) return;
  const toast = $("<article class='neo-ticket-toast' role='alert'></article>");
  const close = $("<button type='button' class='neo-ticket-close' aria-label='Dismiss ticket'></button>")
    .append("<i class='fas fa-times' aria-hidden='true'></i>")
    .on("click", () => toast.remove());
  toast
    .append($("<strong></strong>").text(ticketTitle(ticket)))
    .append($("<div class='neo-ticket-body'></div>").html(ticketHtml(ticket)))
    .append(close);
  region.append(toast);
};

const showTickets = tickets => {
  tickets.filter(markDisplayed).forEach(showTicket);
};

const loadPendingTickets = () => {
  if (pendingTicketLoad) {
    reloadQueued = true;
    return pendingTicketLoad;
  }

  reloadQueued = false;
  pendingTicketLoad = CTFd.fetch("/api/v1/tickets/pending")
    .then(response => {
      if (!response.ok) return null;
      return response.json();
    })
    .then(response => {
      if (response && response.success && Array.isArray(response.data)) {
        showTickets(response.data);
      }
    })
    .catch(() => {})
    .then(() => {
      pendingTicketLoad = null;
      if (reloadQueued) return loadPendingTickets();
      return null;
    });

  return pendingTicketLoad;
};

const connectRealtimeTickets = () => {
  if (!CTFd.events || !CTFd.events.source) return;
  CTFd.events.source.addEventListener(
    "ticket",
    () => {
      if (CTFd.events.controller) {
        CTFd.events.controller.broadcast("ticket", {});
      }
      loadPendingTickets();
    },
    false
  );

  if (CTFd.events.controller) {
    CTFd.events.controller.ticket = loadPendingTickets;
  }
};

export default () => {
  if (!CTFd.user || !CTFd.user.id) return;
  connectRealtimeTickets();
  loadPendingTickets();
};
