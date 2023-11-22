let root;

var data = {};
var chart = {};
// Configura las opciones del gráfico
var options = {
  curveType: "function",
  legend: { position: "none" }, // Oculta la leyenda
  colors: ["lime", "orange", "cyan", "black"],
  vAxis: {
    textPosition: "none", // No muestra la escala del eje y
    viewWindow: {
      min: 0, // Inicia la escala del eje y en 0
    },
  },
};

google.charts.load("current", { packages: ["corechart"] });
google.charts.setOnLoadCallback(inicializarGrafico);

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

function inicializarGrafico() {
  // Define la estructura de los datos
  data = new google.visualization.DataTable();
  data.addColumn("string", "X");
  data.addColumn("number", "Sanos");
  data.addColumn("number", "Enfermos");
  data.addColumn("number", "Recuperados");
  data.addColumn("number", "Muertos");

  // Crea el gráfico de líneas
  chart = new google.visualization.AreaChart(
    document.getElementById("miGrafico")
  );
  Reinicia();
}

function setup() {
  var canvas = createCanvas(800, 400);
  canvas.parent("dataviz");
  inicializarGrafico;
}

function draw() {
  fill("#EAEAEA");
  rect(0, 0, width, height);
  checarColisionesyActualizaContadores();
  mostrarChart();
}

function mostrarChart() {
  let i = frameCount % width;

  if (!root.terminado) {
    if (i % 15 == 0) {
      var dataValues = [];
      dataValues.push([
        "",
        root.contadores.sanos,
        root.contadores.enfermos,
        root.contadores.recuperados,
        root.contadores.muertos,
      ]);

      data.addRows(dataValues);
      chart.draw(data, options);
    }
  }

  strokeWeight(1);
  stroke("black");
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
      chart.draw(data, options);
    }
  }
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
  limpiarDatos();
}

function limpiarDatos() {
  data.removeRows(0, data.getNumberOfRows());
}
