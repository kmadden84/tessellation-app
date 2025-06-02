'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { RotateCw, Copy, Download, Grid, Trash2, Menu, Zap, Sparkles } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Tile {
  id: string;
  shape: ShapeType;
  x: number;
  y: number;
  rotation: number;
  color: string;
  isSymmetryMirror?: boolean; // Track if this is a mirror tile
  originalId?: string; // Reference to original tile for mirrors
}

type ShapeType = 'triangle' | 'square' | 'hexagon' | 'diamond';
type SymmetryMode = 'none' | 'horizontal' | 'vertical' | 'radial';

interface DragState {
  isDragging: boolean;
  tileId: string | null;
  offsetX: number;
  offsetY: number;
}

interface SuggestionPoint {
  x: number;
  y: number;
  shape: ShapeType;
  rotation: number;
}

interface Edge {
  start: Point;
  end: Point;
  length: number;
  midpoint: Point;
  normal: Point; // perpendicular vector pointing outward
}

const SHAPES: Record<ShapeType, { name: string; path: string; color: string }> = {
  triangle: {
    name: 'Triangle',
    path: 'M 0 -30 L 25 15 L -25 15 Z',
    color: '#3b82f6'
  },
  square: {
    name: 'Square',
    path: 'M -25 -25 L 25 -25 L 25 25 L -25 25 Z',
    color: '#ef4444'
  },
  hexagon: {
    name: 'Hexagon',
    path: 'M 50 0 L 25 43.3 L -25 43.3 L -50 0 L -25 -43.3 L 25 -43.3 Z',
    color: '#10b981'
  },
  diamond: {
    name: 'Diamond',
    path: 'M 0 -30 L 30 0 L 0 30 L -30 0 Z',
    color: '#f59e0b'
  }
};

const COLORS: readonly string[] = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

const generateId = (): string => Math.random().toString(36).substring(2, 11);

// Universal edge calculation for any shape at any rotation
const getShapeEdges = (tile: Tile): Edge[] => {
  const cos = Math.cos(tile.rotation * Math.PI / 180);
  const sin = Math.sin(tile.rotation * Math.PI / 180);
  
  // Transform a local point to world coordinates
  const transform = (localX: number, localY: number): Point => ({
    x: tile.x + (localX * cos - localY * sin),
    y: tile.y + (localX * sin + localY * cos)
  });
  
  let vertices: Point[] = [];
  
  // Define vertices for each shape in local coordinates
  switch (tile.shape) {
    case 'triangle':
      vertices = [
        transform(0, -30),   // top
        transform(25, 15),   // bottom right
        transform(-25, 15)   // bottom left
      ];
      break;
      
    case 'square':
      vertices = [
        transform(-25, -25), // top left
        transform(25, -25),  // top right
        transform(25, 25),   // bottom right
        transform(-25, 25)   // bottom left
      ];
      break;
      
    case 'hexagon':
      vertices = [
        transform(50, 0),     // right
        transform(25, 43.3),  // bottom right
        transform(-25, 43.3), // bottom left
        transform(-50, 0),    // left
        transform(-25, -43.3), // top left
        transform(25, -43.3)  // top right
      ];
      break;
      
    case 'diamond':
      vertices = [
        transform(0, -30),   // top
        transform(30, 0),    // right
        transform(0, 30),    // bottom
        transform(-30, 0)    // left
      ];
      break;
  }
  
  // Create edges from consecutive vertices
  const edges: Edge[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % vertices.length];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };
    
    // Calculate outward normal (perpendicular to edge)
    const normal = {
      x: dy / length, // perpendicular (swapped sign)
      y: -dx / length // perpendicular (swapped sign)
    };
    
    // Ensure normal points outward from shape center
    const edgeToCenterX = tile.x - midpoint.x;
    const edgeToCenterY = tile.y - midpoint.y;
    const dotProduct = normal.x * edgeToCenterX + normal.y * edgeToCenterY;
    
    // If normal points toward center, flip it
    if (dotProduct > 0) {
      normal.x = -normal.x;
      normal.y = -normal.y;
    }
    
    edges.push({ start, end, length, midpoint, normal });
  }
  
  return edges;
};

