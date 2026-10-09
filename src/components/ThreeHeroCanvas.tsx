/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export const ThreeHeroCanvas: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // WebGL support check
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch (e) {
      setWebglSupported(false);
      return;
    }

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.035);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 3.5, 9);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ==========================================
    // 1. PROCEDURAL 3D WAVE-AURA RIBBON
    // ==========================================
    const planeGeo = new THREE.PlaneGeometry(16, 12, 64, 48);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Sky Blue
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.8
    });
    const waveMesh = new THREE.Mesh(planeGeo, planeMat);
    waveMesh.rotation.x = -Math.PI / 2.3;
    waveMesh.position.y = -1.2;
    scene.add(waveMesh);

    // ==========================================
    // 2. LUMINOUS TRANSIT ROUTES (3D CURVES)
    // ==========================================
    interface TransitPath {
      curve: THREE.CatmullRomCurve3;
      tubeMesh: THREE.Mesh;
      pulseSphere: THREE.Mesh;
      color: number;
      speed: number;
      offset: number;
    }

    const transitPaths: TransitPath[] = [];

    // Transit nodes in 3D space
    const nodes = [
      new THREE.Vector3(-4, -0.6, 1.5),  // Origin West
      new THREE.Vector3(-1.8, 0.2, -0.5), // Interchange Station
      new THREE.Vector3(1.2, 0.8, -1.2),  // Central Hub
      new THREE.Vector3(3.8, 0.1, 1.8),   // Tech Park East
      new THREE.Vector3(0, 1.5, 0.5),     // Elevated Crossing
      new THREE.Vector3(-2.5, -0.2, 2.5), // Waterfront
      new THREE.Vector3(2.5, -0.5, 2.2)   // South Terminal
    ];

    // Node markers (Glowing Orbs)
    const nodeSpheres: THREE.Mesh[] = [];
    nodes.forEach((pos, idx) => {
      const isHub = idx === 1 || idx === 2;
      const sphereGeo = new THREE.SphereGeometry(isHub ? 0.22 : 0.14, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: isHub ? 0x38bdf8 : idx % 2 === 0 ? 0x34d399 : 0xfbbf24
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(pos);
      scene.add(sphere);
      nodeSpheres.push(sphere);

      // Outer Halo Ring
      const ringGeo = new THREE.RingGeometry(isHub ? 0.32 : 0.22, isHub ? 0.38 : 0.26, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isHub ? 0x0284c7 : 0x10b981,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    });

    // Create 3 interconnected multi-modal routes
    const routeDefinitions = [
      {
        points: [nodes[0], nodes[1], nodes[2], nodes[3]],
        color: 0x38bdf8, // Sky Blue (Metro M1)
        speed: 0.0035
      },
      {
        points: [nodes[5], nodes[1], nodes[4], nodes[6]],
        color: 0x34d399, // Emerald Green (Metro M2)
        speed: 0.0028
      },
      {
        points: [nodes[0], new THREE.Vector3(-1.5, -0.4, 2.2), nodes[6]],
        color: 0xfbbf24, // Amber (Bus Line)
        speed: 0.0022
      }
    ];

    routeDefinitions.forEach((def, rIdx) => {
      const curve = new THREE.CatmullRomCurve3(def.points);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.035, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.7
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      // Moving Pulse Beacon along curve
      const pulseGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulseSphere = new THREE.Mesh(pulseGeo, pulseMat);
      scene.add(pulseSphere);

      transitPaths.push({
        curve,
        tubeMesh,
        pulseSphere,
        color: def.color,
        speed: def.speed,
        offset: rIdx * 0.33
      });
    });

    // ==========================================
    // 3. FLOATING AMBIENT PARTICLES (AURA GLOW)
    // ==========================================
    const particlesCount = 200;
    const particlePositions = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 14;
      particlePositions[i + 1] = Math.random() * 4 - 1;
      particlePositions[i + 2] = (Math.random() - 0.5) * 10;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // ==========================================
    // 4. LIGHTING
    // ==========================================
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x38bdf8, 2.5, 20);
    pointLight.position.set(0, 4, 3);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x10b981, 1.8, 15);
    pointLight2.position.set(-3, 2, -2);
    scene.add(pointLight2);

    // ==========================================
    // 5. INTERACTION & PARALLAX
    // ==========================================
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x * 0.8;
      mouseY = y * 0.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // ==========================================
    // 6. ANIMATION LOOP
    // ==========================================
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const positionAttr = planeGeo.attributes.position as THREE.BufferAttribute;
    const origPositions = positionAttr.array.slice() as Float32Array;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax
      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      camera.position.x = targetX * 1.5;
      camera.position.y = 3.5 + targetY * 0.8;
      camera.lookAt(0, 0.2, 0);

      // Undulate wave terrain vertices
      if (!prefersReducedMotion) {
        for (let i = 0; i < positionAttr.count; i++) {
          const u = origPositions[i * 3];
          const v = origPositions[i * 3 + 1];
          const z = Math.sin(u * 0.6 + elapsedTime * 1.5) * 0.4 + Math.cos(v * 0.8 + elapsedTime * 1.2) * 0.3;
          positionAttr.setZ(i, z);
        }
        positionAttr.needsUpdate = true;

        // Animate transit pulses along 3D curves
        transitPaths.forEach((tp) => {
          tp.offset = (tp.offset + tp.speed) % 1;
          const pos = tp.curve.getPointAt(tp.offset);
          tp.pulseSphere.position.copy(pos);
        });

        // Slow rotate particle field
        particleSystem.rotation.y = elapsedTime * 0.02;

        // Node markers breathing pulse
        nodeSpheres.forEach((sphere, i) => {
          const scale = 1 + Math.sin(elapsedTime * 3 + i) * 0.12;
          sphere.scale.set(scale, scale, scale);
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // ==========================================
    // 7. RESIZE LISTENER
    // ==========================================
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      planeGeo.dispose();
      planeMat.dispose();
    };
  }, []);

  if (!webglSupported) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-sky-950/40 to-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <p className="text-xs uppercase tracking-widest text-cyan-400 font-mono">WAYORA Aura Flow • 2D Adaptive Fallback Active</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full pointer-events-auto cursor-grab active:cursor-grabbing overflow-hidden"
      style={{ touchAction: 'none' }}
    />
  );
};
