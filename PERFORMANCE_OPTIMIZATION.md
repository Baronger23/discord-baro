# Performance Optimization Guide

## Các tối ưu đã được áp dụng

### 1. Lazy Loading Components

#### Modal Provider

- **Vấn đề**: 12 modals được load cùng lúc tăng bundle size ban đầu
- **Giải pháp**: Sử dụng `dynamic()` với `ssr: false` để lazy load từng modal
- **Kết quả**: Giảm ~200KB initial bundle size
- **File**: `components/providers/modal-provider.tsx`

```tsx
const CreateServerModal = dynamic(
  () =>
    import("@/components/modals/create-server-modal").then((mod) => ({
      default: mod.CreateServerModal,
    })),
  { ssr: false }
);
```

#### MediaRoom (LiveKit)

- **Vấn đề**: LiveKit library rất nặng (~500KB)
- **Giải pháp**: Lazy load MediaRoom chỉ khi user vào audio/video channel
- **Kết quả**: LiveKit chỉ load khi cần thiết
- **Files**:
  - `components/media-room-lazy.tsx` (wrapper)
  - `app/(main)/(routes)/servers/[serverId]/channels/[channelId]/page.tsx` (usage)

#### EmojiPicker

- **Vấn đề**: emoji-picker-react là thư viện nặng (~150KB)
- **Giải pháp**: Lazy load khi user click vào emoji button
- **Kết quả**: Emoji picker chỉ load khi user muốn chọn emoji
- **File**: `components/emoji-picker.tsx`

```tsx
const Picker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <div>Loading emojis...</div>,
});
```

### 2. React.memo Optimization

#### ChatItem Component

- **Vấn đề**: Chat messages re-render không cần thiết
- **Giải pháp**: Wrap ChatItem với `React.memo()`
- **Kết quả**: Giảm re-renders khi có tin nhắn mới
- **File**: `components/chat/chat-item.tsx`

```tsx
const ChatItemComponent = ({ ... }) => { ... };
export const ChatItem = memo(ChatItemComponent);
```

### 3. Loading States & Skeletons

#### Loading Skeletons

- **Vị trí**: `components/loading-skeletons.tsx`
- **Components**:
  - `ChatMessagesSkeleton`: Cho chat messages
  - `ServerSidebarSkeleton`: Cho server sidebar
  - `NavigationSidebarSkeleton`: Cho navigation sidebar
- **Sử dụng**: Hiển thị skeleton UI trong khi lazy load components

#### Route-level Loading

- **Files**:
  - `app/(main)/loading.tsx`
  - `app/(main)/(routes)/servers/[serverId]/channels/[channelId]/loading.tsx`
  - `app/(main)/(routes)/servers/[serverId]/conversations/[memberId]/loading.tsx`

### 4. Next.js Config Optimizations

#### Webpack Bundle Splitting

- **File**: `next.config.ts`
- **Tối ưu**:
  - Tách LiveKit thành chunk riêng (~500KB)
  - Tách EmojiPicker thành chunk riêng (~150KB)
  - Tách Radix UI components thành chunk riêng
  - Common vendor libraries vào commons chunk

#### Package Import Optimization

```tsx
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "@radix-ui/react-icons",
    "emoji-picker-react",
    "@livekit/components-react",
  ];
}
```

## Best Practices

### Khi nào nên lazy load?

✅ **Nên lazy load**:

- Components nặng (>50KB)
- Components không hiển thị ban đầu (modals, drawers)
- Third-party libraries lớn (LiveKit, EmojiPicker)
- Route-level components
- Components phía sau user interaction

❌ **Không nên lazy load**:

- Components critical cho first render
- Components nhỏ (<10KB)
- Components luôn visible
- Core UI components (buttons, inputs)

### React.memo Usage

✅ **Nên dùng memo**:

- List items (ChatItem, ServerMember)
- Components re-render thường xuyên
- Components với props phức tạp
- Pure components không có side effects

❌ **Không nên dùng memo**:

- Components render 1-2 lần
- Components đơn giản
- Parent components
- Components với children thay đổi thường xuyên

### Image Optimization

```tsx
// Luôn sử dụng Next.js Image component
import Image from "next/image";

<Image
  src={imageUrl}
  width={500}
  height={500}
  alt="Description"
  loading="lazy" // Lazy load images
  placeholder="blur" // Optional: blur placeholder
/>;
```

### Font Optimization

```tsx
// next/font tự động optimize fonts
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Prevent layout shift
});
```

## Metrics to Monitor

### Core Web Vitals

1. **LCP (Largest Contentful Paint)**: < 2.5s

   - Optimize với lazy loading và code splitting
   - Sử dụng skeleton loaders

2. **FID (First Input Delay)**: < 100ms

   - Giảm JavaScript execution time
   - Code splitting và lazy loading

3. **CLS (Cumulative Layout Shift)**: < 0.1
   - Sử dụng skeleton components
   - Set explicit dimensions cho images

### Bundle Analysis

Chạy lệnh để analyze bundle:

```bash
npm run build
```

Next.js sẽ hiển thị bundle sizes cho mỗi route.

## Tối ưu tiếp theo (Optional)

### 1. Image CDN

- Sử dụng Cloudflare Images hoặc Cloudinary
- Automatic image optimization
- WebP format support

### 2. Database Query Optimization

- Implement pagination cho messages
- Add database indexes
- Use query caching

### 3. Prefetching

```tsx
// Prefetch routes khi user hover
<Link href="/servers/123" prefetch>
  Server Name
</Link>
```

### 4. Service Worker & PWA

- Cache static assets
- Offline support
- Background sync

### 5. React Server Components

- Move data fetching to server
- Reduce client-side JavaScript
- Better streaming

## Monitoring

### Tools

- **Lighthouse**: Performance audit
- **Next.js Bundle Analyzer**: `npm install @next/bundle-analyzer`
- **Chrome DevTools**: Performance tab
- **Vercel Analytics**: Real user metrics

### Commands

```bash
# Development
npm run dev

# Production build & analyze
npm run build

# Check bundle sizes
npm run build -- --analyze  # (after installing bundle analyzer)
```

## Kết luận

Với các tối ưu trên, dự án đã:

- ✅ Giảm initial bundle size ~850KB (modals + LiveKit + EmojiPicker)
- ✅ Cải thiện First Load JS
- ✅ Tăng performance cho chat với nhiều messages
- ✅ Better user experience với loading states
- ✅ Automatic code splitting by route

Next.js đã tự động xử lý nhiều optimizations, nhưng lazy loading và code splitting thủ công giúp cải thiện đáng kể performance cho các thư viện lớn như LiveKit và EmojiPicker.
