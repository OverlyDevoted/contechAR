import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { ARButton } from "./js/ARButton";
import flowers from '../public/models/robot.gltf'
import "./style.css";
console.log(flowers)
let container;
let camera, scene, renderer;
let mixer, clock;
let controller;

let reticle;

let hitTestSource = null;
let hitTestSourceRequested = false;
let planeFound = false;

let modelGltf;
let doCapture = false;
// check for webxr session support
if ("xr" in navigator) {
  navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
    if (supported) {

      document.getElementById("ar-not-supported").textContent = "";
      init();
      animate();
    }
  });
}

function sessionStart() {
  planeFound = false;
  //show #tracking-prompt
  document.getElementById("tracking-prompt").style.display = "block";
  document.getElementById("app").style.display = "none";
  const instructions = document.getElementById("instructions");
  instructions.style.display = "flex";
  instructions.children[0].textContent = "Vyksta aplinkos atpažinimas, judinkite telefoną"

  document.getElementById("screenshot-btn").addEventListener('click', capture)
}
function capture() {
  console.log("Capture");
  doCapture = true;
}
function sessionEnd() {
  planeFound = false;
  //show #tracking-prompt
  document.getElementById("tracking-prompt").style.display = "none";
  document.getElementById("app").style.display = "flex";
  document.getElementById("instructions").style.display = "none";

  document.getElementById("screenshot-btn").removeEventListener('click', capture)
}

function init() {
  container = document.createElement("div");
  document.body.appendChild(container);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  renderer.xr.addEventListener("sessionstart", sessionStart);
  renderer.xr.addEventListener("sessionend", sessionEnd);

  clock = new THREE.Clock();


  document.getElementById("ar-not-supported").appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local", "hit-test", "dom-overlay"],
      domOverlay: { root: document.querySelector("#overlay") },
    })
  );

  function onSelect() {
    if (reticle.visible && modelGltf) {
      //pick random child from flowersGltf
      console.log("Spawning model")
      const model = modelGltf.scene;
      model.scale.setScalar(0.5)
      reticle.matrix.decompose(model.position, model.quaternion, model.scale);
      mixer = new THREE.AnimationMixer(model)
      const clips = modelGltf.animations;
      const action = mixer.clipAction(clips[0])
      action.play()
      scene.add(model);
    }
  }

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  //load flowers.glb
  const loader = new GLTFLoader();

  loader.load(flowers, (gltf) => {
    modelGltf = gltf;
    isLoaded = true;
    console.log("Loaded gltf " + (modelGltf ? "actually" : "no"))
  });

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        if (!planeFound) {
          planeFound = true;
          //hide #tracking-prompt
          document.getElementById("tracking-prompt").style.display = "none";
          document.getElementById("instructions").children[0].textContent = "Atributikai spustelkite ant ekrano";
        }
        const hit = hitTestResults[0];

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
  if (mixer) {
    mixer.update(clock.getDelta());
  }
  renderer.render(scene, camera);
}
