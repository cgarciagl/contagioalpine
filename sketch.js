let root;
let totalSimulationPopulation = 300;

let history = {};

const DEFAULT_POBLACION = 300;
const DEFAULT_ENCUARENTENA = 20;
const DEFAULT_TIEMPO_ENFERMEDAD = 150;
const DEFAULT_MORTALIDAD = 50;
const DEFAULT_MODO_ZOMBIE = false;
const STORE_NAME = "simula";

document.addEventListener("alpine:init", () => {
  Alpine.store(STORE_NAME, {
    poblacion: DEFAULT_POBLACION,
    encuarentena: DEFAULT_ENCUARENTENA,
    terminado: false,
    tiempoenfermedad: DEFAULT_TIEMPO_ENFERMEDAD,
    modozombie: DEFAULT_MODO_ZOMBIE,
    mortalidad: DEFAULT_MORTALIDAD,
    contadores: {},
    personas: [],
  });

  root = Alpine.store(STORE_NAME);
});

function setup() {
  var canvas = createCanvas(800, 400);
  canvas.parent("dataviz");
  Reinicia();
}

function draw() {
  fill("#EAEAEA");
  rect(0, 0, width, height);
  checarColisionesyActualizaContadores();
}

function checarColisionesyActualizaContadores() {
  const r = new Rectangle(400, 250, 800, 500);
  const capacity = 4;
  const quadtree = new QuadTree(r, capacity);

  root.contadores = {
    enfermos: 0,
    sanos: 0,
    muertos: 0,
    recuperados: 0,
  };

  root.personas.forEach(function (value1, i) {
    value1.update();
    root.contadores[value1.estado + "s"]++;
    let p = new Point(value1.pos.x, value1.pos.y, value1);
    quadtree.insert(p);
  });

  root.personas.forEach(function (value1, i) {
    let c = new Circle(value1.pos.x, value1.pos.y, 10);
    let puntos = quadtree.query(c);

    puntos.forEach(function (punto, i) {
      let value2 = punto.userData;
      if (value2 != value1) {
        value1.colisiona(value2);
      }
    });
  });

  if (root.contadores.enfermos == 0) {
    if (!root.terminado) {
      root.terminado = true;
    }
  }

  updateHistory();
  drawGraph();
}

function Reinicia() {
  while (root.personas.length > 0) {
    root.personas.pop();
  }
  for (let i = 1; i <= root.poblacion; i++) {
    root.personas.push(new Persona(random(width - 10), random(390)));
  }
  root.personas[0].estado = ESTADOS.ENFERMO; //ponemos a la primera persona enferma
  //ponemos personas en cuarentena..
  for (let i = 1; i <= (root.encuarentena * root.poblacion) / 100; i++) {
    root.personas[i].movible = false;
  }

  root.terminado = false;
  totalSimulationPopulation = root.poblacion;

  history = {
    sanos: [],
    enfermos: [],
    recuperados: [],
    muertos: [],
  };
}

function updateHistory() {
  if (!root.terminado) {
    history.sanos.push(root.contadores.sanos);
    history.enfermos.push(root.contadores.enfermos);
    history.recuperados.push(root.contadores.recuperados);
    history.muertos.push(root.contadores.muertos);
  }
}

function drawGraph() {
  let maxIterations = history.sanos.length;
  let graphHeight = 100;
  let graphWidth = width - 20;
  let xStep = graphWidth / maxIterations;

  // Colores extraídos a variables
  const colorSanos = color(0, 255, 0, 150); // lime con transparencia
  const colorEnfermos = color(255, 165, 0, 150); // naranja con transparencia
  const colorRecuperados = color(0, 255, 255, 150); // cyan con transparencia
  const colorMuertos = color(0, 0, 0, 150); // negro con transparencia

  drawLineGraph(history.sanos, colorSanos, xStep, graphHeight);
  drawLineGraph(history.enfermos, colorEnfermos, xStep, graphHeight);
  drawLineGraph(history.recuperados, colorRecuperados, xStep, graphHeight);
  drawLineGraph(history.muertos, colorMuertos, xStep, graphHeight);
}

function drawLineGraph(data, col, xStep, graphHeight) {
  stroke(col);
  noFill();
  beginShape();
  for (let i = 0; i < data.length; i++) {
    let x = 10 + i * xStep;
    let y =
      height - 10 - map(data[i], 0, totalSimulationPopulation, 0, graphHeight);
    vertex(x, y);
  }
  endShape();
}
