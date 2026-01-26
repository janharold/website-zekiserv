(function () {
  const hero = document.getElementById('hero');
  const measure = document.getElementById('dvd-text');
  const canvas = document.getElementById('dvd-canvas');

  if (!hero || !measure || !canvas) return;

  const phrases = [
    'Purpose',
    'Passion',
    'Compassion',
    'Faith',
    'Hope',
    'Love',
  ];
  let phraseIndex = 0;

  let x = 0;
  let y = 0;
  let vx = 2;
  let vy = 2;
  let mouseX = -9999;
  let mouseY = -9999;
  let glitchStartTime = null;
  let wasHovered = false;
  let gl = null;
  let textTexture = null;
  let textFb = null;
  let glitchProgram = null;
  let simpleProgram = null;
  let quadBuffer = null;
  let textCanvas = null;
  let textCtx = null;

  hero.addEventListener('mousemove', function (e) {
    const rect = hero.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
  hero.addEventListener('mouseleave', function () {
    mouseX = -9999;
    mouseY = -9999;
  });

  function getBounds() {
    const heroRect = hero.getBoundingClientRect();
    const textRect = measure.getBoundingClientRect();
    return {
      heroWidth: heroRect.width,
      heroHeight: heroRect.height,
      textWidth: textRect.width,
      textHeight: textRect.height,
      visibleMinX: 0,
      visibleMinY: 0,
      visibleWidth: heroRect.width,
      visibleHeight: heroRect.height,
    };
  }

  function nextPhrase() {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * phrases.length);
    } while (newIndex === phraseIndex && phrases.length > 1);
    phraseIndex = newIndex;
    measure.textContent = phrases[phraseIndex];
  }

  function createTextTexture() {
    const padding = 4;
    const w = Math.ceil(measure.offsetWidth) + padding * 2;
    const h = Math.ceil(measure.offsetHeight) + padding * 2;
    if (!textCanvas || textCanvas.width !== w || textCanvas.height !== h) {
      textCanvas = document.createElement('canvas');
      textCanvas.width = w;
      textCanvas.height = h;
      textCtx = textCanvas.getContext('2d');
    }
    const ctx = textCtx;
    ctx.clearRect(0, 0, w, h);
    ctx.font = getComputedStyle(measure).font;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(measure.textContent, padding, h / 2);
    return textCanvas;
  }

  let lastTw = 0;
  let lastTh = 0;

  function ensureWebGL() {
    const tw = Math.ceil(measure.offsetWidth) + 8;
    const th = Math.ceil(measure.offsetHeight) + 8;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (!gl) {
      canvas.width = tw * dpr;
      canvas.height = th * dpr;
      canvas.style.width = tw + 'px';
      canvas.style.height = th + 'px';
      canvas.style.left = x + 'px';
      canvas.style.top = y + 'px';

      gl = canvas.getContext('webgl', { alpha: true }) || canvas.getContext('experimental-webgl', { alpha: true });
      if (!gl) return false;

      const vs = 'attribute vec2 a_pos;varying vec2 v_uv;void main(){vec2 u=a_pos*0.5+0.5;v_uv=vec2(u.x,1.0-u.y);gl_Position=vec4(a_pos,0.,1.);}';
      const fsSimple = 'precision mediump float;uniform sampler2D u_tex;varying vec2 v_uv;void main(){gl_FragColor=texture2D(u_tex,v_uv);}';
      const fsGlitch = [
      'precision mediump float;',
      'uniform sampler2D u_tex;',
      'uniform float u_time;',
      'uniform vec2 u_res;',
      'varying vec2 v_uv;',
      'float rand(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
      'void main(){',
      '  vec2 uv=v_uv;',
      '  float t=u_time*60.;',
      '  float slide=floor(uv.y*u_res.y/4.+t*2.)*4./u_res.y;',
      '  uv.x+=sin(t+slide*20.)*0.02;',
      '  float r=texture2D(u_tex,uv+vec2(0.015,0.)).r;',
      '  float g=texture2D(u_tex,uv).g;',
      '  float b=texture2D(u_tex,uv-vec2(0.015,0.)).b;',
      '  float n=rand(uv+t)*0.04;',
      '  gl_FragColor=vec4(r+n,g+n,b+n,1.);',
      '}',
      ].join('');

      function compile(shader, src) {
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
        return shader;
      }
      function link(prog, v, f) {
        gl.attachShader(prog, v);
        gl.attachShader(prog, f);
        gl.linkProgram(prog);
        return gl.getProgramParameter(prog, gl.LINK_STATUS);
      }

      const v = gl.createShader(gl.VERTEX_SHADER);
      compile(v, vs);
      const fSimple = gl.createShader(gl.FRAGMENT_SHADER);
      compile(fSimple, fsSimple);
      const fGlitch = gl.createShader(gl.FRAGMENT_SHADER);
      compile(fGlitch, fsGlitch);

      simpleProgram = gl.createProgram();
      link(simpleProgram, v, fSimple);
      glitchProgram = gl.createProgram();
      link(glitchProgram, v, fGlitch);

      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

      textTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      textFb = gl.createFramebuffer();
      lastTw = tw;
      lastTh = th;
      return true;
    }

    if (tw !== lastTw || th !== lastTh) {
      canvas.width = tw * dpr;
      canvas.height = th * dpr;
      canvas.style.width = tw + 'px';
      canvas.style.height = th + 'px';
      lastTw = tw;
      lastTh = th;
    }
    return true;
  }

  function uploadText() {
    const tex = createTextTexture();
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex);
  }

  function drawText(glitch, time) {
    if (!gl || !simpleProgram || !glitchProgram) return;
    const tw = Math.ceil(measure.offsetWidth) + 8;
    const th = Math.ceil(measure.offsetHeight) + 8;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT);

    uploadText();

    const prog = glitch ? glitchProgram : simpleProgram;
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texLoc = gl.getUniformLocation(prog, 'u_tex');
    gl.uniform1i(texLoc, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);

    if (glitch) {
      const timeLoc = gl.getUniformLocation(prog, 'u_time');
      const resLoc = gl.getUniformLocation(prog, 'u_res');
      gl.uniform1f(timeLoc, time);
      gl.uniform2f(resLoc, tw, th);
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function animate(t) {
    t = t || 0;
    const b = getBounds();
    const { textWidth, textHeight, visibleMinX, visibleMinY, visibleWidth, visibleHeight } = b;
    const rightEdge = visibleMinX + visibleWidth;
    const bottomEdge = visibleMinY + visibleHeight;
    const maxX = rightEdge - textWidth;
    const maxY = bottomEdge - textHeight;

    if (visibleWidth > 0 && visibleHeight > 0) {
      x += vx;
      y += vy;

      if (x + textWidth >= rightEdge) {
        x = maxX;
        vx = -Math.abs(vx);
        nextPhrase();
      }
      if (x <= visibleMinX) {
        x = visibleMinX;
        vx = Math.abs(vx);
        nextPhrase();
      }
      if (y + textHeight >= bottomEdge) {
        y = maxY;
        vy = -Math.abs(vy);
        nextPhrase();
      }
      if (y <= visibleMinY) {
        y = visibleMinY;
        vy = Math.abs(vy);
        nextPhrase();
      }
      x = Math.max(visibleMinX, Math.min(x, maxX));
      y = Math.max(visibleMinY, Math.min(y, maxY));
    }

    measure.style.left = x + 'px';
    measure.style.top = y + 'px';
    canvas.style.left = x + 'px';
    canvas.style.top = y + 'px';

    const r = measure.getBoundingClientRect();
    const hr = hero.getBoundingClientRect();
    const tx = r.left - hr.left;
    const ty = r.top - hr.top;
    const inX = mouseX >= tx && mouseX <= tx + r.width;
    const inY = mouseY >= ty && mouseY <= ty + r.height;
    const hovered = inX && inY;

    if (hovered && !wasHovered) {
      glitchStartTime = t;
    }
    if (!hovered) {
      glitchStartTime = null;
    }
    wasHovered = hovered;

    var glitchActive = false;
    var glitchTime = 0;
    if (hovered && glitchStartTime != null) {
      var elapsed = (t - glitchStartTime) * 0.001;
      if (elapsed < 0.05) {
        glitchActive = true;
        glitchTime = elapsed;
      }
    }

    ensureWebGL();
    if (gl) {
      drawText(glitchActive, glitchTime);
    }

    requestAnimationFrame(animate);
  }

  function init() {
    phraseIndex = Math.floor(Math.random() * phrases.length);
    measure.textContent = phrases[phraseIndex];
    measure.style.left = '0';
    measure.style.top = '0';
    const b = getBounds();
    const { textWidth, textHeight, visibleMinX, visibleMinY, visibleWidth, visibleHeight } = b;
    const maxX = visibleMinX + visibleWidth - textWidth;
    const maxY = visibleMinY + visibleHeight - textHeight;
    if (visibleWidth > 0 && visibleHeight > 0) {
      x = Math.max(visibleMinX, Math.min(visibleMinX + (visibleWidth - textWidth) / 2, maxX));
      y = Math.max(visibleMinY, Math.min(visibleMinY + (visibleHeight - textHeight) / 2, maxY));
    } else {
      x = 0;
      y = 0;
    }
    measure.style.left = x + 'px';
    measure.style.top = y + 'px';

    ensureWebGL();
    requestAnimationFrame(animate);
  }

  init();

  window.addEventListener('resize', function () {
    const b = getBounds();
    const { textWidth, textHeight, visibleMinX, visibleMinY, visibleWidth, visibleHeight } = b;
    const maxX = visibleMinX + visibleWidth - textWidth;
    const maxY = visibleMinY + visibleHeight - textHeight;
    x = Math.max(visibleMinX, Math.min(x, maxX));
    y = Math.max(visibleMinY, Math.min(y, maxY));
    ensureWebGL();
  });
})();

