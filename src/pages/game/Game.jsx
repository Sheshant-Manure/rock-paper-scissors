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
  const animationFrameIdRef = useRef(null);
  const randomizeEntitiesRef = useRef(null);
  const resetEntitiesRef = useRef(null);
  const drawFrameRef = useRef(null);
  const startedRef = useRef(false);
  const winnerFoundRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [winner, setWinner] = useState(null);
  const [resetToken, setResetToken] = useState(0);
  // counts per entity type controlled by the sliders
  const [counts, setCounts] = useState({
    rock: 1,
    paper: 1,
    scissors: 1,
    lizard: 1,
    spock: 1,
  });
  const confettiConfig = useMemo(() => createConfettiConfig(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    const ENTITY_SIZE = 50;

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
        // use slider-controlled counts (default to 1)
        const typeCount = Math.max(1, Math.min(100, counts[type.name] || 1));
        for (let i = 0; i < typeCount; i += 1) {
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

    // Store original entity types for reset
    const originalEntityTypes = entities.map((entity) => ({
      name: entity.name,
      src: entity.src,
    }));

    // Create a map of entity type names to their images for reset
    const entityTypeImageMap = new Map();

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

    // Drag-and-drop state (for pre-start manual positioning)
    let isDragging = false;
    let dragIndex = -1;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const drawFrame = () => {
      resizeCanvasToDisplaySize();
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      entities.forEach((entity) => {
        const { x, y, img } = entity;
        if (img) {
          ctx.drawImage(img, x, y, ENTITY_SIZE, ENTITY_SIZE);
        }
      });
    };

    drawFrameRef.current = drawFrame;

    const getPointerPosition = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clientX =
        "touches" in event ? event.touches[0].clientX : event.clientX;
      const clientY =
        "touches" in event ? event.touches[0].clientY : event.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    const handlePointerDown = (event) => {
      if (startedRef.current || winnerFoundRef.current) return;

      const { x, y } = getPointerPosition(event);

      // Find the top-most entity under the pointer (iterate from end)
      for (let i = entities.length - 1; i >= 0; i -= 1) {
        const entity = entities[i];
        if (
          x >= entity.x &&
          x <= entity.x + ENTITY_SIZE &&
          y >= entity.y &&
          y <= entity.y + ENTITY_SIZE
        ) {
          isDragging = true;
          dragIndex = i;
          dragOffsetX = x - entity.x;
          dragOffsetY = y - entity.y;
          canvas.style.cursor = "grabbing";
          event.preventDefault();
          break;
        }
      }
    };

    const handlePointerMove = (event) => {
      if (isDragging) {
        const entity = entities[dragIndex];
        if (!entity) return;

        const { x, y } = getPointerPosition(event);
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        let nextX = x - dragOffsetX;
        let nextY = y - dragOffsetY;

        // Clamp inside canvas bounds
        nextX = Math.max(0, Math.min(nextX, width - ENTITY_SIZE));
        nextY = Math.max(0, Math.min(nextY, height - ENTITY_SIZE));

        entity.x = nextX;
        entity.y = nextY;

        drawFrame();
        event.preventDefault();
        // Keep cursor as "grabbing" during drag
        canvas.style.cursor = "grabbing";
        return;
      }

      // If not dragging and simulation hasn't started, update hover cursor
      if (startedRef.current || winnerFoundRef.current) {
        canvas.style.cursor = "default";
        return;
      }

      const { x, y } = getPointerPosition(event);
      let hovering = false;

      for (let i = entities.length - 1; i >= 0; i -= 1) {
        const entity = entities[i];
        if (
          x >= entity.x &&
          x <= entity.x + ENTITY_SIZE &&
          y >= entity.y &&
          y <= entity.y + ENTITY_SIZE
        ) {
          hovering = true;
          break;
        }
      }

      canvas.style.cursor = hovering ? "grab" : "default";
    };

    const stopDragging = (event) => {
      isDragging = false;
      dragIndex = -1;

      if (!startedRef.current && !winnerFoundRef.current) {
        // After release, check if we're still hovering over an item
        if (event) {
          const { x, y } = getPointerPosition(event);
          let hovering = false;

          for (let i = entities.length - 1; i >= 0; i -= 1) {
            const entity = entities[i];
            if (
              x >= entity.x &&
              x <= entity.x + ENTITY_SIZE &&
              y >= entity.y &&
              y <= entity.y + ENTITY_SIZE
            ) {
              hovering = true;
              break;
            }
          }

          canvas.style.cursor = hovering ? "grab" : "default";
        } else {
          // If no event (e.g., mouseleave), default to "grab" if game hasn't started
          canvas.style.cursor = "grab";
        }
      } else {
        canvas.style.cursor = "default";
      }
    };

    const handlePointerUp = (event) => {
      if (!isDragging) return;
      stopDragging(event);
    };

    const handlePointerLeave = () => {
      if (!isDragging) {
        // Even if not dragging, reset cursor when leaving canvas
        if (!startedRef.current && !winnerFoundRef.current) {
          canvas.style.cursor = "default";
        }
        return;
      }
      // On pointer leave during drag, just stop dragging without checking hover
      isDragging = false;
      dragIndex = -1;
      canvas.style.cursor = "default";
    };

    canvas.addEventListener("mousedown", handlePointerDown);
    canvas.addEventListener("mousemove", handlePointerMove);
    canvas.addEventListener("mouseup", handlePointerUp);
    canvas.addEventListener("mouseleave", handlePointerLeave);
    canvas.addEventListener("touchstart", handlePointerDown, {
      passive: false,
    });
    canvas.addEventListener("touchmove", handlePointerMove, { passive: false });
    canvas.addEventListener("touchend", handlePointerUp);
    canvas.addEventListener("touchcancel", handlePointerLeave);

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

    const resetEntities = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      // Reset entities to original types and randomize positions
      entities.forEach((entity, index) => {
        const original = originalEntityTypes[index];
        if (original) {
          entity.name = original.name;
          entity.src = original.src;
          // Reuse the image from the map
          const img = entityTypeImageMap.get(original.name);
          if (img) {
            entity.img = img;
          }
        }

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

    randomizeEntitiesRef.current = randomizeEntities;
    resetEntitiesRef.current = resetEntities;

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
      drawFrame();

      // Set initial cursor to "grab" if game hasn't started
      if (!startedRef.current && !winnerFoundRef.current) {
        canvas.style.cursor = "grab";
      }

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
          animationFrameIdRef.current = null;
          return; // stop scheduling new frames
        }

        animationFrameId = requestAnimationFrame(animate);
        animationFrameIdRef.current = animationFrameId;
      };

      // Expose a function to start the animation when the user clicks "Start"
      startAnimationRef.current = () => {
        if (!animationFrameIdRef.current) {
          animationFrameId = requestAnimationFrame(animate);
          animationFrameIdRef.current = animationFrameId;
        }
      };
    };

    entities.forEach((entity) => {
      const img = new Image();
      img.src = entity.src;
      entity.img = img;
      // Store image in map for reset functionality
      if (!entityTypeImageMap.has(entity.name)) {
        entityTypeImageMap.set(entity.name, img);
      }
      img.onload = () => {
        loadedCount += 1;
        tryStartAnimation();
      };
    });

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      canvas.removeEventListener("mousedown", handlePointerDown);
      canvas.removeEventListener("mousemove", handlePointerMove);
      canvas.removeEventListener("mouseup", handlePointerUp);
      canvas.removeEventListener("mouseleave", handlePointerLeave);
      canvas.removeEventListener("touchstart", handlePointerDown);
      canvas.removeEventListener("touchmove", handlePointerMove);
      canvas.removeEventListener("touchend", handlePointerUp);
      canvas.removeEventListener("touchcancel", handlePointerLeave);
    };
  }, [resetToken, counts]);

  // Handler for slider changes; prevent changing while simulation is running
  const handleCountChange = (type) => (e) => {
    const value = Number(e.target.value || 1);
    // clamp
    const clamped = Math.max(1, Math.min(100, Math.floor(value)));
    setCounts((prev) => ({ ...prev, [type]: clamped }));
  };

  // Handler for the "All" slider which sets every type to the same value
  const handleAllChange = (e) => {
    const value = Number(e.target.value || 1);
    const clamped = Math.max(1, Math.min(100, Math.floor(value)));
    setCounts((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => {
        next[k] = clamped;
      });
      return next;
    });
  };

  const handleStart = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    // Change cursor to default when game starts
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "default";
    }
    if (startAnimationRef.current) {
      startAnimationRef.current();
    }
  };

  const handlePause = () => {
    // Stop the animation
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // Reset state
    startedRef.current = false;
    setStarted(false);

    // Change cursor back to grab
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = "grab";
    }
  };

  const handleStop = () => {
    // Stop the animation
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // Reset entities to original types with new random positions and redraw
    if (resetEntitiesRef.current && drawFrameRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        resetEntitiesRef.current();
        drawFrameRef.current();
        canvas.style.cursor = "grab";
      }
    }

    // Reset state
    startedRef.current = false;
    winnerFoundRef.current = false;
    setStarted(false);
    setWinner(null);
  };

  const handleReset = () => {
    // Stop the animation if running
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      // Reset cursor to "grab" after reset (game hasn't started yet)
      canvas.style.cursor = "grab";
    }

    // Reset state and refs
    startedRef.current = false;
    winnerFoundRef.current = false;
    setStarted(false);
    setWinner(null);
    setResetToken((prev) => prev + 1);
  };

  return (
    <div className={s.wrapper}>
      <div className={s.controls}>
        <div className={s.controlItem} key="all">
          <div className={s.controlLabel}>All</div>
          <input
            className={s.range}
            type="range"
            min={1}
            max={100}
            value={Math.max(
              1,
              Math.min(
                100,
                Math.round(
                  Object.values(counts).reduce((a, b) => a + b, 0) /
                    Object.keys(counts).length
                )
              )
            )}
            onChange={handleAllChange}
            disabled={started}
          />
          <div className={s.countDisplay}>
            {Math.round(
              Object.values(counts).reduce((a, b) => a + b, 0) /
                Object.keys(counts).length
            )}
          </div>
        </div>
        {[
          { key: "rock", label: "Rock" },
          { key: "paper", label: "Paper" },
          { key: "scissors", label: "Scissors" },
          { key: "lizard", label: "Lizard" },
          { key: "spock", label: "Spock" },
        ].map((item) => (
          <div className={s.controlItem} key={item.key}>
            <div className={s.controlLabel}>{item.label}</div>
            <input
              className={s.range}
              type="range"
              min={1}
              max={100}
              value={counts[item.key]}
              onChange={handleCountChange(item.key)}
              disabled={started}
            />
            <div className={s.countDisplay}>{counts[item.key]}</div>
          </div>
        ))}
      </div>
      <canvas className={s.canvas} ref={canvasRef}>
        Your browser does not support the canvas element.
      </canvas>
      {winner ? (
        <button type="button" className={s.startButton} onClick={handleReset}>
          Play Again
        </button>
      ) : started ? (
        <div className={s.buttonGroup}>
          <button type="button" className={s.pauseButton} onClick={handlePause}>
            Pause
          </button>
          <button type="button" className={s.stopButton} onClick={handleStop}>
            Stop
          </button>
        </div>
      ) : (
        <button type="button" className={s.startButton} onClick={handleStart}>
          Start
        </button>
      )}
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
