// Full-screen celebration effects. One canvas, one rAF loop, removed when the
// last particle dies. Nothing here touches ChatGPT's DOM beyond appending the
// canvas to <body>.
(() => {
  const ns = globalThis.Modelcade;

  const LAYER_Z = 2147483100;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];

  let canvas = null;
  let ctx = null;
  let frame = 0;
  let scenes = [];
  let last = 0;

  function ensureLayer() {
    if (canvas && canvas.isConnected) return canvas;
    canvas = document.createElement("canvas");
    canvas.className = "mc-fx";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.zIndex = String(LAYER_Z);
    ctx = canvas.getContext("2d");
    resize();
    document.body.appendChild(canvas);
    return canvas;
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function teardown() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    scenes = [];
    if (canvas) canvas.remove();
    canvas = null;
    ctx = null;
    window.removeEventListener("resize", resize);
  }

  function tick(now) {
    frame = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    ctx.clearRect(0, 0, width, height);
    scenes = scenes.filter((scene) => scene.step(dt, now));
    for (const scene of scenes) scene.draw(ctx, now);
    if (scenes.length) frame = requestAnimationFrame(tick);
    else teardown();
  }

  function start(scene) {
    ensureLayer();
    if (!scenes.length) {
      last = 0;
      window.addEventListener("resize", resize);
    }
    scenes.push(scene);
    if (!frame) frame = requestAnimationFrame(tick);
    return () => { scenes = scenes.filter((s) => s !== scene); if (!scenes.length) teardown(); };
  }

  // ---- building blocks ----------------------------------------------------

  function spark(x, y, opts) {
    const angle = opts.angle ?? rand(0, TAU);
    const speed = rand(opts.minSpeed, opts.maxSpeed);
    return {
      type: "spark", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: rand(opts.minSize, opts.maxSize), life: 0, ttl: rand(opts.minLife, opts.maxLife),
      color: pick(opts.colors), glow: opts.glow ?? 10, gravity: opts.gravity ?? 900, drag: opts.drag ?? 1.6,
      twinkle: opts.twinkle || false
    };
  }

  function coin(x, y, opts) {
    const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
    const speed = rand(opts.minSpeed, opts.maxSpeed);
    return {
      type: "coin", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: rand(opts.minSize, opts.maxSize), life: 0, ttl: rand(opts.minLife, opts.maxLife),
      spin: rand(0, TAU), spinSpeed: rand(6, 14) * (Math.random() < 0.5 ? -1 : 1), tilt: rand(-0.6, 0.6),
      gravity: opts.gravity ?? 1500, drag: 0.35, face: pick(opts.faces)
    };
  }

  function puff(x, y, opts) {
    const angle = rand(0, TAU);
    const speed = rand(opts.minSpeed, opts.maxSpeed);
    return {
      type: "puff", x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
      size: rand(opts.minSize, opts.maxSize), life: 0, ttl: rand(opts.minLife, opts.maxLife),
      color: pick(opts.colors), gravity: -60, drag: 2.4
    };
  }

  function ring(x, y, opts) {
    return { type: "ring", x, y, life: -(opts.delay || 0), ttl: opts.ttl, radius: opts.radius, width: opts.width, color: opts.color, glow: opts.glow ?? 0 };
  }

  function ray(x, y, opts) {
    return { type: "ray", x, y, angle: opts.angle, life: -(opts.delay || 0), ttl: opts.ttl, length: opts.length, width: opts.width, color: opts.color };
  }

  function stepParticle(p, dt) {
    p.life += dt;
    if (p.life < 0) return true;
    if (p.life > p.ttl) return false;
    if (p.type === "spark" || p.type === "coin" || p.type === "puff") {
      p.vy += p.gravity * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === "coin") p.spin += p.spinSpeed * dt;
    }
    return true;
  }

  function drawParticle(ctx, p, now) {
    if (p.life < 0) return;
    const u = p.life / p.ttl;
    if (p.type === "spark") {
      let alpha = u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9;
      if (p.twinkle) alpha *= 0.55 + 0.45 * Math.sin(now / 40 + p.x);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - u * 0.6), 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.type === "coin") {
      ctx.globalAlpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      const w = Math.max(0.12, Math.abs(Math.cos(p.spin)));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt + p.spin * 0.15);
      ctx.scale(w, 1);
      const g = ctx.createLinearGradient(-p.size, 0, p.size, 0);
      g.addColorStop(0, p.face[0]);
      g.addColorStop(0.5, p.face[1]);
      g.addColorStop(1, p.face[2]);
      ctx.fillStyle = g;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.face[1];
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.62, 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (p.type === "puff") {
      ctx.globalAlpha = (1 - u) * 0.28;
      const r = p.size * (0.4 + u * 1.6);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    } else if (p.type === "ring") {
      const e = 1 - Math.pow(1 - u, 3);
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.lineWidth = Math.max(0.6, p.width * (1 - e));
      ctx.strokeStyle = p.color;
      ctx.shadowBlur = p.glow;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, p.radius * e), 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (p.type === "ray") {
      const e = 1 - Math.pow(1 - u, 2);
      ctx.globalAlpha = (1 - u) * 0.85;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const len = p.length * e;
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, p.color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -p.width / 2);
      ctx.lineTo(len, 0);
      ctx.lineTo(0, p.width / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function makeScene(particles, flash) {
    let elapsed = 0;
    return {
      step(dt) {
        elapsed += dt;
        particles = particles.filter((p) => stepParticle(p, dt));
        return particles.length > 0 || (flash && elapsed < flash.ttl);
      },
      draw(ctx, now) {
        if (flash && elapsed < flash.ttl) {
          const u = elapsed / flash.ttl;
          const alpha = u < 0.08 ? u / 0.08 : 1 - (u - 0.08) / 0.92;
          const r = flash.radius * (0.3 + u * 0.7);
          const g = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, r);
          g.addColorStop(0, flash.core);
          g.addColorStop(0.25, flash.mid);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = Math.max(0, alpha) * flash.strength;
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight);
          ctx.globalAlpha = 1;
        }
        for (const p of particles) drawParticle(ctx, p, now);
      }
    };
  }

  // ---- celebrations --------------------------------------------------------

  function ultra(x, y, reduced) {
    const diag = Math.hypot(document.documentElement.clientWidth, document.documentElement.clientHeight);
    const flash = { x, y, radius: diag * 0.75, ttl: reduced ? 0.5 : 0.7, core: "#ffffff", mid: "rgba(166,117,255,.55)", strength: reduced ? 0.6 : 1 };
    const particles = [];
    particles.push(ring(x, y, { radius: diag * 0.55, width: 6, ttl: 0.9, color: "#c8a2ff", glow: 18 }));
    if (!reduced) {
      particles.push(ring(x, y, { radius: diag * 0.6, width: 3, ttl: 1.1, color: "#e9dcff", glow: 10, delay: 0.14 }));
      particles.push(ring(x, y, { radius: diag * 0.4, width: 10, ttl: 0.75, color: "#8b55ff", glow: 24, delay: 0.26 }));
      for (let i = 0; i < 150; i += 1) particles.push(spark(x, y, { minSpeed: 220, maxSpeed: 1500, minSize: 1.2, maxSize: 3.4, minLife: 0.7, maxLife: 1.7, colors: ["#efe4ff", "#c9a8ff", "#a675ff", "#ffffff"], glow: 12, gravity: 700 }));
      for (let i = 0; i < 46; i += 1) particles.push(coin(x, y, { minSpeed: 500, maxSpeed: 1300, minSize: 5, maxSize: 9, minLife: 1.3, maxLife: 2.1, faces: [["#b8860b", "#ffe28a", "#d9a000"], ["#6b36bf", "#efe0ff", "#9a63ff"], ["#d050ba", "#ffd2f3", "#a52d93"]] }));
      for (let i = 0; i < 14; i += 1) particles.push(puff(x, y, { minSpeed: 60, maxSpeed: 260, minSize: 40, maxSize: 90, minLife: 1, maxLife: 1.6, colors: ["rgba(166,117,255,.9)", "rgba(215,192,255,.9)"] }));
    }
    return start(makeScene(particles, flash));
  }

  function max(x, y, reduced) {
    const particles = [];
    particles.push(ring(x, y, { radius: 110, width: 4, ttl: 0.6, color: "#ffb347", glow: 14 }));
    if (!reduced) {
      for (let i = 0; i < 36; i += 1) particles.push(spark(x, y, { minSpeed: 120, maxSpeed: 620, minSize: 1, maxSize: 2.6, minLife: 0.5, maxLife: 1.1, colors: ["#ffd36a", "#ff8a1f", "#ff5a1f", "#fff1c9"], glow: 10, gravity: 500 }));
      for (let i = 0; i < 5; i += 1) particles.push(puff(x, y, { minSpeed: 30, maxSpeed: 120, minSize: 24, maxSize: 48, minLife: 0.7, maxLife: 1.1, colors: ["rgba(255,140,40,.9)", "rgba(255,80,20,.9)"] }));
    }
    const flash = { x, y, radius: 260, ttl: 0.45, core: "#fff3d0", mid: "rgba(255,150,50,.45)", strength: reduced ? 0.5 : 0.8 };
    return start(makeScene(particles, flash));
  }

  function pro(x, y, reduced) {
    const particles = [];
    particles.push(ring(x, y, { radius: 140, width: 2.5, ttl: 0.7, color: "#fff6dd", glow: 12 }));
    if (!reduced) {
      for (let i = 0; i < 8; i += 1) particles.push(ray(x, y, { angle: (i / 8) * TAU + rand(-0.1, 0.1), length: rand(90, 170), width: 7, ttl: 0.55, color: "#fff8e6", delay: i % 2 ? 0.05 : 0 }));
      for (let i = 0; i < 30; i += 1) particles.push(spark(x, y, { minSpeed: 60, maxSpeed: 380, minSize: 0.8, maxSize: 2.2, minLife: 0.6, maxLife: 1.3, colors: ["#ffffff", "#fff3c4", "#e4f7ff"], glow: 8, gravity: 240, drag: 1.2, twinkle: true }));
    }
    const flash = { x, y, radius: 240, ttl: 0.5, core: "#ffffff", mid: "rgba(255,240,200,.5)", strength: reduced ? 0.45 : 0.75 };
    return start(makeScene(particles, flash));
  }

  // burst({ x, y, kind, reducedMotion }) → cancel()
  function burst({ x, y, kind = "ultra", reducedMotion = false }) {
    const fn = kind === "max" ? max : kind === "pro" ? pro : ultra;
    return fn(x, y, Boolean(reducedMotion));
  }

  ns.fx = { burst, destroy: teardown };
})();