// Check if two edges are compatible for snapping
const areEdgesCompatible = (edge1: Edge, edge2: Edge): boolean => {
  const lengthDiff = Math.abs(edge1.length - edge2.length);
  if (lengthDiff > 2) return false; // Must have very similar edge lengths
  
  // Check if edges are close enough
  const distance = Math.sqrt(
    Math.pow(edge1.midpoint.x - edge2.midpoint.x, 2) +
    Math.pow(edge1.midpoint.y - edge2.midpoint.y, 2)
  );
  
  if (distance > 40) return false; // Edges must be reasonably close
  
  // Check if edges are roughly parallel and pointing in opposite directions
  const dotProduct = edge1.normal.x * edge2.normal.x + edge1.normal.y * edge2.normal.y;
  if (dotProduct > -0.9) return false; // Normals must be nearly opposite (more strict)
  
  // Additional check: edges should be roughly parallel (not just normals opposite)
  const edge1Dir = { 
    x: edge1.end.x - edge1.start.x, 
    y: edge1.end.y - edge1.start.y 
  };
  const edge2Dir = { 
    x: edge2.end.x - edge2.start.x, 
    y: edge2.end.y - edge2.start.y 
  };
  
  // Normalize directions
  const edge1Len = Math.sqrt(edge1Dir.x * edge1Dir.x + edge1Dir.y * edge1Dir.y);
  const edge2Len = Math.sqrt(edge2Dir.x * edge2Dir.x + edge2Dir.y * edge2Dir.y);
  
  edge1Dir.x /= edge1Len;
  edge1Dir.y /= edge1Len;
  edge2Dir.x /= edge2Len;
  edge2Dir.y /= edge2Len;
  
  // Check if edges are parallel (dot product close to 1 or -1)
  const edgeDotProduct = Math.abs(edge1Dir.x * edge2Dir.x + edge1Dir.y * edge2Dir.y);
  if (edgeDotProduct < 0.9) return false; // Edges must be nearly parallel
  
  return true;
};

// Universal snapping function
const canTilesSnap = (tile1: Tile, tile2: Tile): { canSnap: boolean; snapPosition: Point | null } => {
  const edges1 = getShapeEdges(tile1);
  const edges2 = getShapeEdges(tile2);
  
  let bestSnap: { edge1: Edge; edge2: Edge; distance: number } | null = null;
  
  // Find the best compatible edge pair
  for (const edge1 of edges1) {
    for (const edge2 of edges2) {
      if (areEdgesCompatible(edge1, edge2)) {
        const distance = Math.sqrt(
          Math.pow(edge1.midpoint.x - edge2.midpoint.x, 2) +
          Math.pow(edge1.midpoint.y - edge2.midpoint.y, 2)
        );
        
        if (!bestSnap || distance < bestSnap.distance) {
          bestSnap = { edge1, edge2, distance };
        }
      }
    }
  }
  
  if (!bestSnap) {
    return { canSnap: false, snapPosition: null };
  }
  
  // Calculate snap position: move tile1 so its edge aligns with tile2's edge
  const offsetX = bestSnap.edge2.midpoint.x - bestSnap.edge1.midpoint.x;
  const offsetY = bestSnap.edge2.midpoint.y - bestSnap.edge1.midpoint.y;
  
  // Move slightly apart along the normal to avoid overlap
  const separation = 1; // Small separation to avoid z-fighting
  const separationX = bestSnap.edge2.normal.x * separation;
  const separationY = bestSnap.edge2.normal.y * separation;
  
  return {
    canSnap: true,
    snapPosition: {
      x: tile1.x + offsetX + separationX,
      y: tile1.y + offsetY + separationY
    }
  };
};

