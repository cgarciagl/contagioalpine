let simulationStore;
let totalSimulationPopulation = 300;
let history = { sanos: [], enfermos: [], recuperados: [], muertos: [] };
let apexChart;

let activeQuadTree;
let wallStart = null;

const DEFAULT_POBLACION = 300;
const DEFAULT_ENCUARENTENA = 20;
const DEFAULT_TIEMPO_ENFERMEDAD = 150;
const DEFAULT_MORTALIDAD = 50;
const DEFAULT_MODO_ZOMBIE = false;
const STORE_NAME = "simula";
const CONFIG_KEY = "contagioalpine_config";

const HISTORY_SAMPLE_RATE = 30;
const MIN_WALL_LENGTH = 10;
const BRUSH_RADIUS = 25;

const COUNTER_KEY_BY_STATE = Object.freeze({
  [ESTADOS.SANO]:       "sanos",
  [ESTADOS.ENFERMO]:    "enfermos",
  [ESTADOS.RECUPERADO]: "recuperados",
  [ESTADOS.MUERTO]:     "muertos",
});

const CONFIG_DEFAULTS = {
  poblacion: DEFAULT_POBLACION,
  encuarentena: DEFAULT_ENCUARENTENA,
  tiempoenfermedad: DEFAULT_TIEMPO_ENFERMEDAD,
  modozombie: DEFAULT_MODO_ZOMBIE,
  mortalidad: DEFAULT_MORTALIDAD,
  tasacontagio: 90,
  velocidad: 1.5,
};

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...CONFIG_DEFAULTS };
    const saved = JSON.parse(raw);
    return { ...CONFIG_DEFAULTS, ...saved };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

