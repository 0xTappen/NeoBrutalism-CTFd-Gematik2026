export function getCategoryIcon(category) {
  const name = String(category || "")
    .toLowerCase()
    .replace(/[_/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = new Set(name.split(" "));
  const matches = aliases => aliases.some(alias =>
    alias.includes(" ") ? name.includes(alias) : words.has(alias)
  );
  const icons = [
    { aliases: ["all"], icon: "fa-layer-group" },
    { aliases: ["general", "warmup", "warm up", "beginner", "sanity", "checkin", "check in", "welcome"], icon: "fa-star" },
    { aliases: ["web", "web3", "web security"], icon: "fa-globe" },
    { aliases: ["pwn", "pwnable", "binary", "binexp", "binary exploitation"], icon: "fa-bomb" },
    { aliases: ["rev", "reverse", "reversing", "reverse engineering"], icon: "fa-microchip" },
    { aliases: ["crypto", "crypt", "cryptography"], icon: "fa-key" },
    { aliases: ["forensic", "forensics", "dfir"], icon: "fa-search" },
    { aliases: ["geosint", "geoint", "geolocation"], icon: "fa-map-marker-alt" },
    { aliases: ["osint", "open source intelligence"], icon: "fa-eye" },
    { aliases: ["steg", "stego", "steganography"], icon: "fa-image" },
    { aliases: ["mobile", "android", "ios"], icon: "fa-mobile-alt" },
    { aliases: ["hardware", "embedded", "iot"], icon: "fa-memory" },
    { aliases: ["blockchain", "smart contract"], icon: "fa-cubes" },
    { aliases: ["programming", "coding", "ppc", "algorithm"], icon: "fa-code" },
    { aliases: ["network", "networking"], icon: "fa-network-wired" },
    { aliases: ["cloud"], icon: "fa-cloud" },
    { aliases: ["ai", "ml", "machine learning"], icon: "fa-robot" },
    { aliases: ["misc", "miscellaneous"], icon: "fa-puzzle-piece" }
  ];

  if (name === "re") return "fa-microchip";
  const match = icons.find(entry => matches(entry.aliases));
  return match ? match.icon : "fa-flag";
}
