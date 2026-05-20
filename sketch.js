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
    pausado: false,
    shouldStep: false,
    tiempoenfermedad: DEFAULT_TIEMPO_ENFERMEDAD,
    modozombie: DEFAULT_MODO_ZOMBIE,
    mortalidad: DEFAULT_MORTALIDAD,
    tasacontagio: 90,
    velocidad: 1.5,
    r0: "0.00",
    picoEnfermos: 0,
    picoEnfermosPct: 0,
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
  background("#0b0f19"); 
  
  if (root) {
    if (!root.pausado && !root.terminado) {
      checarColisionesyActualizaContadores();
    } else if (root.shouldStep) {
      checarColisionesyActualizaContadores();
      root.shouldStep = false;
    } else {
      // Dibujar estáticamente cuando está pausado
      for (let persona of root.personas) {
        persona.dibuja();
      }
    }
  }
}

function calcularR0() {
  if (!root || !root.personas || root.personas.length === 0) return 0;
  const everInfected = root.personas.filter(p => p.estado !== ESTADOS.SANO);
  if (everInfected.length === 0) return 0;
  const sum = everInfected.reduce((acc, p) => acc + (p.infectadosDirectos || 0), 0);
  return sum / everInfected.length;
}

function checarColisionesyActualizaContadores() {
  // Es indispensable instanciar Rectangle para que se calculen correctamente left, right, top, bottom en su constructor
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
    // Optimización: Usar el objeto Point persistente pre-guardado de la persona (evita 'new Point')
    quadtree.insert(persona.quadTreePoint);
  }

  // Update store only once per frame
  root.contadores = currentContadores;

  // Actualizar estadísticas avanzadas
  const r0Val = calcularR0();
  root.r0 = r0Val.toFixed(2);

  if (currentContadores.enfermos > root.picoEnfermos) {
    root.picoEnfermos = currentContadores.enfermos;
    root.picoEnfermosPct = Math.round((root.picoEnfermos / root.poblacion) * 100);
  }

  for (let persona of root.personas) {
    // Instanciar Circle de forma limpia para evitar problemas con estados compartidos de consulta
    const queryCircle = new Circle(persona.pos.x, persona.pos.y, persona.radio * 4);
    const points = quadtree.query(queryCircle);

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
  if (!root) return;

  root.personas = [];
  root.picoEnfermos = 0;
  root.picoEnfermosPct = 0;
  root.r0 = "0.00";

  for (let i = 0; i < root.poblacion; i++) {
    root.personas.push(new Persona(random(width), random(height)));
  }
  
  // Infect the first person
  if (root.personas.length > 0) {
    root.personas[0].setEstado(ESTADOS.ENFERMO);
  }
  
  // Set quarantine
  const numQuarantine = Math.floor((root.encuarentena * root.poblacion) / 100);
  for (let i = 1; i <= numQuarantine && i < root.personas.length; i++) {
    root.personas[i].movible = false;
  }

  root.terminado = false;
  root.pausado = false;
  root.shouldStep = false;
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