function saveConfig() {
  if (!simulationStore) return;
  const cfg = {
    poblacion: simulationStore.poblacion,
    encuarentena: simulationStore.encuarentena,
    tiempoenfermedad: simulationStore.tiempoenfermedad,
    modozombie: simulationStore.modozombie,
    mortalidad: simulationStore.mortalidad,
    tasacontagio: simulationStore.tasacontagio,
    velocidad: simulationStore.velocidad,
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

document.addEventListener("alpine:init", () => {
  const cfg = loadConfig();

  Alpine.store(STORE_NAME, {
    poblacion: cfg.poblacion,
    encuarentena: cfg.encuarentena,
    terminado: false,
    pausado: false,
    shouldStep: false,
    tiempoenfermedad: cfg.tiempoenfermedad,
    modozombie: cfg.modozombie,
    mortalidad: cfg.mortalidad,
    tasacontagio: cfg.tasacontagio,
    velocidad: cfg.velocidad,
    r0: "0.00",
    picoEnfermos: 0,
    picoEnfermosPct: 0,
    contadores: { sanos: 0, enfermos: 0, recuperados: 0, muertos: 0 },
    personas: [],
    herramienta: 'ninguna',
    barreras: [],
  });

  simulationStore = Alpine.store(STORE_NAME);

  // Guardar config automáticamente al cambiar parámetros
  Alpine.effect(() => {
    const _ = [
      simulationStore.poblacion,
      simulationStore.encuarentena,
      simulationStore.tiempoenfermedad,
      simulationStore.modozombie,
      simulationStore.mortalidad,
      simulationStore.tasacontagio,
      simulationStore.velocidad,
    ];
    saveConfig();
  });
});

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("dataviz");

  initChart();
  reiniciarSimulacion();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (apexChart) {
    apexChart.render();
  }
}

function draw() {
  background("#0b0f19");

  if (simulationStore) {
    updateCursor();

    if (!simulationStore.pausado && !simulationStore.terminado) {
      simulateFrame();
    } else if (simulationStore.shouldStep) {
      simulateFrame();
      simulationStore.shouldStep = false;
    } else if (simulationStore.terminado) {
      // Movimiento lento post-simulación: actualizar posiciones con velocidad reducida
      const velOriginal = simulationStore.velocidad;
      simulationStore.velocidad = velOriginal * 0.15;
      for (let persona of simulationStore.personas) {
        persona.update();
      }
      simulationStore.velocidad = velOriginal;
    } else {
      for (let persona of simulationStore.personas) {
        persona.dibuja();
      }
    }

    dibujaBarreras();
    dibujaPrevisualizacionMuro();
    dibujaCursorPincel();
  }
}

function updateCursor() {
  if (!mouseClickInsideCanvas()) {
    cursor(ARROW);
    return;
  }
  if (simulationStore.herramienta === 'muro') {
    cursor(CROSS);
  } else if (simulationStore.herramienta === 'vacuna' || simulationStore.herramienta === 'infecta') {
    noCursor();
  } else {
    cursor(ARROW);
  }
}

function simulateFrame() {
  const quadtree = buildQuadTree();
  activeQuadTree = quadtree;

  const counters = updatePersonasAndCount(quadtree);
  simulationStore.contadores = counters;

  resolveCollisions(quadtree);
  updateAdvancedStats(counters);
  checkSimulationEnd(counters);
  updateHistory();
}

function buildQuadTree() {
  // Rectangle must be instantiated so left/right/top/bottom are computed in its constructor
  return new QuadTree(new Rectangle(width / 2, height / 2, width, height), 4);
}

function updatePersonasAndCount(quadtree) {
  const counters = { enfermos: 0, sanos: 0, muertos: 0, recuperados: 0 };
  for (let persona of simulationStore.personas) {
    persona.update();
    const key = COUNTER_KEY_BY_STATE[persona.estado];
    if (key) counters[key]++;
    // Uses the pre-stored Point object to avoid 'new Point' every frame
    quadtree.insert(persona.quadTreePoint);
  }
  return counters;
}

function resolveCollisions(quadtree) {
  for (let persona of simulationStore.personas) {
    // New Circle per query avoids shared query-state issues
    const queryCircle = new Circle(persona.pos.x, persona.pos.y, persona.radio * 4);
    const points = quadtree.query(queryCircle);
    for (let point of points) {
      if (point.userData !== persona) {
        persona.colisiona(point.userData);
      }
    }
  }
}

function updateAdvancedStats(counters) {
  simulationStore.r0 = calcularR0().toFixed(2);

  if (counters.enfermos > simulationStore.picoEnfermos) {
    simulationStore.picoEnfermos = counters.enfermos;
    simulationStore.picoEnfermosPct = Math.round(
      (simulationStore.picoEnfermos / simulationStore.poblacion) * 100
    );
  }
}

function checkSimulationEnd(counters) {
  if (!simulationStore.terminado && counters.enfermos === 0 && simulationStore.personas.length > 0) {
    simulationStore.terminado = true;
  }
}

function calcularR0() {
  if (!simulationStore || !simulationStore.personas || simulationStore.personas.length === 0) return 0;
  const everInfected = simulationStore.personas.filter(p => p.estado !== ESTADOS.SANO);
  if (everInfected.length === 0) return 0;
  const sum = everInfected.reduce((acc, p) => acc + (p.infectadosDirectos || 0), 0);
  return sum / everInfected.length;
}

function reiniciarSimulacion() {
  if (!simulationStore) return;
  saveConfig();
  resetStoreState();
  crearPersonas();
  resetChart();
}

function resetStoreState() {
  simulationStore.personas = [];
  simulationStore.picoEnfermos = 0;
  simulationStore.picoEnfermosPct = 0;
  simulationStore.r0 = "0.00";
  simulationStore.terminado = false;
  simulationStore.pausado = false;
  simulationStore.shouldStep = false;
  totalSimulationPopulation = simulationStore.poblacion;
  history = { sanos: [], enfermos: [], recuperados: [], muertos: [] };
}

function crearPersonas() {
  for (let i = 0; i < simulationStore.poblacion; i++) {
    simulationStore.personas.push(new Persona(random(width), random(height)));
  }
  if (simulationStore.personas.length > 0) {
    simulationStore.personas[0].setEstado(ESTADOS.ENFERMO);
  }
  aplicarCuarentenaInicial();
}

function aplicarCuarentenaInicial() {
  const numQuarantine = Math.floor((simulationStore.encuarentena * simulationStore.poblacion) / 100);
  for (let i = 1; i <= numQuarantine && i < simulationStore.personas.length; i++) {
    simulationStore.personas[i].movible = false;
  }
}

function resetChart() {
  if (!apexChart) return;
  apexChart.updateOptions({
    yaxis: { show: false, min: 0, max: simulationStore.poblacion }
  });
  apexChart.updateSeries([
    { name: 'Sanos', data: [] },
    { name: 'Enfermos', data: [] },
    { name: 'Recuperados', data: [] },
    { name: 'Fallecidos', data: [] }
  ]);
}

function updateHistory() {
  if (simulationStore.terminado || frameCount % HISTORY_SAMPLE_RATE !== 0) return;

  history.sanos.push(simulationStore.contadores.sanos);
  history.enfermos.push(simulationStore.contadores.enfermos);
  history.recuperados.push(simulationStore.contadores.recuperados);
  history.muertos.push(simulationStore.contadores.muertos);

  if (apexChart) {
    // false = no redraw animations, prevents flickering
    apexChart.updateSeries([
      { name: 'Sanos', data: [...history.sanos] },
      { name: 'Enfermos', data: [...history.enfermos] },
      { name: 'Recuperados', data: [...history.recuperados] },
      { name: 'Fallecidos', data: [...history.muertos] }
    ], false);
  }
}

function initChart() {
  const options = {
    series: [
      { name: 'Sanos', data: [] },
      { name: 'Enfermos', data: [] },
      { name: 'Recuperados', data: [] },
      { name: 'Fallecidos', data: [] }
    ],
    chart: {
      type: 'area',
      height: 200,
      animations: {
        enabled: true,
        easing: 'linear',
        dynamicAnimation: { enabled: true, speed: 400 }
      },
      toolbar: { show: false },
      sparkline: { enabled: true },
      background: 'transparent'
    },
    colors: ['#3b82f6', '#f43f5e', '#10b981', '#64748b'],
    stroke: { curve: 'smooth', width: 2 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [20, 100]
      }
    },
    tooltip: {
      theme: 'dark',
      x: { show: false },
      y: { title: { formatter: (val) => val } }
    },
    grid: { show: false },
    xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { show: false, min: 0, max: totalSimulationPopulation }
  };

  apexChart = new ApexCharts(document.querySelector("#chart-container"), options);
  apexChart.render();
}

