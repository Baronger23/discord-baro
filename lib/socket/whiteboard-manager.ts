/**
 * Whiteboard State Manager
 * Quản lý trạng thái whiteboard trong memory để tối ưu performance
 * Lưu vào database định kỳ và khi có sự kiện quan trọng
 */

import { DrawCommand, WhiteboardState } from "./types";
import { db } from "@/lib/db";

class WhiteboardManager {
  // In-memory cache: channelId -> WhiteboardState
  private whiteboardStates: Map<string, WhiteboardState> = new Map();
  
  // Track unsaved changes: channelId -> boolean
  private dirtyChannels: Set<string> = new Set();
  
  // Auto-save interval (5 seconds)
  private saveInterval: NodeJS.Timeout | null = null;
  
  // Max commands to keep in memory (để tránh memory leak)
  private readonly MAX_COMMANDS = 10000;
  
  constructor() {
    this.startAutoSave();
  }

  /**
   * Khởi tạo auto-save mỗi 5 giây
   */
  private startAutoSave() {
    if (this.saveInterval) return;
    
    this.saveInterval = setInterval(async () => {
      await this.saveAllDirty();
    }, 5000);
  }

  /**
   * Dừng auto-save (khi shutdown server)
   */
  public stopAutoSave() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  /**
   * Load whiteboard state từ database
   */
  public async loadState(channelId: string): Promise<WhiteboardState> {
    // Check cache first
    if (this.whiteboardStates.has(channelId)) {
      return this.whiteboardStates.get(channelId)!;
    }

    try {
      // Load từ database
      const dbState = await db.whiteboardState.findUnique({
        where: { channelId },
      });

      let state: WhiteboardState;
      
      if (dbState && dbState.drawingData) {
        // Parse drawing data từ JSON
        const commands = JSON.parse(dbState.drawingData) as DrawCommand[];
        state = {
          commands,
          version: dbState.version,
        };
      } else {
        // Tạo state mới nếu chưa có
        state = {
          commands: [],
          version: 0,
        };
        
        // Create initial state in database
        await db.whiteboardState.create({
          data: {
            channelId,
            drawingData: "[]",
            version: 0,
          },
        });
      }

      // Cache state
      this.whiteboardStates.set(channelId, state);
      
      return state;
    } catch (error) {
      console.error("[WHITEBOARD] Failed to load state:", error);
      
      // Return empty state on error
      const emptyState: WhiteboardState = {
        commands: [],
        version: 0,
      };
      
      this.whiteboardStates.set(channelId, emptyState);
      return emptyState;
    }
  }

  /**
   * Thêm draw command vào state
   */
  public addCommand(channelId: string, command: DrawCommand): WhiteboardState {
    const state = this.whiteboardStates.get(channelId) || {
      commands: [],
      version: 0,
    };

    // Add command
    state.commands.push(command);
    state.version++;

    // Giới hạn số lượng commands để tránh memory leak
    if (state.commands.length > this.MAX_COMMANDS) {
      // Giữ lại 80% commands gần nhất
      const keepCount = Math.floor(this.MAX_COMMANDS * 0.8);
      state.commands = state.commands.slice(-keepCount);
    }

    // Update cache
    this.whiteboardStates.set(channelId, state);
    this.dirtyChannels.add(channelId);

    return state;
  }

  /**
   * Clear toàn bộ whiteboard
   */
  public async clearWhiteboard(channelId: string, profileId: string): Promise<WhiteboardState> {
    const state: WhiteboardState = {
      commands: [],
      version: 0,
    };

    this.whiteboardStates.set(channelId, state);
    this.dirtyChannels.add(channelId);

    // Save immediately cho clear action
    await this.saveState(channelId, profileId);

    return state;
  }

  /**
   * Undo một command cụ thể
   */
  public undoCommand(channelId: string, commandId: string): WhiteboardState | null {
    const state = this.whiteboardStates.get(channelId);
    
    if (!state) return null;

    // Remove command by id
    const index = state.commands.findIndex(cmd => cmd.id === commandId);
    
    if (index !== -1) {
      state.commands.splice(index, 1);
      state.version++;
      
      this.whiteboardStates.set(channelId, state);
      this.dirtyChannels.add(channelId);
      
      return state;
    }

    return null;
  }

  /**
   * Lưu state của một channel vào database
   */
  public async saveState(channelId: string, lastEditBy?: string): Promise<void> {
    const state = this.whiteboardStates.get(channelId);
    
    if (!state) return;

    try {
      // Serialize commands to JSON
      const drawingData = JSON.stringify(state.commands);

      await db.whiteboardState.upsert({
        where: { channelId },
        update: {
          drawingData,
          version: state.version,
          lastEditBy: lastEditBy || undefined,
          lastEditAt: new Date(),
        },
        create: {
          channelId,
          drawingData,
          version: state.version,
          lastEditBy: lastEditBy || undefined,
        },
      });

      // Mark as clean
      this.dirtyChannels.delete(channelId);
      
      console.log(`[WHITEBOARD] Saved state for channel ${channelId}, version ${state.version}`);
    } catch (error) {
      console.error(`[WHITEBOARD] Failed to save state for channel ${channelId}:`, error);
    }
  }

  /**
   * Lưu tất cả channels có thay đổi
   */
  public async saveAllDirty(): Promise<void> {
    if (this.dirtyChannels.size === 0) return;

    console.log(`[WHITEBOARD] Auto-saving ${this.dirtyChannels.size} dirty channels...`);

    const savePromises = Array.from(this.dirtyChannels).map(channelId =>
      this.saveState(channelId)
    );

    await Promise.all(savePromises);
  }

  /**
   * Xóa cache của một channel (khi không còn user nào)
   */
  public async unloadChannel(channelId: string): Promise<void> {
    // Save trước khi unload
    if (this.dirtyChannels.has(channelId)) {
      await this.saveState(channelId);
    }

    this.whiteboardStates.delete(channelId);
    console.log(`[WHITEBOARD] Unloaded channel ${channelId} from memory`);
  }

  /**
   * Get current state without loading (for quick checks)
   */
  public getStateSync(channelId: string): WhiteboardState | null {
    return this.whiteboardStates.get(channelId) || null;
  }

  /**
   * Cleanup khi shutdown server
   */
  public async shutdown(): Promise<void> {
    console.log("[WHITEBOARD] Shutting down, saving all states...");
    
    this.stopAutoSave();
    await this.saveAllDirty();
    
    this.whiteboardStates.clear();
    this.dirtyChannels.clear();
    
    console.log("[WHITEBOARD] Shutdown complete");
  }
}

// Singleton instance
export const whiteboardManager = new WhiteboardManager();

// Graceful shutdown
if (typeof process !== "undefined") {
  process.on("SIGTERM", async () => {
    await whiteboardManager.shutdown();
  });
  
  process.on("SIGINT", async () => {
    await whiteboardManager.shutdown();
  });
}
