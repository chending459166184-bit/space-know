import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CanvasTexture, DoubleSide, MathUtils } from 'three';
import { CUBE_NETS, PARENT_GROUP_TEXT, SIMPLE_GROUP_NAMES } from '../data/cubeNets.js';
import { FACE_STYLES, prepareNet, relationText } from '../lib/cubeMath.js';

const FACE_SIZE = 1.35;

function makeFaceTexture(label, style) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = style.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 每组对面使用相同图案，帮助小朋友把一对面联系起来。
  ctx.fillStyle = style.accent;
  if (style.pattern === 'star') {
    for (const [x, y, r] of [[92, 92, 30], [406, 120, 25], [120, 398, 22], [408, 380, 32]]) {
      drawStar(ctx, x, y, r);
    }
  }
  if (style.pattern === 'cloud') {
    drawCloud(ctx, 118, 116, 1);
    drawCloud(ctx, 362, 376, 1.15);
  }
  if (style.pattern === 'tree') {
    drawTree(ctx, 120, 126, 1);
    drawTree(ctx, 386, 372, 1.1);
  }

  ctx.lineWidth = 18;
  ctx.strokeStyle = '#243047';
  ctx.strokeRect(9, 9, 494, 494);

  ctx.font = 'bold 92px "Microsoft YaHei", "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.strokeText(label, 256, 256);
  ctx.fillStyle = '#172033';
  ctx.fillText(label, 256, 256);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function drawStar(ctx, x, y, radius) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCloud(ctx, x, y, scale) {
  ctx.beginPath();
  ctx.arc(x - 34 * scale, y + 12 * scale, 34 * scale, 0, Math.PI * 2);
  ctx.arc(x, y - 12 * scale, 44 * scale, 0, Math.PI * 2);
  ctx.arc(x + 44 * scale, y + 12 * scale, 36 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(ctx, x, y, scale) {
  ctx.fillStyle = '#7a4d2f';
  ctx.fillRect(x - 11 * scale, y + 18 * scale, 22 * scale, 48 * scale);
  ctx.fillStyle = '#1f9d55';
  ctx.beginPath();
  ctx.moveTo(x, y - 66 * scale);
  ctx.lineTo(x - 58 * scale, y + 36 * scale);
  ctx.lineTo(x + 58 * scale, y + 36 * scale);
  ctx.closePath();
  ctx.fill();
}

function rotationForDirection(dir, progress) {
  const angle = MathUtils.degToRad(90 * progress);
  if (dir.key === 'right') return [0, angle, 0];
  if (dir.key === 'left') return [0, -angle, 0];
  if (dir.key === 'up') return [-angle, 0, 0];
  return [angle, 0, 0];
}

function edgeForDirection(dir) {
  return [dir.dx * FACE_SIZE * 0.5, dir.dy * FACE_SIZE * 0.5, 0];
}

function FacePlane({ face, highlightState, onFaceClick }) {
  const style = FACE_STYLES[face.label];
  const texture = useMemo(() => makeFaceTexture(face.label, style), [face.label, style]);
  const pointerRef = useRef({ x: 0, y: 0, moved: false, downAt: 0 });

  useEffect(() => () => texture.dispose(), [texture]);

  const isDim = highlightState === 'dim';
  const isHot = highlightState === 'hot';

  return (
    <mesh
      onPointerDown={(event) => {
        event.stopPropagation();
        pointerRef.current = {
          x: event.nativeEvent.clientX,
          y: event.nativeEvent.clientY,
          moved: false,
          downAt: performance.now(),
        };
      }}
      onPointerMove={(event) => {
        const dx = Math.abs(event.nativeEvent.clientX - pointerRef.current.x);
        const dy = Math.abs(event.nativeEvent.clientY - pointerRef.current.y);
        if (dx + dy > 6) pointerRef.current.moved = true;
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        const heldMs = performance.now() - pointerRef.current.downAt;
        if (!pointerRef.current.moved && heldMs < 260) {
          onFaceClick(face.id);
        }
      }}
    >
      <planeGeometry args={[FACE_SIZE, FACE_SIZE]} />
      <meshStandardMaterial
        map={texture}
        side={DoubleSide}
        transparent
        opacity={isDim ? 0.33 : 1}
        color={isDim ? '#d7dbe4' : '#ffffff'}
        emissive={isHot ? '#fff2a8' : '#000000'}
        emissiveIntensity={isHot ? 0.45 : 0}
        roughness={0.72}
      />
    </mesh>
  );
}

function FaceNode({ faceId, netInfo, progress, manualFoldProgressById, highlightForFace, onFaceClick }) {
  const face = netInfo.nodeById.get(faceId);

  return (
    <group>
      <FacePlane face={face} highlightState={highlightForFace(face.id)} onFaceClick={onFaceClick} />
      {face.children.map((childId) => {
        const child = netInfo.nodeById.get(childId);
        const hingePosition = edgeForDirection(child.dirFromParent);
        const childOffset = edgeForDirection(child.dirFromParent);
        const childProgress = progress > 0.02 ? progress : manualFoldProgressById[childId] ?? 0;
        return (
          <group key={childId} position={hingePosition} rotation={rotationForDirection(child.dirFromParent, childProgress)}>
            <group position={childOffset}>
              <FaceNode
                faceId={childId}
                netInfo={netInfo}
                progress={progress}
                manualFoldProgressById={manualFoldProgressById}
                highlightForFace={highlightForFace}
                onFaceClick={onFaceClick}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
}

function FoldingCube({
  netInfo,
  progress,
  manualFoldProgressById,
  autoRotate,
  selectedFaceId,
  guessFaceId,
  onFaceClick,
}) {
  const root = useRef();

  useFrame((_, delta) => {
    if (!root.current) return;
    const targetY = progress > 0.95 ? -0.35 : 0;
    root.current.rotation.y = MathUtils.lerp(root.current.rotation.y, targetY, delta * 3);
  });

  const highlightForFace = (faceId) => {
    if (guessFaceId) return faceId === guessFaceId ? 'hot' : 'dim';
    if (!selectedFaceId) return 'normal';
    const oppositeId = netInfo.oppositeById[selectedFaceId];
    if (faceId === selectedFaceId || faceId === oppositeId) return 'hot';
    return 'dim';
  };

  const p = progress;
  const flatX = -netInfo.flatCenter[0] * FACE_SIZE;
  const flatY = -netInfo.flatCenter[1] * FACE_SIZE;
  const groupPosition = [MathUtils.lerp(flatX, 0, p), MathUtils.lerp(flatY, 0, p), MathUtils.lerp(0, 0.55, p)];

  return (
    <>
      <ambientLight intensity={0.88} />
      <directionalLight position={[4, 6, 8]} intensity={1.25} />
      <group ref={root} position={groupPosition}>
        <FaceNode
          faceId={netInfo.rootKey}
          netInfo={netInfo}
          progress={p}
          manualFoldProgressById={manualFoldProgressById}
          highlightForFace={highlightForFace}
          onFaceClick={onFaceClick}
        />
      </group>
      <OrbitControls enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.3} minDistance={4} maxDistance={9} />
    </>
  );
}

function NetThumb({ net }) {
  const xs = net.cells.map(([x]) => x);
  const ys = net.cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX + 1;
  const height = Math.max(...ys) - minY + 1;

  return (
    <span className="thumb" style={{ gridTemplateColumns: `repeat(${width}, 12px)`, gridTemplateRows: `repeat(${height}, 12px)` }}>
      {net.cells.map(([x, y]) => (
        <span
          key={`${x},${y}`}
          className="thumb-cell"
          style={{ gridColumn: x - minX + 1, gridRow: Math.max(...ys) - y + 1 }}
        />
      ))}
    </span>
  );
}

function CubePage() {
  const [netId, setNetId] = useState(CUBE_NETS[0].id);
  const [progress, setProgress] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedFaceId, setSelectedFaceId] = useState(null);
  const [guessFaceId, setGuessFaceId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [celebrateKey, setCelebrateKey] = useState(0);
  const animationRef = useRef(null);
  const faceAnimationRefs = useRef({});
  const [manualFoldProgressById, setManualFoldProgressById] = useState({});

  const activeNet = useMemo(() => CUBE_NETS.find((net) => net.id === netId), [netId]);
  const netInfo = useMemo(() => prepareNet(activeNet), [activeNet]);
  const selectedFace = selectedFaceId ? netInfo.nodeById.get(selectedFaceId) : null;
  const selectedOpposite = selectedFaceId ? netInfo.nodeById.get(netInfo.oppositeById[selectedFaceId]) : null;

  const clearManualFold = () => {
    for (const rafId of Object.values(faceAnimationRefs.current)) {
      cancelAnimationFrame(rafId);
    }
    faceAnimationRefs.current = {};
    setManualFoldProgressById({});
  };

  const animateTo = (target, done) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (target > 0.02) clearManualFold();
    const start = progress;
    const startTime = performance.now();
    const duration = 2400;

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(start + (target - start) * eased);
      if (t < 1) animationRef.current = requestAnimationFrame(tick);
      else {
        animationRef.current = null;
        done?.();
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  };

  const animateManualFold = (faceId, target, done) => {
    const running = faceAnimationRefs.current[faceId];
    if (running) cancelAnimationFrame(running);
    const start = manualFoldProgressById[faceId] ?? 0;
    const startTime = performance.now();
    const duration = 520;

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (target - start) * eased;
      setManualFoldProgressById((prev) => ({ ...prev, [faceId]: next }));
      if (t < 1) faceAnimationRefs.current[faceId] = requestAnimationFrame(tick);
      else {
        delete faceAnimationRefs.current[faceId];
        setManualFoldProgressById((prev) => {
          if (target >= 0.02) return { ...prev, [faceId]: 1 };
          const nextMap = { ...prev };
          delete nextMap[faceId];
          return nextMap;
        });
        done?.();
      }
    };

    faceAnimationRefs.current[faceId] = requestAnimationFrame(tick);
  };

  useEffect(
    () => () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      for (const rafId of Object.values(faceAnimationRefs.current)) {
        cancelAnimationFrame(rafId);
      }
    },
    [],
  );

  const chooseNet = (nextId) => {
    if (nextId === netId) return;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    clearManualFold();
    setGuessFaceId(null);
    setSelectedFaceId(null);
    setAnswerText('');
    setProgress(0);
    setNetId(nextId);
  };

  const handleFaceClick = (faceId) => {
    if (guessFaceId && faceId !== guessFaceId) {
      checkAnswer(netInfo.nodeById.get(faceId).label);
      return;
    }
    if (!guessFaceId && progress < 0.08) {
      if (faceId === netInfo.rootKey) {
        setSelectedFaceId(faceId);
        setAnswerText('这个面在中间，没有铰链，不能单独折起。');
        return;
      }
      setGuessFaceId(null);
      setSelectedFaceId(faceId);
      if ((manualFoldProgressById[faceId] ?? 0) > 0.9) {
        animateManualFold(faceId, 0, () => setAnswerText('这个面已经放下啦。'));
      } else {
        animateManualFold(faceId, 1, () => {
          const face = netInfo.nodeById.get(faceId);
          setAnswerText(`${face.label}已经折起来啦，再点一次可放下。`);
        });
      }
      return;
    }
    clearManualFold();
    setGuessFaceId(null);
    setAnswerText('');
    setSelectedFaceId(faceId);
  };

  const startGuess = () => {
    clearManualFold();
    const randomFace = netInfo.faces[Math.floor(Math.random() * netInfo.faces.length)];
    setSelectedFaceId(null);
    setGuessFaceId(randomFace.id);
    setAnswerText(`它的对面是谁？`);
    animateTo(1);
  };

  const checkAnswer = (label) => {
    if (!guessFaceId) return;
    const opposite = netInfo.nodeById.get(netInfo.oppositeById[guessFaceId]);
    if (label === opposite.label) {
      setAnswerText(`答对啦！${netInfo.nodeById.get(guessFaceId).label}的对面是${opposite.label}。`);
      setSelectedFaceId(guessFaceId);
      setGuessFaceId(null);
      setCelebrateKey((key) => key + 1);
    } else {
      setAnswerText('这个是邻居，不是对面哦。');
    }
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>小纸片变正方体</h1>
          <p>拖一拖小盒子，看看 6 个面怎么变身。</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />
          <span>自动旋转</span>
        </label>
      </header>

      <section className="workspace">
        <aside className="net-list" aria-label="选择展开图">
          {Object.entries(SIMPLE_GROUP_NAMES).map(([group, title]) => (
            <div className="net-group" key={group}>
              <h2>{title}</h2>
              <div className="net-buttons">
                {CUBE_NETS.filter((net) => net.group === group).map((net) => (
                  <button
                    key={net.id}
                    className={net.id === netId ? 'net-button active' : 'net-button'}
                    onClick={() => chooseNet(net.id)}
                  >
                    <NetThumb net={net} />
                    <span>{net.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <section className="stage-panel">
          <div className="stage">
            <Canvas camera={{ position: [4.2, 4.1, 6.2], fov: 43 }}>
              <color attach="background" args={['#f8fbff']} />
              <FoldingCube
                netInfo={netInfo}
                progress={progress}
                manualFoldProgressById={manualFoldProgressById}
                autoRotate={autoRotate}
                selectedFaceId={selectedFaceId}
                guessFaceId={guessFaceId}
                onFaceClick={handleFaceClick}
              />
            </Canvas>
            {celebrateKey > 0 && (
              <div className="celebrate" key={celebrateKey} aria-hidden="true">
                {Array.from({ length: 18 }).map((_, index) => (
                  <i key={index} style={{ '--i': index }} />
                ))}
              </div>
            )}
          </div>

          <div className="controls">
            <button className="primary" onClick={() => animateTo(1)}>
              折起来
            </button>
            <button
              className="secondary"
              onClick={() => {
                clearManualFold();
                animateTo(0);
              }}
            >
              展开看看
            </button>
            <button className="guess" onClick={startGuess}>
              猜一猜
            </button>
          </div>

          <label className="slider-row">
            <span>展开</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(progress * 100)}
              onChange={(event) => {
                if (animationRef.current) cancelAnimationFrame(animationRef.current);
                clearManualFold();
                setProgress(Number(event.target.value) / 100);
              }}
            />
            <span>正方体</span>
          </label>
        </section>

        <aside className="relation-panel">
          <h2>谁和谁是对面？</h2>
          <div className="pair-list">
            {netInfo.pairs.map(([a, b]) => (
              <button key={`${a.id}-${b.id}`} onClick={() => setSelectedFaceId(a.id)}>
                {a.label} ↔ {b.label}
              </button>
            ))}
          </div>

          <div className="hint-box">
            {guessFaceId ? (
              <>
                <strong>{netInfo.nodeById.get(guessFaceId).label}</strong>
                <p>{answerText}</p>
              </>
            ) : selectedFace && selectedOpposite ? (
              <p>{relationText(selectedFace.label, selectedOpposite.label)}</p>
            ) : progress > 0.85 ? (
              <p>点一点小盒子的一个面，找找它的对面。</p>
            ) : (
              <p>先把小纸片折起来，再看对面关系。</p>
            )}
          </div>

        </aside>
      </section>

      <section className="lesson">
        <p>正方体有 6 个面。</p>
        <p>展开后，它可以变成 6 个连在一起的小正方形。</p>
        <p>这些小正方形可以有不同的排队方式。</p>
        <p>只要折得对，它们都能变成同一个小盒子。</p>
        <p>每个面都有一个对面，对面不会和它贴边。</p>
        <details>
          <summary>给家长看的分类名称</summary>
          <p>{Object.values(PARENT_GROUP_TEXT).join('；')}。</p>
        </details>
      </section>
    </main>
  );
}

export default CubePage;
