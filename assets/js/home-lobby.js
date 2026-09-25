// PSU Materials Portal - 3D Interactive Materials Science Exploration Lab
// Progressive Three.js enhancement with Crystal Lattices (FCC, BCC, HCP, Orb)
const root = document.querySelector(".home-lobby");
const stage = document.getElementById("lobby-stage");
const host = document.getElementById("lobby-canvas");
const select = document.getElementById("lobby-quality");
const status = document.getElementById("lobby-status");
const crystalInfo = document.getElementById("crystal-info");
const crystalTabs = [...(root?.querySelectorAll(".crystal-tab") || [])];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const compact = matchMedia("(max-width: 600px)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const links = [...(root?.querySelectorAll("[data-lobby-route]") || [])];
const storageKey = "psu_lobby_quality";
const crystalKey = "psu_lobby_crystal";

let generation = 0,
  dispose = () => {},
  visible = false;

let currentCrystal = "fcc";
try {
  const savedQuality = localStorage.getItem(storageKey);
  if (["auto", "high", "balanced", "lite"].includes(savedQuality)) {
    select.value = savedQuality;
  }
  const savedCrystal = localStorage.getItem(crystalKey);
  if (["fcc", "bcc", "hcp", "orb"].includes(savedCrystal)) {
    currentCrystal = savedCrystal;
  }
} catch {
  /* Storage unavailable */
}
if (select?.parentElement) select.parentElement.hidden = false;

const CRYSTAL_DATA = {
  fcc: {
    badge: "FCC",
    name: "Face-Centered Cubic",
    stat: "APF: <strong>0.74</strong> · CN: <strong>12</strong>",
    examples: "ตัวอย่าง: ทองแดง (Cu), อลูมิเนียม (Al), ทองคำ (Au)",
    note: "ผลึกทรงลูกบาศก์ศูนย์กลางหน้า · อะตอมชิดกันที่สุด",
  },
  bcc: {
    badge: "BCC",
    name: "Body-Centered Cubic",
    stat: "APF: <strong>0.68</strong> · CN: <strong>8</strong>",
    examples: "ตัวอย่าง: เหล็กกล้า (α-Fe), โครเมียม (Cr), ทังสเตน (W)",
    note: "ผลึกทรงลูกบาศก์ศูนย์กลางวัตถุ · มีอะตอมเดี่ยวกลางยูนิตเซลล์",
  },
  hcp: {
    badge: "HCP",
    name: "Hexagonal Close-Packed",
    stat: "APF: <strong>0.74</strong> · CN: <strong>12</strong>",
    examples: "ตัวอย่าง: ไทเทเนียม (Ti), สังกะสี (Zn), แมกนีเซียม (Mg)",
    note: "ผลึกปริซึมหกเหลี่ยมปิดสนิท · การจัดเรียง ABABAB...",
  },
  orb: {
    badge: "ORB",
    name: "Quantum Glass Orb",
    stat: "Amorphous · <strong>Liquid State</strong>",
    examples: "กระจกแก้ว, พอลิเมอร์อสัณฐาน, นาโนคอมโพสิต",
    note: "โครงสร้างอสัณฐาน · ความลื่นไหลระดับโมเลกุล",
  },
};

function updateHUD(type) {
  const data = CRYSTAL_DATA[type] || CRYSTAL_DATA.fcc;
  crystalTabs.forEach((tab) => {
    const isCurrent = tab.dataset.crystal === type;
    tab.classList.toggle("active", isCurrent);
    tab.setAttribute("aria-selected", String(isCurrent));
  });
  if (crystalInfo) {
    crystalInfo.innerHTML = `
      <span class="ci-badge">${data.badge}</span>
      <span class="ci-stat">${data.stat}</span>
      <span class="ci-examples">${data.examples}</span>
    `;
  }
}

async function start() {
  const ticket = ++generation;
  dispose();
  dispose = () => {};
  root.removeAttribute("data-ready");
  host.replaceChildren();

  const quality =
    reduced.matches ||
    select.value === "lite" ||
    (select.value === "auto" && navigator.connection?.saveData)
      ? "lite"
      : select.value === "high" || (select.value === "auto" && !compact.matches)
        ? "high"
        : "balanced";

  root.dataset.quality = quality;
  status.textContent = reduced.matches
    ? "ลดการเคลื่อนไหว · ใช้มุมมอง 2D"
    : "มุมมอง 2D · เลือกปลายทางด้านบน";

  if (quality === "lite" || !visible || document.hidden) return;
  status.textContent = "กำลังเตรียมแบบจำลอง 3D ผลึกวัสดุศาสตร์...";

  let timeout;
  try {
    const THREE = await Promise.race([
      import("../vendor/three/three.module.min.js"),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Load timeout")), 12000);
      }),
    ]);
    clearTimeout(timeout);
    if (ticket !== generation) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: quality === "high",
      powerPreference: "low-power",
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 4.2, 10.5);
    camera.lookAt(0, 0, 0);

    renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, quality === "high" ? 1.75 : 1),
    );
    host.append(renderer.domElement);

    // Dynamic Lighting
    scene.add(new THREE.HemisphereLight(0xd6f4ff, 0x1a334a, 2.6));
    const mainLight = new THREE.DirectionalLight(0xbceaff, 3.2);
    mainLight.position.set(4, 7, 5);
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x73b8d4, 1.8);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    // Root Group
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Base Platform & Reflective Ring
    const platformGeom = new THREE.CylinderGeometry(3.6, 3.8, 0.22, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x163a50,
      metalness: 0.45,
      roughness: 0.35,
    });
    const platform = new THREE.Mesh(platformGeom, platformMat);
    platform.position.set(0, -1.35, 0);
    worldGroup.add(platform);

    const ringGeom = new THREE.TorusGeometry(3.2, 0.02, 6, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x88cddd,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, -1.22, 0);
    worldGroup.add(ring);

    // Interactive 3D Nodes for Courses, Calendar, Tasks
    const nodeGeometries = [
      new THREE.BoxGeometry(0.8, 0.9, 0.8),
      new THREE.CylinderGeometry(0.45, 0.45, 0.7, 24),
      new THREE.IcosahedronGeometry(0.55),
    ];
    const nodeColors = [0x82aeca, 0x8ccac4, 0x9caad3];
    const nodePositions = [
      [-2.3, -0.65, 0.4],
      [0, -0.85, 2.2],
      [2.3, -0.65, 0.4],
    ];
    const nodes = nodeGeometries.map((g, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: nodeColors[i],
        roughness: 0.35,
        metalness: 0.3,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(...nodePositions[i]);
      worldGroup.add(mesh);
      if (links[i]) mesh.userData.link = links[i];
      return mesh;
    });

    // Crystal Structure Container Group
    const crystalGroup = new THREE.Group();
    crystalGroup.position.set(0, 0.5, 0);
    worldGroup.add(crystalGroup);

    let activeCrystalMeshes = [];

    // Helper: Create atom sphere
    function createAtom(x, y, z, radius, color, metal = 0.4) {
      const geom = new THREE.SphereGeometry(radius, 24, 20);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.18,
        metalness: metal,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, y, z);
      crystalGroup.add(mesh);
      activeCrystalMeshes.push(mesh);
      return mesh;
    }

    // Helper: Create wireframe cube
    function createBoxWireframe(size, color = 0x82d2ea) {
      const geom = new THREE.BoxGeometry(size, size, size);
      const edges = new THREE.EdgesGeometry(geom);
      geom.dispose();
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        linewidth: 1.5,
      });
      const line = new THREE.LineSegments(edges, lineMat);
      crystalGroup.add(line);
      activeCrystalMeshes.push(line);
      return line;
    }

    // Helper: Create bond line between two points
    function createBond(p1, p2, color = 0x64b8d4, opacity = 0.45) {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p1),
        new THREE.Vector3(...p2),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
      });
      const line = new THREE.Line(geom, mat);
      crystalGroup.add(line);
      activeCrystalMeshes.push(line);
      return line;
    }

    // Build Crystal Models
    function buildCrystal(type) {
      // Clean previous crystal objects
      activeCrystalMeshes.forEach((obj) => {
        crystalGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material))
            obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      activeCrystalMeshes = [];

      currentCrystal = type;
      updateHUD(type);
      try {
        localStorage.setItem(crystalKey, type);
      } catch {}

      const s = 1.9; // Unit cell size
      const h = s / 2;

      if (type === "fcc") {
        // Face-Centered Cubic (FCC): 8 corners + 6 face centers
        createBoxWireframe(s, 0x8ce2fe);
        const rCorner = 0.22;
        const rFace = 0.25;

        // 8 Corners
        for (const x of [-h, h]) {
          for (const y of [-h, h]) {
            for (const z of [-h, h]) {
              createAtom(x, y, z, rCorner, 0x62c7e8, 0.45);
            }
          }
        }
        // 6 Face Centers
        const faces = [
          [h, 0, 0],
          [-h, 0, 0],
          [0, h, 0],
          [0, -h, 0],
          [0, 0, h],
          [0, 0, -h],
        ];
        faces.forEach(([x, y, z]) => {
          createAtom(x, y, z, rFace, 0x9be8ff, 0.25);
        });

        // Face diagonals (bonds)
        createBond([-h, -h, h], [h, h, h], 0x80d8f5, 0.35);
        createBond([-h, h, h], [h, -h, h], 0x80d8f5, 0.35);
        createBond([-h, -h, -h], [h, h, -h], 0x80d8f5, 0.35);
        createBond([-h, h, -h], [h, -h, -h], 0x80d8f5, 0.35);
      } else if (type === "bcc") {
        // Body-Centered Cubic (BCC): 8 corners + 1 center
        createBoxWireframe(s, 0x76d8b8);
        const rCorner = 0.22;
        const rCenter = 0.33;

        // 8 Corners
        for (const x of [-h, h]) {
          for (const y of [-h, h]) {
            for (const z of [-h, h]) {
              createAtom(x, y, z, rCorner, 0x56c4a8, 0.45);
              // Body diagonal bond to center
              createBond([x, y, z], [0, 0, 0], 0x68dec0, 0.45);
            }
          }
        }
        // Luminous Center Core Atom
        createAtom(0, 0, 0, rCenter, 0x7af7d3, 0.2);
      } else if (type === "hcp") {
        // Hexagonal Close-Packed (HCP)
        const R = 1.15;
        const H = 1.8;
        const halfH = H / 2;
        const topPts = [],
          botPts = [];

        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const x = R * Math.cos(angle);
          const z = R * Math.sin(angle);
          topPts.push(new THREE.Vector3(x, halfH, z));
          botPts.push(new THREE.Vector3(x, -halfH, z));
          // Corner atoms
          createAtom(x, halfH, z, 0.18, 0x8dbaff, 0.35);
          createAtom(x, -halfH, z, 0.18, 0x8dbaff, 0.35);
          // Vertical pillar lines
          createBond([x, halfH, z], [x, -halfH, z], 0x7faaff, 0.4);
        }

        // Top & bottom hexagon perimeter wireframes
        for (let i = 0; i < 6; i++) {
          const next = (i + 1) % 6;
          createBond(
            [topPts[i].x, topPts[i].y, topPts[i].z],
            [topPts[next].x, topPts[next].y, topPts[next].z],
            0x9dc4ff,
            0.6,
          );
          createBond(
            [botPts[i].x, botPts[i].y, botPts[i].z],
            [botPts[next].x, botPts[next].y, botPts[next].z],
            0x9dc4ff,
            0.6,
          );
        }

        // Face centers
        createAtom(0, halfH, 0, 0.22, 0xb0d2ff, 0.3);
        createAtom(0, -halfH, 0, 0.22, 0xb0d2ff, 0.3);

        // 3 Mid-plane interstitial atoms (triangle)
        const midR = R * 0.58;
        for (let j = 0; j < 3; j++) {
          const ang = (j * 2 * Math.PI) / 3 + Math.PI / 6;
          const mx = midR * Math.cos(ang);
          const mz = midR * Math.sin(ang);
          createAtom(mx, 0, mz, 0.23, 0xcbe0ff, 0.25);
        }
      } else {
        // Quantum Glass Orb / Amorphous Hub
        const coreGeom = new THREE.SphereGeometry(0.85, 36, 32);
        const coreMat = new THREE.MeshPhysicalMaterial({
          color: 0x8ce0f5,
          roughness: 0.1,
          metalness: 0.15,
          transmission: 0.6,
          thickness: 1.2,
          transparent: true,
          opacity: 0.88,
        });
        const coreOrb = new THREE.Mesh(coreGeom, coreMat);
        crystalGroup.add(coreOrb);
        activeCrystalMeshes.push(coreOrb);

        // Spinning Orbital Rings
        const ring1 = new THREE.Mesh(
          new THREE.TorusGeometry(1.35, 0.025, 8, 64),
          new THREE.MeshBasicMaterial({
            color: 0x9eedff,
            transparent: true,
            opacity: 0.7,
          }),
        );
        ring1.rotation.x = Math.PI / 3;
        crystalGroup.add(ring1);
        activeCrystalMeshes.push(ring1);

        const ring2 = new THREE.Mesh(
          new THREE.TorusGeometry(1.6, 0.02, 8, 64),
          new THREE.MeshBasicMaterial({
            color: 0x64bfe4,
            transparent: true,
            opacity: 0.5,
          }),
        );
        ring2.rotation.y = Math.PI / 3.5;
        crystalGroup.add(ring2);
        activeCrystalMeshes.push(ring2);

        // Satellite nanoparticles
        createAtom(1.2, 0.6, 0.5, 0.12, 0xffffff, 0.8);
        createAtom(-1.3, -0.4, 0.4, 0.1, 0x8de0ff, 0.8);
      }
    }

    buildCrystal(currentCrystal);

    // Interactive Drag Orbit & Auto-Spin
    let isDragging = false;
    let prevPointer = { x: 0, y: 0 };
    let rotSpeedX = 0;
    let rotSpeedY = 0;
    let baseAngleY = 0;
    let baseAngleX = 0.2;

    const controller = new AbortController();
    const on = (target, event, fn, opts = {}) =>
      target.addEventListener(event, fn, {
        signal: controller.signal,
        ...opts,
      });

    // Interaction Raycasting for Destination Nodes
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const hit = (event) => {
      const box = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        (-(event.clientY - box.top) / box.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(nodes, false)[0]?.object || null;
    };

    const highlight = (node) => {
      nodes.forEach((n) =>
        n.material.emissive?.setHex(n === node ? 0x193d50 : 0),
      );
      links.forEach((a) =>
        a.toggleAttribute("data-active", node?.userData.link === a),
      );
      renderer.domElement.style.cursor = node
        ? "pointer"
        : isDragging
          ? "grabbing"
          : "grab";
    };

    on(renderer.domElement, "pointerdown", (e) => {
      isDragging = true;
      prevPointer = { x: e.clientX, y: e.clientY };
      rotSpeedX = 0;
      rotSpeedY = 0;
      renderer.domElement.style.cursor = "grabbing";
    });

    on(
      window,
      "pointermove",
      (e) => {
        if (isDragging) {
          const dx = e.clientX - prevPointer.x;
          const dy = e.clientY - prevPointer.y;
          prevPointer = { x: e.clientX, y: e.clientY };

          rotSpeedY = dx * 0.006;
          rotSpeedX = dy * 0.006;
          baseAngleY += rotSpeedY;
          baseAngleX = Math.max(-0.6, Math.min(0.8, baseAngleX + rotSpeedX));
        } else if (fine.matches) {
          highlight(hit(e));
        }
      },
      { passive: true },
    );

    on(window, "pointerup", (e) => {
      if (!isDragging) return;
      isDragging = false;
      renderer.domElement.style.cursor = "grab";

      // If clicked without dragging, check for node click
      if (
        Math.hypot(e.clientX - prevPointer.x, e.clientY - prevPointer.y) < 6
      ) {
        const node = hit(e);
        if (node && node.userData.link) {
          location.assign(node.userData.link.href);
        }
      }
    });

    on(renderer.domElement, "pointerleave", () => {
      if (!isDragging) highlight(null);
    });

    // Link hover syncing
    links.forEach((link, i) => {
      on(link, "focus", () => highlight(nodes[i]));
      on(link, "blur", () => highlight(null));
      on(link, "pointerenter", () => {
        if (fine.matches) highlight(nodes[i]);
      });
      on(link, "pointerleave", () => highlight(null));
    });

    // Crystal Selector Tab buttons
    crystalTabs.forEach((tab) => {
      on(tab, "click", () => {
        const type = tab.dataset.crystal;
        if (type && type !== currentCrystal) {
          buildCrystal(type);
        }
      });
    });

    // Render & Animation Loop
    let frame = 0,
      observer;
    const render = () => {
      frame = 0;
      if (document.hidden || !visible) return;

      // Inertia damping & idle auto-spin
      if (!isDragging) {
        rotSpeedY *= 0.94;
        rotSpeedX *= 0.94;
        baseAngleY += rotSpeedY + 0.0035; // gentle idle rotation
        baseAngleX += rotSpeedX;
      }

      crystalGroup.rotation.y = baseAngleY;
      crystalGroup.rotation.x = baseAngleX;

      // Subtle float oscillation
      const t = performance.now() * 0.0015;
      crystalGroup.position.y = 0.5 + Math.sin(t) * 0.08;

      // Platform nodes gentle hover
      nodes.forEach((n, i) => {
        n.rotation.y += 0.008 * (i % 2 === 0 ? 1 : -1);
      });

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };

    const draw = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const size = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = camera.aspect < 1.1 ? 12.5 : 10.5;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };

    const fail = () => {
      generation++;
      dispose();
      dispose = () => {};
      root.removeAttribute("data-ready");
      status.textContent =
        "3D ไม่พร้อมใช้งาน · ใช้ทางลัดในมุมมอง 2D ได้ตามปกติ";
    };

    on(renderer.domElement, "webglcontextlost", (event) => {
      event.preventDefault();
      fail();
    });

    observer = new ResizeObserver(size);
    observer.observe(host);
    size();

    draw();
    root.dataset.ready = "";
    status.textContent = "หมุนลากแบบจำลอง 3D เพื่อสำรวจโครงสร้างผลึกวัสดุ";

    dispose = () => {
      cancelAnimationFrame(frame);
      controller.abort();
      observer?.disconnect();
      activeCrystalMeshes.forEach((m) => {
        m.geometry?.dispose();
        if (m.material) {
          if (Array.isArray(m.material))
            m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      nodeGeometries.forEach((g) => g.dispose());
      platformGeom.dispose();
      platformMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      links.forEach((a) => a.removeAttribute("data-active"));
    };
  } catch (err) {
    if (ticket !== generation) return;
    dispose();
    dispose = () => {};
    root.removeAttribute("data-ready");
    status.textContent = "3D ไม่พร้อมใช้งาน · ใช้ทางลัดในมุมมอง 2D ได้ตามปกติ";
  } finally {
    clearTimeout(timeout);
  }
}

select?.addEventListener("change", () => {
  try {
    localStorage.setItem(storageKey, select.value);
  } catch {}
  start();
});

reduced.addEventListener("change", start);
compact.addEventListener("change", start);
document.addEventListener("visibilitychange", start);

const visibility = new IntersectionObserver((entries) => {
  const next = entries[0].isIntersecting;
  if (next !== visible) {
    visible = next;
    start();
  }
});
if (stage) visibility.observe(stage);

window.addEventListener("pagehide", () => {
  generation++;
  dispose();
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) start();
});
