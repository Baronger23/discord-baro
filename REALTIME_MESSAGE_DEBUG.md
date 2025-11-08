# 🔧 Hướng Dẫn Debug Realtime Messages

## ✅ Các Thay Đổi Đã Thực Hiện

### 1. **Thêm Event Mới**

- Thêm `CHAT_MESSAGE_UPDATE` event riêng cho edit/delete messages
- File: `lib/socket/constants.ts`

### 2. **Cải Thiện Hook `use-chat-socket`**

- Tách biệt handlers cho new message và update message
- Thêm logic tạo object mới hoàn toàn để trigger React re-render
- Thêm `queryClient.invalidateQueries()` để force update UI
- Thêm logging chi tiết để debug
- File: `hooks/use-chat-socket.ts`

### 3. **Server-side Changes**

- Thêm function `emitChannelMessageUpdate()` trong `lib/socket/server.ts`
- Update các API routes để emit đúng event:
  - `pages/api/socket/messages/[messageId].ts`
  - `pages/api/socket/messages/index.ts`
  - `pages/api/socket/direct-messages/[directMessageId].ts`
  - `pages/api/socket/direct-messages/index.ts`

### 4. **Type Definitions**

- Thêm `chat:message:update` event vào `ServerToClientEvents`
- File: `lib/socket/types.ts`

## 🧪 Cách Test

### Bước 1: Mở Console trong Browser

1. Bấm `F12` để mở DevTools
2. Chuyển sang tab **Console**
3. Filter bằng từ khóa: `useChatSocket`

### Bước 2: Test Edit Message

1. Gửi một tin nhắn
2. Click edit tin nhắn đó
3. Thay đổi nội dung và save
4. **Quan sát console logs:**
   ```
   [useChatSocket] Received message update: <messageId>
   [useChatSocket] Updated message found and replaced
   [useChatSocket] ✅ Message updated and query invalidated
   ```
5. **Kiểm tra UI:** Tin nhắn phải update ngay lập tức

### Bước 3: Test Delete Message

1. Click delete một tin nhắn
2. Confirm xóa
3. **Quan sát console logs** (tương tự edit)
4. **Kiểm tra UI:** Tin nhắn phải hiển thị "This message has been deleted." ngay lập tức

### Bước 4: Test Realtime Across Multiple Users

1. Mở 2 browser khác nhau (hoặc incognito)
2. Đăng nhập 2 user khác nhau
3. Vào cùng 1 channel
4. User 1: Edit/Delete message
5. User 2: Phải thấy update realtime ngay lập tức

## 🐛 Debug Logs

### Logs Bạn Sẽ Thấy:

#### Khi Socket Connect:

```
[useChatSocket] Joining room: channel:<channelId>
[useChatSocket] serverId: <serverId>, channelId: <channelId>
[useChatSocket] queryKey: chat:<chatId>
[useChatSocket] Emitted CHAT_JOIN for channel
[useChatSocket] Registering event listeners...
[useChatSocket] ✅ Event listeners registered
```

#### Khi Nhận Message Update:

```
[useChatSocket] Received message update: <messageId>
[useChatSocket] Updated message found and replaced
[useChatSocket] ✅ Message updated and query invalidated
```

#### Nếu Message Không Tìm Thấy:

```
[useChatSocket] Received message update: <messageId>
[useChatSocket] ⚠️ Message not found in cache
```

## ⚠️ Troubleshooting

### Vấn Đề 1: Message Update Không Hiển Thị

**Kiểm tra:**

- Console có log "Received message update" không?
- Console có log "Message not found in cache" không?
- Socket có đang connected không? (kiểm tra Socket Indicator trên UI)

**Giải pháp:**

- Restart dev server
- Clear browser cache
- Kiểm tra Network tab xem Socket.IO có connect không

### Vấn Đề 2: Duplicate Messages

**Kiểm tra:**

- Console có nhiều "Registering event listeners" không?
- useEffect có chạy nhiều lần không?

**Giải pháp:**

- Kiểm tra dependencies của useEffect
- Đảm bảo cleanup function đang chạy đúng

### Vấn Đề 3: Update Chậm Hoặc Lag

**Kiểm tra:**

- Network latency (ping)
- Server có log emit event không?

**Giải pháp:**

- Kiểm tra server logs: `[SOCKET_AUTH]`, `[MESSAGE_ID]`
- Kiểm tra số lượng messages trong cache (có thể quá nhiều)

## 🎯 Expected Behavior

### ✅ Đúng:

1. Edit message → UI update ngay lập tức (< 100ms)
2. Delete message → Hiển thị "deleted" ngay lập tức
3. Multiple users → Tất cả đều thấy update realtime
4. No page refresh needed
5. No duplicate messages

### ❌ Sai:

1. Phải refresh mới thấy update
2. Message bị duplicate
3. Update không sync giữa các users
4. Console có errors về Socket.IO

## 📝 Lưu Ý

- **Dev server restart**: Restart server sau khi thay đổi server-side code
- **Browser cache**: Clear cache nếu có vấn đề
- **Multiple tabs**: Test với nhiều tabs để kiểm tra realtime
- **Console logs**: Tạm thời để debug, có thể remove sau khi stable

## 🚀 Next Steps

Nếu vẫn không work:

1. Check server console logs
2. Check browser console logs
3. Check Network tab → WS (WebSocket)
4. Verify Socket.IO connection
5. Test với simple message trước

Good luck! 🎉
