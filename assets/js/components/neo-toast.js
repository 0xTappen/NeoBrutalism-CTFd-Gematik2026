const icons = {
  success: "fa-check-circle",
  error: "fa-exclamation-triangle",
  info: "fa-info-circle"
};

export function showToast(message, type = "info") {
  const region = document.getElementById("neo-toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `neo-toast neo-toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}" aria-hidden="true"></i><span></span>`;
  toast.querySelector("span").textContent = message;
  region.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 180);
  }, 2600);
}

export default function initNeoToast() {
  window.neoToast = showToast;
}