(function () {
  const modal = document.getElementById('project-modal');
  const backdrop = modal?.querySelector('.modal-backdrop');
  const closeBtn = modal?.querySelector('.modal-close');
  const galleryInner = modal?.querySelector('.modal-gallery-inner');
  const titleEl = modal?.querySelector('.modal-title');
  const descEl = modal?.querySelector('.modal-description');
  const ghostBtns = document.querySelectorAll('.ghost-btn');

  if (!modal || !galleryInner || !titleEl || !descEl) return;

  function openModal(project) {
    titleEl.textContent = project.name;
    descEl.textContent = project.description;
    galleryInner.innerHTML = '';
    project.images.forEach(function (image) {
      const item = document.createElement('div');
      item.className = 'modal-gallery-item';
      
      const img = document.createElement('img');
      img.src = typeof image === 'string' ? image : image.src;
      img.alt = typeof image === 'string' ? '' : (image.title || '');
      item.appendChild(img);
      
      if (typeof image === 'object' && image.title) {
        const title = document.createElement('h3');
        title.className = 'modal-gallery-item-title';
        title.textContent = image.title;
        item.appendChild(title);
      }
      
      if (typeof image === 'object' && image.caption) {
        const caption = document.createElement('p');
        caption.className = 'modal-gallery-item-caption';
        caption.textContent = image.caption;
        item.appendChild(caption);
      }
      
      galleryInner.appendChild(item);
    });
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  ghostBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = btn.closest('.project-item');
      const data = item?.getAttribute('data-project');
      if (!data) return;
      try {
        const project = JSON.parse(data);
        openModal(project);
      } catch (e) {}
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
})();

(function () {
  function decodeContactInfo() {
    const emailLink = document.getElementById('contact-email-link');
    const phoneLink = document.getElementById('contact-phone-link');
    
    if (emailLink && emailLink.dataset.obfuscated) {
      try {
        const decoded = atob(emailLink.dataset.obfuscated);
        emailLink.href = decoded;
        emailLink.textContent = decoded.replace('mailto:', '');
      } catch (e) {}
    }
    
    if (phoneLink && phoneLink.dataset.obfuscated) {
      try {
        const decoded = atob(phoneLink.dataset.obfuscated);
        phoneLink.href = decoded;
        phoneLink.textContent = decoded.replace('tel:', '');
      } catch (e) {}
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decodeContactInfo);
  } else {
    decodeContactInfo();
  }
})();