export default function TessellationApp() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    tileId: null,
    offsetX: 0,
    offsetY: 0
  });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [symmetryMode, setSymmetryMode] = useState<SymmetryMode>('none');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [announcements, setAnnouncements] = useState<string>('');
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Announce actions for screen readers
  const announce = useCallback((message: string) => {
    setAnnouncements(message);
    // Clear after a brief delay
    setTimeout(() => setAnnouncements(''), 1000);
  }, []);

  // Create symmetry mirrors for a tile
  const createSymmetryMirrors = useCallback((originalTile: Tile): Tile[] => {
    if (symmetryMode === 'none') return [];
    
    const mirrors: Tile[] = [];
    const centerX = 300; // Canvas center (increased from 200)
    const centerY = 300;
    
    switch (symmetryMode) {
      case 'horizontal':
        mirrors.push({
          ...originalTile,
          id: generateId(),
          x: centerX * 2 - originalTile.x,
          isSymmetryMirror: true,
          originalId: originalTile.id
        });
        break;
        
      case 'vertical':
        mirrors.push({
          ...originalTile,
          id: generateId(),
          y: centerY * 2 - originalTile.y,
          isSymmetryMirror: true,
          originalId: originalTile.id
        });
        break;
        
      case 'radial':
        // 4-way radial symmetry
        mirrors.push(
          {
            ...originalTile,
            id: generateId(),
            x: centerX * 2 - originalTile.x,
            isSymmetryMirror: true,
            originalId: originalTile.id
          },
          {
            ...originalTile,
            id: generateId(),
            y: centerY * 2 - originalTile.y,
            isSymmetryMirror: true,
            originalId: originalTile.id
          },
          {
            ...originalTile,
            id: generateId(),
            x: centerX * 2 - originalTile.x,
            y: centerY * 2 - originalTile.y,
            isSymmetryMirror: true,
            originalId: originalTile.id
          }
        );
        break;
    }
    
    return mirrors;
  }, [symmetryMode]);

  const addShape = useCallback((shapeType: ShapeType): void => {
    const newTile: Tile = {
      id: generateId(),
      shape: shapeType,
      x: 300,
      y: 300,
      rotation: 0,
      color: selectedColor
    };
    
    const mirrors = createSymmetryMirrors(newTile);
    setTiles(prev => [...prev, newTile, ...mirrors]);
    announce(`Added ${SHAPES[shapeType].name} to canvas`);
  }, [selectedColor, createSymmetryMirrors, announce]);

  const rotateTile = useCallback((tileId: string): void => {
    setTiles(prev => prev.map(tile => 
      tile.id === tileId 
        ? { ...tile, rotation: (tile.rotation + 45) % 360 }
        : tile
    ));
  }, []);

  const duplicateTile = useCallback((tileId: string): void => {
    const original = tiles.find(t => t.id === tileId);
    if (!original) return;
    
    const duplicate: Tile = {
      ...original,
      id: generateId(),
      x: original.x + 60,
      y: original.y + 60
    };
    
    setTiles(prev => [...prev, duplicate]);
  }, [tiles]);

  const deleteTile = useCallback((tileId: string): void => {
    setTiles(prev => prev.filter(t => t.id !== tileId));
    if (selectedTile?.id === tileId) {
      setSelectedTile(null);
    }
  }, [selectedTile]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedTile) return;
    
    const moveDistance = e.shiftKey ? 10 : 1;
    let newX = selectedTile.x;
    let newY = selectedTile.y;
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        newX = Math.max(50, selectedTile.x - moveDistance);
        announce(`Moved ${selectedTile.shape} left to position ${newX}, ${selectedTile.y}`);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newX = Math.min(550, selectedTile.x + moveDistance);
        announce(`Moved ${selectedTile.shape} right to position ${newX}, ${selectedTile.y}`);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newY = Math.max(50, selectedTile.y - moveDistance);
        announce(`Moved ${selectedTile.shape} up to position ${selectedTile.x}, ${newY}`);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newY = Math.min(550, selectedTile.y + moveDistance);
        announce(`Moved ${selectedTile.shape} down to position ${selectedTile.x}, ${newY}`);
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        rotateTile(selectedTile.id);
        announce(`Rotated ${selectedTile.shape}`);
        return;
      case 'd':
      case 'D':
        e.preventDefault();
        duplicateTile(selectedTile.id);
        announce(`Duplicated ${selectedTile.shape}`);
        return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        deleteTile(selectedTile.id);
        announce(`Deleted ${selectedTile.shape}`);
        return;
      default:
        return;
    }
    
    // Update tile position
    setTiles(prev => prev.map(tile => 
      tile.id === selectedTile.id 
        ? { ...tile, x: newX, y: newY }
        : tile
    ));
    
    setSelectedTile(prev => prev ? { ...prev, x: newX, y: newY } : null);
  }, [selectedTile, announce, rotateTile, duplicateTile, deleteTile]);

  // Calculate smart fill suggestions
  const suggestions = useMemo((): SuggestionPoint[] => {
    if (!showSuggestions || tiles.length === 0) return [];
    
    const suggestionPoints: SuggestionPoint[] = [];
    
    // Use actual edge geometry for proper alignment
    tiles.forEach(tile => {
      if (tile.isSymmetryMirror) return; // Skip mirror tiles
      
      const edges = getShapeEdges(tile);
      
      // Take only some edges to avoid clutter (every other edge)
      const selectedEdges = edges.filter((_, index) => index % 2 === 0);
      
      selectedEdges.forEach((edge, edgeIndex) => {
        // Determine edge orientation and suggest appropriate shapes
        const dx = edge.end.x - edge.start.x;
        const dy = edge.end.y - edge.start.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const normalizedAngle = ((angle % 180) + 180) % 180; // Normalize to 0-180
        
        let compatibleShapes: ShapeType[] = [];
        
        // Suggest shapes based on edge orientation
        if (Math.abs(normalizedAngle) < 15 || Math.abs(normalizedAngle - 180) < 15) {
          // Horizontal edge - squares and hexagons work well
          compatibleShapes = ['square', 'hexagon'];
        } else if (Math.abs(normalizedAngle - 90) < 15) {
          // Vertical edge - squares and hexagons work well  
          compatibleShapes = ['square', 'hexagon'];
        } else if (Math.abs(normalizedAngle - 60) < 15 || Math.abs(normalizedAngle - 120) < 15) {
          // 60° or 120° diagonal - triangles and hexagons work well
          compatibleShapes = ['triangle', 'hexagon'];
        } else {
          // Other angles - triangles are most flexible
          compatibleShapes = ['triangle'];
        }
        
        // Pick a shape from compatible options
        const shape = compatibleShapes[edgeIndex % compatibleShapes.length];
        
        // Calculate proper offset distance based on shape geometry
        let centerToEdgeDistance: number;
        switch (shape) {
          case 'triangle':
            centerToEdgeDistance = 20; // Distance from center to base edge midpoint
            break;
          case 'square': 
            centerToEdgeDistance = 25; // Distance from center to edge midpoint
            break;
          case 'hexagon':
            centerToEdgeDistance = 43.3; // Distance from center to edge midpoint
            break;
          case 'diamond':
            centerToEdgeDistance = 30; // Distance from center to edge midpoint
            break;
        }
        
        // Position the suggested shape so its edge aligns with the hexagon's edge
        const suggestionX = edge.midpoint.x + edge.normal.x * centerToEdgeDistance;
        const suggestionY = edge.midpoint.y + edge.normal.y * centerToEdgeDistance;
        
        // Check bounds and position availability
        const inBounds = suggestionX > 80 && suggestionX < 520 && suggestionY > 80 && suggestionY < 520;
        
        if (inBounds) {
          const isFree = !tiles.some(existingTile => {
            const distance = Math.sqrt(
              Math.pow(existingTile.x - suggestionX, 2) +
              Math.pow(existingTile.y - suggestionY, 2)
            );
            return distance < 50;
          });
          
          if (isFree) {
            suggestionPoints.push({
              x: suggestionX,
              y: suggestionY,
              shape,
              rotation: 0
            });
          }
        }
      });
    });
    
    return suggestionPoints;
  }, [tiles, showSuggestions]);

  // SIMPLE DRAG - NO SNAPPING (Mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>, tile: Tile): void => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setSelectedTile(tile);
    setDragState({
      isDragging: true,
      tileId: tile.id,
      offsetX: mouseX - tile.x,
      offsetY: mouseY - tile.y
    });
  }, []);

  // TOUCH DRAG HANDLERS - Multi-touch support
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGGElement>, targetTile: Tile): void => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent any default touch behaviors
    if (e.cancelable) {
      e.preventDefault();
    }
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touch = e.touches[0]; // Use first touch
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    
    // Set the touched tile as selected and start dragging
    setSelectedTile(targetTile);
    setDragState({
      isDragging: true,
      tileId: targetTile.id,
      offsetX: touchX - targetTile.x,
      offsetY: touchY - targetTile.y
    });
    
    announce(`Selected ${SHAPES[targetTile.shape].name} tile`);
  }, [announce]);

  // Performance-optimized move handler with RAF
  const performMove = useCallback((touches: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Handle mouse move
      if ('clientX' in touches) {
        if (!dragState.isDragging || !dragState.tileId) return;
        
        const mouseX = touches.clientX - rect.left;
        const mouseY = touches.clientY - rect.top;
        
        const newX = mouseX - dragState.offsetX;
        const newY = mouseY - dragState.offsetY;
        
        const boundedX = Math.max(50, Math.min(550, newX));
        const boundedY = Math.max(50, Math.min(550, newY));
        
        setTiles(prev => prev.map(tile => {
          if (tile.id === dragState.tileId) {
            const updatedTile = { ...tile, x: boundedX, y: boundedY };
            // Symmetry mirrors are handled automatically
            return updatedTile;
          }
          // Update mirrors if this tile is the original
          if (tile.originalId === dragState.tileId && tile.isSymmetryMirror) {
            const originalTile = { ...tile, x: boundedX, y: boundedY, isSymmetryMirror: false, originalId: undefined };
            const mirrors = createSymmetryMirrors(originalTile);
            const mirrorIndex = mirrors.findIndex(m => m.x === tile.x && m.y === tile.y);
            return mirrorIndex >= 0 ? { ...mirrors[mirrorIndex], id: tile.id, isSymmetryMirror: true, originalId: tile.originalId } : tile;
          }
          return tile;
        }));
        
        setSelectedTile(prev => 
          prev && prev.id === dragState.tileId 
            ? { ...prev, x: boundedX, y: boundedY }
            : prev
        );
      }
      // Handle touch move
      else if ('touches' in touches && touches.touches.length > 0) {
        if (!dragState.isDragging || !dragState.tileId) return;
        
        const touch = touches.touches[0]; // Use first touch
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        const newX = touchX - dragState.offsetX;
        const newY = touchY - dragState.offsetY;
        
        const boundedX = Math.max(50, Math.min(550, newX));
        const boundedY = Math.max(50, Math.min(550, newY));
        
        setTiles(prev => prev.map(tile => {
          if (tile.id === dragState.tileId) {
            const updatedTile = { ...tile, x: boundedX, y: boundedY };
            return updatedTile;
          }
          // Update mirrors if this tile is the original
          if (tile.originalId === dragState.tileId && tile.isSymmetryMirror) {
            const originalTile = { ...tile, x: boundedX, y: boundedY, isSymmetryMirror: false, originalId: undefined };
            const mirrors = createSymmetryMirrors(originalTile);
            const mirrorIndex = mirrors.findIndex(m => m.x === tile.x && m.y === tile.y);
            return mirrorIndex >= 0 ? { ...mirrors[mirrorIndex], id: tile.id, isSymmetryMirror: true, originalId: tile.originalId } : tile;
          }
          return tile;
        }));
        
        setSelectedTile(prev => 
          prev && prev.id === dragState.tileId 
            ? { ...prev, x: boundedX, y: boundedY }
            : prev
        );
      }
    });
  }, [dragState, createSymmetryMirrors]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    performMove(e);
  }, [performMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    // Always prevent default to stop scrolling
    e.preventDefault();
    if (e.cancelable) {
      e.preventDefault();
    }
    performMove(e);
  }, [performMove]);

  const handleTouchEnd = useCallback((): void => {
    if (dragState.isDragging && dragState.tileId) {
      // Find the dragged tile
      const draggedTile = tiles.find(t => t.id === dragState.tileId);
      
      if (draggedTile) {
        // Check for snapping with other tiles
        const otherTiles = tiles.filter(t => t.id !== dragState.tileId);
        let bestSnap: { tile: Tile; snapPosition: Point } | null = null;
        let closestDistance = Infinity;
        
        for (const otherTile of otherTiles) {
          const snapResult = canTilesSnap(draggedTile, otherTile);
          
          if (snapResult.canSnap && snapResult.snapPosition) {
            // Calculate distance to snap position
            const distance = Math.sqrt(
              Math.pow(draggedTile.x - snapResult.snapPosition.x, 2) +
              Math.pow(draggedTile.y - snapResult.snapPosition.y, 2)
            );
            
            if (distance < closestDistance) {
              closestDistance = distance;
              bestSnap = {
                tile: otherTile,
                snapPosition: snapResult.snapPosition
              };
            }
          }
        }
        
        // Apply snap if found
        if (bestSnap) {
          const constrainedX = Math.max(50, Math.min(550, bestSnap.snapPosition.x));
          const constrainedY = Math.max(50, Math.min(550, bestSnap.snapPosition.y));
          
          setTiles(prev => prev.map(tile => 
            tile.id === dragState.tileId 
              ? { ...tile, x: constrainedX, y: constrainedY }
              : tile
          ));
          
          setSelectedTile(prev => 
            prev && prev.id === dragState.tileId 
              ? { ...prev, x: constrainedX, y: constrainedY }
              : prev
          );
        }
      }
    }
    
    // Clear drag state
    setDragState({
      isDragging: false,
      tileId: null,
      offsetX: 0,
      offsetY: 0
    });
  }, [dragState, tiles]);

  const handleMouseUp = useCallback((): void => {
    handleTouchEnd(); // Reuse the touch logic
  }, [handleTouchEnd]);

  // Smart fill function
  const fillPattern = useCallback((): void => {
    const newTiles: Tile[] = [];
    
    suggestions.forEach(suggestion => {
      const newTile: Tile = {
        id: generateId(),
        shape: suggestion.shape,
        x: suggestion.x,
        y: suggestion.y,
        rotation: suggestion.rotation,
        color: selectedColor
      };
      
      newTiles.push(newTile);
      
      // Add symmetry mirrors
      const mirrors = createSymmetryMirrors(newTile);
      newTiles.push(...mirrors);
    });
    
    setTiles(prev => [...prev, ...newTiles]);
    setShowSuggestions(false);
  }, [suggestions, selectedColor, createSymmetryMirrors]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const exportSvg = useCallback((): void => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tessellation.svg';
    link.click();
    
    URL.revokeObjectURL(url);
  }, []);

  const clearAll = useCallback((): void => {
    setTiles([]);
    setSelectedTile(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white" style={{ touchAction: 'manipulation' }}>
      {/* Skip Navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-white text-black px-4 py-2 rounded-md z-50 focus:z-50"
      >
        Skip to main content
      </a>

      {/* Screen Reader Announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
        role="status"
      >
        {announcements}
      </div>

      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Tessellation Creator
          </h1>
          <button 
            className="md:hidden p-2 rounded-lg bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label="Toggle navigation menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row">
        {/* Mobile Menu */}
        <nav 
          id="mobile-menu"
          className={`md:hidden fixed inset-0 z-30 bg-slate-900/90 backdrop-blur-lg transform ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-300 ease-in-out`}
          aria-hidden={!mobileMenuOpen}
        >
          <div className="p-4 pt-16 overflow-y-auto h-full">
            <fieldset className="mb-8">
              <legend className="text-sm font-semibold mb-2 text-slate-300">Shape Tools</legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Shape selection">
                {Object.entries(SHAPES).map(([key, shape]) => (
                  <button
                    key={key}
                    onClick={() => {
                      addShape(key as ShapeType);
                      setMobileMenuOpen(false);
                      announce(`Added ${shape.name} to canvas`);
                    }}
                    className="aspect-square w-full bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                    type="button"
                    aria-label={`Add ${shape.name} to canvas`}
                  >
                    <svg width="60" height="60" viewBox="-50 -50 100 100" aria-hidden="true">
                      <path
                        d={shape.path}
                        fill={shape.color}
                        opacity="0.9"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mb-8">
              <legend className="text-sm font-semibold mb-2 text-slate-300">Color Tools</legend>
              <div className="grid grid-cols-5 gap-2" role="group" aria-label="Color selection">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color);
                      announce(`Selected color ${color}`);
                    }}
                    className={`aspect-square w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                      selectedColor === color ? 'border-white scale-110' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: color }}
                    type="button"
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="mb-8">
              <legend className="text-sm font-semibold mb-2 text-slate-300">Symmetry Mode</legend>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Symmetry selection">
                {(['none', 'horizontal', 'vertical', 'radial'] as SymmetryMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSymmetryMode(mode);
                      announce(`Selected ${mode} symmetry mode`);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      symmetryMode === mode 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    type="button"
                    aria-label={`Select ${mode} symmetry mode`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className={`w-full px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showSuggestions ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                type="button"
                aria-label={showSuggestions ? 'Hide suggestions' : 'Show suggestions'}
              >
                <Sparkles size={16} />
                {showSuggestions ? 'Hide Suggestions' : 'Show Suggestions'}
              </button>
              {showSuggestions && suggestions.length > 0 && (
                <button
                  onClick={fillPattern}
                  className="w-full px-3 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                  type="button"
                  aria-label="Fill pattern with suggestions"
                >
                  <Zap size={16} />
                  Fill Pattern ({suggestions.length})
                </button>
              )}
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`w-full px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  showGrid ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                type="button"
                aria-label={showGrid ? 'Hide grid' : 'Show grid'}
              >
                <Grid size={16} />
                Grid
              </button>
              <button
                onClick={exportSvg}
                className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                type="button"
                aria-label="Export SVG"
              >
                <Download size={16} />
                Export SVG
              </button>
              <button
                onClick={clearAll}
                className="w-full px-3 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                type="button"
                aria-label="Clear all tiles"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            </div>
          </div>
        </nav>

        {/* Canvas */}
        <main 
          id="main-content"
          className="relative flex-1 overflow-hidden"
          role="application"
          aria-label="Tessellation canvas"
        >
          <div 
            ref={canvasRef}
            className="relative w-full h-[600px] select-none focus:outline-none focus:ring-2 focus:ring-cyan-400"
            style={{ 
              background: `radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 1) 100%)`,
              touchAction: 'none' // Prevent default touch behaviors
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchStart={(e) => e.preventDefault()} // Prevent page scrolling on any touch
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="img"
            aria-label={`Tessellation canvas with ${tiles.length} tiles. ${selectedTile ? `Selected: ${SHAPES[selectedTile.shape].name} at position ${selectedTile.x}, ${selectedTile.y}` : 'No tile selected'}`}
            aria-describedby="canvas-instructions"
          >
            {/* Hidden instructions for screen readers */}
            <div id="canvas-instructions" className="sr-only">
              Use arrow keys to move selected tile. Hold Shift for faster movement. 
              Press R to rotate, D to duplicate, Delete to remove. 
              Click or touch tiles to select them.
            </div>

            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox="0 0 600 600"
              className="absolute inset-0"
              style={{ touchAction: 'none' }}
              aria-hidden="true"
            >
              {/* Grid */}
              {showGrid && (
                <g aria-hidden="true">
                  {Array.from({ length: 31 }, (_, i) => (
                    <line
                      key={`v-${i}`}
                      x1={i * 20}
                      y1={0}
                      x2={i * 20}
                      y2={600}
                      stroke="rgba(148, 163, 184, 0.1)"
                      strokeWidth="0.5"
                    />
                  ))}
                  {Array.from({ length: 31 }, (_, i) => (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={i * 20}
                      x2={600}
                      y2={i * 20}
                      stroke="rgba(148, 163, 184, 0.1)"
                      strokeWidth="0.5"
                    />
                  ))}
                </g>
              )}

              {/* Tiles */}
              {tiles.map((tile) => (
                <g
                  key={tile.id}
                  transform={`translate(${tile.x}, ${tile.y}) rotate(${tile.rotation})`}
                  onMouseDown={(e) => handleMouseDown(e, tile)}
                  onTouchStart={(e) => handleTouchStart(e, tile)}
                  className="cursor-move focus:outline-none"
                  style={{ 
                    transformOrigin: '0 0',
                    touchAction: 'none'
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${SHAPES[tile.shape].name} tile at position ${tile.x}, ${tile.y}${tile.isSymmetryMirror ? ' (symmetry mirror)' : ''}. Click to select, use arrow keys to move.`}
                  onFocus={() => {
                    setSelectedTile(tile);
                    announce(`Selected ${SHAPES[tile.shape].name} tile`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTile(tile);
                      announce(`Selected ${SHAPES[tile.shape].name} tile`);
                    }
                  }}
                >
                  <path
                    d={SHAPES[tile.shape].path}
                    fill={tile.color}
                    stroke={selectedTile?.id === tile.id ? '#fbbf24' : 'rgba(255, 255, 255, 0.3)'}
                    strokeWidth={selectedTile?.id === tile.id ? '3' : '1'}
                    opacity={dragState.isDragging && dragState.tileId === tile.id ? '0.7' : tile.isSymmetryMirror ? '0.8' : '1'}
                  />
                  {/* Symmetry mirror indicator */}
                  {tile.isSymmetryMirror && (
                    <circle
                      cx="0"
                      cy="0"
                      r="3"
                      fill="rgba(168, 85, 247, 0.8)"
                      stroke="white"
                      strokeWidth="1"
                      aria-hidden="true"
                    />
                  )}
                </g>
              ))}

              {/* Smart Fill Suggestions */}
              {showSuggestions && suggestions.map((suggestion, index) => (
                <g
                  key={`suggestion-${index}`}
                  transform={`translate(${suggestion.x}, ${suggestion.y}) rotate(${suggestion.rotation})`}
                  className="pointer-events-none"
                  aria-hidden="true"
                >
                  <path
                    d={SHAPES[suggestion.shape].path}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.7"
                  />
                  <circle
                    cx="0"
                    cy="0"
                    r="4"
                    fill="#10b981"
                    opacity="0.8"
                  />
                </g>
              ))}
            </svg>

            {/* Tile Controls */}
            {selectedTile && (
              <aside 
                className="absolute bg-black/80 backdrop-blur-md rounded-lg p-2 flex gap-2 z-10"
                style={{
                  left: 20,
                  top: 20
                }}
                role="toolbar"
                aria-label={`Controls for ${SHAPES[selectedTile.shape].name} tile`}
              >
                <div className="text-white text-sm mr-2 flex items-center" aria-live="polite">
                  {SHAPES[selectedTile.shape].name}
                </div>
                <button
                  onClick={() => {
                    rotateTile(selectedTile.id);
                    announce(`Rotated ${SHAPES[selectedTile.shape].name}`);
                  }}
                  className="p-2 bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-md transition-colors"
                  type="button"
                  aria-label="Rotate tile 45 degrees"
                >
                  <RotateCw size={16} aria-hidden="true" />
                </button>
                <button
                  onClick={() => {
                    duplicateTile(selectedTile.id);
                    announce(`Duplicated ${SHAPES[selectedTile.shape].name}`);
                  }}
                  className="p-2 bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-md transition-colors"
                  type="button"
                  aria-label="Duplicate tile"
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
                <button
                  onClick={() => {
                    deleteTile(selectedTile.id);
                    announce(`Deleted ${SHAPES[selectedTile.shape].name}`);
                  }}
                  className="p-2 bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 rounded-md transition-colors"
                  type="button"
                  aria-label="Delete tile"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </aside>
            )}
          </div>
        </main>

        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-56 bg-slate-900/80 backdrop-blur-lg border-l border-slate-700/50 p-4 space-y-6 overflow-y-auto" role="complementary" aria-label="Tessellation tools">
          <section>
            <h2 className="text-sm font-semibold mb-2 text-slate-300">Shape Tools</h2>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Shape selection">
              {Object.entries(SHAPES).map(([key, shape]) => (
                <button
                  key={key}
                  onClick={() => addShape(key as ShapeType)}
                  className="aspect-square w-full bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                  type="button"
                  aria-label={`Add ${shape.name} to canvas`}
                >
                  <svg width="60" height="60" viewBox="-50 -50 100 100" aria-hidden="true">
                    <path
                      d={shape.path}
                      fill={shape.color}
                      opacity="0.9"
                    />
                  </svg>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-2 text-slate-300">Color Tools</h2>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Color selection">
              {COLORS.map((color, index) => (
                <button
                  key={color}
                  onClick={() => {
                    setSelectedColor(color);
                    announce(`Selected color ${color}`);
                  }}
                  className={`aspect-square w-6 h-6 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200 ${
                    selectedColor === color ? 'border-white scale-110' : 'border-slate-700'
                  }`}
                  style={{ backgroundColor: color }}
                  type="button"
                  aria-label={`Select color ${index + 1} of ${COLORS.length}${selectedColor === color ? ' (currently selected)' : ''}`}
                />
              ))}
            </div>
          </section>

          <section>
            <fieldset>
              <legend className="text-sm font-semibold mb-2 text-slate-300">Symmetry Mode</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Symmetry mode selection">
                {(['none', 'horizontal', 'vertical', 'radial'] as SymmetryMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setSymmetryMode(mode);
                      announce(`Selected ${mode} symmetry mode`);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200 ${
                      symmetryMode === mode 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                    type="button"
                    role="radio"
                    aria-checked={symmetryMode === mode}
                    aria-label={`${mode} symmetry mode${symmetryMode === mode ? ' (currently selected)' : ''}`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-2 text-slate-300 sr-only">Canvas Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowSuggestions(!showSuggestions);
                  announce(showSuggestions ? 'Hidden suggestions' : 'Showing suggestions');
                }}
                className={`w-full px-3 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200 flex items-center gap-2 ${
                  showSuggestions ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                type="button"
                aria-pressed={showSuggestions}
                aria-label={`${showSuggestions ? 'Hide' : 'Show'} smart fill suggestions`}
              >
                <Sparkles size={16} aria-hidden="true" />
                {showSuggestions ? 'Hide Suggestions' : 'Show Suggestions'}
              </button>
              {showSuggestions && suggestions.length > 0 && (
                <button
                  onClick={() => {
                    fillPattern();
                    announce(`Added ${suggestions.length} suggested tiles to canvas`);
                  }}
                  className="w-full px-3 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                  type="button"
                  aria-label={`Fill pattern with ${suggestions.length} suggested tiles`}
                >
                  <Zap size={16} aria-hidden="true" />
                  Fill Pattern ({suggestions.length})
                </button>
              )}
              <button
                onClick={() => {
                  setShowGrid(!showGrid);
                  announce(showGrid ? 'Hidden grid' : 'Showing grid');
                }}
                className={`w-full px-3 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-200 flex items-center gap-2 ${
                  showGrid ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                type="button"
                aria-pressed={showGrid}
                aria-label={`${showGrid ? 'Hide' : 'Show'} background grid`}
              >
                <Grid size={16} aria-hidden="true" />
                Grid
              </button>
              <button
                onClick={() => {
                  exportSvg();
                  announce('Exported tessellation as SVG file');
                }}
                className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                type="button"
                aria-label="Export tessellation as SVG file"
              >
                <Download size={16} aria-hidden="true" />
                Export SVG
              </button>
              <button
                onClick={() => {
                  clearAll();
                  announce('Cleared all tiles from canvas');
                }}
                className="w-full px-3 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-rose-400 rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                type="button"
                aria-label="Clear all tiles from canvas"
              >
                <Trash2 size={16} aria-hidden="true" />
                Clear All
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}