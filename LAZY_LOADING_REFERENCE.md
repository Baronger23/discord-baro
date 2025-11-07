# 🚀 Quick Reference: Lazy Loading Patterns

## When to Use Lazy Loading?

### ✅ ALWAYS Lazy Load

```typescript
// Heavy UI libraries (emoji pickers, rich text editors)
const EmojiPicker = dynamic(() => import("emoji-picker-react"));

// Video/Audio components
const VideoPlayer = dynamic(() => import("@livekit/components-react"));

// Modals/Dialogs (user doesn't see until triggered)
const SettingsModal = dynamic(() => import("./settings-modal"));

// File upload components
const FileUpload = dynamic(() => import("react-dropzone"));

// Charts/Graphs (data visualization)
const Chart = dynamic(() => import("recharts"));

// Admin panels (rarely accessed)
const AdminDashboard = dynamic(() => import("./admin-dashboard"));
```

### ❌ NEVER Lazy Load

```typescript
// ❌ DON'T lazy load authentication
import { useAuth } from "@clerk/nextjs"; // Always needed

// ❌ DON'T lazy load navigation
import { Sidebar } from "./sidebar"; // Always visible

// ❌ DON'T lazy load Socket.IO (real-time critical)
import { io } from "socket.io-client";

// ❌ DON'T lazy load small utilities
import { cn } from "@/lib/utils"; // Tiny helper (<1KB)
```

---

## 📝 Code Patterns

### Pattern 1: Basic Lazy Loading

```typescript
import dynamic from "next/dynamic";

const HeavyComponent = dynamic(() => import("./heavy-component"), {
  ssr: false, // Skip server-side rendering
  loading: () => <LoadingSpinner />, // Show while loading
});

export function Page() {
  return <HeavyComponent />;
}
```

### Pattern 2: Named Export

```typescript
const EmojiPicker = dynamic(
  () =>
    import("emoji-picker-react").then((mod) => ({
      default: mod.EmojiPicker, // Named export
    })),
  { ssr: false }
);
```

### Pattern 3: Conditional Lazy Loading

```typescript
export function ChatInput() {
  const [showEmoji, setShowEmoji] = useState(false);

  return (
    <>
      <button onClick={() => setShowEmoji(true)}>😀</button>
      {showEmoji && <LazyEmojiPicker />} {/* Only loads when clicked */}
    </>
  );
}
```

### Pattern 4: Multiple Components

```typescript
// Load both at same time
const [Editor, Preview] = [
  dynamic(() => import("./editor")),
  dynamic(() => import("./preview")),
];
```

### Pattern 5: Preload on Hover

```typescript
const VideoPlayer = dynamic(() => import("./video-player"));

function VideoButton() {
  return (
    <button
      onMouseEnter={() => {
        // Preload component on hover
        import("./video-player");
      }}
    >
      Play Video
    </button>
  );
}
```

---

## 🛠️ Webpack Code Splitting

### Basic Configuration

```typescript
// next.config.ts
export default {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          // Separate vendor bundle
          vendor: {
            test: /node_modules/,
            name: "vendor",
            priority: 10,
          },
        },
      };
    }
    return config;
  },
};
```

### Advanced: Framework-Specific Chunks

```typescript
cacheGroups: {
  // React core (changes rarely)
  framework: {
    test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
    name: 'framework',
    priority: 40,
  },
  // Large library (lazy load recommended)
  livekit: {
    test: /[\\/]node_modules[\\/]@livekit[\\/]/,
    name: 'livekit',
    priority: 30,
  }
}
```

---

## 📊 Loading States

### Skeleton Pattern

```typescript
const HeavyComponent = dynamic(() => import("./heavy"), {
  loading: () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
  ),
});
```

### Spinner Pattern

```typescript
import { Loader2 } from "lucide-react";

const HeavyComponent = dynamic(() => import("./heavy"), {
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});
```

### Progress Pattern

```typescript
function LoadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 90));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return <ProgressBar value={progress} />;
}
```

---

## 🎯 Performance Checklist

### Before Deployment

```
□ Run `npm run build` and check bundle sizes
□ Verify lazy chunks are created (.next/static/chunks/)
□ Test lazy loading in production mode (npm start)
□ Check loading states appear correctly
□ Measure with Lighthouse (target: 90+)
□ Test on slow 3G network
□ Verify no console errors in production
```

### Monitoring

