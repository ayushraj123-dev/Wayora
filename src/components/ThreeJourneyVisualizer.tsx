/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RouteOption } from '../types';
import { 
  Compass, 
  Layers, 
  ShieldCheck, 
  Activity, 
  Play, 
  Pause,
  ZoomIn, 
  ZoomOut,
  Navigation2,
  GitBranch,
  Car,
  Footprints,
  Train,
  Bus
} from 'lucide-react';

interface ThreeJourneyVisualizerProps {
  route: RouteOption;
  onLegClick?: (legIndex: number) => void;
}

export const ThreeJourneyVisualizer: React.FC<ThreeJourneyVisualizerProps> = ({ route }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'isometric' | 'top' | 'side' | 'follow'>('isometric');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [activeElevation, setActiveElevation] = useState('+14.2m [Metro Viaduct]');
  const [activeSpeed, setActiveSpeed] = useState('78 km/h');
  const [activeModeLabel, setActiveModeLabel] = useState('Metro Bullet Train');
  const [activeTurnNotice, setActiveTurnNotice] = useState('Heading Eastbound');
  const [forcedVehicleMode, setForcedVehicleMode] = useState<'auto' | 'walking' | 'metro' | 'bus' | 'cab'>('auto');

  // Camera & scene references
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Orbit controls
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 18, theta: Math.PI / 4.4, phi: Math.PI / 3.2 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); // slate-950
    scene.fog = new THREE.FogExp2(0x020617, 0.022);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      160
    );
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambLight);

    const sunLight = new THREE.DirectionalLight(0x38bdf8, 2.6);
    sunLight.position.set(14, 22, 16);
    scene.add(sunLight);

    const streetWarmLight = new THREE.PointLight(0xf59e0b, 1.6, 35);
    streetWarmLight.position.set(-6, 3, 2);
    scene.add(streetWarmLight);

    const blueRimLight = new THREE.DirectionalLight(0x1d4ed8, 1.3);
    blueRimLight.position.set(-16, 10, -14);
    scene.add(blueRimLight);

    // Ground Grid & River Canal
    const gridHelper = new THREE.GridHelper(36, 44, 0x0284c7, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Diagonal Urban River Canal
    const riverGeo = new THREE.PlaneGeometry(36, 3.8);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x032845,
      emissive: 0x0284c7,
      emissiveIntensity: 0.15,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85
    });
    const river = new THREE.Mesh(riverGeo, riverMat);
    river.rotation.x = -Math.PI / 2;
    river.rotation.z = Math.PI / 4.5;
    river.position.set(1.5, -0.02, 0.5);
    scene.add(river);

    // ==========================================
    // 1. PROPORTIONAL URBAN DISTRICTS
    // ==========================================
    const cityGroup = new THREE.Group();

    const urbanBlocks = [
      { x: -9.5, z: 3.5, w: 2.2, h: 1.5, d: 2.2, color: 0x0f172a, roofColor: 0x38bdf8 },
      { x: -7.2, z: 6.2, w: 2.0, h: 1.2, d: 2.0, color: 0x0f172a, roofColor: 0x10b981 },
      { x: -9.8, z: -1.5, w: 2.4, h: 1.8, d: 2.2, color: 0x0f172a, roofColor: 0x38bdf8 },
      { x: -6.8, z: -4.5, w: 2.2, h: 2.2, d: 2.0, color: 0x0f172a, roofColor: 0x6366f1 },
      { x: -2.5, z: -5.5, w: 2.4, h: 2.8, d: 2.4, color: 0x09152a, roofColor: 0x38bdf8 },
      { x: 1.5, z: -6.5, w: 2.2, h: 3.2, d: 2.0, color: 0x09152a, roofColor: 0x38bdf8 },
      { x: -1.5, z: 5.5, w: 2.6, h: 2.0, d: 2.2, color: 0x09152a, roofColor: 0xf59e0b },
      { x: 5.5, z: -5.0, w: 2.5, h: 2.4, d: 2.2, color: 0x0a192f, roofColor: 0x10b981 },
      { x: 8.5, z: -3.5, w: 2.2, h: 2.6, d: 2.4, color: 0x0a192f, roofColor: 0x38bdf8 },
      { x: 5.8, z: 4.8, w: 2.4, h: 1.6, d: 2.2, color: 0x0a192f, roofColor: 0x10b981 },
      { x: 9.2, z: 3.8, w: 2.2, h: 1.9, d: 2.0, color: 0x0a192f, roofColor: 0x6366f1 }
    ];

    urbanBlocks.forEach((b) => {
      const bGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.35,
        metalness: 0.7
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(b.x, b.h / 2, b.z);
      cityGroup.add(bMesh);

      const edgeGeo = new THREE.EdgesGeometry(bGeo);
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.3
      });
      const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
      wireframe.position.copy(bMesh.position);
      cityGroup.add(wireframe);

      const floorCount = Math.floor(b.h / 0.55);
      for (let f = 1; f < floorCount; f++) {
        const bandGeo = new THREE.BoxGeometry(b.w + 0.02, 0.04, b.d + 0.02);
        const bandMat = new THREE.MeshBasicMaterial({
          color: b.roofColor,
          transparent: true,
          opacity: 0.22
        });
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.set(b.x, f * 0.55, b.z);
        cityGroup.add(band);
      }
    });
    scene.add(cityGroup);

    // ==========================================
    // 2. DYNAMIC NON-LINEAR ROUTE TRAJECTORY
    // ==========================================
    interface RouteWayPoint {
      pos: THREE.Vector3;
      mode: 'walking' | 'bus' | 'metro' | 'cab';
      legIndex: number;
      stationName?: string;
    }

    const waypoints: RouteWayPoint[] = [];

    const originLeg = route.legs[0];
    const destLeg = route.legs[route.legs.length - 1];
    const originName = originLeg?.from?.name || 'Jaipur Origin Hub';
    const destName = destLeg?.to?.name || 'Jaipur Destination';

    const metroLeg = route.legs.find((l) => l.mode === 'metro');
    const busLeg = route.legs.find((l) => l.mode === 'bus');

    const isPureWalk = route.id.includes('walk');
    const isMetroRoute = route.id.includes('metro');
    const isBusRoute = route.id.includes('bus');
    const isRiverRoute = route.id.includes('river');

    if (isPureWalk) {
      const walkPath = [
        new THREE.Vector3(-7.5, 0.04, 3.8),
        new THREE.Vector3(-5.5, 0.04, 3.8),
        new THREE.Vector3(-5.5, 0.04, 1.2),
        new THREE.Vector3(-2.8, 0.04, 0.2),
        new THREE.Vector3(0.5, 0.04, 0.8),
        new THREE.Vector3(3.5, 0.04, 0.8),
        new THREE.Vector3(3.5, 0.04, -2.2),
        new THREE.Vector3(6.8, 0.04, -2.2),
        new THREE.Vector3(7.8, 0.04, -1.0)
      ];
      walkPath.forEach((pt, i) => {
        waypoints.push({
          pos: pt,
          mode: 'walking',
          legIndex: 0,
          stationName:
            i === 0
              ? originName
              : i === 2
              ? 'Walled City Heritage Arcade'
              : i === 4
              ? 'Ram Niwas Bagh Footbridge'
              : i === walkPath.length - 1
              ? destName
              : undefined
        });
      });
    } else if (isMetroRoute) {
      // Access walk
      waypoints.push({ pos: new THREE.Vector3(-7.8, 0.04, 3.0), mode: 'walking', legIndex: 0, stationName: originName });
      waypoints.push({ pos: new THREE.Vector3(-6.2, 0.04, 3.0), mode: 'walking', legIndex: 0 });
      waypoints.push({ pos: new THREE.Vector3(-6.2, 0.04, 1.5), mode: 'walking', legIndex: 0 });
      waypoints.push({ pos: new THREE.Vector3(-5.2, 0.7, 0.8), mode: 'walking', legIndex: 0 });
      // Elevated Metro Track
      waypoints.push({ pos: new THREE.Vector3(-4.5, 1.35, 0.2), mode: 'metro', legIndex: 1, stationName: metroLeg?.from?.name || 'Jaipur Metro Boarding Platform' });
      waypoints.push({ pos: new THREE.Vector3(-2.5, 1.35, -1.5), mode: 'metro', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(0.8, 1.35, -2.4), mode: 'metro', legIndex: 1, stationName: 'Chandpole Metro Portal' });
      waypoints.push({ pos: new THREE.Vector3(4.2, 1.35, -1.8), mode: 'metro', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(6.5, 1.35, 0.5), mode: 'metro', legIndex: 1, stationName: metroLeg?.to?.name || 'Jaipur Metro Egress Platform' });
      // Egress walk
      waypoints.push({ pos: new THREE.Vector3(7.4, 0.6, 0.8), mode: 'walking', legIndex: 2 });
      waypoints.push({ pos: new THREE.Vector3(8.0, 0.04, 0.8), mode: 'walking', legIndex: 2, stationName: destName });
    } else if (isBusRoute) {
      waypoints.push({ pos: new THREE.Vector3(-7.5, 0.04, 3.2), mode: 'walking', legIndex: 0, stationName: originName });
      waypoints.push({ pos: new THREE.Vector3(-6.5, 0.04, 3.2), mode: 'walking', legIndex: 0, stationName: `${busLeg?.lineName || 'JCTSL'} Boarding Shelter` });
      waypoints.push({ pos: new THREE.Vector3(-4.5, 0.28, 3.2), mode: 'bus', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(-2.2, 0.28, 3.2), mode: 'bus', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(-1.0, 0.28, 1.8), mode: 'bus', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(-0.5, 0.28, -0.5), mode: 'bus', legIndex: 1, stationName: 'JLN Marg / Station Road Hub' });
      waypoints.push({ pos: new THREE.Vector3(1.5, 0.28, -1.8), mode: 'bus', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(4.5, 0.28, -2.4), mode: 'bus', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(6.5, 0.28, -1.2), mode: 'bus', legIndex: 1, stationName: `${destName} Bus Stop` });
      waypoints.push({ pos: new THREE.Vector3(7.6, 0.04, -1.2), mode: 'walking', legIndex: 2, stationName: destName });
    } else if (isRiverRoute) {
      waypoints.push({ pos: new THREE.Vector3(-7.2, 0.04, 3.5), mode: 'walking', legIndex: 0, stationName: originName });
      waypoints.push({ pos: new THREE.Vector3(-5.0, 0.28, 2.2), mode: 'cab', legIndex: 1, stationName: 'Zorawar Singh Heritage Gate' });
      waypoints.push({ pos: new THREE.Vector3(-2.8, 0.28, 1.4), mode: 'cab', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(0.2, 0.45, 0.2), mode: 'cab', legIndex: 1, stationName: 'Jal Mahal Promenade & Amer Road' });
      waypoints.push({ pos: new THREE.Vector3(3.2, 0.28, -0.8), mode: 'cab', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(5.8, 0.28, -1.5), mode: 'cab', legIndex: 1, stationName: 'Amer Road Gateway' });
      waypoints.push({ pos: new THREE.Vector3(7.5, 0.04, -1.5), mode: 'walking', legIndex: 2, stationName: destName });
    } else {
      // COMBO INTERCHANGE
      waypoints.push({ pos: new THREE.Vector3(-7.5, 0.04, 3.5), mode: 'walking', legIndex: 0, stationName: originName });
      waypoints.push({ pos: new THREE.Vector3(-6.0, 0.28, 3.5), mode: 'bus', legIndex: 0, stationName: 'Smart Feeder E-Rickshaw Pickup' });
      waypoints.push({ pos: new THREE.Vector3(-3.5, 0.28, 2.8), mode: 'bus', legIndex: 0 });
      waypoints.push({ pos: new THREE.Vector3(-1.5, 0.28, 1.2), mode: 'bus', legIndex: 0 });
      waypoints.push({ pos: new THREE.Vector3(0.0, 0.28, 0.5), mode: 'walking', legIndex: 1, stationName: route.legs[0]?.to?.name || 'Sindhi Camp Intermodal Hub' });
      waypoints.push({ pos: new THREE.Vector3(0.2, 0.8, -0.2), mode: 'walking', legIndex: 1 });
      waypoints.push({ pos: new THREE.Vector3(0.5, 1.35, -0.8), mode: 'metro', legIndex: 2, stationName: 'Jaipur Metro Pink Line Concourse' });
      waypoints.push({ pos: new THREE.Vector3(3.2, 1.35, -1.5), mode: 'metro', legIndex: 2 });
      waypoints.push({ pos: new THREE.Vector3(6.2, 1.35, -1.8), mode: 'metro', legIndex: 2, stationName: metroLeg?.to?.name || 'Destination Metro Terminal' });
      waypoints.push({ pos: new THREE.Vector3(7.8, 0.04, -1.8), mode: 'walking', legIndex: 2, stationName: destName });
    }

    const curvePoints = waypoints.map((w) => w.pos);
    const masterRouteCurve = new THREE.CatmullRomCurve3(curvePoints, false, 'centripetal', 0.4);

    // ==========================================
    // 3. PHYSICAL TRACK INFRASTRUCTURE PER MODE
    // ==========================================
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i].pos;
      const p2 = waypoints[i + 1].pos;
      const legMode = waypoints[i].mode;
      const segCurve = new THREE.CatmullRomCurve3([p1, p2]);

      if (legMode === 'metro') {
        // Viaduct Deck
        const viaductGeo = new THREE.TubeGeometry(segCurve, 16, 0.24, 6, false);
        const viaductMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 });
        const viaduct = new THREE.Mesh(viaductGeo, viaductMat);
        viaduct.position.y -= 0.06;
        scene.add(viaduct);

        // Dual Steel Rails
        const leftRailOffset = new THREE.Vector3(-0.14, 0.04, 0.14);
        const rightRailOffset = new THREE.Vector3(0.14, 0.04, -0.14);
        const rail1Curve = new THREE.CatmullRomCurve3([p1.clone().add(leftRailOffset), p2.clone().add(leftRailOffset)]);
        const rail2Curve = new THREE.CatmullRomCurve3([p1.clone().add(rightRailOffset), p2.clone().add(rightRailOffset)]);
        const railMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        scene.add(new THREE.Mesh(new THREE.TubeGeometry(rail1Curve, 16, 0.022, 6, false), railMat));
        scene.add(new THREE.Mesh(new THREE.TubeGeometry(rail2Curve, 16, 0.022, 6, false), railMat));

        // Pillars
        if (p1.y > 0.4) {
          const pillarGeo = new THREE.CylinderGeometry(0.08, 0.1, p1.y, 10);
          const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
          const pil = new THREE.Mesh(pillarGeo, pillarMat);
          pil.position.set(p1.x, p1.y / 2, p1.z);
          scene.add(pil);
        }
      } else if (legMode === 'bus' || legMode === 'cab') {
        // Surface Roadway Deck
        const roadGeo = new THREE.TubeGeometry(segCurve, 16, 0.34, 4, false);
        const roadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });
        const road = new THREE.Mesh(roadGeo, roadMat);
        road.position.y -= 0.04;
        scene.add(road);

        // Core Guidance Line
        const coreGeo = new THREE.TubeGeometry(segCurve, 16, 0.04, 8, false);
        const coreMat = new THREE.MeshBasicMaterial({ color: legMode === 'cab' ? 0xeab308 : 0xf59e0b });
        scene.add(new THREE.Mesh(coreGeo, coreMat));
      } else {
        // Walking Turquoise Path
        const walkGeo = new THREE.TubeGeometry(segCurve, 16, 0.032, 6, false);
        const walkMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: 0x0891b2,
          emissiveIntensity: 0.7,
          wireframe: true
        });
        scene.add(new THREE.Mesh(walkGeo, walkMat));
      }
    }

    // Stations
    waypoints.forEach((wp) => {
      if (!wp.stationName) return;
      const stationGroup = new THREE.Group();
      stationGroup.position.copy(wp.pos);

      const isStart = wp.stationName.includes('Origin') || wp.stationName.includes('Grand Central');
      const isEnd = wp.stationName.includes('Destination') || wp.stationName.includes('Gateway');

      const platGeo = new THREE.BoxGeometry(1.3, 0.14, 1.1);
      const platMat = new THREE.MeshStandardMaterial({
        color: isStart ? 0x065f46 : isEnd ? 0x991b1b : 0x0369a1,
        emissive: isStart ? 0x059669 : isEnd ? 0xdc2626 : 0x0284c7,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.8
      });
      const platform = new THREE.Mesh(platGeo, platMat);
      platform.position.y = -0.06;
      stationGroup.add(platform);

      const canopyGeo = new THREE.BoxGeometry(1.5, 0.04, 1.3);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
        metalness: 0.9
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.y = 0.52;
      stationGroup.add(canopy);

      const ringGeo = new THREE.RingGeometry(0.65, 0.75, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isStart ? 0x10b981 : isEnd ? 0xef4444 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      stationGroup.add(ring);

      scene.add(stationGroup);
    });

    // ==========================================
    // 4. DISTINCT 3D VEHICLE MODELS
    // ==========================================
    // Parent holder that moves along the spline
    const movingHolder = new THREE.Group();
    scene.add(movingHolder);

    // ------------------------------------------
    // MODEL A: WALKING PEDESTRIAN (Humanoid Traveler)
    // ------------------------------------------
    const pedestrianModel = new THREE.Group();
    pedestrianModel.name = 'walking';

    // Torso with Backpack
    const torsoGeo = new THREE.BoxGeometry(0.18, 0.28, 0.14);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.32;
    pedestrianModel.add(torso);

    const packGeo = new THREE.BoxGeometry(0.14, 0.22, 0.1);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4 });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(-0.1, 0.32, 0);
    pedestrianModel.add(pack);

    // Head with Visor
    const headGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.52;
    pedestrianModel.add(head);

    const visorGeo = new THREE.BoxGeometry(0.08, 0.04, 0.12);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0.06, 0.52, 0);
    pedestrianModel.add(visor);

    // Left & Right Legs
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(0, 0.11, 0.05);
    pedestrianModel.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0, 0.11, -0.05);
    pedestrianModel.add(legR);

    // Aura Step Rings around feet
    const stepRingGeo = new THREE.RingGeometry(0.2, 0.28, 16);
    const stepRingMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const stepRing = new THREE.Mesh(stepRingGeo, stepRingMat);
    stepRing.rotation.x = Math.PI / 2;
    stepRing.position.y = 0.02;
    pedestrianModel.add(stepRing);

    movingHolder.add(pedestrianModel);

    // ------------------------------------------
    // MODEL B: METRO BULLET TRAIN (Articulated Express)
    // ------------------------------------------
    const metroTrainModel = new THREE.Group();
    metroTrainModel.name = 'metro';

    // Lead Carriage
    const carLength = 1.35;
    const trainGeo = new THREE.BoxGeometry(carLength, 0.24, 0.3);
    const trainMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.85
    });
    const leadCar = new THREE.Mesh(trainGeo, trainMat);
    leadCar.position.y = 0.13;
    metroTrainModel.add(leadCar);

    // Aerodynamic Nose Wedge
    const noseGeo = new THREE.ConeGeometry(0.18, 0.38, 4);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(carLength / 2 + 0.15, 0.13, 0);
    metroTrainModel.add(nose);

    // Glowing Cyan Window Band
    const winBandGeo = new THREE.BoxGeometry(carLength * 0.88, 0.08, 0.31);
    const winBandMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const winBand = new THREE.Mesh(winBandGeo, winBandMat);
    winBand.position.y = 0.15;
    metroTrainModel.add(winBand);

    // Overhead Pantograph Arm
    const pantoGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6);
    const pantoMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
    const panto = new THREE.Mesh(pantoGeo, pantoMat);
    panto.position.set(-0.2, 0.32, 0);
    metroTrainModel.add(panto);

    const pantoHeadGeo = new THREE.BoxGeometry(0.04, 0.015, 0.25);
    const pantoHead = new THREE.Mesh(pantoHeadGeo, pantoMat);
    pantoHead.position.set(-0.2, 0.42, 0);
    metroTrainModel.add(pantoHead);

    // Front Xenon Headlight + Beam
    const headlightGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headlight = new THREE.Mesh(headlightGeo, headlightMat);
    headlight.position.set(carLength / 2 + 0.3, 0.13, 0);
    metroTrainModel.add(headlight);

    const beamGeo = new THREE.ConeGeometry(0.35, 1.8, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.z = -Math.PI / 2;
    beam.position.set(carLength / 2 + 1.2, 0.13, 0);
    metroTrainModel.add(beam);

    movingHolder.add(metroTrainModel);

    // ------------------------------------------
    // MODEL C: MUNICIPAL CITY BUS (Transit Coach)
    // ------------------------------------------
    const transitBusModel = new THREE.Group();
    transitBusModel.name = 'bus';

    const busBodyLength = 1.15;
    const busBodyGeo = new THREE.BoxGeometry(busBodyLength, 0.32, 0.42);
    const busBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Amber Bus
      roughness: 0.3,
      metalness: 0.6
    });
    const busBody = new THREE.Mesh(busBodyGeo, busBodyMat);
    busBody.position.y = 0.18;
    transitBusModel.add(busBody);

    // Front Windshield
    const windshieldGeo = new THREE.BoxGeometry(0.12, 0.18, 0.38);
    const windshieldMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(busBodyLength / 2 - 0.02, 0.21, 0);
    transitBusModel.add(windshield);

    // Side Passenger Windows
    const sideWinGeo = new THREE.BoxGeometry(busBodyLength * 0.75, 0.11, 0.43);
    const sideWin = new THREE.Mesh(sideWinGeo, windshieldMat);
    sideWin.position.y = 0.21;
    transitBusModel.add(sideWin);

    // Illuminated Route Board above windshield [101 CITYLINK]
    const signGeo = new THREE.BoxGeometry(0.04, 0.05, 0.24);
    const signMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(busBodyLength / 2 + 0.02, 0.31, 0);
    transitBusModel.add(sign);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const wheelPositions = [
      [0.35, 0.07, 0.22],
      [0.35, 0.07, -0.22],
      [-0.35, 0.07, 0.22],
      [-0.35, 0.07, -0.22]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      transitBusModel.add(wheel);
    });

    // Twin Bus Headlights
    const busHlGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const busHlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bhl1 = new THREE.Mesh(busHlGeo, busHlMat);
    bhl1.position.set(busBodyLength / 2 + 0.02, 0.12, 0.14);
    const bhl2 = new THREE.Mesh(busHlGeo, busHlMat);
    bhl2.position.set(busBodyLength / 2 + 0.02, 0.12, -0.14);
    transitBusModel.add(bhl1);
    transitBusModel.add(bhl2);

    movingHolder.add(transitBusModel);

    // ------------------------------------------
    // MODEL D: YELLOW TAXI CAB / RIDE-HAIL SEDAN
    // ------------------------------------------
    const cabModel = new THREE.Group();
    cabModel.name = 'cab';

    const cabLength = 0.95;
    // Lower Chassis
    const cabChassisGeo = new THREE.BoxGeometry(cabLength, 0.16, 0.38);
    const cabChassisMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15, // Yellow Cab
      roughness: 0.2,
      metalness: 0.7
    });
    const cabChassis = new THREE.Mesh(cabChassisGeo, cabChassisMat);
    cabChassis.position.y = 0.11;
    cabModel.add(cabChassis);

    // Cabin Greenhouse & Roof
    const cabinGeo = new THREE.BoxGeometry(cabLength * 0.52, 0.14, 0.34);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.2,
      metalness: 0.7
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.06, 0.22, 0);
    cabModel.add(cabin);

    // Windows
    const cabGlassGeo = new THREE.BoxGeometry(cabLength * 0.5, 0.09, 0.35);
    const cabGlassMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const cabGlass = new THREE.Mesh(cabGlassGeo, cabGlassMat);
    cabGlass.position.set(-0.06, 0.22, 0);
    cabModel.add(cabGlass);

    // Illuminated Rooftop [TAXI] Sign
    const taxiSignGeo = new THREE.BoxGeometry(0.12, 0.05, 0.14);
    const taxiSignMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const taxiSign = new THREE.Mesh(taxiSignGeo, taxiSignMat);
    taxiSign.position.set(-0.06, 0.32, 0);
    cabModel.add(taxiSign);

    // Checkered Black Decal Stripe on Side
    const checkGeo = new THREE.BoxGeometry(cabLength * 0.7, 0.03, 0.39);
    const checkMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const check = new THREE.Mesh(checkGeo, checkMat);
    check.position.set(-0.02, 0.12, 0);
    cabModel.add(check);

    // Wheels
    const cabWheelPositions = [
      [0.28, 0.06, 0.19],
      [0.28, 0.06, -0.19],
      [-0.28, 0.06, 0.19],
      [-0.28, 0.06, -0.19]
    ];
    cabWheelPositions.forEach(([cx, cy, cz]) => {
      const cWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), wheelMat);
      cWheel.rotation.x = Math.PI / 2;
      cWheel.position.set(cx, cy, cz);
      cabModel.add(cWheel);
    });

    movingHolder.add(cabModel);

    // Dynamic Trail Sparks
    const sparkCount = 45;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const sparkParticles = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkParticles);

    // Helper: determine active mode from position along path
    const getActiveModeAtProgress = (prog: number): 'walking' | 'bus' | 'metro' | 'cab' => {
      if (forcedVehicleMode !== 'auto') {
        return forcedVehicleMode;
      }
      // Sample which waypoint segment we are currently in
      const index = Math.min(waypoints.length - 1, Math.floor(prog * waypoints.length));
      return waypoints[index]?.mode || 'metro';
    };

    // ==========================================
    // 5. ORBIT & TOUCH CONTROLS
    // ==========================================
    const updateCameraFromSpherical = () => {
      const { radius, theta, phi } = sphericalRef.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 0.4, 0);
    };

    updateCameraFromSpherical();

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      sphericalRef.current.theta -= deltaX * 0.006;
      sphericalRef.current.phi = Math.max(0.2, Math.min(Math.PI / 2.05, sphericalRef.current.phi - deltaY * 0.006));
      updateCameraFromSpherical();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      sphericalRef.current.radius = Math.max(9, Math.min(30, sphericalRef.current.radius + e.deltaY * 0.015));
      updateCameraFromSpherical();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // ==========================================
    // 6. ANIMATION LOOP & ACTIVE MODEL SWITCHING
    // ==========================================
    let clock = new THREE.Clock();
    let travelProgress = 0;
    const trailPositionsHistory: THREE.Vector3[] = [];

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      if (autoRotate && !isDraggingRef.current && activeView === 'isometric') {
        sphericalRef.current.theta += delta * 0.08;
        updateCameraFromSpherical();
      }

      if (!prefersReducedMotion) {
        // Detect current mode
        const activeCurrentMode = getActiveModeAtProgress(travelProgress);

        // Adjust speed based on mode
        const baseSpeed = activeCurrentMode === 'walking' ? 0.045 : activeCurrentMode === 'bus' ? 0.065 : activeCurrentMode === 'cab' ? 0.075 : 0.085;
        travelProgress = (travelProgress + delta * baseSpeed) % 1;

        const currentPos = masterRouteCurve.getPointAt(travelProgress);
        const lookAheadProgress = (travelProgress + 0.018) % 1;
        const targetPos = masterRouteCurve.getPointAt(lookAheadProgress);

        movingHolder.position.copy(currentPos);
        movingHolder.lookAt(targetPos);

        // Visibility toggles for distinct 3D models
        pedestrianModel.visible = activeCurrentMode === 'walking';
        metroTrainModel.visible = activeCurrentMode === 'metro';
        transitBusModel.visible = activeCurrentMode === 'bus';
        cabModel.visible = activeCurrentMode === 'cab';

        // Animate pedestrian walking stride
        if (activeCurrentMode === 'walking') {
          const stride = Math.sin(time * 12) * 0.35;
          legL.rotation.x = stride;
          legR.rotation.x = -stride;
          torso.position.y = 0.32 + Math.abs(Math.sin(time * 12)) * 0.03;
          stepRing.scale.set(1 + Math.sin(time * 8) * 0.2, 1 + Math.sin(time * 8) * 0.2, 1);
        }

        // Progress percentage
        const pct = Math.round(travelProgress * 100);
        setCurrentProgress(pct);

        // Update labels and HUD
        if (activeCurrentMode === 'metro') {
          setActiveElevation('+14.2m [Metro Viaduct]');
          setActiveSpeed('78 km/h');
          setActiveModeLabel('Metro Bullet Train');
          sparkMat.color.setHex(0x38bdf8);
        } else if (activeCurrentMode === 'bus') {
          setActiveElevation('+3.8m [Curved Avenue]');
          setActiveSpeed('36 km/h');
          setActiveModeLabel('CityLink Transit Bus');
          sparkMat.color.setHex(0xf59e0b);
        } else if (activeCurrentMode === 'cab') {
          setActiveElevation('+3.8m [Surface Road]');
          setActiveSpeed('48 km/h');
          setActiveModeLabel('Yellow Cyber Taxi');
          sparkMat.color.setHex(0xfacc15);
        } else {
          setActiveElevation('0.0m [Ground Level]');
          setActiveSpeed('5.2 km/h');
          setActiveModeLabel('Pedestrian Walker');
          sparkMat.color.setHex(0x06b6d4);
        }

        // Direction orientation
        const moveVector = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();
        if (Math.abs(moveVector.x) > Math.abs(moveVector.z)) {
          setActiveTurnNotice(moveVector.x > 0 ? 'Heading Eastbound' : 'Heading Westbound');
        } else {
          setActiveTurnNotice(moveVector.z > 0 ? 'Turning Southbound' : 'Turning Northbound');
        }

        // Camera Follow Mode
        if (activeView === 'follow') {
          camera.position.set(currentPos.x - 4.5, currentPos.y + 2.4, currentPos.z + 4.0);
          camera.lookAt(targetPos.x, targetPos.y + 0.3, targetPos.z);
        }

        // Particle trail
        trailPositionsHistory.unshift(currentPos.clone());
        if (trailPositionsHistory.length > sparkCount) trailPositionsHistory.pop();

        const positions = sparkGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < sparkCount; i++) {
          const p = trailPositionsHistory[i] || currentPos;
          positions.setXYZ(i, p.x, p.y + 0.08, p.z);
        }
        positions.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);

      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [route, autoRotate, activeView, forcedVehicleMode]);

  // Preset camera angles
  const setCameraPreset = (view: 'isometric' | 'top' | 'side' | 'follow') => {
    setActiveView(view);
    if (!cameraRef.current) return;

    if (view === 'isometric') {
      sphericalRef.current = { radius: 18, theta: Math.PI / 4.4, phi: Math.PI / 3.2 };
    } else if (view === 'top') {
      sphericalRef.current = { radius: 21, theta: 0, phi: 0.05 };
    } else if (view === 'side') {
      sphericalRef.current = { radius: 18, theta: Math.PI / 2, phi: Math.PI / 2.3 };
    }
  };

  const handleZoom = (direction: 'in' | 'out') => {
    sphericalRef.current.radius = Math.max(9, Math.min(30, sphericalRef.current.radius + (direction === 'in' ? -2.5 : 2.5)));
  };

  return (
    <div className="relative w-full h-[400px] sm:h-[460px] rounded-3xl overflow-hidden border-2 border-slate-800 bg-slate-950 shadow-2xl group">
      {/* 3D WebGL Canvas Viewport */}
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing select-none" 
        title="Click and drag to orbit in 3D • Scroll to zoom"
      />

      {/* Top Glass Telemetry HUD Strip */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-20">
        {/* Left Telemetry Cluster */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-xl px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-slate-700/70 text-xs shadow-xl pointer-events-auto min-w-0 shrink">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
          <span className="font-bold text-white tracking-wide truncate max-w-[110px] sm:max-w-[200px] md:max-w-[280px]">{route.title}</span>
          <span className="text-slate-500 shrink-0">•</span>
          <span className="font-mono text-cyan-300 font-semibold shrink-0">{currentProgress}%</span>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden md:inline font-mono text-emerald-400 font-bold shrink-0">{activeElevation}</span>
        </div>

        {/* Right Camera Controls & Modes */}
        <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/95 backdrop-blur-xl p-1 sm:p-1.5 rounded-2xl border border-slate-700/80 shadow-2xl pointer-events-auto shrink-0 z-30">
          <button
            onClick={() => setCameraPreset('isometric')}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition ${
              activeView === 'isometric' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="sm:hidden">Iso</span>
            <span className="hidden sm:inline">Isometric</span>
          </button>
          <button
            onClick={() => setCameraPreset('top')}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition ${
              activeView === 'top' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="sm:hidden">2D</span>
            <span className="hidden sm:inline">Aerial 2D</span>
          </button>
          <button
            onClick={() => setCameraPreset('side')}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition ${
              activeView === 'side' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span className="sm:hidden">Elev</span>
            <span className="hidden sm:inline">Elevation</span>
          </button>
          <button
            onClick={() => setCameraPreset('follow')}
            className={`px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-semibold transition ${
              activeView === 'follow' ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20' : 'text-slate-300 hover:text-white'
            }`}
          >
            Follow
          </button>

          {/* Auto Orbit Toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-xl border transition ${
              autoRotate ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title={autoRotate ? 'Pause Orbit' : 'Auto Orbit Showcase'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          {/* Zoom Buttons */}
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Speedometer, Active Model Badge & Mode Avatar Switcher */}
      <div className="absolute top-[56px] sm:top-[60px] left-3 right-3 flex flex-wrap items-center gap-2 pointer-events-none z-10">
        <div className="bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2 pointer-events-auto shadow-lg">
          <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Vehicle: <strong className="text-white">{activeModeLabel}</strong></span>
          <span className="text-cyan-400 font-bold">[{activeSpeed}]</span>
        </div>

        {/* 3D Model Avatar Selector Chips (Walk, Metro, Bus, Cab) */}
        <div className="bg-slate-900/90 backdrop-blur-xl p-1 rounded-xl border border-slate-700/80 flex items-center gap-1 pointer-events-auto shadow-xl text-[10px]">
          <span className="text-slate-400 px-1.5 font-bold uppercase">Model:</span>
          <button
            onClick={() => setForcedVehicleMode('auto')}
            className={`px-2 py-0.5 rounded-lg font-semibold transition ${
              forcedVehicleMode === 'auto' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
            title="Auto-morph as journey progresses through legs"
          >
            Auto Leg
          </button>
          <button
            onClick={() => setForcedVehicleMode('walking')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg transition ${
              forcedVehicleMode === 'walking' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
            title="Switch to 3D Pedestrian Walker model"
          >
            <Footprints className="w-3 h-3" />
            <span>Walk</span>
          </button>
          <button
            onClick={() => setForcedVehicleMode('metro')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg transition ${
              forcedVehicleMode === 'metro' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
            title="Switch to 3D Metro Bullet Train model"
          >
            <Train className="w-3 h-3" />
            <span>Metro</span>
          </button>
          <button
            onClick={() => setForcedVehicleMode('bus')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg transition ${
              forcedVehicleMode === 'bus' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
            title="Switch to 3D CityLink Transit Bus model"
          >
            <Bus className="w-3 h-3" />
            <span>Bus</span>
          </button>
          <button
            onClick={() => setForcedVehicleMode('cab')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg transition ${
              forcedVehicleMode === 'cab' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
            title="Switch to 3D Yellow Taxi Cab model"
          >
            <Car className="w-3 h-3" />
            <span>Cab</span>
          </button>
        </div>
      </div>

      {/* Bottom Distinct Mode Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-xl px-4 py-2 rounded-2xl border border-slate-700/70 text-xs shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-slate-200">🚶 Pedestrian Model</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-200">🚌 CityLink Bus Model</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span className="text-slate-200">🚇 Metro Train Model</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="text-slate-200">🚕 Yellow Taxi Cab Model</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-xl px-3.5 py-2 rounded-2xl border border-slate-700/70 text-xs text-emerald-400 font-medium pointer-events-auto shadow-2xl">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <span>Dynamic 3D Multi-Modal Avatars</span>
        </div>
      </div>
    </div>
  );
};
