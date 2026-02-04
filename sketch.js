let root;
let totalSimulationPopulation = 300;
let history = { sanos: [], enfermos: [], recuperados: [], muertos: [] };
let graphBuffer;
let apexChart;

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
    velocidad: 1.5,
    contadores: { sanos: 0, enfermos: 0, recuperados: 0, muertos: 0 },
    personas: [],
  });

  root = Alpine.store(STORE_NAME);
});

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("dataviz");
  
  initChart();
  Reinicia();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (apexChart) {
    apexChart.render(); // Redraw chart for new dimensions
  }
}

function draw() {
  background("#0f172a"); 
  
  checarColisionesyActualizaContadores();
}

function checarColisionesyActualizaContadores() {
  const quadtree = new QuadTree(new Rectangle(width / 2, height / 2, width, height), 4);

  const currentContadores = {
    enfermos: 0,
    sanos: 0,
    muertos: 0,
    recuperados: 0,
  };

  for (let persona of root.personas) {
    persona.update();
    currentContadores[persona.estado + "s"]++;
    quadtree.insert(new Point(persona.pos.x, persona.pos.y, persona));
  }

  // Update store only once per frame
  root.contadores = currentContadores;

  for (let persona of root.personas) {
    // Optimization: sick or dead (in zombie mode) can infect others
    const canInfect = (persona.estado === ESTADOS.ENFERMO || (root.modozombie && persona.estado === ESTADOS.MUERTO));
    
    let queryCircle = new Circle(persona.pos.x, persona.pos.y, persona.radio * 4);
    let points = quadtree.query(queryCircle);

    for (let point of points) {
      let other = point.userData;
      if (other !== persona) {
        persona.colisiona(other);
      }
    }
  }

  if (currentContadores.enfermos === 0 && root.personas.length > 0) {
    if (!root.terminado) {
      root.terminado = true;
    }
  }

  updateHistory();
}

function Reinicia() {
  root.personas = [];
  for (let i = 0; i < root.poblacion; i++) {
    root.personas.push(new Persona(random(width), random(height)));
  }
  
  // Infect the first person
  root.personas[0].setEstado(ESTADOS.ENFERMO);
  
  // Set quarantine
  const numQuarantine = Math.floor((root.encuarentena * root.poblacion) / 100);
  for (let i = 1; i <= numQuarantine; i++) {
    root.personas[i].movible = false;
  }

  root.terminado = false;
  totalSimulationPopulation = root.poblacion;

  history = { sanos: [], enfermos: [], recuperados: [], muertos: [] };
  if (apexChart) {
    apexChart.updateOptions({
      yaxis: { show: false, min: 0, max: root.poblacion }
    });
    apexChart.updateSeries([
      { name: 'Sanos', data: [] },
      { name: 'Enfermos', data: [] },
      { name: 'Recuperados', data: [] },
      { name: 'Fallecidos', data: [] }
    ]);
  }
}

function updateHistory() {
  if (!root.terminado && frameCount % 30 === 0) { // Actualizar cada 30 frames para mayor fluidez
    history.sanos.push(root.contadores.sanos);
    history.enfermos.push(root.contadores.enfermos);
    history.recuperados.push(root.contadores.recuperados);
    history.muertos.push(root.contadores.muertos);

    if (apexChart) {
      // Usar false para que no haya animaciones de redibujo que causen parpadeo
      apexChart.updateSeries([
        { name: 'Sanos', data: [...history.sanos] },
        { name: 'Enfermos', data: [...history.enfermos] },
        { name: 'Recuperados', data: [...history.recuperados] },
        { name: 'Fallecidos', data: [...history.muertos] }
      ], false); 
    }
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
