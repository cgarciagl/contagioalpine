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

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-4, 4), random(-4, 4));
    this.radio = 4;
    this.estado = ESTADOS.SANO;
    this.tiempoenfermo = 0;
    this.movible = true;
    this.pulseRadius = 0; // Para el efecto visual de contagio
    this.history = []; // Para estelas individuales sugeridas
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
    push();
    noStroke();
    
    // Efecto de estela pequeña (mini-trail)
    if (this.movible && this.estado !== ESTADOS.MUERTO) {
      for (let i = 0; i < this.history.length; i++) {
        let pos = this.history[i];
        let alpha = map(i, 0, this.history.length, 10, 50);
        fill(colorEstado[this.estado] + Math.floor(alpha).toString(16).padStart(2, '0'));
        ellipse(pos.x, pos.y, this.radio * 1.5, this.radio * 1.5);
      }
    }

    // Efecto de pulso en el momento del contagio
    if (this.pulseRadius > 0) {
      noFill();
      stroke(colorEstado[ESTADOS.ENFERMO] + "88");
      strokeWeight(2);
      ellipse(this.pos.x, this.pos.y, this.pulseRadius, this.pulseRadius);
      this.pulseRadius += 2;
      if (this.pulseRadius > 40) this.pulseRadius = 0;
    }
    
    // Resplandor para enfermos o zombies
    if (this.estado === ESTADOS.ENFERMO || (this.estado === ESTADOS.MUERTO && root.modozombie)) {
      fill(colorEstado[this.estado] + "33"); 
      ellipse(this.pos.x, this.pos.y, this.radio * 5, this.radio * 5);
    }

    fill(colorEstado[this.estado]);
    stroke(255, 80);
    strokeWeight(1);
    ellipse(this.pos.x, this.pos.y, this.radio * 2, this.radio * 2);
    pop();
  }

  update() {
    if (this.movible) {
      // Guardar historial para estelas
      this.history.push(this.pos.copy());
      if (this.history.length > 5) this.history.shift();

      let currentVel = p5.Vector.mult(this.vel, root.velocidad || 1);
      this.pos.add(currentVel);
      this.rebotarConParedes();
    }

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

  colisiona(p) {
    const d = dist(this.pos.x, this.pos.y, p.pos.x, p.pos.y);
    const minD = this.radio + p.radio;
    
    if (d < minD) {
      // Prevent overlapping
      const overlap = minD - d;
      const move = p5.Vector.sub(this.pos, p.pos).setMag(overlap / 2);
      this.pos.add(move);
      p.pos.sub(move);

      // Infection logic
      if (this.estado === ESTADOS.ENFERMO || p.estado === ESTADOS.ENFERMO) {
        this.intentarContagio();
        p.intentarContagio();
      }

      if (root.modozombie && (this.estado === ESTADOS.MUERTO || p.estado === ESTADOS.MUERTO)) {
        this.intentarContagio();
        p.intentarContagio();
      }

      // Simple elastic collision response (randomized for variety)
      this.vel.rotate(random(-PI/8, PI/8));
      p.vel.rotate(random(-PI/8, PI/8));
    }
  }

  intentarContagio() {
    if (this.estado === ESTADOS.SANO) {
      this.setEstado(ESTADOS.ENFERMO);
      this.pulseRadius = 1; // Iniciar efecto visual de pulso
    }
  }
}
