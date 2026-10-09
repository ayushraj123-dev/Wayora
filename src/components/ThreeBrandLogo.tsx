/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeBrandLogoProps {
  size?: number;
  className?: string;
}

export const ThreeBrandLogo: React.FC<ThreeBrandLogoProps> = ({ size = 42, className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.z = 3.6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Torus knot representing the interconnected Wave and Aura
    const knotGeo = new THREE.TorusKnotGeometry(0.85, 0.22, 64, 16, 2, 3);
    const knotMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8
    });
    const knotMesh = new THREE.Mesh(knotGeo, knotMat);
    scene.add(knotMesh);

    // Inner glowing Aura Orb
    const coreGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: false
    });
    const coreSphere = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreSphere);

    // Light
    const light = new THREE.PointLight(0x38bdf8, 3, 10);
    light.position.set(2, 2, 3);
    scene.add(light);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambLight);

    let frameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!prefersReducedMotion) {
        const time = clock.getElapsedTime();
        knotMesh.rotation.x = time * 0.8;
        knotMesh.rotation.y = time * 1.1;

        const pulse = 1 + Math.sin(time * 3) * 0.15;
        coreSphere.scale.set(pulse, pulse, pulse);
      }
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      knotGeo.dispose();
      knotMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={`inline-block relative overflow-hidden rounded-xl ${className}`}
      style={{ width: size, height: size }}
      title="WAYORA — Way + Aura"
    />
  );
};
