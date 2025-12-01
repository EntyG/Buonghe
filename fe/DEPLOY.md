# Hướng dẫn Deploy lên Vercel

## Cách 1: Deploy qua Vercel CLI (Nhanh nhất)

### Bước 1: Cài đặt Vercel CLI

```bash
npm install -g vercel
```

### Bước 2: Đăng nhập Vercel

```bash
vercel login
```

Sẽ mở trình duyệt để đăng nhập hoặc tạo tài khoản.

### Bước 3: Deploy

Trong thư mục project, chạy:

```bash
vercel
```

Lần đầu tiên sẽ hỏi:

- **Set up and deploy?** → Y
- **Which scope?** → Chọn tài khoản của bạn
- **Link to existing project?** → N (nếu lần đầu)
- **What's your project's name?** → Nhập tên project (ví dụ: focus-on-fun-aic-fe)
- **In which directory is your code located?** → . (current directory)
- **Override settings?** → N (dùng vercel.json)

### Bước 4: Cấu hình Environment Variables

Sau khi deploy xong, bạn cần thêm environment variables:

**Cách 1: Qua CLI**

```bash
vercel env add REACT_APP_BASE_URL
vercel env add REACT_APP_BASE_IMAGE_URL
vercel env add REACT_APP_EVENT_API_URL
```

Mỗi lần sẽ hỏi giá trị, chọn:

- **Environment** → Production, Preview, Development (hoặc chọn cả 3)

**Cách 2: Qua Web Dashboard**

1. Vào https://vercel.com/dashboard
2. Chọn project vừa deploy
3. Vào **Settings** → **Environment Variables**
4. Thêm từng biến:
   - `REACT_APP_BASE_URL` = `http://14.225.217.119:8082`
   - `REACT_APP_BASE_IMAGE_URL` = `http://14.225.217.119:8081`
   - `REACT_APP_EVENT_API_URL` = `https://eventretrieval.oj.io.vn`

### Bước 5: Redeploy

Sau khi thêm env vars, cần redeploy:

```bash
vercel --prod
```

Hoặc vào dashboard và click **Redeploy**

---

## Cách 2: Deploy qua GitHub (Khuyến nghị cho Production)

### Bước 1: Đẩy code lên GitHub

```bash
git init  # Nếu chưa có git
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Bước 2: Import Project trên Vercel

1. Vào https://vercel.com/new
2. Click **Import Git Repository**
3. Chọn GitHub và authorize nếu cần
4. Chọn repository của bạn
5. Click **Import**

### Bước 3: Cấu hình Project

- **Framework Preset**: Create React App (tự động detect)
- **Root Directory**: `./`
- **Build Command**: `npm run build` (đã có trong vercel.json)
- **Output Directory**: `build` (đã có trong vercel.json)

### Bước 4: Thêm Environment Variables

Trước khi deploy, thêm env vars:

- `REACT_APP_BASE_URL`
- `REACT_APP_BASE_IMAGE_URL`
- `REACT_APP_EVENT_API_URL`

Click **Deploy**

### Bước 5: Tự động Deploy

Sau này, mỗi lần push code lên GitHub:

- Vercel sẽ tự động build và deploy
- Mỗi PR sẽ có preview URL riêng
- Merge vào main branch sẽ deploy lên production

---

## Kiểm tra Deployment

Sau khi deploy thành công:

1. Vercel sẽ cung cấp URL: `https://your-project-name.vercel.app`
2. Có thể setup custom domain trong **Settings** → **Domains**
3. Kiểm tra console browser để đảm bảo API calls hoạt động

---

## Troubleshooting

### Lỗi Build

- Kiểm tra logs trong Vercel dashboard
- Đảm bảo `npm run build` chạy thành công local
- Kiểm tra node version (Vercel mặc định dùng Node 18)

### API không hoạt động

- Kiểm tra environment variables đã được set đúng chưa
- Kiểm tra CORS settings trên backend
- Xem Network tab trong browser DevTools

### Routing không hoạt động

- File `vercel.json` đã có rewrite rules để handle React Router
- Nếu vẫn lỗi, kiểm tra lại cấu hình

---

## Lệnh hữu ích

```bash
# Deploy lên production
vercel --prod

# Deploy preview
vercel

# Xem logs
vercel logs

# Xem thông tin project
vercel inspect

# Remove deployment
vercel remove
```

---

## Lưu ý

1. **Environment Variables**:

   - Cần set cho cả Production, Preview, và Development
   - Có thể set giá trị khác nhau cho mỗi environment

2. **Build Time**:

   - Build lần đầu có thể mất 2-3 phút
   - Các lần sau sẽ nhanh hơn nhờ cache

3. **Free Tier**:

   - 100GB bandwidth/tháng
   - Unlimited deployments
   - SSL certificate tự động

4. **Custom Domain**:
   - Vào Settings → Domains để thêm custom domain
   - Cần cấu hình DNS records
