"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Coins, Zap, Ticket, Gift, X, ArrowRight, Trophy } from "lucide-react";
import { GameHeader } from "../components/GameHeader";
import { PrizesSidebar } from "../components/PrizesSidebar";

const formatPrizeWin = (prize: any) => {
  if (!prize) return null;
  const val = parseFloat(prize.value) || 0;
  const num = Math.round(val);

  switch (prize.type) {
    case "virtual":
      return {
        amountStr: `+${num} 🪙`,
        title: `${num} Бонусов`,
        badge: "Бонусный баланс",
        desc: "Зачислено на ваш баланс бонусов",
        iconType: "coins",
      };
    case "bonus_limitless":
      return {
        amountStr: `+${num} 🪙`,
        title: `${num} Безлимитных бонусов`,
        badge: "Безлимит",
        desc: "Зачислено на баланс и добавлено к лимиту вывода",
        iconType: "coins",
      };
    case "withdraw_boost":
      return {
        amountStr: `+${num}%`,
        title: `Буст вывода +${num}%`,
        badge: "Буст к пополнению",
        desc: "Добавлено в инвентарь. Активируйте в профиле/инвентаре перед пополнением",
        iconType: "zap",
      };
    case "attempt":
      const count = Math.max(1, Math.floor(val));
      return {
        amountStr: `+${count} 🎟️`,
        title: `${count} ${count === 1 ? "попытка" : count < 5 ? "попытки" : "попыток"}`,
        badge: "Билеты",
        desc: "Добавлено к вашим попыткам для игр",
        iconType: "ticket",
      };
    case "physical":
    default:
      return {
        amountStr: "🎁",
        title: prize.name || "Приз",
        badge: "Приз",
        desc: "Добавлено в инвентарь. Покажите администратору на кассе",
        iconType: "gift",
      };
  }
};

/**
 * КУБИКИ В ТАРЕЛКЕ — ЧИСТАЯ РЕАЛЬНАЯ ФИЗИКА (БЕЗ ПРЕДСКАЗАНИЯ)
 *
 * - Мгновенный бросок по нажатию кнопки без предсимуляции и фризов
 * - Расширенная чаша (радиус поля увеличен в 1.5 раза)
 * - Что реально выпало по физике (верхние грани кубиков) — то и отправляется на сервер для выдачи приза
 */

