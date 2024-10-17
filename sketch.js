let root;
let poblaciondesimulacion = 300;

let history = {};

document.addEventListener("alpine:init", () => {
  Alpine.store("simula", {
    poblacion: 300,
    encuarentena: 20,
    terminado: false,
    tiempoenfermedad: 150,
    modozombie: false,
    mortalidad: 50,
    contadores: {},
    personas: [],
  });

  root = Alpine.store("simula");
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
  root.personas[0].estado = "enfermo";
  //ponemos personas en cuarentena..
  for (let i = 1; i <= (root.encuarentena * root.poblacion) / 100; i++) {
    root.personas[i].movible = false;
  }

  root.terminado = false;
  poblaciondesimulacion = root.poblacion;

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

  drawLineGraph(history.sanos, color(0, 255, 0, 150), xStep, graphHeight); // lime with transparency
  drawLineGraph(history.enfermos, color(255, 165, 0, 150), xStep, graphHeight); // orange with transparency
  drawLineGraph(
    history.recuperados,
    color(0, 255, 255, 150),
    xStep,
    graphHeight
  ); // cyan with transparency
  drawLineGraph(history.muertos, color(0, 0, 0, 150), xStep, graphHeight); // black with transparency
}

function drawLineGraph(data, col, xStep, graphHeight) {
  stroke(col);
  noFill();
  beginShape();
  for (let i = 0; i < data.length; i++) {
    let x = 10 + i * xStep;
    let y =
      height - 10 - map(data[i], 0, poblaciondesimulacion, 0, graphHeight);
    vertex(x, y);
  }
  endShape();
}
