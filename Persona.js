const ESTADOS = Object.freeze({
  SANO: "sano",
  ENFERMO: "enfermo",
  RECUPERADO: "recuperado",
  MUERTO: "muerto",
});

const colorEstado = {
  [ESTADOS.SANO]: "#3b82f6",      // Azul
  [ESTADOS.ENFERMO]: "#f43f5e",   // Rojo/Rosa
  [ESTADOS.RECUPERADO]: "#10b981", // Verde
  [ESTADOS.MUERTO]: "#64748b",    // Gris
};

const colorEstadoRGB = {
  [ESTADOS.SANO]: [59, 130, 246],      // #3b82f6
  [ESTADOS.ENFERMO]: [244, 63, 94],    // #f43f5e
  [ESTADOS.RECUPERADO]: [16, 185, 129], // #10b981
  [ESTADOS.MUERTO]: [100, 116, 139],    // #64748b
};

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-4, 4), random(-4, 4));
    this.radio = 4;
    this.estado = ESTADOS.SANO;
    this.tiempoenfermo = 0;
    this.movible = true;
    this.infectadosDirectos = 0;
    this.infectadoPor = null;

    // Optimización: punto de Quadtree pre-guardado para evitar 'new Point' en cada frame
    this.quadTreePoint = new Point(x, y, this);
  }

  setEstado(nuevoEstado) {
    this.estado = nuevoEstado;
    if (nuevoEstado === ESTADOS.MUERTO) {
      this.movible = !!root.modozombie;
      if (!root.modozombie) {
        this.vel.mult(0);
      }
    }
    
    // Slow down recovered or dead
    if (nuevoEstado === ESTADOS.RECUPERADO) {
      this.vel.mult(0.5);
    }
  }

  dibuja() {
    const rgb = colorEstadoRGB[this.estado];

    // 1. Dibujar auras de contagio pulsantes
    if (this.estado === ESTADOS.ENFERMO) {
      push();
      noStroke();
      const pulse = sin(frameCount * 0.1) * 3 + 5;
      fill(rgb[0], rgb[1], rgb[2], 30);
      ellipse(this.pos.x, this.pos.y, (this.radio + pulse) * 2, (this.radio + pulse) * 2);
      pop();
    } else if (this.estado === ESTADOS.MUERTO && this.movible) {
      push();
      noStroke();
      const zombiePulse = sin(frameCount * 0.15) * 2 + 4;
      fill(16, 185, 129, 45); // Brillo verde zombi
      ellipse(this.pos.x, this.pos.y, (this.radio + zombiePulse) * 2, (this.radio + zombiePulse) * 2);
      pop();
    }

    // 2. Dibujar anillo de cuarentena
    if (!this.movible && this.estado !== ESTADOS.MUERTO) {
      push();
      noFill();
      stroke(rgb[0], rgb[1], rgb[2], 180);
      strokeWeight(1.5);
      if (drawingContext && drawingContext.setLineDash) {
        drawingContext.setLineDash([4, 3]);
      }
      ellipse(this.pos.x, this.pos.y, (this.radio + 4) * 2, (this.radio + 4) * 2);
      if (drawingContext && drawingContext.setLineDash) {
        drawingContext.setLineDash([]);
      }
      pop();
    }

    // 3. Dibujar el cuerpo del agente
    push();
    noStroke();
    fill(rgb[0], rgb[1], rgb[2]);
    stroke(255, 120);
    strokeWeight(1);
    ellipse(this.pos.x, this.pos.y, this.radio * 2, this.radio * 2);
    pop();
  }

  update() {
    if (this.movible) {
      // Aritmética directa de componentes (evita instanciar un nuevo vector con p5.Vector.mult)
      const velFactor = root.velocidad || 1;
      this.pos.x += this.vel.x * velFactor;
      this.pos.y += this.vel.y * velFactor;

      this.rebotarConParedes();
      this.rebotarConBarreras();
    }

    // Mantener la posición del punto Quadtree sincronizada para la detección de colisiones
    this.quadTreePoint.x = this.pos.x;
    this.quadTreePoint.y = this.pos.y;

    if (this.estado === ESTADOS.ENFERMO) {
      this.tiempoenfermo++;
      if (this.tiempoenfermo > root.tiempoenfermedad) {
        this.resolverEnfermedad();
      }
    }

    this.dibuja();
  }

  resolverEnfermedad() {
    if (random(0, 100) <= root.mortalidad) {
      this.setEstado(ESTADOS.MUERTO);
    } else {
      // In zombie mode, everyone who would be "recovered" becomes dead but movible
      if (root.modozombie) {
        this.setEstado(ESTADOS.MUERTO);
      } else {
        this.setEstado(ESTADOS.RECUPERADO);
      }
    }

    // Registrar los contagios directos que realizó este agente para calcular el R0
    if (window.registrarResolucionInfeccion) {
      window.registrarResolucionInfeccion(this.infectadosDirectos);
    }
  }

  rebotarConParedes() {
    if (this.pos.x < this.radio || this.pos.x > width - this.radio) {
      this.vel.x *= -1;
      this.pos.x = constrain(this.pos.x, this.radio, width - this.radio);
    }
    if (this.pos.y < this.radio || this.pos.y > height - this.radio) {
      this.vel.y *= -1;
      this.pos.y = constrain(this.pos.y, this.radio, height - this.radio);
    }
  }

  rebotarConBarreras() {
    if (!root || !root.barreras || root.barreras.length === 0) return;

    for (let b of root.barreras) {
      const abx = b.x2 - b.x1;
      const aby = b.y2 - b.y1;
      
      const apx = this.pos.x - b.x1;
      const apy = this.pos.y - b.y1;

      const ab2 = abx * abx + aby * aby;
      if (ab2 === 0) continue;

      let t = (apx * abx + apy * aby) / ab2;
      t = constrain(t, 0, 1);

      const closestX = b.x1 + t * abx;
      const closestY = b.y1 + t * aby;

      const dx = this.pos.x - closestX;
      const dy = this.pos.y - closestY;
      const distSq = dx * dx + dy * dy;

      const r = this.radio;
      if (distSq < r * r) {
        const d = Math.sqrt(distSq);
        
        if (d > 0) {
          const overlap = r - d;
          this.pos.x += (dx / d) * overlap;
          this.pos.y += (dy / d) * overlap;

          const nx = dx / d;
          const ny = dy / d;

          const dot = this.vel.x * nx + this.vel.y * ny;
          if (dot < 0) {
            this.vel.x = this.vel.x - 2 * dot * nx;
            this.vel.y = this.vel.y - 2 * dot * ny;
          }
        } else {
          this.pos.x += random(-1, 1) * r;
          this.pos.y += random(-1, 1) * r;
          this.vel.x *= -1;
          this.vel.y *= -1;
        }
      }
    }
  }

  colisiona(p) {
    // Optimización: Primero verificar con la distancia al cuadrado (evita Math.sqrt/dist en la mayoría de casos)
    const dx = this.pos.x - p.pos.x;
    const dy = this.pos.y - p.pos.y;
    const dSq = dx * dx + dy * dy;
    const minD = this.radio + p.radio;
    const minDSq = minD * minD;
    
    if (dSq < minDSq) {
      const d = Math.sqrt(dSq);
      // Prevent overlapping
      const overlap = minD - d;
      
      // Optimización: Aritmética directa de componentes (evita instanciar p5.Vector y .setMag)
      if (d > 0) {
        const moveX = (dx / d) * (overlap / 2);
        const moveY = (dy / d) * (overlap / 2);
        this.pos.x += moveX;
        this.pos.y += moveY;
        p.pos.x -= moveX;
        p.pos.y -= moveY;
      }

      // Lógica de infección direccional con rastreo para R0
      if (this.estado === ESTADOS.ENFERMO && p.estado === ESTADOS.SANO) {
        p.intentarContagio(this);
      } else if (p.estado === ESTADOS.ENFERMO && this.estado === ESTADOS.SANO) {
        this.intentarContagio(p);
      }

      // Modo Zombie
      if (root.modozombie) {
        if (this.estado === ESTADOS.MUERTO && this.movible && p.estado === ESTADOS.SANO) {
          p.intentarContagio(this);
        } else if (p.estado === ESTADOS.MUERTO && p.movible && this.estado === ESTADOS.SANO) {
          this.intentarContagio(p);
        }
      }

      // Simple elastic collision response (randomized for variety)
      this.vel.rotate(random(-PI/8, PI/8));
      p.vel.rotate(random(-PI/8, PI/8));
    }
  }

  intentarContagio(infector) {
    if (this.estado === ESTADOS.SANO) {
      const prob = root.tasacontagio !== undefined ? root.tasacontagio : 100;
      if (random(0, 100) <= prob) {
        this.setEstado(ESTADOS.ENFERMO);
        this.tiempoenfermo = 0;
        if (infector) {
          this.infectadoPor = infector;
          infector.infectadosDirectos = (infector.infectadosDirectos || 0) + 1;
        }
      }
    }
  }
}
