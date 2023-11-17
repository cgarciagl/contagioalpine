let colorEstado = {
  sano: "lime",
  enfermo: "orange",
  recuperado: "cyan",
  muerto: "black",
};

class Persona {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-3, 3), random(-3, 3));
    this.radio = 3;
    this.estado = "sano";
    this.tiempoenfermo = 0;
    this.movible = true;
  }

  dibuja() {
    fill(colorEstado[this.estado]);
    stroke("black");
    ellipse(this.pos.x, this.pos.y, this.radio * 2, this.radio * 2);
  }

  update() {
    if (this.movible) {
      this.pos.add(this.vel);
      this.rebotarConParedes();
    }

    if (this.estado == "enfermo") {
      this.tiempoenfermo++;
    }

    if (
      this.estado == "enfermo" &&
      this.tiempoenfermo > root.tiempoenfermedad
    ) {
      this.muerto();
    }

    this.dibuja();
  }

  muerto() {
    if (random(1, 100) <= root.mortalidad) {
      this.estado = "muerto";
      this.movible = false;
      if (root.modozombie) {
        this.movible = true;
      }
    } else {
      this.estado = "recuperado";
      if (root.modozombie) {
        this.estado = "muerto";
        this.movible = true;
      }
    }
    this.vel.div(5);
  }

  rebotarConParedes() {
    if (
      this.pos.x - this.radio < 0 ||
      this.pos.y - this.radio < 0 ||
      this.pos.x + this.radio > width ||
      this.pos.y + this.radio > height - 100
    ) {
      this.vel.rotate(HALF_PI);
      this.pos.x = constrain(this.pos.x, this.radio, width - this.radio);
      this.pos.y = constrain(this.pos.y, this.radio, height - this.radio - 100);
    }
  }

  colisiona(p) {
    if (dist(this.pos.x, this.pos.y, p.pos.x, p.pos.y) <= this.radio * 2) {
      if (this.estado == "enfermo" || p.estado == "enfermo") {
        this.contagiado();
      }

      if (root.modozombie) {
        if (this.estado == "muerto" || p.estado == "muerto") {
          this.contagiado();
        }
      }

      this.vel.rotate(random(HALF_PI));
    }
  }

  contagiado() {
    if (this.estado == "sano") {
      this.estado = "enfermo";
    }
  }
}