// --- HERRAMIENTAS INTERACTIVAS Y PINCELES ---

function mouseClickInsideCanvas() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return false;

  const elem = document.elementFromPoint(mouseX, mouseY);
  if (!elem) return false;

  const isCanvas = elem.tagName.toLowerCase() === 'canvas';
  const isInsideDataviz = elem.closest('#dataviz') !== null;
  const isInsideUI = elem.closest('.sidebar') !== null ||
                     elem.closest('.stats-sidebar') !== null ||
                     elem.closest('.top-action-bar') !== null ||
                     elem.closest('.chart-drawer') !== null ||
                     elem.closest('.info-overlay') !== null ||
                     elem.closest('.sidebar-toggle') !== null;

  return (isCanvas || isInsideDataviz) && !isInsideUI;
}

function mousePressed() {
  if (!simulationStore) return;
  if (!mouseClickInsideCanvas()) return;

  if (simulationStore.herramienta === 'muro') {
    wallStart = { x: mouseX, y: mouseY };
  } else if (simulationStore.herramienta === 'vacuna' || simulationStore.herramienta === 'infecta') {
    aplicaPincelInteractiva();
  }
}

function mouseDragged() {
  if (!simulationStore) return;
  if (!mouseClickInsideCanvas()) return;

  if (simulationStore.herramienta === 'vacuna' || simulationStore.herramienta === 'infecta') {
    aplicaPincelInteractiva();
  }
}

