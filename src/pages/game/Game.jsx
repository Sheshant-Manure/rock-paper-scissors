import { useEffect, useMemo, useRef, useState } from "react";
import s from "./game.module.scss";
import rockImg from "../../assets/rock.png";
import paperImg from "../../assets/paper.png";
import scissorsImg from "../../assets/scissors.png";
import lizardImg from "../../assets/lizard.png";
import spockImg from "../../assets/spock.png";

const CONFETTI_COUNT = 320;

const createConfettiConfig = () =>
  Array.from({ length: CONFETTI_COUNT }).map(() => {
    const left = Math.random() * 100;
    const delay = Math.random() * 2.5;
    const duration = 2 + Math.random() * 2.5;
    const scale = 0.7 + Math.random() * 0.9;
    const drift = (Math.random() - 0.5) * 100; // px left/right over the fall
    const rotation = 180 + Math.random() * 540; // degrees (different spin per piece)
    const colors = ["#ffcc00", "#ff4b81", "#4bc0ff", "#8cff4b", "#ffffff"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    return {
      left,
      delay,
      duration,
      scale,
      color,
      drift,
      rotation,
    };
  });

const Game = () => {
  const canvasRef = useRef(null);
  const startAnimationRef = useRef(null);
  const startedRef = useRef(false);
  const winnerFoundRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [winner, setWinner] = useState(null);
  const confettiConfig = useMemo(() => createConfettiConfig(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    const ENTITY_SIZE = 100;

    // Create 10 entities of each type (positions and velocities randomized later)
    const createEntities = () => {
      const baseTypes = [
        { name: "rock", src: rockImg },
        { name: "paper", src: paperImg },
        { name: "scissors", src: scissorsImg },
        { name: "lizard", src: lizardImg },
        { name: "spock", src: spockImg },
      ];

      const result = [];

      baseTypes.forEach((type) => {
        for (let i = 0; i < 10; i += 1) {
          result.push({
            name: type.name,
            src: type.src,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            img: null,
          });
        }
      });

      return result;
    };

    const entities = createEntities();

    // Match canvas internal size to its displayed size for sharp rendering
    const resizeCanvasToDisplaySize = () => {
      const { clientWidth, clientHeight } = canvas;
      if (!clientWidth || !clientHeight) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(clientWidth * dpr);
      const height = Math.round(clientHeight * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resizeCanvasToDisplaySize();

    // Load all entity images, then prepare the animation
    let loadedCount = 0;
    const totalToLoad = entities.length;

    const randomizeEntities = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      entities.forEach((entity) => {
        // Random position within bounds
        entity.x = Math.random() * (width - ENTITY_SIZE);
        entity.y = Math.random() * (height - ENTITY_SIZE);

        // Random direction & speed
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 1.5; // between ~1.5 and 3
        entity.vx = Math.cos(angle) * speed;
        entity.vy = Math.sin(angle) * speed;
      });
    };

    const tryStartAnimation = () => {
      if (loadedCount < totalToLoad) return;

      // Game rules: which entity defeats which
      const beats = {
        rock: ["scissors", "lizard"],
        paper: ["rock", "spock"],
        scissors: ["paper", "lizard"],
        lizard: ["paper", "spock"],
        spock: ["scissors", "rock"],
      };

      const getWinnerName = (a, b) => {
        if (a === b) return null;
        if (beats[a]?.includes(b)) return a;
        if (beats[b]?.includes(a)) return b;
        return null;
      };

      // Ensure canvas size is correct before placing entities
      resizeCanvasToDisplaySize();
      randomizeEntities();

      // Draw initial static frame
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      entities.forEach((entity) => {
        const { x, y, img } = entity;
        if (img) {
          ctx.drawImage(img, x, y, ENTITY_SIZE, ENTITY_SIZE);
        }
      });

      const animate = () => {
        resizeCanvasToDisplaySize();

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        // Update each entity's position and handle bouncing
        entities.forEach((entity) => {
          let { x, y, vx, vy } = entity;

          // Update position
          x += vx;
          y += vy;

          // Bounce on horizontal edges
          if (x <= 0) {
            x = 0;
            vx *= -1;
          } else if (x + ENTITY_SIZE >= width) {
            x = width - ENTITY_SIZE;
            vx *= -1;
          }

          // Bounce on vertical edges
          if (y <= 0) {
            y = 0;
            vy *= -1;
          } else if (y + ENTITY_SIZE >= height) {
            y = height - ENTITY_SIZE;
            vy *= -1;
          }

          // Save updated values back on the entity
          entity.x = x;
          entity.y = y;
          entity.vx = vx;
          entity.vy = vy;
        });

        // Collision detection and resolution
        for (let i = 0; i < entities.length; i += 1) {
          for (let j = i + 1; j < entities.length; j += 1) {
            const a = entities[i];
            const b = entities[j];

            const ax = a.x + ENTITY_SIZE / 2;
            const ay = a.y + ENTITY_SIZE / 2;
            const bx = b.x + ENTITY_SIZE / 2;
            const by = b.y + ENTITY_SIZE / 2;

            const dx = ax - bx;
            const dy = ay - by;
            const distance = Math.hypot(dx, dy);

            const collisionDistance = ENTITY_SIZE * 0.7;

            if (distance < collisionDistance) {
              const winnerName = getWinnerName(a.name, b.name);

              if (winnerName === a.name) {
                // Convert b into a
                b.name = a.name;
                b.src = a.src;
                b.img = a.img;
              } else if (winnerName === b.name) {
                // Convert a into b
                a.name = b.name;
                a.src = b.src;
                a.img = b.img;
              }
            }
          }
        }

        // Clear entire canvas and draw remaining entities
        ctx.clearRect(0, 0, width, height);
        entities.forEach((entity) => {
          const { x, y, img } = entity;
          if (img) {
            ctx.drawImage(img, x, y, ENTITY_SIZE, ENTITY_SIZE);
          }
        });

        // If only one type remains, declare winner and stop animation
        const uniqueNames = new Set(entities.map((e) => e.name));
        if (uniqueNames.size === 1 && !winnerFoundRef.current) {
          winnerFoundRef.current = true;
          const [onlyName] = uniqueNames;
          if (onlyName) {
            setWinner(onlyName);
          }
          return; // stop scheduling new frames
        }

        animationFrameId = requestAnimationFrame(animate);
      };

      // Expose a function to start the animation when the user clicks "Start"
      startAnimationRef.current = () => {
        if (!animationFrameId) {
          animate();
        }
      };
    };

    entities.forEach((entity) => {
      const img = new Image();
      img.src = entity.src;
      entity.img = img;
      img.onload = () => {
        loadedCount += 1;
        tryStartAnimation();
      };
    });

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const handleStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    if (startAnimationRef.current) {
      startAnimationRef.current();
    }
  };

  return (
    <div className={s.wrapper}>
      <canvas className={s.canvas} ref={canvasRef}>
        Your browser does not support the canvas element.
      </canvas>
      <button
        type="button"
        className={s.startButton}
        onClick={handleStart}
        disabled={started}
      >
        {started ? "Running..." : "Start"}
      </button>
      {winner && (
        <div className={s.winnerOverlay}>
          <div className={s.winnerText}>{winner.toUpperCase()} WINS!</div>
          <div className={s.confettiContainer}>
            {confettiConfig.map((piece, index) => (
              <span
                key={index}
                className={s.confettiPiece}
                style={{
                  left: `${piece.left}%`,
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.duration}s`,
                  transform: `scale(${piece.scale})`,
                  backgroundColor: piece.color,
                  "--confetti-drift": `${piece.drift}px`,
                  "--confetti-rotation": `${piece.rotation}deg`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
