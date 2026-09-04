'use strict';
// Kleine Hilfsfunktionen für serverseitig gerenderte Seiten (Schiri-Eingabe, Druck).

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function page({ title, body, extraHead = '', bodyClass = '' }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
${extraHead}
</head>
<body class="${esc(bodyClass)}">
${body}
</body>
</html>`;
}

module.exports = { esc, page };
