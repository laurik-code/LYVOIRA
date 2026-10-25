(function() {
  // Resolve the widget host from its own script URL, independent of the embedding site.
  const script = document.currentScript;
  const widgetOrigin = script?.src ? new URL(script.src).origin : window.location.origin;
  const chatUrl = new URL("/chat", widgetOrigin).toString();

  // zisťujeme dark mode preferenciu
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // nastavenia štýlov podľa módu
  const bubbleBg = isDark ? "#4c1d95" : "#9333ea"; // tmavofialová vs. svetlofialová
  const bubbleColor = "white";
  const iframeShadow = isDark
    ? "0 4px 20px rgba(255,255,255,0.2)"
    : "0 4px 20px rgba(0,0,0,0.3)";
  const iframeBg = isDark ? "#1f2937" : "#ffffff"; // dark vs light background

  // vytvor bublinu
  const bubble = document.createElement("div");
  bubble.innerText = "💬";
  bubble.style.position = "fixed";
  bubble.style.bottom = "20px";
  bubble.style.right = "20px";
  bubble.style.width = "60px";
  bubble.style.height = "60px";
  bubble.style.borderRadius = "50%";
  bubble.style.background = bubbleBg;
  bubble.style.color = bubbleColor;
  bubble.style.fontSize = "28px";
  bubble.style.display = "flex";
  bubble.style.alignItems = "center";
  bubble.style.justifyContent = "center";
  bubble.style.cursor = "pointer";
  bubble.style.zIndex = "9999";
  bubble.style.boxShadow = iframeShadow;
  document.body.appendChild(bubble);

  // iframe pre chat
  const iframe = document.createElement("iframe");
  iframe.src = chatUrl;
  iframe.style.position = "fixed";
  iframe.style.bottom = "90px";
  iframe.style.right = "20px";
  iframe.style.width = "400px";
  iframe.style.height = "500px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = iframeShadow;
  iframe.style.background = iframeBg;
  iframe.style.display = "none"; // zatiaľ skryté
  iframe.style.zIndex = "9999";
  document.body.appendChild(iframe);

  // klik na bublinu → zobraz/skry chat
  bubble.addEventListener("click", () => {
    iframe.style.display = iframe.style.display === "none" ? "block" : "none";
  });
})();
