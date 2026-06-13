"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, History, ChevronLeft, Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import { GameHeader } from "../components/GameHeader";
import { PrizesSidebar } from "../components/PrizesSidebar";

/**
 * КУБИКИ В ТАРЕЛКЕ (MOBILE OPTIMIZED)
 *
 * - Адаптивная верстка под любые экраны
 * - Оптимизированная физика и рендер
 * - Улучшенный UI для тач-устройств
 */

export default function BowlPhysicsDice() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [tickets, setTickets] = useState(3);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [player, setPlayer] = useState<any>(null);
  const [showPrizes, setShowPrizes] = useState(false);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [result, setResult] = useState<{
    d1: number;
    d2: number;
    sum: number;
  } | null>(null);
  const [gameMessage, setGameMessage] = useState<{
    text: string;
    sub?: string;
    color: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const sceneRef = useRef<THREE.Scene | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const diceRefs = useRef<{ mesh: THREE.Mesh; body: CANNON.Body }[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const requestRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meshOffsetsRef = useRef<THREE.Quaternion[]>([new THREE.Quaternion(), new THREE.Quaternion()]);
  const isFastForwardingRef = useRef<boolean>(false);

  // === AUDIO SYSTEM ===
  const playCollisionSound = useCallback((strength: number) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const freq = 120 + Math.random() * 80;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.15);

    const volume = Math.min(strength / 20, 0.4);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const [playerRes, prizesRes] = await Promise.all([
          fetch("/api/promo/player"),
          fetch("/api/promo/prizes?gameType=dice&all=true"),
        ]);

        const playerData = await playerRes.json();
        if (playerData.success || playerData.tickets !== undefined) {
          setPlayer(playerData.player);
          setTickets(playerData.tickets);
          setBonusBalance(playerData.player?.bonusBalance || 0);
        }

        const prizesData = await prizesRes.json();
        if (prizesData.success) {
          setPrizes(prizesData.prizes || []);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;

    const initScene = () => {
      if (!containerRef.current || initialized) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width === 0 || height === 0) return;

      initialized = true;

      // --- THREE.JS SETUP ---
      const scene = new THREE.Scene();
      scene.background = null;
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
      camera.position.set(0, 14, 2);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const spotLight = new THREE.SpotLight(0xffffff, 1.5);
      spotLight.position.set(5, 15, 5);
      spotLight.angle = Math.PI / 6;
      spotLight.penumbra = 0.3;
      spotLight.castShadow = true;
      spotLight.shadow.mapSize.width = 1024;
      spotLight.shadow.mapSize.height = 1024;
      scene.add(spotLight);

      const fillLight = new THREE.PointLight(0xff9900, 0.5);
      fillLight.position.set(-5, 5, -2);
      scene.add(fillLight);

      // --- CANNON-ES SETUP ---
      const world = new CANNON.World();
      world.gravity.set(0, -35, 0);
      worldRef.current = world;

      const diceMaterial = new CANNON.Material("dice");
      const bowlMaterial = new CANNON.Material("bowl");
      world.addContactMaterial(
        new CANNON.ContactMaterial(bowlMaterial, diceMaterial, {
          friction: 0.15,
          restitution: 0.5,
        }),
      );

      // Floor
      const floorBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: bowlMaterial,
      });
      floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      world.addBody(floorBody);

      const floorMesh = new THREE.Mesh(
        new THREE.CircleGeometry(6, 48),
        new THREE.MeshStandardMaterial({
          color: 0x111111,
          roughness: 0.8,
          metalness: 0.1,
        }),
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Бортики тарелки
      const wallCount = 12;
      const wallRadius = 5.3;
      const wallHeight = 10;
      const wallThickness = 1;
      const segmentWidth = (2 * Math.PI * wallRadius) / wallCount;

      for (let i = 0; i < wallCount; i++) {
        const angle = (i / wallCount) * Math.PI * 2;
        const x = Math.cos(angle) * wallRadius;
        const z = Math.sin(angle) * wallRadius;

        const wallBody = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Box(
            new CANNON.Vec3(
              segmentWidth / 1.8,
              wallHeight / 2,
              wallThickness / 2,
            ),
          ),
          material: bowlMaterial,
        });

        wallBody.position.set(x, wallHeight / 2, z);
        wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle);
        world.addBody(wallBody);
      }

      // Visual Bowl
      const points = [];
      for (let i = 0; i < 10; i++)
        points.push(new THREE.Vector2(4.5 + i * 0.1, i * 0.25));
      const bowlGeom = new THREE.LatheGeometry(points, 64);
      const bowlMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide,
      });
      const bowlMesh = new THREE.Mesh(bowlGeom, bowlMat);
      bowlMesh.castShadow = true;
      bowlMesh.receiveShadow = true;
      scene.add(bowlMesh);

      // Top Ring
      const torusGeom = new THREE.TorusGeometry(5.4, 0.1, 16, 100);
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0xffa500,
        emissive: 0xffa500,
        emissiveIntensity: 0.2,
        metalness: 0.9,
        roughness: 0.1,
      });
      const torusMesh = new THREE.Mesh(torusGeom, torusMat);
      torusMesh.rotation.x = Math.PI / 2;
      torusMesh.position.y = 2.2;
      scene.add(torusMesh);

      // Dice Factory
      const createDice = (x: number) => {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const createFaceCanvas = (dots: number) => {
          const canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 128;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          const r = 20;
          ctx.moveTo(r, 0);
          ctx.lineTo(128 - r, 0);
          ctx.quadraticCurveTo(128, 0, 128, r);
          ctx.lineTo(128, 128 - r);
          ctx.quadraticCurveTo(128, 128, 128 - r, 128);
          ctx.lineTo(r, 128);
          ctx.quadraticCurveTo(0, 128, 0, 128 - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.fill();
          ctx.strokeStyle = "#dddddd";
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.fillStyle = dots === 1 ? "#ef4444" : "#111111";
          const dotSize = dots === 1 ? 16 : 12;
          const p: Record<number, [number, number][]> = {
            1: [[64, 64]],
            2: [
              [32, 32],
              [96, 96],
            ],
            3: [
              [32, 32],
              [64, 64],
              [96, 96],
            ],
            4: [
              [32, 32],
              [96, 32],
              [32, 96],
              [96, 96],
            ],
            5: [
              [32, 32],
              [96, 32],
              [64, 64],
              [32, 96],
              [96, 96],
            ],
            6: [
              [32, 32],
              [96, 32],
              [32, 64],
              [96, 64],
              [32, 96],
              [96, 96],
            ],
          };
          p[dots].forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.arc(dx, dy, dotSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.beginPath();
            ctx.arc(
              dx - dotSize / 3,
              dy - dotSize / 3,
              dotSize / 3,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.fillStyle = dots === 1 ? "#ef4444" : "#111111";
          });
          return canvas;
        };

        const mats = [1, 6, 3, 4, 2, 5].map((dots) => {
          const texture = new THREE.CanvasTexture(createFaceCanvas(dots));
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          return new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.1,
            metalness: 0.1,
          });
        });

        const mesh = new THREE.Mesh(geometry, mats);
        mesh.castShadow = true;
        scene.add(mesh);

        const body = new CANNON.Body({
          mass: 1.2,
          shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
          material: diceMaterial,
          position: new CANNON.Vec3(x, 1, 0),
          angularDamping: 0.3,
          linearDamping: 0.1,
        });

        body.addEventListener("collide", (e: any) => {
          if (isFastForwardingRef.current) return;
          const relVel = e.contact.bi.velocity.vsub(e.contact.bj.velocity);
          const strength = relVel.length();
          if (strength > 1.5) playCollisionSound(strength);
        });

        world.addBody(body);
        return { mesh, body };
      };

      diceRefs.current = [createDice(-1.2), createDice(1.2)];

      const animate = () => {
        world.fixedStep();
        diceRefs.current.forEach(({ mesh, body }, i) => {
          mesh.position.copy(body.position as any);
          if (meshOffsetsRef.current[i]) {
            const bodyQuat = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
            mesh.quaternion.copy(bodyQuat.multiply(meshOffsetsRef.current[i]));
          } else {
            mesh.quaternion.copy(body.quaternion as any);
          }
        });
        renderer.render(scene, camera);
        requestRef.current = requestAnimationFrame(animate);
      };
      requestRef.current = requestAnimationFrame(animate);

      const handleResize = () => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);
    };

    // Use a small timeout to ensure container is in DOM
    const timer = setTimeout(initScene, 100);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current) containerRef.current.innerHTML = "";
      }
    };
  }, [playCollisionSound]);

  const getLocalVectorForFace = (n: number) => {
    switch (n) {
      case 1: return new CANNON.Vec3(1, 0, 0);
      case 6: return new CANNON.Vec3(-1, 0, 0);
      case 3: return new CANNON.Vec3(0, 1, 0);
      case 4: return new CANNON.Vec3(0, -1, 0);
      case 2: return new CANNON.Vec3(0, 0, 1);
      case 5: return new CANNON.Vec3(0, 0, -1);
      default: return new CANNON.Vec3(0, 1, 0);
    }
  };

  const getUpsideValue = (body: CANNON.Body) => {
    const ups: Record<string, number> = {
      "1,0,0": 1,
      "-1,0,0": 6,
      "0,1,0": 3,
      "0,-1,0": 4,
      "0,0,1": 2,
      "0,0,-1": 5,
    };
    const invQuat = body.quaternion.inverse();
    const upVector = invQuat.vmult(new CANNON.Vec3(0, 1, 0));
    let closest = "";
    let maxDot = -Infinity;
    Object.keys(ups).forEach((vStr) => {
      const p = vStr.split(",").map(Number);
      const dot = upVector.dot(new CANNON.Vec3(p[0], p[1], p[2]));
      if (dot > maxDot) {
        maxDot = dot;
        closest = vStr;
      }
    });

    const val = ups[closest];
    let localVec = new CANNON.Vec3(0, 1, 0);
    const p = closest.split(",").map(Number);
    if (p.length === 3) {
      localVec.set(p[0], p[1], p[2]);
    }
    return { val, localVec };
  };

  const rollDice = async () => {
    if (isRolling || tickets <= 0) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();

    setIsRolling(true);
    setResult(null);
    setGameMessage(null);
    setErrorMsg(null);
    meshOffsetsRef.current = [new THREE.Quaternion(), new THREE.Quaternion()];

    try {
      const response = await fetch("/api/promo/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "dice" }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка сервера");

      setTickets((prev) => prev - 1);

      // Pre-simulate physics to determine the final resting orientation and sync visuals
      if (data.diceResult) {
        isFastForwardingRef.current = true;

        // Apply starting initial forces from server
        diceRefs.current.forEach(({ body }, i) => {
          const force = data.diceResult?.initialForces?.[i];
          if (force) {
            body.position.set(force.pos.x, force.pos.y, force.pos.z);
            body.velocity.set(force.vel.x, force.vel.y, force.vel.z);
            body.angularVelocity.set(force.angVel.x, force.angVel.y, force.angVel.z);
          }
        });

        // Fast-forward Cannon world to find resting positions
        for (let step = 0; step < 250; step++) {
          worldRef.current?.fixedStep();
        }

        // Calculate visual mesh offsets so visual faces display what the server rolled
        const newOffsets = diceRefs.current.map(({ body }, i) => {
          const targetFace = i === 0 ? data.diceResult?.d1 : data.diceResult?.d2;
          if (!targetFace) return new THREE.Quaternion();

          const { val: physicalUpFace, localVec: v_up_local } = getUpsideValue(body);
          const v_desired_local = getLocalVectorForFace(targetFace);

          const A = new THREE.Vector3(v_desired_local.x, v_desired_local.y, v_desired_local.z);
          const B = new THREE.Vector3(v_up_local.x, v_up_local.y, v_up_local.z);
          return new THREE.Quaternion().setFromUnitVectors(A, B);
        });
        meshOffsetsRef.current = newOffsets;

        // Restore body states back to initial forces to start real-time visual simulation
        diceRefs.current.forEach(({ body }, i) => {
          const force = data.diceResult?.initialForces?.[i];
          if (force) {
            body.position.set(force.pos.x, force.pos.y, force.pos.z);
            body.velocity.set(force.vel.x, force.vel.y, force.vel.z);
            body.angularVelocity.set(force.angVel.x, force.angVel.y, force.angVel.z);
          }
        });

        isFastForwardingRef.current = false;
      } else {
        // Fallback: Use the forces provided by the server for an "honest" physical toss
        diceRefs.current.forEach(({ body }, i) => {
          const force = data.diceResult?.initialForces?.[i];
          if (force) {
            body.position.set(force.pos.x, force.pos.y, force.pos.z);
            body.velocity.set(force.vel.x, force.vel.y, force.vel.z);
            body.angularVelocity.set(
              force.angVel.x,
              force.angVel.y,
              force.angVel.z,
            );
          } else {
            // Fallback if no forces provided
            body.position.set(
              i === 0 ? -1.5 : 1.5,
              10,
              (Math.random() - 0.5) * 3,
            );
            body.velocity.set(
              (Math.random() - 0.5) * 6,
              -20,
              (Math.random() - 0.5) * 6,
            );
            body.angularVelocity.set(
              Math.random() * 40,
              Math.random() * 40,
              Math.random() * 40,
            );
          }
        });
      }

      let checkInterval = setInterval(() => {
        const allStopped = diceRefs.current.every(
          (d) =>
            d.body.velocity.length() < 0.05 &&
            d.body.angularVelocity.length() < 0.05,
        );

        if (allStopped) {
          clearInterval(checkInterval);

          // Get results naturally from physics simulation
          const d1 = getUpsideValue(diceRefs.current[0].body).val;
          const d2 = getUpsideValue(diceRefs.current[1].body).val;
          const sum = d1 + d2;

          setResult({ d1, d2, sum });
          setIsRolling(false);

          const isWin = data.won && data.prize;
          const isEmptyPrize =
            isWin &&
            (data.prize.type === "none" ||
              data.prize.name.toLowerCase() === "пусто" ||
              data.prize.name.toLowerCase() === "попробуй еще" ||
              parseFloat(data.prize.value) === 0);

          if (isWin && !isEmptyPrize) {
            setGameMessage({
              text: "ВЫИГРЫШ!",
              sub: data.prize.name,
              color: "text-orange-500",
            });
            if (data.prize.type === "virtual" || data.prize.type === "bonus_limitless")
              setBonusBalance((prev) => prev + parseFloat(data.prize.value));
            else if (data.prize.type === "attempt")
              setTickets((prev) => prev + parseInt(data.prize.value));
          } else {
            setGameMessage({
              text: "ПУСТО",
              sub: "Повезет в следующий раз",
              color: "text-white/40",
            });
          }

          // Handle Quest Rewards
          if (data.questRewards && data.questRewards.length > 0) {
            data.questRewards.forEach((q: any) => {
              if (q.rewardBonusBalance > 0) {
                setBonusBalance(
                  (prev) => prev + parseFloat(q.rewardBonusBalance),
                );
              }
              if (q.rewardTickets > 0) {
                setTickets((prev) => prev + parseInt(q.rewardTickets));
              }
            });
          }
        }
      }, 400);
    } catch (err: any) {
      setErrorMsg(err.message || "Ошибка при игре");
      setIsRolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-hidden relative font-sans select-none">
      <div className="absolute inset-0 bg-linear-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar - Compact & Intrusive-free */}
      <GameHeader
        ticketsCount={tickets}
        bonusBalance={bonusBalance}
        showPrizes={showPrizes}
        onPrizesClick={() => setShowPrizes(true)}
        accentColor="text-orange-500"
      />

      <PrizesSidebar
        isOpen={showPrizes}
        onClose={() => setShowPrizes(false)}
        prizes={prizes}
        playerLevel={player?.level?.currentLevel}
      />

      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="absolute top-20 z-100 bg-red-900/90 text-red-100 px-6 py-3 rounded-xl font-bold tracking-widest uppercase shadow-[0_0_30px_rgba(239,68,68,0.6)] border-2 border-red-500/80 backdrop-blur-md text-sm text-center"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full flex flex-col items-center justify-center p-4 pt-24 pb-36 min-h-0">
        {" "}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 sm:mb-10"
        >
          <h1 className="text-3xl sm:text-5xl font-black text-orange-500 tracking-tighter uppercase italic leading-none">
            Dice <span className="text-white">Bowl</span>
          </h1>
          <p className="text-gray-500 text-[10px] uppercase tracking-[0.4em] font-bold mt-2">
            Твой шанс на успех
          </p>
        </motion.div>
        {/* Bowl Container with Central Result Overlay */}
        <div className="relative w-full flex flex-col items-center justify-center min-h-0 max-w-lg aspect-square">
          <div
            ref={containerRef}
            className="w-full max-w-[min(90vw,380px)] aspect-square bg-[#0a0a0a] rounded-full border-8 sm:border-12 border-[#151515] shadow-[0_20px_60px_rgba(0,0,0,0.8),inset_0_0_100px_black] relative overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(255,255,255,0.03)] z-20 rounded-full" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-linear-to-b from-white/5 to-transparent blur-3xl rounded-full opacity-30" />
          </div>

          {/* Central Result Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
            <AnimatePresence mode="wait">
              {result && !isRolling ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="bg-black/70 backdrop-blur-xl border border-white/10 p-6 rounded-[2.5rem] shadow-2xl flex flex-col items-center min-w-40"
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    {[result.d1, result.d2].map((val, i) => (
                      <motion.div
                        key={i}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-black font-black text-xl shadow-[0_4px_0_#ddd]"
                      >
                        {val}
                      </motion.div>
                    ))}
                  </div>
                  <div className="text-6xl font-black italic tracking-tighter bg-linear-to-b from-white to-gray-400 bg-clip-text text-transparent py-2 px-4 leading-none">
                    {result.sum}
                  </div>
                  {gameMessage && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`font-black uppercase tracking-widest text-center mt-1 ${gameMessage.color}`}
                    >
                      <div className="text-sm">{gameMessage.text}</div>
                      <div className="text-[8px] opacity-60 font-bold">
                        {gameMessage.sub}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ) : isRolling ? (
                <motion.div
                  key="rolling"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  className="text-white/40 font-black uppercase tracking-[0.3em] text-xs italic"
                >
                  Удача в пути...
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.2 }}
                  className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px] italic"
                >
                  Бросай кубики
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Button */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-6 bg-linear-to-t from-black via-black/80 to-transparent z-50 flex justify-center">
        <div className="w-full max-w-sm">
          <button
            onClick={rollDice}
            disabled={isRolling || tickets <= 0}
            className={`w-full py-5 sm:py-6 rounded-[2rem] font-black text-xl sm:text-2xl uppercase tracking-tighter transition-all active:scale-95 relative overflow-hidden ${isRolling || tickets <= 0 ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50" : "bg-white text-black shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:shadow-none"}`}
          >
            {isRolling ? (
              <span className="flex items-center justify-center gap-4">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-black border-t-transparent rounded-full"
                />
                КАТИМ...
              </span>
            ) : tickets <= 0 ? (
              "НЕТ БИЛЕТОВ"
            ) : (
              <div className="flex flex-col items-center">
                <span>ИГРАТЬ</span>
                <span className="text-[10px] font-bold opacity-40 -mt-1 tracking-widest uppercase">
                  1 Билет за игру
                </span>
              </div>
            )}
            {!isRolling && tickets > 0 && (
              <motion.div
                animate={{ x: ["-100%", "250%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/50 to-transparent -skew-x-20 pointer-events-none"
              />
            )}
          </button>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
