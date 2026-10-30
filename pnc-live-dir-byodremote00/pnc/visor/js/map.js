/* ViSOR mock: hand-drawn, simplified SVG maps of the ACPO regions and Police Scotland divisions.
   The shapes are stylised (artistic licence), not survey-accurate. */
(function (global) {
  'use strict';

  const SCOTLAND_D =
    'M190,230 L175,222 L160,228 L150,212 L162,198 L148,183 L133,190 L128,170 L143,156 L128,140 L138,120 ' +
    'L122,104 L138,88 L128,68 L148,54 L144,34 L172,16 L204,10 L214,30 L236,24 L252,44 L240,70 L262,80 ' +
    'L286,74 L292,96 L272,120 L256,140 L276,150 L290,166 L276,186 L256,196 L245,215 L225,225 Z ' +
    // Western Isles, Skye, Islay/Arran
    'M100,110 L112,100 L116,120 L108,140 L98,132 Z M106,150 L116,147 L114,165 L105,162 Z ' +
    'M118,128 L128,124 L126,138 L118,136 Z M138,200 L146,196 L148,208 L140,210 Z';

  // Orkney & Shetland, drawn in the inset box at top-left like the original screen.
  const SCOTLAND_INSET_D =
    'M42,18 L48,14 L50,26 L47,40 L43,34 L44,26 Z M36,42 L40,40 L40,46 Z ' +
    'M24,60 L34,56 L38,62 L30,68 L22,66 Z M38,64 L44,62 L44,68 Z';

  const REGION_SHAPES = {
    scotland: SCOTLAND_D + ' ' + SCOTLAND_INSET_D,
    ireland: 'M70,205 L92,192 L118,196 L130,212 L122,232 L104,244 L84,242 L72,232 L62,220 Z',
    northwest: 'M190,230 L225,225 L218,268 L214,300 L212,345 L195,350 L185,348 L180,335 L186,320 L178,305 ' +
      'L190,290 L180,272 L184,255 Z',
    northeast: 'M225,225 L245,215 L262,252 L275,275 L290,300 L300,325 L270,335 L235,330 L214,300 L218,268 Z',
    eastmidlands: 'M214,300 L235,330 L270,335 L300,325 L308,345 L320,365 L300,380 L265,400 L235,385 L212,345 Z',
    westmidlands: 'M195,350 L212,345 L235,385 L245,415 L205,425 L192,400 L190,370 Z',
    wales: 'M185,348 L195,350 L190,370 L192,400 L195,428 L178,433 L162,430 L148,435 L130,428 L126,416 ' +
      'L142,408 L148,394 L140,382 L146,370 L137,358 L150,349 L166,344 Z M140,342 L152,338 L154,348 L142,350 Z',
    eastern: 'M300,380 L320,365 L340,362 L362,372 L368,392 L360,412 L352,428 L348,442 L328,450 L300,442 ' +
      'L272,428 L265,400 Z',
    southeast: 'M245,415 L235,385 L265,400 L272,428 L300,442 L328,450 L345,452 L368,458 L366,472 L350,484 ' +
      'L320,490 L290,494 L262,496 L250,492 L245,470 Z M262,503 L276,501 L278,508 L264,510 Z',
    southwest: 'M205,425 L245,415 L245,470 L250,492 L230,500 L205,502 L185,512 L160,520 L140,530 L118,540 ' +
      'L122,528 L135,515 L150,504 L165,492 L176,478 L190,466 L204,456 L210,444 L198,434 L195,428 Z',
    london: 'M292,440 L306,436 L320,442 L322,456 L310,464 L294,462 L286,452 Z',
    channel: 'M250,530 L262,527 L265,536 L253,539 Z'
  };

  const COLORS = {
    scotland: '#6d8fdc', ireland: '#efe04a', wales: '#6aaae6', northeast: '#a6d9cf', northwest: '#e9b97a',
    eastmidlands: '#e8dcae', westmidlands: '#b49cb8', eastern: '#c6c2ea', southeast: '#bfe3b4',
    southwest: '#72c4b4', london: '#f1e14a', channel: '#e6a0a0'
  };

  const LABEL_POS = {
    scotland: [205, 125], ireland: [95, 222], wales: [163, 402], northeast: [258, 290], northwest: [199, 293],
    eastmidlands: [264, 364], westmidlands: [214, 398], eastern: [328, 405], southeast: [290, 474],
    southwest: [178, 492], london: [304, 453], channel: [257, 549]
  };

  const ISLE_OF_MAN = 'M160,280 L166,276 L168,288 L162,292 Z';

  function bindHover(svg, attr, handlers) {
    let current = null;
    svg.addEventListener('mouseover', e => {
      const el = e.target.closest('[' + attr + ']');
      const id = el ? el.getAttribute(attr) : null;
      if (id === current) return;
      if (current && handlers.onLeave) handlers.onLeave(current, e);
      current = id;
      if (id && handlers.onEnter) handlers.onEnter(id, e);
    });
    svg.addEventListener('mousemove', e => { if (current && handlers.onMove) handlers.onMove(current, e); });
    svg.addEventListener('mouseleave', e => {
      if (current && handlers.onLeave) handlers.onLeave(current, e);
      current = null;
    });
    svg.addEventListener('click', e => {
      const el = e.target.closest('[' + attr + ']');
      if (el && handlers.onClick) handlers.onClick(el.getAttribute(attr), e);
    });
  }

  function toggleClass(svg, attr, id, cls, on) {
    svg.querySelectorAll('[' + attr + '="' + CSS.escape(id) + '"]').forEach(el => el.classList.toggle(cls, on));
  }

  /** UK map of ACPO regions. counts: { regionId: number } shown as labels. */
  function uk(container, opts) {
    const counts = opts.counts || {};
    const paths = Object.keys(REGION_SHAPES).map(id =>
      `<path class="region" data-region="${id}" fill="${COLORS[id]}" d="${REGION_SHAPES[id]}"/>`).join('');
    const labels = Object.keys(LABEL_POS).filter(id => counts[id]).map(id =>
      `<text class="count" x="${LABEL_POS[id][0]}" y="${LABEL_POS[id][1]}">${counts[id]}</text>`).join('');
    container.innerHTML =
      `<svg class="map-svg" viewBox="0 0 400 560" role="img" aria-label="Map of ACPO regions">
        <rect class="inset" x="12" y="8" width="58" height="68"/>
        <path class="neutral" d="${ISLE_OF_MAN}"><title>Isle of Man (not on ViSOR)</title></path>
        ${paths}${labels}
      </svg>`;
    const svg = container.firstElementChild;
    bindHover(svg, 'data-region', opts);
    return {
      highlight: (id, on) => toggleClass(svg, 'data-region', id, 'hover', on),
      select: (id, on) => toggleClass(svg, 'data-region', id, 'sel', on)
    };
  }

  /** Enlarged Scotland outline with a clickable marker per Police Scotland division. */
  function scotland(container, opts) {
    const dots = opts.divisions.map(d => {
      const anchor = d.x > 230 ? 'start' : 'end';
      const dx = anchor === 'start' ? 6 : -6;
      return `<g data-div="${d.name}">
          <circle class="div-dot" data-div="${d.name}" cx="${d.x}" cy="${d.y}" r="4"/>
          <text class="div-label" x="${d.x + dx}" y="${d.y + 2.5}" text-anchor="${anchor}">${d.name}</text>
        </g>`;
    }).join('');
    container.innerHTML =
      `<svg class="map-svg" viewBox="60 2 280 236" role="img" aria-label="Map of Police Scotland divisions">
        <path fill="${COLORS.scotland}" stroke="#fff" stroke-width=".8" d="${SCOTLAND_D}"/>
        ${dots}
      </svg>`;
    const svg = container.firstElementChild;
    bindHover(svg, 'data-div', opts);
    const dot = (name, cls, on) =>
      svg.querySelectorAll('circle[data-div="' + CSS.escape(name) + '"]').forEach(el => el.classList.toggle(cls, on));
    return {
      highlight: (name, on) => dot(name, 'hover', on),
      select: (name, on) => dot(name, 'sel', on)
    };
  }

  global.VisorMap = { uk, scotland, COLORS };
})(window);
