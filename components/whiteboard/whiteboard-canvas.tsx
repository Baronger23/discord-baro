"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { DrawCommand, DrawPoint } from "@/lib/socket/types";
import { SOCKET_EVENTS } from "@/lib/socket/constants";
import { Button } from "@/components/ui/button";
import { Eraser, Palette, Trash2, Undo2, Download, Upload } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface WhiteboardCanvasProps {
  channelId: string;
  serverId: string;
}

type DrawMode = "draw" | "erase";

const COLORS = [
  "#000000", // Black
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#FFFFFF", // White
];

const BRUSH_SIZES = [2, 4, 8, 12, 16];

export const WhiteboardCanvas = ({ channelId, serverId }: WhiteboardCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { socket } = useSocket();
  const { user } = useUser();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<DrawPoint[]>([]);
  const [mode, setMode] = useState<DrawMode>("draw");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [commands, setCommands] = useState<DrawCommand[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Join whiteboard room on mount
  useEffect(() => {
    if (!socket) return;

    socket.emit(SOCKET_EVENTS.WHITEBOARD_JOIN, {
      serverId,
      channelId,
    });

    return () => {
      socket.emit(SOCKET_EVENTS.WHITEBOARD_LEAVE, {
        channelId,
      });
    };
  }, [socket, serverId, channelId]);

  // Listen for whiteboard events
  useEffect(() => {
    if (!socket) return;

    // Receive initial state
    socket.on(SOCKET_EVENTS.WHITEBOARD_STATE, ({ state }) => {
      console.log("[WHITEBOARD] Received state:", state);
      setCommands(state.commands);
      redrawCanvas(state.commands);
    });

    // Receive draw commands from others
    socket.on(SOCKET_EVENTS.WHITEBOARD_DRAW, ({ command }) => {
      console.log("[WHITEBOARD] Received draw:", command);
      setCommands(prev => [...prev, command]);
      drawCommand(command);
    });

    // Receive clear event
    socket.on(SOCKET_EVENTS.WHITEBOARD_CLEAR, () => {
      console.log("[WHITEBOARD] Received clear");
      setCommands([]);
      clearCanvas();
    });

    // Receive undo event
    socket.on(SOCKET_EVENTS.WHITEBOARD_UNDO, ({ commandId }) => {
      console.log("[WHITEBOARD] Received undo:", commandId);
      setCommands(prev => {
        const filtered = prev.filter(cmd => cmd.id !== commandId);
        redrawCanvas(filtered);
        return filtered;
      });
    });

    return () => {
      socket.off(SOCKET_EVENTS.WHITEBOARD_STATE);
      socket.off(SOCKET_EVENTS.WHITEBOARD_DRAW);
      socket.off(SOCKET_EVENTS.WHITEBOARD_CLEAR);
      socket.off(SOCKET_EVENTS.WHITEBOARD_UNDO);
    };
  }, [socket, channelId]);

  // Redraw entire canvas
  const redrawCanvas = useCallback((cmds: DrawCommand[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all commands
    cmds.forEach(cmd => {
      drawCommand(cmd);
    });
  }, []);

  // Draw a single command
  const drawCommand = useCallback((command: DrawCommand) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (command.points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = command.type === "erase" ? "#FFFFFF" : command.color;
    ctx.lineWidth = command.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw smooth line through all points
    ctx.moveTo(command.points[0].x, command.points[0].y);
    
    for (let i = 1; i < command.points.length; i++) {
      ctx.lineTo(command.points[i].x, command.points[i].y);
    }

    ctx.stroke();
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Get mouse position relative to canvas
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): DrawPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Mouse down - start drawing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const point = getMousePos(e);
    setCurrentPoints([point]);
  }, [getMousePos]);

  // Mouse move - continue drawing
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const point = getMousePos(e);
    setCurrentPoints(prev => {
      const newPoints = [...prev, point];
      
      // Draw locally immediately for smooth experience
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx && prev.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = mode === "erase" ? "#FFFFFF" : color;
          ctx.lineWidth = brushSize;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(prev[prev.length - 1].x, prev[prev.length - 1].y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
        }
      }
      
      return newPoints;
    });
  }, [isDrawing, getMousePos, mode, color, brushSize]);

  // Mouse up - finish drawing
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    setIsDrawing(false);

    // Send to server
    if (socket && user) {
      const command = {
        type: mode,
        points: currentPoints,
        color,
        width: brushSize,
        profileId: user.id,
        displayName: user.firstName || user.username || "Anonymous",
      };

      socket.emit(SOCKET_EVENTS.WHITEBOARD_DRAW, {
        channelId,
        command,
      });
    }

    setCurrentPoints([]);
  }, [isDrawing, currentPoints, socket, user, mode, color, brushSize, channelId]);

  // Clear whiteboard
  const handleClear = useCallback(() => {
    if (!socket) return;
    
    socket.emit(SOCKET_EVENTS.WHITEBOARD_CLEAR, {
      channelId,
    });
    
    setCommands([]);
    clearCanvas();
  }, [socket, channelId, clearCanvas]);

  // Undo last command
  const handleUndo = useCallback(() => {
    if (!socket || commands.length === 0) return;
    
    const lastCommand = commands[commands.length - 1];
    
    socket.emit(SOCKET_EVENTS.WHITEBOARD_UNDO, {
      channelId,
      commandId: lastCommand.id,
    });
    
    setCommands(prev => {
      const filtered = prev.slice(0, -1);
      redrawCanvas(filtered);
      return filtered;
    });
  }, [socket, channelId, commands, redrawCanvas]);

  // Export canvas as image
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `whiteboard-${channelId}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, [channelId]);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-50 dark:bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        {/* Draw/Erase Toggle */}
        <div className="flex gap-1 border border-zinc-200 dark:border-zinc-800 rounded-md">
          <Button
            variant={mode === "draw" ? "default" : "ghost"}
            size="icon"
            onClick={() => setMode("draw")}
            title="Draw"
          >
            <Palette className="h-4 w-4" />
          </Button>
          <Button
            variant={mode === "erase" ? "default" : "ghost"}
            size="icon"
            onClick={() => setMode("erase")}
            title="Erase"
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </div>

        {/* Color Picker */}
        {mode === "draw" && (
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Choose color"
            >
              <div
                className="w-4 h-4 rounded border border-zinc-300 dark:border-zinc-700"
                style={{ backgroundColor: color }}
              />
            </Button>
            
            {showColorPicker && (
              <div className="absolute top-full mt-2 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg z-10 grid grid-cols-5 gap-1">
                {COLORS.map(c => (
                  <button
                    title="Color"
                    key={c}
                    className={cn(
                      "w-8 h-8 rounded border-2",
                      c === color ? "border-blue-500" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brush Size */}
        <div className="flex gap-1 border border-zinc-200 dark:border-zinc-800 rounded-md">
          {BRUSH_SIZES.map(size => (
            <Button
              key={size}
              variant={brushSize === size ? "default" : "ghost"}
              size="sm"
              onClick={() => setBrushSize(size)}
              title={`Brush size ${size}`}
            >
              <div
                className="rounded-full bg-current"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                }}
              />
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleUndo}
          disabled={commands.length === 0}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleClear}
          title="Clear whiteboard"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="outline"
          size="icon"
          onClick={handleExport}
          title="Export as image"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          width={2000}
          height={1200}
          className="absolute inset-0 bg-white cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-500">
        {commands.length} strokes | Mode: {mode} | 
        {mode === "draw" && ` Color: ${color} |`} Size: {brushSize}px
      </div>
    </div>
  );
};
