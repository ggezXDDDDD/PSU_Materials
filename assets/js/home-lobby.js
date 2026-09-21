// A decorative, on-demand scene. HTML links are always the primary navigation.
const root = document.querySelector(".home-lobby");
const stage = document.getElementById("lobby-stage");
const host = document.getElementById("lobby-canvas");
const select = document.getElementById("lobby-quality");
const status = document.getElementById("lobby-status");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const compact = matchMedia("(max-width: 600px)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const links = [...root.querySelectorAll("[data-lobby-route]")];
const storageKey = "psu_lobby_quality";
let generation = 0,
  dispose = () => {},
  visible = false;
try {
  const saved = localStorage.getItem(storageKey);
  if (["auto", "high", "balanced", "lite"].includes(saved))
    select.value = saved;
} catch {
  /* The scene still works when storage is unavailable. */
}
select.parentElement.hidden = false;

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
  status.textContent = "กำลังเตรียมห้องทดลอง · ทางลัดใช้งานได้ทันที";
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
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 6.3, 10.8);
    camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, quality === "high" ? 1.75 : 1),
    );
    host.append(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd6f4ff, 0x20344a, 2.5));
    const light = new THREE.DirectionalLight(0xbceaff, 3);
    light.position.set(3, 6, 4);
    scene.add(light);
    const lab = new THREE.Group();
    scene.add(lab);
    const materials = [],
      geometries = [];
    function mesh(geometry, color, x, y, z, metalness = 0.25) {
      geometries.push(geometry);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness,
      });
      materials.push(material);
      const object = new THREE.Mesh(geometry, material);
      object.position.set(x, y, z);
      lab.add(object);
      return object;
    }
    let frame = 0,
      observer;
    const controller = new AbortController();
    const on = (target, event, fn) =>
      target.addEventListener(event, fn, { signal: controller.signal });
    dispose = () => {
      cancelAnimationFrame(frame);
      controller.abort();
      observer?.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      links.forEach((a) => a.removeAttribute("data-active"));
    };
    mesh(new THREE.CylinderGeometry(3.3, 3.45, 0.23, 6), 0x20495e, 0, -0.35, 0);
    const ring = mesh(
      new THREE.TorusGeometry(2.85, 0.018, 4, 64),
      0x88cddd,
      0,
      -0.21,
      0,
    );
    ring.rotation.x = Math.PI / 2;
    const crystal = mesh(
      new THREE.OctahedronGeometry(0.95),
      0x74c4d3,
      0,
      0.8,
      -0.35,
      0.55,
    );
    crystal.rotation.z = 0.12;
    const nodes = [
      mesh(new THREE.BoxGeometry(0.85, 1.15, 0.85), 0x82aeca, -1.9, 0.45, 0.1),
      mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.7, 24),
        0x8ccac4,
        0,
        0.2,
        1.75,
      ),
      mesh(new THREE.IcosahedronGeometry(0.65), 0x9caad3, 1.9, 0.5, 0.1),
    ];
    nodes.forEach((node, i) => {
      node.userData.link = links[i];
    });
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const fail = () => {
      generation++;
      dispose();
      dispose = () => {};
      root.removeAttribute("data-ready");
      status.textContent =
        "3D ไม่พร้อมใช้งาน · ใช้ทางลัดในมุมมอง 2D ได้ตามปกติ";
    };
    const render = () => {
      frame = 0;
      if (document.hidden || !visible) return;
      try {
        renderer.render(scene, camera);
      } catch {
        fail();
      }
    };
    const draw = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const size = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Fit the platform in portrait without clipping or stealing scroll gestures.
      camera.position.z = camera.aspect < 1.1 ? 13 : 10.8;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      draw();
    };
    const highlight = (node) => {
      nodes.forEach((n) =>
        n.material.emissive.setHex(n === node ? 0x193d50 : 0),
      );
      links.forEach((a) =>
        a.toggleAttribute("data-active", node?.userData.link === a),
      );
      renderer.domElement.style.cursor = node ? "pointer" : "";
      draw();
    };
    const hit = (event) => {
      const box = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        (-(event.clientY - box.top) / box.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(nodes, false)[0]?.object || null;
    };
    on(renderer.domElement, "pointermove", (event) => {
      if (fine.matches) highlight(hit(event));
    });
    on(renderer.domElement, "pointerleave", () => highlight(null));
    let down;
    on(renderer.domElement, "pointerdown", (event) => {
      down = { x: event.clientX, y: event.clientY };
    });
    on(renderer.domElement, "pointercancel", () => {
      down = null;
    });
    on(renderer.domElement, "pointerup", (event) => {
      if (
        down &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < 8 &&
        event.button === 0
      ) {
        const node = hit(event);
        if (node) location.assign(node.userData.link.href);
      }
      down = null;
    });
    links.forEach((link, i) => {
      on(link, "focus", () => highlight(nodes[i]));
      on(link, "blur", () => highlight(null));
      on(link, "pointerenter", () => {
        if (fine.matches) highlight(nodes[i]);
      });
      on(link, "pointerleave", () => highlight(null));
    });
    on(renderer.domElement, "webglcontextlost", (event) => {
      event.preventDefault();
      fail();
    });
    observer = new ResizeObserver(size);
    observer.observe(host);
    size();
    renderer.render(scene, camera);
    root.dataset.ready = "";
    status.textContent = "เลือกวัตถุหรือทางลัดเพื่อเปิดหน้าเรียนรู้";
    if (!reduced.matches)
      renderer.domElement.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
  } catch {
    if (ticket !== generation) return;
    dispose();
    dispose = () => {};
    root.removeAttribute("data-ready");
    status.textContent = "3D ไม่พร้อมใช้งาน · ใช้ทางลัดในมุมมอง 2D ได้ตามปกติ";
  } finally {
    clearTimeout(timeout);
  }
}
select.addEventListener("change", () => {
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
visibility.observe(stage);
window.addEventListener("pagehide", () => {
  generation++;
  dispose();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) start();
});