```typescript
// Track lazy load performance
const HeavyComponent = dynamic(() => {
  const start = performance.now();
  return import("./heavy").then((mod) => {
    const duration = performance.now() - start;
    console.log(`Heavy component loaded in ${duration}ms`);
    return mod;
  });
});
```

---

## 🔍 Debugging Tips

### Check if Component is Lazy Loaded

```typescript
// In browser DevTools Network tab:
// - Should see separate .js chunk files
// - Chunks load on-demand, not on initial page load

// Example:
// emoji-picker.chunk.abc123.js  ← Only loads when clicked
// livekit.chunk.def456.js       ← Only loads when join video
```

### Bundle Analyzer

```bash
npm install --save-dev @next/bundle-analyzer

# In next.config.ts:
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

# Run:
set ANALYZE=true && npm run build
```

### Common Issues

```typescript
// ❌ Problem: Component still in main bundle
const Component = dynamic(() => import("./component"));

// ✅ Solution: Make sure you're using the dynamic import
// Not:  import Component from './component';
// Use:  const Component = dynamic(() => import('./component'));

// ❌ Problem: SSR error
// ✅ Solution: Set ssr: false
const Component = dynamic(() => import("./component"), {
  ssr: false, // Skip server-side rendering
});
```

---

## 📚 Real-World Examples

### Example 1: Emoji Picker

```typescript
// components/emoji-picker.tsx
"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const Picker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[350px]">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
});

export function EmojiPicker({ onChange }) {
  return (
    <Popover>
      <PopoverTrigger>😀</PopoverTrigger>
      <PopoverContent>
        <Picker onEmojiClick={(data) => onChange(data.emoji)} />
      </PopoverContent>
    </Popover>
  );
}
```

### Example 2: Video Conference

```typescript
// components/media-room.tsx
"use client";
import dynamic from "next/dynamic";

const LiveKitRoom = dynamic(
  () => import("@livekit/components-react").then((m) => m.LiveKitRoom),
  { ssr: false }
);

const VideoConference = dynamic(
  () => import("@livekit/components-react").then((m) => m.VideoConference),
  { ssr: false }
);

export function MediaRoom({ chatId, video, audio }) {
  // Component logic...
  return (
    <LiveKitRoom token={token} video={video} audio={audio}>
      <VideoConference />
    </LiveKitRoom>
  );
}
```

### Example 3: Modal Provider

```typescript
// components/providers/modal-provider.tsx
"use client";
import dynamic from "next/dynamic";

// Each modal is a separate chunk
const CreateServerModal = dynamic(
  () =>
    import("@/components/modals/create-server-modal").then((m) => ({
      default: m.CreateServerModal,
    })),
  { ssr: false }
);

const InviteModal = dynamic(
  () =>
    import("@/components/modals/invite-modal").then((m) => ({
      default: m.InviteModal,
    })),
  { ssr: false }
);

export function ModalProvider() {
  return (
    <>
      <CreateServerModal />
      <InviteModal />
      {/* ... more modals */}
    </>
  );
}
```

---

## 🎓 Best Practices

### 1. Size Threshold

```
> 100KB → Definitely lazy load
50-100KB → Consider lazy loading
< 50KB  → Probably not worth it
```

### 2. User Experience Priority

```typescript
// ✅ Good: Preload on hover/focus
<button
  onMouseEnter={() => import("./modal")}
  onClick={() => setShowModal(true)}
>
  Open
</button>;

// ❌ Bad: No loading state
{
  show && <LazyComponent />;
}

// ✅ Good: With loading state
{
  show && (
    <Suspense fallback={<Loading />}>
      <LazyComponent />
    </Suspense>
  );
}
```

### 3. Network-Aware Loading

```typescript
// Check connection speed
const connection = navigator.connection;
const isFastNetwork = connection?.effectiveType === "4g";

// Only lazy load on slow networks
const Component = isFastNetwork
  ? require("./component").default
  : dynamic(() => import("./component"));
```

---

## 🚀 Quick Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Start production server
npm start

# Analyze bundle
set ANALYZE=true && npm run build

# Lighthouse audit
lighthouse http://localhost:3000 --view
```

---

## 📖 Further Reading

- [Next.js Dynamic Imports](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [React.lazy()](https://react.dev/reference/react/lazy)
- [Webpack Code Splitting](https://webpack.js.org/guides/code-splitting/)
- [Web Performance](https://web.dev/fast/)

---

**Keep this as your go-to reference for lazy loading!** 📚
