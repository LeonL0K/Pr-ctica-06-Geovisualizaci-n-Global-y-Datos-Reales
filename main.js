// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Configurar Escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510); // Fondo espacial oscuro

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 150;
controls.maxDistance = 600;

// 2. Crear el Globo (Esfera nativa)
const RADIO = 100;
const earthGeo = new THREE.SphereGeometry(RADIO, 64, 64);

// Cargar textura de la Tierra
const textureLoader = new THREE.TextureLoader();
const earthMap = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
const earthBump = textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');

const earthMat = new THREE.MeshPhongMaterial({
  map: earthMap,
  bumpMap: earthBump,
  bumpScale: 2,
  specular: new THREE.Color('grey'),
  shininess: 10
});

const earth = new THREE.Mesh(earthGeo, earthMat);
// Rotar ligeramente para que América quede al frente
earth.rotation.y = -Math.PI / 2; 
scene.add(earth);

// Luces para que el globo se vea
const ambientLight = new THREE.AmbientLight(0x404040, 2); 
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 3, 5);
scene.add(dirLight);

// Ocultar mensaje de carga
document.getElementById('loading').style.display = 'none';

// 3. Raycasting (Clic en el globo)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const puntosGbif = new THREE.Group();
scene.add(puntosGbif);

renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(earth);
  
  if (intersects.length > 0) {
    // Convertir el punto 3D a Latitud y Longitud
    const p = intersects[0].point.clone().normalize();
    
    // Fórmulas matemáticas para convertir coordenadas esféricas
    const lat = 90 - (Math.acos(p.y) * 180 / Math.PI);
    let lon = ((Math.atan2(p.z, -p.x) * 180 / Math.PI) + 180) % 360 - 180;

    // Añadir marcador visual (un pequeño punto rojo)
    agregarMarcador(lat, lon, intersects[0].point);

    // Analizar datos
    analizarUbicacion(lat, lon);
  }
});

function agregarMarcador(lat, lon, pos3D) {
  // Borrar marcadores anteriores
  while(puntosGbif.children.length > 0){ 
      puntosGbif.remove(puntosGbif.children[0]); 
  }

  // Crear una esfera pequeña
  const geo = new THREE.SphereGeometry(1.5, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const pin = new THREE.Mesh(geo, mat);
  pin.position.copy(pos3D);
  
  // Orientar el pin hacia afuera
  pin.lookAt(0,0,0);
  puntosGbif.add(pin);
}

// 4. Consumo de la API
async function analizarUbicacion(lat, lon) {
  document.getElementById('panel-datos').classList.remove('hidden');
  document.getElementById('panel-decisiones').classList.add('hidden');
  document.getElementById('coord-title').innerText = `📍 Lat: ${lat.toFixed(3)}, Lon: ${lon.toFixed(3)}`;
  document.getElementById('clima-data').innerHTML = 'Consultando NASA POWER... ⏳';
  document.getElementById('biodiversidad-data').innerHTML = 'Consultando GBIF... ⏳';

  try {
    const resClima = await fetch(`./api/index.php?accion=clima&lat=${lat}&lon=${lon}`);
    const jsonClima = await resClima.json();
    
    const resGbif = await fetch(`./api/index.php?accion=gbif&lat=${lat}&lon=${lon}`);
    const jsonGbif = await resGbif.json();

    procesarDatos(lat, lon, jsonClima, jsonGbif);
  } catch (error) {
    console.error(error);
    document.getElementById('clima-data').innerHTML = '❌ Error al conectar con PHP.';
  }
}

// 5. Procesar Datos y Motor de Decisiones
function procesarDatos(lat, lon, climaRes, gbifRes) {
  let temp = 20, precip = 100;
  let ocurrencias = 0;

  // Filtrar datos inválidos de NASA (-999 significa "sin datos")
  if (climaRes.status === 'ok' && climaRes.resultado.data) {
    const params = climaRes.resultado.data.properties?.parameter;
    if (params?.T2M && params?.PRECTOTCORR) {
      const temps = Object.values(params.T2M).filter(v => v > -100);
      const precips = Object.values(params.PRECTOTCORR).filter(v => v >= 0);
      
      temp = temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length) : 20;
      precip = precips.length ? precips.reduce((a, b) => a + b, 0) : 0;
    }
  }

  if (gbifRes.status === 'ok' && gbifRes.resultado.data) {
    const data = gbifRes.resultado.data;
    ocurrencias = data.count || 0;
  }

  document.getElementById('clima-data').innerHTML = `
    <p><b>🌡️ Temp. Promedio:</b> ${temp.toFixed(1)} °C</p>
    <p><b>🌧️ Precipitación (7 días):</b> ${precip.toFixed(1)} mm</p>
  `;
  document.getElementById('biodiversidad-data').innerHTML = `
    <p><b>🌱 Registros biológicos (GBIF):</b> ${ocurrencias} especies en 50km.</p>
  `;

  // Decisiones
  document.getElementById('panel-decisiones').classList.remove('hidden');
  const lista = document.getElementById('lista-decisiones');
  lista.innerHTML = ''; 
  const decisiones = [];

  if (precip < 10) {
    decisiones.push({ texto: "⚠️ Estrés hídrico: Lluvia casi nula. Riego suplementario obligatorio.", clase: "critico" });
  } else if (precip > 100) {
    decisiones.push({ texto: "🌊 Exceso de humedad: Riesgo de hongos. Revisar drenaje.", clase: "" });
  }

  if (temp > 35) {
    decisiones.push({ texto: "🔥 Estrés térmico severo: Considerar variedad resistente.", clase: "critico" });
  } else if (temp < 10) {
    decisiones.push({ texto: "❄️ Alerta por frío: Riesgo de heladas.", clase: "critico" });
  }

  if (ocurrencias === 0) {
    decisiones.push({ texto: "❓ Sin registros en GBIF: Alto riesgo de adaptación.", clase: "" });
  } else {
    decisiones.push({ texto: "✅ Condiciones biológicas respaldadas por GBIF.", clase: "exito" });
  }

  if (decisiones.length === 0) {
    decisiones.push({ texto: "✅ Condiciones normales. Sin alertas.", clase: "exito" });
  }

  decisiones.forEach(d => {
    const li = document.createElement('li');
    li.innerHTML = d.texto;
    if (d.clase) li.classList.add(d.clase);
    lista.appendChild(li);
  });
}

// 6. Animación
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});