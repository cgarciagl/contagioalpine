let root;

let miGrafico;

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
  var canvas = createCanvas(800, 300);
  canvas.parent("dataviz");

  var ctx = document.getElementById("miGrafico").getContext("2d");

  // Crea el gráfico de líneas con 4 series vacías
  miGrafico = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Sanos",
          borderColor: "lime",
          borderWidth: 2,
          fill: false,
          data: [],
        },
        {
          label: "Enfermos",
          borderColor: "orange",
          borderWidth: 2,
          fill: false,
          data: [],
        },
        {
          label: "Recuperados",
          borderColor: "cyan",
          borderWidth: 2,
          fill: false,
          data: [],
        },
        {
          label: "Fallecidos",
          borderColor: "black",
          borderWidth: 2,
          fill: false,
          data: [],
        },
      ],
    },
    stacked: true,
    options: {
      height: 200,
      animation: {
        duration: 0, // Desactiva las animaciones
      },
      plugins: {
        legend: {
          display: false, // Oculta la leyenda
        },
      },
      scales: {
        x: [
          {
            display: false, // Oculta las etiquetas en el eje X
          },
        ],
        y: [
          {
            display: false, // Oculta las etiquetas en el eje Y
            ticks: {
              max: 100, // Establece el máximo en el eje Y
            },
          },
        ],
      },
    },
  });

  Reinicia();
}

function draw() {
  fill("#EAEAEA");
  rect(0, 0, width, height);
  checarColisionesyActualizaContadores();
  mostrarChart();
}

function mostrarChart() {
  let i = frameCount % width;

  let pob = root.personas.length || 1;

  /* stroke("orange");
  let prop = (root.contadores.enfermos / pob) * 100;
  let ult = height - prop;
  line(i, ult, i, height);
  stroke("cyan"); //lightblue
  prop = (root.contadores.recuperados / pob) * 100;
  line(i, ult - prop, i, ult);
  ult = ult - prop;
  stroke("black"); //black
  prop = (root.contadores.muertos / pob) * 100;
  line(i, ult - prop, i, ult);
  ult = ult - prop;
  stroke("lime"); //lime
  prop = (root.contadores.sanos / pob) * 100;
  line(i, ult - prop, i, ult);
  ult = ult - prop;

  strokeWeight(1);
  stroke("black");*/

  if (!root.terminado) {
    miGrafico.data.labels.push("");
    miGrafico.data.datasets[0].data.push(root.contadores.sanos);
    miGrafico.data.datasets[1].data.push(root.contadores.enfermos);
    miGrafico.data.datasets[2].data.push(root.contadores.recuperados);
    miGrafico.data.datasets[3].data.push(root.contadores.fallecidos);
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
      miGrafico.update();
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
  miGrafico.data.labels = [];

  for (var i = 0; i < miGrafico.data.datasets.length; i++) {
    miGrafico.data.datasets[i].data = [];
  }

  // Actualiza el gráfico después de limpiar los datos
  miGrafico.update();
}
