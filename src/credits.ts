const portraits = new URL('./assets/credits/portraits.png', import.meta.url).href;

// Ordem das referências do Calc Boy 3000; nomes conferidos nos cartões enviados.
const team = [
  ['Daniela', 'E. Lopes C. Silva'],
  ['Denise', 'de Assis Moura Avelar'],
  ['Fernanda', 'Arruda da Conceição'],
  ['Gabriel', 'dos Santos Divino'],
  ['Luiz Gustavo', 'Couto de Oliveira'],
  ['Marília', 'da Silva de Jesus'],
  ['Thiago', 'Neves de Assis de Paula'],
  ['Vitoria Naomi', 'Kobama'],
] as const;

function person(first: string, rest: string, index: number, role = '', description = '') {
  return `<article class="credit-person" style="--person-color:var(--t${index % 5})">
    <div class="credit-photo"><span class="credit-portrait" role="img" aria-label="Retrato ilustrado de ${first} ${rest}" style="background-image:url('${portraits}');background-position:${index % 5 * 25}% ${index < 5 ? 0 : 100}%"></span><span class="credit-counter" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></div>
    <div class="credit-person-copy">${role ? `<p class="credit-role">${role}</p>` : ''}<h3>${first}<span>${rest}</span></h3>${description ? `<p class="credit-description">${description}</p>` : ''}</div>
  </article>`;
}

const symbols = {
  ifrj: `<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="14" cy="12" r="6" fill="#ff6b8b"/><g fill="#5eead4">${[[28,6],[44,6],[8,22],[28,22],[44,22],[8,38],[28,38],[8,54],[28,54]].map(([x,y]) => `<rect x="${x}" y="${y}" width="12" height="12" rx="3"/>`).join('')}</g></svg>`,
  fevre: `<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M33 7a3.5 3.5 0 0 1 6 0l29 53a4 4 0 0 1-3.5 6h-57A4 4 0 0 1 4 60Z" fill="#ff7a95"/><circle cx="36" cy="43" r="19" fill="#eef1ff"/><circle cx="36" cy="43" r="14" fill="#7c8cff"/></svg>`,
  pibid: `<svg viewBox="0 0 72 72" aria-hidden="true"><g fill="none" stroke="#7cc4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M36 36c-9-7-20-9-30-7v30c10-2 21 0 30 7 9-7 20-9 30-7V29c-10-2-21 0-30 7v30"/><path d="m14 39 13 3m-13 8 13 3m18-11 13-3m-13 14 13-3"/></g><path d="M36 34V13" stroke="#5eead4" stroke-width="4" stroke-linecap="round"/><path d="M36 23C22 24 20 16 20 10c12 0 16 5 16 13Zm0-10C37 3 45 2 52 3c-1 10-7 13-16 10Z" fill="#5eead4"/></svg>`,
};

const sections = [
  ['equipe', 'Equipe'], ['orientacao', 'Orientação'], ['apoio', 'Apoio'], ['sobre', 'Sobre'],
] as const;

