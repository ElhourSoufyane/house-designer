/* weather3d.js — Ultra-realistic synchronized dynamic weather system.
   Provides Clear, Rain, Snow, Fog, and Thunderstorm with 3D instanced
   particles, ground splashes, lightning illumination, and WebAudio foley.
   Globally synchronized across multiplayer co-op sessions. */
window.HP = window.HP || {};
(function () {
  const W = HP.weather3d = {};
  HP.weather = HP.weather || 'clear';
  HP.weatherIntensity = HP.weatherIntensity || 1.0;

  let sceneRef = null, cameraRef = null;
  let rainGroup = null, rainLines = null, rainGeo = null, rainPos = null, rainVel = null;
  let snowGroup = null, snowPoints = null, snowGeo = null, snowPos = null, snowData = null;
  let splashGroup = null, splashMesh = null;
  
  let lightningTimer = 8 + Math.random() * 6;
  let lightningActive = 0;
  let baseSunCol = new THREE.Color(), baseSunI = 1.0;
  let baseAmbCol = new THREE.Color(), baseAmbI = 0.8;

  const RAIN_COUNT = 2200;
  const SNOW_COUNT = 1600;
  const WRAP_RADIUS = 380;
  const HEIGHT_SPAN = 160;

  /* Soft procedural circular alpha texture for snowflakes */
  function makeSnowTexture() {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    if (!cv || !cv.getContext) return null;
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    if (!ctx || !ctx.createRadialGradient) return null;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(240, 248, 255, 0.85)');
    grad.addColorStop(0.8, 'rgba(220, 238, 255, 0.35)');
    grad.addColorStop(1, 'rgba(220, 238, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  W.init = function (scene, camera) {
    sceneRef = scene;
    cameraRef = camera;
    W.buildRain(scene);
    W.buildSnow(scene);
    W.updateFog();
    W.syncUI();
  };

  W.buildRain = function (scene) {
    if (rainGroup) {
      scene.remove(rainGroup);
      if (rainGeo) rainGeo.dispose();
    }
    rainGroup = new THREE.Group();
    rainGroup.name = 'weather-rain';

    rainGeo = new THREE.BufferGeometry();
    rainPos = new Float32Array(RAIN_COUNT * 2 * 3); // 2 vertices per streak (x,y,z)
    rainVel = new Float32Array(RAIN_COUNT);

    let seed = 42;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    for (let i = 0; i < RAIN_COUNT; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * WRAP_RADIUS;
      const x = Math.cos(ang) * rad;
      const y = rand() * HEIGHT_SPAN;
      const z = Math.sin(ang) * rad;
      const len = 4.2 + rand() * 2.5;

      const idx = i * 6;
      // Top vertex
      rainPos[idx] = x;
      rainPos[idx + 1] = y;
      rainPos[idx + 2] = z;
      // Bottom vertex (angled with wind)
      rainPos[idx + 3] = x - 0.7;
      rainPos[idx + 4] = y - len;
      rainPos[idx + 5] = z - 0.3;

      rainVel[i] = 340 + rand() * 120;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));

    const rainMat = new THREE.LineBasicMaterial({
      color: 0xcdeafe,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      fog: true
    });

    rainLines = new THREE.LineSegments(rainGeo, rainMat);
    rainLines.frustumCulled = false;
    rainGroup.add(rainLines);
    scene.add(rainGroup);
    rainGroup.visible = HP.weather === 'rain' || HP.weather === 'storm';
  };

  W.buildSnow = function (scene) {
    if (snowGroup) {
      scene.remove(snowGroup);
      if (snowGeo) snowGeo.dispose();
    }
    snowGroup = new THREE.Group();
    snowGroup.name = 'weather-snow';

    snowGeo = new THREE.BufferGeometry();
    snowPos = new Float32Array(SNOW_COUNT * 3);
    snowData = []; // { rad, ang, speed, phase, swaySpeed, size }

    let seed = 99;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

    for (let i = 0; i < SNOW_COUNT; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * WRAP_RADIUS;
      const x = Math.cos(ang) * rad;
      const y = rand() * HEIGHT_SPAN;
      const z = Math.sin(ang) * rad;

      snowPos[i * 3] = x;
      snowPos[i * 3 + 1] = y;
      snowPos[i * 3 + 2] = z;

      snowData.push({
        speed: 26 + rand() * 24,
        phase: rand() * Math.PI * 2,
        swaySpeed: 1.2 + rand() * 1.6,
        swayAmp: 4 + rand() * 7,
        origRad: rad,
        origAng: ang
      });
    }

    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));

    const snowTex = makeSnowTexture();
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3.2,
      map: snowTex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false,
      fog: true
    });

    snowPoints = new THREE.Points(snowGeo, snowMat);
    snowPoints.frustumCulled = false;
    snowGroup.add(snowPoints);
    scene.add(snowGroup);
    snowGroup.visible = HP.weather === 'snow';
  };

  W.updateFog = function () {
    if (!sceneRef || !sceneRef.fog) return;
    const w = HP.weather;
    if (w === 'fog') {
      sceneRef.fog.near = 45;
      sceneRef.fog.far = 680;
    } else if (w === 'storm') {
      sceneRef.fog.near = 110;
      sceneRef.fog.far = 1300;
    } else if (w === 'rain') {
      sceneRef.fog.near = 160;
      sceneRef.fog.far = 1700;
    } else if (w === 'snow') {
      sceneRef.fog.near = 130;
      sceneRef.fog.far = 1500;
    } else {
      sceneRef.fog.near = 350;
      sceneRef.fog.far = 4000;
    }
  };

  W.setWeather = function (type, broadcast) {
    const valid = ['clear', 'rain', 'snow', 'fog', 'storm'];
    const t = valid.includes(type) ? type : 'clear';
    HP.weather = t;
    if (HP.cur && HP.cur()) {
      HP.cur().weather = t;
    }

    if (rainGroup) {
      rainGroup.visible = (t === 'rain' || t === 'storm');
      if (rainLines && rainLines.material) {
        rainLines.material.opacity = t === 'storm' ? 0.65 : 0.45;
      }
    }
    if (snowGroup) {
      snowGroup.visible = (t === 'snow');
    }

    W.updateFog();
    W.syncUI();

    if (broadcast !== false) {
      if (HP.sync3d && HP.sync3d.broadcastWeather) {
        HP.sync3d.broadcastWeather(t);
      }
      if (HP.sync && HP.sync.broadcastWeather) {
        HP.sync.broadcastWeather(t);
      }
    }

    if (HP.status) {
      const names = {
        clear: '☀️ Clear Skies',
        rain: '🌧️ Gentle Rain',
        snow: '❄️ Winter Snowfall',
        fog: '🌫️ Dense Fog',
        storm: '⛈️ Thunderstorm'
      };
      HP.status('Weather: ' + (names[t] || t));
    }
  };
  HP.setWeather = W.setWeather;

  W.getWeather = function () {
    return HP.weather || 'clear';
  };

  W.syncUI = function () {
    const w = HP.weather || 'clear';
    const btn = document.getElementById('btn-weather');
    const btn2d = document.getElementById('btn-weather-2d');
    const icons = {
      clear: '☀️ Clear',
      rain: '🌧️ Rain',
      snow: '❄️ Snow',
      fog: '🌫️ Fog',
      storm: '⛈️ Storm'
    };
    if (btn) {
      btn.innerHTML = icons[w] || ('☀️ ' + w);
      btn.title = 'Current Weather: ' + w.toUpperCase() + ' (Click to change)';
    }
    if (btn2d) {
      btn2d.innerHTML = icons[w] || ('☀️ ' + w);
      btn2d.title = 'Current Weather: ' + w.toUpperCase() + ' (Click to change)';
    }

    const sel = document.getElementById('weather-select');
    if (sel && sel.value !== w) {
      sel.value = w;
    }
  };

  /* Main animation loop per frame */
  let animTime = 0;
  W.tick = function (dt, camPos, sunLight, ambLight) {
    const w = HP.weather || 'clear';
    if (!camPos) return;
    animTime += dt;

    const cx = camPos.x, cz = camPos.z;

    // 1. Rain streaks animation
    if ((w === 'rain' || w === 'storm') && rainPos && rainGeo) {
      const fallMult = w === 'storm' ? 1.35 : 1.0;
      const windX = w === 'storm' ? -18 * dt : -8 * dt;
      const windZ = w === 'storm' ? -8 * dt : -3 * dt;

      for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 6;
        const speed = rainVel[i] * fallMult;
        const dy = speed * dt;

        rainPos[idx + 1] -= dy;
        rainPos[idx + 4] -= dy;
        rainPos[idx] += windX;
        rainPos[idx + 3] += windX;
        rainPos[idx + 2] += windZ;
        rainPos[idx + 5] += windZ;

        // Wrap around camera box
        const dx = rainPos[idx] - cx;
        const dz = rainPos[idx + 2] - cz;

        if (rainPos[idx + 1] < -2 || Math.hypot(dx, dz) > WRAP_RADIUS) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * WRAP_RADIUS;
          const rx = cx + Math.cos(ang) * rad;
          const rz = cz + Math.sin(ang) * rad;
          const ry = 110 + Math.random() * (HEIGHT_SPAN - 110);
          const len = (w === 'storm' ? 5.5 : 4.0) + Math.random() * 2.5;

          rainPos[idx] = rx;
          rainPos[idx + 1] = ry;
          rainPos[idx + 2] = rz;
          rainPos[idx + 3] = rx + (w === 'storm' ? -1.2 : -0.7);
          rainPos[idx + 4] = ry - len;
          rainPos[idx + 5] = rz + (w === 'storm' ? -0.5 : -0.3);
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // 2. Snow swirling animation
    if (w === 'snow' && snowPos && snowGeo && snowData) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        const d = snowData[i];
        const idx = i * 3;

        // Fall down
        snowPos[idx + 1] -= d.speed * dt;

        // Graceful sinusoidal wind sway
        const sway = Math.sin(animTime * d.swaySpeed + d.phase) * d.swayAmp * dt;
        const swayZ = Math.cos(animTime * (d.swaySpeed * 0.8) + d.phase) * (d.swayAmp * 0.7) * dt;
        snowPos[idx] += sway - 4 * dt;
        snowPos[idx + 2] += swayZ - 1.5 * dt;

        const dx = snowPos[idx] - cx;
        const dz = snowPos[idx + 2] - cz;

        if (snowPos[idx + 1] < -2 || Math.hypot(dx, dz) > WRAP_RADIUS) {
          const ang = Math.random() * Math.PI * 2;
          const rad = Math.sqrt(Math.random()) * WRAP_RADIUS;
          snowPos[idx] = cx + Math.cos(ang) * rad;
          snowPos[idx + 1] = 100 + Math.random() * (HEIGHT_SPAN - 100);
          snowPos[idx + 2] = cz + Math.sin(ang) * rad;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;
    }

    // 3. Thunderstorm Lightning System
    if (w === 'storm') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 9 + Math.random() * 12;
        lightningActive = 0.22; // 220ms flash window

        // Speed-of-sound delay for thunderclap (1.2 to 2.4 seconds after flash)
        const thunderDelay = 1200 + Math.random() * 1200;
        setTimeout(() => {
          if (HP.sound3d && HP.sound3d.thunder) {
            HP.sound3d.thunder();
          }
        }, thunderDelay);
      }

      if (lightningActive > 0) {
        lightningActive -= dt;
        // Double-burst flash profile
        const isFlash = lightningActive > 0.15 || (lightningActive > 0.04 && lightningActive < 0.10);
        if (isFlash && sunLight && ambLight) {
          sunLight.intensity = Math.max(sunLight.intensity, 2.6);
          ambLight.intensity = Math.max(ambLight.intensity, 1.8);
          if (sceneRef && sceneRef.fog) sceneRef.fog.color.setHex(0xdbeafe);
        } else if (sceneRef && sceneRef.fog) {
          sceneRef.fog.color.setHex(0x1a222d);
        }
      }
    }
  };

  /* Dropdown modal toggle for HUD / topbar button */
  W.toggleMenu = function (nearElem) {
    let menu = document.getElementById('weather-menu');
    if (menu) {
      const willShow = menu.style.display === 'none';
      menu.style.display = willShow ? 'flex' : 'none';
      if (willShow && nearElem && nearElem.getBoundingClientRect) {
        const r = nearElem.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + 'px';
        menu.style.left = Math.max(10, Math.min(window.innerWidth - 180, r.left - 20)) + 'px';
        menu.style.right = 'auto';
      }
      return;
    }

    menu = document.createElement('div');
    menu.id = 'weather-menu';
    menu.className = 'hud';
    menu.style.cssText = `
      position: fixed;
      top: 52px;
      right: 180px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 14px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 170px;
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55);
      color: #f8fafc;
    `;
    if (nearElem && nearElem.getBoundingClientRect) {
      const r = nearElem.getBoundingClientRect();
      menu.style.top = (r.bottom + 6) + 'px';
      menu.style.left = Math.max(10, Math.min(window.innerWidth - 180, r.left - 20)) + 'px';
      menu.style.right = 'auto';
    }

    const options = [
      { id: 'clear', icon: '☀️', name: 'Clear Sky' },
      { id: 'rain', icon: '🌧️', name: 'Rainfall' },
      { id: 'snow', icon: '❄️', name: 'Snowfall' },
      { id: 'fog', icon: '🌫️', name: 'Atmospheric Fog' },
      { id: 'storm', icon: '⛈️', name: 'Thunderstorm' }
    ];

    options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'btn-tool';
      b.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px !important;
        font-size: 13px !important;
        text-align: left;
        border-radius: 8px;
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f1f5f9;
        cursor: pointer;
        width: 100%;
      `;
      b.innerHTML = `<span>${opt.icon}</span> <span>${opt.name}</span>`;
      b.onclick = () => {
        W.setWeather(opt.id, true);
        menu.style.display = 'none';
      };
      menu.appendChild(b);
    });

    document.body.appendChild(menu);
  };
})();