export default function BowlPhysicsDice() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [tickets, setTickets] = useState(0);
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
  const [wonPrizeData, setWonPrizeData] = useState<{
    prize: any;
    info: any;
    roll: { d1: number; d2: number; sum: number };
  } | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const diceRefs = useRef<{ mesh: THREE.Mesh; body: CANNON.Body }[]>([]);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const requestRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Live roll tracking refs
  const activeRollRef = useRef<{
    active: boolean;
    startTime: number;
    settledFrames: number;
    nudges: number;
    onSettled: ((d1: number, d2: number) => void) | null;
  }>({
    active: false,
    startTime: 0,
    settledFrames: 0,
    nudges: 0,
    onSettled: null,
  });

  const getUpsideValue = useCallback((body: CANNON.Body) => {
    // BoxGeometry material index order: +X=1, -X=6, +Y=3, -Y=4, +Z=2, -Z=5
    const faces: { vec: CANNON.Vec3; val: number }[] = [
      { vec: new CANNON.Vec3(1, 0, 0), val: 1 },
      { vec: new CANNON.Vec3(-1, 0, 0), val: 6 },
      { vec: new CANNON.Vec3(0, 1, 0), val: 3 },
      { vec: new CANNON.Vec3(0, -1, 0), val: 4 },
      { vec: new CANNON.Vec3(0, 0, 1), val: 2 },
      { vec: new CANNON.Vec3(0, 0, -1), val: 5 },
    ];
    const invQuat = body.quaternion.inverse();
    const localUp = invQuat.vmult(new CANNON.Vec3(0, 1, 0));

    let bestVal = 1;
    let maxDot = -Infinity;
    for (const f of faces) {
      const dot = localUp.dot(f.vec);
      if (dot > maxDot) {
        maxDot = dot;
        bestVal = f.val;
      }
    }
    return { val: bestVal, maxDot };
  }, []);

  // === AUDIO SYSTEM ===
  const playCollisionSound = useCallback((strength: number) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const freq = 120 + Math.random() * 80;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.14);

    const volume = Math.min(strength / 22, 0.35);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, []);

  const playWinSound = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      gain.gain.setValueAtTime(0.001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.32);
    });
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
          setTickets(playerData.tickets || 0);
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

      // Higher camera to frame the larger 7.5-radius bowl cleanly
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      camera.position.set(0, 19.2, 2.2);
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
      scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const spotLight = new THREE.SpotLight(0xffffff, 1.6);
      spotLight.position.set(6, 18, 6);
      spotLight.angle = Math.PI / 5;
      spotLight.penumbra = 0.35;
      spotLight.castShadow = true;
      spotLight.shadow.mapSize.width = 1024;
      spotLight.shadow.mapSize.height = 1024;
      scene.add(spotLight);

      const fillLight = new THREE.PointLight(0xff9900, 0.55);
      fillLight.position.set(-6, 6, -3);
      scene.add(fillLight);

      // --- CANNON-ES SETUP ---
      const world = new CANNON.World();
      world.gravity.set(0, -38, 0);
      worldRef.current = world;

      const diceMaterial = new CANNON.Material("dice");
      const bowlMaterial = new CANNON.Material("bowl");
      world.addContactMaterial(
        new CANNON.ContactMaterial(bowlMaterial, diceMaterial, {
          friction: 0.18,
          restitution: 0.45,
        }),
      );
      world.addContactMaterial(
        new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
          friction: 0.2,
          restitution: 0.55,
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
        new THREE.CircleGeometry(8.2, 64),
        new THREE.MeshStandardMaterial({
          color: 0x101010,
          roughness: 0.8,
          metalness: 0.1,
        }),
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Expanded Bowl Walls (radius 7.3 instead of 5.3 -> ~90% more floor area)
      const wallCount = 16;
      const wallRadius = 7.3;
      const wallHeight = 12;
      const wallThickness = 1.2;
      const segmentWidth = (2 * Math.PI * wallRadius) / wallCount;

      for (let i = 0; i < wallCount; i++) {
        const angle = (i / wallCount) * Math.PI * 2;
        const x = Math.cos(angle) * wallRadius;
        const z = Math.sin(angle) * wallRadius;

        const wallBody = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Box(
            new CANNON.Vec3(
              segmentWidth / 1.75,
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

      // Visual Bowl Slope
      const points = [];
      for (let i = 0; i < 10; i++) {
        points.push(new THREE.Vector2(6.4 + i * 0.13, i * 0.28));
      }
      const bowlGeom = new THREE.LatheGeometry(points, 64);
      const bowlMat = new THREE.MeshStandardMaterial({
        color: 0x2c2c2c,
        metalness: 0.8,
        roughness: 0.22,
        side: THREE.DoubleSide,
      });
      const bowlMesh = new THREE.Mesh(bowlGeom, bowlMat);
      bowlMesh.castShadow = true;
      bowlMesh.receiveShadow = true;
      scene.add(bowlMesh);

      // Top Golden Rim
      const torusGeom = new THREE.TorusGeometry(7.55, 0.12, 16, 100);
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0xffa500,
        emissive: 0xffa500,
        emissiveIntensity: 0.22,
        metalness: 0.9,
        roughness: 0.1,
      });
      const torusMesh = new THREE.Mesh(torusGeom, torusMat);
      torusMesh.rotation.x = Math.PI / 2;
      torusMesh.position.y = 2.45;
      scene.add(torusMesh);

      // Dice Factory
      const createDice = (x: number) => {
        const geometry = new THREE.BoxGeometry(1.05, 1.05, 1.05);
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
          shape: new CANNON.Box(new CANNON.Vec3(0.525, 0.525, 0.525)),
          material: diceMaterial,
          position: new CANNON.Vec3(x, 0.55, 0),
          angularDamping: 0.25,
          linearDamping: 0.08,
        });

        body.addEventListener("collide", (e: any) => {
          const relVel = e.contact.bi.velocity.vsub(e.contact.bj.velocity);
          const strength = relVel.length();
          if (strength > 1.5) playCollisionSound(strength);
        });

        world.addBody(body);
        return { mesh, body };
      };

      diceRefs.current = [createDice(-1.6), createDice(1.6)];

      const animate = () => {
        world.fixedStep();

        // Direct 1:1 sync between physics body and 3D mesh (no fake offsets!)
        diceRefs.current.forEach(({ mesh, body }) => {
          mesh.position.copy(body.position as any);
          mesh.quaternion.copy(body.quaternion as any);
        });

        // Monitor active throw until both dice physically settle flat
        const tracker = activeRollRef.current;
        if (tracker.active && diceRefs.current.length === 2) {
          const b0 = diceRefs.current[0].body;
          const b1 = diceRefs.current[1].body;
          const elapsed = performance.now() - tracker.startTime;

          const speed0 =
            b0.velocity.length() + b0.angularVelocity.length() * 0.3;
          const speed1 =
            b1.velocity.length() + b1.angularVelocity.length() * 0.3;

          if (elapsed > 350 && speed0 < 0.06 && speed1 < 0.06) {
            const u0 = getUpsideValue(b0);
            const u1 = getUpsideValue(b1);
            const isCocked =
              u0.maxDot < 0.94 ||
              u1.maxDot < 0.94 ||
              b0.position.y > 0.85 ||
              b1.position.y > 0.85;

            if (isCocked && tracker.nudges < 3) {
              // Give cocked die a small natural nudge toward the center of the bowl so it settles flat
              tracker.nudges += 1;
              tracker.settledFrames = 0;
              [b0, b1].forEach((b, idx) => {
                const u = idx === 0 ? u0 : u1;
                if (u.maxDot < 0.94 || b.position.y > 0.85) {
                  b.wakeUp();
                  b.velocity.set(
                    -b.position.x * 1.2 + (Math.random() - 0.5) * 2,
                    2.5,
                    -b.position.z * 1.2 + (Math.random() - 0.5) * 2,
                  );
                  b.angularVelocity.set(
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                  );
                }
              });
            } else {
              tracker.settledFrames += 1;
              if (tracker.settledFrames >= 10 || elapsed > 4000) {
                tracker.active = false;
                const cb = tracker.onSettled;
                tracker.onSettled = null;
                if (cb) cb(u0.val, u1.val);
              }
            }
          } else if (elapsed > 4500) {
            // Safety fallback if dice spin too long
            const u0 = getUpsideValue(b0);
            const u1 = getUpsideValue(b1);
            tracker.active = false;
            const cb = tracker.onSettled;
            tracker.onSettled = null;
            if (cb) cb(u0.val, u1.val);
          } else {
            tracker.settledFrames = 0;
          }
        }

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

    const timer = setTimeout(initScene, 50);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current) containerRef.current.innerHTML = "";
      }
    };
  }, [playCollisionSound, getUpsideValue]);

  const ticketCost =
    Number(player?.settings?.game_configs?.dice?.tickets_per_play) || 1;

  const rollDice = () => {
    if (isRolling || tickets < ticketCost || diceRefs.current.length !== 2)
      return;

    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) audioCtxRef.current = new AudioContextClass();
    }

    setIsRolling(true);
    setResult(null);
    setGameMessage(null);
    setErrorMsg(null);
    setWonPrizeData(null);

    // 1. Launch dice IMMEDIATELY with real random physics (0ms freeze!)
    diceRefs.current.forEach(({ body }, i) => {
      const angle =
        (i === 0 ? Math.PI : 0) + (Math.random() - 0.5) * 0.9;
      const spawnRadius = 2.6 + Math.random() * 1.4;
      const sx = Math.cos(angle) * spawnRadius;
      const sz = Math.sin(angle) * spawnRadius;

      body.position.set(sx, 7.5 + i * 0.8, sz);
      // Throw inward across the bowl with random spin
      body.velocity.set(
        -sx * (2.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 4,
        -16 - Math.random() * 6,
        -sz * (2.2 + Math.random() * 1.4) + (Math.random() - 0.5) * 4,
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 45,
        (Math.random() - 0.5) * 45,
        (Math.random() - 0.5) * 45,
      );
      body.quaternion.setFromEuler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      body.force.set(0, 0, 0);
      body.torque.set(0, 0, 0);
      body.wakeUp();
    });

    // 2. When the dice physically stop, send the actual rolled faces (d1, d2) to the server
    activeRollRef.current = {
      active: true,
      startTime: performance.now(),
      settledFrames: 0,
      nudges: 0,
      onSettled: async (d1: number, d2: number) => {
        const sum = d1 + d2;
        setResult({ d1, d2, sum });

        try {
          const response = await fetch("/api/promo/play", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameType: "dice",
              diceRoll: { d1, d2 },
            }),
          });

          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || "Ошибка сервера");
          }

          const spent = data.ticketsSpent || ticketCost;
          setTickets((prev) => Math.max(0, prev - spent));

          const isWin = Boolean(data.won && data.prize);
          if (isWin) {
            const prizeInfo = formatPrizeWin(data.prize);
            setGameMessage({
              text: `ВЫИГРЫШ: ${prizeInfo?.amountStr || ""}`,
              sub: data.prize.name,
              color: "text-amber-400",
            });
            setWonPrizeData({
              prize: data.prize,
              info: prizeInfo,
              roll: { d1, d2, sum },
            });
            playWinSound();

            if (
              data.prize.type === "virtual" ||
              data.prize.type === "bonus_limitless"
            ) {
              setBonusBalance(
                (prev) => prev + (parseFloat(data.prize.value) || 0),
              );
            } else if (data.prize.type === "attempt") {
              setTickets(
                (prev) =>
                  prev + (Math.floor(parseFloat(data.prize.value)) || 1),
              );
            }
          } else {
            setGameMessage({
              text: "ПУСТО",
              sub: "Повезет в следующий раз",
              color: "text-white/40",
            });
          }

          if (Array.isArray(data.questRewards)) {
            data.questRewards.forEach((q: any) => {
              if (q.rewardBonusBalance > 0) {
                setBonusBalance(
                  (prev) => prev + (parseFloat(q.rewardBonusBalance) || 0),
                );
              }
              if (q.rewardTickets > 0) {
                setTickets((prev) => prev + (parseInt(q.rewardTickets) || 0));
              }
            });
          }
        } catch (err: any) {
          setErrorMsg(err.message || "Ошибка при игре");
        } finally {
          setIsRolling(false);
        }
      },
    };
  };

  return (
    <div className="h-dvh w-screen bg-[#050505] text-white flex flex-col justify-between items-center overflow-hidden relative font-sans select-none">
      <div className="absolute inset-0 bg-linear-to-b from-orange-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Top Bar */}
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
      />

      {/* WIN CELEBRATION MODAL */}
      <AnimatePresence>
        {wonPrizeData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setWonPrizeData(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-gradient-to-b from-[#1c1917] via-[#121214] to-[#0a0a0a] border-2 border-amber-500/40 rounded-3xl p-6 shadow-[0_0_60px_rgba(245,158,11,0.25)] relative overflow-hidden text-center"
            >
              {/* Radial Glow */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

              <button
                onClick={() => setWonPrizeData(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">
                <Sparkles className="w-3 h-3" />
                <span>Победный бросок!</span>
              </div>

              {/* Combination info */}
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-black font-black text-sm shadow">
                  {wonPrizeData.roll.d1}
                </div>
                <span className="text-gray-400 font-bold">+</span>
                <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-black font-black text-sm shadow">
                  {wonPrizeData.roll.d2}
                </div>
                <span className="text-gray-400 font-bold">=</span>
                <span className="text-amber-400 font-black text-base">
                  {wonPrizeData.roll.sum}
                </span>
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4 truncate px-2">
                {wonPrizeData.prize.name}
              </p>

              {/* Big Reward Display */}
              <div className="my-4 py-5 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 relative overflow-hidden">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(245,158,11,0.3)]">
                  {wonPrizeData.info?.iconType === "zap" ? (
                    <Zap className="w-7 h-7 text-amber-400 fill-amber-400" />
                  ) : wonPrizeData.info?.iconType === "ticket" ? (
                    <Ticket className="w-7 h-7 text-orange-400" />
                  ) : wonPrizeData.info?.iconType === "coins" ? (
                    <Coins className="w-7 h-7 text-amber-300" />
                  ) : (
                    <Gift className="w-7 h-7 text-purple-400" />
                  )}
                </div>

                <div className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow">
                  {wonPrizeData.info?.amountStr}
                </div>
                <div className="text-xs font-black uppercase text-amber-400 tracking-wider mt-1">
                  {wonPrizeData.info?.title}
                </div>
                <div className="text-[11px] text-gray-300 mt-2 leading-tight">
                  {wonPrizeData.info?.desc}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setWonPrizeData(null)}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Отлично
                </button>

                {(wonPrizeData.prize.type === "withdraw_boost" || wonPrizeData.prize.type === "physical") && (
                  <Link
                    href="/promo/inventory"
                    onClick={() => setWonPrizeData(null)}
                    className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>В инвентарь</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Main Arena — Result HUD Above Bowl, Larger Bowl Below, Fixed No-Scroll */}
      <main className="flex-1 w-full flex flex-col items-center justify-center px-3 pt-16 pb-24 min-h-0 gap-3 sm:gap-4">
        {/* Top Result / Status HUD Bar (Above the playing field) */}
        <div className="w-full max-w-[min(92vw,420px)] h-14 sm:h-16 flex items-center justify-center shrink-0 z-30">
          <AnimatePresence mode="wait">
            {result && !isRolling ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full bg-zinc-900/90 backdrop-blur-xl border border-white/15 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2 shrink-0">
                  {[result.d1, result.d2].map((val, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 sm:w-9 sm:h-9 bg-white rounded-xl flex items-center justify-center text-black font-black text-base sm:text-lg shadow-[0_3px_0_#ccc]"
                    >
                      {val}
                    </div>
                  ))}
                  <div className="h-6 w-px bg-white/15 mx-1" />
                  <div className="text-base sm:text-xl font-black italic tracking-tight text-white whitespace-nowrap">
                    Сумма: <span className="text-orange-400">{result.sum}</span>
                  </div>
                </div>

                {gameMessage && (
                  <div className="text-right min-w-0 max-w-[55%]">
                    <div
                      className={`font-black uppercase tracking-wider text-xs sm:text-sm leading-tight truncate ${gameMessage.color}`}
                    >
                      {gameMessage.text}
                    </div>
                    {gameMessage.sub && (
                      <div className="text-[9px] sm:text-[10px] text-white/70 font-bold uppercase tracking-wider truncate">
                        {gameMessage.sub}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : isRolling ? (
              <motion.div
                key="rolling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-900/70 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/10 text-orange-400 font-black uppercase tracking-[0.25em] text-xs italic"
              >
                Кубики в движении...
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-zinc-900/50 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/5 text-white/40 font-black uppercase tracking-[0.2em] text-[11px] italic"
              >
                Бросай кубики и собирай комбинации
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3D Bowl Playing Field */}
        <div className="relative flex items-center justify-center w-[min(90vw,460px)] sm:w-[min(60vh,520px)] aspect-square shrink-0">
          <div
            ref={containerRef}
            className="w-full h-full bg-[#0a0a0a] rounded-full border-6 sm:border-10 border-[#151515] shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_0_100px_black] relative overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(255,255,255,0.03)] z-20 rounded-full" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-linear-to-b from-white/5 to-transparent blur-3xl rounded-full opacity-30" />
          </div>
        </div>
      </main>

      {/* Bottom Action Button */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-4 sm:p-5 bg-linear-to-t from-black via-black/80 to-transparent z-50 flex justify-center">
        <div className="w-full max-w-sm">
          <button
            onClick={rollDice}
            disabled={isRolling || tickets < ticketCost}
            className={`w-full py-4 sm:py-5 rounded-[1.8rem] font-black text-lg sm:text-xl uppercase tracking-tighter transition-all active:scale-95 relative overflow-hidden cursor-pointer ${
              isRolling || tickets < ticketCost
                ? "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                : "bg-white text-black shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:shadow-none"
            }`}
          >
            {isRolling ? (
              <span className="flex items-center justify-center gap-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-4 border-black border-t-transparent rounded-full"
                />
                КАТИМ...
              </span>
            ) : tickets < ticketCost ? (
              "НЕТ БИЛЕТОВ"
            ) : (
              <div className="flex flex-col items-center">
                <span>БРОСИТЬ КУБИКИ</span>
                <span className="text-[10px] font-bold opacity-40 -mt-0.5 tracking-widest uppercase">
                  {ticketCost}{" "}
                  {ticketCost === 1
                    ? "Билет"
                    : ticketCost < 5
                      ? "Билета"
                      : "Билетов"}{" "}
                  за игру
                </span>
              </div>
            )}
            {!isRolling && tickets >= ticketCost && (
              <motion.div
                animate={{ x: ["-100%", "250%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/50 to-transparent -skew-x-20 pointer-events-none"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