export const creditsHtml = `
  <div class="credits-heading"><div><span class="eyebrow">CONTIG 60 · CRÉDITOS</span><h1 id="credits-title" tabindex="-1">Quem soma<br><em>com este jogo.</em></h1><p>Uma equipe, muitas ideias e a vontade de aprender jogando.</p></div>
    <div class="credits-board" aria-hidden="true">${[3,4,5,12,7,15,9,6,20,8,24,10,18,16,30,60].map((n,i) => `<span class="${[0,5,10,15].includes(i) ? 'marked' : ''}" data-tier="${i % 5}">${n}</span>`).join('')}</div>
  </div>
  <div class="credits-bar"><div class="credits-tabs" role="tablist" aria-label="Seções dos créditos">${sections.map(([id,label],i) => `<button type="button" id="credit-tab-${id}" role="tab" aria-controls="credit-panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-credit-tab="${id}">${label}</button>`).join('')}</div><button type="button" class="ghost credits-back" data-credits-back>← Voltar</button></div>
  <section id="credit-panel-equipe" class="credit-panel" role="tabpanel" aria-labelledby="credit-tab-equipe" tabindex="0">
    <div class="credit-section-heading"><div><span class="eyebrow">IDEALIZADO E REALIZADO POR</span><h2>Cada pessoa faz parte da conta.</h2></div><span class="credit-count">08 integrantes</span></div>
    <div class="credit-team">${team.map(([first,rest],index) => person(first,rest,index)).join('')}</div>
  </section>
  <section id="credit-panel-orientacao" class="credit-panel" role="tabpanel" aria-labelledby="credit-tab-orientacao" tabindex="0" hidden>
    <div class="credit-section-heading"><div><span class="eyebrow">SUPERVISÃO E COORDENAÇÃO</span><h2>Quem orienta o caminho.</h2><p>Da ideia à sala de aula, conhecimento que se compartilha.</p></div></div>
    <div class="credit-guidance">${person('Aline', 'Barcelo da Costa', 8, 'SUPERVISÃO', 'Professora do Colégio Getúlio Vargas')}${person('Isabella', 'Moreira de Paiva Correa', 9, 'COORDENAÇÃO', 'Coordenadora do PIBID Matemática do IFRJ Campus Volta Redonda')}</div>
  </section>
  <section id="credit-panel-apoio" class="credit-panel" role="tabpanel" aria-labelledby="credit-tab-apoio" tabindex="0" hidden>
    <div class="credit-section-heading"><div><span class="eyebrow">INSTITUIÇÕES E PROGRAMA</span><h2>Apoio que multiplica possibilidades.</h2><p>Parcerias que aproximam a matemática de novas descobertas.</p></div></div>
    <div class="credit-supporters">
      <article class="card credit-supporter"><div class="credit-symbol">${symbols.ifrj}</div><h3>IFRJ</h3><p>Instituto Federal do Rio de Janeiro</p><span>Campus Volta Redonda</span></article>
      <article class="card credit-supporter"><div class="credit-symbol">${symbols.fevre}</div><h3>FEVRE</h3><p>Fundação Educacional de Volta Redonda</p><span>Colégio Getúlio Vargas</span></article>
      <article class="card credit-supporter"><div class="credit-symbol">${symbols.pibid}</div><h3>PIBID</h3><p>Programa Institucional de Bolsa de Iniciação à Docência</p></article>
    </div>
  </section>
  <section id="credit-panel-sobre" class="credit-panel" role="tabpanel" aria-labelledby="credit-tab-sobre" tabindex="0" hidden>
    <div class="credit-about card"><span class="eyebrow">MATEMÁTICA QUE CONECTA</span><h2>Aprender também é jogar.</h2><p>Desenvolvimento próprio durante o projeto <strong>PIBID 2024–2026</strong>.</p><p>Três dados, muitas combinações. Nesta adaptação digital do Contig 60, cada jogada convida a experimentar operações, planejar estratégias e descobrir diferentes caminhos para chegar a um resultado.</p><p>Agradecemos aos integrantes, à supervisão, à coordenação e às instituições apoiadoras por fazerem parte desta construção.</p><div class="credit-topics"><span>+ Operações</span><span>× Estratégia</span><span>÷ Raciocínio</span></div><p class="credit-thanks">E a você, que joga, experimenta e aprende:<br><strong>obrigado por fazer parte desta conta!</strong></p></div>
  </section>
  <footer class="credits-footer"><span>PIBID 2024–2026 <span aria-hidden="true">·</span> Contig 60</span><button type="button" class="ghost" data-credits-back>Voltar ao jogo →</button></footer>`;

export function initCredits() {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-credit-tab]')];
  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById('credit-panel-' + item.dataset.creditTab)!.hidden = !active;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.onclick = () => select(tab);
    tab.onkeydown = event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); select(tabs[next], true); }
    };
  });
}
