import React, { useRef, useEffect, useState } from 'react';

const GeometricPainter = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#6bb5c7');
  const [brushSize, setBrushSize] = useState(40);
  const [brushMode, setBrushMode] = useState('segments');
  const [opacity, setOpacity] = useState(0.7);
  const [lineWeight, setLineWeight] = useState(1);
  const [shapeMode, setShapeMode] = useState(null);
  const [showUI, setShowUI] = useState(true);
  const [isHolding, setIsHolding] = useState(false);
  const [bleedEnabled, setBleedEnabled] = useState(false);
  const [blendMode, setBlendMode] = useState(false);
  const [fillMode, setFillMode] = useState(false);
  const [fillPattern, setFillPattern] = useState('solid');
  const [symmetryMode, setSymmetryMode] = useState('none');
  const [mirrorAngle, setMirrorAngle] = useState(90); // 90 = vertical mirror
  const [canUndo, setCanUndo] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [panelPosition, setPanelPosition] = useState({ x: 30, y: 30 });
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const undoHistoryRef = useRef([]);
  const maxUndoSteps = 20;
  
  // Color palette extracted from the images
  const colorPalette = [
    { name: 'Cyan Glow', color: '#6bb5c7' },
    { name: 'Deep Teal', color: '#1a3a3a' },
    { name: 'Azure', color: '#4a8a9e' },
    { name: 'Golden', color: '#e6a660' },
    { name: 'Coral', color: '#e87a6a' },
    { name: 'Amber', color: '#d4854d' },
    { name: 'Cream', color: '#f4e8d4' },
    { name: 'Turquoise', color: '#7acab5' },
    { name: 'Violet', color: '#8a5a8a' },
    { name: 'Rose', color: '#c45a4a' },
    { name: 'Sage', color: '#5a9a8a' },
    { name: 'Midnight', color: '#0d2d3d' },
    { name: 'Background', color: '#0a0a0a' }
  ];
  
  const lastPosRef = useRef({ x: 0, y: 0 });
  const bleedAnimationRef = useRef(null);
  const bleedStateRef = useRef({ x: 0, y: 0, radius: 0, maxRadius: 0 });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Dark background inspired by the images
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save initial state to undo history
    saveToHistory();
    
    // Keyboard shortcut to toggle UI
    const handleKeyPress = (e) => {
      if (e.key === 'h' || e.key === 'H') {
        setShowUI(prev => !prev);
      }
      // Undo with Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    
    // Panel drag handlers
    const handleMouseMove = (e) => {
      if (isDraggingPanel) {
        setPanelPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDraggingPanel(false);
    };
    
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPanel, dragOffset]);
  
  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const imageData = canvas.toDataURL();
    undoHistoryRef.current.push(imageData);
    
    // Limit history size
    if (undoHistoryRef.current.length > maxUndoSteps) {
      undoHistoryRef.current.shift();
    }
    
    setCanUndo(undoHistoryRef.current.length > 1);
  };
  
  const undo = () => {
    if (undoHistoryRef.current.length <= 1) return; // Keep at least one state
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Remove current state
    undoHistoryRef.current.pop();
    
    // Get previous state
    const previousState = undoHistoryRef.current[undoHistoryRef.current.length - 1];
    
    // Restore previous state
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = previousState;
    
    setCanUndo(undoHistoryRef.current.length > 1);
  };
  
  const applySymmetry = (ctx, x, y, drawFunction) => {
    const canvas = ctx.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    if (symmetryMode === 'none') {
      drawFunction(x, y);
    } else if (symmetryMode === 'mirror') {
      // Draw original
      drawFunction(x, y);
      
      // Calculate mirror reflection across line at given angle
      const angleRad = (mirrorAngle * Math.PI) / 180;
      
      // Translate point relative to center
      const relX = x - centerX;
      const relY = y - centerY;
      
      // Reflect across line at angle using reflection matrix
      const cos2a = Math.cos(2 * angleRad);
      const sin2a = Math.sin(2 * angleRad);
      
      const mirrorX = relX * cos2a + relY * sin2a;
      const mirrorY = relX * sin2a - relY * cos2a;
      
      // Translate back
      const finalX = mirrorX + centerX;
      const finalY = mirrorY + centerY;
      
      drawFunction(finalX, finalY);
    }
  };
  
  // Bleed animation effect - works with any brush or shape
  useEffect(() => {
    if (!isHolding || !bleedEnabled) {
      if (bleedAnimationRef.current) {
        cancelAnimationFrame(bleedAnimationRef.current);
        bleedAnimationRef.current = null;
      }
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const state = bleedStateRef.current;
    
    const animate = () => {
      if (!isHolding || !bleedEnabled) return;
      
      // Increase radius over time
      state.radius += 1.5;
      
      if (state.radius > state.maxRadius) {
        state.radius = state.maxRadius;
      }
      
      // Draw the selected brush pattern or shape at expanding radius
      if (shapeMode) {
        // For shapes, draw them at the expanding radius in a circle
        const numShapes = Math.floor(state.radius / (brushSize * 0.5));
        if (numShapes > 0 && state.radius % (brushSize * 0.5) < 2) {
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = state.x + Math.cos(angle) * state.radius;
            const y = state.y + Math.sin(angle) * state.radius;
            drawShape(ctx, x, y, shapeMode);
          }
        }
      } else {
        // For brush modes, create emanating patterns
        ctx.globalAlpha = opacity;
        
        if (brushMode === 'segments') {
          // Expanding segmented circles
          const numSegments = 24;
          const segmentLength = 8;
          ctx.strokeStyle = selectedColor;
          ctx.lineWidth = lineWeight;
          ctx.lineCap = 'round';
          
          for (let i = 0; i < numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            const startAngle = angle - 0.1;
            const endAngle = angle + 0.1;
            ctx.beginPath();
            ctx.arc(state.x, state.y, state.radius, startAngle, endAngle);
            ctx.stroke();
          }
        } else if (brushMode === 'dots') {
          // Expanding rings of evenly-spaced dots
          ctx.fillStyle = selectedColor;
          
          // Draw multiple concentric rings
          const numRings = Math.floor(state.radius / 15);
          for (let ring = 1; ring <= numRings; ring++) {
            const ringRadius = ring * 15;
            if (ringRadius > state.radius) break;
            
            // Fixed number of dots per ring for geometric consistency
            const dotsPerRing = 12 * ring; // More dots as radius increases
            for (let i = 0; i < dotsPerRing; i++) {
              const angle = (i / dotsPerRing) * Math.PI * 2;
              const dotX = state.x + Math.cos(angle) * ringRadius;
              const dotY = state.y + Math.sin(angle) * ringRadius;
              ctx.beginPath();
              ctx.arc(dotX, dotY, lineWeight, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (brushMode === 'radials') {
          // Radiating lines outward
          const numLines = 16;
          ctx.strokeStyle = selectedColor;
          ctx.lineWidth = lineWeight * 0.5;
          
          for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2;
            const innerRadius = state.radius - 10;
            const outerRadius = state.radius;
            ctx.beginPath();
            ctx.moveTo(
              state.x + Math.cos(angle) * innerRadius,
              state.y + Math.sin(angle) * innerRadius
            );
            ctx.lineTo(
              state.x + Math.cos(angle) * outerRadius,
              state.y + Math.sin(angle) * outerRadius
            );
            ctx.stroke();
          }
        } else if (brushMode === 'crosshatch') {
          // Expanding crosshatch circle
          const numLines = Math.floor(state.radius / 8);
          ctx.strokeStyle = selectedColor;
          ctx.lineWidth = lineWeight * 0.7;
          
          for (let i = 0; i < numLines; i++) {
            const angle = (i / numLines) * Math.PI * 2;
            const x = state.x + Math.cos(angle) * state.radius;
            const y = state.y + Math.sin(angle) * state.radius;
            const perpAngle = angle + Math.PI / 2;
            const length = brushSize * 0.3;
            
            ctx.beginPath();
            ctx.moveTo(
              x + Math.cos(perpAngle) * length / 2,
              y + Math.sin(perpAngle) * length / 2
            );
            ctx.lineTo(
              x - Math.cos(perpAngle) * length / 2,
              y - Math.sin(perpAngle) * length / 2
            );
            ctx.stroke();
          }
        } else if (brushMode === 'stipple') {
          // Concentric rings of stippled clusters
          ctx.fillStyle = selectedColor;
          
          // Draw multiple concentric rings of clusters
          const numRings = Math.floor(state.radius / 20);
          for (let ring = 1; ring <= numRings; ring++) {
            const ringRadius = ring * 20;
            if (ringRadius > state.radius) break;
            
            // Fixed number of clusters per ring
            const clustersPerRing = 8 * ring;
            for (let i = 0; i < clustersPerRing; i++) {
              const angle = (i / clustersPerRing) * Math.PI * 2;
              const centerX = state.x + Math.cos(angle) * ringRadius;
              const centerY = state.y + Math.sin(angle) * ringRadius;
              
              // Create small cluster at each position
              for (let j = 0; j < 3; j++) {
                const offsetX = (Math.random() - 0.5) * brushSize * 0.15;
                const offsetY = (Math.random() - 0.5) * brushSize * 0.15;
                ctx.beginPath();
                ctx.arc(centerX + offsetX, centerY + offsetY, lineWeight * 0.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        } else if (brushMode === 'fine') {
          // Simple expanding circle
          ctx.strokeStyle = selectedColor;
          ctx.lineWidth = lineWeight;
          ctx.beginPath();
          ctx.arc(state.x, state.y, state.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
      }
      
      bleedAnimationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (bleedAnimationRef.current) {
        cancelAnimationFrame(bleedAnimationRef.current);
      }
    };
  }, [isHolding, bleedEnabled, brushMode, shapeMode, selectedColor, opacity, lineWeight, brushSize]);
  
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const drawBlend = (ctx, x, y, lastX, lastY) => {
    // Smudge/blend the pixels underneath
    const blendRadius = brushSize * 0.5;
    const dx = x - lastX;
    const dy = y - lastY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 1) return;
    
    try {
      // Sample the area we're about to smudge
      const sourceX = Math.max(0, Math.floor(lastX - blendRadius));
      const sourceY = Math.max(0, Math.floor(lastY - blendRadius));
      const sourceWidth = Math.min(ctx.canvas.width - sourceX, Math.ceil(blendRadius * 2));
      const sourceHeight = Math.min(ctx.canvas.height - sourceY, Math.ceil(blendRadius * 2));
      
      if (sourceWidth <= 0 || sourceHeight <= 0) return;
      
      const imageData = ctx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
      
      // Draw the sampled pixels slightly offset in the direction of movement
      const smudgeStrength = 0.5;
      const offsetX = dx * smudgeStrength;
      const offsetY = dy * smudgeStrength;
      
      ctx.globalAlpha = opacity * 0.8;
      ctx.putImageData(imageData, sourceX + offsetX, sourceY + offsetY);
      ctx.globalAlpha = 1;
      
      // Also draw a soft circle to help blend
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, blendRadius);
      
      // Sample color from underneath
      const sampleData = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      const sampledColor = `rgba(${sampleData[0]}, ${sampleData[1]}, ${sampleData[2]}, ${opacity * 0.3})`;
      
      gradient.addColorStop(0, sampledColor);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, blendRadius, 0, Math.PI * 2);
      ctx.fill();
    } catch (e) {
      // Handle edge cases silently
      console.error('Blend error:', e);
    }
  };
  
  const floodFill = (ctx, startX, startY, fillColor) => {
    const canvas = ctx.canvas;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    const startPos = (Math.floor(startY) * canvas.width + Math.floor(startX)) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];
    const startA = pixels[startPos + 3];
    
    // Convert fill color to RGB
    const fillRgb = hexToRgb(fillColor);
    const fillR = fillRgb.r;
    const fillG = fillRgb.g;
    const fillB = fillRgb.b;
    const fillA = Math.floor(opacity * 255);
    
    // Don't fill if the color is the same
    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
      return;
    }
    
    // For pattern fills, create pattern first
    let patternCanvas = null;
    if (fillPattern !== 'solid') {
      patternCanvas = createPatternCanvas(fillColor);
    }
    
    const pixelsToCheck = [Math.floor(startX), Math.floor(startY)];
    const width = canvas.width;
    const height = canvas.height;
    const visited = new Uint8Array(width * height);
    
    while (pixelsToCheck.length > 0) {
      const y = pixelsToCheck.pop();
      const x = pixelsToCheck.pop();
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const currentPos = y * width + x;
      if (visited[currentPos]) continue;
      visited[currentPos] = 1;
      
      const pixelPos = currentPos * 4;
      
      // Check if pixel matches start color
      if (
        pixels[pixelPos] === startR &&
        pixels[pixelPos + 1] === startG &&
        pixels[pixelPos + 2] === startB &&
        pixels[pixelPos + 3] === startA
      ) {
        // Fill this pixel
        if (fillPattern === 'solid') {
          pixels[pixelPos] = fillR;
          pixels[pixelPos + 1] = fillG;
          pixels[pixelPos + 2] = fillB;
          pixels[pixelPos + 3] = fillA;
        } else if (patternCanvas) {
          // Sample from pattern
          const patternData = patternCanvas.getContext('2d').getImageData(
            x % patternCanvas.width,
            y % patternCanvas.height,
            1, 1
          ).data;
          pixels[pixelPos] = patternData[0];
          pixels[pixelPos + 1] = patternData[1];
          pixels[pixelPos + 2] = patternData[2];
          pixels[pixelPos + 3] = patternData[3];
        }
        
        // Add neighboring pixels
        pixelsToCheck.push(x + 1, y);
        pixelsToCheck.push(x - 1, y);
        pixelsToCheck.push(x, y + 1);
        pixelsToCheck.push(x, y - 1);
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };
  
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };
  
  const createPatternCanvas = (color) => {
    const patternCanvas = document.createElement('canvas');
    const size = 20;
    patternCanvas.width = size;
    patternCanvas.height = size;
    const pctx = patternCanvas.getContext('2d');
    
    // Fill with base color at lower opacity
    pctx.fillStyle = hexToRgba(color, opacity * 0.3);
    pctx.fillRect(0, 0, size, size);
    
    pctx.strokeStyle = color;
    pctx.fillStyle = color;
    pctx.globalAlpha = opacity;
    
    if (fillPattern === 'dots') {
      // Dotted pattern
      for (let x = 0; x < size; x += 6) {
        for (let y = 0; y < size; y += 6) {
          pctx.beginPath();
          pctx.arc(x, y, 1, 0, Math.PI * 2);
          pctx.fill();
        }
      }
    } else if (fillPattern === 'lines') {
      // Horizontal lines
      pctx.lineWidth = 1;
      for (let y = 0; y < size; y += 4) {
        pctx.beginPath();
        pctx.moveTo(0, y);
        pctx.lineTo(size, y);
        pctx.stroke();
      }
    } else if (fillPattern === 'crosshatch') {
      // Crosshatch pattern
      pctx.lineWidth = 1;
      for (let i = 0; i < size; i += 4) {
        pctx.beginPath();
        pctx.moveTo(0, i);
        pctx.lineTo(size, i);
        pctx.stroke();
        
        pctx.beginPath();
        pctx.moveTo(i, 0);
        pctx.lineTo(i, size);
        pctx.stroke();
      }
    } else if (fillPattern === 'stipple') {
      // Random stipple
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        pctx.beginPath();
        pctx.arc(x, y, 0.5, 0, Math.PI * 2);
        pctx.fill();
      }
    }
    
    return patternCanvas;
  };
  
  const drawShape = (ctx, x, y, shape) => {
    ctx.globalAlpha = opacity;
    const color = selectedColor;
    
    if (shape === 'concentric') {
      // Concentric circles like in the images
      const numRings = Math.floor(brushSize / 8);
      for (let i = 0; i < numRings; i++) {
        const radius = (i + 1) * (brushSize / numRings);
        ctx.strokeStyle = hexToRgba(color, opacity * (1 - i / numRings));
        ctx.lineWidth = lineWeight;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (shape === 'radial') {
      // Radiating lines like sunburst
      const numLines = 24;
      ctx.strokeStyle = hexToRgba(color, opacity);
      ctx.lineWidth = lineWeight;
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(angle) * brushSize,
          y + Math.sin(angle) * brushSize
        );
        ctx.stroke();
      }
    } else if (shape === 'mesh') {
      // Mesh/lattice circle like the translucent flowers
      const numSegments = 16;
      ctx.strokeStyle = hexToRgba(color, opacity * 0.6);
      ctx.lineWidth = lineWeight * 0.5;
      
      // Outer circle
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.stroke();
      
      // Internal web pattern
      for (let i = 0; i < numSegments; i++) {
        const angle = (i / numSegments) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          x + Math.cos(angle) * brushSize,
          y + Math.sin(angle) * brushSize
        );
        ctx.stroke();
      }
      
      // Inner rings
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'dotted') {
      // Dotted circle pattern
      const numDots = Math.floor(brushSize / 3);
      ctx.fillStyle = hexToRgba(color, opacity);
      for (let i = 0; i < numDots; i++) {
        const angle = (i / numDots) * Math.PI * 2;
        const dotX = x + Math.cos(angle) * brushSize;
        const dotY = y + Math.sin(angle) * brushSize;
        ctx.beginPath();
        ctx.arc(dotX, dotY, lineWeight * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (shape === 'circle') {
      // Simple circle
      ctx.strokeStyle = hexToRgba(color, opacity);
      ctx.lineWidth = lineWeight;
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'mandala') {
      // Sacred geometry mandala pattern
      const layers = 3;
      const petals = 8;
      ctx.strokeStyle = hexToRgba(color, opacity);
      ctx.lineWidth = lineWeight;
      
      for (let layer = 1; layer <= layers; layer++) {
        const radius = (brushSize / layers) * layer;
        for (let i = 0; i < petals; i++) {
          const angle = (i / petals) * Math.PI * 2;
          const petalX = x + Math.cos(angle) * radius;
          const petalY = y + Math.sin(angle) * radius;
          
          ctx.beginPath();
          ctx.arc(petalX, petalY, radius / 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      
      // Center
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  };
  
  const startDrawing = (e) => {
    // Don't start drawing if dragging panel or clicking on UI
    if (isDraggingPanel) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // If in fill mode, perform flood fill with symmetry
    if (fillMode) {
      const ctx = canvasRef.current.getContext('2d');
      applySymmetry(ctx, x, y, (sx, sy) => {
        floodFill(ctx, sx, sy, selectedColor);
      });
      saveToHistory();
      return;
    }
    
    // If bleed is enabled, start the bleed animation and drawing
    if (bleedEnabled) {
      bleedStateRef.current = {
        x,
        y,
        radius: 0,
        maxRadius: brushSize * 4
      };
      setIsHolding(true);
      setIsDrawing(true);
      lastPosRef.current = { x, y };
      return;
    }
    
    // If in shape mode, draw shape with symmetry
    if (shapeMode) {
      const ctx = canvasRef.current.getContext('2d');
      applySymmetry(ctx, x, y, (sx, sy) => {
        drawShape(ctx, sx, sy, shapeMode);
      });
      saveToHistory();
      return;
    }
    
    setIsDrawing(true);
    lastPosRef.current = { x, y };
  };
  
  const draw = (e) => {
    if ((!isDrawing && !isHolding) || shapeMode) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // If bleed is enabled, update the bleed center position as cursor moves
    if (bleedEnabled && isHolding) {
      const dx = x - lastPosRef.current.x;
      const dy = y - lastPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If cursor moved significantly, update bleed center and reset radius for trailing effect
      if (distance > 5) {
        bleedStateRef.current.x = x;
        bleedStateRef.current.y = y;
        // Reduce radius slightly when moving for a trailing effect
        bleedStateRef.current.radius = Math.max(0, bleedStateRef.current.radius * 0.7);
      }
      
      lastPosRef.current = { x, y };
      return;
    }
    
    // If in blend mode, smudge the pixels with symmetry
    if (blendMode) {
      applySymmetry(ctx, x, y, (sx, sy) => {
        // Calculate corresponding lastPos for mirrored point
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        let lastSx = lastPosRef.current.x;
        let lastSy = lastPosRef.current.y;
        
        if (symmetryMode === 'mirror') {
          // Check if this is the mirrored point
          const angleRad = (mirrorAngle * Math.PI) / 180;
          const relX = sx - centerX;
          const relY = sy - centerY;
          
          // Compare with original point
          const origRelX = x - centerX;
          const origRelY = y - centerY;
          
          // If this isn't the original point, it's the mirror
          const isMirror = Math.abs(relX - origRelX) > 1 || Math.abs(relY - origRelY) > 1;
          
          if (isMirror) {
            // Mirror the lastPos as well
            const lastRelX = lastPosRef.current.x - centerX;
            const lastRelY = lastPosRef.current.y - centerY;
            
            const cos2a = Math.cos(2 * angleRad);
            const sin2a = Math.sin(2 * angleRad);
            
            const mirrorLastX = lastRelX * cos2a + lastRelY * sin2a;
            const mirrorLastY = lastRelX * sin2a - lastRelY * cos2a;
            
            lastSx = mirrorLastX + centerX;
            lastSy = mirrorLastY + centerY;
          }
        }
        
        drawBlend(ctx, sx, sy, lastSx, lastSy);
      });
      lastPosRef.current = { x, y };
      return;
    }
    
    // Apply symmetry to all brush modes
    applySymmetry(ctx, x, y, (sx, sy) => {
      // Store original lastPos
      const origLastX = lastPosRef.current.x;
      const origLastY = lastPosRef.current.y;
      
      // Calculate symmetry-adjusted lastPos
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      let lastSx = origLastX;
      let lastSy = origLastY;
      
      if (symmetryMode === 'mirror') {
        // Check if this is the mirrored point
        const relX = sx - centerX;
        const relY = sy - centerY;
        const origRelX = x - centerX;
        const origRelY = y - centerY;
        
        const isMirror = Math.abs(relX - origRelX) > 1 || Math.abs(relY - origRelY) > 1;
        
        if (isMirror) {
          // Mirror the lastPos
          const angleRad = (mirrorAngle * Math.PI) / 180;
          const lastRelX = origLastX - centerX;
          const lastRelY = origLastY - centerY;
          
          const cos2a = Math.cos(2 * angleRad);
          const sin2a = Math.sin(2 * angleRad);
          
          const mirrorLastX = lastRelX * cos2a + lastRelY * sin2a;
          const mirrorLastY = lastRelX * sin2a - lastRelY * cos2a;
          
          lastSx = mirrorLastX + centerX;
          lastSy = mirrorLastY + centerY;
        }
      }
      
      // Temporarily set lastPos for this symmetry instance
      const tempLastPos = { x: lastSx, y: lastSy };
      lastPosRef.current = tempLastPos;
      
      // Draw with this symmetry instance
      drawBrushStroke(ctx, sx, sy);
      
      // Restore original lastPos
      lastPosRef.current = { x: origLastX, y: origLastY };
    });
    
    lastPosRef.current = { x, y };
  };
  
  // Extract brush drawing logic into separate function
  const drawBrushStroke = (ctx, x, y) => {
    
    const dx = x - lastPosRef.current.x;
    const dy = y - lastPosRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    ctx.globalAlpha = opacity;
    
    if (brushMode === 'segments') {
      // Segmented dashed lines
      const segmentLength = 5;
      const gapLength = 5;
      let currentDist = 0;
      let drawing = true;
      
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWeight;
      ctx.lineCap = 'round';
      
      while (currentDist < distance) {
        const t = currentDist / distance;
        const px = lastPosRef.current.x + dx * t;
        const py = lastPosRef.current.y + dy * t;
        
        if (drawing) {
          const endDist = Math.min(currentDist + segmentLength, distance);
          const endT = endDist / distance;
          const endX = lastPosRef.current.x + dx * endT;
          const endY = lastPosRef.current.y + dy * endT;
          
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          
          currentDist += segmentLength;
        } else {
          currentDist += gapLength;
        }
        drawing = !drawing;
      }
    } else if (brushMode === 'dots') {
      // Fine dotted trail - closer spacing like fine lines
      const dotSpacing = 3; // Much closer spacing
      const numDots = Math.floor(distance / dotSpacing);
      
      ctx.fillStyle = selectedColor;
      
      for (let i = 0; i <= numDots; i++) {
        const t = i / Math.max(numDots, 1);
        const px = lastPosRef.current.x + dx * t;
        const py = lastPosRef.current.y + dy * t;
        
        // Consistent dot size like fine line weight
        const dotSize = lineWeight;
        
        ctx.beginPath();
        ctx.arc(px, py, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (brushMode === 'radials') {
      // Small radial bursts along the path
      const burstSpacing = 20;
      const numBursts = Math.floor(distance / burstSpacing);
      
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWeight * 0.5;
      
      for (let i = 0; i <= numBursts; i++) {
        const t = i / Math.max(numBursts, 1);
        const px = lastPosRef.current.x + dx * t;
        const py = lastPosRef.current.y + dy * t;
        
        const numLines = 8;
        const burstSize = brushSize * 0.3;
        
        for (let j = 0; j < numLines; j++) {
          const burstAngle = (j / numLines) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(
            px + Math.cos(burstAngle) * burstSize,
            py + Math.sin(burstAngle) * burstSize
          );
          ctx.stroke();
        }
      }
    } else if (brushMode === 'crosshatch') {
      // Delicate crosshatch pattern
      const hatchSpacing = 15;
      const numHatches = Math.floor(distance / hatchSpacing);
      
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWeight * 0.7;
      
      for (let i = 0; i <= numHatches; i++) {
        const t = i / Math.max(numHatches, 1);
        const px = lastPosRef.current.x + dx * t;
        const py = lastPosRef.current.y + dy * t;
        
        const hatchLength = brushSize * 0.4;
        
        // Perpendicular lines
        const perpAngle = angle + Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(
          px + Math.cos(perpAngle) * hatchLength / 2,
          py + Math.sin(perpAngle) * hatchLength / 2
        );
        ctx.lineTo(
          px - Math.cos(perpAngle) * hatchLength / 2,
          py - Math.sin(perpAngle) * hatchLength / 2
        );
        ctx.stroke();
        
        // Crossing lines at angle
        const crossAngle = angle + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(
          px + Math.cos(crossAngle) * hatchLength / 2,
          py + Math.sin(crossAngle) * hatchLength / 2
        );
        ctx.lineTo(
          px - Math.cos(crossAngle) * hatchLength / 2,
          py - Math.sin(crossAngle) * hatchLength / 2
        );
        ctx.stroke();
      }
    } else if (brushMode === 'stipple') {
      // Stippled cluster of dots
      const numDots = Math.floor(distance * 0.5);
      ctx.fillStyle = selectedColor;
      
      for (let i = 0; i < numDots; i++) {
        const t = i / numDots;
        const centerX = lastPosRef.current.x + dx * t;
        const centerY = lastPosRef.current.y + dy * t;
        
        // Random offset from center
        const offsetX = (Math.random() - 0.5) * brushSize;
        const offsetY = (Math.random() - 0.5) * brushSize;
        
        const dotSize = lineWeight * 0.5 * (0.5 + Math.random() * 0.5);
        
        ctx.beginPath();
        ctx.arc(centerX + offsetX, centerY + offsetY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (brushMode === 'fine') {
      // Fine continuous line
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWeight;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    // Note: lastPos is managed by the caller
  };
  
  const stopDrawing = () => {
    if (isDrawing || isHolding) {
      saveToHistory();
    }
    setIsDrawing(false);
    setIsHolding(false);
  };
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Clear undo history and save new blank state
    undoHistoryRef.current = [];
    saveToHistory();
    setCanUndo(false);
  };
  
  const saveImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'geometric-art.png';
    link.href = canvas.toDataURL();
    link.click();
  };
  
  const saveAsJPEG = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'geometric-art.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };
  
  const handlePanelMouseDown = (e) => {
    // Only start dragging if clicking on the header/title area
    if (e.target.closest('.panel-header')) {
      setIsDraggingPanel(true);
      const panel = e.currentTarget;
      const rect = panel.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.stopPropagation(); // Prevent canvas drawing
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#0a0a0a',
      fontFamily: '"Crimson Pro", "Cormorant Garamond", serif',
      position: 'relative'
    }}>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{ 
          display: 'block',
          cursor: 'crosshair'
        }}
      />
      
      {/* Toggle UI Button */}
      <button
        onClick={() => setShowUI(!showUI)}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          background: 'rgba(10, 20, 30, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(107, 181, 199, 0.3)',
          borderRadius: '50%',
          color: '#f4e8d4',
          cursor: 'pointer',
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
          zIndex: 1000
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(107, 181, 199, 0.2)';
          e.target.style.borderColor = '#6bb5c7';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(10, 20, 30, 0.85)';
          e.target.style.borderColor = 'rgba(107, 181, 199, 0.3)';
        }}
      >
        {showUI ? '✕' : '☰'}
      </button>
      
      {/* Control Panel */}
      {showUI && (
      <div 
        onMouseDown={handlePanelMouseDown}
        style={{
        position: 'absolute',
        top: `${panelPosition.y}px`,
        left: `${panelPosition.x}px`,
        background: 'rgba(10, 20, 30, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(107, 181, 199, 0.3)',
        borderRadius: '20px',
        padding: '30px',
        minWidth: '280px',
        maxHeight: 'calc(100vh - 60px)',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(107, 181, 199, 0.1)',
        cursor: isDraggingPanel ? 'grabbing' : 'default',
        userSelect: 'none'
      }}>
        <h1 className="panel-header" style={{
          margin: '0 0 25px 0',
          fontSize: '28px',
          fontWeight: '300',
          letterSpacing: '2px',
          color: '#f4e8d4',
          textTransform: 'uppercase',
          textAlign: 'center',
          textShadow: '0 0 20px rgba(107, 181, 199, 0.3)',
          cursor: isDraggingPanel ? 'grabbing' : 'grab',
          paddingBottom: '10px',
          borderBottom: '1px solid rgba(107, 181, 199, 0.2)',
          position: 'relative'
        }}>
          <div style={{ 
            fontSize: '10px', 
            opacity: 0.4, 
            letterSpacing: '4px',
            marginBottom: '5px'
          }}>
            ⋮⋮⋮
          </div>
          Geometric Painter
        </h1>
        
        {/* Brush Mode */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Brush Mode {shapeMode && '(Off)'}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { id: 'segments', label: 'Segments' },
              { id: 'dots', label: 'Dots' },
              { id: 'radials', label: 'Radials' },
              { id: 'crosshatch', label: 'Hatch' },
              { id: 'stipple', label: 'Stipple' },
              { id: 'fine', label: 'Fine Line' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => {
                  setBrushMode(mode.id);
                  setShapeMode(null);
                  setBlendMode(false);
                  setFillMode(false);
                }}
                style={{
                  padding: '10px',
                  background: brushMode === mode.id && !shapeMode && !blendMode && !fillMode
                    ? 'linear-gradient(135deg, #4a8a9e, #6bb5c7)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: brushMode === mode.id && !shapeMode && !blendMode && !fillMode
                    ? '1px solid #6bb5c7' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: brushMode === mode.id && !shapeMode && !blendMode && !fillMode ? '#0a0a0a' : '#f4e8d4',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontWeight: brushMode === mode.id && !shapeMode && !blendMode && !fillMode ? '600' : '400',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Blend Mode Toggle */}
        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={() => {
              setBlendMode(!blendMode);
              setShapeMode(null);
              if (!blendMode) setFillMode(false);
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: blendMode
                ? 'linear-gradient(135deg, #8a5a8a, #c45a4a)'
                : 'rgba(255, 255, 255, 0.05)',
              border: blendMode
                ? '1px solid #c45a4a' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: blendMode ? '#0a0a0a' : '#f4e8d4',
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              fontFamily: 'inherit'
            }}
          >
            {blendMode ? '● Blend Mode Active' : 'Blend/Smudge Mode'}
          </button>
          {blendMode && (
            <p style={{
              margin: '10px 0 0 0',
              fontSize: '10px',
              color: '#c45a4a',
              lineHeight: '1.5',
              fontStyle: 'italic'
            }}>
              Drag to smudge and blend pixels underneath
            </p>
          )}
        </div>
        
        {/* Fill Mode Toggle */}
        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={() => {
              setFillMode(!fillMode);
              setShapeMode(null);
              if (!fillMode) setBlendMode(false);
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: fillMode
                ? 'linear-gradient(135deg, #e6a660, #d4854d)'
                : 'rgba(255, 255, 255, 0.05)',
              border: fillMode
                ? '1px solid #e6a660' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: fillMode ? '#0a0a0a' : '#f4e8d4',
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              fontFamily: 'inherit'
            }}
          >
            {fillMode ? '● Fill Mode Active' : 'Fill Mode'}
          </button>
          {fillMode && (
            <>
              <p style={{
                margin: '10px 0',
                fontSize: '10px',
                color: '#e6a660',
                lineHeight: '1.5',
                fontStyle: 'italic'
              }}>
                Click to fill enclosed areas
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { id: 'solid', label: 'Solid' },
                  { id: 'dots', label: 'Dots' },
                  { id: 'lines', label: 'Lines' },
                  { id: 'crosshatch', label: 'Hatch' },
                  { id: 'stipple', label: 'Stipple' }
                ].map(pattern => (
                  <button
                    key={pattern.id}
                    onClick={() => setFillPattern(pattern.id)}
                    style={{
                      padding: '8px',
                      background: fillPattern === pattern.id
                        ? 'linear-gradient(135deg, #e6a660, #d4854d)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: fillPattern === pattern.id
                        ? '1px solid #e6a660' 
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: fillPattern === pattern.id ? '#0a0a0a' : '#f4e8d4',
                      cursor: 'pointer',
                      fontSize: '9px',
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      fontWeight: fillPattern === pattern.id ? '600' : '400',
                      transition: 'all 0.3s ease',
                      fontFamily: 'inherit'
                    }}
                  >
                    {pattern.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        
        {/* Bleed Mode Toggle */}
        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={() => setBleedEnabled(!bleedEnabled)}
            style={{
              width: '100%',
              padding: '12px',
              background: bleedEnabled
                ? 'linear-gradient(135deg, #7acab5, #5a9a8a)'
                : 'rgba(255, 255, 255, 0.05)',
              border: bleedEnabled
                ? '1px solid #7acab5' 
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: bleedEnabled ? '#0a0a0a' : '#f4e8d4',
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              fontFamily: 'inherit'
            }}
          >
            {bleedEnabled ? '● Bleed Mode Active' : 'Bleed/Extend Mode'}
          </button>
          {bleedEnabled && (
            <p style={{
              margin: '10px 0 0 0',
              fontSize: '10px',
              color: '#7acab5',
              lineHeight: '1.5',
              fontStyle: 'italic'
            }}>
              Hold still to radiate outward, or drag to trail extending patterns with your cursor
            </p>
          )}
        </div>
        
        {/* Symmetry Mode */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Symmetry Mode
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { id: 'none', label: 'None' },
              { id: 'mirror', label: 'Mirror' }
            ].map(mode => (
              <button
                key={mode.id}
                onClick={() => setSymmetryMode(mode.id)}
                style={{
                  padding: '10px',
                  background: symmetryMode === mode.id
                    ? 'linear-gradient(135deg, #6bb5c7, #4a8a9e)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: symmetryMode === mode.id
                    ? '1px solid #6bb5c7' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: symmetryMode === mode.id ? '#0a0a0a' : '#f4e8d4',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontWeight: symmetryMode === mode.id ? '600' : '400',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {symmetryMode === 'mirror' && (
            <>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#6bb5c7',
                fontSize: '10px',
                letterSpacing: '1px'
              }}>
                Mirror Axis: {mirrorAngle}°
              </label>
              <input
                type="range"
                min="0"
                max="180"
                value={mirrorAngle}
                onChange={(e) => setMirrorAngle(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: '#6bb5c7'
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '5px',
                fontSize: '9px',
                color: '#6bb5c7',
                opacity: 0.6
              }}>
                <span>0° (horizontal)</span>
                <span>90° (vertical)</span>
                <span>180°</span>
              </div>
            </>
          )}
        </div>
        
        {/* Shape Stamps */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Shape Stamps
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { id: 'concentric', label: 'Rings' },
              { id: 'radial', label: 'Radiant' },
              { id: 'mesh', label: 'Mesh' },
              { id: 'dotted', label: 'Dotted' },
              { id: 'circle', label: 'Circle' },
              { id: 'mandala', label: 'Mandala' }
            ].map(shape => (
              <button
                key={shape.id}
                onClick={() => {
                  setShapeMode(shape.id);
                  setBlendMode(false);
                  setFillMode(false);
                }}
                style={{
                  padding: '10px',
                  background: shapeMode === shape.id
                    ? 'linear-gradient(135deg, #e6a660, #d4854d)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: shapeMode === shape.id
                    ? '1px solid #e6a660' 
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: shapeMode === shape.id ? '#0a0a0a' : '#f4e8d4',
                  cursor: 'pointer',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  fontWeight: shapeMode === shape.id ? '600' : '400',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Size Control */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Size: {brushSize}
          </label>
          <input
            type="range"
            min="10"
            max="120"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#6bb5c7'
            }}
          />
        </div>
        
        {/* Line Weight Control */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Line Weight: {lineWeight.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={lineWeight}
            onChange={(e) => setLineWeight(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#6bb5c7'
            }}
          />
        </div>
        
        {/* Opacity Control */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Opacity: {Math.round(opacity * 100)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#6bb5c7'
            }}
          />
        </div>
        
        {/* Color Palette */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '12px',
            color: '#e6a660',
            fontSize: '11px',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontWeight: '600'
          }}>
            Color Palette
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px'
          }}>
            {colorPalette.map((c) => (
              <button
                key={c.color}
                onClick={() => setSelectedColor(c.color)}
                title={c.name}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: c.color,
                  border: selectedColor === c.color 
                    ? '3px solid #f4e8d4' 
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: selectedColor === c.color 
                    ? `0 0 20px ${c.color}80` 
                    : 'none',
                  transform: selectedColor === c.color ? 'scale(1.1)' : 'scale(1)'
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={clearCanvas}
              style={{
                flex: 1,
                padding: '14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                color: '#f4e8d4',
                cursor: 'pointer',
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = '#e87a6a';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
            >
              Clear
            </button>
            <button
              onClick={saveImage}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #e6a660, #d4854d)',
                border: '1px solid #e6a660',
                borderRadius: '10px',
                color: '#0a0a0a',
                cursor: 'pointer',
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                fontFamily: 'inherit',
                boxShadow: '0 4px 15px rgba(230, 166, 96, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(230, 166, 96, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(230, 166, 96, 0.3)';
              }}
            >
              PNG
            </button>
            <button
              onClick={saveAsJPEG}
              style={{
                flex: 1,
                padding: '14px',
                background: 'linear-gradient(135deg, #7acab5, #5a9a8a)',
                border: '1px solid #7acab5',
                borderRadius: '10px',
                color: '#0a0a0a',
                cursor: 'pointer',
                fontSize: '11px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                fontFamily: 'inherit',
                boxShadow: '0 4px 15px rgba(122, 202, 181, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(122, 202, 181, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(122, 202, 181, 0.3)';
              }}
            >
              JPEG
            </button>
          </div>
          <button
            onClick={undo}
            disabled={!canUndo}
            style={{
              width: '100%',
              padding: '14px',
              background: !canUndo
                ? 'rgba(255, 255, 255, 0.02)'
                : 'rgba(107, 181, 199, 0.15)',
              border: '1px solid rgba(107, 181, 199, 0.3)',
              borderRadius: '10px',
              color: !canUndo ? '#4a4a4a' : '#6bb5c7',
              cursor: !canUndo ? 'not-allowed' : 'pointer',
              fontSize: '11px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              fontFamily: 'inherit',
              opacity: !canUndo ? 0.3 : 1
            }}
          >
            ↶ Undo (Ctrl+Z)
          </button>
        </div>
      </div>
      )}
      
      {/* Instructions */}
      {showUI && (
      <div 
        onClick={() => setShowInstructions(!showInstructions)}
        style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        background: 'rgba(10, 20, 30, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(107, 181, 199, 0.2)',
        borderRadius: '15px',
        padding: '20px 25px',
        maxWidth: '320px',
        color: '#f4e8d4',
        fontSize: '13px',
        lineHeight: '1.8',
        fontWeight: '300',
        letterSpacing: '0.5px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(10, 20, 30, 0.85)';
        e.currentTarget.style.borderColor = 'rgba(107, 181, 199, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(10, 20, 30, 0.7)';
        e.currentTarget.style.borderColor = 'rgba(107, 181, 199, 0.2)';
      }}
      >
        <p style={{ margin: '0 0 10px 0', color: '#e6a660', fontWeight: '600', fontSize: '11px', letterSpacing: '1.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>How to Use</span>
          <span style={{ fontSize: '14px', opacity: 0.6 }}>{showInstructions ? '▼' : '▶'}</span>
        </p>
        {!showInstructions && (
          <p style={{ margin: 0, fontSize: '11px', opacity: 0.6, fontStyle: 'italic' }}>
            Click to expand • Drag panel header to move
          </p>
        )}
        {showInstructions && (
        <>
        <p style={{ margin: '0 0 10px 0', fontSize: '11px', opacity: 0.7, fontStyle: 'italic', color: '#7acab5' }}>
          💡 Drag the panel header to reposition • Click here to collapse
        </p>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong style={{ color: '#6bb5c7' }}>Symmetry:</strong> Enable Mirror mode with adjustable axis angle (0-180°) to create perfectly symmetrical compositions at any orientation.
        </p>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong style={{ color: '#6bb5c7' }}>Brush Modes:</strong> Drag to draw segmented lines, dots, radial bursts, crosshatching, stippling, or fine lines.
        </p>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong style={{ color: '#e6a660' }}>Shape Stamps:</strong> Click once to place geometric patterns - concentric rings, radiant bursts, mesh circles, spirals, and mandalas.
        </p>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong style={{ color: '#7acab5' }}>Bleed Mode:</strong> Hold still to radiate patterns outward from one spot, or drag to trail extending patterns that follow your cursor.
        </p>
        <p style={{ margin: '0 0 10px 0' }}>
          <strong style={{ color: '#c45a4a' }}>Blend Mode:</strong> Drag to smudge and blend colors underneath, creating fluid transitions.
        </p>
        <p style={{ margin: 0 }}>
          <strong style={{ color: '#e6a660' }}>Fill Mode:</strong> Click to fill enclosed shapes with solid color or patterns (dots, lines, crosshatch, stipple).
        </p>
        </>
        )}
      </div>
      )}
    </div>
  );
};

// Component ready for use
