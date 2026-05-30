# Backend Deployment Instructions

## 🚀 Render Deployment (Recommended)

### Option 1: One-Click Deploy (Easiest)
1. Click this button: [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/adityapandey1025/backend)
2. Fill in environment variables (see below)
3. Click Deploy

### Option 2: Manual Deploy
1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect your GitHub repo: `adityapandey1025/backend`
4. Fill in:
   - **Name**: `syncmusic-backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` ⚠️ **IMPORTANT: NOT npm run dev**
   - **Plan**: Free (upgradeable later)

5. **Environment Variables** (MUST ADD THESE):
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://adityapandey:Ballia%401234@cluster0.u9zmxjc.mongodb.net/syncmusic?retryWrites=true&w=majority&appName=Cluster0
   ALLOWED_ORIGINS=https://syncmusic-frontend.vercel.app
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=100
   ```

6. Click **Create Web Service**
7. Wait 5-10 minutes for deployment

## ✅ Verification
- Check status at: https://dashboard.render.com/services
- Test endpoint: `https://your-service-url.onrender.com/health`
- Should return: `{"status":"UP","database":"CONNECTED"}`

## 🔧 Troubleshooting

### Issue: "nodemon: not found"
**Solution**: Start Command MUST be `npm start` (not `npm run dev`)

### Issue: Port already in use
**Solution**: Clear build cache and redeploy

### Issue: MongoDB connection failed
**Solution**: 
- Verify MONGODB_URI in env vars
- Check IP whitelist in MongoDB Atlas (should be 0.0.0.0/0)
- Test connection string locally

