# 📜 Scripts Directory

Thư mục này chứa các utility scripts cho project.

## 📁 Available Scripts

### 🌱 `seed-test-data.ts`

**Mục đích:** Tạo test data để kiểm tra pagination performance

**Chức năng:**

- Tạo test server với invite code
- Tạo text channel #general
- Generate 150 messages với timestamps thực tế
- In ra invite link để truy cập

**Cách chạy:**

```bash
npm run db:seed
```

**Yêu cầu:**

- App phải đang chạy (`npm run dev`)
- User phải đã login (có currentProfile)
- Database phải đã được setup

**Output:**

```
🎉 SEED COMPLETED SUCCESSFULLY!
📊 Summary:
   Server: Test Server - Performance Testing
   Channel: #general
   Messages: 150
   Owner: [Your Name]

🔗 Invite Link:
   http://localhost:3000/invite/TEST-ABC123
```

---

### 🗄️ `setup-minio.ts`

**Mục đích:** Setup MinIO buckets cho file storage

**Cách chạy:**

```bash
npm run minio:setup
```

---

## 🔧 NPM Scripts

Trong `package.json`:

```json
{
  "scripts": {
    "db:seed": "tsx scripts/seed-test-data.ts",
    "minio:setup": "tsx scripts/setup-minio.ts"
  }
}
```

---

## 📚 Related Docs

- [`TESTING_GUIDE.md`](../TESTING_GUIDE.md) - Hướng dẫn test pagination
- [`DATABASE_OPTIMIZATION.md`](../DATABASE_OPTIMIZATION.md) - Database indexes
- [`prisma/schema.prisma`](../prisma/schema.prisma) - Database schema