function mouseReleased() {
  if (!simulationStore) return;

  if (simulationStore.herramienta === 'muro' && wallStart && mouseClickInsideCanvas()) {
    const wallLength = dist(wallStart.x, wallStart.y, mouseX, mouseY);
    if (wallLength > MIN_WALL_LENGTH) {
      simulationStore.barreras.push({
        x1: wallStart.x,
        y1: wallStart.y,
        x2: mouseX,
        y2: mouseY
      });
    }
  }
  wallStart = null;
}

function aplicaPincelInteractiva() {
  if (!simulationStore || !simulationStore.personas || simulationStore.personas.length === 0) return;

  const queryCircle = new Circle(mouseX, mouseY, BRUSH_RADIUS);

  let qtree = activeQuadTree;
  if (!qtree) {
    qtree = new QuadTree(new Rectangle(width / 2, height / 2, width, height), 4);
    for (let persona of simulationStore.personas) {
      qtree.insert(persona.quadTreePoint);
    }
  }

  const points = qtree.query(queryCircle);
  const isVacuna = simulationStore.herramienta === 'vacuna';

  for (let point of points) {
    const persona = point.userData;
    const dSq = (persona.pos.x - mouseX) ** 2 + (persona.pos.y - mouseY) ** 2;
    if (dSq > BRUSH_RADIUS * BRUSH_RADIUS) continue;

    if (isVacuna) {
      if (persona.estado === ESTADOS.SANO || persona.estado === ESTADOS.ENFERMO) {
        persona.setEstado(ESTADOS.RECUPERADO);
        persona.tiempoEnfermo = 0;
      }
    } else {
      if (persona.estado === ESTADOS.SANO) {
        persona.setEstado(ESTADOS.ENFERMO);
        persona.tiempoEnfermo = 0;
      }
    }
  }
}

function dibujaBarreras() {
  if (!simulationStore || !simulationStore.barreras) return;
  for (let barrier of simulationStore.barreras) {
    push();
    stroke(99, 102, 241, 100);
    strokeWeight(8);
    line(barrier.x1, barrier.y1, barrier.x2, barrier.y2);
    stroke(255, 255, 255, 220);
    strokeWeight(2);
    line(barrier.x1, barrier.y1, barrier.x2, barrier.y2);
    pop();
  }
}

function dibujaPrevisualizacionMuro() {
  if (simulationStore.herramienta === 'muro' && wallStart && mouseIsPressed && mouseClickInsideCanvas()) {
    push();
    stroke(99, 102, 241, 180);
    strokeWeight(2);
    if (drawingContext && drawingContext.setLineDash) {
      drawingContext.setLineDash([6, 4]);
    }
    line(wallStart.x, wallStart.y, mouseX, mouseY);
    if (drawingContext && drawingContext.setLineDash) {
      drawingContext.setLineDash([]);
    }
    pop();
  }
}

function dibujaCursorPincel() {
  if ((simulationStore.herramienta === 'vacuna' || simulationStore.herramienta === 'infecta') && mouseClickInsideCanvas()) {
    push();
    noFill();
    const isVacuna = simulationStore.herramienta === 'vacuna';
    stroke(isVacuna ? '#10b981' : '#f43f5e');
    strokeWeight(1.5);
    if (drawingContext && drawingContext.setLineDash) {
      drawingContext.setLineDash([4, 2]);
    }
    ellipse(mouseX, mouseY, BRUSH_RADIUS * 2, BRUSH_RADIUS * 2);
    if (drawingContext && drawingContext.setLineDash) {
      drawingContext.setLineDash([]);
    }
    fill(isVacuna ? '#10b981' : '#f43f5e');
    noStroke();
    ellipse(mouseX, mouseY, 4, 4);
    pop();
  }
}

function clearBarreras() {
  if (simulationStore) {
    simulationStore.barreras = [];
  }
}

window.clearBarreras = clearBarreras;
window.reiniciarSimulacion = reiniciarSimulacion;
window.saveConfig = saveConfig;
